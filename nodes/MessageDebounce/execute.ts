/**
 * Core debounce execution flow for the MessageDebounce node.
 *
 * Extracted from MessageDebounce.node.ts so that execute() (which TypeScript
 * types as `this: IExecuteFunctions`) can call it cleanly as a standalone function.
 *
 * All business logic for buffering, flushing, and race-condition handling lives here.
 */

import { randomUUID } from 'crypto';
import type { IDataObject, INodeExecutionData } from 'n8n-workflow';

import { FLUSH_SCRIPT } from './constants';
import { sleep, makeKeys, wrapRedisError, toTtlSeconds } from './helpers';
import type { FlushReason, MessageEntry, DebounceOutput, ResolvedOptions } from './types';
import type { RedisClient } from './utils/RedisClient';

export async function runDebounce(
    redis: RedisClient,
    sessionId: string,
    message: string,
    debounceWindowSec: number,
    opts: ResolvedOptions,
    itemIndex: number,
): Promise<INodeExecutionData[][]> {
    const { msgKey, tsKey, sessionKey } = makeKeys(sessionId);

    /** Reads all buffered messages, deletes message/ts keys (keeps sessionKey), returns n8n output. */
    const flush = async (reason: FlushReason): Promise<INodeExecutionData[][]> => {
        let entries: string[];
        try {
            entries = await redis.lrange(msgKey, 0, -1);
            // Delete message list and start-time key, but NOT sessionKey.
            // sessionKey persists until TTL expires to track active sessions.
            await redis.del(msgKey, tsKey);
        } catch (err) {
            throw wrapRedisError(err);
        }
        const messages = entries.map((raw) => {
            try {
                return (JSON.parse(raw) as MessageEntry).content;
            } catch {
                return raw;
            }
        });
        const output: DebounceOutput = {
            fullMessage: messages.join(opts.separator),
            messageCount: messages.length,
            flushReason: reason,
        };
        return [[{ json: output as unknown as IDataObject, pairedItem: { item: itemIndex } }]];
    };

    // -------------------------------------------------------------------------
    // Step 1 — Is this the first message in the session?
    // We use a dedicated sessionKey instead of llen() so that flush() can clear
    // the message list without resetting the "first message" guard.
    // -------------------------------------------------------------------------
    let sessionExists: string | null;
    try {
        sessionExists = await redis.get(sessionKey);
    } catch (err) {
        throw wrapRedisError(err);
    }
    const isFirstMessage = sessionExists === null;

    // -------------------------------------------------------------------------
    // Step 2 — First-message special behaviors
    // -------------------------------------------------------------------------
    if (isFirstMessage && opts.firstMsgBehavior === 'immediate') {
        const entry: MessageEntry = { id: randomUUID(), content: message };
        try {
            // Mark session as active BEFORE flushing so subsequent messages know
            // the session already started.
            await redis.set(sessionKey, '1');
            const ttlSec = toTtlSeconds(opts.sessionTtlValue, opts.sessionTtlUnit);
            if (ttlSec > 0) {
                await redis.expire(sessionKey, ttlSec);
            }
            await redis.rpush(msgKey, JSON.stringify(entry));
        } catch (err) {
            throw wrapRedisError(err);
        }
        return flush('firstMessage');
    }

    // -------------------------------------------------------------------------
    // Step 3 — Duplicate message handling
    // -------------------------------------------------------------------------
    if (opts.onDuplicate !== 'include') {
        let lastRaw: string | null = null;
        try {
            lastRaw = await redis.lindex(msgKey, -1);
        } catch (err) {
            throw wrapRedisError(err);
        }
        if (lastRaw !== null) {
            let lastEntry: MessageEntry | null = null;
            try {
                lastEntry = JSON.parse(lastRaw) as MessageEntry;
            } catch {
                // malformed entry — treat as not duplicate
            }
            if (lastEntry?.content === message) {
                if (opts.onDuplicate === 'ignore') return [[]];
                if (opts.onDuplicate === 'flush') {
                    const entry: MessageEntry = { id: randomUUID(), content: message };
                    try {
                        await redis.rpush(msgKey, JSON.stringify(entry));
                    } catch (err) {
                        throw wrapRedisError(err);
                    }
                    return flush('duplicate');
                }
            }
        }
    }

    // -------------------------------------------------------------------------
    // Step 4 — Flush keywords
    // -------------------------------------------------------------------------
    if (opts.flushKeywords.length > 0) {
        const lower = message.toLowerCase();
        if (opts.flushKeywords.some((kw) => lower.includes(kw))) {
            const entry: MessageEntry = { id: randomUUID(), content: message };
            try {
                await redis.rpush(msgKey, JSON.stringify(entry));
            } catch (err) {
                throw wrapRedisError(err);
            }
            return flush('keyword');
        }
    }

    // -------------------------------------------------------------------------
    // Step 5 — Push message + record session metadata
    // -------------------------------------------------------------------------
    const entry: MessageEntry = { id: randomUUID(), content: message };
    let newLen: number;
    try {
        newLen = await redis.rpush(msgKey, JSON.stringify(entry));
    } catch (err) {
        throw wrapRedisError(err);
    }

    // Record start time only once per session (NX flag).
    try {
        await redis.set(tsKey, String(Date.now()), { nx: true });
    } catch (err) {
        throw wrapRedisError(err);
    }

    // Mark session as active and apply TTL to all keys.
    const ttlSec = toTtlSeconds(opts.sessionTtlValue, opts.sessionTtlUnit);
    try {
        // sessionKey: use SET NX so we don't overwrite an existing session marker
        await redis.set(sessionKey, '1', { nx: true });
        if (ttlSec > 0) {
            await redis.expire(msgKey, ttlSec);
            await redis.expire(tsKey, ttlSec);
            await redis.expire(sessionKey, ttlSec);
        }
    } catch (err) {
        throw wrapRedisError(err);
    }

    // -------------------------------------------------------------------------
    // Step 6 — Max messages threshold (flush before sleeping)
    // -------------------------------------------------------------------------
    if (opts.maxMessages > 0 && newLen >= opts.maxMessages) {
        return flush('maxMessages');
    }

    // -------------------------------------------------------------------------
    // Step 7 — Sleep (debounce window, racing against maxWait if configured)
    // -------------------------------------------------------------------------
    const windowMs =
        isFirstMessage && opts.firstMsgBehavior === 'customWindow'
            ? opts.firstMsgCustomWindow * 1000
            : debounceWindowSec * 1000;

    let maxWaitMs = 0;
    if (opts.maxWaitTimeSec > 0) {
        let startTimeRaw: string | null = null;
        try {
            startTimeRaw = await redis.get(tsKey);
        } catch (err) {
            throw wrapRedisError(err);
        }
        if (startTimeRaw !== null) {
            const elapsed = Date.now() - parseInt(startTimeRaw, 10);
            maxWaitMs = Math.max(0, opts.maxWaitTimeSec * 1000 - elapsed);
        }
    }

    let timedOutByMaxWait = false;
    if (opts.maxWaitTimeSec > 0 && maxWaitMs <= windowMs) {
        await Promise.race([
            sleep(windowMs),
            sleep(maxWaitMs).then(() => {
                timedOutByMaxWait = true;
            }),
        ]);
    } else {
        await sleep(windowMs);
    }

    if (timedOutByMaxWait) {
        return flush('maxWaitTime');
    }

    // -------------------------------------------------------------------------
    // Step 8 — Atomic Lua compare-and-flush
    // -------------------------------------------------------------------------
    let luaResult: unknown;
    try {
        luaResult = await redis.eval(FLUSH_SCRIPT, [msgKey, tsKey], [entry.id]);
    } catch (err) {
        throw wrapRedisError(err);
    }

    if (luaResult === null || !Array.isArray(luaResult)) {
        // A newer message arrived after ours — stop the flow silently, no output.
        return [[]];
    }

    // We won the race — emit the full consolidated message.
    const messages = (luaResult as string[]).map((raw) => {
        try {
            return (JSON.parse(raw) as MessageEntry).content;
        } catch {
            return raw;
        }
    });

    const output: DebounceOutput = {
        fullMessage: messages.join(opts.separator),
        messageCount: messages.length,
        flushReason: 'debounceWindow',
    };

    return [[{ json: output as unknown as IDataObject, pairedItem: { item: itemIndex } }]];
}
