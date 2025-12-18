// request-config.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request } from '../request';
import { AspiError } from '../error';
import * as Result from '../result';
import type { AspiRequestInit, RequestOptions } from '../types';
import { setupFetchMock, createMockResponse, createBaseConfig } from './utils';

setupFetchMock();

const createRequestOptions = (
  overrides?: Partial<RequestOptions<AspiRequestInit>>,
): RequestOptions<AspiRequestInit> => ({
  requestConfig: createBaseConfig(),
  middlewares: [],
  errorCbs: {},
  throwOnError: false,
  ...overrides,
});

describe('Request – fetch RequestInit configuration', () => {
  it('passes method correctly to fetch', async () => {
    const fetchMock = vi.mocked(global.fetch);
    fetchMock.mockResolvedValueOnce(createMockResponse({ success: true }));

    const req = new Request('POST', '/users', createRequestOptions());
    await req.json();

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.com/users',
      expect.objectContaining({
        method: 'POST',
      }),
    );
  });

  it('passes custom headers to fetch', async () => {
    const fetchMock = vi.mocked(global.fetch);
    fetchMock.mockResolvedValueOnce(createMockResponse({ success: true }));

    const req = new Request(
      'GET',
      '/users',
      createRequestOptions({
        requestConfig: {
          ...createBaseConfig(),
          headers: {
            'X-Custom-Header': 'custom-value',
            Authorization: 'Bearer token123',
          },
        },
      }),
    );

    await req.json();

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.com/users',
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Custom-Header': 'custom-value',
          Authorization: 'Bearer token123',
        }),
      }),
    );
  });

  it('passes credentials option to fetch', async () => {
    const fetchMock = vi.mocked(global.fetch);
    fetchMock.mockResolvedValueOnce(createMockResponse({ success: true }));

    const req = new Request(
      'GET',
      '/users',
      createRequestOptions({
        requestConfig: {
          ...createBaseConfig(),
          credentials: 'include',
        },
      }),
    );

    await req.json();

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.com/users',
      expect.objectContaining({
        credentials: 'include',
      }),
    );
  });

  it('passes mode option to fetch', async () => {
    const fetchMock = vi.mocked(global.fetch);
    fetchMock.mockResolvedValueOnce(createMockResponse({ success: true }));

    const req = new Request(
      'GET',
      '/users',
      createRequestOptions({
        requestConfig: {
          ...createBaseConfig(),
          mode: 'cors',
        },
      }),
    );

    await req.json();

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.com/users',
      expect.objectContaining({
        mode: 'cors',
      }),
    );
  });

  it('passes cache option to fetch', async () => {
    const fetchMock = vi.mocked(global.fetch);
    fetchMock.mockResolvedValueOnce(createMockResponse({ success: true }));

    const req = new Request(
      'GET',
      '/users',
      createRequestOptions({
        requestConfig: {
          ...createBaseConfig(),
          cache: 'no-cache',
        },
      }),
    );

    await req.json();

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.com/users',
      expect.objectContaining({
        cache: 'no-cache',
      }),
    );
  });

  it('passes redirect option to fetch', async () => {
    const fetchMock = vi.mocked(global.fetch);
    fetchMock.mockResolvedValueOnce(createMockResponse({ success: true }));

    const req = new Request(
      'GET',
      '/users',
      createRequestOptions({
        requestConfig: {
          ...createBaseConfig(),
          redirect: 'follow',
        },
      }),
    );

    await req.json();

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.com/users',
      expect.objectContaining({
        redirect: 'follow',
      }),
    );
  });

  it('passes referrer option to fetch', async () => {
    const fetchMock = vi.mocked(global.fetch);
    fetchMock.mockResolvedValueOnce(createMockResponse({ success: true }));

    const req = new Request(
      'GET',
      '/users',
      createRequestOptions({
        requestConfig: {
          ...createBaseConfig(),
          referrer: 'https://example.com/page',
        },
      }),
    );

    await req.json();

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.com/users',
      expect.objectContaining({
        referrer: 'https://example.com/page',
      }),
    );
  });

  it('passes referrerPolicy option to fetch', async () => {
    const fetchMock = vi.mocked(global.fetch);
    fetchMock.mockResolvedValueOnce(createMockResponse({ success: true }));

    const req = new Request(
      'GET',
      '/users',
      createRequestOptions({
        requestConfig: {
          ...createBaseConfig(),
          referrerPolicy: 'no-referrer',
        },
      }),
    );

    await req.json();

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.com/users',
      expect.objectContaining({
        referrerPolicy: 'no-referrer',
      }),
    );
  });

  it('passes integrity option to fetch', async () => {
    const fetchMock = vi.mocked(global.fetch);
    fetchMock.mockResolvedValueOnce(createMockResponse({ success: true }));

    const req = new Request(
      'GET',
      '/script.js',
      createRequestOptions({
        requestConfig: {
          ...createBaseConfig(),
          integrity:
            'sha384-oqVuAfXRKap7fdgcCY5uykM6+R9GqQ8K/uxy9rx7HNQlGYl1kPzQho1wx4JwY8wC',
        },
      }),
    );

    await req.json();

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.com/script.js',
      expect.objectContaining({
        integrity:
          'sha384-oqVuAfXRKap7fdgcCY5uykM6+R9GqQ8K/uxy9rx7HNQlGYl1kPzQho1wx4JwY8wC',
      }),
    );
  });

  it('passes keepalive option to fetch', async () => {
    const fetchMock = vi.mocked(global.fetch);
    fetchMock.mockResolvedValueOnce(createMockResponse({ success: true }));

    const req = new Request(
      'POST',
      '/analytics',
      createRequestOptions({
        requestConfig: {
          ...createBaseConfig(),
          keepalive: true,
        },
      }),
    );

    await req.json();

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.com/analytics',
      expect.objectContaining({
        keepalive: true,
      }),
    );
  });

  it('passes all RequestInit options together', async () => {
    const fetchMock = vi.mocked(global.fetch);
    fetchMock.mockResolvedValueOnce(createMockResponse({ success: true }));

    const req = new Request(
      'POST',
      '/users',
      createRequestOptions({
        requestConfig: {
          ...createBaseConfig(),
          headers: { 'Content-Type': 'application/json' },
          mode: 'cors',
          credentials: 'include',
          cache: 'no-cache',
          redirect: 'follow',
          referrerPolicy: 'no-referrer',
          keepalive: true,
        },
      }),
    );

    await req.bodyJson({ name: 'John' }).json();

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.com/users',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({ name: 'John' }),
        mode: 'cors',
        credentials: 'include',
        cache: 'no-cache',
        redirect: 'follow',
        referrerPolicy: 'no-referrer',
        keepalive: true,
      }),
    );
  });
});

describe('Request – AbortController and request cancellation', () => {
  it('passes AbortSignal from config to fetch', async () => {
    const fetchMock = vi.mocked(global.fetch);
    fetchMock.mockResolvedValueOnce(createMockResponse({ success: true }));

    const controller = new AbortController();
    const req = new Request(
      'GET',
      '/users',
      createRequestOptions({
        requestConfig: {
          ...createBaseConfig(),
          signal: controller.signal,
        },
      }),
    );

    await req.json();

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.com/users',
      expect.objectContaining({
        signal: controller.signal,
      }),
    );
  });

  it('handles request abortion before fetch completes', async () => {
    const controller = new AbortController();
    const abortError = new DOMException(
      'The user aborted a request.',
      'AbortError',
    );

    const fetchMock = vi.mocked(global.fetch);
    fetchMock.mockImplementation(() => {
      return new Promise((_, reject) => {
        setTimeout(() => reject(abortError), 100);
      });
    });

    const req = new Request(
      'GET',
      '/slow',
      createRequestOptions({
        requestConfig: {
          ...createBaseConfig(),
          signal: controller.signal,
        },
      }),
    ).withResult();

    // Abort immediately
    controller.abort();

    const result = await req.json();

    expect(Result.isErr(result)).toBe(true);
    if (Result.isErr(result)) {
      expect(result.error).toBeInstanceOf(AspiError);
      expect(result.error.message).toContain('aborted');
    }
  });

  it('aborts request during execution and returns error', async () => {
    const controller = new AbortController();

    const fetchMock = vi.mocked(global.fetch);
    fetchMock.mockImplementation(() => {
      // Simulate slow request
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          resolve(createMockResponse({ data: 'slow response' }));
        }, 1000);

        controller.signal.addEventListener('abort', () => {
          clearTimeout(timeout);
          reject(new DOMException('The user aborted a request.', 'AbortError'));
        });
      });
    });

    const req = new Request(
      'GET',
      '/slow',
      createRequestOptions({
        requestConfig: {
          ...createBaseConfig(),
          signal: controller.signal,
        },
      }),
    ).withResult();

    // Start request and abort after 50ms
    const requestPromise = req.json();

    setTimeout(() => {
      controller.abort();
    }, 50);

    const result = await requestPromise;

    expect(Result.isErr(result)).toBe(true);
  });

  it('does not make request if signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();

    const fetchMock = vi.mocked(global.fetch);
    fetchMock.mockRejectedValue(
      new DOMException('The user aborted a request.', 'AbortError'),
    );

    const req = new Request(
      'GET',
      '/users',
      createRequestOptions({
        requestConfig: {
          ...createBaseConfig(),
          signal: controller.signal,
        },
      }),
    ).withResult();

    const result = await req.json();

    expect(Result.isErr(result)).toBe(true);
    expect(fetchMock).toHaveBeenCalled();
  });

  it('handles AbortSignal.timeout for request timeouts', async () => {
    const fetchMock = vi.mocked(global.fetch);
    fetchMock.mockImplementation(() => {
      return new Promise((_, reject) => {
        setTimeout(() => {
          reject(new DOMException('The operation timed out.', 'AbortError'));
        }, 50);
      });
    });

    const timeoutSignal = AbortSignal.timeout(100);

    const req = new Request(
      'GET',
      '/slow',
      createRequestOptions({
        requestConfig: {
          ...createBaseConfig(),
          signal: timeoutSignal,
        },
      }),
    ).withResult();

    const result = await req.json();

    expect(Result.isErr(result)).toBe(true);
    if (Result.isErr(result)) {
      expect(result.error).toBeInstanceOf(AspiError);
    }
  });

  it('allows reusing same AbortController across multiple requests', async () => {
    const fetchMock = vi.mocked(global.fetch);
    // Resolve each fetch call with a fresh mock response
    fetchMock
      .mockResolvedValueOnce(createMockResponse({ success: true }))
      .mockResolvedValueOnce(createMockResponse({ success: true }));

    const controller = new AbortController();

    // Build two separate request option objects that share the same AbortSignal
    const baseConfig = { ...createBaseConfig(), signal: controller.signal };
    const config1 = createRequestOptions({ requestConfig: baseConfig });
    const config2 = createRequestOptions({ requestConfig: baseConfig });

    const req1 = new Request('GET', '/users/1', config1);
    const req2 = new Request('GET', '/users/2', config2);

    const [result1] = await req1.json();
    const [result2] = await req2.json();

    expect(result1).not.toBeNull();
    expect(result2).not.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('throws in throwable mode when request is aborted', async () => {
    const controller = new AbortController();

    const fetchMock = vi.mocked(global.fetch);
    fetchMock.mockImplementation(() => {
      return new Promise((_, reject) => {
        controller.signal.addEventListener('abort', () => {
          reject(new DOMException('The user aborted a request.', 'AbortError'));
        });
      });
    });

    const req = new Request(
      'GET',
      '/users',
      createRequestOptions({
        requestConfig: {
          ...createBaseConfig(),
          signal: controller.signal,
        },
      }),
    ).throwable();

    const requestPromise = req.json();
    controller.abort();

    await expect(requestPromise).rejects.toThrow();
  });

  it('returns tuple with error in default mode when aborted', async () => {
    const controller = new AbortController();

    const fetchMock = vi.mocked(global.fetch);
    fetchMock.mockRejectedValue(
      new DOMException('The user aborted a request.', 'AbortError'),
    );

    const req = new Request(
      'GET',
      '/users',
      createRequestOptions({
        requestConfig: {
          ...createBaseConfig(),
          signal: controller.signal,
        },
      }),
    );

    controller.abort();
    const [value, error] = await req.json();

    expect(value).toBeNull();
    expect(error).toBeInstanceOf(AspiError);
  });

  it('custom error handler is invoked when abort triggers 500 error', async () => {
    const controller = new AbortController();
    const handler = vi
      .fn()
      .mockReturnValue({ message: 'Request was cancelled' });

    const fetchMock = vi.mocked(global.fetch);
    fetchMock.mockRejectedValue(
      new DOMException('The user aborted a request.', 'AbortError'),
    );

    const req = new Request(
      'GET',
      '/users',
      createRequestOptions({
        requestConfig: {
          ...createBaseConfig(),
          signal: controller.signal,
        },
      }),
    )
      .withResult()
      .internalServerError(handler);

    controller.abort();
    const result = await req.json();

    expect(Result.isErr(result)).toBe(true);
    expect(handler).toHaveBeenCalled();
  });

  it('abort does not affect completed requests', async () => {
    const controller = new AbortController();

    const fetchMock = vi.mocked(global.fetch);
    fetchMock.mockResolvedValueOnce(createMockResponse({ id: 1 }));

    const req = new Request(
      'GET',
      '/users/1',
      createRequestOptions({
        requestConfig: {
          ...createBaseConfig(),
          signal: controller.signal,
        },
      }),
    ).withResult();

    const result = await req.json<{ id: number }>();

    // Abort after request completes
    controller.abort();

    expect(Result.isOk(result)).toBe(true);
    if (Result.isOk(result)) {
      expect(result.value.data.id).toBe(1);
    }
  });
});

describe('Request – signal with retry logic', () => {
  it('respects AbortSignal during retry attempts', async () => {
    const controller = new AbortController();

    const fetchMock = vi.mocked(global.fetch);
    let callCount = 0;

    fetchMock.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve(
          createMockResponse('Error', {
            status: 500,
            statusText: 'INTERNAL_SERVER_ERROR',
          }),
        );
      }
      return new Promise((_, reject) => {
        controller.signal.addEventListener('abort', () => {
          reject(new DOMException('The user aborted a request.', 'AbortError'));
        });
      });
    });

    const req = new Request(
      'GET',
      '/unstable',
      createRequestOptions({
        requestConfig: {
          ...createBaseConfig(),
          signal: controller.signal,
        },
        retryConfig: {
          retries: 3,
          retryDelay: 100,
          retryOn: [500],
        },
      }),
    ).withResult();

    const requestPromise = req.json();

    // Abort during retry
    setTimeout(() => controller.abort(), 50);

    const result = await requestPromise;

    expect(Result.isErr(result)).toBe(true);
    expect(callCount).toBeLessThan(3);
  });

  it('signal remains functional across all retry attempts', async () => {
    const controller = new AbortController();

    const fetchMock = vi.mocked(global.fetch);
    fetchMock
      .mockResolvedValueOnce(
        createMockResponse('Error', {
          status: 500,
          statusText: 'INTERNAL_SERVER_ERROR',
        }),
      )
      .mockResolvedValueOnce(
        createMockResponse('Error', {
          status: 500,
          statusText: 'INTERNAL_SERVER_ERROR',
        }),
      )
      .mockResolvedValueOnce(createMockResponse({ id: 1 }));

    const req = new Request(
      'GET',
      '/unstable',
      createRequestOptions({
        requestConfig: {
          ...createBaseConfig(),
          signal: controller.signal,
        },
        retryConfig: {
          retries: 3,
          retryDelay: 0,
          retryOn: [500],
        },
      }),
    ).withResult();

    const result = await req.json();

    expect(Result.isOk(result)).toBe(true);
    expect(controller.signal.aborted).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
