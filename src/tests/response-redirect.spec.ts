// response-redirects.test.ts
import { describe, it, expect, vi } from 'vitest';
import { Request } from '../request';
import * as Result from '../result';
import type { AspiRequestInit, RequestOptions } from '../types';
import { setupFetchMock, createBaseConfig } from './utils';

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

describe('Response – 3xx Redirect status codes', () => {
  it('handles 301 Moved Permanently with automatic redirect', async () => {
    const finalData = { id: 1, name: 'John' };

    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(finalData), {
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const req = new Request(
      'GET',
      '/old-path',
      createRequestOptions({
        requestConfig: {
          ...createBaseConfig(),
          redirect: 'follow',
        },
      }),
    ).withResult();

    const result = await req.json<typeof finalData>();

    expect(Result.isOk(result)).toBe(true);
    if (Result.isOk(result)) {
      expect(result.value.data.id).toBe(1);
    }
  });

  it('handles 301 with manual redirect mode', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(null, {
        status: 301,
        statusText: 'Moved Permanently',
        headers: {
          Location: 'https://api.example.com/new-path',
        },
      }),
    );

    const req = new Request(
      'GET',
      '/old-path',
      createRequestOptions({
        requestConfig: {
          ...createBaseConfig(),
          redirect: 'manual',
        },
      }),
    ).withResult();

    const result = await req.json();

    expect(Result.isOk(result)).toBe(true);
    if (Result.isOk(result)) {
      expect(result.value.response.status).toBe(301);
      expect(result.value.response.response.headers.get('Location')).toBe(
        'https://api.example.com/new-path',
      );
    }
  });

  it('handles 302 Found (temporary redirect)', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(null, {
        status: 302,
        statusText: 'Found',
        headers: {
          Location: '/temporary-location',
        },
      }),
    );

    const req = new Request(
      'GET',
      '/resource',
      createRequestOptions({
        requestConfig: {
          ...createBaseConfig(),
          redirect: 'manual',
        },
      }),
    ).withResult();

    const result = await req.json();

    expect(Result.isOk(result)).toBe(true);
    if (Result.isOk(result)) {
      expect(result.value.response.status).toBe(302);
      expect(result.value.response.response.headers.get('Location')).toBe(
        '/temporary-location',
      );
    }
  });

  it('handles 303 See Other (redirect to GET)', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(null, {
        status: 303,
        statusText: 'See Other',
        headers: {
          Location: '/result',
        },
      }),
    );

    const req = new Request(
      'POST',
      '/submit',
      createRequestOptions({
        requestConfig: {
          ...createBaseConfig(),
          redirect: 'manual',
        },
      }),
    ).withResult();

    const result = await req.json();

    expect(Result.isOk(result)).toBe(true);
    if (Result.isOk(result)) {
      expect(result.value.response.status).toBe(303);
      expect(result.value.response.response.headers.get('Location')).toBe(
        '/result',
      );
    }
  });

  it('handles 307 Temporary Redirect (preserves method)', async () => {
    const postData = { action: 'submit' };

    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(null, {
        status: 307,
        statusText: 'Temporary Redirect',
        headers: {
          Location: 'https://api.example.com/new-endpoint',
        },
      }),
    );

    const req = new Request(
      'POST',
      '/endpoint',
      createRequestOptions({
        requestConfig: {
          ...createBaseConfig(),
          redirect: 'manual',
        },
      }),
    )
      .bodyJson(postData)
      .withResult();

    const result = await req.json();

    expect(Result.isOk(result)).toBe(true);
    if (Result.isOk(result)) {
      expect(result.value.response.status).toBe(307);
      expect(result.value.response.response.headers.get('Location')).toContain(
        'new-endpoint',
      );
      expect(result.value.request.requestInit.method).toBe('POST');
    }
  });

  it('handles 308 Permanent Redirect (preserves method)', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(null, {
        status: 308,
        statusText: 'Permanent Redirect',
        headers: {
          Location: 'https://api.example.com/permanent-location',
        },
      }),
    );

    const req = new Request(
      'PUT',
      '/resource',
      createRequestOptions({
        requestConfig: {
          ...createBaseConfig(),
          redirect: 'manual',
        },
      }),
    ).withResult();

    const result = await req.json();

    expect(Result.isOk(result)).toBe(true);
    if (Result.isOk(result)) {
      expect(result.value.response.status).toBe(308);
      expect(result.value.response.response.headers.get('Location')).toContain(
        'permanent-location',
      );
      expect(result.value.request.requestInit.method).toBe('PUT');
    }
  });

  it('handles 301 with error redirect mode', async () => {
    const fetchMock = vi.mocked(global.fetch);
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    const req = new Request(
      'GET',
      '/old-path',
      createRequestOptions({
        requestConfig: {
          ...createBaseConfig(),
          redirect: 'error',
        },
      }),
    ).withResult();

    const result = await req.json();

    expect(Result.isErr(result)).toBe(true);
  });

  it('follows multiple redirects with follow mode', async () => {
    const finalData = { id: 1, message: 'Final destination' };

    // Fetch automatically follows redirects in 'follow' mode
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(finalData), {
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const req = new Request(
      'GET',
      '/redirect-chain',
      createRequestOptions({
        requestConfig: {
          ...createBaseConfig(),
          redirect: 'follow',
        },
      }),
    ).withResult();

    const result = await req.json<typeof finalData>();

    expect(Result.isOk(result)).toBe(true);
    if (Result.isOk(result)) {
      expect(result.value.data.message).toBe('Final destination');
    }
  });

  it('handles 301 with relative Location header', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(null, {
        status: 301,
        statusText: 'Moved Permanently',
        headers: {
          Location: '/users/new-id',
        },
      }),
    );

    const req = new Request(
      'GET',
      '/users/old-id',
      createRequestOptions({
        requestConfig: {
          ...createBaseConfig(),
          redirect: 'manual',
        },
      }),
    ).withResult();

    const result = await req.json();

    expect(Result.isOk(result)).toBe(true);
    if (Result.isOk(result)) {
      expect(result.value.response.status).toBe(301);
      expect(result.value.response.response.headers.get('Location')).toBe(
        '/users/new-id',
      );
    }
  });

  it('handles 302 with absolute Location header', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(null, {
        status: 302,
        statusText: 'Found',
        headers: {
          Location: 'https://cdn.example.com/resource',
        },
      }),
    );

    const req = new Request(
      'GET',
      '/resource',
      createRequestOptions({
        requestConfig: {
          ...createBaseConfig(),
          redirect: 'manual',
        },
      }),
    ).withResult();

    const result = await req.json();

    expect(Result.isOk(result)).toBe(true);
    if (Result.isOk(result)) {
      expect(result.value.response.status).toBe(302);
      expect(result.value.response.response.headers.get('Location')).toBe(
        'https://cdn.example.com/resource',
      );
    }
  });

  it('handles 303 after POST with redirect to GET', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(null, {
        status: 303,
        statusText: 'See Other',
        headers: {
          Location: '/confirmation',
        },
      }),
    );

    const req = new Request(
      'POST',
      '/form-submit',
      createRequestOptions({
        requestConfig: {
          ...createBaseConfig(),
          redirect: 'manual',
        },
      }),
    )
      .bodyJson({ field: 'value' })
      .withResult();

    const result = await req.json();

    expect(Result.isOk(result)).toBe(true);
    if (Result.isOk(result)) {
      expect(result.value.response.status).toBe(303);
      expect(result.value.response.response.headers.get('Location')).toBe(
        '/confirmation',
      );
    }
  });

  it('preserves request headers during 307 redirect', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(null, {
        status: 307,
        statusText: 'Temporary Redirect',
        headers: {
          Location: '/new-location',
        },
      }),
    );

    const req = new Request(
      'POST',
      '/api/action',
      createRequestOptions({
        requestConfig: {
          ...createBaseConfig(),
          headers: {
            Authorization: 'Bearer token123',
            'X-Custom-Header': 'custom-value',
          },
          redirect: 'manual',
        },
      }),
    ).withResult();

    const result = await req.json();

    expect(Result.isOk(result)).toBe(true);
    if (Result.isOk(result)) {
      expect(result.value.response.status).toBe(307);
      expect(result.value.request.requestInit.headers).toMatchObject({
        Authorization: 'Bearer token123',
        'X-Custom-Header': 'custom-value',
      });
    }
  });

  it('handles redirect in default tuple mode', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(null, {
        status: 302,
        statusText: 'Found',
        headers: {
          Location: '/redirect-target',
        },
      }),
    );

    const req = new Request(
      'GET',
      '/source',
      createRequestOptions({
        requestConfig: {
          ...createBaseConfig(),
          redirect: 'manual',
        },
      }),
    );

    const [value, error] = await req.json();

    expect(error).toBeNull();
    expect(value).not.toBeNull();
    if (value !== null) {
      expect(value.response.status).toBe(302);
      expect(value.response.response.headers.get('Location')).toBe(
        '/redirect-target',
      );
    }
  });

  it('handles redirect in throwable mode', async () => {
    const finalData = { id: 1 };

    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(finalData), {
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const req = new Request(
      'GET',
      '/redirect-source',
      createRequestOptions({
        requestConfig: {
          ...createBaseConfig(),
          redirect: 'follow',
        },
      }),
    ).throwable();

    const result = await req.json<typeof finalData>();

    expect(result.data.id).toBe(1);
  });

  it('handles cross-origin redirect with CORS', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(null, {
        status: 302,
        statusText: 'Found',
        headers: {
          Location: 'https://other-domain.com/resource',
          'Access-Control-Allow-Origin': '*',
        },
      }),
    );

    const req = new Request(
      'GET',
      '/resource',
      createRequestOptions({
        requestConfig: {
          ...createBaseConfig(),
          mode: 'cors',
          redirect: 'manual',
        },
      }),
    ).withResult();

    const result = await req.json();

    expect(Result.isOk(result)).toBe(true);
    if (Result.isOk(result)) {
      expect(result.value.response.status).toBe(302);
      expect(result.value.response.response.headers.get('Location')).toContain(
        'other-domain.com',
      );
    }
  });
});
