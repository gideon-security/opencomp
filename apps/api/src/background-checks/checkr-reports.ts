import { CheckrHttp } from './checkr.http';
import { parseInvitationReportId } from './checkr.utils';

/**
 * Read path for the Checkr API: report/invitation fetches plus pointer
 * resolution. Separated from CheckrClient (creation flow) to keep both
 * files under the 300-line limit.
 */
export class CheckrReportsReader extends CheckrHttp {
  async getBackgroundCheck(
    identityBackgroundCheckId: string,
  ): Promise<unknown> {
    return this.getReport(identityBackgroundCheckId);
  }

  async getReport(reportId: string): Promise<unknown> {
    if (!reportId) return null;
    // Allow missing Checkr config to return null (for getById flow)
    const key = process.env.CHECKR_API_KEY;
    if (!key) return null;

    const res = await this.fetchCheckr(
      `/v1/reports/${encodeURIComponent(reportId)}`,
      {
        headers: { Authorization: this.authHeader() },
      },
    );

    if (res.status === 404) return null;
    if (!res.ok) {
      // Transient vendor errors (500/429/401) are not fatal: callers treat
      // a null report as "nothing to apply yet" and back off via
      // lastSyncedAt instead of 400ing reads and manual syncs.
      this.logger.warn('Checkr getReport failed', {
        reportId,
        status: res.status,
      });
      return null;
    }

    return this.readJson(res);
  }

  /** Fetch a Checkr invitation (null when missing or misconfigured). */
  async getInvitation(invitationId: string): Promise<unknown> {
    if (!invitationId) return null;
    const key = process.env.CHECKR_API_KEY;
    if (!key) return null;

    const res = await this.fetchCheckr(
      `/v1/invitations/${encodeURIComponent(invitationId)}`,
      {
        headers: { Authorization: this.authHeader() },
      },
    );

    if (res.status === 404) return null;
    if (!res.ok) return null;
    return this.readJson(res);
  }

  /**
   * Resolve the fetchable report for a row whose stored pointer may still
   * be an invitation id. Returns the report plus the id it was fetched
   * with, so callers can graduate a stale pointer.
   */
  async resolveReport({
    reportId,
    invitationId,
  }: {
    reportId: string;
    invitationId?: string | null;
  }): Promise<{ report: unknown; reportId: string }> {
    const report = await this.getReport(reportId);
    if (report) return { report, reportId };

    // The pointer is not a fetchable report yet — usually an invitation id
    // stored at creation. Ask the invitation whether a report exists now.
    if (invitationId) {
      const invitation = await this.getInvitation(invitationId);
      const graduatedId = parseInvitationReportId(invitation);
      if (graduatedId) {
        const graduated = await this.getReport(graduatedId);
        if (graduated) return { report: graduated, reportId: graduatedId };
      }
    }
    return { report: null, reportId };
  }
}
