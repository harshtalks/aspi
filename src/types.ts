import type { AspiRequest, AspiResponse } from './error';

export type AspiRequestConfig = Pick<RequestInit, 'headers' | 'mode'>;
export type CustomErrorCb<T extends RequestInit, A extends {}> = (input: {
  request: AspiRequest<T>;
  response: AspiResponse;
}) => A;

export type Middleware<T extends RequestInit, U extends RequestInit> = (
  request: T,
) => U;

export interface AspiConfig extends RequestInit {
  baseUrl: string;
}

export interface BaseSchema {
  parse: (input: unknown) => unknown;
  _output: unknown;
}
