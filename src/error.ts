import type { HttpErrorCodes, HttpErrorStatus } from './http';
import type { AspiRequestInit, AspiRetryConfig } from './types';

/**
 * Error response interface for HTTP requests
 * @interface AspiResponse
 * @property {HttpErrorCodes} status - The HTTP error code
 * @property {HttpErrorStatus} statusText - The HTTP error status message
 * @property {Response} [response] - The optional raw Response object
 * @property {any} [responseData] - Optional response data payload
 */
export interface AspiResponse {
  status: HttpErrorCodes;
  statusText: HttpErrorStatus;
  response?: Response;
  responseData?: any;
}

/**
 * Request configuration interface extending RequestInit
 * @interface AspiRequest
 * @extends {RequestInit}
 * @property {string} baseUrl - The base URL for the request
 * @property {string} path - The path to append to the base URL
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

export class CustomError<Tag extends string, A> extends Error {
  tag: Tag;
  data: A;

  constructor(tag: Tag, data: A) {
    super(tag);
    this.tag = tag;
    this.data = data;
  }
}

export interface JSONParseError
  extends CustomError<
    'jsonParseError',
    {
      message: string;
    }
  > {}
