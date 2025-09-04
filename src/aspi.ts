import type { CustomError } from './error';
import { httpErrors, type HttpErrorStatus, type HttpMethods } from './http';
import { Request } from './request';
import type {
  AspiConfig,
  AspiRequestInit,
  AspiRetryConfig,
  CustomErrorCb,
  ErrorCallbacks,
  Merge,
  Middleware,
  Prettify,
} from './types';

/**
 * A class for making API requests with a base URL and configurable options
 * @template TRequest - Type extending RequestInit for request configuration
 * @example
 * const api = new Aspi({
 *   baseUrl: 'https://api.example.com',
 *   headers: {
 *     'Content-Type': 'application/json'
 *   }
 * });
 *
 * // Make requests
 * const users = await api.get('/users').json();
 * const user = await api.post('/users', { name: 'John' }).json();
 */
export class Aspi<
  TRequest extends AspiRequestInit = AspiRequestInit,
  Opts extends Record<any, any> = {},
> {
  #globalRequestInit: TRequest;
  #middlewares: Middleware<TRequest, TRequest>[] = [];
  #retryConfig?: AspiRetryConfig<TRequest>;
  #customErrorCbs: ErrorCallbacks = {};
  #throwOnError = false;

  constructor(config: AspiConfig) {
    const { retryConfig, ...requestConfig } = config;
    this.#globalRequestInit = requestConfig as TRequest;
    this.#retryConfig = retryConfig as unknown as AspiRetryConfig<TRequest>;
  }

  /**
   * Sets the base URL for all API requests
   * @param {string} url - The base URL to be set
   * @returns {Aspi} The Aspi instance for chaining
   * @example
   * const api = new Aspi({ baseUrl: 'https://api.example.com' });
   * api.setBaseUrl('https://api.newdomain.com');
   */
  setBaseUrl(url: string) {
    this.#globalRequestInit.baseUrl = url;
    return this;
  }

  /**
   * Sets the retry configuration for failed requests
   * @param {AspiRetryConfig<TRequest>} retry - The retry configuration object
   * @returns {Aspi} The Aspi instance for chaining
   * @example
   * const api = new Aspi({ baseUrl: 'https://api.example.com' });
   * api.setRetry({
   *   retries: 3,
   *   retryDelay: 1000,
   *   retryOn: [500, 502],
   *   retryWhile: (req, res) => res.status === 500
   * });
   */
  setRetry(retry: AspiRetryConfig<TRequest>) {
    this.#retryConfig = {
      ...this.#retryConfig,
      ...retry,
    };
    return this;
  }

  #createRequest<M extends HttpMethods>(
    method: M,
    path: string,
    body?: BodyInit,
  ) {
    return new Request<M, TRequest, Opts>(method, path, {
      requestConfig: {
        ...this.#globalRequestInit,
        method,
        body: body,
      },
      retryConfig: this.#retryConfig,
      middlewares: this.#middlewares,
      errorCbs: this.#customErrorCbs,
      throwOnError: this.#throwOnError,
    });
  }

  /**
   * Makes a GET request to the specified path
   * @param {string} path - The path to make the request to
   * @returns {Request} A Request instance for chaining
   * @example
   * const api = new Aspi({ baseUrl: 'https://api.example.com' });
   * const response = await api.get('/users').json();
   */
  get(path: string) {
    return this.#createRequest('GET', path);
  }

  /**
   * Makes a POST request to the specified path with an optional body
   * @param {string} path - The path to make the request to
   * @param {BodyInit} [body] - The body of the request
   * @returns {Request} A Request instance for chaining
   * @example
   * const api = new Aspi({ baseUrl: 'https://api.example.com' });
   * const response = await api.post('/users', { name: 'John' }).json();
   */
  post(path: string, body?: BodyInit) {
    return this.#createRequest('POST', path, body);
  }

  /**
   * Makes a PUT request to the specified path with an optional body
   * @param {string} path - The path to make the request to
   * @param {BodyInit} [body] - The body of the request
   * @returns {Request} A Request instance for chaining
   * @example
   * const api = new Aspi({ baseUrl: 'https://api.example.com' });
   * const response = await api.put('/users/1', { name: 'John' }).json();
   */
  put(path: string, body?: BodyInit) {
    return this.#createRequest('PUT', path, body);
  }

  /**
   * Makes a PATCH request to the specified path with an optional body
   * @param {string} path - The path to make the request to
   * @param {BodyInit} [body] - The body of the request
   * @returns {Request} A Request instance for chaining
   * @example
   * const api = new Aspi({ baseUrl: 'https://api.example.com' });
   * const response = await api.patch('/users/1', { name: 'John' }).json();
   */
  patch(path: string, body?: BodyInit) {
    return this.#createRequest('PATCH', path, body);
  }

  /**
   * Makes a DELETE request to the specified path
   * @param {string} path - The path to make the request to
   * @returns {Request} A Request instance for chaining
   * @example
   * const api = new Aspi({ baseUrl: 'https://api.example.com' });
   * const response = await api.delete('/users/1').json();
   */
  delete(path: string) {
    return this.#createRequest('DELETE', path);
  }

  /**
   * Makes a HEAD request to the specified path
   * @param {string} path - The path to make the request to
   * @returns {Request} A Request instance for chaining
   * @example
   * const api = new Aspi({ baseUrl: 'https://api.example.com' });
   * const response = await api.head('/users').json();
   */
  head(path: string) {
    return this.#createRequest('HEAD', path);
  }

  /**
   * Makes an OPTIONS request to the specified path
   * @param {string} path - The path to make the request to
   * @returns {Request} A Request instance for chaining
   * @example
   * const api = new Aspi({ baseUrl: 'https://api.example.com' });
   * const response = await api.options('/users').json();
   */
  options(path: string) {
    return this.#createRequest('OPTIONS', path);
  }

  /**
   * Sets multiple headers for all API requests
   * @param {Record<string, string>} headers - An object containing header key-value pairs
   * @returns {Aspi} The Aspi instance for chaining
   * @example
   * const api = new Aspi({ baseUrl: 'https://api.example.com' });
   * api.setHeaders({
   *   'Content-Type': 'application/json',
   *   'Accept': 'application/json'
   * });
   */
  setHeaders(headers: Record<string, string>) {
    this.#globalRequestInit.headers = headers;
    return this;
  }

  /**
   * Sets a single header for all API requests
   * @param {string} key - The header key
   * @param {string} value - The header value
   * @returns {Aspi} The Aspi instance for chaining
   * @example
   * const api = new Aspi({ baseUrl: 'https://api.example.com' });
   * api.setHeader('Content-Type', 'application/json');
   */
  setHeader(key: string, value: string) {
    this.#globalRequestInit.headers = {
      ...this.#globalRequestInit.headers,
      [key]: value,
    };
    return this;
  }

  /**
   * Sets the Authorization header with a Bearer token
   * @param {string} token - The Bearer token
   * @returns {Aspi} The Aspi instance for chaining
   * @example
   * const api = new Aspi({ baseUrl: 'https://api.example.com' });
   * api.setBearer('myAuthToken123');
   */
  setBearer(token: string) {
    return this.setHeader('Authorization', `Bearer ${token}`);
  }

  /**
   * Use a middleware function to transform requests
   * @param {Middleware<T, U>} fn - The middleware function to apply
   * @returns {Aspi<U>} A new Aspi instance with the applied middleware
   * @example
   * const api = new Aspi({ baseUrl: 'https://api.example.com' });
   * api.use((req) => {
   *   // Add custom headers
   *   req.headers = {
   *     ...req.headers,
   *     'x-custom-header': 'custom-value'
   *   };
   *   return req;
   * });
   */
  use<T extends TRequest, U extends TRequest>(fn: Middleware<T, U>): Aspi<U> {
    this.#middlewares = [...this.#middlewares, fn as any];
    return this as unknown as Aspi<U>;
  }

  /**
   * Registers a custom error handler for a specific HTTP status
   * @param {string} tag - The error tag identifier
   * @param {HttpErrorStatus} status - The HTTP status code to handle
   * @param {CustomErrorCb<TRequest, A>} cb - The callback function to handle the error
   * @returns {Aspi} The Aspi instance for chaining
   * @example
   * const api = new Aspi({ baseUrl: 'https://api.example.com' });
   * api.error('customError', 'BAD_REQUEST', (req, res) => {
   *   console.log('Bad request error occurred');
   *   return { message: 'Invalid input' };
   * });
   */
  error<Tag extends string, A extends {}>(
    tag: Tag,
    status: HttpErrorStatus,
    cb: CustomErrorCb<TRequest, A>,
  ) {
    this.#customErrorCbs[httpErrors[status]] = {
      cb,
      tag,
    };

    return this as Aspi<
      TRequest,
      Prettify<
        Opts & {
          error: {
            [K in Tag | keyof Opts['error']]: K extends Tag
              ? CustomError<Tag, A>
              : Opts['error'][K];
          };
        }
      >
    >;
  }

  /**
   * Handles 404 Not Found errors with a custom callback.
   * @param cb The callback function to handle the error
   * @returns The request instance for chaining
   * @example
   * const request = new Request('/users', config);
   * request.notFound((error) => {
   *   console.log('Not found:', error);
   *   return { message: 'Resource not found' };
   * });
   */
  notFound<A extends {}>(cb: CustomErrorCb<TRequest, A>) {
    return this.error('notFoundError', 'NOT_FOUND', cb);
  }

  /**
   * Handles 429 Too Many Requests errors with a custom callback.
   * @param cb The callback function to handle the error
   * @returns The request instance for chaining
   * @example
   * const request = new Request('/users', config);
   * request.tooManyRequests((error) => {
   *   console.log('Rate limited:', error);
   *   return { message: 'Please try again later' };
   * });
   */
  tooManyRequests<A extends {}>(cb: CustomErrorCb<TRequest, A>) {
    return this.error('tooManyRequestsError', 'TOO_MANY_REQUESTS', cb);
  }

  /**
   * Handles 409 Conflict errors with a custom callback.
   * @param cb The callback function to handle the error
   * @returns The request instance for chaining
   * @example
   * const request = new Request('/users', config);
   * request.conflict((error) => {
   *   console.log('Conflict error:', error);
   *   return { message: 'Resource conflict detected' };
   * });
   */
  conflict<A extends {}>(cb: CustomErrorCb<TRequest, A>) {
    return this.error('conflictError', 'CONFLICT', cb);
  }

  /**
   * Registers a handler for 400 Bad Request errors
   * @param {CustomErrorCb<TRequest, A>} cb - The callback function to handle the error
   * @returns {Aspi} The Aspi instance for chaining
   * @example
   * api.badRequest((req, res) => ({ message: 'Invalid request parameters' }));
   */
  badRequest<A extends {}>(cb: CustomErrorCb<TRequest, A>) {
    return this.error('badRequestError', 'BAD_REQUEST', cb);
  }

  /**
   * Registers a handler for 401 Unauthorized errors
   * @param {CustomErrorCb<TRequest, A>} cb - The callback function to handle the error
   * @returns {Aspi} The Aspi instance for chaining
   * @example
   * api.unauthorized((req, res) => ({ message: 'Authentication required' }));
   */
  unauthorized<A extends {}>(cb: CustomErrorCb<TRequest, A>) {
    return this.error('unauthorizedError', 'UNAUTHORIZED', cb);
  }

  /**
   * Registers a handler for 403 Forbidden errors
   * @param {CustomErrorCb<TRequest, A>} cb - The callback function to handle the error
   * @returns {Aspi} The Aspi instance for chaining
   * @example
   * api.forbidden((req, res) => ({ message: 'Access denied' }));
   */
  forbidden<A extends {}>(cb: CustomErrorCb<TRequest, A>) {
    return this.error('forbiddenError', 'FORBIDDEN', cb);
  }

  /**
   * Registers a handler for 501 Not Implemented errors
   * @param {CustomErrorCb<TRequest, A>} cb - The callback function to handle the error
   * @returns {Aspi} The Aspi instance for chaining
   * @example
   * api.notImplemented((req, res) => ({ message: 'Feature not implemented' }));
   */
  notImplemented<A extends {}>(cb: CustomErrorCb<TRequest, A>) {
    return this.error('notImplementedError', 'NOT_IMPLEMENTED', cb);
  }

  /**
   * Registers a handler for 500 Internal Server errors
   * @param {CustomErrorCb<TRequest, A>} cb - The callback function to handle the error
   * @returns {Aspi} The Aspi instance for chaining
   * @example
   * api.internalServerError((req, res) => ({ message: 'Server error occurred' }));
   */
  internalServerError<A extends {}>(cb: CustomErrorCb<TRequest, A>) {
    return this.error('internalServerErrorError', 'INTERNAL_SERVER_ERROR', cb);
  }

  /**
   * Sets the aspi to throw an error if the response status is not successful.
   * @returns The request instance for chaining
   * @example
   * const aspi = new Aspi({baseUrl: 'https://example.com'});
   * const result = await aspi.get('/users')
   *   .withResult()
   *   .throwable()
   *   .json();
   *
   */
  throwable() {
    this.#throwOnError = true;
    return this as Aspi<
      TRequest,
      Prettify<
        Opts & {
          throwable: true;
        }
      >
    >;
  }
}
