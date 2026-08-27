import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { AuthContext, OrganizationId } from '../auth/auth-context.decorator';
import { HybridAuthGuard } from '../auth/hybrid-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import type { AuthContext as AuthContextType } from '../auth/types';
import { SecretsService } from './secrets.service';

import { authEnvelope } from '@/utils/auth-response';
@ApiTags('Secrets')
@Controller({ path: 'secrets', version: '1' })
@UseGuards(HybridAuthGuard, PermissionGuard)
@ApiSecurity('apikey')
export class SecretsController {
  constructor(private readonly secretsService: SecretsService) {}

  @Get()
  @RequirePermission('secret', 'read')
  @ApiOperation({ summary: 'List all secrets (metadata only, no values)' })
  async listSecrets(
    @OrganizationId() organizationId: string,
    @AuthContext() authContext: AuthContextType,
  ) {
    const secrets = await this.secretsService.listSecrets(organizationId);

    return {
      data: secrets,
      count: secrets.length,
      ...authEnvelope(authContext),
    };
  }

  @Get(':id')
  @RequirePermission('secret', 'read')
  @ApiOperation({ summary: 'Get a secret with decrypted value' })
  @ApiParam({ name: 'id', description: 'Secret ID' })
  async getSecret(
    @Param('id') id: string,
    @OrganizationId() organizationId: string,
    @AuthContext() authContext: AuthContextType,
  ) {
    const secret = await this.secretsService.getSecret(id, organizationId);

    return {
      secret,
      ...authEnvelope(authContext),
    };
  }

  @Post()
  @RequirePermission('secret', 'create')
  @ApiOperation({ summary: 'Create a new secret' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['name', 'value'],
      properties: {
        name: { type: 'string' },
        value: { type: 'string' },
        description: { type: 'string', nullable: true },
        category: { type: 'string', nullable: true },
      },
    },
  })
  async createSecret(
    @Body()
    body: {
      name: string;
      value: string;
      description?: string;
      category?: string;
    },
    @OrganizationId() organizationId: string,
    @AuthContext() authContext: AuthContextType,
  ) {
    const secret = await this.secretsService.createSecret(organizationId, body);

    return {
      secret,
      ...authEnvelope(authContext),
    };
  }

  @Put(':id')
  @RequirePermission('secret', 'update')
  @ApiOperation({ summary: 'Update a secret' })
  @ApiParam({ name: 'id', description: 'Secret ID' })
  async updateSecret(
    @Param('id') id: string,
    @Body()
    body: {
      name?: string;
      value?: string;
      description?: string | null;
      category?: string | null;
    },
    @OrganizationId() organizationId: string,
    @AuthContext() authContext: AuthContextType,
  ) {
    const secret = await this.secretsService.updateSecret(
      id,
      organizationId,
      body,
    );

    return {
      secret,
      ...authEnvelope(authContext),
    };
  }

  @Delete(':id')
  @RequirePermission('secret', 'delete')
  @ApiOperation({ summary: 'Delete a secret' })
  @ApiParam({ name: 'id', description: 'Secret ID' })
  async deleteSecret(
    @Param('id') id: string,
    @OrganizationId() organizationId: string,
    @AuthContext() authContext: AuthContextType,
  ) {
    const result = await this.secretsService.deleteSecret(id, organizationId);

    return {
      ...result,
      ...authEnvelope(authContext),
    };
  }
}
