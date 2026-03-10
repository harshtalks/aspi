// edge-cases.spec.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Aspi } from '../aspi';
import { AspiError, CustomError } from '../error';
import * as Result from '../result';
import type { StandardSchemaV1 } from '../standard-schema';

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  // @ts-expect-error
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

const makeDummySchema = (validateImpl: (value: any) => any): StandardSchemaV1 =>
  ({
    '~standard': {
      validate: validateImpl,
    },
  }) as any;

// ---------------------------------------------------------------------------
// 1. Abort & signal behaviour
// ---------------------------------------------------------------------------

describe('Edge – abort & signal', () => {
  it('abort causing fetch AbortError returns AspiError and no retries', async () => {
    const api = createApi();

    const controller = new AbortController();

    const req = api.get('/abort-early').withResult();
    const initial = req.getRequest();
    initial.requestInit.signal = controller.signal;

    // fetch rejects with AbortError
    fetchMock.mockRejectedValueOnce(
      new DOMException('The user aborted a request.', 'AbortError'),
    );

    const res = await req.text();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(Result.isErr(res)).toBe(true);
    if (Result.isErr(res)) {
      expect(res.error.tag).toBe('aspiError');
      expect(res.error.message).toBe('The user aborted a request.');
      expect(res.error.response.status).toBe(500); // synthetic 500 in catch block
    }
  });

  it('aborting during retry delay uses custom 500 handler', async () => {
    const controller = new AbortController();

    const api = createApi()
      .internalServerError(() => ({
        kind: 'global-500',
      }))
      // ensure the signal is on the RequestInit used by #request()
      .use((init) => ({
        ...init,
        signal: controller.signal,
      }));

    const req = api
      .get('/abort-during-delay')
      .setRetry({
        retries: 2,
        retryDelay: 50,
        retryOn: [500],
      })
      .withResult();

    fetchMock.mockResolvedValueOnce(
      new Response('null', {
        status: 500,
        statusText: 'Internal Server Error',
      }),
    );

    const promise = req.text();

    // abort during the delay window
    controller.abort();

    const res = await promise;

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(Result.isErr(res)).toBe(true);
    if (Result.isErr(res)) {
      expect(res.error.tag).toBe('internalServerError');
      // @ts-expect-error data exists on CustomError
      expect(res.error.data).toEqual({ kind: 'global-500' });
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Middleware edge cases
// ---------------------------------------------------------------------------

describe('Edge – middlewares', () => {
  it('multiple middlewares modify same header in registration order', async () => {
    const api = createApi()
      .use((init) => ({
        ...init,
        headers: { ...(init.headers ?? {}), 'X-Order': '1' },
      }))
      .use((init) => ({
        ...init,
        headers: {
          ...(init.headers ?? {}),
          'X-Order': `${(init.headers as any)['X-Order']}-2`,
        },
      }))
      .use((init) => ({
        ...init,
        headers: {
          ...(init.headers ?? {}),
          'X-Order': `${(init.headers as any)['X-Order']}-3`,
        },
      }));

    fetchMock.mockResolvedValueOnce(
      new Response('OK', { status: 200, statusText: 'OK' }),
    );

    const req = api.get('/order');
    await req.text();

    const [, callInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((callInit.headers as any)['X-Order']).toBe('1-2-3');
  });

  it('middleware throwing bubbles as raw error in Result mode', async () => {
    const api = createApi().use(() => {
      throw new Error('middleware-fail');
    });

    const req = api.get('/middleware-error').withResult();

    await expect(req.text()).rejects.toThrowError('middleware-fail');
  });

  it('middleware throwing bubbles as raw error in throwable mode', async () => {
    const api = createApi().use(() => {
      throw new Error('middleware-throwable-fail');
    });

    const req = api.get('/middleware-error').throwable();

    await expect(req.text()).rejects.toThrowError('middleware-throwable-fail');
  });
});

// ---------------------------------------------------------------------------
// 3. Schema integration quirks
// ---------------------------------------------------------------------------

describe('Edge – schema integration', () => {
  it('bodySchema with async validate throws descriptive error', () => {
    const api = createApi();
    const asyncSchema: StandardSchemaV1 = {
      '~standard': {
        // @ts-expect-error minimal fake
        validate: () => Promise.resolve({ value: {}, issues: null }),
      },
    };

    const req = api.post('/users').bodySchema(asyncSchema);

    expect(() =>
      // bodyJson should synchronously detect Promise and throw
      // "Schema validation should not return a promise"
      req.bodyJson({} as any),
    ).toThrowError('Schema validation should not return a promise');
  });

  it('response schema with async validate becomes AspiError in Result mode', async () => {
    const api = createApi();

    const asyncSchema: StandardSchemaV1 = {
      '~standard': {
        // @ts-expect-error
        validate: () => Promise.resolve({ value: { ok: true }, issues: null }),
      },
    };

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const req = api.get('/async-schema').withResult().schema(asyncSchema);
    const res = await req.json();

    expect(Result.isErr(res)).toBe(true);
    if (Result.isErr(res)) {
      expect(res.error.tag).toBe('aspiError');
      expect(res.error.message).toBe(
        'Schema validation should not return a promise',
      );
    }
  });

  it('response schema transforms value and passes it through', async () => {
    const api = createApi();

    const schema = makeDummySchema((value) => ({
      value: { ...value, derived: true },
      issues: null,
    }));

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 1 }), {
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const res = await api.get('/transform').withResult().schema(schema).json();

    expect(Result.isOk(res)).toBe(true);
    if (Result.isOk(res)) {
      expect(res.value.data).toEqual({ id: 1, derived: true });
    }
  });
});

// ---------------------------------------------------------------------------
// 4. JSON edge cases
// ---------------------------------------------------------------------------

describe('Edge – JSON edge cases', () => {
  it('jsonParseError emitted when response contains malformed JSON, schema is never run', async () => {
    const api = createApi();

    const schema: StandardSchemaV1 = {
      '~standard': {
        // @ts-expect-error
        validate: vi.fn((v: any) => ({ value: v, issues: null })),
      },
    };

    fetchMock.mockResolvedValueOnce(
      new Response('{ invalid json', {
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const res = await api.get('/bad-json').withResult().schema(schema).json();

    expect(Result.isErr(res)).toBe(true);
    if (Result.isErr(res)) {
      expect(res.error.tag).toBe('jsonParseError');
      if (res.error.tag === 'jsonParseError')
        expect(res.error.data.message).toBeDefined();
    }

    expect(schema['~standard'].validate as any).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 5. Error precedence & body vs response schema
// ---------------------------------------------------------------------------

describe('Edge – error precedence', () => {
  it('custom handler wins over AspiError on final attempt', async () => {
    const api = createApi();

    const req = api
      .get('/custom-vs-aspi')
      .setRetry({
        retries: 2,
        retryDelay: 0,
        retryOn: [500],
      })
      .withResult()
      .internalServerError(() => ({ kind: 'custom-500' }));

    // Both attempts return 500
    fetchMock
      .mockResolvedValueOnce(
        new Response('null', {
          status: 500,
          statusText: 'Internal Server Error',
        }),
      )
      .mockResolvedValueOnce(
        new Response('null', {
          status: 500,
          statusText: 'Internal Server Error',
        }),
      );

    const res = await req.text();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(Result.isErr(res)).toBe(true);
    if (Result.isErr(res)) {
      // custom 500 handler should have produced CustomError
      expect(res.error.tag).toBe('internalServerError');
      // @ts-expect-error data exists on CustomError
      expect(res.error.data).toEqual({ kind: 'custom-500' });
    }
  });

  it('body schema errors short‑circuit before network even if response schema exists', async () => {
    const api = createApi();

    const bodySchema = makeDummySchema((_v) => ({
      value: null,
      issues: [{ path: ['name'], message: 'Required' }],
    }));

    const resSchema = makeDummySchema((v) => ({ value: v, issues: null }));

    const req = api
      .post('/body-vs-response-schema')
      .bodySchema(bodySchema)
      .bodyJson({} as any)
      .withResult()
      .schema(resSchema);

    const res = await req.json();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(Result.isErr(res)).toBe(true);
    if (Result.isErr(res)) {
      expect(res.error.tag).toBe('parseError');
      if (res.error.tag === 'parseError')
        expect(res.error.data).toEqual([
          { path: ['name'], message: 'Required' },
        ]);
    }
  });
});

// ---------------------------------------------------------------------------
// 6. Mode guardrails
// ---------------------------------------------------------------------------

describe('Edge – mode guardrails', () => {
  it('withResult() then throwable() ends up in throwable mode only', async () => {
    const api = createApi();

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const req = api.get('/mode').withResult().throwable();

    expect(req.isResult()).toBe(false);
    expect(req.isThrowable()).toBe(true);

    const res = await req.json<{ ok: boolean }>();
    expect(res.data.ok).toBe(true);
  });

  it('throwable() then withResult() ends up in Result mode only', async () => {
    const api = createApi();

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const req = api.get('/mode2').throwable().withResult();

    expect(req.isResult()).toBe(true);
    expect(req.isThrowable()).toBe(false);

    const res = await req.json<{ ok: boolean }>();
    expect(Result.isOk(res)).toBe(true);
    if (Result.isOk(res)) {
      expect(res.value.data.ok).toBe(true);
    }
  });
});
