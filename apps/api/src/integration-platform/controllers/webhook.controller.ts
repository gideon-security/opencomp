import {
  Controller,
  Post,
  Param,
  Body,
  Headers,
  HttpException,
  HttpStatus,
  Logger,
  type RawBodyRequest,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { getManifest } from '@gideon-defender/integration-platform';
import type { WebhookConfig } from '@gideon-defender/integration-platform';
import { ConnectionRepository } from '../repositories/connection.repository';
import { db, Prisma } from '@db';
import {
  headerValue,
  verifyHmacSignature,
} from '../../utils/webhook-signature';

type WebhookPayload = Record<string, unknown>;

function getEventType(headers: Record<string, string>): string {
  return headers['x-github-event'] ?? headers['x-event-type'] ?? 'unknown';
}

@Controller({ path: 'integrations/webhooks', version: '1' })
@ApiTags('Webhook')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(private readonly connectionRepository: ConnectionRepository) {}

  @Post(':providerSlug/:connectionId')
  @ApiOperation({ summary: 'Receive a provider webhook event' })
  async handleWebhook(
    @Param('providerSlug') providerSlug: string,
    @Param('connectionId') connectionId: string,
    @Headers() headers: Record<string, string>,
    @Body() body: WebhookPayload,
    @Req() req: RawBodyRequest<Request>,
  ) {
    const manifest = getManifest(providerSlug);
    if (!manifest) {
      throw new HttpException(
        `Unknown provider: ${providerSlug}`,
        HttpStatus.NOT_FOUND,
      );
    }

    if (!manifest.capabilities.includes('webhook') || !manifest.webhook) {
      throw new HttpException(
        `${providerSlug} does not support webhooks`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const connection = await this.connectionRepository.findById(connectionId);
    if (!connection) {
      throw new HttpException('Connection not found', HttpStatus.NOT_FOUND);
    }

    if (connection.status !== 'active') {
      throw new HttpException('Connection not active', HttpStatus.BAD_REQUEST);
    }

    const webhookConfig = manifest.webhook;
    if (webhookConfig.secretHeader && webhookConfig.signatureAlgorithm) {
      const valid = await this.verifySignature(
        req,
        headers,
        connection.id,
        webhookConfig,
      );
      if (!valid) {
        throw new HttpException('Invalid signature', HttpStatus.UNAUTHORIZED);
      }
    }

    return this.processWebhook(connectionId, body, headers, manifest);
  }

  private async verifySignature(
    req: RawBodyRequest<Request>,
    headers: Record<string, string>,
    connectionId: string,
    config: WebhookConfig,
  ): Promise<boolean> {
    const { secretHeader, signatureAlgorithm } = config;
    if (!secretHeader || !signatureAlgorithm) return true;

    const signature = headerValue(headers, secretHeader);
    if (!signature) {
      this.logger.warn(`Missing ${secretHeader} header`);
      return false;
    }

    const connection = await this.connectionRepository.findById(connectionId);
    const metadata = connection?.metadata as Record<string, unknown> | null;
    const secret = metadata?.webhookSecret as string | undefined;
    if (!secret) {
      this.logger.warn(`No webhook secret for connection ${connectionId}`);
      return false;
    }

    const rawBody = req.rawBody;
    if (!rawBody) {
      this.logger.warn('Raw body unavailable');
      return false;
    }

    return verifyHmacSignature({
      rawBody,
      secret,
      providedSignature: signature,
      algorithm: signatureAlgorithm,
    });
  }

  private async processWebhook(
    connectionId: string,
    payload: WebhookPayload,
    headers: Record<string, string>,
    manifest: NonNullable<ReturnType<typeof getManifest>>,
  ): Promise<{ success: boolean; findingsCreated?: number }> {
    const eventType = getEventType(headers);

    if (manifest.handler?.handleWebhook) {
      const findings = await manifest.handler.handleWebhook(payload, headers);

      if (findings?.length) {
        const run = await db.integrationRun.create({
          data: {
            connectionId,
            jobType: 'webhook',
            status: 'success',
            startedAt: new Date(),
            completedAt: new Date(),
            findingsCount: findings.length,
            metadata: { eventType },
          },
        });

        await db.integrationPlatformFinding.createMany({
          data: findings.map((f) => ({
            runId: run.id,
            connectionId,
            resourceType: f.resourceType,
            resourceId: f.resourceId,
            title: f.title,
            description: f.description ?? '',
            severity: f.severity,
            status: 'open',
            remediation: f.remediation ?? '',
            rawPayload: (f.rawPayload ?? {}) as Prisma.InputJsonValue,
          })),
        });

        return { success: true, findingsCreated: findings.length };
      }
    }

    await db.integrationRun.create({
      data: {
        connectionId,
        jobType: 'webhook',
        status: 'success',
        startedAt: new Date(),
        completedAt: new Date(),
        findingsCount: 0,
        metadata: { eventType },
      },
    });

    return { success: true };
  }
}
