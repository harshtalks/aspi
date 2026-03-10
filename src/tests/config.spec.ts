// config.spec.ts
import { describe, it, expect, vi } from 'vitest';
import { Aspi } from '../aspi';
import { Request } from '../request';
import type { AspiRequestInit } from '../types';
import type { HttpMethods } from '../http';

describe('Aspi – base configuration', () => {
  it('applies baseUrl from constructor to new requests', () => {
    const api = new Aspi({
      baseUrl: 'https://api.example.com',
    });

    const req = api.get('/users');
    expect(req.getRequest().requestInit.baseUrl).toBe(
      'https://api.example.com',
    );
  });

  it('setBaseUrl changes baseUrl for subsequent requests', () => {
    const api = new Aspi({ baseUrl: 'https://old.com' });

    const first = api.get('/users');
    expect(first.getRequest().requestInit.baseUrl).toBe('https://old.com');

    api.setBaseUrl('https://new.com');
    const second = api.get('/users');
    expect(second.getRequest().requestInit.baseUrl).toBe('https://new.com');
  });

  it('setBaseUrl accepts URL instance', () => {
    const api = new Aspi({ baseUrl: 'https://old.com' });
    const url = new URL('https://url-object.com/v1');

    api.setBaseUrl(url);
    const req = api.get('/ping');

    expect(req.getRequest().requestInit.baseUrl).toBe(url);
  });

  it('setHeaders merges into existing global headers', () => {
    const api = new Aspi({
      baseUrl: 'https://api.example.com',
      headers: {
        'Content-Type': 'application/json',
        'X-Base': '1',
      },
    });

    api.setHeaders({
      'X-Base': '2',
      'X-New': '3',
    });

    const req = api.get('/users');
    const headers = req.getRequest().requestInit.headers as Record<
      string,
      string
    >;

    expect(headers['Content-Type']).toBe('application/json');
    expect(headers['X-Base']).toBe('2');
    expect(headers['X-New']).toBe('3');
  });

  it('setHeader sets a single global header', () => {
    const api = new Aspi({
      baseUrl: 'https://api.example.com',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    api.setHeader('X-One', 'value');

    const req = api.get('/users');
    const headers = req.getRequest().requestInit.headers as Record<
      string,
      string
    >;

    expect(headers['Content-Type']).toBe('application/json');
    expect(headers['X-One']).toBe('value');
  });

  it('setBearer sets global Authorization header', () => {
    const api = new Aspi({
      baseUrl: 'https://api.example.com',
    });

    api.setBearer('token-123');
    const req = api.get('/me');
    const headers = req.getRequest().requestInit.headers as Record<
      string,
      string
    >;

    expect(headers?.['Authorization']).toBe('Bearer token-123');
  });
});

describe('Aspi – retry configuration', () => {
  it('setRetry configures retries for new requests', () => {
    const api = new Aspi({
      baseUrl: 'https://api.example.com',
    });

    api.setRetry({
      retries: 3,
      retryDelay: 1000,
      retryOn: [500, 502],
    });

    const req = api.get('/users');
    const retryConfig = req.getRetryConfig();

    expect(retryConfig.retries).toBe(3);
    expect(retryConfig.retryDelay).toBe(1000);
    expect(retryConfig.retryOn).toEqual([500, 502]);
  });

  it('later setRetry calls merge into the existing config', () => {
    const api = new Aspi({ baseUrl: 'https://api.example.com' });

    api.setRetry({
      retries: 1,
      retryDelay: 500,
      retryOn: [500],
    });

    api.setRetry({
      retryDelay: 2000,
      retryOn: [429],
    });

    const req = api.get('/users');
    const retryConfig = req.getRetryConfig();

    expect(retryConfig.retries).toBe(1);
    expect(retryConfig.retryDelay).toBe(2000);
    expect(retryConfig.retryOn).toEqual([429]);
  });
});

describe('Aspi – modes: withResult and throwable', () => {
  it('withResult on Aspi makes new requests be in Result mode', () => {
    const api = new Aspi({ baseUrl: 'https://api.example.com' }).withResult();

    const req = api.get('/users');

    expect(req.isResult()).toBe(true);
    expect(req.isThrowable()).toBe(false);
  });

  it('throwable on Aspi makes new requests throw on error', () => {
    const api = new Aspi({ baseUrl: 'https://api.example.com' }).throwable();

    const req = api.get('/users');

    expect(req.isThrowable()).toBe(true);
    expect(req.isResult()).toBe(false);
  });

  it('switching between withResult and throwable affects only subsequent requests', () => {
    const api = new Aspi({ baseUrl: 'https://api.example.com' });

    const r1 = api.withResult().get('/1');
    expect(r1.isResult()).toBe(true);
    expect(r1.isThrowable()).toBe(false);

    const r2 = api.throwable().get('/2');
    expect(r2.isThrowable()).toBe(true);
    expect(r2.isResult()).toBe(false);

    const r3 = api.withResult().get('/3');
    expect(r3.isResult()).toBe(true);
    expect(r3.isThrowable()).toBe(false);
  });
});

describe('Aspi – middlewares', () => {
  it('use registers middlewares that modify the request init', () => {
    const api = new Aspi({
      baseUrl: 'https://api.example.com',
    });

    const api2 = api
      .use((init) => ({
        ...init,
        headers: {
          ...(init.headers ?? {}),
          'X-MW1': '1',
        },
      }))
      .use((init) => ({
        ...init,
        headers: {
          ...(init.headers ?? {}),
          'X-MW2': '2',
        },
      }));

    const req = api2.get('/users');
    const headers = req.getRequest().requestInit.headers as Record<
      string,
      string
    >;

    expect(headers['X-MW1']).toBe('1');
    expect(headers['X-MW2']).toBe('2');
  });
});

describe('Request – per-request overrides', () => {
  it('setBaseUrl on Request overrides Aspi baseUrl only for that Request', () => {
    const api = new Aspi({
      baseUrl: 'https://global.com',
    });

    const r1 = api.get('/users').setBaseUrl('https://local.com');

    expect(r1.getRequest().requestInit.baseUrl).toBe('https://local.com');

    const r2 = api.get('/other');
    expect(r2.getRequest().requestInit.baseUrl).toBe('https://global.com');
  });

  it('setHeaders on Request merges headers without affecting other requests', () => {
    const api = new Aspi({
      baseUrl: 'https://api.example.com',
      headers: {
        'Content-Type': 'application/json',
        'X-Global': '1',
      },
    });

    const r1 = api.get('/users').setHeaders({
      'X-Global': '2',
      'X-Req': 'abc',
    });

    const h1 = r1.getRequest().requestInit.headers as Record<string, string>;
    expect(h1['Content-Type']).toBe('application/json');
    expect(h1['X-Global']).toBe('2');
    expect(h1['X-Req']).toBe('abc');

    const r2 = api.get('/other');
    const h2 = r2.getRequest().requestInit.headers as Record<string, string>;
    expect(h2['X-Global']).toBe('1');
    expect(h2['X-Req']).toBeUndefined();
  });

  it('setHeader on Request adds header only to that Request (others unaffected)', () => {
    const api = new Aspi({
      baseUrl: 'https://api.example.com',
      headers: { 'Content-Type': 'application/json' },
    });

    const r1 = api.get('/users').setHeader('X-Req-One', 'value');

    const h1 = r1.getRequest().requestInit.headers as Record<string, string>;
    // still has global header
    expect(h1['Content-Type']).toBe('application/json');
    // plus the per-request header
    expect(h1['X-Req-One']).toBe('value');

    const r2 = api.get('/other');
    const h2 = r2.getRequest().requestInit.headers as Record<string, string>;
    // other request should not see the per-request header
    expect(h2['X-Req-One']).toBeUndefined();
  });

  it('setBearer on Request sets Authorization for that Request, others unchanged', () => {
    const api = new Aspi({
      baseUrl: 'https://api.example.com',
      headers: { 'X-Global': '1' },
    });

    const r1 = api.get('/me').setBearer('req-token');
    const h1 = r1.getRequest().requestInit.headers as Record<string, string>;

    expect(h1['Authorization']).toBe('Bearer req-token');
    // still has global header
    expect(h1['X-Global']).toBe('1');

    const r2 = api.get('/no-auth');

    const h2 = r2.getRequest().requestInit.headers as Record<string, string>;

    // global header is still there
    expect(h2['X-Global']).toBe('1');
    // per-request Authorization did not leak
    expect(h2['Authorization']).toBeUndefined();
  });

  it('setQueryParams stores query params in the Request', () => {
    const api = new Aspi({
      baseUrl: 'https://api.example.com',
    });

    const r = api.get('/search').setQueryParams({ q: 'term', page: '2' });

    const req = r.getRequest();
    expect(req.queryParams).toBeInstanceOf(URLSearchParams);
    expect(req.queryParams?.get('q')).toBe('term');
    expect(req.queryParams?.get('page')).toBe('2');
  });

  it('setRetry on Request overrides Aspi retry config only for that Request', () => {
    const api = new Aspi({
      baseUrl: 'https://api.example.com',
    });

    api.setRetry({
      retries: 2,
      retryDelay: 500,
      retryOn: [500],
    });

    const r1 = api.get('/users').setRetry({
      retries: 5,
      retryOn: [429],
    });

    const cfg1 = r1.getRetryConfig();
    expect(cfg1.retries).toBe(5);
    expect(cfg1.retryDelay).toBe(500);
    expect(cfg1.retryOn).toEqual([429]);

    const r2 = api.get('/other');
    const cfg2 = r2.getRetryConfig();
    expect(cfg2.retries).toBe(2);
    expect(cfg2.retryOn).toEqual([500]);
  });

  it('withResult and throwable can be toggled per Request', () => {
    const api = new Aspi({
      baseUrl: 'https://api.example.com',
    }).withResult();

    const r1 = api.get('/users');
    expect(r1.isResult()).toBe(true);
    expect(r1.isThrowable()).toBe(false);

    const r2 = api.get('/users').throwable();
    expect(r2.isThrowable()).toBe(true);
    expect(r2.isResult()).toBe(false);

    const r3 = api.get('/users');
    expect(r3.isResult()).toBe(true);
    expect(r3.isThrowable()).toBe(false);
  });
});

describe('Request – URL building', () => {
  it('url() builds from baseUrl + path', () => {
    const api = new Aspi({
      baseUrl: 'https://example.com/api',
    });

    const r = api.get('/users');
    expect(r.url()).toBe('https://example.com/api/users');
  });

  it('url() includes query params', () => {
    const api = new Aspi({
      baseUrl: 'https://example.com',
    });

    const r = api.get('/search').setQueryParams({ q: 'test', page: '1' });

    expect(r.url()).toBe('https://example.com/search?q=test&page=1');
  });

  it('url() normalizes redundant slashes', () => {
    const api = new Aspi({
      baseUrl: 'https://example.com/',
    });

    const r = api.get('///users');
    expect(r.url()).toBe('https://example.com/users');
  });
});

describe('Error callbacks – high level usage', () => {
  it('Aspi.notFound registers handler and tag is visible in Request registry', () => {
    const api = new Aspi({
      baseUrl: 'https://api.example.com',
    }).notFound(({ response }) => ({
      message: `not found: ${response.status}`,
    }));

    const r = api.get('/users');
    const registry = r.getErrorCallbackRegistry();
    const tags = Object.values(registry).map((v) => v.tag);

    expect(tags).toContain('notFoundError');
  });

  it('Request.notFound registers handler only on that Request instance', () => {
    const api = new Aspi({ baseUrl: 'https://api.example.com' });

    const r1 = api.get('/one').notFound(() => ({ message: 'one' }));
    const reg1 = r1.getErrorCallbackRegistry();
    const tags1 = Object.values(reg1).map((v) => v.tag);
    expect(tags1).toContain('notFoundError');

    const r2 = api.get('/two');
    const reg2 = r2.getErrorCallbackRegistry();
    const tags2 = Object.values(reg2).map((v) => v.tag);
    expect(tags2).not.toContain('notFoundError');
  });
});
