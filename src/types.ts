import type { AspiRequest, AspiResponse } from './error';
import type { HttpErrorCodes } from './http';

// Utility types
export type Prettify<Type> = Type extends Function
  ? Type
  : Extract<
      {
        [Key in keyof Type]: Type[Key];
      },
      Type
    >;

export type Merge<Object1, Object2> = Prettify<
  Omit<Object1, keyof Object2> & Object2
>;

export type AspiConfigBase = {
  baseUrl: string;
  retryConfig?: AspiRetryConfig<AspiRequestInit>;
};

export type AspiRetryConfig<TRequest extends AspiRequestInit> = {
  retries?: number;
  retryDelay?:
    | number
    | ((
        remainingRetries: number,
        totalRetries: number,
        request: AspiRequest<TRequest>,
        response: AspiResponse,
      ) => number | Promise<number>);
  retryOn?: Array<HttpErrorCodes>;
  retryWhile?: (
    request: AspiRequest<TRequest>,
    response: AspiResponse,
  ) => boolean | Promise<boolean>;
  onRetry?: (request: AspiRequest<TRequest>, response: AspiResponse) => void;
};

// Config for Aspi Instance
export type AspiConfig = Pick<RequestInit, 'headers' | 'mode'> & AspiConfigBase;

// Custom error callback
export type CustomErrorCb<T extends AspiRequestInit, A extends {}> = (input: {
  request: AspiRequest<T>;
  response: AspiResponse;
}) => A;

// Middleware type -> modify request before sending
export type Middleware<T extends RequestInit, U extends RequestInit> = (
  request: T,
) => U;

// Aspi Request Init
export interface AspiRequestInit extends RequestInit, AspiConfigBase {}

// Aspi Instance
export type RequestOptions<TRequest extends AspiRequestInit> = {
  requestConfig: TRequest;
  retryConfig?: AspiRetryConfig<TRequest>;
  middlewares?: Middleware<TRequest, TRequest>[];
  errorCbs?: ErrorCallbacks;
  throwOnError?: boolean;
};

// Error Callbacks
export type ErrorCallbacks = Record<
  number,
  {
    cb: (input: { request: any; response: any }) => any;
    tag: unknown;
  }
>;

export type AspiResultOk<TRequest extends AspiRequestInit, TData> = {
  data: TData;
  request: AspiRequest<TRequest>;
  response: AspiResponse;
};

export type AspiPlainResponse<
  TRequest extends AspiRequestInit,
  TData,
> = AspiResultOk<TRequest, TData>;
