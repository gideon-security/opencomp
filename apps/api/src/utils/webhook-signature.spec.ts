import { createHmac } from 'node:crypto';
import {
  headerValue,
  parseSignatureValue,
  verifyHmacSignature,
} from './webhook-signature';

describe('parseSignatureValue', () => {
  it.each([
    ['sha256=abc123', 'abc123'],
    ['v0=abc123', 'abc123'],
    ['abc123', 'abc123'],
    ['  sha256=abc123  ', 'abc123'],
  ])('strips prefixes: %s', (input, expected) => {
    expect(parseSignatureValue(input)).toBe(expected);
  });
});

describe('headerValue', () => {
  it('matches header names case-insensitively', () => {
    expect(
      headerValue({ 'X-Checkr-Signature': 'sig' }, 'x-checkr-signature'),
    ).toBe('sig');
  });

  it('returns the first value for multi-value headers', () => {
    expect(headerValue({ 'x-sig': ['first', 'second'] }, 'X-Sig')).toBe(
      'first',
    );
  });

  it('returns null when the header is absent or undefined', () => {
    expect(headerValue({}, 'x-sig')).toBeNull();
    expect(headerValue({ 'x-sig': undefined }, 'x-sig')).toBeNull();
  });
});

describe('verifyHmacSignature', () => {
  const rawBody = Buffer.from('{"id":"evt_1"}');
  const secret = 'whsec_test';
  const valid = createHmac('sha256', secret).update(rawBody).digest('hex');

  it('accepts a valid hex signature', () => {
    expect(
      verifyHmacSignature({ rawBody, secret, providedSignature: valid }),
    ).toBe(true);
  });

  it('accepts a prefixed signature', () => {
    expect(
      verifyHmacSignature({
        rawBody,
        secret,
        providedSignature: `sha256=${valid}`,
      }),
    ).toBe(true);
  });

  it('rejects a wrong secret without throwing', () => {
    expect(
      verifyHmacSignature({
        rawBody,
        secret: 'wrong',
        providedSignature: valid,
      }),
    ).toBe(false);
  });

  it('returns false (never throws) for malformed hex', () => {
    expect(
      verifyHmacSignature({
        rawBody,
        secret,
        providedSignature: 'not-hex!!',
      }),
    ).toBe(false);
  });

  it('returns false for missing inputs', () => {
    expect(
      verifyHmacSignature({ rawBody, secret, providedSignature: '' }),
    ).toBe(false);
    expect(
      verifyHmacSignature({ rawBody, secret: '', providedSignature: valid }),
    ).toBe(false);
  });
});
