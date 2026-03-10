// retry.spec.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Aspi } from '../aspi';
import * as Result from '../result';

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

// --------------- global vs local config propagation ---------------

describe('Retry – config propagation', () => {
  it('Aspi.setRetry config is visible in Request.getRetryConfig', () => {
    const api = createApi().setRetry({
      retries: 3,
      retryDelay: 1000,
      retryOn: [500, 503],
    });

    const req = api.get('/users');
    const cfg = req.getRetryConfig();

    expect(cfg.retries).toBe(3);
    expect(cfg.retryDelay).toBe(1000);
    expect(cfg.retryOn).toEqual([500, 503]);
  });

  it('per-request setRetry merges over Aspi.setRetry', () => {
    const api = createApi().setRetry({
      retries: 2,
      retryDelay: 500,
      retryOn: [500],
    });

    const req = api.get('/users').setRetry({
      retries: 5,
      retryOn: [429],
    });

    const cfg = req.getRetryConfig();
    expect(cfg.retries).toBe(5); // overridden
    expect(cfg.retryDelay).toBe(500); // from Aspi
    expect(cfg.retryOn).toEqual([429]); // overridden

    const req2 = api.get('/other');
    const cfg2 = req2.getRetryConfig();
    expect(cfg2.retries).toBe(2);
    expect(cfg2.retryOn).toEqual([500]);
  });

  it('getRetryConfig returns defaults when no retry set anywhere', () => {
    const api = createApi();
    const req = api.get('/users');
    const cfg = req.getRetryConfig();

    expect(cfg.retries).toBe(1);
    expect(cfg.retryDelay).toBe(0);
    expect(Array.isArray(cfg.retryOn)).toBe(true);
  });
});

// --------------- basic retryOn semantics ---------------

describe('Retry – retryOn status codes', () => {
  it('retries up to retries count for retryOn status codes, then succeeds', async () => {
    const api = createApi();

    const req = api
      .get('/flaky')
      .setRetry({
        retries: 3,
        retryDelay: 0,
        retryOn: [500],
      })
      .withResult();

    // 1st & 2nd calls: 500, 3rd: 200
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
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          statusText: 'OK',
          headers: { 'Content-Type': 'application/json' },
        }),
      );

    const res = await req.json<{ ok: boolean }>();

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(Result.isOk(res)).toBe(true);
    if (Result.isOk(res)) {
      expect(res.value.data.ok).toBe(true);
    }
  });

  it('stops retrying when max retries reached and returns the last error', async () => {
    const api = createApi();

    const req = api
      .get('/always-500')
      .setRetry({
        retries: 2,
        retryDelay: 0,
        retryOn: [500],
      })
      .withResult();

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

    const res = await req.json();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(Result.isErr(res)).toBe(true);
    if (Result.isErr(res)) {
      expect(res.error.tag).toBe('aspiError');
      if (res.error.tag === 'aspiError') {
        expect(res.error.response.status).toBe(500);
      }
    }
  });

  it('does not retry when status is not in retryOn', async () => {
    const api = createApi();

    const req = api
      .get('/bad-request')
      .setRetry({
        retries: 5,
        retryDelay: 0,
        retryOn: [500],
      })
      .withResult();

    fetchMock.mockResolvedValueOnce(
      new Response('null', { status: 400, statusText: 'Bad Request' }),
    );

    const res = await req.json();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(Result.isErr(res)).toBe(true);
    if (Result.isErr(res)) {
      expect(res.error.tag).toBe('aspiError');
      if (res.error.tag === 'aspiError')
        expect(res.error.response.status).toBe(400);
    }
  });
});

// --------------- retryWhile and onRetry ---------------

describe('Retry – retryWhile and onRetry', () => {
  it('retryWhile can trigger retries even when status is not in retryOn (non-success)', async () => {
    const api = createApi();

    const retryWhile = vi
      .fn()
      .mockResolvedValueOnce(true) // after first 500: retry
      .mockResolvedValueOnce(false); // after second 500: stop

    const req = api
      .get('/conditional')
      .setRetry({
        retries: 3,
        retryDelay: 0,
        retryOn: [], // no codes, rely on retryWhile
        retryWhile,
      })
      .withResult();

    // both responses 500, so isSuccessResponse = false
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

    const res = await req.json();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(retryWhile).toHaveBeenCalledTimes(2);
    expect(Result.isErr(res)).toBe(true);
    if (Result.isErr(res)) {
      expect(res.error.tag).toBe('aspiError');
      if (res.error.tag === 'aspiError')
        expect(res.error.response.status).toBe(500);
    }
  });

  it('onRetry is called after each retry attempt', async () => {
    const api = createApi();

    const onRetry = vi.fn();

    const req = api
      .get('/flaky')
      .setRetry({
        retries: 3,
        retryDelay: 0,
        retryOn: [500],
        onRetry,
      })
      .withResult();

    // 500 then 500 then 200
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
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          statusText: 'OK',
          headers: { 'Content-Type': 'application/json' },
        }),
      );

    const res = await req.json<{ ok: boolean }>();

    expect(fetchMock).toHaveBeenCalledTimes(3);
    // onRetry is called after first and second attempts (before third)
    expect(onRetry).toHaveBeenCalledTimes(2);
    expect(Result.isOk(res)).toBe(true);
  });
});

// --------------- retryDelay semantics ---------------

describe('Retry – retryDelay (number and function)', () => {
  it('uses numeric retryDelay between attempts', async () => {
    const api = createApi();

    const req = api
      .get('/numeric-delay')
      .setRetry({
        retries: 2,
        retryDelay: 10,
        retryOn: [500],
      })
      .withResult();

    // We do not assert actual time, but ensure two calls
    fetchMock
      .mockResolvedValueOnce(
        new Response('null', {
          status: 500,
          statusText: 'Internal Server Error',
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          statusText: 'OK',
          headers: { 'Content-Type': 'application/json' },
        }),
      );

    const res = await req.json<{ ok: boolean }>();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(Result.isOk(res)).toBe(true);
  });

  it('uses functional retryDelay with attempt info', async () => {
    const api = createApi();

    const delayFn = vi.fn().mockResolvedValue(0);

    const req = api
      .get('/fn-delay')
      .setRetry({
        retries: 3,
        retryDelay: delayFn,
        retryOn: [500],
      })
      .withResult();

    fetchMock
      .mockResolvedValueOnce(
        new Response('null', {
          status: 500,
          statusText: 'Internal Server Error',
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          statusText: 'OK',
          headers: { 'Content-Type': 'application/json' },
        }),
      );

    const res = await req.json<{ ok: boolean }>();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(delayFn).toHaveBeenCalledTimes(1);
    const [attemptIdx, maxAttempts] = delayFn.mock.calls[0];
    expect(attemptIdx).toBeGreaterThanOrEqual(0);
    expect(maxAttempts).toBe(3);
    expect(Result.isOk(res)).toBe(true);
  });
});

// --------------- abort behaviour with retries ---------------

describe('Retry – abort handling', () => {
  it('aborts delay and returns AspiError when signal is aborted between retries', async () => {
    const api = createApi();

    const controller = new AbortController();

    const req = api
      .get('/abort')
      .setRetry({
        retries: 2,
        retryDelay: 50,
        retryOn: [500],
      })
      .withResult();

    // first response 500; then we abort before next retry
    fetchMock.mockResolvedValueOnce(
      new Response('null', {
        status: 500,
        statusText: 'Internal Server Error',
      }),
    );

    // inject signal into Request via setHeaders + modifying requestInit directly
    const initial = req.getRequest();
    initial.requestInit.signal = controller.signal;

    // re-run getRequest so our test signal is used in #abortDelay
    const resPromise = req.json();

    // abort quickly
    controller.abort();

    const result = await resPromise;

    expect(Result.isErr(result)).toBe(true);
    if (Result.isErr(result)) {
      expect(result.error.tag).toBe('aspiError');
      // status is wrapped as 500 INTERNAL_SERVER_ERROR in makeResponse
      if (result.error.tag === 'aspiError')
        expect(result.error.response.status).toBe(500);
    }
  });
});
