/**
 * Redis API credential for the MessageDebounce node.
 */
import type {
    ICredentialType,
    INodeProperties,
} from 'n8n-workflow';

// eslint-disable-next-line @n8n/community-nodes/credential-test-required
export class RedisApi implements ICredentialType {
    name = 'redisApi';

    displayName = 'Redis API';

    icon = 'file:redisApi.svg' as const;
    documentationUrl = 'https://www.npmjs.com/package/n8n-nodes-message-debounce';

    properties: INodeProperties[] = [
        {
            displayName: 'Host',
            name: 'host',
            type: 'string',
            default: 'localhost',
            description: 'Redis server hostname or IP address',
        },
        {
            displayName: 'Port',
            name: 'port',
            type: 'number',
            default: 6379,
            description: 'Redis server port (default: 6379)',
        },
        {
            displayName: 'Password',
            name: 'password',
            type: 'string',
            typeOptions: {
                password: true,
            },
            default: '',
            description: 'The Redis password (leave empty if none)',
        },
        {
            displayName: 'Username',
            name: 'username',
            type: 'string',
            default: '',
            description: 'Leave blank for password-only auth (Redis 6+ ACL)',
        },
        {
            displayName: 'Database Index',
            name: 'database',
            type: 'number',
            default: 0,
            description: 'Redis logical database index (0–15)',
        },
        {
            displayName: 'SSL/TLS',
            name: 'tls',
            type: 'boolean',
            default: false,
            description: 'Whether to use TLS/SSL for the Redis connection',
        },
    ];
}
