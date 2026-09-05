import { BackgroundCheckIdentityClient } from './background-check-identity.client';

describe('BackgroundCheckIdentityClient (Checkr) idempotency', () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      CHECKR_API_KEY: 'checkr_test',
      CHECKR_PACKAGE: 'tasker_standard',
      CHECKR_API_BASE_URL: 'https://api.checkr.com',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
  });

  function mockFetchCheckr() {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        text: () =>
          Promise.resolve(
            JSON.stringify({ id: 'cand_1', email: 'ada@example.com' }),
          ),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: () =>
          Promise.resolve(
            JSON.stringify({
              id: 'rep_1',
              status: 'pending',
              invitation_url: 'https://checkr.com/invite',
            }),
          ),
      });
    global.fetch = fetchMock;
    return fetchMock;
  }

  const params = {
    organizationId: 'org_1',
    memberId: 'mem_1',
    employeeName: 'Ada',
    employeeEmail: 'ada@example.com',
    requesterEmail: 'admin@example.com',
  };

  it('creates Checkr candidate with Basic auth', async () => {
    const fetchMock = mockFetchCheckr();
    await new BackgroundCheckIdentityClient().createBackgroundCheck({
      ...params,
      idempotencyKey: 'comp-background-check:bcr_1',
    });
    const firstCall = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(firstCall[0]).toContain('/v1/candidates');
    const headers = firstCall[1]?.headers as Record<string, string>;
    expect(headers.Authorization).toBe(
      `Basic ${Buffer.from('checkr_test:').toString('base64')}`,
    );
  });

  it('stores the invitation id (not the shared candidate id) as the placeholder', async () => {
    const fetchMock = mockFetchCheckr();
    const result =
      await new BackgroundCheckIdentityClient().createBackgroundCheck({
        ...params,
        idempotencyKey: 'comp-background-check:bcr_1',
      });

    // The candidate id is shared across organizations for the same email,
    // while the invitation id is unique per request — so the placeholder
    // in the unique identityBackgroundCheckId column must be the latter.
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.id).toBe('rep_1');
    expect(result.candidateId).toBe('cand_1');
  });

  it('throws when the invitation returns no id instead of storing the candidate id', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        text: () =>
          Promise.resolve(
            JSON.stringify({ id: 'cand_1', email: 'ada@example.com' }),
          ),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ status: 'pending' })),
      });
    global.fetch = fetchMock;

    await expect(
      new BackgroundCheckIdentityClient().createBackgroundCheck({
        ...params,
        idempotencyKey: 'comp-background-check:bcr_1',
      }),
    ).rejects.toThrow('Checkr invitation returned no id.');
  });

  it('resolves a stale invitation-id pointer once the report exists', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: () => Promise.resolve(''),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: () =>
          Promise.resolve(JSON.stringify({ id: 'inv_1', report_id: 'rep_9' })),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: () =>
          Promise.resolve(JSON.stringify({ id: 'rep_9', status: 'clear' })),
      });
    global.fetch = fetchMock;

    const resolved = await new BackgroundCheckIdentityClient().resolveReport({
      reportId: 'inv_1',
      invitationId: 'inv_1',
    });

    expect(resolved.reportId).toBe('rep_9');
    expect(resolved.report).toEqual({ id: 'rep_9', status: 'clear' });
    expect(fetchMock.mock.calls[1][0]).toContain('/v1/invitations/inv_1');
  });

  it('returns null when neither the report nor the invitation has a report', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: () => Promise.resolve(''),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: () =>
          Promise.resolve(
            JSON.stringify({ id: 'inv_1', status: 'pending', report_id: null }),
          ),
      });
    global.fetch = fetchMock;

    const resolved = await new BackgroundCheckIdentityClient().resolveReport({
      reportId: 'inv_1',
      invitationId: 'inv_1',
    });

    expect(resolved).toEqual({ report: null, reportId: 'inv_1' });
  });

  it('handles per-attempt retry idempotency via candidate metadata', async () => {
    const fetchMock = mockFetchCheckr();
    await new BackgroundCheckIdentityClient().createBackgroundCheck({
      ...params,
      idempotencyKey: 'comp-background-check:bcr_1:2',
    });
    // Should still create candidate/invitation with rerunCount in metadata
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const firstBody = JSON.parse(
      (fetchMock.mock.calls[0][1] as RequestInit).body as string,
    );
    expect(firstBody.metadata.rerunCount).toBe('comp-background-check:bcr_1:2');
  });

  it('sends the idempotency key as a header on every Checkr write', async () => {
    const fetchMock = mockFetchCheckr();
    await new BackgroundCheckIdentityClient().createBackgroundCheck({
      ...params,
      idempotencyKey: 'comp-background-check:bcr_1',
    });
    for (const call of fetchMock.mock.calls) {
      const headers = (call[1] as RequestInit).headers as Record<
        string,
        string
      >;
      expect(headers['Idempotency-Key']).toBe('comp-background-check:bcr_1');
    }
  });

  it('recovers from a 409 duplicate candidate by creating a report for the existing candidate', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 409,
        text: () => Promise.resolve('{}'),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify([{ id: 'cand_existing' }])),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: () =>
          Promise.resolve(JSON.stringify({ id: 'inv_1', report_id: 'rep_9' })),
      });
    global.fetch = fetchMock;

    const result =
      await new BackgroundCheckIdentityClient().createBackgroundCheck({
        ...params,
        idempotencyKey: 'comp-background-check:bcr_1',
      });

    expect(result.id).toBe('rep_9');
    expect(result.candidateId).toBe('cand_existing');
    expect(result.invitationId).toBe('inv_1');
    const invitationBody = JSON.parse(
      (fetchMock.mock.calls[2][1] as RequestInit).body as string,
    );
    expect(invitationBody.candidate_id).toBe('cand_existing');
  });

  it('throws a clear error when the 409 lookup returns no candidate id', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 409,
        text: () => Promise.resolve('{}'),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify([])),
      });
    global.fetch = fetchMock;

    await expect(
      new BackgroundCheckIdentityClient().createBackgroundCheck({
        ...params,
        idempotencyKey: 'comp-background-check:bcr_1',
      }),
    ).rejects.toThrow('duplicate candidate');
  });

  it('falls back to direct report creation when invitations fail', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ id: 'cand_1' })),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 422,
        text: () => Promise.resolve('{}'),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: () =>
          Promise.resolve(
            JSON.stringify({ id: 'rep_direct', status: 'pending' }),
          ),
      });
    global.fetch = fetchMock;

    const result =
      await new BackgroundCheckIdentityClient().createBackgroundCheck({
        ...params,
        idempotencyKey: 'comp-background-check:bcr_1',
      });

    expect(fetchMock.mock.calls[2][0]).toContain('/v1/reports');
    expect(result.id).toBe('rep_direct');
    expect(result.status).toBe('in_progress');
  });

  it('rejects unrecognized Checkr statuses instead of mapping them backward', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ id: 'cand_1' })),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: () =>
          Promise.resolve(
            JSON.stringify({ id: 'inv_1', status: 'frobnicated' }),
          ),
      });
    global.fetch = fetchMock;

    await expect(
      new BackgroundCheckIdentityClient().createBackgroundCheck({
        ...params,
        idempotencyKey: 'comp-background-check:bcr_1',
      }),
    ).rejects.toThrow('does not recognize');
  });

  it('sends an empty last name for mononyms instead of duplicating the first name', async () => {
    const fetchMock = mockFetchCheckr();
    await new BackgroundCheckIdentityClient().createBackgroundCheck({
      ...params,
      employeeName: 'Madonna',
      idempotencyKey: 'comp-background-check:bcr_1',
    });

    const firstBody = JSON.parse(
      (fetchMock.mock.calls[0][1] as RequestInit).body as string,
    );
    expect(firstBody.first_name).toBe('Madonna');
    expect(firstBody.last_name).toBe('');
  });

  it('falls back to direct report creation when the invitation payload is unreadable', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ id: 'cand_1' })),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('<html>Bad Gateway</html>'),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: () =>
          Promise.resolve(
            JSON.stringify({ id: 'rep_direct', status: 'pending' }),
          ),
      });
    global.fetch = fetchMock;

    const result =
      await new BackgroundCheckIdentityClient().createBackgroundCheck({
        ...params,
        idempotencyKey: 'comp-background-check:bcr_1',
      });

    expect(fetchMock.mock.calls[2][0]).toContain('/v1/reports');
    expect(result.id).toBe('rep_direct');
    expect(result.status).toBe('in_progress');
  });
});
