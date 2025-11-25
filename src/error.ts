import type { HttpErrorCodes, HttpErrorStatus } from './http';
import type { AspiRequestInit, AspiRetryConfig } from './types';

/**
 * Response interface used in error handling
 * @interface AspiResponse
 * @property {HttpErrorCodes} status - The HTTP status code of the response
 * @property {HttpErrorStatus} statusText - The HTTP status text of the response
 * @property {Response} [response] - Optional raw Response object
 * @property {any} [responseData] - Optional response data content
 */
export interface AspiResponse {
  status: HttpErrorCodes;
  statusText: HttpErrorStatus;
  response?: Response;
  responseData?: any;
}

/**
 * Interface representing an API request configuration
 * @interface AspiRequest
 * @template T - Request initialization options type extending AspiRequestInit
 * @property {string} baseUrl - Base URL for the API request
 * @property {string} path - Request path to append to baseUrl
 * @property {T} requestInit - Request initialization options
 * @property {URLSearchParams | null} queryParams - URL query parameters, if any
 * @property {AspiRetryConfig<T>} retryConfig - Retry configuration for failed requests
 */
export interface AspiRequest<T extends AspiRequestInit> {
  baseUrl: string;
  path: string;
  requestInit: T;
  queryParams: URLSearchParams | null;
  retryConfig: AspiRetryConfig<T>;
}

/**
 * Custom error class for API errors
 * @class AspiError
 * @extends {Error}
 * @property {string} tag - Constant identifier for this error type
 * @property {AspiRe} request - The original request configuration
 * @property {AspiResponse} response - The error response details
 */
export class AspiError<TReq extends AspiRequestInit> extends Error {
  tag = 'aspiError' as const;
  request: AspiRequest<TReq>;
  response: AspiResponse;

  /**
   * Creates an instance of AspiError
   * @param {string} message - The error message
   * @param {AspiRe} request - The request configuration
   * @param {AspiResponse} response - The error response
   */
  constructor(
    message: string,
    request: AspiRequest<TReq>,
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
    cb: (args: { request: AspiRequest<TReq>; response: AspiResponse }) => T,
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
export interface JSONParseError
  extends CustomError<
    'jsonParseError',
    {
      message: string;
    }
  > {}

export const isAspiError = <TReq extends AspiRequestInit>(
  error: unknown,
): error is AspiError<TReq> => {
  return error instanceof AspiError;
};

export const isCustomError = <Tag extends string, A>(
  error: unknown,
): error is CustomError<Tag, A> => {
  return error instanceof CustomError;
};
