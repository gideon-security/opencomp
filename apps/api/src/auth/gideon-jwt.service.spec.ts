import { Test } from '@nestjs/testing';
import { GideonJwtService } from './gideon-jwt.service';

const mockJwtVerify = jest.fn();
const mockCreateRemoteJWKSet = jest.fn(() => 'mock-jwks');
const mockDecodeJwt = jest.fn();
const mockDecodeProtectedHeader = jest.fn();

jest.mock('jose', () => ({
  createRemoteJWKSet: (...args: unknown[]) =>
    (mockCreateRemoteJWKSet as (...a: unknown[]) => unknown)(...args),
  jwtVerify: (...args: unknown[]) =>
    (mockJwtVerify as (...a: unknown[]) => unknown)(...args),
  decodeJwt: (...args: unknown[]) =>
    (mockDecodeJwt as (...a: unknown[]) => unknown)(...args),
  decodeProtectedHeader: (...args: unknown[]) =>
    (mockDecodeProtectedHeader as (...a: unknown[]) => unknown)(...args),
}));

describe('GideonJwtService', () => {
  let service: GideonJwtService;
  const OLD_ENV = { ...process.env };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.resetModules();
    process.env = { ...OLD_ENV };
    delete process.env.GIDEON_IDENTITY_URL;
    delete process.env.AUTH__IDENTITY_URL;
    delete process.env.GIDEON_JWT_ISSUER;
    delete process.env.JWT_ISSUER;
    delete process.env.GIDEON_JWT_AUDIENCE;
    delete process.env.JWT_AUDIENCE;
    delete process.env.GIDEON_JWT_ENABLED;
    delete process.env.GIDEON_JWT_SHADOW_ENABLED;
    delete process.env.GIDEON_JWKS_CACHE_TTL_SECS;
    delete process.env.AUTH__JWKS_CACHE_TTL_SECS;

    const module = await Test.createTestingModule({
      providers: [GideonJwtService],
    }).compile();
    service = module.get(GideonJwtService);
    // Reset private jwks cache between tests
    (service as unknown as { jwks: unknown }).jwks = null;
    (service as unknown as { warnedDisabled: boolean }).warnedDisabled = false;
  });

  afterEach(() => {
    process.env = OLD_ENV;
  });

  describe('isConfigured / isShadowMode / isEnforceMode', () => {
    it('isConfigured false when no identityUrl', () => {
      expect(service.isConfigured()).toBe(false);
    });

    it('isConfigured true when GIDEON_IDENTITY_URL set', () => {
      process.env.GIDEON_IDENTITY_URL = 'https://auth.example.com';
      expect(service.isConfigured()).toBe(true);
    });

    it('shadow auto-enables when identityUrl set and not enforced', () => {
      process.env.GIDEON_IDENTITY_URL = 'https://auth.example.com';
      expect(service.isShadowMode()).toBe(true);
      expect(service.isEnforceMode()).toBe(false);
    });

    it('shadow disabled when GIDEON_JWT_SHADOW_ENABLED=false', () => {
      process.env.GIDEON_IDENTITY_URL = 'https://auth.example.com';
      process.env.GIDEON_JWT_SHADOW_ENABLED = 'false';
      expect(service.isShadowMode()).toBe(false);
    });

    it('enforce true when GIDEON_JWT_ENABLED=true', () => {
      process.env.GIDEON_JWT_ENABLED = 'true';
      expect(service.isEnforceMode()).toBe(true);
      expect(service.isShadowMode()).toBe(false);
    });
  });

  describe('verify', () => {
    it('returns null when token empty', async () => {
      expect(await service.verify('')).toBeNull();
      expect(mockJwtVerify).not.toHaveBeenCalled();
    });

    it('returns null when not configured (no JWKS)', async () => {
      expect(await service.verify('some.token.here')).toBeNull();
      expect(mockCreateRemoteJWKSet).not.toHaveBeenCalled();
    });

    it('fail-closed when isConfigured and issuer missing', async () => {
      process.env.GIDEON_IDENTITY_URL = 'https://auth.example.com';
      // No issuer set — should fail closed before any decode/verify
      mockDecodeJwt.mockReturnValue({ iss: 'https://auth.example.com' } as never);
      mockDecodeProtectedHeader.mockReturnValue({ kid: 'k1', alg: 'ES256' } as never);

      const result = await service.verify('header.payload.sig');
      expect(result).toBeNull();
      expect(mockDecodeJwt).not.toHaveBeenCalled();
      expect(mockDecodeProtectedHeader).not.toHaveBeenCalled();
      expect(mockJwtVerify).not.toHaveBeenCalled();
    });

    it('fail-closed when isConfigured and audience missing', async () => {
      process.env.GIDEON_IDENTITY_URL = 'https://auth.example.com';
      process.env.GIDEON_JWT_ISSUER = 'https://auth.example.com';
      // No audience set — should fail closed before any decode/verify
      mockDecodeJwt.mockReturnValue({ iss: 'https://auth.example.com' } as never);
      mockDecodeProtectedHeader.mockReturnValue({ kid: 'k1', alg: 'ES256' } as never);

      const result = await service.verify('header.payload.sig');
      expect(result).toBeNull();
      expect(mockDecodeJwt).not.toHaveBeenCalled();
      expect(mockDecodeProtectedHeader).not.toHaveBeenCalled();
      expect(mockJwtVerify).not.toHaveBeenCalled();
    });

    it('peeks iss and skips verify on mismatch (shadow fast-path)', async () => {
      process.env.GIDEON_IDENTITY_URL = 'https://auth.example.com';
      process.env.GIDEON_JWT_ISSUER = 'https://auth.example.com';
      process.env.GIDEON_JWT_AUDIENCE = 'https://api.example.com';
      mockDecodeJwt.mockReturnValue({ iss: 'https://other.example.com' } as never);

      const result = await service.verify('header.payload.sig');
      expect(result).toBeNull();
      expect(mockDecodeJwt).toHaveBeenCalledWith('header.payload.sig');
      expect(mockJwtVerify).not.toHaveBeenCalled();
    });

    it('peeks kid and skips verify when missing (non-JWT opaque token)', async () => {
      process.env.GIDEON_IDENTITY_URL = 'https://auth.example.com';
      process.env.GIDEON_JWT_ISSUER = 'https://auth.example.com';
      process.env.GIDEON_JWT_AUDIENCE = 'https://api.example.com';
      mockDecodeJwt.mockReturnValue({ iss: 'https://auth.example.com' } as never);
      mockDecodeProtectedHeader.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const result = await service.verify('not.a.jwt');
      expect(result).toBeNull();
      expect(mockJwtVerify).not.toHaveBeenCalled();
    });

    it('returns null when header missing kid property', async () => {
      process.env.GIDEON_IDENTITY_URL = 'https://auth.example.com';
      process.env.GIDEON_JWT_ISSUER = 'https://auth.example.com';
      process.env.GIDEON_JWT_AUDIENCE = 'https://api.example.com';
      mockDecodeJwt.mockReturnValue({ iss: 'https://auth.example.com' } as never);
      mockDecodeProtectedHeader.mockReturnValue({ alg: 'ES256' } as never);

      const result = await service.verify('header.payload.sig');
      expect(result).toBeNull();
      expect(mockJwtVerify).not.toHaveBeenCalled();
    });

    it('returns null when decodeJwt throws (malformed token)', async () => {
      process.env.GIDEON_IDENTITY_URL = 'https://auth.example.com';
      process.env.GIDEON_JWT_ISSUER = 'https://auth.example.com';
      process.env.GIDEON_JWT_AUDIENCE = 'https://api.example.com';
      mockDecodeJwt.mockImplementation(() => {
        throw new Error('Invalid JWT');
      });

      const result = await service.verify('not.a.valid.jwt');
      expect(result).toBeNull();
      expect(mockJwtVerify).not.toHaveBeenCalled();
    });

    it('verifies with issuer/audience when configured and iss matches', async () => {
      process.env.GIDEON_IDENTITY_URL = 'https://auth.example.com';
      process.env.GIDEON_JWT_ISSUER = 'https://auth.example.com';
      process.env.GIDEON_JWT_AUDIENCE = 'https://api.example.com';
      mockDecodeJwt.mockReturnValue({ iss: 'https://auth.example.com' } as never);
      mockDecodeProtectedHeader.mockReturnValue({ kid: 'kid1', alg: 'ES256' } as never);
      mockJwtVerify.mockResolvedValue({
        payload: { sub: 'usr_1', tid: 'org_1', aal: 2 } as never,
        protectedHeader: { kid: 'kid1' } as never,
      });

      const result = await service.verify('valid.jwt.token');
      expect(result).not.toBeNull();
      expect(mockJwtVerify).toHaveBeenCalledWith(
        'valid.jwt.token',
        'mock-jwks',
        { issuer: 'https://auth.example.com', audience: 'https://api.example.com' },
      );
      expect(result?.payload.sub).toBe('usr_1');
    });

    it('warns on aal<2 but still returns payload (shadow)', async () => {
      process.env.GIDEON_IDENTITY_URL = 'https://auth.example.com';
      process.env.GIDEON_JWT_ISSUER = 'https://auth.example.com';
      process.env.GIDEON_JWT_AUDIENCE = 'https://api.example.com';
      mockDecodeJwt.mockReturnValue({ iss: 'https://auth.example.com' } as never);
      mockDecodeProtectedHeader.mockReturnValue({ kid: 'k1' } as never);
      mockJwtVerify.mockResolvedValue({
        payload: { sub: 'usr_1', tid: 'org_1', aal: 1 } as never,
        protectedHeader: {} as never,
      });

      const result = await service.verify('token');
      expect(result?.payload.aal).toBe(1);
    });
  });

  describe('resolveTenantId / resolveUserId', () => {
    it('prefers tid over tenant_id over organizationId', () => {
      expect(service.resolveTenantId({ sub: 'u', tid: 'tid1' } as never)).toBe('tid1');
      expect(service.resolveTenantId({ sub: 'u', tenant_id: 't2' } as never)).toBe('t2');
      expect(service.resolveTenantId({ sub: 'u', organizationId: 'o3' } as never)).toBe('o3');
      expect(service.resolveTenantId({ sub: 'u', tenantId: 't4' } as never)).toBe('t4');
      expect(service.resolveTenantId({ sub: 'u' } as never)).toBeNull();
    });

    it('resolveUserId returns sub or null', () => {
      expect(service.resolveUserId({ sub: 'usr_1' } as never)).toBe('usr_1');
      expect(service.resolveUserId({ sub: '' } as never)).toBeNull();
      expect(service.resolveUserId({} as never)).toBeNull();
    });
  });
});
