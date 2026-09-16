process.env.SECRET_KEY =
  process.env.SECRET_KEY || 'test-secret-key-16-chars-min';

import { NativeSessionService } from './native-session.service';
import { getSessionCookieNames, signSessionToken } from './session-cookie';

const mockSessionFindUnique = jest.fn();
jest.mock('@db', () => ({
  db: {
    session: {
      findUnique: (...args: unknown[]) => mockSessionFindUnique(...args),
    },
  },
}));

const NOW = Date.now();
const LIVE_ROW = {
  id: 'ses_1',
  expiresAt: new Date(NOW + 60_000),
  activeOrganizationId: 'org_1',
  impersonatedBy: null,
  deviceAgent: false,
  user: { id: 'usr_1', email: 'user@acme.com', role: 'user' },
};

describe('NativeSessionService', () => {
  let service: NativeSessionService;
  let plainCookieName = '';
  let secureCookieName = '';

  beforeEach(() => {
    service = new NativeSessionService();
    mockSessionFindUnique.mockReset();
    // [secure-prefixed, plain] — mirrors better-auth's read order.
    const names = getSessionCookieNames();
    secureCookieName = names[0];
    plainCookieName = names[1];
  });

  it('resolves a raw token from the plain session cookie', async () => {
    mockSessionFindUnique.mockResolvedValue(LIVE_ROW);

    const result = await service.resolveFromHeaders({
      cookieHeader: `${plainCookieName}=tok_raw_123`,
    });

    expect(mockSessionFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { token: 'tok_raw_123' } }),
    );
    expect(result).toEqual({
      user: LIVE_ROW.user,
      session: {
        id: 'ses_1',
        activeOrganizationId: 'org_1',
        impersonatedBy: null,
        deviceAgent: false,
        expiresAt: LIVE_ROW.expiresAt,
      },
    });
  });

  it('strips the signature from a signed secure cookie value', async () => {
    mockSessionFindUnique.mockResolvedValue(LIVE_ROW);
    const signed = encodeURIComponent(signSessionToken('tok_raw_123'));

    const result = await service.resolveFromHeaders({
      cookieHeader: `${secureCookieName}=${signed}`,
    });

    expect(mockSessionFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { token: 'tok_raw_123' } }),
    );
    expect(result?.user.id).toBe('usr_1');
  });

  it('resolves a bearer session token', async () => {
    mockSessionFindUnique.mockResolvedValue(LIVE_ROW);

    const result = await service.resolveFromHeaders({
      authHeader: 'Bearer tok_raw_123',
    });

    expect(mockSessionFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { token: 'tok_raw_123' } }),
    );
    expect(result?.session.id).toBe('ses_1');
  });

  it('skips the DB lookup for JWT-shaped bearer tokens (Gideon path owns those)', async () => {
    const result = await service.resolveFromHeaders({
      authHeader: 'Bearer eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiIxMjMifQ.c2ln',
    });

    expect(mockSessionFindUnique).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });

  it('returns null for expired sessions', async () => {
    mockSessionFindUnique.mockResolvedValue({
      ...LIVE_ROW,
      expiresAt: new Date(NOW - 1_000),
    });

    const result = await service.resolveFromHeaders({
      cookieHeader: `${plainCookieName}=tok_old`,
    });

    expect(result).toBeNull();
  });

  it('returns null when no session row matches and when nothing is presented', async () => {
    mockSessionFindUnique.mockResolvedValue(null);

    await expect(
      service.resolveFromHeaders({
        cookieHeader: `${plainCookieName}=tok_missing`,
      }),
    ).resolves.toBeNull();
    await expect(service.resolveFromHeaders({})).resolves.toBeNull();
    expect(mockSessionFindUnique).toHaveBeenCalledTimes(1);
  });

  it('returns null (never throws) when the DB lookup fails', async () => {
    mockSessionFindUnique.mockRejectedValue(new Error('db down'));

    await expect(
      service.resolveFromHeaders({
        cookieHeader: `${plainCookieName}=tok_x`,
      }),
    ).resolves.toBeNull();
  });
});
