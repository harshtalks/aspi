import type { ErrorRequest, ErrorResponse } from './error';

export type AspiRequestConfig = Pick<RequestInit, 'headers' | 'mode'>;
export type CustomErrorCb<T extends RequestInit, A extends {}> = (input: {
  request: ErrorRequest<T>;
  response: ErrorResponse;
}) => A;

export type Middleware<T extends RequestInit, U extends RequestInit> = (
  request: T,
) => U;

export interface AspiConfig extends RequestInit {
  baseUrl: string;
}
