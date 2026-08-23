import { createHash, pbkdf2Sync, timingSafeEqual } from 'node:crypto';

/**
 * API key hashing.
 *
 * API keys are 256-bit random tokens (`comp_` + 32 bytes), so unlike
 * human passwords they cannot be brute-forced offline regardless of hash
 * speed — but CodeQL js/insufficient-password-hash (and defense-in-depth
 * against a leaked-hash-only attack) wants a memory/iteration-hardened KDF.
 *
 * Format versioning lives inside the stored hash string so old rows keep
 * verifying during a zero-downtime migration:
 *   - `pbkdf2$<iterations>$<hex>`  → current (PBKDF2-SHA256)
 *   - anything else                → legacy (SHA-256, optionally salted)
 */

const CURRENT_PREFIX = 'pbkdf2';
export const PBKDF2_ITERATIONS = 100_000;
const KEY_LEN = 32;

/** Current scheme: PBKDF2-SHA256, stored as `pbkdf2$<iterations>$<hex>`. */
export function hashApiKeyCurrent(apiKey: string, salt: string): string {
  const derived = pbkdf2Sync(apiKey, salt, PBKDF2_ITERATIONS, KEY_LEN, 'sha256');
  return `${CURRENT_PREFIX}$${PBKDF2_ITERATIONS}$${derived.toString('hex')}`;
}

/** True when a stored hash predates the PBKDF2 scheme and should be upgraded. */
export function isLegacyStoredHash(storedHash: string): boolean {
  return !storedHash.startsWith(`${CURRENT_PREFIX}$`);
}

/** Legacy schemes: unsalted SHA-256, or SHA-256 over key+salt. */
function hashLegacy(apiKey: string, salt?: string): string {
  return createHash('sha256')
    .update(salt ? apiKey + salt : apiKey)
    .digest('hex');
}

/** Constant-time hex-string comparison (length-mismatch safe). */
function safeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'hex');
  const bufB = Buffer.from(b, 'hex');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Verify a presented API key against a stored hash, dispatching on the
 * stored format. Never throws on malformed input — returns false.
 */
export function matchesStoredKey(
  presentedKey: string,
  storedHash: string,
  salt: string | null,
): boolean {
  try {
    if (storedHash.startsWith(`${CURRENT_PREFIX}$`)) {
      const [, iterationsRaw, digest] = storedHash.split('$');
      const iterations = Number(iterationsRaw);
      if (!Number.isInteger(iterations) || iterations <= 0 || !digest) {
        return false;
      }
      const derived = pbkdf2Sync(presentedKey, salt ?? '', iterations, KEY_LEN, 'sha256');
      return safeEqualHex(derived.toString('hex'), digest);
    }
    return safeEqualHex(hashLegacy(presentedKey, salt ?? undefined), storedHash);
  } catch {
    return false;
  }
}
