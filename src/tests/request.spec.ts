// request.spec.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Aspi } from '../aspi';
import { AspiError } from '../error';
import * as Result from '../result';
import type { StandardSchemaV1 } from '../standard-schema';

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  // @ts-expect-error assign for tests
  global.fetch = fetchMock;
});

afterEach(() => {
  vi.restoreAllMocks();
});

const createApi = () =>
  new Aspi({
    baseUrl: 'https://api.example.com',
    headers: { 'Content-Type': 'application/json' },
  });

const dummySchema = (validateImpl: (value: any) => any): StandardSchemaV1 =>
  ({
    '~standard': {
      validate: validateImpl,
    },
  }) as any;

// -------------------- basic configuration setters --------------------

describe('Request – configuration methods', () => {
  it('setBaseUrl overrides baseUrl only for that Request', () => {
    const api = createApi();

    const r1 = api.get('/users').setBaseUrl('https://local.com');
    const req1 = r1.getRequest();
    expect(req1.requestInit.baseUrl).toBe('https://local.com');

    const r2 = api.get('/users');
    const req2 = r2.getRequest();
    expect(req2.requestInit.baseUrl).toBe('https://api.example.com');
  });

  it('setHeaders merges with existing headers without leaking to other requests', () => {
    const api = createApi();

    const r1 = api
      .get('/users')
      .setHeaders({ 'X-Req': '1', 'Content-Type': 'application/json+custom' });

    const h1 = r1.getRequest().requestInit.headers as Record<string, string>;
    expect(h1['X-Req']).toBe('1');
    expect(h1['Content-Type']).toBe('application/json+custom');

    const r2 = api.get('/users');
    const h2 = r2.getRequest().requestInit.headers as Record<string, string>;
    expect(h2['X-Req']).toBeUndefined();
    expect(h2['Content-Type']).toBe('application/json');
  });

  it('setHeader sets one header only for that Request', () => {
    const api = createApi();

    const r1 = api.get('/users').setHeader('X-Req-One', 'value');
    const h1 = r1.getRequest().requestInit.headers as Record<string, string>;
    expect(h1['X-Req-One']).toBe('value');

    const r2 = api.get('/users');
    const h2 = r2.getRequest().requestInit.headers as Record<string, string>;
    expect(h2['X-Req-One']).toBeUndefined();
  });

  it('setBearer uses Authorization for that Request only', () => {
    const api = createApi();

    const r1 = api.get('/me').setBearer('token-123');
    const h1 = r1.getRequest().requestInit.headers as Record<string, string>;
    expect(h1['Authorization']).toBe('Bearer token-123');

    const r2 = api.get('/me');
    const h2 = r2.getRequest().requestInit.headers as Record<string, string>;
    expect(h2['Authorization']).toBeUndefined();
  });

  it('setQueryParams stores params and affects url()', () => {
    const api = createApi();

    const r = api.get('/search').setQueryParams({ q: 'term', page: '2' });

    const req = r.getRequest();
    expect(req.queryParams).toBeInstanceOf(URLSearchParams);
    expect(req.queryParams?.get('q')).toBe('term');
    expect(req.queryParams?.get('page')).toBe('2');

    expect(r.url()).toBe('https://api.example.com/search?q=term&page=2');
  });

  it('setRetry merges per-request retry config', () => {
    const api = createApi();

    const r = api.get('/users').setRetry({
      retries: 5,
      retryOn: [500, 502],
    });

    const cfg = r.getRetryConfig();
    expect(cfg.retries).toBe(5);
    expect(cfg.retryOn).toEqual([500, 502]);
    expect(cfg.retryDelay).toBe(0);
  });
});

// -------------------- bodySchema + bodyJson / unsafeBody --------------------

describe('Request – body configuration', () => {
  it('bodyJson sets JSON stringified body when bodySchema passes', () => {
    const api = createApi();
    const schema = dummySchema((value) => ({ value, issues: null }));

    const r = api.post('/users').bodySchema(schema).bodyJson({ name: 'John' });

    const req = r.getRequest();
    expect(req.requestInit.body).toBe(JSON.stringify({ name: 'John' }));
  });

  it('bodyJson does not send request and returns schemaParseError when schema fails', async () => {
    const api = createApi();
    const schema = dummySchema((_value) => ({
      value: null,
      issues: [{ path: ['name'], message: 'Required' }],
    }));

    const r = api
      .post('/users')
      .bodySchema(schema)
      .bodyJson({} as any)
      .withResult();

    const result = await r.json();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(Result.isErr(result)).toBe(true);
    if (Result.isErr(result)) {
      expect(result.error.tag).toBe('schemaParseError');
      if (result.error.tag === 'schemaParseError') {
        expect(result.error.data).toEqual([
          { path: ['name'], message: 'Required' },
        ]);
      }
    }
  });

  it('unsafeBody sets raw body without JSON stringify', () => {
    const api = createApi();
    const form = new FormData();
    form.append('file', 'content');

    const r = api.post('/upload').unsafeBody(form);
    const req = r.getRequest();

    expect(req.requestInit.body).toBe(form);
  });
});

// -------------------- response schema() --------------------

describe('Request – response schema validation', () => {
  it('schema() returns schemaParseError when validation fails', async () => {
    const api = createApi();
    const schema = dummySchema((_value) => ({
      value: null,
      issues: [{ path: ['id'], message: 'Expected number' }],
    }));

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 'not-number' }), {
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const r = api.get('/users/1').withResult().schema(schema);
    const result = await r.json();

    expect(Result.isErr(result)).toBe(true);
    if (Result.isErr(result)) {
      expect(result.error.tag).toBe('schemaParseError');
      if (result.error.tag === 'schemaParseError') {
        expect(result.error.data).toEqual([
          { path: ['id'], message: 'Expected number' },
        ]);
      }
    }
  });

  it('schema() passes transformed value when validation succeeds', async () => {
    const api = createApi();
    const schema = dummySchema((value) => ({
      value: { ...value, validated: true },
      issues: null,
    }));

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 1 }), {
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const r = api.get('/users/1').withResult().schema(schema);
    const result = await r.json();

    expect(Result.isOk(result)).toBe(true);
    if (Result.isOk(result)) {
      expect(result.value.data).toEqual({ id: 1, validated: true });
    }
  });
});

// -------------------- per-request custom error handlers --------------------

describe('Request – per-request custom error handlers', () => {
  it('notFound() on Request produces notFoundError only for that Request', async () => {
    const api = createApi();

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'missing' }), {
        status: 404,
        statusText: 'Not Found',
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const r1 = api
      .get('/one')
      .withResult()
      .notFound(({ request, response }) => ({
        path: request.path,
        status: response.status,
      }));

    const result1 = await r1.json();

    expect(Result.isErr(result1)).toBe(true);
    if (Result.isErr(result1)) {
      expect(result1.error.tag).toBe('notFoundError');
      if (result1.error.tag === 'notFoundError') {
        expect(result1.error.data).toEqual({
          path: '/one',
          status: 404,
        });
      }
    }

    const r2 = api.get('/two').withResult();
    const registry2 = r2.getErrorCallbackRegistry();
    const tags2 = Object.values(registry2).map((x) => x.tag);
    expect(tags2).not.toContain('notFoundError');
  });

  it('error() allows custom tag and data per Request', async () => {
    const api = createApi();

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'bad' }), {
        status: 400,
        statusText: 'Bad Request',
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const r = api
      .post('/users')
      .withResult()
      .error('validationError', 'BAD_REQUEST', ({ response }) => ({
        status: response.status,
        type: 'validation',
      }));

    const result = await r.json();

    expect(Result.isErr(result)).toBe(true);
    if (Result.isErr(result)) {
      expect(result.error.tag).toBe('validationError');
      if (result.error.tag === 'validationError') {
        expect(result.error.data).toEqual({
          status: 400,
          type: 'validation',
        });
      }
    }
  });

  it('getErrorCallbackRegistry returns shallow copy of per-request callbacks', () => {
    const api = createApi();

    const r = api
      .get('/users')
      .notFound(() => ({ a: 1 }))
      .tooManyRequests(() => ({ b: 2 }));

    const registry = r.getErrorCallbackRegistry();
    const tags = Object.values(registry).map((x) => x.tag);

    expect(tags).toContain('notFoundError');
    expect(tags).toContain('tooManyRequestsError');

    // mutate copy
    registry[404] = { cb: () => ({}), tag: 'mutated' } as any;

    const registry2 = r.getErrorCallbackRegistry();
    expect(registry2[404]?.tag).toBe('notFoundError');
  });
});

// -------------------- modes: withResult / throwable / default --------------------

describe('Request – modes and mapResponse', () => {
  it('withResult() sets isResult() true and isThrowable() false', () => {
    const api = createApi();
    const r = api.get('/users').withResult();

    expect(r.isResult()).toBe(true);
    expect(r.isThrowable()).toBe(false);
  });

  it('throwable() sets isThrowable() true and isResult() false', () => {
    const api = createApi();
    const r = api.get('/users').throwable();

    expect(r.isThrowable()).toBe(true);
    expect(r.isResult()).toBe(false);
  });

  it('default mode json() returns [ok, err]', async () => {
    const api = createApi();

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const r = api.get('/tuple');
    const [ok, err] = await r.json<{ ok: boolean }>();

    expect(err).toBeNull();
    expect(ok?.data.ok).toBe(true);
  });

  it('throwable mode json() throws AspiError on non-2xx', async () => {
    const api = createApi();

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: true }), {
        status: 500,
        statusText: 'Internal Server Error',
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const r = api.get('/error').throwable();
    await expect(r.json()).rejects.toBeInstanceOf(AspiError);
  });

  it('withResult mode json() returns Result.Result', async () => {
    const api = createApi();

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const r = api.get('/ok').withResult();
    const res = await r.json<{ ok: boolean }>();

    expect(Result.isOk(res)).toBe(true);
    if (Result.isOk(res)) {
      expect(res.value.data.ok).toBe(true);
    }
  });
});

// -------------------- URL building & getRequest & middlewares --------------------

describe('Request – URL building, getRequest, middlewares', () => {
  it('url() normalizes baseUrl, path, and queryParams', () => {
    const api = new Aspi({
      baseUrl: 'https://example.com/',
      headers: {},
    });

    const r = api.get('///users').setQueryParams('page=1&limit=10');
    expect(r.url()).toBe('https://example.com/users?page=1&limit=10');
  });

  it('getRequest() returns AspiRequest with middlewares applied', () => {
    const api = createApi().use((req) => ({
      ...req,
      headers: { ...(req.headers ?? {}), 'X-MW': '1' },
    }));

    const r = api.get('/users');
    const req = r.getRequest();
    const headers = req.requestInit.headers as Record<string, string>;

    expect(headers['X-MW']).toBe('1');
    expect(req.path).toBe('/users');
  });
});
