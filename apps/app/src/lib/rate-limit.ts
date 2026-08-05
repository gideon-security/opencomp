import { client, createRateLimiter } from '@gideon-defender/kv';
import type { NextRequest } from 'next/server';

const limiter = createRateLimiter({
  client,
  limit: 20,
  windowSeconds: 10,
  prefix: 'ratelimit:api',
});

export async function rateLimit(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') ?? '127.0.0.1';
  const { success } = await limiter.limit(ip);

  return { success };
}
