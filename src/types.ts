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
  ) => boolean;
};

export type AspiConfig = Pick<RequestInit, 'headers' | 'mode'> & AspiConfigBase;

export type CustomErrorCb<T extends AspiRequestInit, A extends {}> = (input: {
  request: AspiRequest<T>;
  response: AspiResponse;
}) => A;

export type Middleware<T extends RequestInit, U extends RequestInit> = (
  request: T,
) => U;

export interface AspiRequestInit extends RequestInit, AspiConfigBase {}

export interface BaseSchema {
  parse: (input: unknown) => unknown;
  _output: unknown;
}

export type RequestOptions<TRequest extends AspiRequestInit> = {
  requestConfig: TRequest;
  retryConfig?: AspiRetryConfig<TRequest>;
  middlewares?: Middleware<TRequest, TRequest>[];
  errorCbs?: ErrorCallbacks;
};

export type ErrorCallbacks = Record<
  number,
  {
    cb: (input: { request: any; response: any }) => any;
    tag: unknown;
  }
>;
