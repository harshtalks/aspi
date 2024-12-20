import type { HttpErrorCodes, HttpErrorStatus } from "./http";

/**
 * Error response interface for HTTP requests
 * @interface ErrorResponse
 * @property {HttpErrorCodes} status - The HTTP error code
 * @property {HttpErrorStatus} statusText - The HTTP error status message
 * @property {Response} [response] - The optional raw Response object
 * @property {any} [responseData] - Optional response data payload
 */
export interface ErrorResponse {
  status: HttpErrorCodes;
  statusText: HttpErrorStatus;
  response?: Response;
  responseData?: any;
}

/**
 * Request configuration interface extending RequestInit
 * @interface ErrorRequest
 * @extends {RequestInit}
 * @property {string} baseUrl - The base URL for the request
 * @property {string} path - The path to append to the base URL
 */
export interface ErrorRequest extends RequestInit {
  baseUrl: string;
  path: string;
}

/**
 * Custom error class for API errors
 * @class AspiError
 * @extends {Error}
 * @property {string} tag - Constant identifier for this error type
 * @property {ErrorRequest} request - The original request configuration
 * @property {ErrorResponse} response - The error response details
 */
export class AspiError extends Error {
  tag = "ASPI_ERROR" as const;
  request: ErrorRequest;
  response: ErrorResponse;

  /**
   * Creates an instance of AspiError
   * @param {string} message - The error message
   * @param {ErrorRequest} request - The request configuration
   * @param {ErrorResponse} response - The error response
   */
  constructor(message: string, request: ErrorRequest, response: ErrorResponse) {
    super(message);
    this.request = request;
    this.response = response;
  }

  /**
   * Conditionally executes callback if status matches
   * @template T
   * @param {HttpErrorStatus} status - The status to match against
   * @param {(args: { request: ErrorRequest; response: ErrorResponse }) => T} cb - Callback to execute on match
   * @returns {T | undefined} Result of callback if status matches, undefined otherwise
   */
  ifMatch<T>(
    status: HttpErrorStatus,
    cb: (args: { request: ErrorRequest; response: ErrorResponse }) => T,
  ) {
    if (this.response.statusText === status) {
      return cb({
        request: this.request,
        response: this.response,
      });
    }
  }
}

export interface CustomError<Tag extends HttpErrorStatus | (string & {}), A> {
  tag: Tag;
  data: A;
}
