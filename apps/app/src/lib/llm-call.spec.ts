import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  process.env.MAX_LLM_CONCURRENCY = '2';
  process.env.MAX_LLM_RETRIES = '3';
});

const { generateObjectMock, FakeAPICallError } = vi.hoisted(() => {
  class FakeAPICallError extends Error {
    statusCode?: number;
    responseHeaders?: Record<string, string>;
    isRetryable: boolean;

    constructor({
      message,
      statusCode,
      responseHeaders,
      isRetryable = false,
    }: {
      message: string;
      statusCode?: number;
      responseHeaders?: Record<string, string>;
      isRetryable?: boolean;
    }) {
      super(message);
      this.statusCode = statusCode;
      this.responseHeaders = responseHeaders;
      this.isRetryable = isRetryable;
    }

    static isInstance(error: unknown): error is FakeAPICallError {
      return error instanceof FakeAPICallError;
    }
  }

  return { generateObjectMock: vi.fn(), FakeAPICallError };
});

vi.mock('ai', () => ({
  generateObject: generateObjectMock,
  APICallError: FakeAPICallError,
}));

vi.mock('@gideon-defender/trigger-local', () => ({
  logger: {
    debug() {},
    info() {},
    warn() {},
    error() {},
    log() {},
    flush() {
      return Promise.resolve();
    },
  },
}));

import { generateObjectWithRetry } from './llm-call';

beforeEach(() => {
  generateObjectMock.mockReset();
});

function callWithSchema() {
  const options = {
    model: { modelId: 'gemini-3.5-flash' },
    schema: { type: 'object' },
    system: 's',
    prompt: 'p',
  } as unknown as Parameters<typeof generateObjectWithRetry>[0];
  return generateObjectWithRetry(options);
}

describe('generateObjectWithRetry', () => {
  it('passes options through and returns the parsed object', async () => {
    generateObjectMock.mockResolvedValueOnce({ object: { ok: true } });

    const result = await callWithSchema();

    expect(generateObjectMock).toHaveBeenCalledTimes(1);
    expect(generateObjectMock.mock.calls[0][0]).toMatchObject({
      model: { modelId: 'gemini-3.5-flash' },
      maxRetries: 0,
    });
    expect(result.object).toEqual({ ok: true });
  });

  it('retries a 429 (rate limit) and succeeds on the next attempt', async () => {
    generateObjectMock
      .mockRejectedValueOnce(
        new FakeAPICallError({
          message: 'generate_content_free_tier_requests, limit: 5',
          statusCode: 429,
          responseHeaders: { 'retry-after': '0.05' },
        }),
      )
      .mockResolvedValueOnce({ object: { ok: true } });

    const result = await callWithSchema();

    expect(generateObjectMock).toHaveBeenCalledTimes(2);
    expect(result.object).toEqual({ ok: true });
  });

  it('retries a TLS/network reset error', async () => {
    generateObjectMock
      .mockRejectedValueOnce(
        new Error('Client network socket disconnected before secure TLS connection was established'),
      )
      .mockResolvedValueOnce({ object: { ok: true } });

    const result = await callWithSchema();

    expect(generateObjectMock).toHaveBeenCalledTimes(2);
    expect(result.object).toEqual({ ok: true });
  });

  it('throws immediately on non-retryable errors (4xx)', async () => {
    const badRequest = new FakeAPICallError({
      message: 'Bad request',
      statusCode: 400,
    });
    generateObjectMock.mockRejectedValueOnce(badRequest);

    await expect(callWithSchema()).rejects.toBe(badRequest);
    expect(generateObjectMock).toHaveBeenCalledTimes(1);
  });

  it('gives up after MAX_LLM_RETRIES attempts', async () => {
    generateObjectMock.mockRejectedValue(
      new FakeAPICallError({
        message: 'still throttled',
        statusCode: 429,
        responseHeaders: { 'retry-after': '0.01' },
      }),
    );

    await expect(callWithSchema()).rejects.toBeInstanceOf(FakeAPICallError);
    expect(generateObjectMock).toHaveBeenCalledTimes(3);
  });

  it('caps concurrent in-flight calls at MAX_LLM_CONCURRENCY', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    generateObjectMock.mockImplementation(async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 30));
      inFlight -= 1;
      return { object: { ok: true } };
    });

    await Promise.all([
      callWithSchema(),
      callWithSchema(),
      callWithSchema(),
      callWithSchema(),
    ]);

    expect(maxInFlight).toBeLessThanOrEqual(2);
    expect(generateObjectMock).toHaveBeenCalledTimes(4);
  });

  it('never exceeds the concurrency cap under a burst of callers', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    generateObjectMock.mockImplementation(async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, Math.floor(Math.random() * 10)));
      inFlight -= 1;
      return { object: { ok: true } };
    });

    await Promise.all(Array.from({ length: 60 }, () => callWithSchema()));

    expect(maxInFlight).toBeLessThanOrEqual(2);
    expect(generateObjectMock).toHaveBeenCalledTimes(60);
  });
});
