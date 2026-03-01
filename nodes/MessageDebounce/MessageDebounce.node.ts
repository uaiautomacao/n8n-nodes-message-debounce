/**
 * MessageDebounce n8n community node — entry point.
 */

import {
    NodeOperationError,
    type IExecuteFunctions,
    type INodeExecutionData,
    type INodeType,
    type IDataObject,
    type ICredentialTestFunctions,
    type ICredentialsDecrypted,
    type INodeCredentialTestResult,
} from 'n8n-workflow';

import { description } from './MessageDebounce.description';
import { runDebounce } from './execute';
import type { ResolvedOptions } from './types';
import { RedisClient } from './utils/RedisClient';
import type { RedisCredentials } from './utils/RedisClient';

// eslint-disable-next-line @n8n/community-nodes/icon-validation
export class MessageDebounce implements INodeType {
    description = description;

    icon = 'file:messageDebounce.svg' as const;

    methods = {
        credentialTest: {
            async redisConnectionTest(
                this: ICredentialTestFunctions,
                credential: ICredentialsDecrypted,
            ): Promise<INodeCredentialTestResult> {
                const redis = new RedisClient(credential.data as unknown as RedisCredentials);
                try {
                    await redis.connect();
                    redis.disconnect();
                    return { status: 'OK', message: 'Connection successful' };
                } catch (err) {
                    return {
                        status: 'Error',
                        message: err instanceof Error ? err.message : String(err),
                    };
                }
            },
        },
    };

    async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
        const itemIndex = 0;

        // ------------------------------------------------------------------
        // 1. Required fields
        // ------------------------------------------------------------------
        const sessionId = (this.getNodeParameter('sessionId', itemIndex, '') as string).trim();
        const message = this.getNodeParameter('message', itemIndex, '') as string;
        const debounceWindowRaw = this.getNodeParameter('debounceWindow', itemIndex, null);

        if (!sessionId) {
            throw new NodeOperationError(this.getNode(), 'Session ID is required', { itemIndex });
        }
        if (!message && message !== '0') {
            throw new NodeOperationError(this.getNode(), 'Message is required', { itemIndex });
        }
        if (debounceWindowRaw === null || debounceWindowRaw === '' || debounceWindowRaw === undefined) {
            throw new NodeOperationError(this.getNode(), 'Debounce Window is required', { itemIndex });
        }
        const debounceWindowSec = Number(debounceWindowRaw);
        if (isNaN(debounceWindowSec) || debounceWindowSec < 1) {
            throw new NodeOperationError(
                this.getNode(),
                'Debounce Window must be a positive number (minimum 1 second)',
                { itemIndex },
            );
        }

        // ------------------------------------------------------------------
        // 2. Resolve options
        //    - First Message fields: top-level flat parameters
        //    - Everything else: from the Options collection
        // ------------------------------------------------------------------
        const raw = this.getNodeParameter('options', itemIndex, {}) as IDataObject;
        const sepRaw = (raw.separator as string | undefined) ?? '\\n';

        const opts: ResolvedOptions = {
            // From collection
            maxMessages: Number(raw.maxMessages ?? 0),
            maxWaitTimeSec: Number(raw.maxWaitTime ?? 0),
            separator: sepRaw.replace(/\\n/g, '\n').replace(/\\t/g, '\t'),
            onDuplicate: (raw.onDuplicateMessage as string) ?? 'include',
            flushKeywords: ((raw.flushKeywords as string | undefined) ?? '')
                .split(';')
                .map((k) => k.trim().toLowerCase())
                .filter(Boolean),
            // From flat top-level fields
            firstMsgBehavior: this.getNodeParameter('firstMessageBehavior', itemIndex, 'none') as string,
            firstMsgCustomWindow: Number(this.getNodeParameter('firstMessageCustomWindow', itemIndex, 3)),
            sessionTtlUnit: this.getNodeParameter('sessionTtlUnit', itemIndex, 'never') as string,
            sessionTtlValue: Number(this.getNodeParameter('sessionTtlValue', itemIndex, 24)),
        };

        // ------------------------------------------------------------------
        // 3. Connect to Redis
        // ------------------------------------------------------------------
        let credentials: RedisCredentials;
        try {
            credentials = (await this.getCredentials('redisApi')) as unknown as RedisCredentials;
        } catch (err) {
            throw new NodeOperationError(
                this.getNode(),
                `Redis credentials error: ${err instanceof Error ? err.message : String(err)}`,
                { itemIndex },
            );
        }

        const redis = new RedisClient(credentials);
        try {
            await redis.connect();
        } catch (err) {
            throw new NodeOperationError(
                this.getNode(),
                `Redis connection failed: ${err instanceof Error ? err.message : String(err)}`,
                { itemIndex },
            );
        }

        // ------------------------------------------------------------------
        // 4. Run debounce logic
        // ------------------------------------------------------------------
        try {
            return await runDebounce(redis, sessionId, message, debounceWindowSec, opts, itemIndex);
        } finally {
            redis.disconnect();
        }
    }
}
