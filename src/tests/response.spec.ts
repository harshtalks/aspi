// response-types.test.ts
import { describe, it, expect, vi } from 'vitest';
import { Request } from '../request';
import { AspiError } from '../error';
import * as Result from '../result';
import type { AspiRequestInit, RequestOptions } from '../types';
import { setupFetchMock, createBaseConfig } from './utils';

setupFetchMock();

const createRequestOptions = (
  overrides?: Partial<RequestOptions<AspiRequestInit>>,
): RequestOptions<AspiRequestInit> => ({
  requestConfig: createBaseConfig(),
  middlewares: [],
  errorCbs: {},
  throwOnError: false,
  ...overrides,
});

describe('Response – JSON responses', () => {
  it('parses valid JSON response correctly', async () => {
    const data = { id: 1, name: 'John', email: 'john@example.com' };

    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(data), {
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const req = new Request(
      'GET',
      '/users/1',
      createRequestOptions(),
    ).withResult();
    const result = await req.json();

    expect(Result.isOk(result)).toBe(true);
    if (Result.isOk(result)) {
      expect(result.value.data).toEqual(data);
      expect(result.value.response.status).toBe(200);
    }
  });

  it('handles empty JSON object response', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({}), {
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const req = new Request(
      'GET',
      '/empty',
      createRequestOptions(),
    ).withResult();
    const result = await req.json();

    expect(Result.isOk(result)).toBe(true);
    if (Result.isOk(result)) {
      expect(result.value.data).toEqual({});
    }
  });

  it('handles JSON array response', async () => {
    const data = [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
      { id: 3, name: 'Charlie' },
    ];

    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(data), {
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const req = new Request(
      'GET',
      '/users',
      createRequestOptions(),
    ).withResult();
    const result = await req.json<typeof data>();

    expect(Result.isOk(result)).toBe(true);
    if (Result.isOk(result)) {
      expect(Array.isArray(result.value.data)).toBe(true);
      expect(result.value.data).toHaveLength(3);
      expect(result.value.data[0].name).toBe('Alice');
    }
  });

  it('handles nested JSON structures', async () => {
    const data = {
      user: {
        id: 1,
        profile: {
          name: 'John',
          address: {
            city: 'New York',
            country: 'USA',
          },
        },
        tags: ['developer', 'admin'],
      },
    };

    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(data), {
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const req = new Request(
      'GET',
      '/users/1/full',
      createRequestOptions(),
    ).withResult();
    const result = await req.json<typeof data>();

    expect(Result.isOk(result)).toBe(true);
    if (Result.isOk(result)) {
      expect(result.value.data.user.profile.address.city).toBe('New York');
      expect(result.value.data.user.tags).toContain('developer');
    }
  });

  it('returns parseError for malformed JSON', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response('{ invalid json }', {
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
      expect(result.error.tag).toBe('jsonParseError');
    }
  });

  it('handles JSON response without Content-Type header', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 1 }), {
        status: 200,
        statusText: 'OK',
      }),
    );

    const req = new Request(
      'GET',
      '/users/1',
      createRequestOptions(),
    ).withResult();
    const result = await req.json();

    expect(Result.isOk(result)).toBe(true);
  });

  it('handles JSON with special characters and unicode', async () => {
    const data = {
      name: 'José García',
      message: 'Hello 世界 🌍',
      emoji: '🚀',
    };

    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(data), {
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      }),
    );

    const req = new Request(
      'GET',
      '/messages',
      createRequestOptions(),
    ).withResult();
    const result = await req.json<typeof data>();

    expect(Result.isOk(result)).toBe(true);
    if (Result.isOk(result)) {
      expect(result.value.data.name).toBe('José García');
      expect(result.value.data.emoji).toBe('🚀');
    }
  });
});

describe('Response – Text responses', () => {
  it('parses plain text response', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response('Hello, World!', {
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'text/plain' },
      }),
    );

    const req = new Request(
      'GET',
      '/text',
      createRequestOptions(),
    ).withResult();
    const result = await req.text();

    expect(Result.isOk(result)).toBe(true);
    if (Result.isOk(result)) {
      expect(result.value.data).toBe('Hello, World!');
    }
  });

  it('handles empty text response', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response('', {
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'text/plain' },
      }),
    );

    const req = new Request(
      'GET',
      '/empty',
      createRequestOptions(),
    ).withResult();
    const result = await req.text();

    expect(Result.isOk(result)).toBe(true);
    if (Result.isOk(result)) {
      expect(result.value.data).toBe('');
    }
  });

  it('handles HTML response', async () => {
    const html = '<html><body><h1>Hello</h1></body></html>';

    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(html, {
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'text/html' },
      }),
    );

    const req = new Request(
      'GET',
      '/page',
      createRequestOptions(),
    ).withResult();
    const result = await req.text();

    expect(Result.isOk(result)).toBe(true);
    if (Result.isOk(result)) {
      expect(result.value.data).toContain('<h1>Hello</h1>');
    }
  });

  it('handles XML response', async () => {
    const xml = '<?xml version="1.0"?><root><item>test</item></root>';

    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(xml, {
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'application/xml' },
      }),
    );

    const req = new Request(
      'GET',
      '/data.xml',
      createRequestOptions(),
    ).withResult();
    const result = await req.text();

    expect(Result.isOk(result)).toBe(true);
    if (Result.isOk(result)) {
      expect(result.value.data).toContain('<item>test</item>');
    }
  });

  it('handles multi-line text response', async () => {
    const text = `Line 1
Line 2
Line 3`;

    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(text, {
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'text/plain' },
      }),
    );

    const req = new Request(
      'GET',
      '/multiline',
      createRequestOptions(),
    ).withResult();
    const result = await req.text();

    expect(Result.isOk(result)).toBe(true);
    if (Result.isOk(result)) {
      expect(result.value.data.split('\n')).toHaveLength(3);
    }
  });

  it('handles CSV response', async () => {
    const csv = `id,name,email
1,John,john@example.com
2,Jane,jane@example.com`;

    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(csv, {
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'text/csv' },
      }),
    );

    const req = new Request(
      'GET',
      '/export.csv',
      createRequestOptions(),
    ).withResult();
    const result = await req.text();

    expect(Result.isOk(result)).toBe(true);
    if (Result.isOk(result)) {
      expect(result.value.data).toContain('id,name,email');
      expect(result.value.data.split('\n')).toHaveLength(3);
    }
  });
});

describe('Response – Blob responses', () => {
  it('parses blob response', async () => {
    const blob = new Blob(['binary data'], {
      type: 'application/octet-stream',
    });

    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(blob, {
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'application/octet-stream' },
      }),
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
      expect(result.value.data.type).toBe('application/octet-stream');
    }
  });

  it('handles image blob response', async () => {
    const imageBlob = new Blob(['fake-image-data'], { type: 'image/png' });

    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(imageBlob, {
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'image/png' },
      }),
    );

    const req = new Request(
      'GET',
      '/image.png',
      createRequestOptions(),
    ).withResult();
    const result = await req.blob();

    expect(Result.isOk(result)).toBe(true);
    if (Result.isOk(result)) {
      expect(result.value.data).toBeInstanceOf(Blob);
      expect(result.value.data.type).toBe('image/png');
    }
  });

  it('handles PDF blob response', async () => {
    const pdfBlob = new Blob(['%PDF-1.4 fake pdf'], {
      type: 'application/pdf',
    });

    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(pdfBlob, {
        status: 200,
        statusText: 'OK',
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'attachment; filename="document.pdf"',
        },
      }),
    );

    const req = new Request(
      'GET',
      '/document.pdf',
      createRequestOptions(),
    ).withResult();
    const result = await req.blob();

    expect(Result.isOk(result)).toBe(true);
    if (Result.isOk(result)) {
      expect(result.value.data).toBeInstanceOf(Blob);
      expect(result.value.data.type).toBe('application/pdf');
      expect(
        result.value.response.response.headers.get('Content-Disposition'),
      ).toContain('document.pdf');
    }
  });

  it('handles video blob response', async () => {
    const videoBlob = new Blob(['fake-video-data'], { type: 'video/mp4' });

    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(videoBlob, {
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'video/mp4' },
      }),
    );

    const req = new Request(
      'GET',
      '/video.mp4',
      createRequestOptions(),
    ).withResult();
    const result = await req.blob();

    expect(Result.isOk(result)).toBe(true);
    if (Result.isOk(result)) {
      expect(result.value.data.type).toBe('video/mp4');
    }
  });

  it('handles empty blob response', async () => {
    const emptyBlob = new Blob([], { type: 'application/octet-stream' });

    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(emptyBlob, {
        status: 200,
        statusText: 'OK',
      }),
    );

    const req = new Request(
      'GET',
      '/empty-file',
      createRequestOptions(),
    ).withResult();
    const result = await req.blob();

    expect(Result.isOk(result)).toBe(true);
    if (Result.isOk(result)) {
      expect(result.value.data).toBeInstanceOf(Blob);
      expect(result.value.data.size).toBe(0);
    }
  });
});

describe('Response – Special HTTP status codes', () => {
  it('handles 204 No Content response with json()', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(null, {
        status: 204,
        statusText: 'No Content',
      }),
    );

    const req = new Request(
      'DELETE',
      '/users/1',
      createRequestOptions(),
    ).withResult();
    const result = await req.json();

    expect(Result.isOk(result)).toBe(true);
    if (Result.isOk(result)) {
      expect(result.value.response.status).toBe(204);
    }
  });

  it('handles 204 No Content response with text()', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(null, {
        status: 204,
        statusText: 'No Content',
      }),
    );

    const req = new Request(
      'DELETE',
      '/users/1',
      createRequestOptions(),
    ).withResult();
    const result = await req.text();

    expect(Result.isOk(result)).toBe(true);
    if (Result.isOk(result)) {
      expect(result.value.data).toBe('');
      expect(result.value.response.status).toBe(204);
    }
  });

  it('handles 304 Not Modified response', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(null, {
        status: 304,
        statusText: 'Not Modified',
        headers: {
          ETag: '"abc123"',
          'Last-Modified': 'Wed, 21 Oct 2024 07:28:00 GMT',
        },
      }),
    );

    const req = new Request(
      'GET',
      '/users/1',
      createRequestOptions({
        requestConfig: {
          ...createBaseConfig(),
          headers: {
            'If-None-Match': '"abc123"',
          },
        },
      }),
    ).withResult();

    const result = await req.json();

    expect(Result.isOk(result)).toBe(true);
    if (Result.isOk(result)) {
      expect(result.value.response.status).toBe(304);
      expect(result.value.response.response.headers.get('ETag')).toBe(
        '"abc123"',
      );
    }
  });

  it('handles 201 Created with location header', async () => {
    const data = { id: 123, name: 'New User' };

    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(data), {
        status: 201,
        statusText: 'Created',
        headers: {
          'Content-Type': 'application/json',
          Location: '/users/123',
        },
      }),
    );

    const req = new Request(
      'POST',
      '/users',
      createRequestOptions(),
    ).withResult();
    const result = await req.json<typeof data>();

    expect(Result.isOk(result)).toBe(true);
    if (Result.isOk(result)) {
      expect(result.value.response.status).toBe(201);
      expect(result.value.response.response.headers.get('Location')).toBe(
        '/users/123',
      );
      expect(result.value.data.id).toBe(123);
    }
  });

  it('handles 202 Accepted response', async () => {
    const data = { jobId: 'job-123', status: 'pending' };

    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(data), {
        status: 202,
        statusText: 'Accepted',
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const req = new Request(
      'POST',
      '/jobs',
      createRequestOptions(),
    ).withResult();
    const result = await req.json<typeof data>();

    expect(Result.isOk(result)).toBe(true);
    if (Result.isOk(result)) {
      expect(result.value.response.status).toBe(202);
      expect(result.value.data.status).toBe('pending');
    }
  });

  it('handles 206 Partial Content with range header', async () => {
    const partialData = 'partial content data';

    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(partialData, {
        status: 206,
        statusText: 'Partial Content',
        headers: {
          'Content-Type': 'text/plain',
          'Content-Range': 'bytes 0-19/100',
          'Content-Length': '20',
        },
      }),
    );

    const req = new Request(
      'GET',
      '/large-file',
      createRequestOptions({
        requestConfig: {
          ...createBaseConfig(),
          headers: {
            Range: 'bytes=0-19',
          },
        },
      }),
    ).withResult();

    const result = await req.text();

    expect(Result.isOk(result)).toBe(true);
    if (Result.isOk(result)) {
      expect(result.value.response.status).toBe(206);
      expect(result.value.response.response.headers.get('Content-Range')).toBe(
        'bytes 0-19/100',
      );
    }
  });
});

describe('Response – Error responses with different content types', () => {
  it('handles 400 with JSON error body', async () => {
    const errorData = {
      error: 'Validation failed',
      fields: {
        email: 'Invalid email format',
        age: 'Must be positive',
      },
    };

    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(errorData), {
        status: 400,
        statusText: 'Bad Request',
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const req = new Request(
      'POST',
      '/users',
      createRequestOptions(),
    ).withResult();
    const result = await req.json();

    expect(Result.isErr(result)).toBe(true);
    if (Result.isErr(result)) {
      expect(result.error).toBeInstanceOf(AspiError);
      if (result.error.tag === 'aspiError') {
        expect(result.error.response.status).toBe(400);
      }
    }
  });

  it('handles 404 with HTML error page', async () => {
    const errorHtml = '<html><body><h1>404 Not Found</h1></body></html>';

    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(errorHtml, {
        status: 404,
        statusText: 'Not Found',
        headers: { 'Content-Type': 'text/html' },
      }),
    );

    const req = new Request(
      'GET',
      '/missing',
      createRequestOptions(),
    ).withResult();
    const result = await req.text();

    expect(Result.isErr(result)).toBe(true);
    if (Result.isErr(result)) {
      expect(result.error).toBeInstanceOf(AspiError);
      expect(result.error.response.status).toBe(404);
    }
  });

  it('handles 500 with plain text error', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response('Internal Server Error', {
        status: 500,
        statusText: 'Internal Server Error',
        headers: { 'Content-Type': 'text/plain' },
      }),
    );

    const req = new Request(
      'GET',
      '/error',
      createRequestOptions(),
    ).withResult();
    const result = await req.text();

    expect(Result.isErr(result)).toBe(true);
    if (Result.isErr(result)) {
      expect(result.error).toBeInstanceOf(AspiError);
      expect(result.error.response.status).toBe(500);
    }
  });

  it('handles error response with custom error handler', async () => {
    const errorData = { code: 'NOT_FOUND', message: 'Resource not found' };

    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(errorData), {
        status: 404,
        statusText: 'Not Found',
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const handler = vi
      .fn()
      .mockReturnValue({ customMessage: 'Custom not found' });

    const req = new Request('GET', '/missing', createRequestOptions())
      .withResult()
      .notFound(handler);

    const result = await req.json();

    expect(Result.isErr(result)).toBe(true);
    expect(handler).toHaveBeenCalled();
    if (Result.isErr(result)) {
      expect(result.error.tag).toBe('notFoundError');
    }
  });
});

describe('Response – Response headers and metadata', () => {
  it('exposes response headers', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 1 }), {
        status: 200,
        statusText: 'OK',
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': 'req-123',
          'X-Rate-Limit-Remaining': '99',
        },
      }),
    );

    const req = new Request(
      'GET',
      '/users/1',
      createRequestOptions(),
    ).withResult();
    const result = await req.json();

    expect(Result.isOk(result)).toBe(true);
    if (Result.isOk(result)) {
      expect(result.value.response.response.headers.get('X-Request-ID')).toBe(
        'req-123',
      );
      expect(
        result.value.response.response.headers.get('X-Rate-Limit-Remaining'),
      ).toBe('99');
    }
  });

  it('provides access to full Response object', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 1 }), {
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const req = new Request(
      'GET',
      '/users/1',
      createRequestOptions(),
    ).withResult();
    const result = await req.json();

    expect(Result.isOk(result)).toBe(true);
    if (Result.isOk(result)) {
      expect(result.value.response.response).toBeInstanceOf(Response);
      expect(result.value.response.response.ok).toBe(true);
      expect(result.value.response.response.status).toBe(200);
    }
  });

  it('includes request details in response', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 1 }), {
        status: 200,
        statusText: 'OK',
      }),
    );

    const req = new Request('GET', '/users/1', createRequestOptions())
      .setQueryParams({ include: 'profile' })
      .withResult();

    const result = await req.json();

    expect(Result.isOk(result)).toBe(true);
    if (Result.isOk(result)) {
      expect(result.value.request.path).toBe('/users/1');
      expect(result.value.request.queryParams?.get('include')).toBe('profile');
    }
  });
});
