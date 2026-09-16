import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { PlatformAdminGuard } from '../auth/platform-admin.guard';
import type { NativeSessionService } from '../auth/native-session.service';

const mockResolveFromHeaders = jest.fn();
const mockFindUnique = jest.fn();

jest.mock('@db', () => ({
  db: {
    user: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
  },
}));

function buildContext(
  headers: Record<string, string | undefined> = {},
): ExecutionContext {
  const request = {
    headers,
    userId: undefined,
    userEmail: undefined,
    isPlatformAdmin: undefined,
  };
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

function mockNativeHit(userId: string) {
  mockResolveFromHeaders.mockResolvedValue({
    user: { id: userId, email: `${userId}@test.com`, role: 'user' },
    session: {
      id: 'sess_1',
      activeOrganizationId: 'org_1',
      impersonatedBy: null,
      deviceAgent: false,
      expiresAt: new Date(Date.now() + 60_000),
    },
  });
}

describe('PlatformAdminGuard — runtime rejection scenarios', () => {
  let guard: PlatformAdminGuard;

  beforeEach(() => {
    const nativeSessionService = {
      resolveFromHeaders: (...args: unknown[]) =>
        mockResolveFromHeaders(...args),
    } as unknown as NativeSessionService;
    guard = new PlatformAdminGuard(nativeSessionService);
    jest.clearAllMocks();
    mockResolveFromHeaders.mockResolvedValue(null);
  });

  describe('returns 401 for unauthenticated requests', () => {
    it('rejects requests with no headers at all', async () => {
      const ctx = buildContext({});
      await expect(guard.canActivate(ctx)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects requests with only x-api-key (admin routes are session-only)', async () => {
      const ctx = buildContext({ 'x-api-key': 'key_test_12345' });
      await expect(guard.canActivate(ctx)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockResolveFromHeaders).not.toHaveBeenCalled();
    });

    it('rejects requests with only x-service-token', async () => {
      const ctx = buildContext({ 'x-service-token': 'svc_test_token' });
      await expect(guard.canActivate(ctx)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockResolveFromHeaders).not.toHaveBeenCalled();
    });

    it('rejects when session cookie is present but session is expired', async () => {
      mockResolveFromHeaders.mockResolvedValue(null);
      const ctx = buildContext({ cookie: 'session=expired_token' });
      await expect(guard.canActivate(ctx)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects when bearer token is present but session is invalid', async () => {
      mockResolveFromHeaders.mockResolvedValue(null);
      const ctx = buildContext({ authorization: 'Bearer invalid' });
      await expect(guard.canActivate(ctx)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('returns 403 for authenticated non-admin users', () => {
    it('rejects a user with role "user"', async () => {
      mockNativeHit('usr_regular');
      mockFindUnique.mockResolvedValue({
        id: 'usr_regular',
        email: 'regular@test.com',
        role: 'user',
      });
      const ctx = buildContext({ cookie: 'session=valid' });

      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
      await expect(guard.canActivate(ctx)).rejects.toThrow(
        'Access denied: Platform admin privileges required',
      );
    });

    it('rejects a user with role null (no role set)', async () => {
      mockNativeHit('usr_norole');
      mockFindUnique.mockResolvedValue({
        id: 'usr_norole',
        email: 'norole@test.com',
        role: null,
      });
      const ctx = buildContext({ cookie: 'session=valid' });

      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    });

    it('rejects a user with role "owner" (org role, not platform admin)', async () => {
      mockNativeHit('usr_owner');
      mockFindUnique.mockResolvedValue({
        id: 'usr_owner',
        email: 'owner@test.com',
        role: 'owner',
      });
      const ctx = buildContext({ cookie: 'session=valid' });

      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    });

    it('rejects when session claims admin but DB says user', async () => {
      mockNativeHit('usr_sneaky');
      mockFindUnique.mockResolvedValue({
        id: 'usr_sneaky',
        email: 'sneaky@test.com',
        role: 'user',
      });
      const ctx = buildContext({ authorization: 'Bearer valid' });

      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
      expect(mockFindUnique).toHaveBeenCalledWith({
        where: { id: 'usr_sneaky' },
        select: { id: true, email: true, role: true },
      });
    });

    it('rejects a user who was deleted between session check and DB lookup', async () => {
      mockNativeHit('usr_deleted');
      mockFindUnique.mockResolvedValue(null);
      const ctx = buildContext({ cookie: 'session=valid' });

      await expect(guard.canActivate(ctx)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(guard.canActivate(ctx)).rejects.toThrow('User not found');
    });
  });

  describe('allows authenticated platform admin', () => {
    it('succeeds and sets request context for role=admin', async () => {
      mockNativeHit('usr_admin');
      mockFindUnique.mockResolvedValue({
        id: 'usr_admin',
        email: 'admin@platform.com',
        role: 'admin',
      });

      const request = {
        headers: { cookie: 'session=admin_session' },
        userId: undefined as string | undefined,
        userEmail: undefined as string | undefined,
        isPlatformAdmin: undefined as boolean | undefined,
      };
      const ctx = {
        switchToHttp: () => ({ getRequest: () => request }),
      } as unknown as ExecutionContext;

      const result = await guard.canActivate(ctx);

      expect(result).toBe(true);
      expect(request.userId).toBe('usr_admin');
      expect(request.userEmail).toBe('admin@platform.com');
      expect(request.isPlatformAdmin).toBe(true);
    });
  });
});
