// response.spec.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Aspi } from '../aspi';
import { AspiError, CustomError } from '../error';
import * as Result from '../result';

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  // @ts-expect-error: assign for tests
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

// ------------- withResult + custom handlers -------------

describe('Response – withResult + custom handlers', () => {
  it('Aspi.badRequest handler produces CustomError in withResult mode', async () => {
    const api = createApi().badRequest(({ response }) => ({
      message: `bad request ${response.status}`,
    }));

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(null), {
        status: 400,
        statusText: 'Bad Request',
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const req = api.get('/users').withResult();
    const result = await req.json();

    expect(Result.isErr(result)).toBe(true);
    if (Result.isErr(result)) {
      expect(result.error).toBeInstanceOf(CustomError);
      expect(result.error.tag).toBe('badRequestError');
      if (result.error.tag === 'badRequestError') {
        expect(result.error.data).toEqual({ message: 'bad request 400' });
      }
    }
  });

  it('Aspi.notFound handler produces notFoundError in withResult mode', async () => {
    const api = createApi().notFound(({ response, request }) => ({
      path: request.path,
      status: response.status,
    }));

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'missing' }), {
        status: 404,
        statusText: 'Not Found',
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const req = api.get('/users/999').withResult();
    const result = await req.json();

    expect(Result.isErr(result)).toBe(true);
    if (Result.isErr(result)) {
      expect(result.error.tag).toBe('notFoundError');
      if (result.error.tag === 'notFoundError') {
        expect(result.error.data).toEqual({
          path: '/users/999',
          status: 404,
        });
      }
    }
  });

  it('Aspi.internalServerError handler produces internalServerErrorError in withResult mode', async () => {
    const api = createApi().internalServerError(({ response }) => ({
      statusText: response.statusText,
    }));

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'oops' }), {
        status: 500,
        statusText: 'Internal Server Error',
        headers: { 'Content-Type': 'text/plain' },
      }),
    );

    const req = api.get('/fail').withResult();
    const result = await req.json();

    expect(Result.isErr(result)).toBe(true);
    if (Result.isErr(result)) {
      expect(result.error.tag).toBe('internalServerErrorError');
      if (result.error.tag === 'internalServerErrorError') {
        expect(result.error.data).toEqual({
          statusText: 'Internal Server Error',
        });
      }
    }
  });
});

// ------------- throwable + custom handlers -------------

describe('Response – throwable + custom handlers', () => {
  it('Aspi.badRequest handler is thrown as CustomError in throwable mode', async () => {
    const api = createApi().badRequest(({ response }) => ({
      code: 'BAD_REQUEST',
      status: response.status,
    }));

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'bad' }), {
        status: 400,
        statusText: 'Bad Request',
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const req = api.get('/users').throwable();

    await expect(req.json()).rejects.toMatchObject({
      tag: 'badRequestError',
      data: { code: 'BAD_REQUEST', status: 400 },
    });
  });

  it('Aspi.notFound handler is thrown as CustomError in throwable mode', async () => {
    const api = createApi().notFound(({ request }) => ({
      resource: request.path,
    }));

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'missing' }), {
        status: 404,
        statusText: 'Not Found',
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const req = api.get('/users/123').throwable();

    await expect(req.json()).rejects.toMatchObject({
      tag: 'notFoundError',
      data: { resource: '/users/123' },
    });
  });
});

// ------------- default tuple mode + custom handlers -------------

describe('Response – default tuple mode + custom handlers', () => {
  it('Aspi.badRequest handler returns CustomError in tuple error slot', async () => {
    const api = createApi().badRequest(({ response }) => ({
      status: response.status,
      reason: 'validation error',
    }));

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'bad' }), {
        status: 400,
        statusText: 'Bad Request',
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const req = api.get('/users');
    const [ok, err] = await req.json();

    expect(ok).toBeNull();
    expect(err).not.toBeNull();
    if (err && 'tag' in err) {
      expect(err.tag).toBe('badRequestError');
      // @ts-expect-error: data exists for CustomError
      expect(err.data).toEqual({ status: 400, reason: 'validation error' });
    }
  });

  it('Aspi.notFound handler returns CustomError in tuple error slot', async () => {
    const api = createApi().notFound(({ request }) => ({
      path: request.path,
    }));

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'missing' }), {
        status: 404,
        statusText: 'Not Found',
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const req = api.get('/users/999');
    const [ok, err] = await req.json();

    expect(ok).toBeNull();
    expect(err).not.toBeNull();
    if (err && 'tag' in err) {
      expect(err.tag).toBe('notFoundError');
      // @ts-expect-error: data exists for CustomError
      expect(err.data).toEqual({ path: '/users/999' });
    }
  });
});

// ------------- json() – core behavior (no custom handlers) -------------

describe('Response – json() core behavior', () => {
  it('withResult: ok for 2xx JSON', async () => {
    const api = createApi();
    const payload = { id: 1 };

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(payload), {
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const res = await api.get('/users/1').withResult().json<typeof payload>();

    expect(Result.isOk(res)).toBe(true);
    if (Result.isOk(res)) {
      expect(res.value.data).toEqual(payload);
    }
  });

  it('withResult: aspiError when non-2xx and no handler', async () => {
    const api = createApi();

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: true }), {
        status: 500,
        statusText: 'Internal Server Error',
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const res = await api.get('/error').withResult().json();

    expect(Result.isErr(res)).toBe(true);
    if (Result.isErr(res)) {
      expect(res.error.tag).toBe('aspiError');
      if (res.error.tag === 'aspiError') {
        expect(res.error.response.status).toBe(500);
      }
    }
  });

  it('throwable: resolves on 2xx, throws on error', async () => {
    const api = createApi();

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 1 }), {
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const okReq = api.get('/ok').throwable();
    const okRes = await okReq.json<{ id: number }>();
    expect(okRes.data.id).toBe(1);

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: true }), {
        status: 500,
        statusText: 'Internal Server Error',
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const errReq = api.get('/err').throwable();
    await expect(errReq.json()).rejects.toBeInstanceOf(AspiError);
  });

  it('default tuple: [ok, null] on success, [null, error] on failure', async () => {
    const api = createApi();

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const [ok1, err1] = await api.get('/ok').json<{ ok: boolean }>();
    expect(err1).toBeNull();
    expect(ok1?.data.ok).toBe(true);

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: true }), {
        status: 404,
        statusText: 'Not Found',
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const [ok2, err2] = await api.get('/err').json();
    expect(ok2).toBeNull();
    expect(err2).not.toBeNull();
    if (err2 && 'tag' in err2) {
      expect(err2.tag).toBe('aspiError');
    }
  });
});

// ------------- text() and blob() (minimal, no extra handlers) -------------

describe('Response – text()', () => {
  it('withResult: ok for 2xx text', async () => {
    const api = createApi();

    fetchMock.mockResolvedValueOnce(
      new Response('Hello', {
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'text/plain' },
      }),
    );

    const res = await api.get('/text').withResult().text();

    expect(Result.isOk(res)).toBe(true);
    if (Result.isOk(res)) {
      expect(res.value.data).toBe('Hello');
    }
  });

  it('throwable: ok for 2xx text', async () => {
    const api = createApi();

    fetchMock.mockResolvedValueOnce(
      new Response('Hello', {
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'text/plain' },
      }),
    );

    const res = await api.get('/text').throwable().text();

    expect(res.data).toBe('Hello');
  });
});

describe('Response – blob()', () => {
  it('withResult: ok for 2xx blob', async () => {
    const api = createApi();
    const blob = new Blob(['data'], { type: 'application/octet-stream' });

    fetchMock.mockResolvedValueOnce(
      new Response(blob, {
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'application/octet-stream' },
      }),
    );

    const res = await api.get('/file').withResult().blob();

    expect(Result.isOk(res)).toBe(true);
    if (Result.isOk(res)) {
      expect(res.value.data).toBeInstanceOf(Blob);
      expect(res.value.data.type).toBe('application/octet-stream');
    }
  });

  it('throwable: ok for 2xx blob', async () => {
    const api = createApi();
    const blob = new Blob(['image'], { type: 'image/png' });

    fetchMock.mockResolvedValueOnce(
      new Response(blob, {
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'image/png' },
      }),
    );

    const res = await api.get('/image.png').throwable().blob();

    expect(res.data).toBeInstanceOf(Blob);
    expect(res.data.type).toBe('image/png');
  });

  describe('Response – inferring info from Result.ok', () => {
    it('infers HTTP status and headers from withResult().json()', async () => {
      const api = createApi();
      const payload = { id: 1 };

      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify(payload), {
          status: 201,
          statusText: 'Created',
          headers: {
            'Content-Type': 'application/json',
            Location: '/users/1',
            'X-Request-Id': 'req-123',
          },
        }),
      );

      const res = await api.post('/users').withResult().json<typeof payload>();

      expect(Result.isOk(res)).toBe(true);
      if (Result.isOk(res)) {
        const { response } = res.value;
        expect(response.status).toBe(201);
        expect(response.response.headers.get('Location')).toBe('/users/1');
        expect(response.response.headers.get('X-Request-Id')).toBe('req-123');
      }
    });

    it('includes the original AspiRequest in Result.ok for inspection', async () => {
      const api = createApi();

      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          statusText: 'OK',
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      const res = await api
        .get('/users')
        .setQueryParams({ include: 'profile' })
        .withResult()
        .json<{ ok: boolean }>();

      expect(Result.isOk(res)).toBe(true);
      if (Result.isOk(res)) {
        const { request } = res.value;
        expect(request.path).toBe('/users');
        expect(request.queryParams?.get('include')).toBe('profile');
        expect(request.requestInit.baseUrl).toBe('https://api.example.com');
      }
    });
  });

  describe('Response – inferring info from tuple mode', () => {
    it('infers status and headers from ok part of [ok, err]', async () => {
      const api = createApi();
      const payload = { id: 42 };

      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify(payload), {
          status: 202,
          statusText: 'Accepted',
          headers: {
            'Content-Type': 'application/json',
            Location: '/jobs/42',
          },
        }),
      );

      const [ok, err] = await api.post('/jobs').json<typeof payload>();

      expect(err).toBeNull();
      expect(ok).not.toBeNull();
      if (ok) {
        expect(ok.response.status).toBe(202);
        expect(ok.response.response.headers.get('Location')).toBe('/jobs/42');
      }
    });

    it('infers error type from tag in tuple mode', async () => {
      const api = createApi().notFound(({ response }) => ({
        status: response.status,
        message: 'not found',
      }));

      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'missing' }), {
          status: 404,
          statusText: 'Not Found',
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      const [ok, err] = await api.get('/missing').json();

      expect(ok).toBeNull();
      expect(err).not.toBeNull();

      if (err && 'tag' in err) {
        expect(err.tag).toBe('notFoundError');
        // CustomError data
        // @ts-expect-error: data exists on CustomError
        expect(err.data).toEqual({ status: 404, message: 'not found' });
      }
    });
  });

  describe('Response – narrowing different error tags', () => {
    it('distinguishes aspiError vs jsonParseError in withResult() error handling', async () => {
      const api = createApi();

      // First: malformed JSON → jsonParseError
      fetchMock.mockResolvedValueOnce(
        new Response('{ invalid json', {
          status: 200,
          statusText: 'OK',
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      const malformed = await api.get('/broken').withResult().json();

      if (Result.isErr(malformed)) {
        if (malformed.error.tag === 'jsonParseError') {
          expect(malformed.error.data.message).toBeDefined();
        } else if (malformed.error.tag === 'aspiError') {
          throw new Error('Expected jsonParseError, got aspiError');
        }
      }

      // Second: 500 valid JSON → aspiError
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ error: true }), {
          status: 500,
          statusText: 'Internal Server Error',
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      const serverErr = await api.get('/fail').withResult().json();

      if (Result.isErr(serverErr)) {
        if (serverErr.error.tag === 'aspiError') {
          expect(serverErr.error.response.status).toBe(500);
        } else if (serverErr.error.tag === 'jsonParseError') {
          throw new Error('Expected aspiError, got jsonParseError');
        }
      }
    });

    it('uses different custom tags to infer domain-specific context', async () => {
      const api = createApi()
        .badRequest(() => ({ kind: 'validation', field: 'email' }))
        .conflict(() => ({ kind: 'conflict', resource: 'user' }));

      // 400 → badRequestError
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'validation' }), {
          status: 400,
          statusText: 'Bad Request',
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      const badReq = await api.post('/users').withResult().json();

      if (Result.isErr(badReq)) {
        if (badReq.error.tag === 'badRequestError') {
          expect(badReq.error.data).toEqual({
            kind: 'validation',
            field: 'email',
          });
        }
      }

      // 409 → conflictError
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'conflict' }), {
          status: 409,
          statusText: 'Conflict',
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      const conflict = await api.post('/users').withResult().json();

      if (Result.isErr(conflict)) {
        if (conflict.error.tag === 'conflictError') {
          expect(conflict.error.data).toEqual({
            kind: 'conflict',
            resource: 'user',
          });
        }
      }
    });
  });

  describe('Response – inferring from text()/blob() metadata', () => {
    it('withResult().text(): infer content-type and length from headers', async () => {
      const api = createApi();

      fetchMock.mockResolvedValueOnce(
        new Response('Hello world', {
          status: 200,
          statusText: 'OK',
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Content-Length': '11',
          },
        }),
      );

      const res = await api.get('/text').withResult().text();

      expect(Result.isOk(res)).toBe(true);
      if (Result.isOk(res)) {
        const { response, data } = res.value;
        expect(data).toBe('Hello world');
        expect(response.response.headers.get('Content-Type')).toBe(
          'text/plain; charset=utf-8',
        );
        expect(response.response.headers.get('Content-Length')).toBe('11');
      }
    });

    it('withResult().blob(): infer filename from Content-Disposition', async () => {
      const api = createApi();
      const blob = new Blob(['pdf'], { type: 'application/pdf' });

      fetchMock.mockResolvedValueOnce(
        new Response(blob, {
          status: 200,
          statusText: 'OK',
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': 'attachment; filename="doc.pdf"',
          },
        }),
      );

      const res = await api.get('/document').withResult().blob();

      expect(Result.isOk(res)).toBe(true);
      if (Result.isOk(res)) {
        const { response, data } = res.value;
        expect(data).toBeInstanceOf(Blob);
        expect(data.type).toBe('application/pdf');
        expect(response.response.headers.get('Content-Disposition')).toContain(
          'doc.pdf',
        );
      }
    });
  });
});
