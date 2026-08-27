export interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
  status: number;
}

export async function parseResponseBody(response: Response): Promise<unknown> {
  if (response.status === 204) return null;
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

export function buildApiResponse<T>(data: unknown, response: Response): ApiResponse<T> {
  const ok = response.ok;
  return {
    data: ok ? (data as T) : undefined,
    error: !ok
      ? ((data as Record<string, unknown>)?.message as string) ||
        ((data as Record<string, unknown>)?.error as string) ||
        `HTTP ${response.status}: ${response.statusText}`
      : undefined,
    status: response.status,
  };
}

export function handleNetworkError(error: unknown): ApiResponse<never> {
  return {
    error: error instanceof Error ? error.message : 'Network error',
    status: 0,
  };
}
