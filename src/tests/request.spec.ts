// request.test.ts
import { describe, it, expect, vi } from 'vitest';
import { createBaseConfig, createMockResponse, setupFetchMock } from './utils';
import { Request } from '../request';
import type { AspiRequestInit, RequestOptions } from '../types';
import { AspiError, CustomError, Result } from '..';

setupFetchMock();

const createRequestOptions = (
  overrides?: Partial<RequestOptions<AspiRequestInit>>,
): RequestOptions<AspiRequestInit> => ({
  requestConfig: createBaseConfig(),
  middlewares: [],
  errorCbs: {},
  throwOnError: false,
  shouldBeResult: false,
  ...overrides,
});

describe('Request – URL building and query params', () => {
  it('builds URL from baseUrl and path', () => {
    const req = new Request('GET', '/users', createRequestOptions());
    expect(req.url()).toBe('https://api.example.com/users');
  });

  it('normalizes trailing slash and leading slashes', () => {
    const req = new Request(
      'GET',
      '///users',
      createRequestOptions({
        requestConfig: {
          ...createBaseConfig(),
          baseUrl: 'https://api.example.com///',
        },
      }),
    );

    expect(req.url()).toBe('https://api.example.com/users');
  });

  it('applies query params from object', () => {
    const req = new Request(
      'GET',
      '/users',
      createRequestOptions(),
    ).setQueryParams({ page: '1', limit: '10' });

    expect(req.url()).toBe('https://api.example.com/users?page=1&limit=10');
  });

  it('applies query params from URLSearchParams', () => {
    const params = new URLSearchParams();
    params.set('sort', 'desc');
    params.set('filter', 'active');

    const req = new Request(
      'GET',
      '/users',
      createRequestOptions(),
    ).setQueryParams(params);

    expect(req.url()).toContain('sort=desc');
    expect(req.url()).toContain('filter=active');
  });
});

describe('Request – headers and bearer', () => {
  it('setHeaders merges headers on local request init', () => {
    const req = new Request(
      'GET',
      '/users',
      createRequestOptions({
        requestConfig: {
          ...createBaseConfig(),
          headers: { 'X-Existing': '1' },
        },
      }),
    ).setHeaders({
      'X-Existing': '2',
      'Content-Type': 'application/json',
    });

    const requestData = req.getRequest();
    const headers = new Headers(requestData.requestInit.headers);
    expect(headers.get('X-Existing')).toBe('2');
    expect(headers.get('Content-Type')).toBe('application/json');
  });

  it('setHeader overwrites single header', () => {
    const req = new Request('GET', '/users', createRequestOptions())
      .setHeader('X-Test', 'foo')
      .setHeader('X-Test', 'bar');

    const requestData = req.getRequest();
    const headers = new Headers(requestData.requestInit.headers);
    expect(headers.get('X-Test')).toBe('bar');
  });

  it('setBearer sets Authorization header', () => {
    const req = new Request('GET', '/users', createRequestOptions()).setBearer(
      'token123',
    );

    const requestData = req.getRequest();
    const headers = new Headers(requestData.requestInit.headers ?? {});
    expect(headers.get('Authorization')).toBe('Bearer token123');
  });
});

describe('Request – body handling and bodySchema', () => {
  it('bodyJson sets JSON stringified body without schema', () => {
    const req = new Request('POST', '/users', createRequestOptions()).bodyJson({
      name: 'John',
    });

    const requestData = req.getRequest();
    expect(requestData.requestInit?.body).toBe(
      JSON.stringify({ name: 'John' }),
    );
  });

  it('bodyJson validates against bodySchema and stores issues without sending request', async () => {
    const validate = vi.fn().mockReturnValue({
      issues: [{ path: ['name'], message: 'Required' }],
    });

    const schema = {
      '~standard': { validate },
    };

    const req = new Request('POST', '/users', createRequestOptions())
      // @ts-expect-error schema error
      .bodySchema(schema)
      .bodyJson({})
      .withResult();

    const result = await req.json();

    expect(global.fetch).not.toHaveBeenCalled();
    expect(Result.isErr(result)).toBe(true);

    if (Result.isErr(result)) {
      const error = result.error;
      expect(error).toBeInstanceOf(CustomError);
      expect(error.tag).toBe('parseError');
      if (error.tag === 'parseError') {
        expect(error.data[0].message).toBe('Required');
      }
    }
  });

  it('unsafeBody sets raw body', () => {
    const body = new URLSearchParams({ a: '1' });
    const req = new Request(
      'POST',
      '/users',
      createRequestOptions(),
    ).unsafeBody(body);

    const requestData = req.getRequest();
    expect(requestData.requestInit?.body).toBe(body);
  });
});

describe('Request – schema validation on response', () => {
  it('json() validates response with schema and returns Result.ok on success', async () => {
    const validate = vi.fn().mockReturnValue({
      value: { id: 1, name: 'John' },
    });

    const schema = {
      '~standard': { validate },
    };

    vi.mocked(global.fetch).mockResolvedValueOnce(
      createMockResponse({ id: 1, name: 'John' }),
    );

    const req = new Request('GET', '/users/1', createRequestOptions())
      .withResult()
      // @ts-expect-error schema error
      .schema(schema);

    const result = await req.json<{ id: number; name: string }>();

    expect(Result.isOk(result)).toBe(true);
    if (Result.isOk(result)) {
      expect(result.value.data).toEqual({ id: 1, name: 'John' });
    }
  });

  it('json() returns parseError when schema validation fails', async () => {
    const validate = vi.fn().mockReturnValue({
      issues: [{ path: ['id'], message: 'Invalid id' }],
    });

    const schema = {
      '~standard': { validate },
    };

    vi.mocked(global.fetch).mockResolvedValueOnce(
      createMockResponse({ id: 'x' }),
    );

    const req = new Request('GET', '/users/1', createRequestOptions())
      .withResult()
      // @ts-expect-error schema error
      .schema(schema);

    const result = await req.json();

    expect(Result.isErr(result)).toBe(true);
    if (Result.isErr(result)) {
      expect(result.error).toBeInstanceOf(CustomError);
      expect(result.error.tag).toBe('parseError');
    }
  });

  it('json() returns CustomError jsonParseError when JSON parsing fails', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response('not-json', {
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const req = new Request(
      'GET',
      '/broken',
      createRequestOptions(),
    ).withResult();

    const result = await req.json();

    expect(Result.isErr(result)).toBe(true);
    if (Result.isErr(result)) {
      expect(result.error).toBeInstanceOf(CustomError);
      expect(result.error.tag).toBe('jsonParseError');
    }
  });
});

describe('Request – modes: withResult, throwable, default tuple', () => {
  it('withResult() returns Result<ResultOk, Error>', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      createMockResponse({ id: 1 }),
    );

    const req = new Request(
      'GET',
      '/users/1',
      createRequestOptions(),
    ).withResult();

    const result = await req.json<{ id: number }>();

    expect(Result.isOk(result)).toBe(true);
    if (Result.isOk(result)) {
      expect(result.value.data.id).toBe(1);
    }
  });

  it('throwable() throws AspiError on HTTP error', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      createMockResponse('Not found', {
        status: 404,
        statusText: 'NOT_FOUND',
      }),
    );

    const req = new Request(
      'GET',
      '/missing',
      createRequestOptions(),
    ).throwable();

    await expect(req.json()).rejects.toBeInstanceOf(AspiError);
  });

  it('default mode returns [value, error] tuple on success', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      createMockResponse({ id: 1 }),
    );

    const req = new Request('GET', '/users/1', createRequestOptions());
    const [value, error] = await req.json<{ id: number }>();

    expect(error).toBeNull();
    expect(value).not.toBeNull();
    if (value !== null) {
      expect(value.data.id).toBe(1);
    }
  });

  it('default mode returns error in tuple on failure', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      createMockResponse('Not found', {
        status: 404,
        statusText: 'NOT_FOUND',
      }),
    );

    const req = new Request('GET', '/missing', createRequestOptions());
    const [value, error] = await req.json();

    expect(value).toBeNull();
    expect(error).toBeInstanceOf(AspiError);
  });
});

describe('Request – retry logic', () => {
  it('retries according to retry config and eventually succeeds', async () => {
    const fetchMock = vi.mocked(global.fetch);
    fetchMock
      .mockResolvedValueOnce(
        createMockResponse('Server error', {
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
        },
        retryConfig: {
          retries: 2,
          retryDelay: 0,
          retryOn: [500],
        },
      }),
    ).withResult();

    const result = await req.json<{ id: number }>();

    expect(Result.isOk(result)).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('stops retrying when retryWhile returns false', async () => {
    const fetchMock = vi.mocked(global.fetch);
    fetchMock.mockResolvedValue(
      createMockResponse('Server error', {
        status: 500,
        statusText: 'INTERNAL_SERVER_ERROR',
      }),
    );

    const retryWhile = vi.fn().mockResolvedValue(false);

    const req = new Request(
      'GET',
      '/unstable',
      createRequestOptions({
        requestConfig: {
          ...createBaseConfig(),
        },
        retryConfig: {
          retries: 2,
          retryDelay: 0,
          retryOn: [500],
          retryWhile,
        },
      }),
    ).withResult();

    const result = await req.json();

    expect(Result.isErr(result)).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('calls onRetry callback for each retry attempt', async () => {
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

    const onRetry = vi.fn();

    const req = new Request(
      'GET',
      '/unstable',
      createRequestOptions({
        requestConfig: {
          ...createBaseConfig(),
        },
        retryConfig: {
          retries: 3,
          retryDelay: 0,
          retryOn: [500],
          onRetry,
        },
      }),
    ).withResult();

    await req.json();

    expect(onRetry).toHaveBeenCalledTimes(2);
  });
});

describe('Request – text() and blob()', () => {
  it('text() returns parsed text in withResult mode', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response('hello', { status: 200, statusText: 'OK' }),
    );

    const req = new Request(
      'GET',
      '/text',
      createRequestOptions(),
    ).withResult();

    const result = await req.text();

    expect(Result.isOk(result)).toBe(true);
    if (Result.isOk(result)) {
      expect(result.value.data).toBe('hello');
    }
  });

  it('blob() returns Blob in Result mode', async () => {
    const blob = new Blob(['binary'], { type: 'application/octet-stream' });
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(blob, { status: 200, statusText: 'OK' }),
    );

    const req = new Request(
      'GET',
      '/file',
      createRequestOptions(),
    ).withResult();

    const result = await req.blob();

    expect(Result.isOk(result)).toBe(true);
    if (Result.isOk(result)) {
      expect(result.value.data).toBeInstanceOf(Blob);
    }
  });
});

describe('Request – custom error handlers', () => {
  it('invokes custom error handler for matching status and returns CustomError', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      createMockResponse('Bad', { status: 400, statusText: 'BAD_REQUEST' }),
    );

    const handler = vi.fn().mockReturnValue({ message: 'Custom bad request' });

    const req = new Request('GET', '/bad', createRequestOptions())
      .withResult()
      .badRequest(handler);

    const result = await req.json();

    expect(Result.isErr(result)).toBe(true);
    if (Result.isErr(result)) {
      expect(result.error).toBeInstanceOf(CustomError);
      expect(result.error.tag).toBe('badRequestError');
      if (result.error.tag === 'badRequestError') {
        expect(result.error.data.message).toBe('Custom bad request');
      }
    }
    expect(handler).toHaveBeenCalled();
  });

  it('invokes internalServerError handler when fetch throws', async () => {
    vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Network fail'));

    const handler = vi.fn().mockReturnValue({ message: 'Custom 500' });

    const req = new Request('GET', '/network', createRequestOptions())
      .withResult()
      .internalServerError(handler);

    const result = await req.json();

    expect(Result.isErr(result)).toBe(true);
    if (Result.isErr(result)) {
      expect(result.error).toBeInstanceOf(CustomError);
      expect(result.error.tag).toBe('internalServerError');
      if (result.error.tag === 'internalServerError') {
        expect(result.error.data.message).toBe('Custom 500');
      }
    }
  });
});
