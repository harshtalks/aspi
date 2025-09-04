import {
  AspiError,
  CustomError,
  type AspiRequest,
  type AspiResponse,
  type JSONParseError,
} from './error';
import {
  getHttpErrorStatus,
  httpErrors,
  type HttpErrorCodes,
  type HttpErrorStatus,
  type HttpMethods,
} from './http';
import type {
  AspiPlainResponse,
  AspiRequestInit,
  AspiResultOk,
  AspiRetryConfig,
  CustomErrorCb,
  ErrorCallbacks,
  Merge,
  Middleware,
  Prettify,
  RequestOptions,
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
  #middlewares: Middleware<TRequest, TRequest>[];
  #schema: StandardSchemaV1 | null = null;
  #bodySchema: StandardSchemaV1 | null = null;
  #retryConfig?: AspiRetryConfig<TRequest>;
  #shouldBeResult: boolean = false;
  #bodySchemaIssues: StandardSchemaV1.FailureResult['issues'] = [];
  #throwOnError: boolean = false;

  constructor(
    method: HttpMethods,
    path: string,
    {
      requestConfig,
      retryConfig,
      middlewares,
      errorCbs,
      throwOnError,
    }: RequestOptions<TRequest>,
  ) {
    this.#path = path;
    this.#middlewares = middlewares || [];
    this.#localRequestInit = { ...requestConfig, method: method } as TRequest;
    this.#retryConfig = retryConfig;
    this.#customErrorCbs = errorCbs || {};
    this.#throwOnError = throwOnError || false;
  }

  /**
   * Sets the base URL for the request.
   * @param url The base URL to set
   * @returns The request instance for chaining
   * @example
   * const request = new Request('/users', config);
   * request.setBaseUrl('https://api.example.com');
   */
  setBaseUrl(url: string) {
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
   * Sets multiple headers for the request.
   * @param headers An object containing header key-value pairs
   * @returns The request instance for chaining
   * @example
   * const request = new Request('/users', config);
   * request.setHeaders({
   *   'Content-Type': 'application/json',
   *   'Accept': 'application/json'
   * });
   */
  setHeaders(headers: Record<string, string>) {
    this.#localRequestInit.headers = headers;
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
      ...this.#localRequestInit.headers,
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
   * Sets a custom error handler for a specific HTTP status code.
   * @param tag A string identifier for the error type
   * @param status The HTTP error status to handle
   * @param cb The callback function to handle the error
   * @returns The request instance for chaining
   * @example
   * const request = new Request('/users', config);
   * request
      .withResult()
      .error('customError', 'BAD_REQUEST', (error) => {
   *   console.log('Bad request error:', error);
   *   return {
   *     message: 'Invalid input',
   *     details: error.response.responseData
   *   };
   * });
   *
   * // Later when making the request:
   * const result = await request.json();
   * if (Result.isErr(result)) {
   *   if(result.tag === 'customError') {
   *   console.log(result.error.data.message); // 'Invalid input'
   * }
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
   * Sets query parameters for the request URL.
   * @param params An object containing query parameter key-value pairs
   * @returns The request instance for chaining
   * @example
   * const request = new Request('/users', config);
   * request.setQueryParams({
   *   page: '1',
   *   limit: '10',
   *   sort: 'desc'
   * });
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
   * Sets the output schema for validating the response data using Zod.
   * @param schema The Zod schema to validate the response
   * @returns The request instance for chaining
   * @example
   * import { z } from 'zod';
   *
   * const userSchema = z.object({
   *   id: z.number(),
   *   name: z.string(),
   *   email: z.string().email()
   * });
   *
   * const request = new Request('/users', config);
   * const result = await request
   *   .withResult()
   *   .output(userSchema)
   *   .json();
   *
   * if (Result.isOk(result)) {
   *   const user = result.value; // Typed and validated user data
   * }
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
   * Sets the request to throw an error if the response status is not successful.
   * @returns The request instance for chaining
   * @example
   * const request = new Request('/users', config);
   * const result = await request
   *   .withResult()
   *   .throwable()
   *   .json();
   *
   */
  throwable() {
    this.#shouldBeResult = false;
    this.#throwOnError = true;
    return this as Request<
      Method,
      TRequest,
      Prettify<
        Opts & {
          throwable: true;
        }
      >
    >;
  }

  /**
   * Executes the request and returns the JSON response.
   * @returns A Promise containing the Result type with either successful data or error information
   * @example
   * const request = new Request('/users', config);
   * const result = await request
   *   .setQueryParams({ id: '123' })
   *   .withResult()
   *   .notFound((error) => ({ message: 'User not found' }))
   *   .json<User>();
   *
   * if (Result.isOk(result)) {
   *   const user = result.value; // User data
   * } else {
   *   console.error(result.error); // Error handling
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
    const output = await this.#makeRequest(
      async (response) =>
        response.json().catch(
          (e) =>
            new CustomError('jsonParseError', {
              message: e instanceof Error ? e.message : 'Failed to parse JSON',
            }),
        ),
      true,
    );

    // @ts-ignore
    return this.#mapResponse(output);
  }

  /**
   * Executes the request and returns the response as plain text.
   * @returns A Promise containing the Result type with either successful text data or error information
   * @example
   * const request = new Request('/data.txt', config);
   * const result = await request
   *   .setQueryParams({ version: '1' })
   *   .withResult()
   *   .notFound((error) => ({ message: 'Text file not found' }))
   *   .text();
   *
   * if (Result.isOk(result)) {
   *   const text = result.value; // Plain text content
   * } else {
   *   console.error(result.error); // Error handling
   * }
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
    const output = await this.#makeRequest<string>((response) =>
      response.text(),
    );
    // @ts-ignore
    return this.#mapResponse(output);
  }

  /**
   * Executes the request and returns the response as a Blob.
   * @returns A Promise containing the Result type with either successful Blob data or error information
   * @example
   * const request = new Request('/image.jpg', config);
   * const result = await request
   *   .setQueryParams({ size: 'large' })
   *   .withResult()
   *   .notFound((error) => ({ message: 'Image not found' }))
   *   .blob();
   *
   * if (Result.isOk(result)) {
   *   const imageBlob = result.value; // Blob data
   * } else {
   *   console.error(result.error); // Error handling
   * }
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
    // Normalize base URL by removing trailing slashes
    const baseUrl = this.#localRequestInit.baseUrl?.replace(/\/+$/, '') ?? '';

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
   * Returns the complete URL for the request including base URL, path, and query parameters.
   * @returns The complete URL string
   * @example
   * const request = new Request('/users', config);
   * request.setBaseUrl('https://api.example.com');
   * request.setQueryParams({ id: '123' });
   * console.log(request.url()); // 'https://api.example.com/users?id=123'
   */
  url() {
    return this.#url();
  }

  /**
   * Configures the request to return a Result type instead of a tuple.
   * @returns The request instance for chaining with Result type return value
   * @example
   * const request = new Request('/users', config);
   * const result = await request
   *   .withResult()
   *   .json<User>();
   *
   * // Returns Result type instead of tuple
   * if (Result.isOk(result)) {
   *   const user = result.value;
   * }
   */
  withResult() {
    this.#throwOnError = false;
    this.#shouldBeResult = true;
    // @ts-ignore
    return this as Request<
      Method,
      TRequest,
      Merge<
        Omit<Opts, 'withResult'>,
        {
          withResult: true;
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

  async #makeUnSafeRequest<T>(
    responseParser: (response: Response) => Promise<any>,
    isJson: boolean = false,
  ) {
    const output = await this.#makeRequest<T>(responseParser, isJson);
    return Result.getOrThrow(output);
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
      let response;
      let responseData;

      while (attempts <= retries) {
        try {
          response = await fetch(url, requestInit);

          responseData = await responseParser(response);

          if (responseData instanceof CustomError) {
            // we can break out of loop now with the error -> ex. JSON Parsing Error
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
            response.ok ||
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
            // Delaying the next retry
            const delay =
              typeof retryDelay === 'function'
                ? await retryDelay(
                    retries - attempts - 1,
                    retries,
                    request,
                    this.#makeResponse(response, responseData),
                  )
                : retryDelay;

            // delaying retry
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        } catch (e) {
          // max retry
          if (attempts === retries) throw e;

          // delay for retry
          const delay =
            typeof retryDelay === 'function'
              ? await retryDelay(
                  retries - attempts - 1,
                  retries,
                  request,
                  this.#makeResponse(response!, responseData),
                )
              : retryDelay;

          await new Promise((resolve) => setTimeout(resolve, delay));
        }

        // next retry
        if (onRetry) {
          onRetry(request, this.#makeResponse(response!, responseData));
        }
        attempts++;
      }

      if (!response!.ok) {
        if (response!.status in this.#customErrorCbs) {
          const result = this.#customErrorCbs[response!.status].cb({
            request,
            response: this.#makeResponse(response!, responseData),
          });

          // @ts-ignore
          return Result.err(
            new CustomError(
              // @ts-ignore
              this.#customErrorCbs[response!.status].tag,
              result,
            ),
          );
        }

        return Result.err(
          new AspiError(
            response!.statusText,
            this.#request(),
            this.#makeResponse(response!, responseData),
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
          response: this.#makeResponse(response!, responseData),
        });
      }

      return Result.ok({
        data: responseData as T,
        request,
        response: this.#makeResponse(response!, responseData),
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
          },
        ),
      );
    }
  }

  #request(): AspiRequest<TRequest> {
    let requestInit = this.#localRequestInit;
    for (const middleware of this.#middlewares) {
      requestInit = middleware(this.#localRequestInit);
    }
    return {
      requestInit: requestInit as unknown as TRequest,
      baseUrl: this.#localRequestInit.baseUrl,
      path: this.#path,
      queryParams: this.#queryParams || null,
      retryConfig: this.#sanitisedRetryConfig(),
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
}
