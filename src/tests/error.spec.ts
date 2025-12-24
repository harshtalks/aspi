// error.test.ts
import { describe, it, expect } from 'vitest';
import type { AspiRequest, AspiRequestInit, AspiResponse } from '../types';
import { AspiError, CustomError, isAspiError, isCustomError } from '../error';

const createDummyRequest = (): AspiRequest<AspiRequestInit> => ({
  path: '/users',
  requestInit: {
    baseUrl: 'https://api.example.com',
  } as AspiRequestInit,
  queryParams: null,
});

const createDummyResponse = (): AspiResponse<{ message: string }, true> => ({
  status: 404,
  statusText: 'NOT_FOUND',
  response: new Response('Not found', { status: 404, statusText: 'NOT_FOUND' }),
  responseData: { message: 'Not found' },
});

describe('AspiError', () => {
  it('stores tag, request, and response', () => {
    const request = createDummyRequest();
    const response = createDummyResponse();
    const err = new AspiError('Error message', request, response);

    expect(err.tag).toBe('aspiError');
    expect(err.request).toBe(request);
    expect(err.response.status).toBe(404);
  });

  it('ifMatch executes callback when status matches', () => {
    const request = createDummyRequest();
    const response = createDummyResponse();
    const err = new AspiError('Error message', request, response);

    const result = err.ifMatch(
      'NOT_FOUND',
      ({ request: req, response: res }) => {
        expect(req.path).toBe('/users');
        expect(res.status).toBe(404);
        return 'matched';
      },
    );

    expect(result).toBe('matched');
  });

  it('ifMatch returns undefined when status does not match', () => {
    const err = new AspiError(
      'Error message',
      createDummyRequest(),
      createDummyResponse(),
    );
    const result = err.ifMatch('BAD_REQUEST', () => 'should not run');

    expect(result).toBeUndefined();
  });
});

describe('CustomError', () => {
  it('stores tag and data', () => {
    const data = { message: 'Something went wrong' };
    const err = new CustomError('customError', data);

    expect(err.tag).toBe('customError');
    expect(err.data).toBe(data);
  });

  it('extends Error and has message property', () => {
    const err = new CustomError('myError', { code: 123 });

    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe('myError');
  });
});

describe('Type guards', () => {
  it('isAspiError narrows to AspiError', () => {
    const err = new AspiError(
      'Error',
      createDummyRequest(),
      createDummyResponse(),
    );

    if (isAspiError(err)) {
      expect(err.tag).toBe('aspiError');
      expect(err.response.status).toBe(404);
    } else {
      throw new Error('Expected isAspiError to be true');
    }
  });

  it('isCustomError narrows to CustomError', () => {
    const err = new CustomError('tag', { message: 'x' });

    if (isCustomError(err)) {
      expect(err.tag).toBe('tag');
      expect(err.data.message).toBe('x');
    } else {
      throw new Error('Expected isCustomError to be true');
    }
  });

  it('type guards return false for non-matching instances', () => {
    const err = new Error('normal');

    expect(isAspiError(err)).toBe(false);
    expect(isCustomError(err)).toBe(false);
  });

  it('isAspiError returns false for CustomError', () => {
    const err = new CustomError('custom', { data: 'value' });

    expect(isAspiError(err)).toBe(false);
  });
});
