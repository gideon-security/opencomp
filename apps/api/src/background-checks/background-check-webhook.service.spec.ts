/* eslint-disable @typescript-eslint/unbound-method -- spec references jest-mocked db methods directly; `this` scoping is not a concern for mocks */
import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { db, Prisma } from '@db';
import { createHmac } from 'node:crypto';
import { BackgroundCheckIdentityClient } from './background-check-identity.client';
import { BackgroundCheckPaymentService } from './background-check-payment.service';
import { BackgroundChecksService } from './background-checks.service';

jest.mock('@db', () => {
  class PrismaClientKnownRequestError extends Error {
    code: string;

    constructor(message: string, options: { code: string }) {
      super(message);
      this.code = options.code;
    }
  }

  return {
    Prisma: { PrismaClientKnownRequestError },
    BackgroundCheckStatus: { cancelled: 'cancelled' },
    db: {
      backgroundCheckRequest: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      backgroundCheckWebhookEvent: {
        create: jest.fn(),
      },
    },
  };
});

const mockedDb = db as jest.Mocked<typeof db>;

function mockAsync<T>(fn: unknown): jest.MockedFunction<() => Promise<T>> {
  return fn as jest.MockedFunction<() => Promise<T>>;
}

function makeCheckrSignature(rawBody: string): string {
  return createHmac('sha256', 'whsec_test').update(rawBody).digest('hex');
}

function webhookPayload(): {
  id: string;
  type: string;
  data: {
    object: string;
    id: string;
    status?: string;
    adjudication?: string;
    candidate_id?: string;
    metadata?: {
      compOrganizationId?: string;
      compMemberId?: string;
    };
  };
} {
  return {
    id: 'evt_1',
    type: 'report.completed',
    data: {
      object: 'report',
      id: 'check_1',
      status: 'consider',
      adjudication: 'engaged',
      candidate_id: 'cand_1',
    },
  };
}

describe('BackgroundChecksService webhooks', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      CHECKR_WEBHOOK_SECRET: 'whsec_test',
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('rejects invalid and stale webhook signatures', async () => {
    const service = new BackgroundChecksService(
      {} as unknown as BackgroundCheckIdentityClient,
      {} as unknown as BackgroundCheckPaymentService,
    );

    await expect(
      service.handleWebhook({
        rawBody: Buffer.from('{}'),
        headers: {
          'x-checkr-signature': 'bad',
        },
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    await expect(
      service.handleWebhook({
        rawBody: Buffer.from('{}'),
        headers: {},
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('updates status fields and report snapshots from webhook payloads', async () => {
    const payload = webhookPayload();
    const rawBody = JSON.stringify(payload);
    mockAsync<Awaited<ReturnType<typeof db.backgroundCheckRequest.findFirst>>>(
      mockedDb.backgroundCheckRequest.findFirst,
    ).mockResolvedValueOnce({
      id: 'bcr_1',
      employeeName: 'Ada',
      employeeEmail: 'old@example.com',
    } as Awaited<ReturnType<typeof db.backgroundCheckRequest.findFirst>>);
    mockAsync<
      Awaited<ReturnType<typeof db.backgroundCheckWebhookEvent.create>>
    >(mockedDb.backgroundCheckWebhookEvent.create).mockResolvedValueOnce(
      {} as Awaited<ReturnType<typeof db.backgroundCheckWebhookEvent.create>>,
    );
    const reportSnapshot = {
      identityVerification: { status: 'passed' },
      report: { flags: ['Manual review required'] },
    };
    const identityClient = {
      getBackgroundCheck: jest.fn().mockResolvedValue(reportSnapshot),
      getReport: jest.fn().mockResolvedValue(reportSnapshot),
    };
    const service = new BackgroundChecksService(
      identityClient as unknown as BackgroundCheckIdentityClient,
      {} as unknown as BackgroundCheckPaymentService,
    );

    await service.handleWebhook({
      rawBody: Buffer.from(rawBody),
      headers: {
        'x-checkr-signature': makeCheckrSignature(rawBody),
      },
    });

    // Checkr uses getReport for report fetches
    expect(identityClient.getReport).toHaveBeenCalledWith('check_1');
    expect(mockedDb.backgroundCheckRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'completed_with_flags',
          reportSnapshot,
          reportSyncedAt: expect.any(Date),
        }),
      }),
    );
  });

  it('updates terminal status when report snapshot fetch fails', async () => {
    const payload = webhookPayload();
    const rawBody = JSON.stringify(payload);
    mockAsync<Awaited<ReturnType<typeof db.backgroundCheckRequest.findFirst>>>(
      mockedDb.backgroundCheckRequest.findFirst,
    ).mockResolvedValueOnce({
      id: 'bcr_1',
      employeeName: 'Ada',
      employeeEmail: 'old@example.com',
    } as Awaited<ReturnType<typeof db.backgroundCheckRequest.findFirst>>);
    mockAsync<
      Awaited<ReturnType<typeof db.backgroundCheckWebhookEvent.create>>
    >(mockedDb.backgroundCheckWebhookEvent.create).mockResolvedValueOnce(
      {} as Awaited<ReturnType<typeof db.backgroundCheckWebhookEvent.create>>,
    );
    const identityClient = {
      getReport: jest.fn().mockRejectedValue(new Error('unavailable')),
    };
    const service = new BackgroundChecksService(
      identityClient as unknown as BackgroundCheckIdentityClient,
      {} as unknown as BackgroundCheckPaymentService,
    );

    await service.handleWebhook({
      rawBody: Buffer.from(rawBody),
      headers: {
        'x-checkr-signature': makeCheckrSignature(rawBody),
      },
    });

    expect(mockedDb.backgroundCheckRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({
          reportSnapshot: expect.anything(),
          reportSyncedAt: expect.anything(),
        }),
      }),
    );
  });

  it('does not fetch report snapshots for non-terminal webhooks', async () => {
    const payload = webhookPayload();
    payload.data.status = 'pending';
    payload.type = 'report.pending';
    const rawBody = JSON.stringify(payload);
    mockAsync<Awaited<ReturnType<typeof db.backgroundCheckRequest.findFirst>>>(
      mockedDb.backgroundCheckRequest.findFirst,
    ).mockResolvedValueOnce({
      id: 'bcr_1',
      employeeName: 'Ada',
      employeeEmail: 'old@example.com',
    } as Awaited<ReturnType<typeof db.backgroundCheckRequest.findFirst>>);
    mockAsync<
      Awaited<ReturnType<typeof db.backgroundCheckWebhookEvent.create>>
    >(mockedDb.backgroundCheckWebhookEvent.create).mockResolvedValueOnce(
      {} as Awaited<ReturnType<typeof db.backgroundCheckWebhookEvent.create>>,
    );
    const identityClient = {
      getBackgroundCheck: jest.fn(),
      getReport: jest.fn(),
    };
    const service = new BackgroundChecksService(
      identityClient as unknown as BackgroundCheckIdentityClient,
      {} as unknown as BackgroundCheckPaymentService,
    );

    await service.handleWebhook({
      rawBody: Buffer.from(rawBody),
      headers: {
        'x-checkr-signature': makeCheckrSignature(rawBody),
      },
    });

    expect(identityClient.getReport).not.toHaveBeenCalled();
    expect(identityClient.getBackgroundCheck).not.toHaveBeenCalled();
    expect(mockedDb.backgroundCheckRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'in_progress' }),
      }),
    );
  });

  it('does not change status when the local record is already cancelled', async () => {
    const payload = webhookPayload();
    const rawBody = JSON.stringify(payload);
    mockAsync<Awaited<ReturnType<typeof db.backgroundCheckRequest.findFirst>>>(
      mockedDb.backgroundCheckRequest.findFirst,
    ).mockResolvedValueOnce({
      id: 'bcr_1',
      status: 'cancelled',
      employeeName: 'Ada',
      employeeEmail: 'ada@example.com',
    } as Awaited<ReturnType<typeof db.backgroundCheckRequest.findFirst>>);
    mockAsync<
      Awaited<ReturnType<typeof db.backgroundCheckWebhookEvent.create>>
    >(mockedDb.backgroundCheckWebhookEvent.create).mockResolvedValueOnce(
      {} as Awaited<ReturnType<typeof db.backgroundCheckWebhookEvent.create>>,
    );
    const service = new BackgroundChecksService(
      {
        getBackgroundCheck: jest.fn(),
      } as unknown as BackgroundCheckIdentityClient,
      {} as unknown as BackgroundCheckPaymentService,
    );

    const result = await service.handleWebhook({
      rawBody: Buffer.from(rawBody),
      headers: {
        'x-checkr-signature': makeCheckrSignature(rawBody),
      },
    });

    expect(mockedDb.backgroundCheckWebhookEvent.create).toHaveBeenCalled();
    expect(mockedDb.backgroundCheckRequest.update).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: true });
  });

  it('skips the write on duplicate webhook events', async () => {
    const payload = webhookPayload();
    const rawBody = JSON.stringify(payload);
    mockAsync<Awaited<ReturnType<typeof db.backgroundCheckRequest.findFirst>>>(
      mockedDb.backgroundCheckRequest.findFirst,
    ).mockResolvedValueOnce({
      id: 'bcr_1',
      employeeName: 'Ada',
      employeeEmail: 'old@example.com',
    } as Awaited<ReturnType<typeof db.backgroundCheckRequest.findFirst>>);
    mockAsync<
      Awaited<ReturnType<typeof db.backgroundCheckWebhookEvent.create>>
    >(mockedDb.backgroundCheckWebhookEvent.create).mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('duplicate', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );
    const identityClient = {
      getReport: jest
        .fn()
        .mockResolvedValue({ status: 'completed_with_flags' }),
    };
    const service = new BackgroundChecksService(
      identityClient as unknown as BackgroundCheckIdentityClient,
      {} as unknown as BackgroundCheckPaymentService,
    );

    const result = await service.handleWebhook({
      rawBody: Buffer.from(rawBody),
      headers: {
        'x-checkr-signature': makeCheckrSignature(rawBody),
      },
    });

    expect(result).toEqual({ ok: true, duplicate: true });
    // A replay must not regress current state
    expect(mockedDb.backgroundCheckRequest.update).not.toHaveBeenCalled();
  });

  it('freezes terminal records when a stale in-flight event arrives', async () => {
    const payload = webhookPayload();
    payload.data.status = 'pending';
    payload.type = 'report.pending';
    const rawBody = JSON.stringify(payload);
    mockAsync<Awaited<ReturnType<typeof db.backgroundCheckRequest.findFirst>>>(
      mockedDb.backgroundCheckRequest.findFirst,
    ).mockResolvedValueOnce({
      id: 'bcr_1',
      status: 'completed',
      employeeName: 'Ada',
      employeeEmail: 'ada@example.com',
    } as Awaited<ReturnType<typeof db.backgroundCheckRequest.findFirst>>);
    mockAsync<
      Awaited<ReturnType<typeof db.backgroundCheckWebhookEvent.create>>
    >(mockedDb.backgroundCheckWebhookEvent.create).mockResolvedValueOnce(
      {} as Awaited<ReturnType<typeof db.backgroundCheckWebhookEvent.create>>,
    );
    const service = new BackgroundChecksService(
      {
        getBackgroundCheck: jest.fn(),
      } as unknown as BackgroundCheckIdentityClient,
      {} as unknown as BackgroundCheckPaymentService,
    );

    const result = await service.handleWebhook({
      rawBody: Buffer.from(rawBody),
      headers: {
        'x-checkr-signature': makeCheckrSignature(rawBody),
      },
    });

    expect(mockedDb.backgroundCheckWebhookEvent.create).toHaveBeenCalled();
    expect(mockedDb.backgroundCheckRequest.update).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: true });
  });

  it('does not overwrite the report pointer or status on status-less invitation events', async () => {
    const payload = webhookPayload();
    payload.type = 'invitation.created';
    payload.data.object = 'invitation';
    payload.data.id = 'inv_1';
    delete payload.data.status;
    delete payload.data.adjudication;
    const rawBody = JSON.stringify(payload);
    const findFirst = mockAsync<
      Awaited<ReturnType<typeof db.backgroundCheckRequest.findFirst>>
    >(mockedDb.backgroundCheckRequest.findFirst);
    findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: 'bcr_1',
      organizationId: 'org_1',
      memberId: 'mem_1',
      employeeName: 'Ada',
      employeeEmail: 'ada@example.com',
    } as Awaited<ReturnType<typeof db.backgroundCheckRequest.findFirst>>);
    mockAsync<
      Awaited<ReturnType<typeof db.backgroundCheckWebhookEvent.create>>
    >(mockedDb.backgroundCheckWebhookEvent.create).mockResolvedValueOnce(
      {} as Awaited<ReturnType<typeof db.backgroundCheckWebhookEvent.create>>,
    );
    const service = new BackgroundChecksService(
      {
        getReport: jest.fn(),
      } as unknown as BackgroundCheckIdentityClient,
      {} as unknown as BackgroundCheckPaymentService,
    );

    await service.handleWebhook({
      rawBody: Buffer.from(rawBody),
      headers: {
        'x-checkr-signature': makeCheckrSignature(rawBody),
      },
    });

    // Resolved via the candidate fallback, pointer and status left alone
    expect(findFirst).toHaveBeenNthCalledWith(1, {
      where: { identityBackgroundCheckId: 'inv_1' },
    });
    expect(findFirst).toHaveBeenNthCalledWith(2, {
      where: { checkrCandidateId: 'cand_1' },
    });
    expect(mockedDb.backgroundCheckRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          checkrCandidateId: 'cand_1',
        }),
      }),
    );
    const updateData = (mockedDb.backgroundCheckRequest.update as jest.Mock)
      .mock.calls[0][0].data;
    expect(updateData).not.toHaveProperty('identityBackgroundCheckId');
    expect(updateData).not.toHaveProperty('status');
  });

  it('does not terminalize the row on invitation events with report-like statuses', async () => {
    const payload = webhookPayload();
    payload.type = 'invitation.completed';
    payload.data.object = 'invitation';
    payload.data.id = 'inv_1';
    // Invitation "completed" means the candidate finished the form — the
    // report still has to arrive, so the row must stay in flight.
    payload.data.status = 'completed';
    delete payload.data.adjudication;
    const rawBody = JSON.stringify(payload);
    const findFirst = mockAsync<
      Awaited<ReturnType<typeof db.backgroundCheckRequest.findFirst>>
    >(mockedDb.backgroundCheckRequest.findFirst);
    findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: 'bcr_1',
      organizationId: 'org_1',
      memberId: 'mem_1',
      status: 'in_progress',
      employeeName: 'Ada',
      employeeEmail: 'ada@example.com',
    } as Awaited<ReturnType<typeof db.backgroundCheckRequest.findFirst>>);
    mockAsync<
      Awaited<ReturnType<typeof db.backgroundCheckWebhookEvent.create>>
    >(mockedDb.backgroundCheckWebhookEvent.create).mockResolvedValueOnce(
      {} as Awaited<ReturnType<typeof db.backgroundCheckWebhookEvent.create>>,
    );
    const service = new BackgroundChecksService(
      {
        getReport: jest.fn().mockResolvedValue(null),
      } as unknown as BackgroundCheckIdentityClient,
      {} as unknown as BackgroundCheckPaymentService,
    );

    await service.handleWebhook({
      rawBody: Buffer.from(rawBody),
      headers: {
        'x-checkr-signature': makeCheckrSignature(rawBody),
      },
    });

    expect(mockedDb.backgroundCheckRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ checkrCandidateId: 'cand_1' }),
      }),
    );
    const updateData = (mockedDb.backgroundCheckRequest.update as jest.Mock)
      .mock.calls[0][0].data;
    expect(updateData).not.toHaveProperty('status');
    expect(updateData).not.toHaveProperty('identityBackgroundCheckId');
  });

  it('keys dedup on report plus event type when the envelope has no id', async () => {
    const rawBody = JSON.stringify({
      data: { object: 'report', id: 'check_1', status: 'pending' },
    });
    mockAsync<Awaited<ReturnType<typeof db.backgroundCheckRequest.findFirst>>>(
      mockedDb.backgroundCheckRequest.findFirst,
    ).mockResolvedValueOnce({
      id: 'bcr_1',
      status: 'invited',
      employeeName: 'Ada',
      employeeEmail: 'ada@example.com',
    } as Awaited<ReturnType<typeof db.backgroundCheckRequest.findFirst>>);
    mockAsync<
      Awaited<ReturnType<typeof db.backgroundCheckWebhookEvent.create>>
    >(mockedDb.backgroundCheckWebhookEvent.create).mockResolvedValueOnce(
      {} as Awaited<ReturnType<typeof db.backgroundCheckWebhookEvent.create>>,
    );
    const service = new BackgroundChecksService(
      {} as unknown as BackgroundCheckIdentityClient,
      {} as unknown as BackgroundCheckPaymentService,
    );

    await service.handleWebhook({
      rawBody: Buffer.from(rawBody),
      headers: {
        'x-checkr-signature': makeCheckrSignature(rawBody),
      },
    });

    // A later report.completed for the same report must not dedup against
    // this report.updated delivery.
    expect(mockedDb.backgroundCheckWebhookEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventId: 'check_1:report.updated',
          eventType: 'report.updated',
        }),
      }),
    );
  });

  it('scopes the candidate fallback by metadata when Checkr echoes it', async () => {
    const payload = webhookPayload();
    payload.type = 'invitation.created';
    payload.data.object = 'invitation';
    payload.data.id = 'inv_9';
    delete payload.data.status;
    delete payload.data.adjudication;
    payload.data.metadata = {
      compOrganizationId: 'org_1',
      compMemberId: 'mem_1',
    };
    const rawBody = JSON.stringify(payload);
    const findFirst = mockAsync<
      Awaited<ReturnType<typeof db.backgroundCheckRequest.findFirst>>
    >(mockedDb.backgroundCheckRequest.findFirst);
    findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: 'bcr_1',
      organizationId: 'org_1',
      memberId: 'mem_1',
      employeeName: 'Ada',
      employeeEmail: 'ada@example.com',
    } as Awaited<ReturnType<typeof db.backgroundCheckRequest.findFirst>>);
    mockAsync<
      Awaited<ReturnType<typeof db.backgroundCheckWebhookEvent.create>>
    >(mockedDb.backgroundCheckWebhookEvent.create).mockResolvedValueOnce(
      {} as Awaited<ReturnType<typeof db.backgroundCheckWebhookEvent.create>>,
    );
    const service = new BackgroundChecksService(
      {
        getReport: jest.fn(),
      } as unknown as BackgroundCheckIdentityClient,
      {} as unknown as BackgroundCheckPaymentService,
    );

    await service.handleWebhook({
      rawBody: Buffer.from(rawBody),
      headers: {
        'x-checkr-signature': makeCheckrSignature(rawBody),
      },
    });

    expect(findFirst).toHaveBeenNthCalledWith(1, {
      where: { identityBackgroundCheckId: 'inv_9' },
    });
    expect(findFirst).toHaveBeenNthCalledWith(2, {
      where: {
        checkrCandidateId: 'cand_1',
        organizationId: 'org_1',
        memberId: 'mem_1',
      },
    });
  });

  it('rejects webhooks whose metadata points at another tenant', async () => {
    const payload = webhookPayload();
    payload.data.metadata = {
      compOrganizationId: 'org_other',
      compMemberId: 'mem_1',
    };
    const rawBody = JSON.stringify(payload);
    mockAsync<Awaited<ReturnType<typeof db.backgroundCheckRequest.findFirst>>>(
      mockedDb.backgroundCheckRequest.findFirst,
    ).mockResolvedValueOnce({
      id: 'bcr_1',
      organizationId: 'org_1',
      memberId: 'mem_1',
      employeeName: 'Ada',
      employeeEmail: 'ada@example.com',
    } as Awaited<ReturnType<typeof db.backgroundCheckRequest.findFirst>>);
    const service = new BackgroundChecksService(
      {} as unknown as BackgroundCheckIdentityClient,
      {} as unknown as BackgroundCheckPaymentService,
    );

    await expect(
      service.handleWebhook({
        rawBody: Buffer.from(rawBody),
        headers: {
          'x-checkr-signature': makeCheckrSignature(rawBody),
        },
      }),
    ).rejects.toThrow('organization mismatch');
    expect(mockedDb.backgroundCheckRequest.update).not.toHaveBeenCalled();
  });

  it('accepts webhook metadata that matches the resolved record', async () => {
    const payload = webhookPayload();
    payload.data.metadata = {
      compOrganizationId: 'org_1',
      compMemberId: 'mem_1',
    };
    const rawBody = JSON.stringify(payload);
    mockAsync<Awaited<ReturnType<typeof db.backgroundCheckRequest.findFirst>>>(
      mockedDb.backgroundCheckRequest.findFirst,
    ).mockResolvedValueOnce({
      id: 'bcr_1',
      organizationId: 'org_1',
      memberId: 'mem_1',
      employeeName: 'Ada',
      employeeEmail: 'ada@example.com',
    } as Awaited<ReturnType<typeof db.backgroundCheckRequest.findFirst>>);
    mockAsync<
      Awaited<ReturnType<typeof db.backgroundCheckWebhookEvent.create>>
    >(mockedDb.backgroundCheckWebhookEvent.create).mockResolvedValueOnce(
      {} as Awaited<ReturnType<typeof db.backgroundCheckWebhookEvent.create>>,
    );
    const identityClient = {
      getReport: jest.fn().mockResolvedValue({ status: 'clear' }),
    };
    const service = new BackgroundChecksService(
      identityClient as unknown as BackgroundCheckIdentityClient,
      {} as unknown as BackgroundCheckPaymentService,
    );

    await service.handleWebhook({
      rawBody: Buffer.from(rawBody),
      headers: {
        'x-checkr-signature': makeCheckrSignature(rawBody),
      },
    });

    expect(mockedDb.backgroundCheckRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'completed_with_flags' }),
      }),
    );
  });

  it('matches headers regardless of case', async () => {
    const payload = webhookPayload();
    const rawBody = JSON.stringify(payload);
    mockAsync<Awaited<ReturnType<typeof db.backgroundCheckRequest.findFirst>>>(
      mockedDb.backgroundCheckRequest.findFirst,
    ).mockResolvedValueOnce({
      id: 'bcr_1',
      employeeName: 'Ada',
      employeeEmail: 'old@example.com',
    } as Awaited<ReturnType<typeof db.backgroundCheckRequest.findFirst>>);
    mockAsync<
      Awaited<ReturnType<typeof db.backgroundCheckWebhookEvent.create>>
    >(mockedDb.backgroundCheckWebhookEvent.create).mockResolvedValueOnce(
      {} as Awaited<ReturnType<typeof db.backgroundCheckWebhookEvent.create>>,
    );
    const identityClient = {
      getReport: jest.fn().mockResolvedValue({ status: 'clear' }),
    };
    const service = new BackgroundChecksService(
      identityClient as unknown as BackgroundCheckIdentityClient,
      {} as unknown as BackgroundCheckPaymentService,
    );

    await service.handleWebhook({
      rawBody: Buffer.from(rawBody),
      headers: {
        'X-Checkr-Signature': makeCheckrSignature(rawBody),
        'X-Checkr-Event-Id': 'evt_cap',
        'X-Checkr-Event-Type': 'report.completed',
      },
    });

    expect(mockedDb.backgroundCheckWebhookEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ eventId: 'evt_cap' }),
      }),
    );
    expect(mockedDb.backgroundCheckRequest.update).toHaveBeenCalled();
  });

  it('rejects webhooks with a non-JSON body', async () => {
    const rawBody = 'not-json{{{';
    const service = new BackgroundChecksService(
      {} as unknown as BackgroundCheckIdentityClient,
      {} as unknown as BackgroundCheckPaymentService,
    );

    await expect(
      service.handleWebhook({
        rawBody: Buffer.from(rawBody),
        headers: {
          'x-checkr-signature': makeCheckrSignature(rawBody),
        },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects webhooks with an unrecognized Checkr status', async () => {
    const payload = webhookPayload();
    payload.data.status = 'frobnicated';
    const rawBody = JSON.stringify(payload);
    mockAsync<Awaited<ReturnType<typeof db.backgroundCheckRequest.findFirst>>>(
      mockedDb.backgroundCheckRequest.findFirst,
    ).mockResolvedValueOnce({
      id: 'bcr_1',
      employeeName: 'Ada',
      employeeEmail: 'old@example.com',
    } as Awaited<ReturnType<typeof db.backgroundCheckRequest.findFirst>>);
    const service = new BackgroundChecksService(
      {} as unknown as BackgroundCheckIdentityClient,
      {} as unknown as BackgroundCheckPaymentService,
    );

    await expect(
      service.handleWebhook({
        rawBody: Buffer.from(rawBody),
        headers: {
          'x-checkr-signature': makeCheckrSignature(rawBody),
        },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(mockedDb.backgroundCheckRequest.update).not.toHaveBeenCalled();
  });

  it('rejects webhooks whose report id matches no record', async () => {
    const payload = webhookPayload();
    const rawBody = JSON.stringify(payload);
    mockAsync<Awaited<ReturnType<typeof db.backgroundCheckRequest.findFirst>>>(
      mockedDb.backgroundCheckRequest.findFirst,
    ).mockResolvedValue(null);
    const service = new BackgroundChecksService(
      {} as unknown as BackgroundCheckIdentityClient,
      {} as unknown as BackgroundCheckPaymentService,
    );

    await expect(
      service.handleWebhook({
        rawBody: Buffer.from(rawBody),
        headers: {
          'x-checkr-signature': makeCheckrSignature(rawBody),
        },
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects webhooks with an invalid payload shape', async () => {
    const rawBody = JSON.stringify({ nonsense: true });
    const service = new BackgroundChecksService(
      {} as unknown as BackgroundCheckIdentityClient,
      {} as unknown as BackgroundCheckPaymentService,
    );

    await expect(
      service.handleWebhook({
        rawBody: Buffer.from(rawBody),
        headers: {
          'x-checkr-signature': makeCheckrSignature(rawBody),
        },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects webhooks with no raw body', async () => {
    const service = new BackgroundChecksService(
      {} as unknown as BackgroundCheckIdentityClient,
      {} as unknown as BackgroundCheckPaymentService,
    );

    await expect(
      service.handleWebhook({ rawBody: undefined, headers: {} }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
