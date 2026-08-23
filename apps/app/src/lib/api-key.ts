import { db } from '@db/server';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { pbkdf2Sync, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Generate a new API key
 * @returns A new API key with prefix
 */
export function generateApiKey(): string {
  const apiKey = randomBytes(32).toString('hex');
  return `comp_${apiKey}`;
}

/** Extract the first 8 chars after the `comp_` prefix for indexed lookup */
export function extractKeyPrefix(apiKey: string): string {
  return apiKey.slice(5, 13);
}

/**
 * Generate a random salt for API key hashing
 * @returns A random salt string
 */
export function generateSalt(): string {
  return randomBytes(16).toString('hex');
}

const PBKDF2_ITERATIONS = 100_000;
const CURRENT_HASH_PREFIX = 'pbkdf2';
const KEY_LEN = 32;

/**
 * Hash an API key for storage. PBKDF2-SHA256 with a required salt, stored as
 * a versioned string (`pbkdf2$<iterations>$<hex>`).
 */
export function hashApiKey(apiKey: string, salt: string): string {
  const derived = pbkdf2Sync(apiKey, salt, PBKDF2_ITERATIONS, KEY_LEN, 'sha256');
  return `${CURRENT_HASH_PREFIX}$${PBKDF2_ITERATIONS}$${derived.toString('hex')}`;
}

/** Constant-time hex comparison (length-mismatch safe). */
function safeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'hex');
  const bufB = Buffer.from(b, 'hex');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Verify a presented API key against a stored PBKDF2 hash. Any other stored
 * format fails closed.
 */
function matchesStoredKey(
  presentedKey: string,
  storedHash: string,
  salt: string | null,
): boolean {
  if (!storedHash.startsWith(`${CURRENT_HASH_PREFIX}$`)) return false;
  try {
    const [, iterationsRaw, digest] = storedHash.split('$');
    const iterations = Number(iterationsRaw);
    if (!Number.isInteger(iterations) || iterations <= 0 || !digest) {
      return false;
    }
    const derived = pbkdf2Sync(presentedKey, salt ?? '', iterations, KEY_LEN, 'sha256');
    return safeEqualHex(derived.toString('hex'), digest);
  } catch {
    return false;
  }
}

/**
 * Validate an API key from the request headers
 * @param req The Next.js request object
 * @returns The organization ID if the API key is valid, null otherwise
 */
export async function validateApiKey(req: NextRequest): Promise<string | null> {
  // Get the API key from the Authorization header
  const authHeader = req.headers.get('Authorization');

  if (!authHeader) {
    return null;
  }

  // Check if it's a Bearer token
  if (authHeader.startsWith('Bearer ')) {
    const apiKey = authHeader.substring(7);
    return await validateApiKeyValue(apiKey);
  }

  // Check if it's an X-API-Key header
  const apiKey = req.headers.get('X-API-Key');
  if (apiKey) {
    return await validateApiKeyValue(apiKey);
  }

  return null;
}

/**
 * Validate an API key value
 * @param apiKey The API key to validate
 * @returns The organization ID if the API key is valid, null otherwise
 */
async function validateApiKeyValue(apiKey: string): Promise<string | null> {
  if (!apiKey) {
    return null;
  }

  try {
    // Check if the model exists in the Prisma client
    if (typeof db.apiKey === 'undefined') {
      console.error('ApiKey model not found. Make sure to run migrations.');
      return null;
    }

    // Indexed lookup via the key prefix embedded in every modern key.
    const keyPrefix = apiKey.startsWith('comp_') ? extractKeyPrefix(apiKey) : null;

    const apiKeyRecords = await db.apiKey.findMany({
      where: {
        isActive: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
        ...(keyPrefix ? { keyPrefix } : {}),
      },
      select: {
        id: true,
        key: true,
        salt: true,
        organizationId: true,
        expiresAt: true,
      },
    });

    const matchingRecord = apiKeyRecords.find((record) =>
      matchesStoredKey(apiKey, record.key, record.salt),
    );

    if (!matchingRecord) {
      return null;
    }

    await db.apiKey.update({
      where: { id: matchingRecord.id },
      data: { lastUsedAt: new Date() },
    });

    return matchingRecord.organizationId;
  } catch (error) {
    console.error('Error validating API key:', error);
    return null;
  }
}

/**
 * Middleware to validate API keys for API routes
 * @param req The Next.js request object
 * @returns A response if the API key is invalid, or the organization ID if valid
 */
export async function apiKeyMiddleware(req: NextRequest): Promise<NextResponse | string> {
  const organizationId = await validateApiKey(req);

  if (!organizationId) {
    return NextResponse.json({ error: 'Invalid or missing API key' }, { status: 401 });
  }

  return organizationId;
}

/**
 * Get the organization ID from the API key in the request
 * This is a helper function that handles the result of apiKeyMiddleware
 * @param req The Next.js request object
 * @returns An object with the organization ID and/or error response
 */
export async function getOrganizationFromApiKey(req: NextRequest): Promise<{
  organizationId?: string;
  errorResponse?: NextResponse;
}> {
  const result = await apiKeyMiddleware(req);

  if (result instanceof NextResponse) {
    return { errorResponse: result };
  }

  return { organizationId: result };
}
