import {
  defaultFromAddress,
  resolveFromAddress,
} from './from-address';

describe('resolveFromAddress', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('resolves each channel to its dedicated env var', () => {
    process.env.EMAIL_FROM_SYSTEM = 'noreply@x.com';
    process.env.EMAIL_FROM_MARKETING = 'marketing@x.com';
    process.env.EMAIL_FROM_TRUST_PORTAL = 'trust@x.com';
    process.env.EMAIL_FROM_DEFAULT = 'hello@x.com';

    expect(resolveFromAddress('system')).toBe('noreply@x.com');
    expect(resolveFromAddress('marketing')).toBe('marketing@x.com');
    expect(resolveFromAddress('trustPortal')).toBe('trust@x.com');
    expect(resolveFromAddress('default')).toBe('hello@x.com');
  });

  it('falls back to the system address when trustPortal is unset', () => {
    process.env.EMAIL_FROM_SYSTEM = 'noreply@x.com';
    process.env.EMAIL_FROM_TRUST_PORTAL = '';

    expect(resolveFromAddress('trustPortal')).toBe('noreply@x.com');
  });

  it('falls back to system then default for unknown channels', () => {
    process.env.EMAIL_FROM_SYSTEM = 'noreply@x.com';
    expect(resolveFromAddress(undefined)).toBe('noreply@x.com');

    process.env.EMAIL_FROM_SYSTEM = '';
    process.env.EMAIL_FROM_DEFAULT = 'hello@x.com';
    expect(resolveFromAddress(undefined)).toBe('hello@x.com');
  });

  it('returns undefined when nothing is configured', () => {
    process.env.EMAIL_FROM_SYSTEM = '';
    process.env.EMAIL_FROM_DEFAULT = '';
    expect(resolveFromAddress('system')).toBeUndefined();
  });
});

describe('defaultFromAddress', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('prefers the system address', () => {
    process.env.EMAIL_FROM_SYSTEM = 'noreply@x.com';
    process.env.EMAIL_FROM_DEFAULT = 'hello@x.com';
    expect(defaultFromAddress()).toBe('noreply@x.com');
  });

  it('falls back to the default address', () => {
    process.env.EMAIL_FROM_SYSTEM = '';
    process.env.EMAIL_FROM_DEFAULT = 'hello@x.com';
    expect(defaultFromAddress()).toBe('hello@x.com');
  });
});
