import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches } from 'class-validator';

/** Invitation IDs are prefixed CUIDs — reject query/hash smuggling. */
export const GIDEON_INVITE_CODE_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

export function isValidInviteCode(value: string | undefined): value is string {
  return typeof value === 'string' && GIDEON_INVITE_CODE_PATTERN.test(value);
}

export class GideonLoginQueryDto {
  @ApiPropertyOptional({
    description: 'Post-login path inside the app (must start with /)',
    example: '/',
  })
  @IsOptional()
  @IsString()
  redirectTo?: string;

  @ApiPropertyOptional({
    description: 'Invitation code to resume after login',
    example: 'inv_abc123',
  })
  @IsOptional()
  @IsString()
  @Matches(GIDEON_INVITE_CODE_PATTERN, {
    message: 'inviteCode must be an invitation ID',
  })
  inviteCode?: string;
}

export class GideonCallbackQueryDto {
  @ApiPropertyOptional({
    description: 'Authorization code issued by Gideon (absent on denial)',
  })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({
    description: 'State value from the login request (absent on denial)',
  })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional({ description: 'Issuer identifier echoed by Gideon' })
  @IsOptional()
  @IsString()
  iss?: string;

  @ApiPropertyOptional({ description: 'Authorization error code from Gideon' })
  @IsOptional()
  @IsString()
  error?: string;

  @ApiPropertyOptional({ description: 'Human-readable error details' })
  @IsOptional()
  @IsString()
  error_description?: string;

  @ApiPropertyOptional({
    description: 'Error detail URI from Gideon (RFC 6749 §5.2)',
  })
  @IsOptional()
  @IsString()
  error_uri?: string;

  @ApiPropertyOptional({
    description: 'Session state for OIDC session management (ignored)',
  })
  @IsOptional()
  @IsString()
  session_state?: string;
}
