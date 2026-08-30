import { TriggerAuthContext, useRun } from '@gideon-defender/trigger-react';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TriggerProvider } from './trigger-provider';

const RUN_ID = 'run_123';

function createFetchMock() {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ id: RUN_ID, status: 'EXECUTING' }),
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('TriggerProvider', () => {
  it('provides its access token to useRun polling requests', async () => {
    const fetchMock = createFetchMock();
    vi.stubGlobal('fetch', fetchMock);

    function Wrapper({ children }: { children: ReactNode }) {
      return <TriggerProvider accessToken="provider-token">{children}</TriggerProvider>;
    }

    renderHook(() => useRun(RUN_ID, { refreshInterval: 60_000 }), { wrapper: Wrapper });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/trigger/runs/${RUN_ID}?accessToken=provider-token`,
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
    });
  });

  it('prefers explicitly supplied options over context values', async () => {
    const fetchMock = createFetchMock();
    vi.stubGlobal('fetch', fetchMock);

    function Wrapper({ children }: { children: ReactNode }) {
      return (
        <TriggerAuthContext.Provider
          value={{ accessToken: 'provider-token', baseURL: 'http://provider.local' }}
        >
          {children}
        </TriggerAuthContext.Provider>
      );
    }

    renderHook(
      () =>
        useRun(RUN_ID, {
          accessToken: 'explicit-token',
          baseURL: 'http://explicit.local',
          refreshInterval: 60_000,
        }),
      { wrapper: Wrapper },
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `http://explicit.local/api/trigger/runs/${RUN_ID}?accessToken=explicit-token`,
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
    });
  });
});
