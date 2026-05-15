// capability.spec.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Aspi } from '../aspi';
import * as Result from '../result';

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

// ---------------------------------------------------------------------------
// 1. Capability composition
// ---------------------------------------------------------------------------

describe('Capability – composition', () => {
  it('composes multiple capabilities so each wraps the next', async () => {
    const api = createApi();
    const order: string[] = [];

    const loggingCap = () => ({
      async run(runner: () => Promise<Response>) {
        order.push('before-log');
        const res = await runner();
        order.push('after-log');
        return res;
      },
    });

    const authCap = () => ({
      async run(runner: () => Promise<Response>) {
        order.push('before-auth');
        const res = await runner();
        order.push('after-auth');
        return res;
      },
    });

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        statusText: 'OK',
      }),
    );

    const req = api
      .get('/users')
      .useCapability(loggingCap)
      .useCapability(authCap)
      .withResult();

    await req.json();

    // logging wraps auth, so logging runs first (outer), then auth, then fetch
    expect(order).toEqual([
      'before-log',
      'before-auth',
      'after-auth',
      'after-log',
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('inner capability can retry via runner()', async () => {
    const api = createApi();
    let attempts = 0;

    const retryCap = () => ({
      async run(runner: () => Promise<Response>) {
        let res = await runner();
        if (res.status === 500) {
          res = await runner(); // retry once
        }
        return res;
      },
    });

    fetchMock
      .mockResolvedValueOnce(
        new Response('null', { status: 500, statusText: 'Internal Server Error' }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), { status: 200, statusText: 'OK' }),
      );

    const req = api.get('/users').useCapability(retryCap).withResult();
    const res = await req.json();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(Result.isOk(res)).toBe(true);
  });

  it('outer capability can short-circuit and never call runner()', async () => {
    const api = createApi();

    const cacheCap = () => ({
      async run() {
        return new Response(JSON.stringify({ cached: true }), { status: 200 });
      },
    });

    const req = api.get('/users').useCapability(cacheCap).withResult();
    const res = await req.json();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(Result.isOk(res)).toBe(true);
    if (Result.isOk(res)) {
      expect(res.value.data).toEqual({ cached: true });
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Request.useCapability chaining
// ---------------------------------------------------------------------------

describe('Capability – chaining', () => {
  it('useCapability returns the Request for fluent chaining', () => {
    const api = createApi();
    const noop = () => ({ async run(runner: () => Promise<Response>) { return runner(); } });

    const req = api.get('/users').useCapability(noop).withResult();
    expect(req.isResult()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 3. Timeout
// ---------------------------------------------------------------------------

describe('Capability – timeout', () => {
  it('aborts request when timeout is exceeded', async () => {
    const api = createApi();

    fetchMock.mockImplementation(
      () =>
        new Promise((_, reject) => {
          setTimeout(() => {
            reject(new DOMException('The operation was aborted.', 'AbortError'));
          }, 100);
        }),
    );

    const req = api.get('/slow').timeout(10).withResult();
    const res = await req.json();

    expect(Result.isErr(res)).toBe(true);
    if (Result.isErr(res)) {
      expect(res.error.tag).toBe('aspiError');
    }
  });

  it('completes normally when response arrives before timeout', async () => {
    const api = createApi();

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        statusText: 'OK',
      }),
    );

    const req = api.get('/fast').timeout(5000).withResult();
    const res = await req.json<{ ok: boolean }>();

    expect(Result.isOk(res)).toBe(true);
    if (Result.isOk(res)) {
      expect(res.value.data.ok).toBe(true);
    }
  });

  it('chains timeout with existing signal', async () => {
    const api = createApi();
    const controller = new AbortController();

    fetchMock.mockImplementation(
      () =>
        new Promise((_, reject) => {
          setTimeout(() => {
            reject(new DOMException('The operation was aborted.', 'AbortError'));
          }, 100);
        }),
    );

    const req = api.get('/slow');
    const initial = req.getRequest();
    initial.requestInit.signal = controller.signal;

    const res = await req.timeout(10).withResult().json();

    expect(Result.isErr(res)).toBe(true);
    if (Result.isErr(res)) {
      expect(res.error.tag).toBe('aspiError');
    }
  });

  it('external signal abort triggers before timeout', async () => {
    const api = createApi();
    const controller = new AbortController();

    fetchMock.mockImplementation(
      () =>
        new Promise((_, reject) => {
          setTimeout(() => {
            reject(new DOMException('The user aborted a request.', 'AbortError'));
          }, 200);
        }),
    );

    const req = api.get('/slow');
    const initial = req.getRequest();
    initial.requestInit.signal = controller.signal;

    const promise = req.timeout(500).withResult().json();
    controller.abort();

    const res = await promise;

    expect(Result.isErr(res)).toBe(true);
    if (Result.isErr(res)) {
      expect(res.error.tag).toBe('aspiError');
    }
  });
});
