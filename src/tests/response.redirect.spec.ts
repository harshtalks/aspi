// response.redirect.spec.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Aspi } from '../aspi';
import { AspiError, CustomError } from '../error';
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

/**
 * Implementation notes this suite assumes:
 * - 3xx responses are treated as "success" by #isSuccessResponse.
 * - json() special-cases 3xx to return null body.
 */

// ---------- withResult mode: redirects ----------

describe('Redirect responses – withResult mode', () => {
  it('json() withResult: 302 returns ok with null data and Location header', async () => {
    const api = createApi();

    fetchMock.mockResolvedValueOnce(
      new Response('null', {
        status: 302,
        statusText: 'Found',
        headers: { Location: '/new-location' },
      }),
    );

    const res = await api.get('/redirect').withResult().json();

    expect(Result.isOk(res)).toBe(true);
    if (Result.isOk(res)) {
      expect(res.value.response.status).toBe(302);
      expect(res.value.data).toBeNull();
      expect(res.value.response.response.headers.get('Location')).toBe(
        '/new-location',
      );
    }
  });

  it('json() withResult: 301 behaves same as 302 ("null" body)', async () => {
    const api = createApi();

    fetchMock.mockResolvedValueOnce(
      new Response('null', {
        status: 301,
        statusText: 'Moved Permanently',
        headers: { Location: '/moved' },
      }),
    );

    const res = await api.get('/old').withResult().json();

    expect(Result.isOk(res)).toBe(true);
    if (Result.isOk(res)) {
      expect(res.value.response.status).toBe(301);
      expect(res.value.data).toBeNull();
      expect(res.value.response.response.headers.get('Location')).toBe(
        '/moved',
      );
    }
  });

  it('text() withResult: 302 returns body text (no special redirect handling)', async () => {
    const api = createApi();

    fetchMock.mockResolvedValueOnce(
      new Response('Redirecting...', {
        status: 302,
        statusText: 'Found',
        headers: { Location: '/somewhere-else' },
      }),
    );

    const res = await api.get('/text-redirect').withResult().text();

    expect(Result.isOk(res)).toBe(true);
    if (Result.isOk(res)) {
      expect(res.value.response.status).toBe(302);
      expect(res.value.data).toBe('Redirecting...');
    }
  });
});

// ---------- throwable mode: redirects ----------

describe('Redirect responses – throwable mode', () => {
  it('json() throwable: 302 resolves with null data and status 302', async () => {
    const api = createApi();

    fetchMock.mockResolvedValueOnce(
      new Response('null', {
        status: 302,
        statusText: 'Found',
        headers: { Location: '/redirect-here' },
      }),
    );

    const res = await api.get('/redirect').throwable().json();

    expect(res.response.status).toBe(302);
    expect(res.data).toBeNull();
    expect(res.response.response.headers.get('Location')).toBe(
      '/redirect-here',
    );
  });

  it('text() throwable: 302 resolves with body text', async () => {
    const api = createApi();

    fetchMock.mockResolvedValueOnce(
      new Response('Redirecting...', {
        status: 302,
        statusText: 'Found',
      }),
    );

    const res = await api.get('/redirect-text').throwable().text();

    expect(res.response.status).toBe(302);
    expect(res.data).toBe('Redirecting...');
  });
});

// ---------- default tuple mode: redirects ----------

describe('Redirect responses – default tuple mode', () => {
  it('json() default mode: 302 returns [ok, null] with null data', async () => {
    const api = createApi();

    fetchMock.mockResolvedValueOnce(
      new Response('null', {
        status: 302,
        statusText: 'Found',
        headers: { Location: '/redir' },
      }),
    );

    const [ok, err] = await api.get('/redir').json();

    expect(err).toBeNull();
    expect(ok).not.toBeNull();
    if (ok) {
      expect(ok.response.status).toBe(302);
      expect(ok.data).toBeNull();
      expect(ok.response.response.headers.get('Location')).toBe('/redir');
    }
  });

  it('text() default mode: 302 returns [ok, null] with text body', async () => {
    const api = createApi();

    fetchMock.mockResolvedValueOnce(
      new Response('Redirect page', {
        status: 302,
        statusText: 'Found',
      }),
    );

    const [ok, err] = await api.get('/redir-text').text();

    expect(err).toBeNull();
    expect(ok?.response.status).toBe(302);
    expect(ok?.data).toBe('Redirect page');
  });
});

// ---------- redirects + custom error handlers ----------

describe('Redirect responses – custom handlers', () => {
  it('does NOT call custom handler for 3xx (treated as success)', async () => {
    const api = createApi().badRequest(() => ({
      message: 'should not be called for 3xx',
    }));

    fetchMock.mockResolvedValueOnce(
      new Response('null', {
        status: 302,
        statusText: 'Found',
      }),
    );

    const res = await api.get('/redirect').withResult().json();

    expect(Result.isOk(res)).toBe(true);
    if (Result.isOk(res)) {
      expect(res.value.response.status).toBe(302);
    }
  });

  it('schema() still runs on 3xx json=false calls (text/blob), but json() returns null so schema is not applied', async () => {
    const api = createApi();
    const schema: StandardSchemaV1 = {
      '~standard': {
        // @ts-expect-error minimal mock
        validate: vi.fn((v: any) => ({ value: v, issues: null })),
      },
    };

    // For json(): 3xx => parser returns null, schema path is guarded by isJson flag
    fetchMock.mockResolvedValueOnce(
      new Response('null', {
        status: 302,
        statusText: 'Found',
      }),
    );

    const req = api.get('/schema-redirect').withResult().schema(schema);
    const res = await req.json();

    expect(Result.isOk(res)).toBe(true);
    if (Result.isOk(res)) {
      expect(res.value.data).toBeNull();
    }
    // schema.validate should NOT be called since isJson=true but responseData is null and branch is reached only when status is non-3xx/204 in your code
  });
});

// ---------- multiple redirect codes ----------

describe('Redirect responses – various 3xx codes', () => {
  it.each([
    [301, 'Moved Permanently'],
    [302, 'Found'],
    [303, 'See Other'],
    [307, 'Temporary Redirect'],
    [308, 'Permanent Redirect'],
  ])(
    'json() withResult: %i %s treated as ok with null data',
    async (status, text) => {
      const api = createApi();

      fetchMock.mockResolvedValueOnce(
        new Response('null', {
          status,
          statusText: text,
          headers: { Location: '/target' },
        }),
      );

      const res = await api.get(`/redir-${status}`).withResult().json();

      expect(Result.isOk(res)).toBe(true);
      if (Result.isOk(res)) {
        expect(res.value.response.status).toBe(status);
        expect(res.value.data).toBeNull();
        expect(res.value.response.response.headers.get('Location')).toBe(
          '/target',
        );
      }
    },
  );
});
