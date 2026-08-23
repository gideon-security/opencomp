import { createHash, pbkdf2Sync, randomBytes } from 'node:crypto';
import {
  PBKDF2_ITERATIONS,
  hashApiKeyCurrent,
  isLegacyStoredHash,
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

  it('still verifies legacy unsalted sha256 rows (backward compat)', () => {
    const legacyStored = createHash('sha256').update(key).digest('hex');
    expect(matchesStoredKey(key, legacyStored, null)).toBe(true);
    expect(matchesStoredKey(key, legacyStored, 'some-salt')).toBe(false);
  });

  it('still verifies legacy salted sha256 rows (backward compat)', () => {
    const salt = randomBytes(16).toString('hex');
    const legacyStored = createHash('sha256')
      .update(key + salt)
      .digest('hex');
    expect(matchesStoredKey(key, legacyStored, salt)).toBe(true);
    expect(matchesStoredKey(key, legacyStored, null)).toBe(false);
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

describe('isLegacyStoredHash (upgrade-on-verify gate)', () => {
  it('flags plain sha256 rows as legacy', () => {
    const salt = randomBytes(16).toString('hex');
    expect(isLegacyStoredHash(createHash('sha256').update(key + salt).digest('hex'))).toBe(true);
  });

  it('treats pbkdf2 rows as current', () => {
    const salt = randomBytes(16).toString('hex');
    expect(isLegacyStoredHash(hashApiKeyCurrent(key, salt))).toBe(false);
  });
});
