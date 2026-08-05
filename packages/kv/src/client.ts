import { Redis } from 'ioredis';

export type KvBackend = 'redis' | 'memory' | 'mock';

export interface KvClient {
  backend: KvBackend;
  get<T = unknown>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, options?: { ex?: number }): Promise<'OK'>;
  del(...keys: string[]): Promise<number>;
  exists(key: string): Promise<number>;
  keys(pattern: string): Promise<string[]>;
  expire(key: string, seconds: number): Promise<number>;
  getdel<T = unknown>(key: string): Promise<T | null>;
  eval(script: string, keys: string[], args: Array<string | number>): Promise<unknown>;
}

// Mock Redis client for E2E tests. Implements the same JSON semantics as the
// real clients so callers can store plain objects.
class MockRedis implements KvClient {
  readonly backend: KvBackend = 'mock';

  private storage = new Map<string, any>();

  async get<T = unknown>(key: string): Promise<T | null> {
    return (this.storage.get(key) as T | undefined) ?? null;
  }

  async set<T>(key: string, value: T, options?: { ex?: number }): Promise<'OK'> {
    this.storage.set(key, value);
    if (options?.ex) {
      setTimeout(() => {
        this.storage.delete(key);
      }, options.ex * 1000);
    }
    return 'OK';
  }

  async del(...keys: string[]): Promise<number> {
    let removed = 0;
    for (const key of keys) {
      if (this.storage.delete(key)) removed += 1;
    }
    return removed;
  }

  async exists(key: string): Promise<number> {
    return this.storage.has(key) ? 1 : 0;
  }

  async keys(pattern: string): Promise<string[]> {
    const keys = Array.from(this.storage.keys());
    if (pattern === '*') return keys;
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    return keys.filter((key) => regex.test(key));
  }

  async expire(key: string, seconds: number): Promise<number> {
    if (this.storage.has(key)) {
      setTimeout(() => {
        this.storage.delete(key);
      }, seconds * 1000);
      return 1;
    }
    return 0;
  }

  async getdel<T = unknown>(key: string): Promise<T | null> {
    const value = this.storage.get(key) as T | undefined;
    if (value !== undefined) {
      this.storage.delete(key);
      return value;
    }
    return null;
  }

  async eval(): Promise<unknown> {
    throw new Error('EVAL is not supported by the mock Redis backend');
  }
}

// In-memory Redis client for local development when no REDIS_URL is set.
// Mirrors the JSON semantics of the ioredis-backed client.
class InMemoryRedis implements KvClient {
  readonly backend: KvBackend = 'memory';

  private storage = new Map<string, { value: unknown; expiresAt?: number }>();

  private purge(key: string) {
    const record = this.storage.get(key);
    if (record?.expiresAt && record.expiresAt <= Date.now()) {
      this.storage.delete(key);
    }
  }

  private serialize(value: unknown): string {
    if (value === undefined) return 'undefined';
    return typeof value === 'string' ? value : JSON.stringify(value);
  }

  private deserialize(value: unknown): unknown {
    if (value === null || value === undefined) return null;
    if (typeof value !== 'string') return value;
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    this.purge(key);
    const record = this.storage.get(key);
    if (!record) return null;
    return this.deserialize(record.value) as T;
  }

  async set<T>(key: string, value: T, options?: { ex?: number }): Promise<'OK'> {
    const expiresAt = options?.ex ? Date.now() + options.ex * 1000 : undefined;
    this.storage.set(key, { value: this.serialize(value), expiresAt });
    return 'OK';
  }

  async del(...keys: string[]): Promise<number> {
    let removed = 0;
    for (const key of keys) {
      if (this.storage.delete(key)) removed += 1;
    }
    return removed;
  }

  async exists(key: string): Promise<number> {
    this.purge(key);
    return this.storage.has(key) ? 1 : 0;
  }

  async keys(pattern: string): Promise<string[]> {
    const keys = Array.from(this.storage.keys());
    if (pattern === '*') return keys;
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    return keys.filter((key) => regex.test(key));
  }

  async expire(key: string, seconds: number): Promise<number> {
    const record = this.storage.get(key);
    if (!record) return 0;
    record.expiresAt = Date.now() + seconds * 1000;
    return 1;
  }

  async getdel<T = unknown>(key: string): Promise<T | null> {
    this.purge(key);
    const record = this.storage.get(key);
    if (!record) return null;
    this.storage.delete(key);
    return this.deserialize(record.value) as T;
  }

  async eval(): Promise<unknown> {
    throw new Error('EVAL is not supported by the in-memory Redis backend');
  }
}

// ioredis-backed client for a real Redis server. Values are serialized to JSON
// on set and parsed on get, so callers can store plain objects. Uses REDIS_URL
// (RESP) so it works from any Next runtime (route handlers vs RSC pages run in
// separate module graphs — an in-memory mock can't share state across them).
class LocalRedisClient implements KvClient {
  readonly backend: KvBackend = 'redis';

  private client: Redis;

  constructor(url: string) {
    this.client = new Redis(url, {
      lazyConnect: true,
      maxRetriesPerRequest: null,
    });
    this.client.on('error', () => {
      // Connection failures shouldn't crash the process; commands will reject.
    });
  }

  private serialize(value: unknown): string {
    if (value === undefined) return 'undefined';
    return typeof value === 'string' ? value : JSON.stringify(value);
  }

  private deserialize(value: string | null): unknown {
    if (value === null) return null;
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    const value = await this.client.get(key);
    return this.deserialize(value) as T | null;
  }

  async set<T>(key: string, value: T, options?: { ex?: number }): Promise<'OK'> {
    if (options?.ex) {
      await this.client.set(key, this.serialize(value), 'EX', options.ex);
    } else {
      await this.client.set(key, this.serialize(value));
    }
    return 'OK';
  }

  async del(...keys: string[]): Promise<number> {
    return this.client.del(...keys);
  }

  async exists(key: string): Promise<number> {
    return this.client.exists(key);
  }

  async keys(pattern: string): Promise<string[]> {
    return this.client.keys(pattern);
  }

  async expire(key: string, seconds: number): Promise<number> {
    return this.client.expire(key, seconds);
  }

  async getdel<T = unknown>(key: string): Promise<T | null> {
    const value = await this.client.getdel(key);
    return this.deserialize(value) as T | null;
  }

  async eval(script: string, keys: string[], args: Array<string | number>): Promise<unknown> {
    return this.client.eval(script, keys.length, ...keys, ...args.map(String));
  }
}

const isE2ETest = process.env.E2E_TEST_MODE === 'true' && process.env.CI === 'true';
const isMockRequired = process.env.MOCK_REDIS === 'true';
const localRedisUrl = process.env.REDIS_URL;

export const client: KvClient = localRedisUrl
  ? new LocalRedisClient(localRedisUrl)
  : isE2ETest || isMockRequired
    ? new MockRedis()
    : new InMemoryRedis();
