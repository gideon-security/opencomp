'use client';

import { apiClient } from '@/lib/api-client';
import { useCallback } from 'react';
import { useSWRConfig } from 'swr';

export function useRevokeAgentAccess() {
  const { mutate } = useSWRConfig();

  const revokeAgentAccess = useCallback(
    async (deviceId: string) => {
      const response = await apiClient.delete(`/v1/device-agent/sessions/${deviceId}`);
      if (response.error) {
        throw new Error(response.error);
      }
      await mutate((key) => Array.isArray(key) && key[0] === 'people-agent-devices');
    },
    [mutate],
  );

  return { revokeAgentAccess };
}
