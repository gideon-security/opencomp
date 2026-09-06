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
import { Public } from '../../auth/public.decorator';
import { getManifest } from '@gideon-defender/integration-platform';
import type { WebhookConfig } from '@gideon-defender/integration-platform';
import { ConnectionRepository } from '../repositories/connection.repository';
import { db, Prisma } from '@db';
import {
  headerValue,
  verifyHmacSignature,
} from '../../utils/webhook-signature';

type WebhookPayload = Record<string, unknown>;

/** Strip line breaks so attacker-controlled ids cannot forge log lines. */
function sanitizeForLog(value: string): string {
  return value.replace(/[\r\n]/g, '');
}

function getEventType(headers: Record<string, string>): string {
  return headers['x-github-event'] ?? headers['x-event-type'] ?? 'unknown';
}

@Controller({ path: 'integrations/webhooks', version: '1' })
@ApiTags('Webhook')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(private readonly connectionRepository: ConnectionRepository) {}

  @Post(':providerSlug/:connectionId')
  @Public()
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
      // Generic auth failure on purpose: a distinct 404 here would let an
      // unauthenticated caller enumerate valid connection ids.
      throw new HttpException(
        'Invalid webhook signature.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const webhookConfig = manifest.webhook;
    if (!webhookConfig.secretHeader || !webhookConfig.signatureAlgorithm) {
      // Fail closed: without an HMAC the route is world-writable — an
      // anonymous caller could forge runs and findings rows against any
      // connection id. A provider that cannot sign deliveries must not
      // expose this route.
      this.logger.warn(
        `Webhook provider ${sanitizeForLog(providerSlug)} has no signature config; rejecting unsigned delivery`,
      );
      throw new HttpException(
        'Invalid webhook signature.',
        HttpStatus.UNAUTHORIZED,
      );
    }
    const valid = this.verifySignature(req, headers, connection, webhookConfig);
    if (!valid) {
      throw new HttpException(
        'Invalid webhook signature.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    // Only checked after authentication: the status must not leak whether a
    // connection id is valid to callers without the secret.
    if (connection.status !== 'active') {
      throw new HttpException('Connection not active', HttpStatus.BAD_REQUEST);
    }

    return this.processWebhook(connectionId, body, headers, manifest);
  }

  private verifySignature(
    req: RawBodyRequest<Request>,
    headers: Record<string, string>,
    connection: { id: string; metadata: unknown },
    config: WebhookConfig,
  ): boolean {
    const { secretHeader, signatureAlgorithm } = config;
    if (!secretHeader || !signatureAlgorithm) return false;

    const signature = headerValue(headers, secretHeader);
    if (!signature) {
      this.logger.warn(`Missing ${secretHeader} header`);
      return false;
    }

    const metadata = connection?.metadata as Record<string, unknown> | null;
    const secret = metadata?.webhookSecret as string | undefined;
    if (!secret) {
      // Sanitize the attacker-controlled id before logging: a raw
      // interpolation would let %0a forge log lines.
      this.logger.warn(
        `No webhook secret for connection ${sanitizeForLog(connection.id)}`,
      );
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
