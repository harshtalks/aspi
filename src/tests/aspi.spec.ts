// aspi.test.ts
import { describe, it, expect, vi } from 'vitest';
import { Aspi } from '../aspi';
import { createBaseConfig, setupFetchMock } from './utils';
import { httpErrors } from '../http';
import { Request } from '../request';

setupFetchMock();

describe('Aspi – basic HTTP methods', () => {
  it('creates GET request with correct method and URL', () => {
    const api = new Aspi(createBaseConfig());
    const req = api.get('/users');

    expect(req).toBeInstanceOf(Request);
    expect(req.url()).toBe('https://api.example.com/users');
  });

  it('creates other HTTP methods (POST, PUT, PATCH, DELETE, HEAD, OPTIONS)', () => {
    const api = new Aspi(createBaseConfig());

    expect(api.post('/users').url()).toBe('https://api.example.com/users');
    expect(api.put('/users/1').url()).toBe('https://api.example.com/users/1');
    expect(api.patch('/users/1').url()).toBe('https://api.example.com/users/1');
    expect(api.delete('/users/1').url()).toBe(
      'https://api.example.com/users/1',
    );
    expect(api.head('/users').url()).toBe('https://api.example.com/users');
    expect(api.options('/users').url()).toBe('https://api.example.com/users');
  });
});

describe('Aspi – configuration helpers', () => {
  it('setBaseUrl overrides base URL', () => {
    const api = new Aspi({ baseUrl: 'https://old.com' });
    const req = api.setBaseUrl('https://new.com').get('/path');

    expect(req.url()).toBe('https://new.com/path');
  });

  it('setHeaders merges headers', () => {
    const api = new Aspi({
      baseUrl: 'https://api.example.com',
      headers: { 'X-Default': '1' },
    });

    api.setHeaders({
      'Content-Type': 'application/json',
      'X-Default': '2',
    });

    const requestData = api.get('/users').getRequest();

    expect(requestData.requestInit.headers).toMatchObject({
      'Content-Type': 'application/json',
      'X-Default': '2',
    });
  });

  it('setHeader sets single header and overwrites existing', () => {
    const api = new Aspi({
      baseUrl: 'https://api.example.com',
      headers: { 'X-Token': 'old' },
    });

    api.setHeader('X-Token', 'new');
    const requestData = api.get('/users').getRequest();

    expect(new Headers(requestData.requestInit.headers).get('X-Token')).toBe(
      'new',
    );
  });

  it('setBearer sets Authorization header', () => {
    const api = new Aspi(createBaseConfig());
    api.setBearer('token123');

    const requestData = api.get('/users').getRequest();

    expect(
      new Headers(requestData.requestInit.headers).get('Authorization'),
    ).toBe('Bearer token123');
  });
});

describe('Aspi – middleware and retry configuration', () => {
  it('use() registers middleware and transforms requests', () => {
    const api = new Aspi(createBaseConfig()).use((req) => ({
      ...req,
      headers: { ...(req.headers ?? {}), 'X-MW': '1' },
    }));

    const req = api.get('/users');
    const requestData = req.getRequest();

    expect(new Headers(requestData.requestInit.headers).get('X-MW')).toBe('1');
  });

  it('setRetry merges retry configuration', () => {
    const api = new Aspi({
      baseUrl: 'https://api.example.com',
      retryConfig: { retries: 1 },
    });

    api.setRetry({ retries: 3, retryDelay: 1000 });
    const req = api.get('/users');
    const requestRetryConfig = req.getRetryConfig();

    expect(requestRetryConfig.retries).toBe(3);
    expect(requestRetryConfig.retryDelay).toBe(1000);
  });
});

describe('Aspi – error registration helpers', () => {
  it('error() registers custom error callbacks keyed by status', () => {
    const api = new Aspi(createBaseConfig());
    const cb = vi.fn().mockReturnValue({ message: 'Bad request' });

    api.error('customBadRequest', 'BAD_REQUEST', cb);
    const callbacks = api.get('/users').getErrorCallbackRegistry();
    const statusCode = httpErrors.BAD_REQUEST;

    expect(callbacks[statusCode]).toBeDefined();
    expect(callbacks[statusCode].cb).toBeTypeOf('function');
    expect(callbacks[statusCode].tag).toBe('customBadRequest');
  });

  it('convenience error helpers register handlers', () => {
    const api = new Aspi(createBaseConfig())
      .notFound(() => ({ message: 'Not found' }))
      .tooManyRequests(() => ({ message: 'Rate limited' }))
      .conflict(() => ({ message: 'Conflict' }))
      .badRequest(() => ({ message: 'Bad request' }))
      .unauthorized(() => ({ message: 'Unauthorized' }))
      .forbidden(() => ({ message: 'Forbidden' }))
      .notImplemented(() => ({ message: 'Not implemented' }))
      .internalServerError(() => ({ message: 'Server error' }));

    const callbacks = api.get('/users').getErrorCallbackRegistry();

    expect(Object.keys(callbacks).length).toBeGreaterThanOrEqual(8);
  });

  it('throwable() sets throwOnError flag', () => {
    const api = new Aspi(createBaseConfig()).throwable();
    const isThrowable = api.get('/users').isThrowable();

    expect(isThrowable).toBe(true);
  });
});
