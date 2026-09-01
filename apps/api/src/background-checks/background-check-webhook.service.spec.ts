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

  const request = {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  };
  const events = {
    create: jest.fn(),
    updateMany: jest.fn(),
    deleteMany: jest.fn(),
  };

  return {
    Prisma: { PrismaClientKnownRequestError },
    BackgroundCheckStatus: { cancelled: 'cancelled' },
    db: {
      backgroundCheckRequest: request,
      backgroundCheckWebhookEvent: events,
      // Run interactive transactions against the same mocks so the
      // terminal re-read and the guarded update stay observable.
      $transaction: (fn: (tx: unknown) => unknown) =>
        fn({
          backgroundCheckRequest: {
            findUnique: request.findUnique,
            update: request.update,
          },
        }),
    },
  };
});

const mockedDb = db as jest.Mocked<typeof db>;

function mockAsync<T>(fn: unknown): jest.MockedFunction<() => Promise<T>> {
  return fn as jest.MockedFunction<() => Promise<T>>;
}

/** Mock the transactional re-read inside processWebhookEvent. */
function mockTxRecord(record: Record<string, unknown>): void {
  (
    mockedDb.backgroundCheckRequest.findUnique as unknown as jest.Mock
  ).mockResolvedValueOnce(record);
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
    mockTxRecord({
      id: 'bcr_1',
      status: 'in_progress',
      employeeName: 'Ada',
      employeeEmail: 'old@example.com',
      identityBackgroundCheckId: 'check_1',
      checkrInvitationId: null,
    });
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
    mockTxRecord({
      id: 'bcr_1',
      status: 'in_progress',
      employeeName: 'Ada',
      employeeEmail: 'old@example.com',
      identityBackgroundCheckId: 'check_1',
      checkrInvitationId: null,
    });
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
    mockTxRecord({
      id: 'bcr_1',
      status: 'in_progress',
      employeeName: 'Ada',
      employeeEmail: 'old@example.com',
      identityBackgroundCheckId: 'check_1',
      checkrInvitationId: null,
    });
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

  it('does not fetch report snapshots for invitation completions on in-flight rows', async () => {
    const rawBody = JSON.stringify({
      id: 'evt_inv',
      type: 'invitation.completed',
      data: {
        object: 'invitation',
        id: 'inv_1',
        status: 'pending',
        candidate_id: 'cand_1',
      },
    });
    mockAsync<Awaited<ReturnType<typeof db.backgroundCheckRequest.findFirst>>>(
      mockedDb.backgroundCheckRequest.findFirst,
    ).mockResolvedValueOnce({
      id: 'bcr_1',
      employeeName: 'Ada',
      employeeEmail: 'ada@example.com',
    } as Awaited<ReturnType<typeof db.backgroundCheckRequest.findFirst>>);
    mockAsync<
      Awaited<ReturnType<typeof db.backgroundCheckWebhookEvent.create>>
    >(mockedDb.backgroundCheckWebhookEvent.create).mockResolvedValueOnce(
      {} as Awaited<ReturnType<typeof db.backgroundCheckWebhookEvent.create>>,
    );
    mockTxRecord({
      id: 'bcr_1',
      status: 'invited',
      employeeName: 'Ada',
      employeeEmail: 'ada@example.com',
      identityBackgroundCheckId: 'inv_1',
      checkrInvitationId: 'inv_1',
    });
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

    // Invitation completion is not report completion: no snapshot fetch, and
    // no snapshot persisted on the row.
    expect(identityClient.getReport).not.toHaveBeenCalled();
    expect(identityClient.getBackgroundCheck).not.toHaveBeenCalled();
    expect(mockedDb.backgroundCheckRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({
          reportSnapshot: expect.anything(),
        }),
      }),
    );
  });

  it('rejects deliveries older than the replay window before touching dedup', async () => {
    const payload = webhookPayload();
    (payload.data as { updatedAt?: number }).updatedAt =
      Math.floor(Date.now() / 1000) - 8 * 24 * 60 * 60;
    const rawBody = JSON.stringify(payload);
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
    ).rejects.toThrow('too old');
    // Rejected before the dedup insert: no event row, no marker to release.
    expect(mockedDb.backgroundCheckWebhookEvent.create).not.toHaveBeenCalled();
    expect(
      mockedDb.backgroundCheckWebhookEvent.deleteMany,
    ).not.toHaveBeenCalled();
  });

  it('applies deliveries inside the replay window and without timestamps', async () => {
    const payload = webhookPayload();
    (payload.data as { updatedAt?: number }).updatedAt =
      Math.floor(Date.now() / 1000) - 60;
    const rawBody = JSON.stringify(payload);
    mockAsync<Awaited<ReturnType<typeof db.backgroundCheckRequest.findFirst>>>(
      mockedDb.backgroundCheckRequest.findFirst,
    ).mockResolvedValueOnce({
      id: 'bcr_1',
      employeeName: 'Ada',
      employeeEmail: 'ada@example.com',
    } as Awaited<ReturnType<typeof db.backgroundCheckRequest.findFirst>>);
    mockAsync<
      Awaited<ReturnType<typeof db.backgroundCheckWebhookEvent.create>>
    >(mockedDb.backgroundCheckWebhookEvent.create).mockResolvedValueOnce(
      {} as Awaited<ReturnType<typeof db.backgroundCheckWebhookEvent.create>>,
    );
    mockTxRecord({
      id: 'bcr_1',
      status: 'in_progress',
      employeeName: 'Ada',
      employeeEmail: 'ada@example.com',
      identityBackgroundCheckId: 'check_1',
      checkrInvitationId: null,
    });
    const service = new BackgroundChecksService(
      {} as unknown as BackgroundCheckIdentityClient,
      {} as unknown as BackgroundCheckPaymentService,
    );

    const result = await service.handleWebhook({
      rawBody: Buffer.from(rawBody),
      headers: {
        'x-checkr-signature': makeCheckrSignature(rawBody),
      },
    });
    expect(result).toEqual({ ok: true });
  });

  it('does not change status when the local record is already cancelled', async () => {
    const payload = webhookPayload();
    const rawBody = JSON.stringify(payload);
    // The pre-insert snapshot is stale (in-flight) while the transactional
    // re-read sees the terminal row: only the re-read may freeze the write.
    mockAsync<Awaited<ReturnType<typeof db.backgroundCheckRequest.findFirst>>>(
      mockedDb.backgroundCheckRequest.findFirst,
    ).mockResolvedValueOnce({
      id: 'bcr_1',
      status: 'in_progress',
      employeeName: 'Ada',
      employeeEmail: 'ada@example.com',
    } as Awaited<ReturnType<typeof db.backgroundCheckRequest.findFirst>>);
    mockAsync<
      Awaited<ReturnType<typeof db.backgroundCheckWebhookEvent.create>>
    >(mockedDb.backgroundCheckWebhookEvent.create).mockResolvedValueOnce(
      {} as Awaited<ReturnType<typeof db.backgroundCheckWebhookEvent.create>>,
    );
    mockTxRecord({
      id: 'bcr_1',
      status: 'cancelled',
      employeeName: 'Ada',
      employeeEmail: 'ada@example.com',
      identityBackgroundCheckId: 'check_1',
      checkrInvitationId: null,
    });
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
    // No record lookup is mocked: the dedup insert runs before resolution,
    // so a replay never reaches the database lookup at all.
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
    expect(mockedDb.backgroundCheckRequest.findFirst).not.toHaveBeenCalled();
    expect(mockedDb.backgroundCheckRequest.update).not.toHaveBeenCalled();
  });

  it('freezes terminal records when a stale in-flight event arrives', async () => {
    const payload = webhookPayload();
    payload.data.status = 'pending';
    payload.type = 'report.pending';
    const rawBody = JSON.stringify(payload);
    // Stale pre-insert snapshot (in-flight) vs terminal transactional
    // re-read: dropping the re-read would let this event regress the row
    // to in_progress, so the test fails without the fix.
    mockAsync<Awaited<ReturnType<typeof db.backgroundCheckRequest.findFirst>>>(
      mockedDb.backgroundCheckRequest.findFirst,
    ).mockResolvedValueOnce({
      id: 'bcr_1',
      status: 'in_progress',
      employeeName: 'Ada',
      employeeEmail: 'ada@example.com',
    } as Awaited<ReturnType<typeof db.backgroundCheckRequest.findFirst>>);
    mockAsync<
      Awaited<ReturnType<typeof db.backgroundCheckWebhookEvent.create>>
    >(mockedDb.backgroundCheckWebhookEvent.create).mockResolvedValueOnce(
      {} as Awaited<ReturnType<typeof db.backgroundCheckWebhookEvent.create>>,
    );
    mockTxRecord({
      id: 'bcr_1',
      status: 'completed',
      employeeName: 'Ada',
      employeeEmail: 'ada@example.com',
      identityBackgroundCheckId: 'check_1',
      checkrInvitationId: null,
    });
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
    mockTxRecord({
      id: 'bcr_1',
      status: 'invited',
      employeeName: 'Ada',
      employeeEmail: 'ada@example.com',
      identityBackgroundCheckId: 'inv_1',
      checkrInvitationId: 'inv_1',
    });
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

    // Resolved via the metadata-scoped candidate fallback, pointer and
    // status left alone
    expect(findFirst).toHaveBeenNthCalledWith(1, {
      where: { identityBackgroundCheckId: 'inv_1' },
    });
    expect(findFirst).toHaveBeenNthCalledWith(2, {
      where: {
        checkrCandidateId: 'cand_1',
        organizationId: 'org_1',
        memberId: 'mem_1',
      },
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
      status: 'in_progress',
      employeeName: 'Ada',
      employeeEmail: 'ada@example.com',
    } as Awaited<ReturnType<typeof db.backgroundCheckRequest.findFirst>>);
    mockAsync<
      Awaited<ReturnType<typeof db.backgroundCheckWebhookEvent.create>>
    >(mockedDb.backgroundCheckWebhookEvent.create).mockResolvedValueOnce(
      {} as Awaited<ReturnType<typeof db.backgroundCheckWebhookEvent.create>>,
    );
    mockTxRecord({
      id: 'bcr_1',
      status: 'in_progress',
      employeeName: 'Ada',
      employeeEmail: 'ada@example.com',
      identityBackgroundCheckId: 'inv_1',
      checkrInvitationId: 'inv_1',
    });
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

  it('keys dedup on report plus event type and payload when the envelope has no id', async () => {
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
    mockTxRecord({
      id: 'bcr_1',
      status: 'invited',
      employeeName: 'Ada',
      employeeEmail: 'ada@example.com',
      identityBackgroundCheckId: 'check_1',
      checkrInvitationId: null,
    });
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
    // this report.updated delivery — and neither must a second
    // report.updated carrying a different state.
    const create = mockedDb.backgroundCheckWebhookEvent
      .create as unknown as jest.Mock;
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventId: expect.stringMatching(
            /^check_1:report\.updated:[0-9a-f]{16}$/,
          ),
          eventType: 'report.updated',
        }),
      }),
    );
    const firstKey = create.mock.calls[0][0].data.eventId as string;

    jest.clearAllMocks();
    const completedBody = JSON.stringify({
      data: { object: 'report', id: 'check_1', status: 'clear' },
    });
    mockAsync<Awaited<ReturnType<typeof db.backgroundCheckRequest.findFirst>>>(
      mockedDb.backgroundCheckRequest.findFirst,
    ).mockResolvedValueOnce({
      id: 'bcr_1',
      status: 'in_progress',
      employeeName: 'Ada',
      employeeEmail: 'ada@example.com',
    } as Awaited<ReturnType<typeof db.backgroundCheckRequest.findFirst>>);
    mockAsync<
      Awaited<ReturnType<typeof db.backgroundCheckWebhookEvent.create>>
    >(mockedDb.backgroundCheckWebhookEvent.create).mockResolvedValueOnce(
      {} as Awaited<ReturnType<typeof db.backgroundCheckWebhookEvent.create>>,
    );
    mockTxRecord({
      id: 'bcr_1',
      status: 'in_progress',
      employeeName: 'Ada',
      employeeEmail: 'ada@example.com',
      identityBackgroundCheckId: 'check_1',
      checkrInvitationId: null,
    });

    await service.handleWebhook({
      rawBody: Buffer.from(completedBody),
      headers: {
        'x-checkr-signature': makeCheckrSignature(completedBody),
      },
    });

    const secondKey = create.mock.calls[0][0].data.eventId as string;
    expect(secondKey).toContain('check_1:report.updated');
    expect(secondKey).not.toBe(firstKey);
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
    mockTxRecord({
      id: 'bcr_1',
      status: 'invited',
      employeeName: 'Ada',
      employeeEmail: 'ada@example.com',
      identityBackgroundCheckId: 'inv_9',
      checkrInvitationId: 'inv_9',
    });
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
    // Permanent failure keeps the poison marker: no marker release.
    expect(
      mockedDb.backgroundCheckWebhookEvent.deleteMany,
    ).not.toHaveBeenCalled();
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
    mockTxRecord({
      id: 'bcr_1',
      status: 'in_progress',
      organizationId: 'org_1',
      memberId: 'mem_1',
      employeeName: 'Ada',
      employeeEmail: 'ada@example.com',
      identityBackgroundCheckId: 'check_1',
      checkrInvitationId: null,
    });
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
    mockTxRecord({
      id: 'bcr_1',
      status: 'in_progress',
      employeeName: 'Ada',
      employeeEmail: 'old@example.com',
      identityBackgroundCheckId: 'check_1',
      checkrInvitationId: null,
    });
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

  it('acks unrecognized Checkr statuses without writing status', async () => {
    // Vendor drift must not wedge the webhook in a retry loop: unknown
    // statuses land on the status-less path and leave the row alone.
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
    mockAsync<
      Awaited<ReturnType<typeof db.backgroundCheckWebhookEvent.create>>
    >(mockedDb.backgroundCheckWebhookEvent.create).mockResolvedValueOnce(
      {} as Awaited<ReturnType<typeof db.backgroundCheckWebhookEvent.create>>,
    );
    mockTxRecord({
      id: 'bcr_1',
      status: 'in_progress',
      employeeName: 'Ada',
      employeeEmail: 'old@example.com',
      identityBackgroundCheckId: 'check_1',
      checkrInvitationId: null,
    });
    const service = new BackgroundChecksService(
      {} as unknown as BackgroundCheckIdentityClient,
      {} as unknown as BackgroundCheckPaymentService,
    );

    const result = await service.handleWebhook({
      rawBody: Buffer.from(rawBody),
      headers: {
        'x-checkr-signature': makeCheckrSignature(rawBody),
      },
    });

    expect(result).toEqual({ ok: true });
    expect(mockedDb.backgroundCheckRequest.update).toHaveBeenCalled();
    const updateData = (mockedDb.backgroundCheckRequest.update as jest.Mock)
      .mock.calls[0][0].data;
    expect(updateData).not.toHaveProperty('status');
  });

  it('releases the marker on unknown rows so a later retry reprocesses', async () => {
    const payload = webhookPayload();
    const rawBody = JSON.stringify(payload);
    mockAsync<Awaited<ReturnType<typeof db.backgroundCheckRequest.findFirst>>>(
      mockedDb.backgroundCheckRequest.findFirst,
    ).mockResolvedValue(null);
    mockAsync<
      Awaited<ReturnType<typeof db.backgroundCheckWebhookEvent.create>>
    >(mockedDb.backgroundCheckWebhookEvent.create).mockResolvedValueOnce(
      {} as Awaited<ReturnType<typeof db.backgroundCheckWebhookEvent.create>>,
    );
    const service = new BackgroundChecksService(
      {} as unknown as BackgroundCheckIdentityClient,
      {} as unknown as BackgroundCheckPaymentService,
    );

    // First delivery: the row is unknown, so the vendor-visible error stands
    // — but the marker is released instead of poisoned, because the row may
    // still land (a webhook that beat the request write).
    await expect(
      service.handleWebhook({
        rawBody: Buffer.from(rawBody),
        headers: {
          'x-checkr-signature': makeCheckrSignature(rawBody),
        },
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(
      mockedDb.backgroundCheckWebhookEvent.deleteMany,
    ).toHaveBeenCalledWith({ where: { eventId: 'evt_1' } });

    // The vendor retry reprocesses instead of acking duplicate: the row now
    // exists, so the event applies.
    mockAsync<Awaited<ReturnType<typeof db.backgroundCheckRequest.findFirst>>>(
      mockedDb.backgroundCheckRequest.findFirst,
    ).mockResolvedValueOnce({
      id: 'bcr_1',
      employeeName: 'Ada',
      employeeEmail: 'ada@example.com',
    } as Awaited<ReturnType<typeof db.backgroundCheckRequest.findFirst>>);
    mockAsync<
      Awaited<ReturnType<typeof db.backgroundCheckWebhookEvent.create>>
    >(mockedDb.backgroundCheckWebhookEvent.create).mockResolvedValueOnce(
      {} as Awaited<ReturnType<typeof db.backgroundCheckWebhookEvent.create>>,
    );
    mockTxRecord({
      id: 'bcr_1',
      status: 'invited',
      employeeName: 'Ada',
      employeeEmail: 'ada@example.com',
      identityBackgroundCheckId: 'check_1',
      checkrInvitationId: null,
    });

    const retry = await service.handleWebhook({
      rawBody: Buffer.from(rawBody),
      headers: {
        'x-checkr-signature': makeCheckrSignature(rawBody),
      },
    });
    expect(retry).toEqual({ ok: true });
    expect(mockedDb.backgroundCheckRequest.update).toHaveBeenCalled();
  });

  it('keeps the poison marker on tenant mismatches so retries ack as duplicate', async () => {
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
    mockAsync<
      Awaited<ReturnType<typeof db.backgroundCheckWebhookEvent.create>>
    >(mockedDb.backgroundCheckWebhookEvent.create).mockResolvedValueOnce(
      {} as Awaited<ReturnType<typeof db.backgroundCheckWebhookEvent.create>>,
    );
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
    // Permanent failure: the marker stays, so the retry acks duplicate.
    expect(
      mockedDb.backgroundCheckWebhookEvent.deleteMany,
    ).not.toHaveBeenCalled();
  });

  it('never resolves another tenant through the metadata-less candidate fallback', async () => {
    // A candidate id is shared across organizations for one email. Without
    // metadata there is no safe scoping, so the lookup must not run at all.
    const payload = webhookPayload();
    delete payload.data.metadata;
    const rawBody = JSON.stringify(payload);
    const findFirst = mockAsync<
      Awaited<ReturnType<typeof db.backgroundCheckRequest.findFirst>>
    >(mockedDb.backgroundCheckRequest.findFirst);
    findFirst.mockResolvedValue(null);
    mockAsync<
      Awaited<ReturnType<typeof db.backgroundCheckWebhookEvent.create>>
    >(mockedDb.backgroundCheckWebhookEvent.create).mockResolvedValueOnce(
      {} as Awaited<ReturnType<typeof db.backgroundCheckWebhookEvent.create>>,
    );
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

    // Only the direct lookup runs: no global candidate sweep, no member
    // sweep without a tenant.
    expect(findFirst).toHaveBeenCalledTimes(1);
    expect(findFirst).toHaveBeenCalledWith({
      where: { identityBackgroundCheckId: 'check_1' },
    });
  });

  it('graduates an invited row to the first report via the member fallback', async () => {
    const payload = webhookPayload();
    payload.type = 'report.completed';
    payload.data.object = 'report';
    payload.data.id = 'rep_9';
    payload.data.status = 'clear';
    delete payload.data.adjudication;
    delete payload.data.candidate_id;
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
      status: 'invited',
      employeeName: 'Ada',
      employeeEmail: 'ada@example.com',
    } as Awaited<ReturnType<typeof db.backgroundCheckRequest.findFirst>>);
    mockAsync<
      Awaited<ReturnType<typeof db.backgroundCheckWebhookEvent.create>>
    >(mockedDb.backgroundCheckWebhookEvent.create).mockResolvedValueOnce(
      {} as Awaited<ReturnType<typeof db.backgroundCheckWebhookEvent.create>>,
    );
    mockTxRecord({
      id: 'bcr_1',
      status: 'invited',
      employeeName: 'Ada',
      employeeEmail: 'ada@example.com',
      identityBackgroundCheckId: 'inv_1',
      checkrInvitationId: 'inv_1',
    });
    const service = new BackgroundChecksService(
      {
        getReport: jest
          .fn()
          .mockResolvedValue({ id: 'rep_9', status: 'clear' }),
      } as unknown as BackgroundCheckIdentityClient,
      {} as unknown as BackgroundCheckPaymentService,
    );

    await service.handleWebhook({
      rawBody: Buffer.from(rawBody),
      headers: {
        'x-checkr-signature': makeCheckrSignature(rawBody),
      },
    });

    // Indirect resolution against the invitation placeholder graduates the
    // pointer to the real report instead of stalling or 404ing.
    expect(findFirst).toHaveBeenNthCalledWith(2, {
      where: { organizationId: 'org_1', memberId: 'mem_1' },
    });
    expect(mockedDb.backgroundCheckRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          identityBackgroundCheckId: 'rep_9',
          status: 'completed',
        }),
      }),
    );
  });

  it('ignores a stale indirect report event after retry swapped the pointer', async () => {
    const payload = webhookPayload();
    payload.type = 'report.completed';
    payload.data.object = 'report';
    payload.data.id = 'rep_old';
    payload.data.status = 'clear';
    delete payload.data.adjudication;
    payload.data.metadata = {
      compOrganizationId: 'org_1',
      compMemberId: 'mem_1',
    };
    const rawBody = JSON.stringify(payload);
    mockAsync<Awaited<ReturnType<typeof db.backgroundCheckRequest.findFirst>>>(
      mockedDb.backgroundCheckRequest.findFirst,
    )
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'bcr_1',
        organizationId: 'org_1',
        memberId: 'mem_1',
        status: 'in_progress',
        employeeName: 'Ada',
        employeeEmail: 'ada@example.com',
        identityBackgroundCheckId: 'rep_new',
        checkrInvitationId: 'inv_1',
      } as Awaited<ReturnType<typeof db.backgroundCheckRequest.findFirst>>);
    mockAsync<
      Awaited<ReturnType<typeof db.backgroundCheckWebhookEvent.create>>
    >(mockedDb.backgroundCheckWebhookEvent.create).mockResolvedValueOnce(
      {} as Awaited<ReturnType<typeof db.backgroundCheckWebhookEvent.create>>,
    );
    // No transactional re-read is queued: the stale path acks before the
    // transaction, and an unconsumed mock would leak into later tests.
    const identityClient = {
      getReport: jest.fn(),
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

    // The row already points at the retry's fresh report: the late event
    // for the superseded report acks without touching pointer or status.
    expect(result).toEqual({ ok: true });
    expect(identityClient.getReport).not.toHaveBeenCalled();
    expect(mockedDb.backgroundCheckRequest.update).not.toHaveBeenCalled();
  });

  it('stays stale after retry even when the fresh pointer is an invitation id', async () => {
    const payload = webhookPayload();
    payload.type = 'report.completed';
    payload.data.object = 'report';
    payload.data.id = 'rep_old';
    payload.data.status = 'clear';
    delete payload.data.adjudication;
    payload.data.metadata = {
      compOrganizationId: 'org_1',
      compMemberId: 'mem_1',
    };
    const rawBody = JSON.stringify(payload);
    mockAsync<Awaited<ReturnType<typeof db.backgroundCheckRequest.findFirst>>>(
      mockedDb.backgroundCheckRequest.findFirst,
    )
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'bcr_1',
        organizationId: 'org_1',
        memberId: 'mem_1',
        status: 'in_progress',
        employeeName: 'Ada',
        employeeEmail: 'ada@example.com',
        identityBackgroundCheckId: 'inv_new',
        checkrInvitationId: 'inv_new',
        rerunCount: 1,
      } as Awaited<ReturnType<typeof db.backgroundCheckRequest.findFirst>>);
    mockAsync<
      Awaited<ReturnType<typeof db.backgroundCheckWebhookEvent.create>>
    >(mockedDb.backgroundCheckWebhookEvent.create).mockResolvedValueOnce(
      {} as Awaited<ReturnType<typeof db.backgroundCheckWebhookEvent.create>>,
    );
    // No transactional re-read is queued: the stale path acks before the
    // transaction, and an unconsumed mock would leak into later tests.
    const identityClient = {
      getReport: jest.fn(),
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

    // The retry swapped in a fresh invitation pointer: the late event for
    // the superseded report acks without rewinding the pointer.
    expect(result).toEqual({ ok: true });
    expect(identityClient.getReport).not.toHaveBeenCalled();
    expect(mockedDb.backgroundCheckRequest.update).not.toHaveBeenCalled();
  });

  it('marks an invited row failed when its invitation expires', async () => {
    const payload = webhookPayload();
    payload.type = 'invitation.expired';
    payload.data.object = 'invitation';
    payload.data.id = 'inv_1';
    payload.data.status = 'expired';
    delete payload.data.adjudication;
    delete payload.data.candidate_id;
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
      status: 'invited',
      employeeName: 'Ada',
      employeeEmail: 'ada@example.com',
      identityBackgroundCheckId: 'inv_1',
      checkrInvitationId: 'inv_1',
    } as Awaited<ReturnType<typeof db.backgroundCheckRequest.findFirst>>);
    mockAsync<
      Awaited<ReturnType<typeof db.backgroundCheckWebhookEvent.create>>
    >(mockedDb.backgroundCheckWebhookEvent.create).mockResolvedValueOnce(
      {} as Awaited<ReturnType<typeof db.backgroundCheckWebhookEvent.create>>,
    );
    mockTxRecord({
      id: 'bcr_1',
      status: 'invited',
      employeeName: 'Ada',
      employeeEmail: 'ada@example.com',
      identityBackgroundCheckId: 'inv_1',
      checkrInvitationId: 'inv_1',
    });
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

    // An expired invitation can never produce a report: the invited row
    // advances to failed so it can be retried instead of deadlocked.
    expect(mockedDb.backgroundCheckRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'failed' }),
      }),
    );
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
