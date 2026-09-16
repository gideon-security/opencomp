import { apiClient } from '@/lib/api-client';

interface SignOutFromGideonOptions {
  /** Where to land after the session is revoked. Defaults to the login page. */
  redirectTo?: string;
}

/**
 * Gideon OIDC sign-out.
 *
 * POSTs to the API's logout endpoint (revokes Gideon tokens, deletes the
 * session row, clears the session cookie — cookies are sent via
 * `credentials: 'include'`), then hard-navigates away. A full page load
 * (not `router.push`) guarantees no stale authenticated client state
 * survives the sign-out.
 */
export async function signOutFromGideon(options: SignOutFromGideonOptions = {}): Promise<void> {
  const { redirectTo = '/auth' } = options;
  try {
    await apiClient.post('/v1/auth/gideon/logout');
  } catch {
    // Best-effort revocation: the session may already be gone (or the API
    // unreachable). Still navigate away — never strand the user.
  } finally {
    window.location.href = redirectTo;
  }
}
