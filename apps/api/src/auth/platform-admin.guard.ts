import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  Optional,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { db } from '@db';
import { NativeSessionService } from './native-session.service';

interface PlatformAdminRequest {
  userId?: string;
  userEmail?: string;
  isPlatformAdmin?: boolean;
  sessionId?: string;
  impersonatedBy?: string;
  headers: {
    authorization?: string;
    cookie?: string;
    [key: string]: string | undefined;
  };
}

@Injectable()
export class PlatformAdminGuard implements CanActivate {
  constructor(
    // @Inject keeps the runtime token reference (see HybridAuthGuard).
    @Optional()
    @Inject(NativeSessionService)
    private readonly nativeSessionService?: NativeSessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<PlatformAdminRequest>();

    const authHeader = request.headers['authorization'];
    const cookieHeader = request.headers['cookie'];

    if (!authHeader && !cookieHeader) {
      throw new UnauthorizedException(
        'Platform admin routes require authentication',
      );
    }

    // Sessions resolve natively (direct Session-row lookup). Gideon OIDC
    // and legacy logins both mint plain Session rows, so every cookie or
    // bearer session token resolves here with no better-auth involved.
    if (this.nativeSessionService) {
      const native = await this.nativeSessionService.resolveFromHeaders({
        cookieHeader,
        authHeader,
      });
      if (native) {
        return this.activateForUser(request, native.user.id, {
          sessionId: native.session.id,
          impersonatedBy: native.session.impersonatedBy,
        });
      }
    }

    throw new UnauthorizedException('Invalid or expired session');
  }

  private async activateForUser(
    request: PlatformAdminRequest,
    userId: string,
    session: { sessionId?: string; impersonatedBy: string | null },
  ): Promise<boolean> {
    // Verify admin role from the database
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (user.role !== 'admin') {
      throw new ForbiddenException(
        'Access denied: Platform admin privileges required',
      );
    }

    // Set request context
    request.userId = user.id;
    request.userEmail = user.email;
    request.isPlatformAdmin = true;
    if (session.sessionId) {
      request.sessionId = session.sessionId;
    }
    if (session.impersonatedBy) {
      request.impersonatedBy = session.impersonatedBy;
    }

    return true;
  }
}
