import type { HttpErrorStatus } from './http';
import type { AspiRequest, AspiRequestInit, AspiResponse } from './types';

/**
 * Custom error class for API errors
 * @class AspiError
 * @extends {Error}
 * @property {string} tag - Constant identifier for this error type
 * @property {AspiRe} request - The original request configuration
 * @property {AspiResponse} response - The error response details
 */
export class AspiError<TRequest extends AspiRequestInit> extends Error {
  tag = 'aspiError' as const;
  request: AspiRequest<TRequest>;
  response: AspiResponse<any, false>;

  /**
   * Creates an instance of AspiError
   * @param {string} message - The error message
   * @param {AspiRe} request - The request configuration
   * @param {AspiResponse} response - The error response
   */
  constructor(
    message: string,
    request: AspiRequest<TRequest>,
    response: AspiResponse,
  ) {
    super(message);
    this.request = request;
    this.response = response;
  }

  /**
   * Conditionally executes callback if status matches
   * @template T
   * @param {HttpErrorStatus} status - The status to match against
   * @param {(args: { request: AspiRequest; response: AspiResponse }) => T} cb - Callback to execute on match
   * @returns {T | undefined} Result of callback if status matches, undefined otherwise
   */
  ifMatch<T>(
    status: HttpErrorStatus,
    cb: (args: {
      request: AspiRequest<TRequest>;
      response: AspiResponse<any, false>;
    }) => T,
  ) {
    if (this.response.statusText === status) {
      return cb({
        request: this.request,
        response: this.response,
      });
    }
  }
}

/**
 * Custom error class with generic tag and data fields
 * @class CustomError
 * @extends {Error}
 * @template Tag - String literal type for the error tag
 * @template A - Type of the error data
 * @property {Tag} tag - Tag identifying the error type
 * @property {A} data - Additional error data
 */
export class CustomError<Tag extends string, A> extends Error {
  tag: Tag;
  data: A;

  /**
   * Creates an instance of CustomError
   * @param {Tag} tag - Tag identifying the error type
   * @param {A} data - Additional error data
   */
  constructor(tag: Tag, data: A) {
    super(tag);
    this.tag = tag;
    this.data = data;
  }
}

/**
 * Interface representing a JSON parsing error
 * @interface JSONParseError
 * @extends {CustomError<'jsonParseError', { message: string }>}
 */
export interface JSONParseError extends CustomError<
  'jsonParseError',
  {
    message: string;
  }
> {}

/**
 * Type alias for a schema validation parse error.
 * Emitted when either the request body schema or the response schema fails validation.
 */
export type ParseError = CustomError<'parseError', unknown>;

export const isAspiError = <TReq extends AspiRequestInit>(
  error: unknown,
): error is AspiError<TReq> => {
  return error instanceof AspiError && error.tag === 'aspiError';
};

export const isCustomError = <Tag extends string, A>(
  error: unknown,
): error is CustomError<Tag, A> => {
  return error instanceof CustomError;
};

export const isParseError = (error: unknown): error is ParseError => {
  return error instanceof CustomError && error.tag === 'parseError';
};

export const isJSONParseError = (error: unknown): error is JSONParseError => {
  return error instanceof CustomError && error.tag === 'jsonParseError';
};
