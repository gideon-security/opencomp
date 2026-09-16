import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  Logger,
  NotFoundException,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiExcludeController, ApiTags } from '@nestjs/swagger';
import { randomBytes } from 'node:crypto';
import type { Response } from 'express';
import { db } from '@db';
import { HybridAuthGuard } from './hybrid-auth.guard';
import { PlatformAdminGuard } from './platform-admin.guard';
import type { AuthenticatedRequest } from './types';
import { resolveActiveOrganizationId } from './gideon-oidc-provisioning';
import { SESSION_TTL_SECONDS, setSessionCookie } from './session-cookie';
import {
  BanUserDto,
  ImpersonateUserDto,
  ListUsersQueryDto,
  RevokeUserSessionsDto,
  UnbanUserDto,
} from './dto/admin.dto';

/**
 * Milestone 3 — native platform-admin endpoints (no better-auth admin plugin).
 *
 * Reimplements the used `admin()` plugin features as first-class endpoints
 * backed by the `User`/`Session` tables directly: impersonation, ban/unban,
 * user listing, and session revocation. The frontend migrates here from
 * `authClient.admin.*` in the deletion PR; until then both paths coexist.
 *
 * Excluded from the public OpenAPI/MCP surface (browser + internal admin UI
 * only). Gideon-JWT callers additionally require `aal >= 2` (§7 step 19).
 */
@ApiExcludeController()
@ApiTags('Admin')
@Controller({ path: 'admin', version: '1' })
@UseGuards(HybridAuthGuard, PlatformAdminGuard)
export class AdminController {
  private readonly logger = new Logger(AdminController.name);

  /** Gideon-JWT callers need phishing-resistant auth for admin actions. */
  private assertAdminAal(request: AuthenticatedRequest): void {
    if (!request.isGideonJwt) return;
    if (
      typeof request.gideonAal !== 'number' ||
      !Number.isFinite(request.gideonAal) ||
      request.gideonAal < 2
    ) {
      throw new ForbiddenException(
        'Admin actions require phishing-resistant authentication (aal >= 2)',
      );
    }
  }

  private async writeAuditLog({
    adminUserId,
    description,
    data,
  }: {
    adminUserId: string;
    description: string;
    data: Record<string, unknown>;
  }): Promise<void> {
    try {
      const organizationId = await resolveActiveOrganizationId(adminUserId);
      if (!organizationId) {
        this.logger.warn(
          `[Admin] Skipping audit log (no org for admin ${adminUserId}): ${description}`,
        );
        return;
      }
      await db.auditLog.create({
        data: {
          userId: adminUserId,
          memberId: null,
          organizationId,
          entityType: null,
          entityId: null,
          description: `[Platform Admin] ${description}`,
          data: {
            ...data,
            resource: 'admin',
            permission: 'platform-admin',
          },
        },
      });
    } catch (error) {
      this.logger.error('[Admin] Failed to write audit log:', error as Error);
    }
  }

  @Post('impersonate')
  @HttpCode(200)
  async impersonate(
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
    @Body() dto: ImpersonateUserDto,
  ): Promise<{ success: boolean; userId: string }> {
    this.assertAdminAal(req);
    const adminUserId = req.userId;
    if (!adminUserId) {
      throw new BadRequestException('Admin identity missing from request');
    }
    if (dto.userId === adminUserId) {
      throw new BadRequestException('Cannot impersonate yourself');
    }
    const target = await db.user.findUnique({
      where: { id: dto.userId },
      select: { id: true, email: true, banned: true },
    });
    if (!target) {
      throw new NotFoundException('User not found');
    }
    if (target.banned) {
      throw new ForbiddenException('Cannot impersonate a banned user');
    }

    const session = await db.session.create({
      data: {
        token: randomBytes(32).toString('hex'),
        userId: target.id,
        expiresAt: new Date(Date.now() + SESSION_TTL_SECONDS * 1000),
        activeOrganizationId: await resolveActiveOrganizationId(target.id),
        impersonatedBy: adminUserId,
      },
    });
    setSessionCookie({
      res,
      token: session.token,
      expiresAt: session.expiresAt,
    });

    await this.writeAuditLog({
      adminUserId,
      description: `Impersonated user ${target.email}`,
      data: {
        action: 'impersonate',
        method: 'POST',
        path: '/admin/impersonate',
        targetUserId: target.id,
      },
    });
    return { success: true, userId: target.id };
  }

  @Post('stop-impersonating')
  @HttpCode(200)
  async stopImpersonating(
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ success: boolean; activeOrganizationId: string | null }> {
    const adminUserId = req.impersonatedBy;
    if (!adminUserId) {
      throw new BadRequestException('No active impersonation session');
    }
    // Drop the impersonation session so its token cannot be reused.
    if (req.sessionId) {
      await db.session.deleteMany({ where: { id: req.sessionId } });
    }
    const session = await db.session.create({
      data: {
        token: randomBytes(32).toString('hex'),
        userId: adminUserId,
        expiresAt: new Date(Date.now() + SESSION_TTL_SECONDS * 1000),
        activeOrganizationId: await resolveActiveOrganizationId(adminUserId),
      },
    });
    setSessionCookie({
      res,
      token: session.token,
      expiresAt: session.expiresAt,
    });

    await this.writeAuditLog({
      adminUserId,
      description: 'Stopped impersonating a user',
      data: {
        action: 'stop-impersonating',
        method: 'POST',
        path: '/admin/stop-impersonating',
      },
    });
    // Return the restored session's org so the frontend can land back on the
    // admin surface without a second session read.
    return {
      success: true,
      activeOrganizationId: session.activeOrganizationId,
    };
  }

  @Post('ban')
  @HttpCode(200)
  async banUser(
    @Req() req: AuthenticatedRequest,
    @Body() dto: BanUserDto,
  ): Promise<{ success: boolean }> {
    this.assertAdminAal(req);
    const adminUserId = req.userId;
    if (!adminUserId) {
      throw new BadRequestException('Admin identity missing from request');
    }
    if (dto.userId === adminUserId) {
      throw new BadRequestException('Cannot ban yourself');
    }
    const target = await db.user.findUnique({
      where: { id: dto.userId },
      select: { id: true, email: true },
    });
    if (!target) {
      throw new NotFoundException('User not found');
    }
    await db.user.update({
      where: { id: target.id },
      data: {
        banned: true,
        ...(dto.reason ? { banReason: dto.reason } : {}),
        banExpires: null,
      },
    });
    // A ban must lock the user out immediately — drop every live session.
    await db.session.deleteMany({ where: { userId: target.id } });

    await this.writeAuditLog({
      adminUserId,
      description: `Banned user ${target.email}`,
      data: {
        action: 'ban',
        method: 'POST',
        path: '/admin/ban',
        targetUserId: target.id,
      },
    });
    return { success: true };
  }

  @Post('unban')
  @HttpCode(200)
  async unbanUser(
    @Req() req: AuthenticatedRequest,
    @Body() dto: UnbanUserDto,
  ): Promise<{ success: boolean }> {
    this.assertAdminAal(req);
    const adminUserId = req.userId;
    if (!adminUserId) {
      throw new BadRequestException('Admin identity missing from request');
    }
    const target = await db.user.findUnique({
      where: { id: dto.userId },
      select: { id: true, email: true },
    });
    if (!target) {
      throw new NotFoundException('User not found');
    }
    await db.user.update({
      where: { id: target.id },
      data: { banned: false, banReason: null, banExpires: null },
    });

    await this.writeAuditLog({
      adminUserId,
      description: `Unbanned user ${target.email}`,
      data: {
        action: 'unban',
        method: 'POST',
        path: '/admin/unban',
        targetUserId: target.id,
      },
    });
    return { success: true };
  }

  @Get('users')
  async listUsers(
    @Query() query: ListUsersQueryDto,
  ): Promise<{ data: Array<Record<string, unknown>> }> {
    const limit = query.limit ?? 20;
    const users = await db.user.findMany({
      where: query.search
        ? {
            OR: [
              { email: { contains: query.search, mode: 'insensitive' } },
              { name: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : undefined,
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        role: true,
        banned: true,
        emailVerified: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return { data: users };
  }

  @Delete('sessions')
  async revokeUserSessions(
    @Req() req: AuthenticatedRequest,
    @Body() dto: RevokeUserSessionsDto,
  ): Promise<{ success: boolean; revokedCount: number }> {
    this.assertAdminAal(req);
    const adminUserId = req.userId;
    if (!adminUserId) {
      throw new BadRequestException('Admin identity missing from request');
    }
    const target = await db.user.findUnique({
      where: { id: dto.userId },
      select: { id: true, email: true },
    });
    if (!target) {
      throw new NotFoundException('User not found');
    }
    const { count } = await db.session.deleteMany({
      where: { userId: target.id },
    });

    await this.writeAuditLog({
      adminUserId,
      description: `Revoked ${count} session(s) for ${target.email}`,
      data: {
        action: 'revoke-sessions',
        method: 'DELETE',
        path: '/admin/sessions',
        targetUserId: target.id,
        revokedCount: count,
      },
    });
    return { success: true, revokedCount: count };
  }
}
