import { redisClient, type ApiRedisClient } from './redis.client';

// Shared namespace for every key owned by the application cache. The Redis
// ACL role `comp_app` is restricted to `~app:*` (see infra/redis/redis.conf),
// so any key outside this namespace is unreachable to the app role — this is
// the keyspace analog of the Postgres `tenant_isolation` RLS policies.
export const APP_KEY_NAMESPACE = 'app';

/**
 * Tenant-scoped surface of the shared Redis client — the RLS analog for Redis.
 *
 * The Postgres RLS migration scopes every row by the `app.tenant_id` GUC and
 * fails closed when no tenant is set. Redis has no row model, so the equivalent
 * is a per-tenant key prefix: every key written through this interface lives
 * under `app:{organizationId}:`, and the interface refuses to operate at all
 * outside a `withTenantRedis` scope.
 *
 * Only a reduced command surface (get/set/del/getdel) is exposed on purpose —
 * tenant data never needs scripts, scans or bulk operations, so they cannot be
 * misused to enumerate or purge other tenants' keys.
 */
export interface TenantRedis {
  get<T = unknown>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, options?: { ex?: number }): Promise<'OK'>;
  del(...keys: string[]): Promise<number>;
  getdel<T = unknown>(key: string): Promise<T | null>;
}

class ScopedTenantRedis implements TenantRedis {
  private closed = false;

  constructor(
    private readonly delegate: ApiRedisClient,
    private readonly tenantKeyPrefix: string,
  ) {}

  private key(key: string): string {
    if (this.closed) {
      throw new Error(
        'Tenant Redis scope is closed — keys must only be used inside the withTenantRedis callback',
      );
    }
    return `${this.tenantKeyPrefix}${key}`;
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    return this.delegate.get<T>(this.key(key));
  }

  async set<T>(key: string, value: T, options?: { ex?: number }): Promise<'OK'> {
    return this.delegate.set(this.key(key), value, options);
  }

  async del(...keys: string[]): Promise<number> {
    return this.delegate.del(...keys.map((key) => this.key(key)));
  }

  async getdel<T = unknown>(key: string): Promise<T | null> {
    return this.delegate.getdel<T>(this.key(key));
  }

  close(): void {
    this.closed = true;
  }
}

/**
 * Run `fn` with a Redis client scoped to `organizationId`.
 *
 * Every key is namespaced as `app:{organizationId}:{key}` and the scope fails
 * closed: an empty/missing tenant throws immediately, and any attempt to touch
 * the scoped client after the callback settles also throws. This mirrors
 * `withTenant` in `@gideon-defender/db` — a tenant context is required, never
 * optional.
 */
export async function withTenantRedis<T>(
  organizationId: string,
  fn: (redis: TenantRedis) => Promise<T>,
): Promise<T> {
  if (!organizationId) {
    throw new Error('withTenantRedis requires an organizationId');
  }
  const scoped = new ScopedTenantRedis(
    redisClient,
    `${APP_KEY_NAMESPACE}:${organizationId}:`,
  );
  try {
    return await fn(scoped);
  } finally {
    scoped.close();
  }
}
