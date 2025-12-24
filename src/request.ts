import { AspiError, CustomError, type JSONParseError } from './error';
import {
  getHttpErrorStatus,
  httpErrors,
  type HttpErrorCodes,
  type HttpErrorStatus,
  type HttpMethods,
} from './http';
import type {
  AspiPlainResponse,
  AspiRequest,
  AspiRequestInit,
  AspiResponse,
  AspiResultOk,
  AspiRetryConfig,
  BaseURL,
  CustomErrorCb,
  ErrorCallbacks,
  Merge,
  RequestOptions,
  RequestTransformer,
} from './types';
import * as Result from './result';
import type { StandardSchemaV1 } from './standard-schema';
import { Aspi } from './aspi';

/**
 * A class for building and executing HTTP requests with customizable options and error handling.
 * @template Method The HTTP method type (GET, POST, etc.)
 * @template TRequest The request configuration type extending RequestInit
 * @template Opts Additional options type for custom configurations
 * @example
 * // Create a new request instance
 * const request = new Request('/api/users', {
 *   baseUrl: 'https://example.com',
 *   headers: { 'Content-Type': 'application/json' }
 * });
 *
 * // Configure and execute the request
 * const result = await request
 *   .setQueryParams({ page: '1' })
 *   .setBearer('token123')
 *   .notFound(() => ({ message: 'Not found' }))
 *   .withResult()
 *   .json<User>();
 */
export class Request<
  Method extends HttpMethods,
  TRequest extends AspiRequestInit = AspiRequestInit,
  Opts extends Record<any, any> = {
    error: {};
  },
> {
  #path: string;
  #localRequestInit: TRequest;
  #customErrorCbs: ErrorCallbacks = {};
  #queryParams?: URLSearchParams;
  #middlewares: RequestTransformer<TRequest, TRequest>[];
  #schema: StandardSchemaV1 | null = null;
  #bodySchema: StandardSchemaV1 | null = null;
  #retryConfig?: AspiRetryConfig<TRequest>;
  #shouldBeResult: boolean = false;
  #bodySchemaIssues: StandardSchemaV1.FailureResult['issues'] = [];
  #throwOnError: boolean = false;

  constructor(
    method: HttpMethods,
    path: string,
    requestOptions: RequestOptions<TRequest>,
  ) {
    this.#path = path;
    this.#middlewares = requestOptions.middlewares || [];
    this.#localRequestInit = {
      ...requestOptions.requestConfig,
      method: method,
    };
    this.#retryConfig = requestOptions.retryConfig;
    this.#customErrorCbs = requestOptions.errorCbs || {};
    this.#throwOnError = requestOptions.throwOnError || false;
    this.#shouldBeResult = requestOptions.shouldBeResult || false;
  }

  /**
   * Sets the base URL for the request.
   * @param url The base URL to set
   * @returns The request instance for chaining
   * @example
   * const request = new Request('/users', config);
   * request.setBaseUrl('https://api.example.com');
   */
  setBaseUrl(url: BaseURL) {
    this.#localRequestInit.baseUrl = url;
    return this;
  }

  /**
   * Sets the retry configuration for the request.
   * @param retry The retry configuration object
   * @returns The request instance for chaining
   * @example
   * const request = new Request('/users', config);
   * request.setRetry({
   *   retries: 3, // Number of retry attempts
   *   retryDelay: 1000, // Delay between retries in ms
   *   retryOn: [500, 502, 503], // Status codes to retry on
   *   retryWhile: (request, response) => response.status >= 500 // Custom retry condition
   * });
   */
  setRetry(retry: AspiRetryConfig<TRequest>) {
    this.#retryConfig = {
      ...this.#retryConfig,
      ...retry,
    };
    return this;
  }

  /**
   * Merges the provided headers into the request configuration.
   *
   * @param {HeadersInit} headers - An object or iterable containing header name/value pairs.
   *   Existing headers are retained unless a key in this object overwrites them.
   * @returns {this} The current {@link Request} instance for method chaining.
   *
   * @example
   * // Set common JSON headers
   * const request = new Request('/users', config);
   * request.setHeaders({
   *   'Content-Type': 'application/json',
   *   'Accept': 'application/json',
   * });
   */
  setHeaders(headers: HeadersInit) {
    // Merge the new headers with any existing ones, allowing the new values to overwrite duplicates.
    this.#localRequestInit.headers = {
      ...(this.#localRequestInit.headers ?? {}),
      ...headers,
    };
    return this;
  }

  /**
   * Sets a single header for the request.
   * @param key The header key
   * @param value The header value
   * @returns The request instance for chaining
   * @example
   * const request = new Request('/users', config);
   * request.setHeader('Content-Type', 'application/json');
   */
  setHeader(key: string, value: string) {
    this.#localRequestInit.headers = {
      ...(this.#localRequestInit.headers ?? {}),
      [key]: value,
    };
    return this;
  }

  /**
   * Sets the Authorization header with a bearer token.
   * @param token The bearer token to set
   * @returns The request instance for chaining
   * @example
   * const request = new Request('/users', config);
   * request.setBearer('my-auth-token');
   */
  setBearer(token: string) {
    return this.setHeader('Authorization', `Bearer ${token}`);
  }

  /**
   * Sets a validation schema for the request body using a StandardSchemaV1 schema.
   * @template TSchema Type parameter extending StandardSchemaV1
   * @param schema The schema to validate the body against
   * @returns The request instance for chaining with updated error type
   * @example
   * const userSchema = z.object({
   *   name: z.string(),
   *   email: z.string().email()
   * });
   *
   * const request = new Request('/users', config);
   * request
   *   .bodySchema(userSchema)
   *   .bodyJson({
   *     name: 'John',
   *     email: 'john@example.com'
   *   });
   */
  bodySchema<TSchema extends StandardSchemaV1>(schema: TSchema) {
    this.#bodySchema = schema;
    // @ts-ignore
    return this as Request<
      Method,
      TRequest,
      Omit<Opts, 'bodySchema'> & {
        bodySchema: TSchema;
        error: Opts['error'] & {
          parseError: CustomError<
            'parseError',
            StandardSchemaV1.FailureResult['issues']
          >;
        };
      }
    >;
  }

  /**
   * Sets the request body as JSON by automatically stringifying the provided object.
   * @param body The object to be stringified and sent as the request body
   * @returns The request instance for chaining
   * @example
   * const request = new Request('/users', config);
   * request.bodyJson({
   *   name: 'John Doe',
   *   email: 'john@example.com',
   *   age: 30
   * });
   */
  bodyJson<Body extends StandardSchemaV1.InferInput<Opts['bodySchema']>>(
    body: Body,
  ) {
    if (this.#bodySchema) {
      const data = this.#bodySchema['~standard'].validate(body);
      if (data instanceof Promise) {
        throw new Error('Schema validation should not return a promise');
      }

      if (data.issues) {
        this.#bodySchemaIssues = data.issues;
      } else {
        this.#localRequestInit.body = JSON.stringify(body);
      }
    } else {
      this.#localRequestInit.body = JSON.stringify(body);
    }
    // @ts-ignore
    return this as Request<
      Method,
      TRequest,
      Merge<
        Omit<Opts, 'body'>,
        {
          body: Body;
        }
      >
    >;
  }

  /**
   * Sets the raw request body (unsafe, use with caution).
   * @param body The body content to send with the request
   * @returns The request instance for chaining
   * @example
   * const request = new Request('/users', config);
   * request.unsafeBody(new FormData());
   *
   * // or with raw text
   * request.unsafeBody('Hello World');
   *
   * // or with URLSearchParams
   * request.unsafeBody(new URLSearchParams({ key: 'value' }));
   */
  unsafeBody(body: BodyInit) {
    this.#localRequestInit.body = body;
    // @ts-ignore
    return this as Request<
      Method,
      TRequest,
      Merge<
        Omit<Opts, 'body'>,
        {
          body: BodyInit;
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
   *   console.log('Resource not found:', error);
   *   return { message: 'Custom not found message' };
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
   * Handles 400 Bad Request errors with a custom callback.
   * @param cb The callback function to handle the error
   * @returns The request instance for chaining
   * @example
   * const request = new Request('/users', config);
   * request.badRequest((error) => {
   *   console.log('Bad request error:', error);
   *   return { message: 'Invalid request parameters' };
   * });
   */
  badRequest<A extends {}>(cb: CustomErrorCb<TRequest, A>) {
    return this.error('badRequestError', 'BAD_REQUEST', cb);
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
   * Handles 401 Unauthorized errors with a custom callback.
   * @param cb The callback function to handle the error
   * @returns The request instance for chaining
   * @example
   * const request = new Request('/users', config);
   * request.unauthorised((error) => {
   *   console.log('Unauthorized access:', error);
   *   return { message: 'Please login first' };
   * });
   */
  unauthorised<A extends {}>(cb: CustomErrorCb<TRequest, A>) {
    return this.error('unauthorisedError', 'UNAUTHORIZED', cb);
  }

  /**
   * Handles 403 Forbidden errors with a custom callback.
   * @param cb The callback function to handle the error
   * @returns The request instance for chaining
   * @example
   * const request = new Request('/users', config);
   * request.forbidden((error) => {
   *   console.log('Access forbidden:', error);
   *   return { message: 'You do not have permission' };
   * });
   */
  forbidden<A extends {}>(cb: CustomErrorCb<TRequest, A>) {
    return this.error('forbiddenError', 'FORBIDDEN', cb);
  }

  /**
   * Handles 501 Not Implemented errors with a custom callback.
   * @param cb The callback function to handle the error
   * @returns The request instance for chaining
   * @example
   * const request = new Request('/users', config);
   * request.notImplemented((error) => {
   *   console.log('Not implemented:', error);
   *   return { message: 'This feature is not implemented yet' };
   * });
   */
  notImplemented<A extends {}>(cb: CustomErrorCb<TRequest, A>) {
    return this.error('notImplementedError', 'NOT_IMPLEMENTED', cb);
  }

  /**
   * Handles 500 Internal Server Error errors with a custom callback.
   * @param cb The callback function to handle the error
   * @returns The request instance for chaining
   * @example
   * const request = new Request('/users', config);
   * request.internalServerError((error) => {
   *   console.log('Server error:', error);
   *   return { message: 'An unexpected error occurred' };
   * });
   */
  internalServerError<A extends {}>(cb: CustomErrorCb<TRequest, A>) {
    return this.error('internalServerError', 'INTERNAL_SERVER_ERROR', cb);
  }
  /**
   * Register a custom error handler for a specific HTTP status code.
   *
   * When the response matches the provided `status`, the supplied callback `cb`
   * is invoked and its return value is wrapped in a {@link CustomError} with the
   * given `tag`. The method also augments the request's generic `Opts['error']`
   * type so that the custom error is reflected in the resulting `Result`
   * union.
   *
   * @template Tag - A string literal used as the error tag.
   * @template A   - The shape of the data returned by the callback.
   *
   * @param {Tag} tag
   *   A unique identifier for the custom error. This value becomes the `tag`
   *   property of the {@link CustomError} produced by the handler.
   *
   * @param {HttpErrorStatus} status
   *   The HTTP status code (e.g. `'BAD_REQUEST'`, `'NOT_FOUND'`) that should
   *   trigger the custom handler.
   *
   * @param {CustomErrorCb<TRequest, A>} cb
   *   A callback that receives the failing request and response objects and
   *   returns an object describing the error payload.
   *
   * @returns {Request<Method, TRequest, Merge<Omit<Opts, 'error'>, { error: { [K in Tag | keyof Opts['error']]: K extends Tag ? CustomError<Tag, A> : Opts['error'][K]; } }>>}
   *   The same {@link Request} instance, now typed with the newly added error
   *   variant, allowing method‑chaining.
   *
   * @example
   * ```ts
   * const request = new Request('/users', config);
   *
   * // Attach a custom handler for a 400 Bad Request response
   * request
   *  withResult()
   *   .error('customError', 'BAD_REQUEST', (ctx) => {
   *     console.log('Bad request error:', ctx);
   *     return {
   *       message: 'Invalid input',
   *       details: ctx.response.responseData,
   *     };
   *   });
   *
   * // Later, when executing the request:
   * const result = await request.json();
   * if (Result.isErr(result) && result.tag === 'customError') {
   *   console.log(result.error.data.message); // 'Invalid input'
   * }
   * ```
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
    // @ts-ignore
    return this as Request<
      Method,
      TRequest,
      Merge<
        Omit<Opts, 'error'>,
        {
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
   * Sets the query parameters for the request URL.
   *
   * Accepts any value that can be passed to the `URLSearchParams` constructor:
   * - an object mapping keys to string values,
   * - an iterable of `[key, value]` tuples,
   * - a raw query string, or
   * - an existing {@link URLSearchParams} instance.
   *
   * The supplied parameters replace any previously defined query parameters.
   *
   * @template T - The concrete type of the supplied parameters.
   * @param {T} params - The query parameters to apply.
   * @returns {this} The request instance for method‑chaining.
   *
   * @example
   * const request = new Request('/users', config);
   * request.setQueryParams({
   *   page: '1',
   *   limit: '10',
   *   sort: 'desc',
   * });
   *
   * // Using a raw query string
   * request.setQueryParams('page=1&limit=10');
   *
   * // Using an array of entries
   * request.setQueryParams([['page', '1'], ['limit', '10']]);
   *
   * // Using an existing URLSearchParams instance
   * const qp = new URLSearchParams({ page: '1' });
   * request.setQueryParams(qp);
   */
  setQueryParams<
    T extends Record<string, string> | string[][] | string | URLSearchParams,
  >(params: T) {
    this.#queryParams = new URLSearchParams(params);
    // @ts-ignore
    return this as Request<
      Method,
      TRequest,
      Merge<
        Omit<Opts, 'queryParams'>,
        {
          queryParams: T;
        }
      >
    >;
  }

  /**
   * Sets a validation schema for the response data.
   *
   * The provided {@link StandardSchemaV1} schema will be used to validate the
   * response payload when the request is executed. If validation fails, a
   * `parseError` is added to the request's error type.
   *
   * @template TSchema - A type extending {@link StandardSchemaV1}
   * @param schema - The schema used to validate the response data
   * @returns The request instance for chaining with an updated generic type that
   * includes the schema and a possible `parseError` in the error union
   *
   * @example
   * ```ts
   * import { z } from 'zod';
   *
   * const userSchema = z.object({
   *   id: z.number(),
   *   name: z.string(),
   *   email: z.string().email(),
   * });
   *
   * const request = new Request('/users', config);
   * const result = await request
   *   .withResult()
   *   .schema(userSchema)
   *   .json();
   *
   * if (Result.isOk(result)) {
   *   const user = result.value; // Typed and validated user data
   * }
   * ```
   */
  schema<TSchema extends StandardSchemaV1>(schema: TSchema) {
    this.#schema = schema;
    // @ts-ignore
    return this as Request<
      Method,
      TRequest,
      Merge<
        Omit<Opts, 'schema'>,
        {
          schema: TSchema;
          error: Merge<
            Opts['error'],
            {
              parseError: CustomError<
                'parseError',
                StandardSchemaV1.FailureResult['issues']
              >;
            }
          >;
        }
      >
    >;
  }

  /**
   * Configures the request to **throw** an exception when the response status
   * indicates a failure (i.e., `!response.ok`). This disables the “Result”
   * mode (`withResult`) and enables “throwable” mode, causing
   * `await request.json()` (or other response helpers) to either resolve with
   * the successful payload **or** reject with an `AspiError`/`CustomError`.
   *
   * Use this when you prefer traditional `try / catch` error handling over
   * the explicit `Result` type returned by {@link withResult}.
   *
   * @returns This {@link Request} instance, now typed with `throwable: true` and
   *          `withResult: false` for proper chaining.
   *
   * @example
   * ```ts
   * const request = new Request('/users', config);
   *
   * try {
   *   const user = await request
   *     .throwable()   // Enable throwing on HTTP errors
   *     .json<User>(); // Will throw if the response is not ok
   *   console.log(user);
   * } catch (err) {
   *   // err is either AspiError or a CustomError returned by a custom handler
   *   console.error('Request failed:', err);
   * }
   * ```
   */
  throwable() {
    this.#shouldBeResult = false;
    this.#throwOnError = true;

    // @ts-ignore
    return this as Request<
      Method,
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
   * Sends the request and parses the response body as JSON.
   *
   * The resolved value of the returned promise varies based on the request mode:
   *
   * - **Result mode** (`withResult()`): resolves to a {@link Result.Result} that
   *   contains either an {@link AspiResultOk} with the parsed payload or a union
   *   of possible error types (HTTP errors, custom errors, JSON‑parse errors,
   *   schema‑validation errors, etc.).
   *
   * - **Throwable mode** (`throwable()`): resolves directly to the successful
   *   payload (`AspiPlainResponse`) and throws a {@link AspiError} or
   *   {@link CustomError} on failure.
   *
   * - **Default mode** (no explicit mode): resolves to a tuple
   *   `[value, error]` where exactly one element is non‑null.
   *
   * @template T - The inferred output type of the response schema (if a schema
   *   was supplied via {@link schema}). When no schema is provided `T` defaults
   *   to `any`.
   *
   * @returns A promise whose shape depends on the selected mode (see description).
   *   In Result mode it is `Result<ResultOk<…>, …>`, in throwable mode it is
   *   `AspiPlainResponse<…>`, and otherwise a tuple
   *   `[AspiResultOk<…> | null, Error | null]`.
   *
   * @example
   * // Using the Result API
   * const request = new Request('/users', config);
   * const result = await request
   *   .setQueryParams({ id: '123' })
   *   .withResult()
   *   .notFound(() => ({ message: 'User not found' }))
   *   .json<User>();
   *
   * if (Result.isOk(result)) {
   *   // `result.value` has type `User`
   *   console.log(result.value);
   * } else {
   *   console.error(result.error);
   * }
   */
  async json<T extends StandardSchemaV1.InferOutput<Opts['schema']>>(): Promise<
    Opts['withResult'] extends true
      ? Result.Result<
          AspiResultOk<TRequest, T>,
          | AspiError<TRequest>
          | (Opts extends { error: any }
              ? Opts['error'][keyof Opts['error']]
              : never)
          | JSONParseError
        >
      : Opts['throwable'] extends true
        ? AspiPlainResponse<TRequest, T>
        : [
            AspiResultOk<TRequest, T> | null,
            (
              | (
                  | AspiError<TRequest>
                  | (Opts extends { error: any }
                      ? Opts['error'][keyof Opts['error']]
                      : never)
                  | JSONParseError
                )
              | null
            ),
          ]
  > {
    const output = await this.#makeRequest(async (response) => {
      // Treat 204 No Content and any 3xx response as having no JSON payload.
      if (
        response.status === 204 ||
        (response.status >= 300 && response.status < 400)
      ) {
        // Return null (or undefined) to indicate absence of body.
        // The surrounding type handling will accommodate the null value.
        return null;
      }
      // Normal JSON parsing with error handling.
      return response.json().catch(
        (e) =>
          new CustomError('jsonParseError', {
            message: e instanceof Error ? e.message : 'Failed to parse JSON',
          }),
      );
    }, true);

    // @ts-ignore
    return this.#mapResponse(output);
  }

  /**
   * Executes the request and returns the response body as plain text.
   *
   * The method respects the request mode:
   *
   * - **Result mode** (`withResult()`): resolves to a {@link Result.Result}
   *   containing either an {@link AspiResultOk} with the text payload or an
   *   error variant.
   * - **Throwable mode** (`throwable()`): resolves directly to the text string
   *   and throws on error.
   * - **Default mode**: resolves to a tuple `[value, error]` where exactly one
   *   element is `null`.
   *
   * @returns {Promise<
   *   Opts['withResult'] extends true
   *     ? Result.Result<
   *         AspiResultOk<TRequest, string>,
   *         AspiError<TRequest> |
   *         (Opts extends { error: any } ? Opts['error'][keyof Opts['error']] : never)
   *       >
   *     : Opts['throwable'] extends true
   *       ? AspiPlainResponse<TRequest, string>
   *       : [
   *           AspiResultOk<TRequest, string> | null,
   *           (
   *             | AspiError<TRequest>
   *             | (Opts extends { error: any } ? Opts['error'][keyof Opts['error']] : never)
   *             | null
   *           )
   *         ]
   * }>
   *   A promise that resolves according to the selected request mode.
   *
   * @example
   * ```ts
   * const request = new Request('/data.txt', config);
   * const result = await request
   *   .setQueryParams({ version: '1' })
   *   .withResult()
   *   .notFound(() => ({ message: 'Text file not found' }))
   *   .text();
   *
   * if (Result.isOk(result)) {
   *   const text = result.value; // Plain text content
   * } else {
   *   console.error(result.error); // Error handling
   * }
   * ```
   */
  async text(): Promise<
    Opts['withResult'] extends true
      ? Result.Result<
          AspiResultOk<TRequest, string>,
          | AspiError<TRequest>
          | (Opts extends { error: any }
              ? Opts['error'][keyof Opts['error']]
              : never)
        >
      : Opts['throwable'] extends true
        ? AspiPlainResponse<TRequest, string>
        : [
            AspiResultOk<TRequest, string> | null,
            (
              | (
                  | AspiError<TRequest>
                  | (Opts extends { error: any }
                      ? Opts['error'][keyof Opts['error']]
                      : never)
                )
              | null
            ),
          ]
  > {
    const output = await this.#makeRequest<string>((response) => {
      return response.text();
    });
    // @ts-ignore
    return this.#mapResponse(output);
  }

  /**
   * Executes the request and returns the response body as a {@link Blob}.
   *
   * The shape of the returned {@link Promise} depends on the request mode:
   *
   * - **Result mode** (`withResult()`): resolves to a {@link Result.Result} containing
   *   either an {@link AspiResultOk} with `Blob` data or an error variant.
   * - **Throwable mode** (`throwable()`): resolves directly to a {@link Blob}
   *   (wrapped in {@link AspiPlainResponse}) and throws on failure.
   * - **Default mode**: resolves to a tuple `[value, error]` where exactly one element
   *   is `null`.
   *
   * @returns {Promise<
   *   Opts['withResult'] extends true
   *     ? Result.Result<
   *         AspiResultOk<TRequest, Blob>,
   *         | AspiError<TRequest>
   *         | (Opts extends { error: any }
   *             ? Opts['error'][keyof Opts['error']]
   *             : never)
   *       >
   *     : Opts['throwable'] extends true
   *       ? AspiPlainResponse<TRequest, Blob>
   *       : [
   *           AspiResultOk<TRequest, Blob> | null,
   *           (
   *             | (
   *                 | AspiError<TRequest>
   *                 | (Opts extends { error: any }
   *                     ? Opts['error'][keyof Opts['error']]
   *                     : never)
   *               )
   *             | null
   *           ),
   *         ]
   * }>
   *
   * @example
   * ```ts
   * const request = new Request('/image.jpg', config);
   * const result = await request
   *   .setQueryParams({ size: 'large' })
   *   .withResult()
   *   .notFound(() => ({ message: 'Image not found' }))
   *   .blob();
   *
   * if (Result.isOk(result)) {
   *   const imageBlob = result.value; // Blob data
   * } else {
   *   console.error(result.error); // Error handling
   * }
   * ```
   */
  async blob(): Promise<
    Opts['withResult'] extends true
      ? Result.Result<
          AspiResultOk<TRequest, Blob>,
          | AspiError<TRequest>
          | (Opts extends { error: any }
              ? Opts['error'][keyof Opts['error']]
              : never)
        >
      : Opts['throwable'] extends true
        ? AspiPlainResponse<TRequest, Blob>
        : [
            AspiResultOk<TRequest, Blob> | null,
            (
              | (
                  | AspiError<TRequest>
                  | (Opts extends { error: any }
                      ? Opts['error'][keyof Opts['error']]
                      : never)
                )
              | null
            ),
          ]
  > {
    const output = await this.#makeRequest<Blob>((response) => response.blob());
    // @ts-ignore
    return this.#mapResponse(output);
  }

  #url() {
    const passedBaseUrl =
      typeof this.#localRequestInit.baseUrl === 'string'
        ? this.#localRequestInit.baseUrl
        : this.#localRequestInit.baseUrl.toString();

    // Normalize base URL by removing trailing slashes
    const baseUrl = passedBaseUrl.replace(/\/+$/, '') ?? '';

    // Ensure path starts with exactly one forward slash
    const path = this.#path.replace(/^\/+/, '/');

    // Safely concatenate URL parts and handle query params
    const queryString = this.#queryParams
      ? `?${this.#queryParams.toString()}`
      : '';

    const url = [baseUrl, path, queryString].filter(Boolean).join('');

    return url;
  }

  /**
   * Returns the fully‑qualified URL that will be used for the request.
   *
   * The URL is constructed from the configured base URL, the request path,
   * and any query parameters added via {@link setQueryParams}.
   *
   * @returns {string} The complete request URL.
   *
   * @example
   * ```ts
   * const request = new Request('/users', config);
   * request.setBaseUrl('https://api.example.com');
   * request.setQueryParams({ id: '123' });
   *
   * console.log(request.url());
   * // => 'https://api.example.com/users?id=123'
   * ```
   */
  url() {
    return this.#url();
  }

  /**
   * Switches the request into **Result** mode.
   *
   * In Result mode the response helpers (`json`, `text`, `blob`, …) resolve to a
   * {@link Result.Result} instance instead of the default tuple
   * `[value, error]`. This allows callers to use pattern matching
   * (`Result.isOk`, `Result.isErr`) to handle success and failure.
   *
   * Calling `withResult` disables the “throwable” behaviour (see {@link throwable}).
   *
   * @returns {Request<
   *   Method,
   *   TRequest,
   *   Merge<
   *     Omit<Opts, 'withResult' | 'throwable'>,
   *     {
   *       withResult: true;
   *       throwable: false;
   *     }
   *   >
   * >} The same {@link Request} instance, now typed with `withResult: true` and
   * `throwable: false` for fluent chaining.
   *
   * @example
   * ```ts
   * const request = new Request('/users', config);
   *
   * const result = await request
   *   .withResult() // enable Result mode
   *   .json<User>();
   *
   * if (Result.isOk(result)) {
   *   // `result.value` is of type `User`
   *   console.log(result.value);
   * }
   * ```
   */
  withResult() {
    this.#throwOnError = false;
    this.#shouldBeResult = true;
    // @ts-ignore
    return this as Request<
      Method,
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

  #mapResponse<T, E>(value: Result.Result<T, E>) {
    if (this.#shouldBeResult) {
      return value;
    }

    if (this.#throwOnError) {
      return Result.getOrThrow(value);
    }

    if (Result.isOk(value)) {
      return [Result.getOrNull(value), null];
    } else {
      return [null, Result.getErrorOrNull(value)];
    }
  }

  #isSuccessResponse(response: Response) {
    return response.ok || (response.status >= 300 && response.status < 400);
  }

  async #makeRequest<T>(
    responseParser: (response: Response) => Promise<any>,
    isJson: boolean = false,
  ): Promise<
    Result.Result<
      AspiResultOk<TRequest, T>,
      | AspiError<TRequest>
      | (Opts extends { error: any }
          ? Opts['error'][keyof Opts['error']]
          : never)
    >
  > {
    // when the body schema fails, return the error. no need to make the request
    if (this.#bodySchemaIssues.length) {
      // @ts-ignore
      return Result.err(new CustomError('parseError', this.#bodySchemaIssues));
    }

    // request in the AspiRequest<RequestInit> format
    const request = this.#request();

    // Retry Config
    const { retries, retryDelay, retryOn, retryWhile, onRetry } =
      this.#sanitisedRetryConfig();

    try {
      // request init with certain extra properties
      const requestInit = request.requestInit;

      // URL
      const url = this.#url();

      let attempts = 1;
      let response: Response = new Response(null, {
        status: 500,
        statusText: 'Internal Server Error',
      });

      let responseData = null;

      while (attempts <= retries) {
        try {
          response = await fetch(url, requestInit);

          responseData = await responseParser(response);

          if (responseData instanceof Error) {
            // we can break out of loop now with the error → e.g. JSON Parsing Error
            // @ts-ignore
            return Result.err(responseData);
          }

          // check if retryWhile condition is satisfied
          const retryWhileCondition = retryWhile
            ? await retryWhile(
                request,
                this.#makeResponse(response, responseData),
              )
            : false;

          if (
            this.#isSuccessResponse(response) ||
            (!retryOn.includes(response.status as HttpErrorCodes) &&
              !retryWhileCondition)
          ) {
            // we can break out of loop now
            break;
          }

          if (response.status in this.#customErrorCbs && attempts === retries) {
            // custom error handler for this status code
            const result = this.#customErrorCbs[response.status].cb({
              request,
              response: this.#makeResponse(response, responseData),
            });

            // @ts-ignore
            return Result.err(
              new CustomError(
                // @ts-ignore
                this.#customErrorCbs[response.status].tag,
                result,
              ),
            );
          }

          if (attempts < retries) {
            // Delaying the next retry (abort‑aware)
            const delay =
              typeof retryDelay === 'function'
                ? await retryDelay(
                    retries - attempts - 1,
                    retries,
                    request,
                    this.#makeResponse(response, responseData),
                  )
                : retryDelay;

            await this.#abortDelay(delay, request);
          }
        } catch (e) {
          // Abort handling – stop all further retries and fail immediately
          if (e instanceof Error && e.name === 'AbortError') {
            // If a custom 500 handler exists, honor it
            if (500 in this.#customErrorCbs) {
              const result = this.#customErrorCbs[response.status].cb({
                request,
                response: this.#makeResponse(response, responseData),
              });

              // @ts-ignore
              return Result.err(
                new CustomError(
                  // @ts-ignore
                  this.#customErrorCbs[response.status].tag,
                  result,
                ),
              );
            }

            return Result.err(
              new AspiError(
                e.message,
                this.#request(),
                this.#makeResponse(response, responseData),
              ),
            );
          }

          // max retry
          if (attempts === retries) throw e;

          // delay for retry (abort‑aware)
          const delay =
            typeof retryDelay === 'function'
              ? await retryDelay(
                  retries - attempts - 1,
                  retries,
                  request,
                  this.#makeResponse(response, responseData),
                )
              : retryDelay;

          await this.#abortDelay(delay, request);
        }

        // next retry callback
        if (onRetry) {
          onRetry(request, this.#makeResponse(response, responseData));
        }
        attempts++;
      }

      if (!this.#isSuccessResponse(response)) {
        if (response.status in this.#customErrorCbs) {
          const result = this.#customErrorCbs[response.status].cb({
            request,
            response: this.#makeResponse(response, responseData),
          });

          // @ts-ignore
          return Result.err(
            new CustomError(
              // @ts-ignore
              this.#customErrorCbs[response.status].tag,
              result,
            ),
          );
        }

        return Result.err(
          new AspiError(
            response.statusText,
            this.#request(),
            this.#makeResponse(response, responseData),
          ),
        );
      }

      if (isJson && this.#schema) {
        const data = this.#schema['~standard'].validate(responseData);
        if (data instanceof Promise) {
          throw new Error('Schema validation should not return a promise');
        }

        if (data.issues) {
          // @ts-ignore
          return Result.err(new CustomError('parseError', data.issues));
        }

        return Result.ok({
          data: data.value as T,
          request,
          response: this.#makeResponse(response, responseData),
        });
      }

      return Result.ok({
        data: responseData as T,
        request,
        response: this.#makeResponse(response, responseData),
      });
    } catch (error) {
      if (500 in this.#customErrorCbs) {
        const result = this.#customErrorCbs[500].cb({
          request: request,
          response: {
            status: 500,
            statusText: 'INTERNAL_SERVER_ERROR',
          } as AspiResponse,
        });

        // @ts-ignore
        return Result.err(
          new CustomError(
            // @ts-ignore
            this.#customErrorCbs[500].tag,
            result,
          ),
        );
      }

      return Result.err(
        new AspiError(
          error instanceof Error ? error.message : 'Something went wrong',
          request,
          {
            status: 500,
            statusText: 'INTERNAL_SERVER_ERROR',
          } as AspiResponse<any, true>,
        ),
      );
    }
  }

  #abortDelay(ms: number, request: AspiRequest<TRequest>): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, ms);
      const signal = request.requestInit.signal;
      if (signal) {
        if (signal.aborted) {
          clearTimeout(timer);
          reject(new DOMException('The user aborted a request.', 'AbortError'));
        } else {
          const abortHandler = () => {
            clearTimeout(timer);
            reject(
              new DOMException('The user aborted a request.', 'AbortError'),
            );
          };
          signal.addEventListener('abort', abortHandler, { once: true });
        }
      }
    });
  }

  #request(): AspiRequest<TRequest> {
    let requestInit = this.#localRequestInit;
    for (const middleware of this.#middlewares) {
      requestInit = middleware(requestInit);
    }
    return {
      requestInit: {
        ...requestInit,
        retryConfig: this.#sanitisedRetryConfig(),
      } as TRequest,
      path: this.#path,
      queryParams: this.#queryParams || null,
    };
  }

  #sanitisedRetryConfig() {
    const retries = this.#retryConfig?.retries || 1;
    const retryDelay = this.#retryConfig?.retryDelay || 0;
    const retryOn = this.#retryConfig?.retryOn || [];
    const retryWhile = this.#retryConfig?.retryWhile;
    const onRetry = this.#retryConfig?.onRetry;

    return {
      retries,
      retryDelay,
      retryOn,
      retryWhile,
      onRetry,
    };
  }

  #makeResponse<T>(response: Response, responseData: T): AspiResponse {
    return {
      response,
      status: response.status as HttpErrorCodes,
      statusText: getHttpErrorStatus(response.status as HttpErrorCodes),
      responseData,
    };
  }

  /**
   * Returns the underlying {@link AspiRequest} object that will be used for the fetch call.
   *
   * This method does not perform any network activity; it simply builds and returns the
   * request configuration, including any applied middlewares, query parameters, etc.
   *
   * @returns {AspiRequest<TRequest>} The constructed request object.
   */
  getRequest(): AspiRequest<TRequest> {
    return this.#request();
  }

  /**
   * Retrieves the registry of custom error callbacks that have been
   * registered via {@link error}. The returned object maps HTTP status
   * codes to their corresponding callback functions and tags.
   *
   * @returns {ErrorCallbacks} A shallow copy of the internal error callback registry.
   */
  public getErrorCallbackRegistry(): ErrorCallbacks {
    // Return a shallow copy to prevent external mutation of the private registry.
    return { ...this.#customErrorCbs };
  }
  /**
   * Returns whether the request is configured to return a {@link Result.Result}
   * instead of the default tuple or throwing.
   *
   * @returns {boolean} `true` when {@link withResult} has been called.
   */
  isResult(): boolean {
    return this.#shouldBeResult;
  }

  /**
   * Returns whether the request is configured to throw on HTTP errors.
   *
   * @returns {boolean} `true` when {@link throwable} has been called.
   */
  isThrowable(): boolean {
    return this.#throwOnError;
  }

  /**
   * Returns the effective retry configuration for this request, including defaulted values.
   *
   * The returned object contains:
   * - `retries` – number of retry attempts (default 1)
   * - `retryDelay` – delay between attempts in milliseconds or a function that returns a delay
   * - `retryOn` – array of HTTP status codes that should trigger a retry
   * - `retryWhile` – optional custom predicate executed after each response
   * - `onRetry` – optional callback invoked after a retry attempt
   *
   * A shallow copy is returned to avoid accidental mutation of the internal state.
   *
   * @returns {{
   *   retries: number;
   *   retryDelay: number | ((attempt: number, maxAttempts: number, request: AspiRequest<TRequest>, response: AspiResponse<any, true>) => number);
   *   retryOn: number[];
   *   retryWhile?: (request: AspiRequest<TRequest>, response: AspiResponse<any, true>) => boolean | Promise<boolean>;
   *   onRetry?: (request: AspiRequest<TRequest>, response: AspiResponse<any, true>) => void;
   * }}
   */
  getRetryConfig() {
    // Use the internal sanitisation logic to ensure defaults are applied.
    // @ts-ignore
    const cfg = this.#sanitisedRetryConfig();
    // Return a shallow copy so callers cannot mutate private state.
    return { ...cfg };
  }
}
