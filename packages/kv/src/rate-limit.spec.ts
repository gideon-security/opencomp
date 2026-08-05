import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRateLimiter, type RateLimitBackend } from './rate-limit';

class FakeRedisBackend implements RateLimitBackend {
  backend = 'redis';

  private counters = new Map<string, { count: number; expireAt: number }>();
  private zsets = new Map<string, Map<string, number>>();
  private timestamps: Array<{ key: string; args: Array<string | number> }> = [];

  get calls() {
    return this.timestamps;
  }

  async eval(script: string, keys: string[], args: Array<string | number>) {
    const key = keys[0]!;
    const limit = Number(args[0]!);
    const windowMs = Number(args[1]!);
    const now = Number(args[2]!);
    this.timestamps.push({ key, args });

    if (script.includes('ZADD')) {
      const member = String(args[3]!);
      const zset = this.zsets.get(key) ?? new Map();
      for (const [member, score] of zset) {
        if (score <= now - windowMs) zset.delete(member);
      }
      if (zset.size >= limit) {
        const oldest = [...zset.entries()].sort((a, b) => a[1] - b[1])[0]!;
        this.zsets.set(key, zset);
        return [0, zset.size, limit, Math.floor(oldest[1] / 1000) + Math.floor(windowMs / 1000)];
      }
      zset.set(member, now);
      this.zsets.set(key, zset);
      return [1, zset.size, limit, Math.floor(now / 1000) + Math.floor(windowMs / 1000)];
    }

    const existing = this.counters.get(key);
    const resetMs = Math.floor(now / windowMs) * windowMs + windowMs;
    if (!existing || existing.expireAt <= now) {
      this.counters.set(key, { count: 1, expireAt: resetMs });
      return 1 > limit ? [0, 1, limit, Math.floor(resetMs / 1000)] : [1, 1, limit, Math.floor(resetMs / 1000)];
    }
    existing.count += 1;
    return existing.count > limit
      ? [0, existing.count, limit, Math.floor(resetMs / 1000)]
      : [1, existing.count, limit, Math.floor(resetMs / 1000)];
  }
}

function noOpClient(): RateLimitBackend {
  return {
    backend: 'memory',
    async eval() {
      return [];
    },
  };
}

describe('createRateLimiter', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('uses a no-op limiter when the backend is not redis', async () => {
    const limiter = createRateLimiter({
      client: noOpClient(),
      limit: 5,
      windowSeconds: 60,
    });

    const first = await limiter.limit('user-1');
    const second = await limiter.limit('user-1');

    expect(first.success).toBe(true);
    expect(first.limit).toBe(5);
    expect(first.remaining).toBe(5);
    expect(second.success).toBe(true);
  });

  it('allows requests within the fixed window and rejects once the limit is hit', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));

    const client = new FakeRedisBackend();
    const limiter = createRateLimiter({
      client,
      limit: 3,
      windowSeconds: 60,
      prefix: 'ratelimit:test',
      algorithm: 'fixed',
    });

    const first = await limiter.limit('user-1');
    const second = await limiter.limit('user-1');
    const third = await limiter.limit('user-1');
    const rejected = await limiter.limit('user-1');

    expect(first).toMatchObject({ success: true, limit: 3, remaining: 2 });
    expect(second.remaining).toBe(1);
    expect(third.remaining).toBe(0);
    expect(rejected.success).toBe(false);
  });

  it('rejects once a sliding window fills up', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));

    const client = new FakeRedisBackend();
    const limiter = createRateLimiter({
      client,
      limit: 2,
      windowSeconds: 60,
      prefix: 'ratelimit:test',
      algorithm: 'sliding',
    });

    expect((await limiter.limit('user-1')).success).toBe(true);
    expect((await limiter.limit('user-1')).success).toBe(true);
    const rejected = await limiter.limit('user-1');
    expect(rejected.success).toBe(false);
    expect(rejected.reset).toBeGreaterThan(0);
  });

  it('frees the sliding window once entries age out of it', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));

    const client = new FakeRedisBackend();
    const limiter = createRateLimiter({
      client,
      limit: 1,
      windowSeconds: 60,
      prefix: 'ratelimit:test',
      algorithm: 'sliding',
    });

    expect((await limiter.limit('user-1')).success).toBe(true);
    expect((await limiter.limit('user-1')).success).toBe(false);

    vi.setSystemTime(new Date('2026-01-01T00:01:30Z'));
    expect((await limiter.limit('user-1')).success).toBe(true);
  });

  it('tracks identifiers independently', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));

    const client = new FakeRedisBackend();
    const limiter = createRateLimiter({
      client,
      limit: 1,
      windowSeconds: 60,
      prefix: 'ratelimit:test',
      algorithm: 'fixed',
    });

    expect((await limiter.limit('ip-1')).success).toBe(true);
    expect((await limiter.limit('ip-1')).success).toBe(false);
    expect((await limiter.limit('ip-2')).success).toBe(true);
  });

  it('passes the prefixed key and window args to the backend', async () => {
    const client = new FakeRedisBackend();
    const limiter = createRateLimiter({
      client,
      limit: 10,
      windowSeconds: 30,
      prefix: 'ratelimit:admin-auth',
    });

    await limiter.limit('203.0.113.7');

    expect(client.calls).toHaveLength(1);
    const call = client.calls[0]!;
    expect(call.key).toBe('ratelimit:admin-auth:203.0.113.7');
    expect(Number(call.args[0])).toBe(10);
    expect(Number(call.args[1])).toBe(30 * 1000);
    expect(Number(call.args[2])).toBeGreaterThan(0);
    expect(String(call.args[3])).toBeTruthy();
  });
});
