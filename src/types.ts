import type { AspiRequest, AspiResponse } from './error';

export type AspiConfig = Pick<RequestInit, 'headers' | 'mode'> & {
  baseUrl: string;
};

export type CustomErrorCb<T extends RequestInit, A extends {}> = (input: {
  request: AspiRequest<T>;
  response: AspiResponse;
}) => A;

export type Middleware<T extends RequestInit, U extends RequestInit> = (
  request: T,
) => U;

export interface AspiRequestInit extends RequestInit {
  baseUrl: string;
}

export interface BaseSchema {
  parse: (input: unknown) => unknown;
  _output: unknown;
}
