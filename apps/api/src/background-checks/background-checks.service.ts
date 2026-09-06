import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { db } from '@db';
import { CheckrClient } from './checkr.client';
import { BackgroundCheckPaymentService } from './background-check-payment.service';
import { handleCheckrWebhookRequest } from './background-check-webhook';
import { requestBackgroundCheckForMember } from './background-check-request';
import { syncBackgroundCheck } from './background-check-sync';
import {
  cancelForMember as cancelForMemberFn,
  deleteForMember as deleteForMemberFn,
  retryForMember as retryForMemberFn,
} from './background-check-retry';

@Injectable()
export class BackgroundChecksService {
  constructor(
    private readonly identityClient: CheckrClient,
    private readonly paymentService: BackgroundCheckPaymentService,
  ) {}

  async getForMember({
    organizationId,
    memberId,
  }: {
    organizationId: string;
    memberId: string;
  }) {
    return db.backgroundCheckRequest.findUnique({
      where: { organizationId_memberId: { organizationId, memberId } },
    });
  }

  async requestForMember({
    organizationId,
    memberId,
    employeeName,
    employeeEmail,
    requesterNotes,
  }: {
    organizationId: string;
    memberId: string;
    employeeName: string;
    employeeEmail: string;
    requesterNotes?: string;
  }) {
    return requestBackgroundCheckForMember({
      organizationId,
      memberId,
      employeeName,
      employeeEmail,
      requesterNotes,
      identityClient: this.identityClient,
      paymentService: this.paymentService,
      getForMember: (params) => this.getForMember(params),
    });
  }

  async getById({
    organizationId,
    id,
  }: {
    organizationId: string;
    id: string;
  }): Promise<{ record: unknown; identity?: unknown }> {
    const record = await db.backgroundCheckRequest.findFirst({
      where: {
        organizationId,
        OR: [{ id }, { identityBackgroundCheckId: id }],
      },
    });

    if (!record) {
      throw new NotFoundException('Background check not found.');
    }

    if (!record.identityBackgroundCheckId) {
      return { record };
    }

    const hasCheckrKey = !!process.env.CHECKR_API_KEY;
    if (!hasCheckrKey) {
      return { record };
    }

    // A vendor blip must not fail the read: degrade to the stored record
    // and let sync/reconcile heal it. Auth failures still surface — a bad
    // key never heals by waiting.
    // Plain test doubles only expose getReport.
    try {
      if (typeof this.identityClient.resolveReport === 'function') {
        const resolved = await this.identityClient.resolveReport({
          reportId: record.identityBackgroundCheckId,
          invitationId: record.checkrInvitationId ?? null,
        });
        return { record, identity: resolved.report };
      }
      const identity = await this.identityClient.getReport(
        record.identityBackgroundCheckId,
      );
      return { record, identity };
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      return { record };
    }
  }

  async syncForMember({
    organizationId,
    memberId,
  }: {
    organizationId: string;
    memberId: string;
  }): Promise<{ record: unknown; identity?: unknown; syncedAt: string }> {
    return syncBackgroundCheck({
      organizationId,
      memberId,
      identityClient: this.identityClient,
    });
  }

  async handleWebhook({
    rawBody,
    headers,
  }: {
    rawBody: Buffer | undefined;
    headers: Record<string, string | string[] | undefined>;
  }): Promise<{ ok: true; duplicate?: true }> {
    return handleCheckrWebhookRequest({
      rawBody,
      headers,
      identityClient: this.identityClient,
    });
  }

  async cancelForMember(params: { organizationId: string; memberId: string }) {
    return cancelForMemberFn({
      ...params,
      getForMember: (p) => this.getForMember(p),
    });
  }

  async retryForMember(params: { organizationId: string; memberId: string }) {
    return retryForMemberFn({
      ...params,
      identityClient: this.identityClient,
      getForMember: (p) => this.getForMember(p),
    });
  }

  async deleteForMember(params: { organizationId: string; memberId: string }) {
    return deleteForMemberFn({
      ...params,
      getForMember: (p) => this.getForMember(p),
    });
  }
}
