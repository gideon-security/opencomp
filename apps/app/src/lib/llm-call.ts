import { APICallError, generateObject } from 'ai';
import { logger } from '@gideon-defender/trigger-local';
import { sleep } from './utils';

/**
 * Wrapper around `generateObject` that protects the LLM provider from bursty
 * concurrent calls.
 *
 * Free-tier Gemini keys are throttled to a handful of requests per minute
 * (`generate_content_free_tier_requests`) and Google's edge can reset TLS
 * connections when a run fires dozens of calls at once (e.g. onboarding's
 * 15-way policy fan-out). This wrapper:
 *
 * 1. Bounds in-flight `generateObject` calls to `MAX_LLM_CONCURRENCY` (a
 *    process-wide semaphore shared by every caller), and
 * 2. Retries retryable failures (429, 5xx, network/TLS resets) with
 *    exponential backoff + jitter, honoring `Retry-After` when the provider
 *    sends it.
 */

const DEFAULT_MAX_CONCURRENCY = 4;
const DEFAULT_MAX_RETRIES = 5;
const BASE_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 60_000;

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const MAX_CONCURRENCY = parsePositiveInt(process.env.MAX_LLM_CONCURRENCY, DEFAULT_MAX_CONCURRENCY);
const MAX_RETRIES = parsePositiveInt(process.env.MAX_LLM_RETRIES, DEFAULT_MAX_RETRIES);

let active = 0;
const waiters: Array<() => void> = [];

async function acquire(): Promise<void> {
  if (active < MAX_CONCURRENCY) {
    active += 1;
    return;
  }
  await new Promise<void>((resolve) => {
    waiters.push(() => {
      active += 1;
      resolve();
    });
  });
}

function release(): void {
  active -= 1;
  const next = waiters.shift();
  if (next) next();
}

const NETWORK_ERROR_CODES = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'EAI_AGAIN',
  'EPIPE',
  'ENOTFOUND',
  'EPROTO',
]);

function isRetryableError(error: unknown): boolean {
  if (APICallError.isInstance(error)) {
    const status = error.statusCode;
    if (status === 429) return true;
    if (status !== undefined && status >= 500) return true;
    return error.isRetryable;
  }
  if (error instanceof Error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (typeof code === 'string' && NETWORK_ERROR_CODES.has(code)) return true;
    return /socket|tls|network|disconnected|timeout/i.test(error.message);
  }
  return false;
}

function retryAfterSecondsFromMessage(error: unknown): number | null {
  if (!(error instanceof Error)) return null;
  const match = /retry in ([\d.]+)s/i.exec(error.message);
  if (!match) return null;
  const seconds = Number(match[1]);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
}

function backoffDelayMs(error: unknown, attempt: number): number {
  const headerSeconds = APICallError.isInstance(error)
    ? Number(error.responseHeaders?.['retry-after'])
    : NaN;
  const candidates = [headerSeconds, retryAfterSecondsFromMessage(error)].filter(
    (s): s is number => s !== null && Number.isFinite(s) && s > 0,
  );
  if (candidates.length > 0) {
    return Math.min(candidates[0] * 1000, MAX_BACKOFF_MS);
  }
  const base = Math.min(BASE_BACKOFF_MS * 2 ** (attempt - 1), MAX_BACKOFF_MS);
  const jitter = Math.floor(Math.random() * base * 0.3);
  return base + jitter;
}

type GenerateObjectParams = Parameters<typeof generateObject>[0];
type GenerateObjectSchema = Extract<GenerateObjectParams, { schema: unknown }>['schema'];

export async function generateObjectWithRetry<SCHEMA extends GenerateObjectSchema>(
  options: Extract<Parameters<typeof generateObject<SCHEMA>>[0], { schema: unknown }> & {
    maxRetries?: number;
  },
): Promise<Awaited<ReturnType<typeof generateObject<SCHEMA>>>> {
  await acquire();
  try {
    let lastError: unknown;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
      try {
        return await generateObject<SCHEMA>({ ...options, maxRetries: 0 });
      } catch (error) {
        lastError = error;
        if (attempt === MAX_RETRIES || !isRetryableError(error)) {
          throw error;
        }
        const delayMs = backoffDelayMs(error, attempt);
        logger.warn(
          `LLM call failed (attempt ${attempt}/${MAX_RETRIES}); retrying in ${delayMs}ms`,
          { error: error instanceof Error ? error.message : String(error) },
        );
        await sleep(delayMs);
      }
    }
    throw lastError;
  } finally {
    release();
  }
}
