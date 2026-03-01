/**
 * Type definitions for the MessageDebounce node.
 * Single source of truth for shared interfaces and types.
 */

/** Reason that triggered a debounce flush. */
export type FlushReason =
    | 'debounceWindow'
    | 'maxMessages'
    | 'maxWaitTime'
    | 'keyword'
    | 'firstMessage'
    | 'duplicate';

/** A single buffered message stored in Redis. */
export interface MessageEntry {
    id: string;
    content: string;
}

/** The consolidated output emitted when a flush occurs. */
export interface DebounceOutput {
    fullMessage: string;
    messageCount: number;
    flushReason: FlushReason;
}

/** Resolved options from the node's Options collection. */
export interface ResolvedOptions {
    maxMessages: number;
    maxWaitTimeSec: number;
    separator: string;
    onDuplicate: string;
    firstMsgBehavior: string;
    firstMsgCustomWindow: number;
    sessionTtlUnit: string;
    sessionTtlValue: number;
    flushKeywords: string[];
}
