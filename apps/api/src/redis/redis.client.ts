import { Redis } from 'ioredis';

export type ApiRedisBackend = 'redis' | 'memory';

export interface ApiRedisClient {
  backend: ApiRedisBackend;
  get<T = unknown>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, options?: { ex?: number }): Promise<'OK'>;
  del(...keys: string[]): Promise<number>;
  getdel<T = unknown>(key: string): Promise<T | null>;
  eval(script: string, keys: string[], args: Array<string | number>): Promise<unknown>;
}

// In-memory fallback for local development / tests without a REDIS_URL. Uses
// the same JSON semantics as the ioredis-backed client so callers can store
// plain objects.
class InMemoryRedis implements ApiRedisClient {
  readonly backend: ApiRedisBackend = 'memory';

  private storage = new Map<string, { value: unknown; expiresAt?: number }>();

  private purge(key: string) {
    const record = this.storage.get(key);
    if (record?.expiresAt && record.expiresAt <= Date.now()) {
      this.storage.delete(key);
    }
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    this.purge(key);
    const record = this.storage.get(key);
    if (!record) return null;
    return record.value as T;
  }

  async set<T>(key: string, value: T, options?: { ex?: number }): Promise<'OK'> {
    const expiresAt = options?.ex ? Date.now() + options.ex * 1000 : undefined;
    this.storage.set(key, { value, expiresAt });
    return 'OK';
  }

  async del(...keys: string[]): Promise<number> {
    let removed = 0;
    for (const key of keys) {
      if (this.storage.delete(key)) removed += 1;
    }
    return removed;
  }

  async getdel<T = unknown>(key: string): Promise<T | null> {
    this.purge(key);
    const record = this.storage.get(key);
    if (!record) return null;
    this.storage.delete(key);
    return record.value as T;
  }

  async eval(): Promise<unknown> {
    throw new Error('EVAL is not supported by the in-memory Redis backend');
  }
}

// ioredis-backed client for a real Redis server (LocalStack Redis, ElastiCache,
// etc.). Values are serialized to JSON on set and parsed on get so callers can
// store plain objects.
class IoredisRedis implements ApiRedisClient {
  readonly backend: ApiRedisBackend = 'redis';

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

  async getdel<T = unknown>(key: string): Promise<T | null> {
    const value = await this.client.getdel(key);
    return this.deserialize(value) as T | null;
  }

  async eval(script: string, keys: string[], args: Array<string | number>): Promise<unknown> {
    return this.client.eval(script, keys.length, ...keys, ...args.map(String));
  }
}

const redisUrl = process.env.REDIS_URL;

export const redisClient: ApiRedisClient = redisUrl
  ? new IoredisRedis(redisUrl)
  : new InMemoryRedis();
