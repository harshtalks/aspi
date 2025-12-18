import { vi, beforeEach } from 'vitest';
import type { AspiRequestInit } from '../types';

export const setupFetchMock = () => {
  beforeEach(() => {
    global.fetch = vi.fn();
    vi.clearAllMocks();
  });
};

export const createMockResponse = <T>(
  data: T,
  options?: {
    status?: number;
    statusText?: string;
    headers?: Record<string, string>;
  },
): Response => {
  return new Response(JSON.stringify(data), {
    status: options?.status ?? 200,
    statusText: options?.statusText ?? 'OK',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
};

export const createBaseConfig = (): AspiRequestInit => ({
  baseUrl: 'https://api.example.com',
});
