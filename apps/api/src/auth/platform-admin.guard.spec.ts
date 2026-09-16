import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { PlatformAdminGuard } from './platform-admin.guard';
import type { NativeSessionService } from './native-session.service';

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

function mockNativeHit({
  userId = 'usr_admin',
  impersonatedBy = null,
}: {
  userId?: string;
  impersonatedBy?: string | null;
} = {}) {
  mockResolveFromHeaders.mockResolvedValue({
    user: { id: userId, email: `${userId}@test.com`, role: 'user' },
    session: {
      id: 'sess_1',
      activeOrganizationId: 'org_1',
      impersonatedBy,
      deviceAgent: false,
      expiresAt: new Date(Date.now() + 60_000),
    },
  });
}

describe('PlatformAdminGuard', () => {
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

  it('throws UnauthorizedException when no auth headers are present', async () => {
    const ctx = buildContext({});
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    await expect(guard.canActivate(ctx)).rejects.toThrow(
      'Platform admin routes require authentication',
    );
  });

  it('throws UnauthorizedException when the native lookup misses', async () => {
    mockResolveFromHeaders.mockResolvedValue(null);
    const ctx = buildContext({ authorization: 'Bearer bad_token' });

    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    await expect(guard.canActivate(ctx)).rejects.toThrow(
      'Invalid or expired session',
    );
  });

  it('throws UnauthorizedException when user is not found in DB', async () => {
    mockNativeHit({ userId: 'usr_1' });
    mockFindUnique.mockResolvedValue(null);
    const ctx = buildContext({ cookie: 'session=abc' });

    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    await expect(guard.canActivate(ctx)).rejects.toThrow('User not found');
  });

  it('throws ForbiddenException when user role is not admin', async () => {
    mockNativeHit({ userId: 'usr_1' });
    mockFindUnique.mockResolvedValue({
      id: 'usr_1',
      email: 'user@test.com',
      role: 'user',
    });
    const ctx = buildContext({ cookie: 'session=abc' });

    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    await expect(guard.canActivate(ctx)).rejects.toThrow(
      'Access denied: Platform admin privileges required',
    );
  });

  it('throws ForbiddenException when user role is null', async () => {
    mockNativeHit({ userId: 'usr_1' });
    mockFindUnique.mockResolvedValue({
      id: 'usr_1',
      email: 'user@test.com',
      role: null,
    });
    const ctx = buildContext({ cookie: 'session=abc' });

    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('returns true and sets request context for valid admin', async () => {
    mockNativeHit({ userId: 'usr_admin' });
    mockFindUnique.mockResolvedValue({
      id: 'usr_admin',
      email: 'admin@platform.com',
      role: 'admin',
    });

    const request = {
      headers: { authorization: 'Bearer valid_token' },
      userId: undefined as string | undefined,
      userEmail: undefined as string | undefined,
      isPlatformAdmin: undefined as boolean | undefined,
      sessionId: undefined as string | undefined,
    };
    const ctx = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;

    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(request.userId).toBe('usr_admin');
    expect(request.userEmail).toBe('admin@platform.com');
    expect(request.isPlatformAdmin).toBe(true);
    expect(request.sessionId).toBe('sess_1');
  });

  it('propagates impersonation state from the native session', async () => {
    mockNativeHit({ userId: 'usr_1', impersonatedBy: 'admin_1' });
    mockFindUnique.mockResolvedValue({
      id: 'usr_1',
      email: 'usr_1@test.com',
      role: 'admin',
    });

    const request = {
      headers: { cookie: 'session=imp' },
      userId: undefined as string | undefined,
      impersonatedBy: undefined as string | undefined,
    };
    const ctx = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(request.impersonatedBy).toBe('admin_1');
  });

  it('always authorizes from the DB role, never the session user role', async () => {
    // The native session user carries role info, but the guard must ignore
    // it — only User.role in the DB decides.
    mockNativeHit({ userId: 'usr_1' });
    mockFindUnique.mockResolvedValue({
      id: 'usr_1',
      email: 'user@test.com',
      role: 'user',
    });
    const ctx = buildContext({ cookie: 'session=abc' });

    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { id: 'usr_1' },
      select: { id: true, email: true, role: true },
    });
  });

  it('does not allow API key authentication', async () => {
    const ctx = buildContext({ 'x-api-key': 'some_key' });
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('does not allow service token authentication', async () => {
    const ctx = buildContext({ 'x-service-token': 'some_token' });
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('forwards authorization and cookie headers to the native resolver', async () => {
    mockNativeHit({ userId: 'usr_admin' });
    mockFindUnique.mockResolvedValue({
      id: 'usr_admin',
      email: 'admin@test.com',
      role: 'admin',
    });
    const ctx = buildContext({
      authorization: 'Bearer token123',
      cookie: 'session=xyz',
    });

    await guard.canActivate(ctx);

    expect(mockResolveFromHeaders).toHaveBeenCalledWith({
      cookieHeader: 'session=xyz',
      authHeader: 'Bearer token123',
    });
  });
});
