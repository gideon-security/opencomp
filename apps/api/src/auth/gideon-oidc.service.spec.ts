import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import {
  CALLBACK_URL,
  createOidcService,
  ENV,
  mockAuthorizationCodeGrant,
  mockBuildAuthorizationUrl,
  mockDiscovery,
  mockFetchUserInfo,
  mockOidc,
  mockOrgFindFirst,
  mockRedisGetdel,
  mockRedisSet,
  mockSessionCreate,
  mockSuccessfulExchange,
  mockUserCreate,
  mockUserFindFirst,
  mockUserFindUnique,
  mockUserUpdate,
} from './gideon-oidc.service.fixtures';
import { GideonOidcService } from './gideon-oidc.service';

// openid-client v6 is ESM-only and loaded via dynamic import() inside
// gideon-oidc-client — mock the loader statically instead.
jest.mock('./gideon-oidc-client', () => ({
  loadOidcClient: () => Promise.resolve(mockOidc),
}));

jest.mock('../redis/redis.client', () => ({
  redisClient: {
    set: (...args: unknown[]) => mockRedisSet(...args),
    getdel: (...args: unknown[]) => mockRedisGetdel(...args),
  },
}));

jest.mock('@db', () => ({
  db: {
    user: {
      findFirst: (...args: unknown[]) => mockUserFindFirst(...args),
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
      create: (...args: unknown[]) => mockUserCreate(...args),
      update: (...args: unknown[]) => mockUserUpdate(...args),
    },
    organization: {
      findFirst: (...args: unknown[]) => mockOrgFindFirst(...args),
    },
    session: {
      create: (...args: unknown[]) => mockSessionCreate(...args),
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

describe('GideonOidcService', () => {
  let service: GideonOidcService;
  const OLD_ENV = { ...process.env };

  beforeEach(async () => {
    jest.clearAllMocks();
    process.env = { ...OLD_ENV, ...ENV };
    service = await createOidcService();
  });

  afterEach(() => {
    process.env = OLD_ENV;
  });

  describe('isConfigured', () => {
    it('true when all OIDC env vars are set', () => {
      expect(service.isConfigured()).toBe(true);
    });

    it('false when the client secret is missing', () => {
      delete process.env.GIDEON_OIDC_CLIENT_SECRET;
      expect(service.isConfigured()).toBe(false);
    });
  });

  describe('getOidcConfig', () => {
    it('allows insecure discovery for loopback issuers', async () => {
      await service.getOidcConfig();
      expect(mockDiscovery).toHaveBeenCalledWith(
        expect.any(URL),
        ENV.GIDEON_OIDC_CLIENT_ID,
        ENV.GIDEON_OIDC_CLIENT_SECRET,
        undefined,
        expect.objectContaining({ execute: expect.any(Array) }),
      );
    });

    it('requires HTTPS discovery for non-loopback issuers', async () => {
      process.env.GIDEON_IDENTITY_URL = 'https://auth.example.com';
      await service.getOidcConfig();
      expect(mockDiscovery).toHaveBeenCalledWith(
        expect.any(URL),
        ENV.GIDEON_OIDC_CLIENT_ID,
        ENV.GIDEON_OIDC_CLIENT_SECRET,
        undefined,
        undefined,
      );
    });

    it('fails closed for non-loopback http issuers', async () => {
      process.env.GIDEON_IDENTITY_URL = 'http://auth.internal:8080';
      await expect(service.getOidcConfig()).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('buildLoginUrl', () => {
    it('stores PKCE state in Redis and returns the Gideon authorize URL', async () => {
      const result = await service.buildLoginUrl({
        redirectTo: '/risks',
        inviteCode: 'inv_1',
      });

      expect(result.url).toContain('/v1/oidc/authorize');
      expect(result.state).toBe('state-123');
      expect(result.nonce).toBe('nonce-123');
      expect(result.codeVerifier).toBe('verifier-123');
      expect(mockRedisSet).toHaveBeenCalledWith(
        'app:gideon-oidc:state-123',
        {
          codeVerifier: 'verifier-123',
          nonce: 'nonce-123',
          redirectTo: '/risks',
          inviteCode: 'inv_1',
        },
        { ex: 600 },
      );
      expect(mockBuildAuthorizationUrl).toHaveBeenCalledWith('mock-config', {
        redirect_uri: ENV.GIDEON_OIDC_REDIRECT_URI,
        scope: 'openid profile email',
        code_challenge: 'challenge-123',
        code_challenge_method: 'S256',
        state: 'state-123',
        nonce: 'nonce-123',
      });
    });

    it('throws when OIDC is not configured', async () => {
      delete process.env.GIDEON_OIDC_CLIENT_SECRET;
      await expect(service.buildLoginUrl()).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('handleCallback', () => {
    const callbackUrl = CALLBACK_URL;

    it('links gideonSub on an existing user and mints a session', async () => {
      mockSuccessfulExchange();
      mockUserFindFirst.mockResolvedValue({
        id: 'usr_1',
        email: 'ada@example.com',
        gideonSub: null,
        banned: false,
      });
      mockUserUpdate.mockResolvedValue({ id: 'usr_1' });

      const result = await service.handleCallback({ callbackUrl });

      expect(mockFetchUserInfo).toHaveBeenCalledWith(
        'mock-config',
        'access-1',
        'gideon-sub-1',
      );
      expect(mockUserUpdate).toHaveBeenCalledWith({
        where: { id: 'usr_1' },
        data: expect.objectContaining({ gideonSub: 'gideon-sub-1' }),
      });
      expect(mockSessionCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'usr_1',
          activeOrganizationId: 'org_1',
          gideonRefreshToken: 'refresh-1',
        }),
      });
      expect(result.sessionToken).toBe('ses-token');
      expect(result.redirectTo).toBe('/risks');
    });

    it('provisions a new user for an unknown verified email', async () => {
      mockSuccessfulExchange();
      mockUserFindFirst.mockResolvedValue(null);
      mockUserCreate.mockResolvedValue({ id: 'usr_new' });

      const result = await service.handleCallback({ callbackUrl });

      expect(mockUserCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: 'ada@example.com',
          emailVerified: true,
          gideonSub: 'gideon-sub-1',
        }),
      });
      expect(result.userId).toBe('usr_new');
    });

    it('retries the link path on a concurrent-insert P2002', async () => {
      mockSuccessfulExchange();
      mockUserFindFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({
        id: 'usr_raced',
        email: 'ada@example.com',
        gideonSub: null,
        banned: false,
      });
      mockUserCreate.mockRejectedValue({ code: 'P2002' });
      mockUserUpdate.mockResolvedValue({ id: 'usr_raced' });

      const result = await service.handleCallback({ callbackUrl });

      expect(mockUserUpdate).toHaveBeenCalledWith({
        where: { id: 'usr_raced' },
        data: expect.objectContaining({ gideonSub: 'gideon-sub-1' }),
      });
      expect(result.userId).toBe('usr_raced');
    });

    it('adopts the new email when the same sub presents a changed email', async () => {
      mockSuccessfulExchange();
      mockUserFindFirst.mockResolvedValue(null);
      mockUserCreate.mockRejectedValue({ code: 'P2002' });
      mockUserFindUnique.mockResolvedValue({
        id: 'usr_old',
        email: 'old@example.com',
        banned: false,
        gideonSub: 'gideon-sub-1',
      });
      mockUserUpdate.mockResolvedValue({ id: 'usr_old' });

      const result = await service.handleCallback({ callbackUrl });

      expect(mockUserUpdate).toHaveBeenCalledWith({
        where: { id: 'usr_old' },
        data: expect.objectContaining({ email: 'ada@example.com' }),
      });
      expect(result.userId).toBe('usr_old');
    });

    it('rejects banned users', async () => {
      mockSuccessfulExchange();
      mockUserFindFirst.mockResolvedValue({
        id: 'usr_1',
        email: 'ada@example.com',
        gideonSub: null,
        banned: true,
      });

      await expect(service.handleCallback({ callbackUrl })).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockSessionCreate).not.toHaveBeenCalled();
    });

    it('rejects mismatched/expired state', async () => {
      mockRedisGetdel.mockResolvedValue(null);

      await expect(service.handleCallback({ callbackUrl })).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockAuthorizationCodeGrant).not.toHaveBeenCalled();
    });

    it('rejects unverified email', async () => {
      mockRedisGetdel.mockResolvedValue({
        codeVerifier: 'verifier-123',
        nonce: 'nonce-123',
      });
      mockAuthorizationCodeGrant.mockResolvedValue({
        access_token: 'access-1',
        claims: () => ({ sub: 'gideon-sub-1' }),
      });
      mockFetchUserInfo.mockResolvedValue({
        sub: 'gideon-sub-1',
        email: 'ada@example.com',
        email_verified: false,
      });

      await expect(service.handleCallback({ callbackUrl })).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockUserFindFirst).not.toHaveBeenCalled();
    });

    it('rejects a conflicting gideonSub link', async () => {
      mockSuccessfulExchange();
      mockUserFindFirst.mockResolvedValue({
        id: 'usr_1',
        email: 'ada@example.com',
        gideonSub: 'other-sub',
        banned: false,
      });

      await expect(service.handleCallback({ callbackUrl })).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockSessionCreate).not.toHaveBeenCalled();
    });
  });
});
