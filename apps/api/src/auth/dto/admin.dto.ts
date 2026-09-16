import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class ImpersonateUserDto {
  @ApiProperty({ description: 'ID of the user to impersonate' })
  @IsString()
  @MinLength(1)
  userId!: string;
}

export class BanUserDto {
  @ApiProperty({ description: 'ID of the user to ban' })
  @IsString()
  @MinLength(1)
  userId!: string;

  @ApiPropertyOptional({ description: 'Reason recorded on the ban' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class UnbanUserDto {
  @ApiProperty({ description: 'ID of the user to unban' })
  @IsString()
  @MinLength(1)
  userId!: string;
}

export class RevokeUserSessionsDto {
  @ApiProperty({ description: 'ID of the user whose sessions to revoke' })
  @IsString()
  @MinLength(1)
  userId!: string;
}

export class ListUsersQueryDto {
  @ApiPropertyOptional({ description: 'Substring match on email or name' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional({ description: 'Max users to return (1-100)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
