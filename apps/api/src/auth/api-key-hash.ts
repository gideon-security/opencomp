import { pbkdf2Sync, timingSafeEqual } from 'node:crypto';

/**
 * API key hashing.
 *
 * API keys are 256-bit random tokens (`comp_` + 32 bytes), so unlike
 * human passwords they cannot be brute-forced offline regardless of hash
 * speed — but CodeQL js/insufficient-password-hash (and defense-in-depth
 * against a leaked-hash-only attack) wants a memory/iteration-hardened KDF.
 *
 * Stored hashes are versioned (`pbkdf2$<iterations>$<hex>`); any other
 * format fails verification — pre-PBKDF2 rows must be rotated to new keys.
 */

const CURRENT_PREFIX = 'pbkdf2';
export const PBKDF2_ITERATIONS = 100_000;
const KEY_LEN = 32;

/** Current scheme: PBKDF2-SHA256, stored as `pbkdf2$<iterations>$<hex>`. */
export function hashApiKeyCurrent(apiKey: string, salt: string): string {
  const derived = pbkdf2Sync(apiKey, salt, PBKDF2_ITERATIONS, KEY_LEN, 'sha256');
  return `${CURRENT_PREFIX}$${PBKDF2_ITERATIONS}$${derived.toString('hex')}`;
}

/** Constant-time hex-string comparison (length-mismatch safe). */
function safeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'hex');
  const bufB = Buffer.from(b, 'hex');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Verify a presented API key against a stored PBKDF2 hash. Hashes in any
 * other (legacy/insecure) format fail closed. Never throws.
 */
export function matchesStoredKey(
  presentedKey: string,
  storedHash: string,
  salt: string | null,
): boolean {
  if (!storedHash.startsWith(`${CURRENT_PREFIX}$`)) return false;
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
