/**
 * Lua script for atomic compare-and-flush in Redis.
 *
 * KEYS[1] = messages list key  (debounce:{sessionId}:msgs)
 * KEYS[2] = startTime key      (debounce:{sessionId}:startTime)
 * ARGV[1] = beforeId           (UUID of the message pushed by this execution)
 *
 * Returns: array of raw JSON message entries if this execution wins the race,
 *          or nil if another message arrived after this one (we are not the last).
 *
 * The script is atomic — executed by a single Redis server command, so no
 * race conditions can occur between the LINDEX check and the LRANGE+DEL.
 */
export const FLUSH_SCRIPT = `
local key  = KEYS[1]
local tkey = KEYS[2]
local bid  = ARGV[1]

local last = redis.call('LINDEX', key, -1)
if not last then return nil end

local ok, entry = pcall(cjson.decode, last)
if not ok then return nil end
if entry.id ~= bid then return nil end

local all = redis.call('LRANGE', key, 0, -1)
redis.call('DEL', key)
redis.call('DEL', tkey)
return all
`;

/** Session TTL multipliers: converts a user-facing unit to seconds. */
export const TTL_MULTIPLIERS: Record<string, number> = {
    minutes: 60,
    hours: 3_600,
    days: 86_400,
};
