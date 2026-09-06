import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Shared webhook signature helpers. Used by the Checkr background-check
 * webhook and the integration-platform provider webhooks so the HMAC
 * comparison logic lives in exactly one place.
 */

/** Strip a `sha256=` / `v0=` style prefix; pass raw hex through untouched. */
export function parseSignatureValue(signature: string): string {
  const trimmed = signature.trim();
  const eqIndex = trimmed.indexOf('=');
  return eqIndex >= 0 ? trimmed.slice(eqIndex + 1) : trimmed;
}

/**
 * Case-insensitive header lookup that also handles multi-value headers.
 * Returns the first value or null when the header is absent.
 */
export function headerValue(
  headers: Record<string, string | string[] | undefined>,
  name: string,
): string | null {
  const lowerName = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() !== lowerName) continue;
    if (Array.isArray(value)) return value[0] ?? null;
    return value ?? null;
  }
  return null;
}

/**
 * Constant-time HMAC comparison. Returns false (never throws) for missing
 * inputs or malformed hex so callers can decide between warn-and-drop
 * and throw.
 */
export function verifyHmacSignature({
  rawBody,
  secret,
  providedSignature,
  algorithm = 'sha256',
}: {
  rawBody: Buffer;
  secret: string;
  providedSignature: string;
  algorithm?: string;
}): boolean {
  if (!rawBody || !secret || !providedSignature) return false;
  const expected = createHmac(algorithm, secret).update(rawBody).digest('hex');
  try {
    const expectedBuf = Buffer.from(expected, 'hex');
    const providedBuf = Buffer.from(
      parseSignatureValue(providedSignature),
      'hex',
    );
    return (
      expectedBuf.length === providedBuf.length &&
      timingSafeEqual(expectedBuf, providedBuf)
    );
  } catch {
    return false;
  }
}
