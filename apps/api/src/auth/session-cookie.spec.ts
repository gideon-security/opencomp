import { betterAuth } from 'better-auth';
import { memoryAdapter } from 'better-auth/adapters/memory';
import {
  getSessionCookieAttributes,
  getSessionCookieName,
  getSessionCookieNames,
  getCookieDomain,
  shouldUseSecureCookies,
  signSessionToken,
  unsignedSessionToken,
} from './session-cookie';

describe('session-cookie', () => {
  const OLD_ENV = { ...process.env };

  afterEach(() => {
    process.env = { ...OLD_ENV };
  });

  describe('getCookieDomain', () => {
    it('returns the staging domain for staging hosts', () => {
      process.env.BASE_URL = 'https://api.staging.gideondefender.com';
      expect(getCookieDomain()).toBe('.staging.gideondefender.com');
    });

    it('returns the production domain for production hosts', () => {
      process.env.BASE_URL = 'https://api.gideondefender.com';
      expect(getCookieDomain()).toBe('.gideondefender.com');
    });

    it('rejects suffix-crafted hosts', () => {
      process.env.BASE_URL = 'https://staging.gideondefender.com.evil.com';
      expect(getCookieDomain()).toBeUndefined();
    });

    it('returns undefined for local dev and unparseable URLs', () => {
      process.env.BASE_URL = 'http://localhost:3333';
      expect(getCookieDomain()).toBeUndefined();
      process.env.BASE_URL = 'not-a-url';
      expect(getCookieDomain()).toBeUndefined();
    });
  });

  describe('shouldUseSecureCookies', () => {
    it('is true for https, even outside production', () => {
      process.env.BASE_URL = 'https://api.gideondefender.com';
      process.env.NODE_ENV = 'test';
      expect(shouldUseSecureCookies()).toBe(true);
    });

    it('is true in production even without a parseable URL', () => {
      process.env.BASE_URL = 'not-a-url';
      process.env.NODE_ENV = 'production';
      expect(shouldUseSecureCookies()).toBe(true);
    });

    it('is false for plain HTTP outside production', () => {
      process.env.BASE_URL = 'http://localhost:3333';
      process.env.NODE_ENV = 'test';
      expect(shouldUseSecureCookies()).toBe(false);
    });
  });

  describe('getSessionCookieName', () => {
    it('uses the plain local name for local dev', () => {
      process.env.BASE_URL = 'http://localhost:3333';
      process.env.NODE_ENV = 'test';
      expect(getSessionCookieName()).toBe('local.session_token');
    });

    it('prefixes staging and production names in secure contexts', () => {
      process.env.BASE_URL = 'https://api.staging.gideondefender.com';
      process.env.NODE_ENV = 'production';
      expect(getSessionCookieName()).toBe('__Secure-staging.session_token');
      process.env.BASE_URL = 'https://api.gideondefender.com';
      expect(getSessionCookieName()).toBe('__Secure-better-auth.session_token');
    });
  });

  describe('getSessionCookieNames', () => {
    it('returns secure-prefixed first, then plain', () => {
      process.env.BASE_URL = 'https://api.gideondefender.com';
      process.env.NODE_ENV = 'production';
      expect(getSessionCookieNames()).toEqual([
        '__Secure-better-auth.session_token',
        'better-auth.session_token',
      ]);
    });
  });

  describe('getSessionCookieAttributes', () => {
    it('sets httpOnly lax cookies scoped to the shared domain', () => {
      process.env.BASE_URL = 'https://api.gideondefender.com';
      process.env.NODE_ENV = 'production';
      expect(getSessionCookieAttributes()).toEqual({
        httpOnly: true,
        sameSite: 'lax',
        secure: true,
        path: '/',
        domain: '.gideondefender.com',
      });
    });

    it('omits the domain for host-only local cookies', () => {
      process.env.BASE_URL = 'http://localhost:3333';
      process.env.NODE_ENV = 'test';
      const attributes = getSessionCookieAttributes();
      expect(attributes.secure).toBe(false);
      expect(attributes).not.toHaveProperty('domain');
    });
  });

  describe('signSessionToken', () => {
    it('produces token.signature with a 44-char base64 HMAC', () => {
      process.env.SECRET_KEY = 'test-secret';
      const signed = signSessionToken('abc123');
      expect(signed.startsWith('abc123.')).toBe(true);
      const signature = signed.slice('abc123.'.length);
      expect(signature).toHaveLength(44);
      expect(signature.endsWith('=')).toBe(true);
    });

    it('is deterministic and keyed by SECRET_KEY', () => {
      process.env.SECRET_KEY = 'test-secret';
      const first = signSessionToken('abc123');
      expect(signSessionToken('abc123')).toBe(first);
      process.env.SECRET_KEY = 'other-secret';
      expect(signSessionToken('abc123')).not.toBe(first);
    });

    it('fails closed without SECRET_KEY', () => {
      delete process.env.SECRET_KEY;
      expect(() => signSessionToken('abc123')).toThrow(/SECRET_KEY/);
    });
  });

  describe('unsignedSessionToken', () => {
    it('strips the signature from a wire-encoded signed value', () => {
      process.env.SECRET_KEY = 'test-secret';
      const signed = signSessionToken('abc123');
      expect(unsignedSessionToken(encodeURIComponent(signed))).toBe('abc123');
    });

    it('passes raw tokens through and rejects missing values', () => {
      expect(unsignedSessionToken('abc123')).toBe('abc123');
      expect(unsignedSessionToken(undefined)).toBeNull();
      expect(unsignedSessionToken(null)).toBeNull();
      expect(unsignedSessionToken('')).toBeNull();
    });
  });

  describe('better-auth compatibility', () => {
    const TEST_SECRET = 'oidc-cookie-compat-secret-at-least-32b!!';

    function buildTestAuth() {
      return betterAuth({
        baseURL: 'http://localhost:3333',
        secret: TEST_SECRET,
        // The memory adapter needs pre-created tables; reads against a
        // missing table throw instead of returning null.
        database: memoryAdapter({
          user: [],
          session: [],
          account: [],
          verification: [],
        }),
        emailAndPassword: { enabled: true },
        advanced: { cookiePrefix: 'local' },
        rateLimit: { enabled: false },
      });
    }

    async function mintRealSessionToken(): Promise<{
      auth: ReturnType<typeof buildTestAuth>;
      token: string;
    }> {
      process.env.SECRET_KEY = TEST_SECRET;
      process.env.BASE_URL = 'http://localhost:3333';
      process.env.NODE_ENV = 'test';
      const auth = buildTestAuth();
      const signup = await auth.api.signUpEmail({
        body: {
          name: 'Oidc',
          email: 'oidc@example.com',
          password: 'password123',
        },
      });
      if (!signup.token) {
        throw new Error('signUpEmail did not return a session token');
      }
      return { auth, token: signup.token };
    }

    it('signed OIDC cookie resolves through the real getSession', async () => {
      const { auth, token } = await mintRealSessionToken();
      const headers = new Headers();
      headers.set(
        'cookie',
        `${getSessionCookieName()}=${encodeURIComponent(signSessionToken(token))}`,
      );
      const session = await auth.api.getSession({ headers });
      expect(session?.user.email).toBe('oidc@example.com');
      expect(session?.session.token).toBe(token);
    });

    it('unsigned cookie does not resolve (regression)', async () => {
      const { auth, token } = await mintRealSessionToken();
      const headers = new Headers();
      headers.set('cookie', `${getSessionCookieName()}=${token}`);
      await expect(auth.api.getSession({ headers })).resolves.toBeNull();
    });
  });
});
