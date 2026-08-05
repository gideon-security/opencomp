import { withTenantRedis, APP_KEY_NAMESPACE, type TenantRedis } from './tenant-redis.client';
import { redisClient } from './redis.client';

describe('withTenantRedis', () => {
  const orgId = 'org_123';
  let getSpy: jest.SpyInstance;
  let setSpy: jest.SpyInstance;
  let delSpy: jest.SpyInstance;
  let getdelSpy: jest.SpyInstance;

  beforeEach(() => {
    getSpy = jest.spyOn(redisClient, 'get').mockResolvedValue(null);
    setSpy = jest.spyOn(redisClient, 'set').mockResolvedValue('OK');
    delSpy = jest.spyOn(redisClient, 'del').mockResolvedValue(1);
    getdelSpy = jest.spyOn(redisClient, 'getdel').mockResolvedValue(null);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('namespaces every key under app:{orgId}:', async () => {
    await withTenantRedis(orgId, async (redis) => {
      await redis.get('assistant-chat:v1:usr_1');
      await redis.set('k2', { hello: true }, { ex: 60 });
      await redis.del('k3', 'k4');
      await redis.getdel('k5');
    });

    expect(getSpy).toHaveBeenCalledWith(`${APP_KEY_NAMESPACE}:${orgId}:assistant-chat:v1:usr_1`);
    expect(setSpy).toHaveBeenCalledWith(
      `${APP_KEY_NAMESPACE}:${orgId}:k2`,
      { hello: true },
      { ex: 60 },
    );
    expect(delSpy).toHaveBeenCalledWith(
      `${APP_KEY_NAMESPACE}:${orgId}:k3`,
      `${APP_KEY_NAMESPACE}:${orgId}:k4`,
    );
    expect(getdelSpy).toHaveBeenCalledWith(`${APP_KEY_NAMESPACE}:${orgId}:k5`);
  });

  it('returns the callback result', async () => {
    const result = await withTenantRedis(orgId, async (redis) => {
      await redis.set('k', 'v');
      return 'done';
    });
    expect(result).toBe('done');
  });

  it('throws when no organizationId is provided (fails closed)', async () => {
    await expect(withTenantRedis('', async () => undefined)).rejects.toThrow(
      'requires an organizationId',
    );

    await expect(
      withTenantRedis(undefined as unknown as string, async () => undefined),
    ).rejects.toThrow('requires an organizationId');
  });

  it('prevents key access after the scope closes (fails closed)', async () => {
    let escapedRedis: TenantRedis | null = null;
    await withTenantRedis(orgId, async (redis) => {
      escapedRedis = redis;
    });

    await expect(escapedRedis!.get('k')).rejects.toThrow('scope is closed');
  });

  it('isolates org A from org B keyspaces', async () => {
    await withTenantRedis('org_a', async (redis) => {
      await redis.set('k', 'a');
    });
    await withTenantRedis('org_b', async (redis) => {
      await redis.set('k', 'b');
    });

    expect(setSpy).toHaveBeenCalledWith(`${APP_KEY_NAMESPACE}:org_a:k`, 'a', undefined);
    expect(setSpy).toHaveBeenCalledWith(`${APP_KEY_NAMESPACE}:org_b:k`, 'b', undefined);
  });
});
