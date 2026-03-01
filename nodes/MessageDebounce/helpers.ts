/**
 * Pure helper functions for the MessageDebounce node.
 * No n8n or Redis imports here — just plain TypeScript utilities.
 */

import { TTL_MULTIPLIERS } from './constants';

/** Promise-based sleep. */
export function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).setTimeout(resolve, ms);
    });
}

/** Returns the Redis key names for a given session ID. */
export function makeKeys(sessionId: string): { msgKey: string; tsKey: string; sessionKey: string } {
    return {
        msgKey: `debounce:${sessionId}:msgs`,
        tsKey: `debounce:${sessionId}:startTime`,
        sessionKey: `debounce:${sessionId}:session`,
    };
}

/** Wraps a Redis error with a user-friendly prefix. */
export function wrapRedisError(err: unknown): Error {
    const msg = err instanceof Error ? err.message : String(err);
    return new Error(`Redis operation failed: ${msg}`);
}

/**
 * Converts a user-facing TTL (value + unit) to seconds.
 * Returns 0 when unit is 'never' (no expiry).
 */
export function toTtlSeconds(value: number, unit: string): number {
    if (unit === 'never') return 0;
    const multiplier = TTL_MULTIPLIERS[unit] ?? 60;
    return Math.round(value * multiplier);
}
