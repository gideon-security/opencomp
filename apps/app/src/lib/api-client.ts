'use client';

import { env } from '@/env.mjs';
import { buildApiResponse, handleNetworkError, parseResponseBody, type ApiResponse } from './api-base';

export type { ApiResponse };

interface ApiCallOptions extends Omit<RequestInit, 'headers'> {
  organizationId?: string;
  headers?: Record<string, string>;
}

/**
 * API client for calling our internal NestJS API
 * Uses session cookies for authentication (via credentials: 'include')
 */
class ApiClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = env.NEXT_PUBLIC_API_URL || 'http://localhost:3333';
  }

  async call<T = unknown>(endpoint: string, options: ApiCallOptions = {}): Promise<ApiResponse<T>> {
    const { organizationId, headers: customHeaders, ...fetchOptions } = options;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...customHeaders,
    };

    if (organizationId) {
      headers['X-Organization-Id'] = organizationId;
    }

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        credentials: 'include',
        ...fetchOptions,
        headers,
      });

      const data = await parseResponseBody(response);
      return buildApiResponse<T>(data, response);
    } catch (error) {
      return handleNetworkError(error);
    }
  }

  /**
   * Raw request for non-JSON responses (e.g. PDF/markdown artifacts)
   */
  async raw(endpoint: string, options: ApiCallOptions = {}): Promise<Response> {
    const { organizationId, headers: customHeaders, ...fetchOptions } = options;

    const headers: Record<string, string> = {
      ...customHeaders,
    };

    if (organizationId) {
      headers['X-Organization-Id'] = organizationId;
    }

    return fetch(`${this.baseUrl}${endpoint}`, {
      credentials: 'include',
      ...fetchOptions,
      headers,
    });
  }

  async get<T = unknown>(endpoint: string, organizationId?: string): Promise<ApiResponse<T>> {
    return this.call<T>(endpoint, { method: 'GET', organizationId });
  }

  async post<T = unknown>(
    endpoint: string,
    body?: unknown,
    organizationId?: string,
  ): Promise<ApiResponse<T>> {
    return this.call<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
      organizationId,
    });
  }

  async put<T = unknown>(
    endpoint: string,
    body?: unknown,
    organizationId?: string,
  ): Promise<ApiResponse<T>> {
    return this.call<T>(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
      organizationId,
    });
  }

  async patch<T = unknown>(
    endpoint: string,
    body?: unknown,
    organizationId?: string,
  ): Promise<ApiResponse<T>> {
    return this.call<T>(endpoint, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
      organizationId,
    });
  }

  async delete<T = unknown>(
    endpoint: string,
    organizationId?: string,
    body?: unknown,
  ): Promise<ApiResponse<T>> {
    return this.call<T>(endpoint, {
      method: 'DELETE',
      body: body ? JSON.stringify(body) : undefined,
      organizationId,
    });
  }
}

// Export singleton instance
export const apiClient = new ApiClient();

// Convenience functions
export const api = {
  get: <T = unknown>(endpoint: string, organizationId?: string) =>
    apiClient.get<T>(endpoint, organizationId),

  post: <T = unknown>(endpoint: string, body?: unknown, organizationId?: string) =>
    apiClient.post<T>(endpoint, body, organizationId),

  put: <T = unknown>(endpoint: string, body?: unknown, organizationId?: string) =>
    apiClient.put<T>(endpoint, body, organizationId),

  patch: <T = unknown>(endpoint: string, body?: unknown, organizationId?: string) =>
    apiClient.patch<T>(endpoint, body, organizationId),

  delete: <T = unknown>(endpoint: string, organizationId?: string, body?: unknown) =>
    apiClient.delete<T>(endpoint, organizationId, body),

  raw: (
    endpoint: string,
    options?: Omit<ApiCallOptions, 'organizationId'> & { organizationId?: string },
  ) => apiClient.raw(endpoint, options),
};
