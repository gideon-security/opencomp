import { createHash, pbkdf2Sync, randomBytes } from 'node:crypto';
import {
  PBKDF2_ITERATIONS,
  hashApiKeyCurrent,
  matchesStoredKey,
} from './api-key-hash';

const key = `comp_${randomBytes(32).toString('hex')}`;

describe('api-key-hash', () => {
  it('stores new keys in versioned pbkdf2 format', () => {
    const salt = randomBytes(16).toString('hex');
    const stored = hashApiKeyCurrent(key, salt);
    expect(stored).toMatch(/^pbkdf2\$100000\$[0-9a-f]{64}$/);
  });

  it('verifies the presented key against the current scheme', () => {
    const salt = randomBytes(16).toString('hex');
    expect(matchesStoredKey(key, hashApiKeyCurrent(key, salt), salt)).toBe(
      true,
    );
  });

  it('rejects wrong keys and wrong salts under the current scheme', () => {
    const salt = randomBytes(16).toString('hex');
    const stored = hashApiKeyCurrent(key, salt);
    expect(matchesStoredKey(`comp_${randomBytes(32).toString('hex')}`, stored, salt)).toBe(false);
    expect(matchesStoredKey(key, stored, 'deadbeef')).toBe(false);
  });

  it('fails closed on insecure legacy hash formats', () => {
    const unsalted = createHash('sha256').update(key).digest('hex');
    const salt = randomBytes(16).toString('hex');
    const salted = createHash('sha256')
      .update(key + salt)
      .digest('hex');
    expect(matchesStoredKey(key, unsalted, null)).toBe(false);
    expect(matchesStoredKey(key, salted, salt)).toBe(false);
  });

  it('returns false instead of throwing on malformed stored hashes', () => {
    expect(matchesStoredKey(key, 'pbkdf2$notanumber$zz', 's')).toBe(false);
    expect(matchesStoredKey(key, 'pbkdf2$100000$', 's')).toBe(false);
    expect(matchesStoredKey(key, '', null)).toBe(false);
  });

  it('uses the documented iteration count for work-factor compliance', () => {
    expect(PBKDF2_ITERATIONS).toBeGreaterThanOrEqual(100_000);
    // Spot-check the KDF output directly against node's primitive.
    const salt = 'salt';
    const expected = pbkdf2Sync(key, salt, PBKDF2_ITERATIONS, 32, 'sha256').toString('hex');
    expect(hashApiKeyCurrent(key, salt)).toBe(`pbkdf2$${PBKDF2_ITERATIONS}$${expected}`);
  });
});
