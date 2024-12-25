import {
  AspiError,
  type CustomError,
  type AspiRequest,
  type AspiResponse,
} from './error';
import {
  getHttpErrorStatus,
  httpErrors,
  type HttpErrorCodes,
  type HttpErrorStatus,
  type HttpMethods,
} from './http';
import type {
  AspiRequestInit,
  AspiRetryConfig,
  BaseSchema,
  CustomErrorCb,
  Middleware,
  RequestOptions,
} from './types';
import * as Result from './result';
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
  #customErrorCbs: Record<
    number,
    {
      cb: (input: { request: any; response: any }) => any;
      tag: unknown;
    }
  > = {};
  #queryParams?: URLSearchParams;
  #middlewares: Middleware<TRequest, TRequest>[];
  #schema: BaseSchema | null = null;
  #retryConfig?: AspiRetryConfig<TRequest>;

  constructor(
    method: HttpMethods,
    path: string,
    { requestConfig, retryConfig, middlewares }: RequestOptions<TRequest>,
  ) {
    this.#path = path;
    this.#middlewares = middlewares || [];
    this.#localRequestInit = { ...requestConfig, method: method } as TRequest;
    this.#retryConfig = retryConfig;
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
  bodyJson<Body extends {}>(body: Body) {
    this.#localRequestInit.body = JSON.stringify(body);
    return this as Request<
      Method,
      TRequest,
      Omit<Opts, 'body'> & {
        body: Body;
      }
    >;
  }

  /**
   * Sets the raw request body.
   * @param body The body content to send with the request
   * @returns The request instance for chaining
   * @example
   * const request = new Request('/users', config);
   * request.body(new FormData());
   *
   * // or with raw text
   * request.body('Hello World');
   *
   * // or with URLSearchParams
   * request.body(new URLSearchParams({ key: 'value' }));
   */
  body(body: BodyInit) {
    this.#localRequestInit.body = body;
    return this as Request<
      Method,
      TRequest,
      Omit<Opts, 'body'> & {
        body: BodyInit;
      }
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
    this.#customErrorCbs[404] = {
      cb,
      tag: 'notFoundError',
    };
    // @ts-ignore
    return this as Request<
      Method,
      TRequest,
      Opts & {
        error: Opts['error'] & {
          notFound: CustomError<'notFoundError', A>;
        };
      }
    >;
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
    this.#customErrorCbs[401] = {
      cb,
      tag: 'unauthorisedError',
    };
    // @ts-ignore
    return this as Request<
      Method,
      TRequest,
      Opts & {
        error: Opts['error'] & {
          unauthorised: CustomError<'unauthorisedError', A>;
        };
      }
    >;
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
    this.#customErrorCbs[403] = {
      cb,
      tag: 'forbiddenError',
    };
    // @ts-ignore
    return this as Request<
      Method,
      TRequest,
      Opts & {
        error: Opts['error'] & {
          forbidden: CustomError<'forbiddenError', A>;
        };
      }
    >;
  }

  /**
   * Sets a custom error handler for a specific HTTP status code.
   * @param tag A string identifier for the error type
   * @param status The HTTP error status to handle
   * @param cb The callback function to handle the error
   * @returns The request instance for chaining
   * @example
   * const request = new Request('/users', config);
   * request.error('customError', 'BAD_REQUEST', (error) => {
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
      Opts & {
        error: Opts['error'] & { [K in Tag]: CustomError<Tag, A> };
      }
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
  setQueryParams<T extends Record<string, string>>(params: T) {
    this.#queryParams = new URLSearchParams(params);
    return this as Request<
      Method,
      TRequest,
      Omit<Opts, 'queryParams'> & {
        qyeryParams: T;
      }
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
   *   .output(userSchema)
   *   .json();
   *
   * if (Result.isOk(result)) {
   *   const user = result.value; // Typed and validated user data
   * }
   */
  output<Output extends BaseSchema>(schema: Output) {
    this.#schema = schema;
    // @ts-ignore
    return this as Request<
      Method,
      TRequest,
      Omit<Opts, 'output'> & {
        output: Output;
        error: Opts['error'] & {
          parseError: CustomError<'parseError', unknown>;
        };
      }
    >;
  }

  /**
   * Executes the request and returns the JSON response.
   * @returns A Promise containing the Result type with either successful data or error information
   * @example
   * const request = new Request('/users', config);
   * const result = await request
   *   .setQueryParams({ id: '123' })
   *   .notFound((error) => ({ message: 'User not found' }))
   *   .json<User>();
   *
   * if (Result.isOk(result)) {
   *   const user = result.value; // User data
   * } else {
   *   console.error(result.error); // Error handling
   * }
   */
  async json<T extends Opts['output']['_output']>(): Promise<
    Result.Result<
      T,
      | AspiError<TRequest>
      | (Opts extends { error: any }
          ? Opts['error'][keyof Opts['error']]
          : never)
      | CustomError<'jsonParseError', { message: string }>
    >
  > {
    return this.#makeRequest<T>(async (response) =>
      response.json().catch((e) =>
        Result.err({
          data: e instanceof Error ? e.message : 'Failed to parse JSON',
          tag: 'jsonParseError',
        }),
      ),
    );
  }

  /**
   * Executes the request and returns the response as plain text.
   * @returns A Promise containing the Result type with either successful text data or error information
   * @example
   * const request = new Request('/data.txt', config);
   * const result = await request
   *   .setQueryParams({ version: '1' })
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
    Result.Result<
      string,
      | AspiError<TRequest>
      | (Opts extends { error: any }
          ? Opts['error'][keyof Opts['error']]
          : never)
    >
  > {
    return this.#makeRequest<string>((response) => response.text());
  }

  async #makeRequest<T>(
    responseParser: (response: Response) => Promise<any>,
  ): Promise<
    Result.Result<
      T,
      | AspiError<TRequest>
      | (Opts extends { error: any }
          ? Opts['error'][keyof Opts['error']]
          : never)
    >
  > {
    const request = this.#request();

    const { retries, retryDelay, retryOn, retryWhile } =
      this.#sanitisedRetryConfig();

    try {
      const requestInit = request.requestInit;
      const url = [
        new URL(this.#path, this.#localRequestInit.baseUrl).toString(),
        this.#queryParams ? `?${this.#queryParams.toString()}` : '',
      ].join('');

      let attempts = 0;
      let response;
      let responseData;

      while (attempts <= retries) {
        try {
          response = await fetch(url, requestInit);
          responseData = await responseParser(response);

          if (
            response.ok ||
            (!retryOn.includes(response.status as HttpErrorCodes) &&
              (!retryWhile ||
                !retryWhile(request, {
                  response,
                  status: response.status as HttpErrorCodes,
                  statusText: getHttpErrorStatus(
                    response.status as HttpErrorCodes,
                  ),
                  responseData,
                })))
          ) {
            break;
          }

          if (response.status in this.#customErrorCbs && attempts === retries) {
            const result = this.#customErrorCbs[response.status].cb({
              request,
              response: {
                response,
                status: response.status as HttpErrorCodes,
                statusText: getHttpErrorStatus(
                  response.status as HttpErrorCodes,
                ),
                responseData,
              } as AspiResponse,
            });

            // @ts-ignore
            return Result.err({
              data: result,
              tag: this.#customErrorCbs[response.status].tag,
            });
          }

          if (attempts < retries) {
            const delay =
              typeof retryDelay === 'function'
                ? retryDelay(retries - attempts - 1, retries, request, {
                    status: response.status as HttpErrorCodes,
                    statusText: getHttpErrorStatus(
                      response.status as HttpErrorCodes,
                    ),
                    response,
                    responseData,
                  })
                : retryDelay;
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        } catch (e) {
          if (attempts === retries) throw e;
          const delay =
            typeof retryDelay === 'function'
              ? retryDelay(retries - attempts - 1, retries, request, {
                  status: 500,
                  statusText: 'INTERNAL_SERVER_ERROR',
                  response,
                  responseData,
                })
              : retryDelay;
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
        attempts++;
      }

      if (!response!.ok) {
        if (response!.status in this.#customErrorCbs) {
          const result = this.#customErrorCbs[response!.status].cb({
            request,
            response: {
              response: response,
              status: response!.status as HttpErrorCodes,
              statusText: getHttpErrorStatus(
                response!.status as HttpErrorCodes,
              ),
              responseData,
            } as AspiResponse,
          });

          // @ts-ignore
          return Result.err({
            data: result,
            tag: this.#customErrorCbs[response!.status].tag,
          });
        }

        return Result.err(
          new AspiError(response!.statusText, this.#request(), {
            response: response,
            status: response!.status as HttpErrorCodes,
            statusText: getHttpErrorStatus(response!.status as HttpErrorCodes),
            responseData,
          }),
        );
      }

      if (this.#schema) {
        try {
          return Result.ok(this.#schema.parse(responseData) as T);
        } catch (error) {
          return Result.err({
            data: error,
            tag: 'parseError',
          }) as Result.Result<T, Opts['parseError']>;
        }
      }

      return Result.ok(responseData as T);
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
        return Result.err({
          data: result,
          tag: this.#customErrorCbs[500].tag,
        });
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
    const retries = this.#retryConfig?.retries || 0;
    const retryDelay = this.#retryConfig?.retryDelay || 0;
    const retryOn = this.#retryConfig?.retryOn || [];
    const retryWhile = this.#retryConfig?.retryWhile;

    return {
      retries,
      retryDelay,
      retryOn,
      retryWhile,
    };
  }
}
