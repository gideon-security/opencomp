import type { Request, Response, NextFunction } from 'express';
import { createRateLimiter } from '@gideon-defender/kv/rate-limit';
import { redisClient } from '../redis/redis.client';

const MAX_REQUESTS = 10;
const WINDOW_SECONDS = 60;

const ratelimit = createRateLimiter({
  client: redisClient,
  limit: MAX_REQUESTS,
  windowSeconds: WINDOW_SECONDS,
  prefix: 'app:ratelimit:admin-auth',
  algorithm: 'sliding',
});

/**
 * Express middleware that rate-limits requests to /api/auth/admin/*.
 *
 * better-auth admin routes (impersonation, set-role, ban, etc.) are handled
 * by better-auth's own request handler and never reach NestJS controllers,
 * so the global ThrottlerGuard does not apply to them. This middleware fills
 * that gap with a per-IP sliding window (10 req/min) backed by the shared
 * Redis client so limits are shared across all ECS instances.
 */
export async function adminAuthRateLimiter(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (!req.path.startsWith('/api/auth/admin')) {
    return next();
  }

  const ip = req.ip || req.socket.remoteAddress || 'unknown';

  try {
    const { success } = await ratelimit.limit(ip);

    if (!success) {
      res.status(429).json({
        error: 'Too many requests to admin endpoints. Try again later.',
      });
      return;
    }
  } catch {
    // If Redis is unreachable, allow the request through rather than
    // blocking all admin operations. The WAF still provides baseline protection.
  }

  return next();
}
