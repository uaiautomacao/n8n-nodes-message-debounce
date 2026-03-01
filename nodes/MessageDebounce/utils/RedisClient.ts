/**
 * Minimal Redis client using the native Node.js `net` module.
 * Implements the RESP2 (REdis Serialization Protocol) specification.
 * Zero external dependencies — required for n8n verified community nodes.
 *
 * Supported commands: AUTH, SELECT, RPUSH, LLEN, LINDEX, LRANGE, DEL, EXPIRE, SET, GET, EVAL
 */

import * as net from 'net';
import * as tls from 'tls';

export interface RedisCredentials {
    host: string;
    port: number;
    username?: string;
    user?: string;
    password?: string;
    database?: number;
    tls?: boolean;
    ssl?: boolean;
}

type RespValue = string | number | null | RespValue[];

const CRLF = '\r\n';
const CONN_TIMEOUT_MS = 10_000;

/** Encodes a command array into the RESP bulk string array format. */
function encodeCommand(args: Array<string | number>): string {
    let cmd = `*${args.length}${CRLF}`;
    for (const arg of args) {
        const str = String(arg);
        cmd += `$${Buffer.byteLength(str, 'utf8')}${CRLF}${str}${CRLF}`;
    }
    return cmd;
}

/** RESP2 parser — processes a raw Buffer and returns typed values. */
class RespParser {
    private buffer: Buffer = Buffer.alloc(0);

    feed(data: Buffer): void {
        this.buffer = Buffer.concat([this.buffer, data]);
    }

    /** Attempt to parse one complete value from the buffer. Returns undefined if incomplete. */
    tryParse(): { value: RespValue; remainder: Buffer } | undefined {
        const result = this.parseValue(this.buffer, 0);
        if (result === undefined) return undefined;
        this.buffer = this.buffer.subarray(result.pos);
        return { value: result.value, remainder: this.buffer };
    }

    private parseValue(buf: Buffer, pos: number): { value: RespValue; pos: number } | undefined {
        if (pos >= buf.length) return undefined;

        const type = buf[pos]; // char code
        const lineEnd = buf.indexOf(CRLF, pos + 1);
        if (lineEnd === -1) return undefined;

        const line = buf.toString('utf8', pos + 1, lineEnd);
        const afterLine = lineEnd + 2;

        switch (type) {
            case 43: // '+' Simple string
                return { value: line, pos: afterLine };

            case 45: // '-' Error
                throw new Error(line);

            case 58: // ':' Integer
                return { value: parseInt(line, 10), pos: afterLine };

            case 36: { // '$' Bulk string
                const len = parseInt(line, 10);
                if (len === -1) return { value: null, pos: afterLine };
                const end = afterLine + len + 2; // +2 for trailing CRLF
                if (buf.length < end) return undefined;
                return { value: buf.toString('utf8', afterLine, afterLine + len), pos: end };
            }

            case 42: { // '*' Array
                const count = parseInt(line, 10);
                if (count === -1) return { value: null, pos: afterLine };
                const arr: RespValue[] = [];
                let cur = afterLine;
                for (let i = 0; i < count; i++) {
                    const item = this.parseValue(buf, cur);
                    if (item === undefined) return undefined;
                    arr.push(item.value);
                    cur = item.pos;
                }
                return { value: arr, pos: cur };
            }

            default:
                throw new Error(`Unknown RESP type byte: "${String.fromCharCode(type)}" (${type})`);
        }
    }
}

export class RedisClient {
    private socket: net.Socket | null = null;
    private readonly host: string;
    private readonly port: number;
    private readonly username: string;
    private readonly password: string;
    private readonly database: number;
    private readonly useTls: boolean;

    private pendingCallbacks: Array<{ resolve: (v: RespValue) => void; reject: (e: Error) => void }> =
        [];
    private parser = new RespParser();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(credentials: any) {
        this.host = credentials.host || 'localhost';
        this.port = credentials.port || 6379;
        this.username = credentials.username || credentials.user || '';
        this.password = credentials.password || '';
        this.database = credentials.database ?? 0;
        this.useTls = credentials.tls ?? credentials.ssl ?? false;
    }

    /** Establish connection and authenticate. */
    async connect(): Promise<void> {
        const rawSocket = await this.openSocket();
        this.socket = rawSocket;

        this.socket.on('data', (data: Buffer) => {
            this.parser.feed(data);
            this.drainParser();
        });

        this.socket.on('error', (err: Error) => {
            const pending = this.pendingCallbacks.splice(0);
            for (const cb of pending) {
                cb.reject(err);
            }
        });

        this.socket.on('close', () => {
            const pending = this.pendingCallbacks.splice(0);
            const err = new Error('Redis connection closed unexpectedly');
            for (const cb of pending) {
                cb.reject(err);
            }
        });

        // Redis 6+ ACL: AUTH username password
        // Redis 5 and below: AUTH password
        if (this.password) {
            if (this.username) {
                await this.send(['AUTH', this.username, this.password]);
            } else {
                await this.send(['AUTH', this.password]);
            }
        }

        if (this.database !== 0) {
            await this.send(['SELECT', this.database]);
        }
    }

    /** Close the socket gracefully. */
    disconnect(): void {
        if (this.socket) {
            this.socket.destroy();
            this.socket = null;
        }
    }

    // -------------------------------------------------------------------------
    // Public Redis commands
    // -------------------------------------------------------------------------

    async rpush(key: string, value: string): Promise<number> {
        return (await this.send(['RPUSH', key, value])) as number;
    }

    async llen(key: string): Promise<number> {
        return (await this.send(['LLEN', key])) as number;
    }

    async lindex(key: string, index: number): Promise<string | null> {
        return (await this.send(['LINDEX', key, index])) as string | null;
    }

    async lrange(key: string, start: number, stop: number): Promise<string[]> {
        const result = await this.send(['LRANGE', key, start, stop]);
        return (result as RespValue[]).map((v) => v as string);
    }

    async del(...keys: string[]): Promise<number> {
        return (await this.send(['DEL', ...keys])) as number;
    }

    async expire(key: string, seconds: number): Promise<number> {
        return (await this.send(['EXPIRE', key, seconds])) as number;
    }

    /**
     * SET with optional NX and EX flags.
     * Returns 'OK' on success, null if NX condition was not met.
     */
    async set(
        key: string,
        value: string,
        options?: { nx?: boolean; ex?: number },
    ): Promise<string | null> {
        const args: Array<string | number> = ['SET', key, value];
        if (options?.ex !== undefined) {
            args.push('EX', options.ex);
        }
        if (options?.nx) {
            args.push('NX');
        }
        return (await this.send(args)) as string | null;
    }

    async get(key: string): Promise<string | null> {
        return (await this.send(['GET', key])) as string | null;
    }

    /**
     * Execute a Lua script atomically.
     * @param script  Lua source code
     * @param keys    KEYS array
     * @param args    ARGV array
     */
    async eval(script: string, keys: string[], args: string[]): Promise<RespValue> {
        return this.send(['EVAL', script, keys.length, ...keys, ...args]);
    }

    // -------------------------------------------------------------------------
    // Private internals
    // -------------------------------------------------------------------------

    private openSocket(): Promise<net.Socket> {
        return new Promise((resolve, reject) => {
            const onError = (err: Error) => {
                reject(new Error(`Redis connection failed: ${err.message}`));
            };

            let socket: net.Socket;

            if (this.useTls) {
                socket = tls.connect(
                    { host: this.host, port: this.port, rejectUnauthorized: true },
                    () => {
                        socket.removeListener('error', onError);
                        socket.setTimeout(0);
                        socket.removeAllListeners('timeout');
                        resolve(socket);
                    },
                );
            } else {
                socket = net.createConnection({ host: this.host, port: this.port }, () => {
                    socket.removeListener('error', onError);
                    socket.setTimeout(0);
                    socket.removeAllListeners('timeout');
                    resolve(socket);
                });
            }

            socket.setTimeout(CONN_TIMEOUT_MS);
            socket.once('error', onError);
            socket.once('timeout', () => {
                socket.destroy();
                reject(new Error(`Redis connection timed out after ${CONN_TIMEOUT_MS}ms`));
            });
        });
    }

    private send(args: Array<string | number>): Promise<RespValue> {
        return new Promise((resolve, reject) => {
            if (!this.socket || this.socket.destroyed) {
                reject(new Error('Redis socket is not connected'));
                return;
            }

            const timeoutId = setTimeout(() => {
                const idx = this.pendingCallbacks.findIndex((cb) => cb.resolve === resolve);
                if (idx !== -1) {
                    this.pendingCallbacks.splice(idx, 1);
                    reject(new Error(`Redis command timed out after 5000ms: ${args[0]}`));
                }
            }, 5000);

            this.pendingCallbacks.push({
                resolve: (val: RespValue) => { clearTimeout(timeoutId); resolve(val); },
                reject: (err: Error) => { clearTimeout(timeoutId); reject(err); }
            });

            this.socket.write(encodeCommand(args));
        });
    }

    private drainParser(): void {
        while (this.pendingCallbacks.length > 0) {
            let parsed: { value: RespValue; remainder: Buffer } | undefined;
            try {
                parsed = this.parser.tryParse();
            } catch (err) {
                const cb = this.pendingCallbacks.shift();
                if (cb) cb.reject(err instanceof Error ? err : new Error(String(err)));
                continue;
            }
            if (parsed === undefined) break;
            const cb = this.pendingCallbacks.shift();
            if (cb) cb.resolve(parsed.value);
        }
    }
}
