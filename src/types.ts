import type { HttpErrorCodes, HttpErrorStatus } from './http';

/**
 * Utility type to simplify and prettify a given type.
 *
 * @template Type - The type to be prettified.
 */
export type Prettify<Type> = Type extends Function
  ? Type
  : Extract<
      {
        [Key in keyof Type]: Type[Key];
      },
      Type
    >;

/**
 * Merge two object types, with properties from `Object2` overriding those in `Object1`.
 *
 * @template Object1 - The base object type.
 * @template Object2 - The object type whose properties will take precedence.
 */
export type Merge<Object1, Object2> = Prettify<
  Omit<Object1, keyof Object2> & Object2
>;

/**
 * Represents the base URL used by Aspi.
 *
 * Accepts either a string representation of the URL or a native {@link URL} object.
 */
export type BaseURL = string | URL;

/**
 * Base configuration for Aspi.
 *
 * This configuration is merged with native `RequestInit` properties and
 * is intended to be passed alongside a `RequestInit` object when initializing
 * an Aspi instance.
 */
export type AspiConfigBase = {
  /**
   * The base URL for all Aspi requests.
   */
  baseUrl: BaseURL;
  /**
   * Optional retry configuration applied to all requests.
   */
  retryConfig?: AspiRetryConfig<AspiRequestInit>;
};
/**
 * Configuration for an Aspi instance.
 *
 * This type includes all parameters that can be passed during Aspi initialization.
 * It merges selected `RequestInit` properties (`headers` and `mode`) with the base
 * Aspi configuration defined in {@link AspiConfigBase}.
 *
 * @extends Merge<Pick<RequestInit, 'headers' | 'mode'>, AspiConfigBase>
 */
export interface AspiRequestInit
  extends Merge<
    Pick<
      RequestInit,
      | 'method'
      | 'headers'
      | 'mode'
      | 'credentials'
      | 'cache'
      | 'redirect'
      | 'referrer'
      | 'referrerPolicy'
      | 'integrity'
      | 'keepalive'
      | 'signal'
    >,
    AspiConfigBase
  > {}

/**
 * Configuration for an Aspi request that also includes a request body.
 *
 * Extends {@link AspiRequestInit} with the optional `body` property from the native
 * {@link RequestInit} type.
 *
 * @template TBody - The type of the request body (defaults to `any`).
 * @extends Merge<Pick<RequestInit, 'body'>, AspiRequestInit>
 */
export interface AspiRequestInitWithBody
  extends Merge<Pick<RequestInit, 'body'>, AspiRequestInit> {}

/**
 * Configuration options for retrying an Aspi request.
 *
 * @template TRequest - The request type extending {@link AspiRequestInit}.
 */
export type AspiRetryConfig<TRequest extends AspiRequestInit> = {
  /**
   * Maximum number of retry attempts. If omitted, no retries are performed.
   */
  retries?: number;

  /**
   * Delay before the next retry attempt.
   *
   * Can be a static number (milliseconds) or a function that dynamically
   * determines the delay based on the retry state and the request/response.
   *
   * @param remainingRetries - Number of retries left after the current attempt.
   * @param totalRetries - The total number of retries configured.
   * @param request - The original {@link AspiRequest} being retried.
   * @param response - The {@link AspiResponse} received from the failed attempt.
   * @returns A delay in milliseconds or a promise that resolves to one.
   */
  retryDelay?:
    | number
    | ((
        remainingRetries: number,
        totalRetries: number,
        request: AspiRequest<TRequest>,
        response: AspiResponse,
      ) => number | Promise<number>);

  /**
   * Array of HTTP status codes that should trigger a retry.
   */
  retryOn?: Array<HttpErrorCodes>;

  /**
   * Predicate function that determines whether a retry should occur based on the
   * request and response. Returning `true` triggers a retry.
   *
   * @param request - The {@link AspiRequest} that was sent.
   * @param response - The {@link AspiResponse} received.
   * @returns A boolean or a promise that resolves to a boolean.
   */
  retryWhile?: (
    request: AspiRequest<TRequest>,
    response: AspiResponse,
  ) => boolean | Promise<boolean>;

  /**
   * Callback invoked after each retry attempt.
   *
   * @param request - The {@link AspiRequest} that was retried.
   * @param response - The {@link AspiResponse} from the failed attempt.
   */
  onRetry?: (request: AspiRequest<TRequest>, response: AspiResponse) => void;
};

/**
 * Callback type for handling custom errors.
 *
 * @template T - The request type extending {@link AspiRequestInit}.
 * @template A - The shape of the error object returned by the callback.
 * @param input - Object containing the request and response that triggered the error.
 * @param input.request - The {@link AspiRequest} associated with the failed request.
 * @param input.response - The {@link AspiResponse} received from the server.
 * @returns The error data of type `A`.
 */
export type CustomErrorCb<T extends AspiRequestInit, A extends {}> = (input: {
  request: AspiRequest<T>;
  response: AspiResponse;
}) => A;

/**
 * Transforms a request before it is sent.
 *
 * @template T - The original request type extending {@link AspiRequestInit}.
 * @template U - The resulting request type extending {@link AspiRequestInit}.
 * @param request - The request instance to be transformed.
 * @returns The transformed request of type `U`.
 */
export type RequestTransformer<
  T extends AspiRequestInit,
  U extends AspiRequestInit,
> = (request: T) => U;

// Aspi Instance
export type RequestOptions<TRequest extends AspiRequestInit> = {
  requestConfig: TRequest;
  retryConfig?: AspiRetryConfig<TRequest>;
  middlewares?: RequestTransformer<TRequest, TRequest>[];
  errorCbs?: ErrorCallbacks;
  throwOnError?: boolean;
};

/**
 * Record of custom error callbacks keyed by HTTP status code.
 *
 * It keeps track of the custom error callbacks (`cb`) provided for specific
 * response codes. Each entry includes:
 *
 * - `cb`: a function receiving the request and response objects that generated the error.
 * - `tag`: an optional identifier or metadata associated with the callback.
 *
 * This type is used in {@link RequestOptions.errorCbs} to map status codes to
 * their corresponding handlers.
 */
export type ErrorCallbacks = Record<
  number,
  {
    cb: (input: { request: any; response: any }) => any;
    tag: unknown;
  }
>;

/**
 * Represents a successful Aspi request result.
 *
 * @template TRequest - The request initialization options type extending {@link AspiRequestInit}.
 * @template TData - The type of the response data.
 * @property {TData} data - The parsed response payload.
 * @property {AspiRequest<TRequest>} request - The request that was sent.
 * @property {AspiResponse} response - The response wrapper containing status, status text, and the native {@link Response} object.
 */
export type AspiResultOk<TRequest extends AspiRequestInit, TData> = {
  data: TData;
  request: AspiRequest<TRequest>;
  response: AspiResponse;
};

/**
 * Represents a successful Aspi request result without any additional metadata.
 *
 * This type is an alias for {@link AspiResultOk} and is provided for semantic
 * clarity when a plain response shape is desired.
 *
 * @template TRequest - The request initialization options type extending {@link AspiRequestInit}.
 * @template TData - The type of the response payload.
 */
export type AspiPlainResponse<
  TRequest extends AspiRequestInit,
  TData,
> = AspiResultOk<TRequest, TData>;

/**
 * Interface representing an API request configuration.
 *
 * @interface AspiRequest
 * @template T - Request initialization options type extending {@link AspiRequestInit}
 * @property {string} path - Request path to append to the base URL.
 * @property {T} requestInit - Request initialization options.
 * @property {URLSearchParams | null} queryParams - URL query parameters, if any.
 */
export interface AspiRequest<T extends AspiRequestInit> {
  path: string;
  requestInit: T;
  queryParams: URLSearchParams | null;
}

/**
 * Represents the response returned by an Aspi request.
 *
 * @template TData - The type of the response payload when the request succeeds.
 * @template IsError - `true` if the response represents an error condition; `false` otherwise.
 *
 * @property {HttpErrorCodes} status - HTTP status code of the response.
 * @property {HttpErrorStatus} statusText - HTTP status text associated with the status code.
 * @property {Response} response - The native {@link Response} object.
 * @property {TData} [responseData] - The parsed response body. When `IsError` is `true` this property is required; otherwise it is optional.
 */
export type AspiResponse<TData = any, IsError extends boolean = false> = Merge<
  { status: HttpErrorCodes; statusText: HttpErrorStatus; response: Response },
  IsError extends true ? { responseData: TData } : { responseData?: any }
>;
