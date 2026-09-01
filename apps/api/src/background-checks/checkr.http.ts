import {
  BadRequestException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { redactPathForLog } from './checkr.utils';

/**
 * Transport layer for the Checkr API: config, auth, and JSON fetching.
 * Keeps HTTP concerns out of CheckrClient so that file stays orchestration.
 */
export class CheckrHttp {
  protected readonly logger = new Logger('CheckrClient');

  protected apiKey(): string {
    const key = process.env.CHECKR_API_KEY;
    if (!key) {
      throw new BadRequestException(
        'Background check service is not configured. Contact support.',
      );
    }
    return key;
  }

  protected baseUrl(): string {
    const url =
      process.env.CHECKR_API_BASE_URL?.trim() || 'https://api.checkr.com';
    return url.replace(/\/+$/, '');
  }

  protected authHeader(): string {
    return `Basic ${Buffer.from(`${this.apiKey()}:`).toString('base64')}`;
  }

  protected async fetchCheckr(
    path: string,
    init: RequestInit,
  ): Promise<Response> {
    const url = `${this.baseUrl()}${path}`;
    try {
      return await fetch(url, {
        ...init,
        signal: init.signal ?? AbortSignal.timeout(30_000),
      });
    } catch (error) {
      // Log the path without its query string: searches carry PII
      // (candidate email in `?email=`).
      this.logger.error('Checkr network request failed', {
        path: redactPathForLog(path),
        error: error instanceof Error ? error.message : String(error),
      });
      throw new ServiceUnavailableException(
        'Checkr service is unreachable from the API server.',
      );
    }
  }

  /**
   * Throw for transient vendor failures (429/5xx) so callers surface 503
   * instead of 400. A 400 tells the caller the request was wrong; a 429 or
   * 5xx means "try again later" and must never terminalize a check as a
   * client error.
   */
  protected throwForTransientFailure(
    response: Response,
    context: string,
  ): void {
    if (
      response.status === 429 ||
      (response.status >= 500 && response.status <= 599)
    ) {
      this.logger.warn('Checkr transient failure', {
        context,
        status: response.status,
      });
      throw new ServiceUnavailableException(
        'Checkr service is temporarily unavailable.',
      );
    }
  }

  protected async readJson(response: Response): Promise<unknown> {
    const body = await response.text();
    if (!body) return null;
    try {
      return JSON.parse(body) as unknown;
    } catch {
      // Not JSON (proxy error page, gateway HTML). Return null so callers
      // treat the payload as missing instead of a valid response shape.
      return null;
    }
  }
}
