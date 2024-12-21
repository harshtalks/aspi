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
  AspiConfig,
  BaseSchema,
  CustomErrorCb,
  Middleware,
} from './types';
import * as Result from './result';

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
  TRequest extends RequestInit = RequestInit,
  Opts extends Record<any, any> = {},
> {
  #baseUrl: string;
  #path: string;
  #localRequestInit: TRequest;
  #customErrorCbs: Record<
    number,
    (input: { request: any; response: any }) => any
  > = {};
  #queryParams?: URLSearchParams;
  #middlewares: Middleware<TRequest, TRequest>[];
  #schema: BaseSchema | null = null;

  constructor(
    method: HttpMethods,
    path: string,
    config: AspiConfig,
    middlewares: Middleware<TRequest, TRequest>[] = [],
  ) {
    this.#path = path;
    this.#baseUrl = config.baseUrl;
    this.#middlewares = middlewares;
    this.#localRequestInit = {
      headers: config.headers,
      mode: config.mode,
      method: method,
    } as TRequest;
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
    this.#baseUrl = url;
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

  body<Body extends {}>(body: Body) {
    this.#localRequestInit.body = JSON.stringify(body);
    // @ts-ignore
    return this as Request<
      Method,
      TRequest,
      Omit<Opts, 'body'> & {
        body: Body;
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
    this.#customErrorCbs[404] = cb;
    // @ts-ignore
    return this as Request<
      Method,
      TRequest,
      Omit<Opts, 'notFound'> & {
        notFound: CustomError<'NOT_FOUND', A>;
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
    this.#customErrorCbs[401] = cb;
    // @ts-ignore
    return this as Request<
      Method,
      TRequest,
      Omit<Opts, 'unauthorised'> & {
        unauthorised: CustomError<'UNAUTHORIZED', A>;
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
    this.#customErrorCbs[403] = cb;
    // @ts-ignore
    return this as Request<
      Method,
      TRequest,
      Omit<Opts, 'forbidden'> & {
        forbidden: CustomError<'FORBIDDEN', A>;
      }
    >;
  }

  /**
   * Handles HTTP errors with a custom callback.
   * @param status The HTTP error status to handle
   * @param cb The callback function to handle the error
   * @returns The request instance for chaining
   * @example
   * const request = new Request('/users', config);
   * request.error('BAD_REQUEST', (error) => {
   *   console.log('Bad request:', error);
   *   return { message: 'Invalid input provided' };
   * });
   */
  error<A extends {}>(status: HttpErrorStatus, cb: CustomErrorCb<TRequest, A>) {
    this.#customErrorCbs[httpErrors[status]] = cb;
    // @ts-ignore
    return this as Request<
      Method,
      TRequest,
      Omit<Opts, 'httpError'> & {
        httpError: CustomError<HttpErrorStatus, A>;
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
   * if (result.ok) {
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
   * if (result.ok) {
   *   const user = result.value; // User data
   * } else {
   *   console.error(result.error); // Error handling
   * }
   */
  async json<T extends Opts['output']['_output']>(): Promise<
    Result.Result<
      T,
      | AspiError<TRequest>
      | (Opts extends { notFound: any } ? Opts['notFound'] : never)
      | (Opts extends { unauthorised: any } ? Opts['unauthorised'] : never)
      | (Opts extends { forbidden: any } ? Opts['forbidden'] : never)
      | (Opts extends { httpError: any } ? Opts['httpError'] : never)
    >
  > {
    try {
      const request = this.#request();
      const requestInit = request.requestInit;

      const response = await fetch(
        [
          new URL(this.#path, this.#baseUrl).toString(),
          this.#queryParams ? `?${this.#queryParams.toString()}` : '',
        ].join(''),
        requestInit,
      );

      const responseData = await response.json().catch(() => ({
        message: response.statusText,
      }));

      if (!response.ok) {
        if (response.status in this.#customErrorCbs) {
          const result = this.#customErrorCbs[response.status]({
            request: this.#request(),
            response: {
              response: response,
              status: response.status as HttpErrorCodes,
              statusText: getHttpErrorStatus(response.status as HttpErrorCodes),
              responseData,
            } as AspiResponse,
          });

          return Result.err({
            data: result,
            tag: getHttpErrorStatus(response.status as HttpErrorCodes),
          } as Opts[HttpErrorStatus]);
        }

        return Result.err(
          new AspiError(response.statusText, this.#request(), {
            response: response,
            status: response.status as HttpErrorCodes,
            statusText: getHttpErrorStatus(response.status as HttpErrorCodes),
            responseData,
          }),
        );
      }

      if (this.#schema) {
        return Result.ok(this.#schema.parse(responseData) as T);
      }

      return Result.ok(responseData as T);
    } catch (error) {
      return Result.err(
        new AspiError(
          error instanceof Error ? error.message : 'Something went wrong',
          this.#request(),
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
      this.#localRequestInit = middleware(this.#localRequestInit);
    }
    return {
      requestInit: requestInit as unknown as TRequest,
      baseUrl: this.#baseUrl,
      path: this.#path,
      queryParams: this.#queryParams || null,
    };
  }
}
