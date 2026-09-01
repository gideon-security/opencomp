import { BadRequestException, Logger } from '@nestjs/common';

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
      this.logger.error('Checkr network request failed', {
        url,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new BadRequestException(
        'Checkr service is unreachable from the API server.',
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
