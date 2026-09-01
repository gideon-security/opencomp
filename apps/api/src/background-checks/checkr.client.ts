import { BadRequestException, Injectable } from '@nestjs/common';
import {
  backgroundCheckStatuses,
  identityCreateResponseSchema,
  mapCheckrReportToStatus,
  type IdentityCreateResponse,
} from './background-checks.types';
import { CheckrReportsReader } from './checkr-reports';
import { isRecord, splitName } from './checkr.utils';

@Injectable()
export class CheckrClient extends CheckrReportsReader {
  private checkrPackage(): string {
    const pkg = process.env.CHECKR_PACKAGE?.trim();
    if (!pkg) {
      throw new BadRequestException(
        'Checkr package is not configured. Set CHECKR_PACKAGE.',
      );
    }
    return pkg;
  }

  async createBackgroundCheck(params: {
    organizationId: string;
    memberId: string;
    employeeName: string;
    employeeEmail: string;
    requesterEmail: string;
    idempotencyKey: string;
  }): Promise<IdentityCreateResponse> {
    const { first_name, last_name } = splitName(params.employeeName);
    const pkg = this.checkrPackage();

    // 1. Create candidate
    const candidateRes = await this.fetchCheckr('/v1/candidates', {
      method: 'POST',
      headers: {
        Authorization: this.authHeader(),
        'Content-Type': 'application/json',
        'Idempotency-Key': params.idempotencyKey,
      },
      body: JSON.stringify({
        email: params.employeeEmail,
        first_name,
        last_name,
        metadata: {
          compOrganizationId: params.organizationId,
          compMemberId: params.memberId,
          rerunCount: params.idempotencyKey,
        },
      }),
    });

    const candidateJson = await this.readJson(candidateRes);
    if (!candidateRes.ok) {
      // Handle duplicate candidate (409) by fetching existing
      if (candidateRes.status === 409) {
        const existing = await this.findCandidateByEmail(params.employeeEmail);
        const existingId =
          existing && typeof existing === 'object' && 'id' in existing
            ? existing.id
            : undefined;
        if (typeof existingId === 'string' && existingId) {
          return this.createReportForCandidate({
            candidateId: existingId,
            pkg,
            idempotencyKey: params.idempotencyKey,
          });
        }
        throw new BadRequestException(
          'Checkr reported a duplicate candidate but the lookup returned no candidate id.',
        );
      }
      this.logger.error('Checkr create candidate failed', {
        status: candidateRes.status,
      });
      throw new BadRequestException('Checkr candidate creation failed.');
    }

    const candidate = candidateJson as { id: string };
    if (!candidate?.id) {
      throw new BadRequestException(
        'Checkr candidate creation returned no id.',
      );
    }

    return this.createReportForCandidate({
      candidateId: candidate.id,
      pkg,
      idempotencyKey: params.idempotencyKey,
    });
  }

  private async createReportForCandidate({
    candidateId,
    pkg,
    idempotencyKey,
  }: {
    candidateId: string;
    pkg: string;
    idempotencyKey: string;
  }): Promise<IdentityCreateResponse> {
    // Prefer invitations (hosted flow) - Checkr recommends invitations for candidate-completed flow
    // Fall back to direct report if invitations not available for package
    const invitationRes = await this.fetchCheckr('/v1/invitations', {
      method: 'POST',
      headers: {
        Authorization: this.authHeader(),
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({
        candidate_id: candidateId,
        package: pkg,
      }),
    });

    const invitationJson = await this.readJson(invitationRes);
    if (invitationRes.ok && isRecord(invitationJson)) {
      const inv = invitationJson as {
        id?: string;
        invitation_url?: string;
        report_id?: string;
        report?: { id: string };
        status?: string;
      };
      // An invitation without a report id means the candidate has not
      // completed the flow yet. Store the invitation id as the placeholder:
      // it is unique per request (unlike the candidate id, which Checkr
      // shares across organizations for the same email and can never
      // resolve back to this row), and invitation webhooks carry it in
      // data.id so they resolve on first lookup.
      // The pointer graduates to the report id via getInvitation recovery
      // (sync/reconcile) or the first report webhook.
      const reportId = inv.report_id || inv.report?.id || inv.id;
      if (!reportId) {
        throw new BadRequestException('Checkr invitation returned no id.');
      }
      const status = this.toBackgroundCheckStatus(invitationJson);
      return identityCreateResponseSchema.parse({
        id: reportId,
        status,
        candidateUrl: inv.invitation_url ?? null,
        candidateId,
        invitationId: inv.id ?? null,
      });
    }

    if (invitationRes.ok) {
      this.logger.warn('Checkr invitation returned an unreadable payload', {
        status: invitationRes.status,
      });
    }

    // Fallback: direct report creation
    const reportRes = await this.fetchCheckr('/v1/reports', {
      method: 'POST',
      headers: {
        Authorization: this.authHeader(),
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({
        candidate_id: candidateId,
        package: pkg,
      }),
    });

    const reportJson = await this.readJson(reportRes);
    if (!reportRes.ok) {
      this.logger.error('Checkr create report/invitation failed', {
        invitationStatus: invitationRes.status,
        reportStatus: reportRes.status,
      });
      throw new BadRequestException('Checkr report creation failed.');
    }

    if (!isRecord(reportJson)) {
      this.logger.error(
        'Checkr report creation returned an unreadable payload',
        {
          reportStatus: reportRes.status,
        },
      );
      throw new BadRequestException('Checkr report creation failed.');
    }
    const report = reportJson as {
      id?: string;
      status?: string;
      adjudication?: string;
      candidate_id?: string;
    };
    if (typeof report.id !== 'string' || !report.id) {
      this.logger.error('Checkr report creation returned no id', {
        reportStatus: reportRes.status,
      });
      throw new BadRequestException('Checkr report creation failed.');
    }
    return identityCreateResponseSchema.parse({
      id: report.id,
      status: this.toBackgroundCheckStatus(report),
      candidateUrl: null,
      candidateId,
      invitationId: null,
    });
  }

  private async findCandidateByEmail(email: string): Promise<unknown> {
    const res = await this.fetchCheckr(
      `/v1/candidates?email=${encodeURIComponent(email)}`,
      {
        headers: { Authorization: this.authHeader() },
      },
    );
    if (!res.ok) return null;
    const json = await this.readJson(res);
    if (Array.isArray(json) && json.length > 0) return json[0];
    if (isRecord(json) && 'data' in json) {
      const data = (json as { data: unknown }).data;
      if (Array.isArray(data) && data.length > 0) return data[0];
    }
    return null;
  }

  private toBackgroundCheckStatus(report: unknown): string {
    const mapped = mapCheckrReportToStatus(report);
    if (
      (backgroundCheckStatuses as readonly string[]).includes(mapped) &&
      mapped !== ''
    ) {
      return mapped;
    }
    throw new BadRequestException(
      'Checkr returned a status this version does not recognize.',
    );
  }
}

// Backwards compat: keep old class name as alias
export class BackgroundCheckIdentityClient extends CheckrClient {}
