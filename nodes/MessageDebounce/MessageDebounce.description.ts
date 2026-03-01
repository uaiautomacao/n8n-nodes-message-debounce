/* eslint-disable n8n-nodes-base/node-filename-against-convention */
/**
 * UI definition for the MessageDebounce node.
 * Contains the complete INodeTypeDescription — what the n8n editor renders.
 * Keep this file focused on structure and labels only; no business logic here.
 */

import type { INodeTypeDescription } from 'n8n-workflow';

export const description: INodeTypeDescription = {
    displayName: 'Message Debounce',
    name: 'messageDebounce',
    icon: 'file:messageDebounce.svg',
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["sessionId"]}}',
    description:
        'Groups messages from the same session within a silence window and emits a single consolidated output. Silently stops when a newer message has already arrived.',
    defaults: {
        name: 'Message Debounce',
    },
    inputs: ['main'],
    outputs: ['main'],
    credentials: [
        {
            name: 'redisApi',
            required: true,
            testedBy: 'redisConnectionTest',
        },
    ],
    properties: [
        // -----------------------------------------------------------------------
        // Required fields
        // -----------------------------------------------------------------------
        {
            displayName: 'Session ID',
            name: 'sessionId',
            type: 'string',
            default: '',
            placeholder: 'e.g. {{ $json.chatId }}',
            description:
                'Unique identifier for the conversation or session. All messages sharing the same Session ID are grouped together.',
            required: true,
        },
        {
            displayName: 'Message',
            name: 'message',
            type: 'string',
            default: '',
            placeholder: 'e.g. {{ $json.message }}',
            description: 'The content of the incoming message to buffer',
            required: true,
            typeOptions: {
                rows: 3,
            },
        },
        {
            displayName: 'Debounce Window (Seconds)',
            name: 'debounceWindow',
            type: 'number',
            typeOptions: {
                minValue: 1,
            },
            default: 10,
            placeholder: 'e.g. 10',
            description:
                'Seconds of silence to wait before flushing all buffered messages. The timer resets each time a new message arrives.',
            required: true,
        },

        // -----------------------------------------------------------------------
        // First Message — flat with dynamic sub-fields
        // -----------------------------------------------------------------------
        {
            displayName: 'First Message Behavior',
            name: 'firstMessageBehavior',
            type: 'options',
            default: 'none',
            description:
                'Special handling for the very first message of a new or expired session',
            options: [
                {
                    name: 'None',
                    value: 'none',
                    description: 'Treat the first message like any other (default)',
                },
                {
                    name: 'Flush Immediately',
                    value: 'immediate',
                    description: 'Emit the first message right away without waiting',
                },
                {
                    name: 'Use Custom Window',
                    value: 'customWindow',
                    description: 'Apply a shorter or longer silence window for the first message only',
                },
            ],
        },
        {
            displayName: 'First Message Custom Window (Seconds)',
            name: 'firstMessageCustomWindow',
            type: 'number',
            typeOptions: { minValue: 1 },
            default: 3,
            placeholder: 'e.g. 3',
            description: 'Silence window in seconds applied to the first message of a new session',
            displayOptions: {
                show: {
                    firstMessageBehavior: ['customWindow'],
                },
            },
        },
        {
            displayName: 'Session TTL',
            name: 'sessionTtlUnit',
            type: 'options',
            default: 'hours',
            description:
                'How long a session stays alive in Redis after the last message. When it expires, the next message is treated as the first. TTL is renewed on every new message (inactivity timer).',
            displayOptions: {
                show: {
                    firstMessageBehavior: ['immediate', 'customWindow'],
                },
            },
            options: [
                {
                    name: 'Minutes',
                    value: 'minutes',
                },
                {
                    name: 'Hours',
                    value: 'hours',
                },
                {
                    name: 'Days',
                    value: 'days',
                },
            ],
        },
        {
            displayName: 'Session TTL Value',
            name: 'sessionTtlValue',
            type: 'number',
            typeOptions: { minValue: 1 },
            default: 45,
            placeholder: 'e.g. 45',
            description: 'Amount of time before the session expires (resets on each new message)',
            displayOptions: {
                show: {
                    firstMessageBehavior: ['immediate', 'customWindow'],
                    sessionTtlUnit: ['minutes'],
                },
            },
        },
        {
            displayName: 'Session TTL Value',
            name: 'sessionTtlValue',
            type: 'number',
            typeOptions: { minValue: 1 },
            default: 24,
            placeholder: 'e.g. 24',
            description: 'Amount of time before the session expires (resets on each new message)',
            displayOptions: {
                show: {
                    firstMessageBehavior: ['immediate', 'customWindow'],
                    sessionTtlUnit: ['hours'],
                },
            },
        },
        {
            displayName: 'Session TTL Value',
            name: 'sessionTtlValue',
            type: 'number',
            typeOptions: { minValue: 1 },
            default: 7,
            placeholder: 'e.g. 7',
            description: 'Amount of time before the session expires (resets on each new message)',
            displayOptions: {
                show: {
                    firstMessageBehavior: ['immediate', 'customWindow'],
                    sessionTtlUnit: ['days'],
                },
            },
        },

        // -----------------------------------------------------------------------
        // Options collection — extra settings grouped together
        // -----------------------------------------------------------------------
        {
            displayName: 'Options',
            name: 'options',
            type: 'collection',
            placeholder: 'Add Option',
            default: {},
            options: [
                {
                    displayName: 'Flush Keywords',
                    name: 'flushKeywords',
                    type: 'string',
                    default: '',
                    placeholder: 'e.g. urgent;done;stop',
                    description:
                        'Semicolon-separated words that trigger an immediate flush when detected anywhere in the incoming message (case-insensitive). Example: urgent;stop;done.',
                },
                {
                    displayName: 'Max Messages',
                    name: 'maxMessages',
                    type: 'number',
                    typeOptions: { minValue: 0 },
                    default: 0,
                    placeholder: 'e.g. 10',
                    description:
                        'Force flush after this many messages are buffered, regardless of the silence timer. Set to 0 to disable (no limit).',
                },
                {
                    displayName: 'Max Wait Time (Seconds)',
                    name: 'maxWaitTime',
                    type: 'number',
                    typeOptions: { minValue: 0 },
                    default: 0,
                    placeholder: 'e.g. 60',
                    description:
                        'Maximum total seconds before forcing a flush, even if messages keep arriving. Set to 0 to disable (no limit).',
                },
                {
                    displayName: 'On Duplicate Message',
                    name: 'onDuplicateMessage',
                    type: 'options',
                    default: 'include',
                    description: 'What to do when the incoming message is identical to the last buffered one',
                    options: [
                        {
                            name: 'Include',
                            value: 'include',
                            description: 'Buffer the duplicate message normally (default)',
                        },
                        {
                            name: 'Ignore',
                            value: 'ignore',
                            description: 'Silently discard the duplicate — no output emitted',
                        },
                        {
                            name: 'Flush',
                            value: 'flush',
                            description: 'Treat the duplicate as a flush signal and emit immediately',
                        },
                    ],
                },
                {
                    displayName: 'Separator',
                    name: 'separator',
                    type: 'string',
                    default: '\\n',
                    description:
                        'String used to join buffered messages. Use \\n for newline (default), \\t for tab, or any custom string.',
                },
            ],
        },
    ],
};
