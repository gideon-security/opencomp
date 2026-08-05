import { randomUUID } from 'crypto';

/**
 * Minimal client surface the rate limiter needs. `eval` must run a Lua script
 * against a real Redis server (via EVAL). The `backend` discriminator lets the
 * limiter fall back to a no-op when Redis isn't available (mirrors the previous
 * behavior where rate limiting was skipped without Upstash configured).
 */
export interface RateLimitBackend {
  backend: string;
  eval(script: string, keys: string[], args: Array<string | number>): Promise<unknown>;
}

export type RateLimitAlgorithm = 'fixed' | 'sliding';

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

export interface RateLimiter {
  limit(identifier: string): Promise<RateLimitResult>;
}

export interface CreateRateLimiterOptions {
  limit: number;
  windowSeconds: number;
  prefix?: string;
  algorithm?: RateLimitAlgorithm;
  client: RateLimitBackend;
}

const FIXED_WINDOW_SCRIPT = `
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local windowMs = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local reset = math.floor(now / windowMs) * windowMs + windowMs
local count = redis.call('INCR', key)
if count == 1 then
  redis.call('PEXPIREAT', key, reset)
end
if count > limit then
  return { 0, count, limit, math.floor(reset / 1000) }
end
return { 1, count, limit, math.floor(reset / 1000) }
`;

const SLIDING_WINDOW_SCRIPT = `
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local windowMs = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local member = ARGV[4]
redis.call('ZREMRANGEBYSCORE', key, '-inf', now - windowMs)
local count = redis.call('ZCARD', key)
if count >= limit then
  local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  local reset = math.floor(tonumber(oldest[2]) / 1000) + math.floor(windowMs / 1000)
  return { 0, count, limit, reset }
end
redis.call('ZADD', key, now, member)
redis.call('PEXPIRE', key, windowMs)
return { 1, count + 1, limit, math.floor(now / 1000) + math.floor(windowMs / 1000) }
`;

function toNumbers(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => Number(entry));
}

function noOpLimiter(options: CreateRateLimiterOptions): RateLimiter {
  return {
    async limit() {
      return {
        success: true,
        limit: options.limit,
        remaining: options.limit,
        reset: Math.floor(Date.now() / 1000) + options.windowSeconds,
      };
    },
  };
}

function luaLimiter(options: CreateRateLimiterOptions): RateLimiter {
  const script =
    options.algorithm === 'sliding' ? SLIDING_WINDOW_SCRIPT : FIXED_WINDOW_SCRIPT;
  const keyPrefix = options.prefix ?? 'app:ratelimit';

  return {
    async limit(identifier: string) {
      const result = toNumbers(
        await options.client.eval(
          script,
          [`${keyPrefix}:${identifier}`],
          [options.limit, options.windowSeconds * 1000, Date.now(), randomUUID()],
        ),
      );
      const [rawAllowed, rawCount, rawLimit, rawReset] = result;
      const limitValue = rawLimit && rawLimit > 0 ? rawLimit : options.limit;
      const current = rawCount && rawCount > 0 ? rawCount : 0;
      return {
        success: rawAllowed === 1,
        limit: limitValue,
        remaining: Math.max(0, limitValue - current),
        reset: rawReset && rawReset > 0 ? rawReset : Math.floor(Date.now() / 1000) + options.windowSeconds,
      };
    },
  };
}

export function createRateLimiter(options: CreateRateLimiterOptions): RateLimiter {
  if (options.client.backend === 'redis') {
    return luaLimiter(options);
  }
  return noOpLimiter(options);
}
