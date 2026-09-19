import { db } from '@db/server';

type SessionLike = {
  user?: { id?: string } | null;
} | null;

/**
 * Tenant is the org: an organization can only be created under the
 * Gideon-issued tenant id stamped on the caller's user row at login. There
 * is no second way to create organizations.
 *
 * Returns the tid, or a user-facing error when the user has none (caller
 * must sign in again with Gideon).
 */
export async function requireGideonTenantId(
  session: SessionLike,
): Promise<{ tenantId: string } | { error: string }> {
  const userId = session?.user?.id;
  if (!userId) {
    return { error: 'Not authorized.' };
  }
  const row = await db.user.findUnique({
    where: { id: userId },
    select: { gideonTenantId: true },
  });
  if (!row?.gideonTenantId) {
    return {
      error:
        'Organizations must be created from a Gideon-authenticated session. Please sign out and sign in again with Gideon.',
    };
  }
  return { tenantId: row.gideonTenantId };
}
