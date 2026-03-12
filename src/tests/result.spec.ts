// result.user-flow.spec.ts
import {
  ok,
  err,
  isOk,
  isErr,
  map,
  mapErr,
  match,
  getOrNull,
  getOrElse,
  getOrThrow,
  catchError,
  catchErrors,
  catchAllErrors,
  pipe,
  type Result,
} from '../result';
import { describe, it, expect, vi } from 'vitest';

type User = { id: number; name: string };
type HttpError =
  | { tag: 'BAD_REQUEST'; details?: string }
  | { tag: 'UNAUTHORIZED' }
  | { tag: 'NOT_FOUND' }
  | { tag: 'INTERNAL' };

/**
 * Example API that end users might write:
 * returns Result<User, HttpError>
 */
function fakeGetUser(id: number): Result<User, HttpError> {
  if (id === 0) return err({ tag: 'BAD_REQUEST', details: 'id must be > 0' });
  if (id === 401) return err({ tag: 'UNAUTHORIZED' });
  if (id === 404) return err({ tag: 'NOT_FOUND' });
  if (id === 500) return err({ tag: 'INTERNAL' });
  return ok({ id, name: `User-${id}` });
}

describe('basic happy paths (how users would consume it)', () => {
  it('handles a successful API call with isOk / getOrThrow', () => {
    const result = fakeGetUser(1);

    // Typical usage: guard with isOk or just getOrThrow
    if (isOk(result)) {
      expect(result.value.id).toBe(1);
    } else {
      // This branch shouldn't run here
      throw new Error('unexpected error');
    }

    const user = getOrThrow(result);
    expect(user.name).toBe('User-1');
  });

  it('handles an error with early return pattern', () => {
    const result = fakeGetUser(0); // BAD_REQUEST

    if (isErr(result)) {
      // end user can branch based on error.tag
      expect(result.error.tag).toBe('BAD_REQUEST');
      // @ts-expect-error
      expect(result.error.details).toBe('id must be > 0');
      return; // early return in handler
    }

    throw new Error('expected error');
  });

  it('can use getOrElse for “soft” defaults', () => {
    const r1 = fakeGetUser(2);
    const r2 = fakeGetUser(404);

    const name1 = getOrElse(
      map(r1, (u) => u.name),
      'anonymous',
    );
    const name2 = getOrElse(
      map(r2, (u) => u.name),
      'anonymous',
    );

    expect(name1).toBe('User-2');
    expect(name2).toBe('anonymous'); // NOT_FOUND → fallback
  });

  it('can use getOrNull for nullable results (e.g. optional chaining style)', () => {
    const r = fakeGetUser(404);
    const user = getOrNull(r);
    expect(user).toBeNull();
  });
});

describe('mapping and transformation flows', () => {
  it('maps successful values (e.g. DTO -> view model)', () => {
    const result = fakeGetUser(3);

    const view = map(result, (u) => ({
      label: `${u.id}: ${u.name}`,
    }));

    if (isOk(view)) {
      expect(view.value.label).toBe('3: User-3');
    } else {
      throw new Error('expected ok');
    }
  });

  it('maps errors (e.g. HttpError -> user-facing message)', () => {
    const result = fakeGetUser(404);

    const withMessage = mapErr(result, (e) => {
      switch (e.tag) {
        case 'BAD_REQUEST':
          return 'Invalid input';
        case 'UNAUTHORIZED':
          return 'Please sign in';
        case 'NOT_FOUND':
          return 'User not found';
        case 'INTERNAL':
          return 'Something went wrong';
      }
    });

    if (isErr(withMessage)) {
      expect(withMessage.error).toBe('User not found');
    } else {
      throw new Error('expected err');
    }
  });

  it('uses pipe to build a mini “data pipeline” from raw input', () => {
    const parseUserId = (raw: string): Result<number, string> =>
      /^\d+$/.test(raw) ? ok(Number(raw)) : err('INVALID_ID');

    const fetchUser = (id: number): Result<User, string> =>
      isOk(fakeGetUser(id)) ? ok({ id, name: `User-${id}` }) : err('NOT_FOUND');

    const toGreeting = (user: User) => `Hello ${user.name}`;

    const result = pipe(
      '10',
      (raw) => parseUserId(raw),
      (idResult) => map(idResult, (id) => id + 1), // increment
      (idResult) =>
        isOk(idResult) ? fetchUser(idResult.value) : err(idResult.error),
      (userResult) => map(userResult, toGreeting),
    );

    if (isOk(result)) {
      expect(result.value).toBe('Hello User-11');
    } else {
      throw new Error('expected ok');
    }
  });
});

describe('pattern matching usage', () => {
  it('uses match for clean control flow instead of if/else', () => {
    const result = fakeGetUser(404);

    const message = match(result, {
      onOk: (user) => `Found ${user.name}`,
      onErr: (err) => {
        switch (err.tag) {
          case 'BAD_REQUEST':
            return 'Bad request';
          case 'UNAUTHORIZED':
            return 'Please log in';
          case 'NOT_FOUND':
            return 'User does not exist';
          case 'INTERNAL':
            return 'Server error';
        }
      },
    });

    expect(message).toBe('User does not exist');
  });

  it('matches in curried style for reusable handlers', () => {
    const handleUserResult = match<User, HttpError, string>({
      onOk: (user) => `OK:${user.id}`,
      onErr: (err) => `ERR:${err.tag}`,
    });

    expect(handleUserResult(fakeGetUser(5))).toBe('OK:5');
    expect(handleUserResult(fakeGetUser(404))).toBe('ERR:NOT_FOUND');
  });
});

describe('tag-based error handling: catchError / catchErrors / catchAllErrors', () => {
  type NetworkError =
    | { tag: 'timeout'; duration: number }
    | { tag: 'offline' }
    | { tag: 'other' };

  it('catchError: handle a specific tag inline and continue', () => {
    const spy = vi.fn();
    const result: Result<number, NetworkError> = err({
      tag: 'timeout',
      duration: 3000,
    });

    // typical end-user style: “handle this one, but keep going”
    const after = catchError(result, 'timeout', (e) => {
      spy(e.duration);
    });

    expect(spy).toHaveBeenCalledWith(3000);
    // after is ok(null) but user usually just ignores the value
    expect(isOk(after)).toBe(true);
  });
});

describe('pipe in “business logic” style', () => {
  it('composes small transformations on plain values', () => {
    const fromCentsToLabel = (cents: number) =>
      pipe(
        cents,
        (n) => n / 100,
        (amount) => amount.toFixed(2),
        (amountStr) => `$${amountStr}`,
      );

    expect(fromCentsToLabel(12345)).toBe('$123.45');
  });

  it('composes Result-producing functions', () => {
    const parseJson = (raw: string): Result<unknown, string> => {
      try {
        return ok(JSON.parse(raw));
      } catch {
        return err('INVALID_JSON');
      }
    };

    const ensureObject = (
      value: unknown,
    ): Result<Record<string, unknown>, string> =>
      typeof value === 'object' && value !== null
        ? ok(value as any)
        : err('NOT_OBJECT');

    const extractField = (field: string) => (obj: Record<string, unknown>) =>
      field in obj ? ok(obj[field]) : err('MISSING_FIELD');

    const result = pipe(
      '{"name":"Alice"}',
      parseJson,
      (r) => (isOk(r) ? ensureObject(r.value) : r),
      (r) => (isOk(r) ? extractField('name')(r.value) : r),
    );

    if (isOk(result)) {
      expect(result.value).toBe('Alice');
    } else {
      throw new Error('expected ok');
    }
  });
});
