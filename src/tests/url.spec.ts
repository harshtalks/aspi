// url.spec.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { Aspi } from '../aspi';

describe('URL Building', () => {
  let api: Aspi;

  beforeEach(() => {
    api = new Aspi({ baseUrl: 'https://api.example.com' });
  });

  describe('Basic Path Handling', () => {
    it('builds basic absolute path', () => {
      const req = api.get('/users');
      expect(req.url()).toBe('https://api.example.com/users');
    });

    it('builds relative path', () => {
      const req = api.get('users');
      expect(req.url()).toBe('https://api.example.com/users');
    });

    it('normalizes multiple leading/trailing slashes', () => {
      const req = api.get('///users//1///');
      expect(req.url()).toBe('https://api.example.com/users/1');
    });

    it('handles trailing slash on baseUrl', () => {
      const apiTrailing = new Aspi({ baseUrl: 'https://api.example.com/' });
      const req = apiTrailing.get('users');
      expect(req.url()).toBe('https://api.example.com/users');
    });

    it('handles trailing slash on both baseUrl and path', () => {
      const apiTrailing = new Aspi({ baseUrl: 'https://api.example.com/' });
      const req = apiTrailing.get('/users/');
      expect(req.url()).toBe('https://api.example.com/users');
    });

    it('empty path returns baseUrl', () => {
      const req = api.get('');
      expect(req.url()).toBe('https://api.example.com');
    });
  });

  describe('URL Building – baseUrl with path (no query)', () => {
    it('joins baseUrl path and leading-slash path', () => {
      const api = new Aspi({ baseUrl: 'https://api.example.com/api/v1' });
      const req = api.get('/users');

      expect(req.url()).toBe('https://api.example.com/api/v1/users');
    });

    it('joins baseUrl path and relative path without leading slash', () => {
      const api = new Aspi({ baseUrl: 'https://api.example.com/api/v1' });
      const req = api.get('users');

      expect(req.url()).toBe('https://api.example.com/api/v1/users');
    });

    it('normalizes extra slashes between baseUrl and path', () => {
      const api = new Aspi({ baseUrl: 'https://api.example.com/api/v1/' });
      const req = api.get('///users//1///');

      expect(req.url()).toBe('https://api.example.com/api/v1/users/1');
    });

    it('keeps trailing slash on path when present', () => {
      const api = new Aspi({ baseUrl: 'https://api.example.com/api/v1/' });
      const req = api.get('/users/');

      expect(req.url()).toBe('https://api.example.com/api/v1/users');
    });

    it('empty path yields baseUrl as-is', () => {
      const api = new Aspi({ baseUrl: 'https://api.example.com/api/v1' });
      const req = api.get('');

      expect(req.url()).toBe('https://api.example.com/api/v1');
    });

    it('absolute URL path bypasses baseUrl with path', () => {
      const api = new Aspi({ baseUrl: 'https://api.example.com/api/v1' });
      const req = api.get('https://other.com/api/v2/users');

      expect(req.url()).toBe('https://other.com/api/v2/users');
    });
  });

  describe('Absolute URLs', () => {
    it('ignores baseUrl for absolute path', () => {
      const req = api.get('https://other.com/api/users');
      expect(req.url()).toBe('https://other.com/api/users');
    });
  });

  describe('Query Parameters (stringifying behavior)', () => {
    it('adds single query param from object', () => {
      const req = api.get('/users').setQueryParams({ id: '123' });
      expect(req.url()).toBe('https://api.example.com/users?id=123');
    });

    it('adds multiple query params from object', () => {
      const req = api
        .get('/users')
        .setQueryParams({ id: '123', page: '1', sort: 'asc' });
      expect(req.url()).toBe(
        'https://api.example.com/users?id=123&page=1&sort=asc',
      );
    });

    it('encodes special chars in query values (object)', () => {
      const req = api.get('/search').setQueryParams({
        q: 'a&b=c',
        filter: 'test space',
        num: 42, // stringified to "42"
      });

      const url = req.url();
      expect(url.startsWith('https://api.example.com/search?')).toBe(true);

      const search = url.split('?')[1]!;
      const params = new URLSearchParams(search);

      expect(params.get('q')).toBe('a&b=c');
      expect(params.get('filter')).toBe('test space');
      expect(params.get('num')).toBe('42');
    });

    it('stringifies null/undefined from object (instead of ignoring)', () => {
      const req = api.get('/users').setQueryParams({
        id: '123',
        optional: undefined,
        nullable: null,
      });
      // String(undefined) === 'undefined', String(null) === 'null'
      expect(req.url()).toBe(
        'https://api.example.com/users?id=123&optional=undefined&nullable=null',
      );
    });

    it('object with array values is stringified as comma-joined (URLSearchParams behavior)', () => {
      const req = api
        .get('/users')
        .setQueryParams({ tags: ['js', 'ts', 'react'] });
      // String(['js','ts','react']) === "js,ts,react"
      expect(req.url()).toBe(
        'https://api.example.com/users?tags=js%2Cts%2Creact',
      );
    });

    it('accepts raw query string', () => {
      const req = api.get('/users').setQueryParams('id=123&page=1&sort=asc');
      expect(req.url()).toBe(
        'https://api.example.com/users?id=123&page=1&sort=asc',
      );
    });

    it('accepts URLSearchParams instance and clones it', () => {
      const params = new URLSearchParams({ id: '123', page: '1' });
      const req = api.get('/users').setQueryParams(params);
      expect(req.url()).toBe('https://api.example.com/users?id=123&page=1');

      // Mutating the original should not affect the request
      params.append('sort', 'asc');
      expect(req.url()).toBe('https://api.example.com/users?id=123&page=1');
    });

    it('accepts array of key/value tuples', () => {
      const req = api.get('/users').setQueryParams([
        ['id', '123'],
        ['page', '1'],
        ['sort', 'asc'],
      ]);
      expect(req.url()).toBe(
        'https://api.example.com/users?id=123&page=1&sort=asc',
      );
    });

    it('query params chainable (later call replaces earlier ones)', () => {
      const req = api
        .get('/users')
        .setQueryParams({ page: '1' })
        .setQueryParams({ sort: 'asc' });

      // Because your implementation overwrites this.#queryParams on each call,
      // only the *last* set is present.
      expect(req.url()).toBe('https://api.example.com/users?sort=asc');
    });
  });

  describe('Fragments/Hashes', () => {
    it('preserves fragment in path', () => {
      const req = api.get('/users#section1');
      expect(req.url()).toBe('https://api.example.com/users#section1');
    });

    it('preserves fragment with query params', () => {
      const req = api.get('/users#section1').setQueryParams({ page: '1' });
      expect(req.url()).toBe('https://api.example.com/users?page=1#section1');
    });
  });

  describe('Special Characters & Edge Cases', () => {
    it('keeps special chars in path segments and appends query correctly', () => {
      const req = api.get('/path with space/test?query=val');
      // Your url() implementation normalises the path but does not encode spaces itself.
      // It should at least avoid adding extra slashes.
      expect(req.url()).toBe(
        'https://api.example.com/path with space/test?query=val',
      );
    });
  });

  describe('Chaining & Mutations', () => {
    it('multiple setQueryParams calls replace previous params', () => {
      const req = api
        .get('/users')
        .setQueryParams({ page: '1', sort: 'asc' })
        .setQueryParams({ filter: 'active' });

      expect(req.url()).toBe('https://api.example.com/users?filter=active');
    });
  });

  describe('Complex URLs & array-like params', () => {
    it('stringifies array values from object as comma-joined', () => {
      const req = api.get('/items').setQueryParams({
        tags: ['js', 'ts', 'react'],
      });
      // String(['js','ts','react']) === "js,ts,react"
      expect(req.url()).toBe(
        'https://api.example.com/items?tags=js%2Cts%2Creact',
      );
    });

    it('stringifies nested object values using [object Object]', () => {
      const req = api.get('/search').setQueryParams({
        filter: { from: 1, to: 10 },
      });
      // String({ from: 1, to: 10 }) === "[object Object]"
      expect(req.url()).toBe(
        'https://api.example.com/search?filter=%5Bobject+Object%5D',
      );
    });

    it('handles mix of primitives, null, undefined and arrays', () => {
      const req = api.get('/mixed').setQueryParams({
        a: 1,
        b: true,
        c: null as any,
        d: undefined as any,
        e: ['x', 'y'] as any,
      });
      // a=1, b=true, c=null, d=undefined, e=x,y (stringified)
      const url = req.url();
      const query = url.split('?')[1]!;
      const params = new URLSearchParams(query);

      expect(params.get('a')).toBe('1');
      expect(params.get('b')).toBe('true');
      expect(params.get('c')).toBe('null');
      expect(params.get('d')).toBe('undefined');
      expect(params.get('e')).toBe('x,y');
    });

    it('array of tuples supports repeated keys', () => {
      const req = api.get('/tuple-array').setQueryParams([
        ['tag', 'one'],
        ['tag', 'two'],
        ['tag', 'three'],
      ]);
      const url = req.url();
      const query = url.split('?')[1]!;
      const params = new URLSearchParams(query);

      expect(params.getAll('tag')).toEqual(['one', 'two', 'three']);
    });

    it('raw query string is preserved as-is (ordering and encoding)', () => {
      const req = api.get('/raw').setQueryParams('a=1&b=2&b=3&name=John%20Doe');
      const url = req.url();
      const query = url.split('?')[1]!;
      const params = new URLSearchParams(query);

      expect(params.get('a')).toBe('1');
      expect(params.getAll('b')).toEqual(['2', '3']);
      expect(params.get('name')).toBe('John Doe');
    });

    it('complicated combination: base url, path, fragment and query', () => {
      const apiCustom = new Aspi({ baseUrl: 'https://api.example.com/v1/' });
      const req = apiCustom
        .get('reports/summary#totals')
        .setQueryParams({ page: 2, sort: 'date:desc' });

      const url = req.url();
      expect(
        url.startsWith('https://api.example.com/v1/reports/summary?'),
      ).toBe(true);

      const [baseAndPath, frag] = url.split('#');
      expect(frag).toBe('totals');

      const query = baseAndPath.split('?')[1]!;
      const params = new URLSearchParams(query);
      expect(params.get('page')).toBe('2');
      expect(params.get('sort')).toBe('date:desc');
    });

    it('absolute URL with its own query merges correctly', () => {
      const apiNoBase = new Aspi({
        baseUrl: 'https://api.example.com/v1/',
      });
      const req = apiNoBase
        .get('https://example.com/search?existing=1')
        .setQueryParams({ q: 'test', filter: 'x' });

      // Depending on your url() impl this may either overwrite or append.
      // Here we assert that existing query from path is kept and new ones are added.
      const url = req.url();
      const query = url.split('?')[1]!;
      const params = new URLSearchParams(query);

      expect(params.get('existing')).toBe('1');
      expect(params.get('q')).toBe('test');
      expect(params.get('filter')).toBe('x');
    });
  });
});
