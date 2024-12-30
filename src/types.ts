import type { AspiRequest, AspiResponse } from './error';
import type { HttpErrorCodes } from './http';

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
      ) => number);
  retryOn?: Array<HttpErrorCodes>;
  retryWhile?: (
    request: AspiRequest<TRequest>,
    response: AspiResponse,
  ) => boolean | Promise<boolean>;
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

// Zod Schema
export interface BaseSchema {
  parse: (input: unknown) => unknown;
  _output: unknown;
}

// Aspi Instance
export type RequestOptions<TRequest extends AspiRequestInit> = {
  requestConfig: TRequest;
  retryConfig?: AspiRetryConfig<TRequest>;
  middlewares?: Middleware<TRequest, TRequest>[];
  errorCbs?: ErrorCallbacks;
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
