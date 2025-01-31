export type Ok<T> = { __tag: 'ok'; value: T };
export type Err<E> = { __tag: 'err'; error: E };

/**
 * Represents either a successful value of type T or an error of type E
 * @example
 * const success: Result<number, string> = { __tag: "ok", value: 42 };
 * const failure: Result<number, string> = { __tag: "err", error: "not found" };
 */
export type Result<T, E> = Ok<T> | Err<E>;

/**
 * Creates a successful Result
 * @example
 * const result = ok(42);
 * // { __tag: "ok", value: 42 }
 */
export const ok = <T>(value: T): Ok<T> => ({ __tag: 'ok', value });

/**
 * Creates a failed Result
 * @example
 * const result = err("not found");
 * // { __tag: "err", error: "not found" }
 */
export const err = <E>(error: E): Err<E> => ({ __tag: 'err', error });

/**
 * Returns true if the result is a success
 * @example
 * const result = ok(42);
 * isOk(result) // true
 *
 * const error = err("not found");
 * isOk(error) // false
 */
export const isOk = <T, E>(result: Result<T, E>): result is Ok<T> =>
  result.__tag === 'ok';

/**
 * Returns true if the result is a failure
 * @example
 * const result = ok(42);
 * isErr(result) // false
 *
 * const error = err("not found");
 * isErr(error) // true
 */
export const isErr = <T, E>(result: Result<T, E>): result is Err<E> =>
  !isOk(result);

/**
 * Maps a function over the value of a successful Result
 * @param fn - Function to map over the successful value
 * @param self - The Result to map over
 * @returns A new Result with the mapped value if successful, or the original error if failed
 * @example
 * // Direct style
 * const result = ok(42);
 * map(result, (x) => x * 2) // { __tag: "ok", value: 84 }
 *
 * const error = err("not found");
 * map(error, (x) => x * 2) // { __tag: "err", error: "not found" }
 *
 * // Curried style
 * const double = map((x: number) => x * 2);
 * double(ok(42)) // { __tag: "ok", value: 84 }
 * double(err("not found")) // { __tag: "err", error: "not found" }
 */
export function map<T, E, U>(
  fn: (value: T) => U,
): (self: Result<T, E>) => Result<U, E>;
export function map<T, E, U>(
  self: Result<T, E>,
  fn: (value: T) => U,
): Result<U, E>;
export function map<T, E, U>(
  selfOrFn: Result<T, E> | ((value: T) => U),
  fn?: (value: T) => U,
): Result<U, E> | ((self: Result<T, E>) => Result<U, E>) {
  if (fn) {
    // Direct style: map(result, fn)
    const self = selfOrFn as Result<T, E>;
    return isOk(self) ? ok(fn(self.value)) : self;
  } else {
    // Curried style: map(fn)(result)
    const mappingFn = selfOrFn as (value: T) => U;
    return (self: Result<T, E>) =>
      isOk(self) ? ok(mappingFn(self.value)) : self;
  }
}

/**
 * Maps a function over the error of a failed Result
 * @param fn - Function to map over the error value
 * @param self - The Result to map over
 * @returns A new Result with the mapped error if failed, or the original value if successful
 * @example
 * // Direct style
 * const result = ok(42);
 * mapErr(result, (e) => e.toUpperCase()) // { __tag: "ok", value: 42 }
 *
 * const error = err("not found");
 * mapErr(error, (e) => e.toUpperCase()) // { __tag: "err", error: "NOT FOUND" }
 *
 * // Curried style
 * const toUpper = mapErr((e: string) => e.toUpperCase());
 * toUpper(ok(42)) // { __tag: "ok", value: 42 }
 * toUpper(err("not found")) // { __tag: "err", error: "NOT FOUND" }
 */
export function mapErr<T, E, U>(
  fn: (error: E) => U,
): (self: Result<T, E>) => Result<T, U>;
export function mapErr<T, E, U>(
  self: Result<T, E>,
  fn: (error: E) => U,
): Result<T, U>;
export function mapErr<T, E, U>(
  selfOrFn: Result<T, E> | ((error: E) => U),
  fn?: (error: E) => U,
): Result<T, U> | ((self: Result<T, E>) => Result<T, U>) {
  if (fn) {
    // Direct style: mapErr(result, fn)
    const self = selfOrFn as Result<T, E>;
    return isErr(self) ? err(fn(self.error)) : self;
  } else {
    // Curried style: mapErr(fn)(result)
    const mappingFn = selfOrFn as (error: E) => U;
    return (self: Result<T, E>) =>
      isErr(self) ? err(mappingFn(self.error)) : self;
  }
}

/**
 * Pattern matches on a Result, calling onOk if successful or onErr if failed
 * @example
 * const result = ok(42);
 * match(result, {
 *   onOk: (x) => `Got ${x}`,
 *   onErr: (e) => `Error: ${e}`
 * }) // "Got 42"
 *
 * const error = err("not found");
 * match(error, {
 *   onOk: (x) => `Got ${x}`,
 *   onErr: (e) => `Error: ${e}`
 * }) // "Error: not found"
 */
export function match<T, E, U>(handlers: {
  onOk: (value: T) => U;
  onErr: (error: E) => U;
}): (self: Result<T, E>) => U;
export function match<T, E, U, V>(
  self: Result<T, E>,
  handlers: {
    onOk: (value: T) => U;
    onErr: (error: E) => V;
  },
): U | V;
export function match<T, E, U, V>(
  selfOrHandlers:
    | Result<T, E>
    | { onOk: (value: T) => U; onErr: (error: E) => V },
  handlers?: { onOk: (value: T) => U; onErr: (error: E) => V },
): ((self: Result<T, E>) => U) | U | V {
  if (handlers) {
    // Direct style: match(result, handlers)
    const self = selfOrHandlers as Result<T, E>;
    return isOk(self) ? handlers.onOk(self.value) : handlers.onErr(self.error);
  } else {
    // Curried style: match(handlers)(result)
    const handlersObj = selfOrHandlers as {
      onOk: (value: T) => U;
      onErr: (error: E) => V;
    };
    // @ts-ignore
    return (self: Result<T, E>) =>
      isOk(self) ? handlersObj.onOk(self.value) : handlersObj.onErr(self.error);
  }
}

/**
 * Returns the value of a successful Result, or null if it's a failure
 * @example
 * const result = ok(42);
 * getOrNull(result) // 42
 *
 * const error = err("not found");
 * getOrNull(error) // null
 */
export const getOrNull = <T, E>(result: Result<T, E>): T | null => {
  if (isOk(result)) {
    return result.value;
  } else {
    return null;
  }
};

/**
 * Returns the error of a failed Result, or null if it's a success
 * @example
 * const result = ok(42);
 * getErrorOrNull(result) // null
 *
 * const error = err("not found");
 * getErrorOrNull(error) // "not found"
 */
export const getErrorOrNull = <T, E>(result: Result<T, E>): E | null => {
  if (isErr(result)) {
    return result.error;
  } else {
    return null;
  }
};

/**
 * Returns the value of a successful Result, or a fallback value if it's a failure
 * @example
 * const result = ok(42);
 * getOrElse(result, 0) // 42
 *
 * const error = err("not found");
 * getOrElse(error, 0) // 0
 */
export const getOrElse = <T, E>(result: Result<T, E>, fallback: T): T =>
  isOk(result) ? result.value : fallback;

/**
 * Returns the value of a successful Result, or throws the error if it's a failure
 * @example
 * const result = ok(42);
 * getOrThrow(result) // 42
 *
 * const error = err("not found");
 * getOrThrow(error) // throws "not found"
 */
export const getOrThrow = <T, E>(result: Result<T, E>): T => {
  if (isOk(result)) {
    return result.value;
  } else {
    throw result.error;
  }
};

/**
 * Returns the value of a successful Result, or throws a transformed error if it's a failure
 * @example
 * const result = ok(42);
 * getOrThrowWith(result, (e) => new Error(e)) // 42
 *
 * const error = err("not found");
 * getOrThrowWith(error, (e) => new Error(e)) // throws Error("not found")
 */
export function getOrThrowWith<T, E, R>(
  fn: (error: E) => R,
): (self: Result<T, E>) => T;
export function getOrThrowWith<T, E, R>(
  self: Result<T, E>,
  fn: (error: E) => R,
): T;
export function getOrThrowWith<T, E, R>(
  selfOrFn: Result<T, E> | ((error: E) => R),
  fn?: (error: E) => R,
): T | ((self: Result<T, E>) => T) {
  if (fn) {
    // Direct style: getOrThrowWith(result, fn)
    const self = selfOrFn as Result<T, E>;
    if (isOk(self)) {
      return self.value;
    } else {
      throw fn(self.error);
    }
  } else {
    // Curried style: getOrThrowWith(fn)(result)
    const throwFn = selfOrFn as (error: E) => R;
    return (self: Result<T, E>) => {
      if (isOk(self)) {
        return self.value;
      } else {
        throw throwFn(self.error);
      }
    };
  }
}

/**
 * Handles an error with a specific tag by running a callback function
 * @example
 * type NetworkError = { tag: "timeout"; duration: number } | { tag: "offline" };
 *
 * const error: NetworkError = { tag: "timeout", duration: 5000 };
 * catchError(error, "timeout", (e) => {
 *   console.log(`Request timed out after ${e.duration}ms`);
 * });
 *
 * const result = err<number, NetworkError>({ tag: "offline" });
 * catchError(result, "offline", () => {
 *   console.log("No internet connection");
 * }); // { __tag: "ok", value: null }
 */
export function catchError<T, E extends { tag: string }, Tag extends E['tag']>(
  result: Result<T, E>,
  tag: Tag,
  fn: (error: Extract<E, { tag: Tag }>) => void,
): Result<T, Exclude<E, { tag: Tag }>>;
export function catchError<T, E extends { tag: string }, Tag extends E['tag']>(
  error: E,
  tag: Tag,
  fn: (error: Extract<E, { tag: Tag }>) => void,
): void;
export function catchError<T, E extends { tag: string }, Tag extends E['tag']>(
  tag: Tag,
  fn: (error: Extract<E, { tag: Tag }>) => void,
): (result: Result<T, E>) => Result<T, Exclude<E, { tag: Tag }>>;
export function catchError<T, E extends { tag: string }, Tag extends E['tag']>(
  tag: Tag,
  fn: (error: Extract<E, { tag: Tag }>) => void,
): (error: E) => void;
export function catchError<T, E extends { tag: string }, Tag extends E['tag']>(
  resultOrErrorOrTag: Result<T, E> | E | Tag,
  tagOrFn: Tag | ((error: Extract<E, { tag: Tag }>) => void),
  fnOrUndefined?: (error: Extract<E, { tag: Tag }>) => void,
): any {
  if (typeof resultOrErrorOrTag === 'string') {
    // Curried style
    const tag = resultOrErrorOrTag;
    const fn = tagOrFn as (error: Extract<E, { tag: Tag }>) => void;
    return (resultOrError: Result<T, E> | E) => {
      if ('__tag' in resultOrError) {
        const result = resultOrError;
        if (isErr(result) && result.error.tag === tag) {
          fn(result.error as Extract<E, { tag: Tag }>);
          return ok(null) as Result<T, Exclude<E, { tag: Tag }>>;
        }
        return result as Result<T, Exclude<E, { tag: Tag }>>;
      }
      const error = resultOrError;
      if (error.tag === tag) {
        fn(error as Extract<E, { tag: Tag }>);
      }
    };
  } else {
    // Direct style
    const resultOrError = resultOrErrorOrTag;
    const tag = tagOrFn as Tag;
    const fn = fnOrUndefined!;
    if ('__tag' in resultOrError) {
      const result = resultOrError;
      if (isErr(result) && result.error.tag === tag) {
        fn(result.error as Extract<E, { tag: Tag }>);
        return ok(null) as Result<T, Exclude<E, { tag: Tag }>>;
      }
      return result as Result<T, Exclude<E, { tag: Tag }>>;
    }
    const error = resultOrError;
    if (error.tag === tag) {
      fn(error as Extract<E, { tag: Tag }>);
    }
  }
}

/**
 * Catches all errors in a Result by running a callback function
 * @param result - The Result to handle errors for
 * @param fn - Function to handle any error
 * @returns The original Result
 * @example
 * const result = err<number, string>("not found");
 *
 * // Direct style
 * catchAllErrors(result, (e) => {
 *   console.log(`Error occurred: ${e}`);
 * }); // { __tag: "ok", value: null }
 *
 * // Curried style
 * const handleError = catchAllErrors((e: string) => {
 *   console.log(`Error occurred: ${e}`);
 * });
 * handleError(result); // { __tag: "ok", value: null }
 */
export function catchAllErrors<T, E>(
  result: Result<T, E>,
  fn: (error: E) => void,
): Result<T, never>;
export function catchAllErrors<T, E>(
  fn: (error: E) => void,
): (result: Result<T, E>) => Result<T, never>;
export function catchAllErrors<T, E>(
  resultOrFn: Result<T, E> | ((error: E) => void),
  fnOrUndefined?: (error: E) => void,
): any {
  if ('__tag' in resultOrFn) {
    const result = resultOrFn;
    if (isErr(result)) {
      fnOrUndefined!(result.error);
    }

    return result;
  }

  return (result: Result<T, E>) => {
    if (isErr(result)) {
      fnOrUndefined!(result.error);
    }

    return result;
  };
}

/**
 * Catches specific error tags using handler functions
 * @param result - The Result to handle errors for
 * @param handlers - Object mapping error tags to handler functions
 * @returns Result with handled error tags excluded from error type
 * @example
 * type NetworkError = { tag: "timeout"; duration: number } | { tag: "offline" };
 *
 * const result = err<number, NetworkError>({ tag: "timeout", duration: 5000 });
 * catchErrors(result, {
 *   timeout: (e) => console.log(`Timed out after ${e.duration}ms`),
 *   offline: () => console.log("No internet connection")
 * }); // { __tag: "ok", value: null }
 */
export function catchErrors<T, E extends { tag: string }, Key extends E['tag']>(
  result: Result<T, E>,
  handlers: {
    [K in Key]?: (error: Extract<E, { tag: K }>) => void;
  },
): Result<T, Exclude<E, { tag: keyof typeof handlers }>>;
export function catchErrors<
  T,
  E extends { tag: string },
  Key extends E['tag'],
>(handlers: {
  [K in Key]?: (error: Extract<E, { tag: K }>) => void;
}): (
  result: Result<T, E>,
) => Result<T, Exclude<E, { tag: keyof typeof handlers }>>;
export function catchErrors<T, E extends { tag: string }, Key extends E['tag']>(
  resultOrHandlers:
    | Result<T, E>
    | { [K in Key]?: (error: Extract<E, { tag: K }>) => void },
  handlersOrUndefined?: {
    [K in Key]?: (error: Extract<E, { tag: K }>) => void;
  },
): any {
  if ('__tag' in resultOrHandlers) {
    const result = resultOrHandlers;
    if (isErr(result)) {
      // @ts-ignore
      const handler = handlersOrUndefined[result.error.tag];
      if (handler) {
        handler(result.error);
      }
    }

    return result;
  } else {
    return (result: Result<T, E>) => {
      if (isErr(result)) {
        // @ts-ignore
        const handler = handlersOrUndefined[result.error.tag];
        if (handler) {
          handler(result.error);
        }
      }

      return result;
    };
  }
}

/**
 * Creates a chainable pipeline to transform a Result through a series of operations.
 * @param result - The initial Result to transform
 * @param ab - First transformation function to apply to the Result
 * @returns A chainable function with pipe() for adding more transformations and execute() to run the pipeline
 * @example
 * pipe(
 *   ok(5),
 *   (a) => ok(a.value * 2)
 * )
 * .pipe(b => ok(b.value + 1))
 * .execute() // { __tag: "ok", value: 11 }
 */
export const pipe = <AI, AE, BI, BE>(
  result: Result<AI, AE>,
  ab: (a: Result<AI, AE>) => Result<BI, BE>,
) => {
  function run(a: Result<AI, AE>) {
    return ab(a);
  }

  run.pipe = <CI, CE>(bc: (b: Result<BI, BE>) => Result<CI, CE>) =>
    pipe(result, (a: Result<AI, AE>) => bc(ab(a)));

  run.execute = () => run(result);

  return run;
};
