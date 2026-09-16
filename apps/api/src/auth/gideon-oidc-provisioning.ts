import { ForbiddenException, Logger } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { db } from '@db';
import { SESSION_TTL_SECONDS } from './session-cookie';

const logger = new Logger('GideonOidcProvisioning');

export interface ProvisionGideonUserParams {
  sub: string;
  email: string;
  name?: string;
  image?: string;
}

/**
 * Most-recent organization for a user — the shared `activeOrganizationId`
 * rule used by better-auth's session-creation hook (`auth.server.ts`) and
 * Gideon OIDC session minting so the two paths cannot drift.
 */
export async function resolveActiveOrganizationId(
  userId: string,
): Promise<string | null> {
  const org = await db.organization.findFirst({
    where: { members: { some: { userId } } },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });
  return org?.id ?? null;
}

/**
 * JIT find-or-create keyed by verified email, linked via `gideonSub`.
 * The email is lowercased + trimmed first, and the lookup is
 * case-insensitive: OIDC providers preserve the registrant's case but
 * legacy better-auth rows keep the originally typed case, so an exact
 * match on the normalized value would miss the link and create a
 * duplicate account.
 * A non-null conflicting `gideonSub` is rejected rather than overwritten
 * so a Gideon account can never hijack an unrelated OpenComp user.
 * A concurrent first login racing this one surfaces as P2002 — re-read and
 * fall through to the link path instead of failing the login. When the
 * conflict is on the `gideonSub` index instead (same Gideon account with
 * a changed email), adopt the new email on the linked row.
 */
export async function provisionGideonUser({
  sub,
  email,
  name,
  image,
}: ProvisionGideonUserParams) {
  const normalizedEmail = email.trim().toLowerCase();
  const existing = await db.user.findFirst({
    where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
  });
  if (existing) {
    return linkGideonSub({ sub, email: normalizedEmail, existing });
  }
  try {
    return await db.user.create({
      data: {
        email: normalizedEmail,
        emailVerified: true,
        name: name ?? normalizedEmail.split('@')[0] ?? normalizedEmail,
        ...(image ? { image } : {}),
        gideonSub: sub,
        lastLogin: new Date(),
      },
    });
  } catch (error) {
    if ((error as { code?: string }).code !== 'P2002') throw error;
    const raced = await db.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
    });
    if (raced) {
      return linkGideonSub({ sub, email: normalizedEmail, existing: raced });
    }
    const bySub = await db.user.findUnique({ where: { gideonSub: sub } });
    if (!bySub) throw error;
    if (bySub.banned) {
      throw new ForbiddenException('Account is disabled');
    }
    return db.user.update({
      where: { id: bySub.id },
      data: { email: normalizedEmail, lastLogin: new Date() },
    });
  }
}

async function linkGideonSub({
  sub,
  email,
  existing,
}: {
  sub: string;
  email: string;
  existing: { id: string; banned: boolean | null; gideonSub: string | null };
}) {
  if (existing.banned) {
    throw new ForbiddenException('Account is disabled');
  }
  if (existing.gideonSub && existing.gideonSub !== sub) {
    logger.warn(
      `Gideon sub mismatch for ${email} — not overwriting existing link`,
    );
    throw new ForbiddenException(
      'Gideon account is linked to a different user',
    );
  }
  try {
    return await db.user.update({
      where: { id: existing.id },
      data: {
        lastLogin: new Date(),
        ...(existing.gideonSub ? {} : { gideonSub: sub }),
      },
    });
  } catch (error) {
    if ((error as { code?: string }).code === 'P2002') {
      logger.warn(
        `Gideon sub already linked elsewhere for ${email} — rejecting`,
      );
      throw new ForbiddenException(
        'Gideon account is linked to a different user',
      );
    }
    throw error;
  }
}

/**
 * Mint a standard Session row, reusing the better-auth session-creation
 * hook behavior (most-recent org becomes activeOrganizationId).
 */
export async function mintGideonSession({
  userId,
  refreshToken,
}: {
  userId: string;
  refreshToken?: string;
}) {
  return db.session.create({
    data: {
      token: randomBytes(32).toString('hex'),
      userId,
      expiresAt: new Date(Date.now() + SESSION_TTL_SECONDS * 1000),
      activeOrganizationId: await resolveActiveOrganizationId(userId),
      ...(refreshToken ? { gideonRefreshToken: refreshToken } : {}),
    },
  });
}
