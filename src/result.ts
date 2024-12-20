export type Ok<T> = { __tag: "ok"; value: T };
export type Err<E> = { __tag: "err"; error: E };

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
export const ok = <T>(value: T): Ok<T> => ({ __tag: "ok", value });

/**
 * Creates a failed Result
 * @example
 * const result = err("not found");
 * // { __tag: "err", error: "not found" }
 */
export const err = <E>(error: E): Err<E> => ({ __tag: "err", error });

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
  result.__tag === "ok";

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
 * @example
 * const result = ok(42);
 * map(result, (x) => x * 2) // { __tag: "ok", value: 84 }
 *
 * const error = err("not found");
 * map(error, (x) => x * 2) // { __tag: "err", error: "not found" }
 */
export const map = <T, E, U>(
  self: Result<T, E>,
  fn: (value: T) => U,
): Result<U, E> => (isOk(self) ? ok(fn(self.value)) : self);

/**
 * Maps a function over the error of a failed Result
 * @example
 * const result = ok(42);
 * mapErr(result, (e) => e.toUpperCase()) // { __tag: "ok", value: 42 }
 *
 * const error = err("not found");
 * mapErr(error, (e) => e.toUpperCase()) // { __tag: "err", error: "NOT FOUND" }
 */
export const mapErr = <T, E, U>(
  self: Result<T, E>,
  fn: (error: E) => U,
): Result<T, U> => (isErr(self) ? err(fn(self.error)) : self);

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
export const match = <T, E, U, V>(
  self: Result<T, E>,
  {
    onOk,
    onErr,
  }: {
    onOk: (value: T) => U;
    onErr: (error: E) => V;
  },
): U | V => (isOk(self) ? onOk(self.value) : onErr(self.error));

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
export const getOrThrowWith = <T, E, R>(
  result: Result<T, E>,
  fn: (error: E) => R,
): T => {
  if (isOk(result)) {
    return result.value;
  } else {
    throw fn(result.error);
  }
};
