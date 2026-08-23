import { headers } from 'next/headers';
import { auth } from './auth';

const ALLOWED_DOMAIN = 'gideondefender.com';

export function isInternalUser(email: string): boolean {
  const parts = email.split('@');
  return parts.length === 2 && parts[1] === ALLOWED_DOMAIN;
}

export async function isAuthorized(): Promise<boolean> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) return false;

  return session.user.role === 'admin' && isInternalUser(session.user.email);
}
