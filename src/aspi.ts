import type { CustomError } from './error';
import { httpErrors, type HttpErrorStatus, type HttpMethods } from './http';
import type { Capability } from './capability';
import { Request } from './request';
import type {
  AspiRequestInit,
  AspiRequestInitWithoutBodyAndMethod,
  AspiRetryConfig,
  CustomErrorCb,
  ErrorCallbacks,
  Merge,
  Prettify,
  RequestTransformer,
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
  #middlewares: RequestTransformer<TRequest, TRequest>[] = [];
  #retryConfig?: AspiRetryConfig<TRequest>;
  #customErrorCbs: ErrorCallbacks = {};
  #throwOnError = false;
  #shouldBeResult = false;
  #capabilities: Capability<TRequest>[] = [];

  constructor(config: AspiRequestInitWithoutBodyAndMethod) {
    const { retryConfig, ...requestInit } = config;
    this.#globalRequestInit = requestInit as unknown as TRequest;
    this.#retryConfig = retryConfig;
  }

  /**
   * Sets or overrides the base URL used for all subsequent API requests.
   *
   * Accepts either a string or a `URL` instance. If a `URL` object is provided,
   * it is converted to its string representation.
   *
   * @param url - The new base URL.
   * @returns The current {@link Aspi} instance for chaining.
   * @example
   * const api = new Aspi({ baseUrl: 'https://api.example.com' });
   * api.setBaseUrl('https://api.newdomain.com');
   */
  setBaseUrl(url: string | URL) {
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

  #createRequest<M extends HttpMethods>(method: M, path: string) {
    return new Request<M, TRequest, Opts>(
      method,
      path,
      {
        requestConfig: {
          ...this.#globalRequestInit,
          method,
        },
        middlewares: this.#middlewares,
        errorCbs: this.#customErrorCbs,
        throwOnError: this.#throwOnError,
        shouldBeResult: this.#shouldBeResult,
        retryConfig: this.#retryConfig,
      },
      this.#capabilities,
    );
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
   * Makes a POST request to the specified path.
   *
   * @param {string} path - The path to make the request to.
   * @returns {Request} A Request instance for chaining.
   *
   * @example
   * const api = new Aspi({ baseUrl: 'https://api.example.com' });
   * const response = await api.post('/users').json();
   */
  post(path: string) {
    return this.#createRequest('POST', path);
  }

  /**
   * Makes a PUT request to the specified path.
   * @param {string} path - The path to make the request to.
   * @returns {Request} A Request instance for chaining.
   * @example
   * const api = new Aspi({ baseUrl: 'https://api.example.com' });
   * const response = await api.put('/users/1').json();
   */
  put(path: string) {
    return this.#createRequest('PUT', path);
  }

  /**
   * Makes a PATCH request to the specified path.
   * @param {string} path - The path to make the request to.
   * @returns {Request} A Request instance for chaining.
   * @example
   * const api = new Aspi({ baseUrl: 'https://api.example.com' });
   * const response = await api.patch('/users/1').json();
   */
  patch(path: string) {
    return this.#createRequest('PATCH', path);
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
   * Sets multiple headers for all API requests. Existing headers are preserved
   * and new ones are merged, overriding any duplicate keys.
   * @param {HeadersInit} headers - An object containing header key-value pairs
   * @returns {Aspi} The Aspi instance for chaining
   * @example
   * const api = new Aspi({ baseUrl: 'https://api.example.com' });
   * api.setHeaders({
   *   'Content-Type': 'application/json',
   *   'Accept': 'application/json'
   * });
   */
  setHeaders(headers: HeadersInit) {
    this.#globalRequestInit.headers = {
      ...(this.#globalRequestInit.headers ?? {}),
      ...headers,
    };
    return this;
  }

  /**
   * Sets a single header for all API requests.
   *
   * @param key - The header name.
   * @param value - The header value.
   * @returns This {@link Aspi} instance for chaining.
   *
   * @example
   * const api = new Aspi({ baseUrl: 'https://api.example.com' });
   * api.setHeader('Content-Type', 'application/json');
   */
  setHeader(key: string, value: string) {
    this.#globalRequestInit.headers = {
      ...(this.#globalRequestInit.headers ?? {}),
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
   * Register a request‑transformer middleware.
   *
   * The supplied function receives the current request initialization object
   * (`T`) and must return a request initialization of type `U`. The middleware
   * is added to the internal middleware chain and will be applied to every
   * request created by this {@link Aspi} instance.
   *
   * @template T - The input request type, extending the current {@link Aspi} request init type.
   * @template U - The output request type after transformation.
   * @param {RequestTransformer<T, U>} fn - The middleware function that transforms a request configuration.
   * @returns {Aspi<U>} A new {@link Aspi} instance typed with the transformed request configuration.
   * @example
   * const api = new Aspi({ baseUrl: 'https://api.example.com' });
   * const apiWithHeaders = api.use((req) => {
   *   // Add custom headers to every request
   *   return {
   *     ...req,
   *     headers: {
   *       ...req.headers,
   *       'x-custom-header': 'custom-value',
   *     },
   *   };
   * });
   */
  use<T extends TRequest, U extends TRequest>(
    fn: RequestTransformer<T, U>,
  ): Aspi<U> {
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
    return this.error('internalServerError', 'INTERNAL_SERVER_ERROR', cb);
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
    this.#shouldBeResult = false;
    return this as unknown as Aspi<
      TRequest,
      Merge<
        Omit<Opts, 'withResult' | 'throwable'>,
        {
          withResult: false;
          throwable: true;
        }
      >
    >;
  }

  /**
   * Configures the request to return a Result object instead of just the response body.
   * @returns The Aspi instance with result handling enabled.
   */
  withResult() {
    this.#shouldBeResult = true;
    this.#throwOnError = false;
    return this as unknown as Aspi<
      TRequest,
      Merge<
        Omit<Opts, 'withResult' | 'throwable'>,
        {
          withResult: true;
          throwable: false;
        }
      >
    >;
  }

  /**
   * Registers a capability on this {@link Aspi} instance.
   *
   * A capability is a small, pluggable unit that can intercept and wrap the
   * low‑level `fetch` call used by all requests created from this client.
   * It is invoked for every request with the constructed {@link AspiRequest},
   * and can:
   *
   * - inspect or mutate the outgoing request (e.g. inject auth headers),
   * - inspect the raw {@link Response},
   * - implement cross‑cutting concerns such as logging, tracing, retries,
   *   or token refresh, and
   * - short‑circuit the network call by returning a synthetic {@link Response}.
   *
   * Capabilities registered on the {@link Aspi} instance are propagated to every
   * {@link Request} created via methods like {@link get}, {@link post}, etc.
   * They are applied in the order they are registered.
   *
   * @param capability - The capability factory to install on this client.
   *
   * @returns This {@link Aspi} instance for fluent chaining.
   *
   * @example
   * ```ts
   * const api = new Aspi({ baseUrl: 'https://api.example.com' })
   *   .useCapability(({ request }) => ({
   *     async run(runner) {
   *       console.log('→', request.path);
   *       const res = await runner();
   *       console.log('←', res.status);
   *       return res;
   *     },
   *   }));
   *
   * const user = await api.get('/users/1').throwable().json<User>();
   * ```
   */
  useCapability(capability: Capability<TRequest>) {
    this.#capabilities.push(capability);
    return this;
  }
}
