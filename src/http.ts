/**
 * Standard HTTP /**
 * Common HTTP error status codes with their numeric values.
 * @readonly
 * @enum {number}
 * @property {number} BAD_REQUEST - 400 Bad Request
 * @property {number} UNAUTHORIZED - 401 Unauthorized
 * @property {number} FORBIDDEN - 403 Forbidden
 * @property {number} NOT_FOUND - 404 Not Found
 * @property {number} METHOD_NOT_ALLOWED - 405 Method Not Allowed
 * @property {number} CONFLICT - 409 Conflict
 * @property {number} LARGE - 413 Payload Too Large
 * @property {number} UNS {number}  * @property
 - 413Request entity too largeUPPORTED_MEDIA_TYPE - 415 Unsupported Media Type
 *@property {number} } UNPROCESSABLE_ENTITY - 422 Unprocessable Entity
 * @property {number} TO_MANY_REQUESTS - 429 Too Many Requests
 * @property {number}  * @property
Too many requests made - 429 {number} INTERNAL_SERVER_ERROR - 500 Internal Server Error
 * @property {number}  *
 500Generic server error -@property {number} NOT_IMPLEMENTED - 501 Not Implemented
 * @property {number}  *
 501Functionality not implemented -@property {number} BAD_GATEWAY - 502 Bad Gateway
 * @property {number} UNAVAILABLE - 503 Service Unavailable
 * @property {number}  * @property {number
 temporarily unavailable - 503Server} GATEWAY_TIMEOUT - 504 Gateway Timeout
 */
export const httpErrors = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  NOT_IMPLEMENTED: 501,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
} as const;

/**
 * Type representing the possible numeric HTTP error codes.
 * Derived from the values in the `httpErrors` const.
 */
export type HttpErrorCodes = (typeof httpErrors)[keyof typeof httpErrors];

/**
 * Type representing the possible HTTP error status keys.
 * Derived from the keys in the `httpErrors` const.
 */
export type HttpErrorStatus = keyof typeof httpErrors;

/**
 * Gets the string key representation of an HTTP error status code.
 *
 * @param {HttpErrorCodes} status - The numeric HTTP error status code
 * @returns {HttpErrorStatus} The string key representing the status code
 *
 * @example
 * getHttpErrorStatus(404) // returns 'NOT_FOUND'
 * getHttpErrorStatus(500) // returns 'INTERNAL_SERVER_ERROR'
 */
export const getHttpErrorStatus = (status: HttpErrorCodes) => {
  return Object.keys(httpErrors).find(
    (key) => httpErrors[key as HttpErrorStatus] === status,
  ) as HttpErrorStatus;
};

/**
 * Valid HTTP methods as defined in the HTTP/1.1 specification.
 */
export type HttpMethods =
  | 'GET'
  | 'POST'
  | 'PUT'
  | 'DELETE'
  | 'HEAD'
  | 'OPTIONS'
  | 'PATCH'
  | 'TRACE'
  | 'CONNECT';
