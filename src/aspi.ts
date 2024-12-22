import type { HttpMethods } from './http';
import { Request } from './request';
import type { AspiConfig, AspiRequestInit, Middleware } from './types';

/**
 * A class for making API requests with a base URL and configurable options
 * @template TRequest - Type extending RequestInit for request configuration
 * @example
 * const api = new Aspi({
 *   baseUrl: 'https://api.example.com',
 *   headers: {
 *     'Content-Type': 'application/json'
 *   }
 * });
 *
 * // Make requests
 * const users = await api.get('/users').json();
 * const user = await api.post('/users', { name: 'John' }).json();
 */
export class Aspi<TRequest extends AspiRequestInit = AspiRequestInit> {
  #globalRequestInit: TRequest;
  #middlewares: Middleware<TRequest, TRequest>[] = [];

  constructor(config: AspiConfig) {
    this.#globalRequestInit = config as TRequest;
  }

  /**
   * Sets the base URL for all API requests
   * @param {string} url - The base URL to be set
   * @returns {Aspi} The Aspi instance for chaining
   * @example
   * const api = new Aspi({ baseUrl: 'https://api.example.com' });
   * api.setBaseUrl('https://api.newdomain.com');
   */
  setBaseUrl(url: string) {
    this.#globalRequestInit.baseUrl = url;
    return this;
  }

  #createRequest<M extends HttpMethods>(
    method: M,
    path: string,
    body?: BodyInit,
  ) {
    return new Request<M, TRequest, {}>(
      method,
      path,
      {
        ...this.#globalRequestInit,
        method,
        body: body,
      },
      this.#middlewares,
    );
  }

  /**
   * Makes a GET request to the specified path
   * @param {string} path - The path to make the request to
   * @returns {Request} A Request instance for chaining
   * @example
   * const api = new Aspi({ baseUrl: 'https://api.example.com' });
   * const response = await api.get('/users').json();
   */
  get(path: string) {
    return this.#createRequest('GET', path);
  }

  /**
   * Makes a POST request to the specified path with an optional body
   * @param {string} path - The path to make the request to
   * @param {BodyInit} [body] - The body of the request
   * @returns {Request} A Request instance for chaining
   * @example
   * const api = new Aspi({ baseUrl: 'https://api.example.com' });
   * const response = await api.post('/users', { name: 'John' }).json();
   */
  post(path: string, body?: BodyInit) {
    return this.#createRequest('POST', path, body);
  }

  /**
   * Makes a PUT request to the specified path with an optional body
   * @param {string} path - The path to make the request to
   * @param {BodyInit} [body] - The body of the request
   * @returns {Request} A Request instance for chaining
   * @example
   * const api = new Aspi({ baseUrl: 'https://api.example.com' });
   * const response = await api.put('/users/1', { name: 'John' }).json();
   */
  put(path: string, body?: BodyInit) {
    return this.#createRequest('PUT', path, body);
  }

  /**
   * Makes a PATCH request to the specified path with an optional body
   * @param {string} path - The path to make the request to
   * @param {BodyInit} [body] - The body of the request
   * @returns {Request} A Request instance for chaining
   * @example
   * const api = new Aspi({ baseUrl: 'https://api.example.com' });
   * const response = await api.patch('/users/1', { name: 'John' }).json();
   */
  patch(path: string, body?: BodyInit) {
    return this.#createRequest('PATCH', path, body);
  }

  /**
   * Makes a DELETE request to the specified path
   * @param {string} path - The path to make the request to
   * @returns {Request} A Request instance for chaining
   * @example
   * const api = new Aspi({ baseUrl: 'https://api.example.com' });
   * const response = await api.delete('/users/1').json();
   */
  delete(path: string) {
    return this.#createRequest('DELETE', path);
  }

  /**
   * Makes a HEAD request to the specified path
   * @param {string} path - The path to make the request to
   * @returns {Request} A Request instance for chaining
   * @example
   * const api = new Aspi({ baseUrl: 'https://api.example.com' });
   * const response = await api.head('/users').json();
   */
  head(path: string) {
    return this.#createRequest('HEAD', path);
  }

  /**
   * Makes an OPTIONS request to the specified path
   * @param {string} path - The path to make the request to
   * @returns {Request} A Request instance for chaining
   * @example
   * const api = new Aspi({ baseUrl: 'https://api.example.com' });
   * const response = await api.options('/users').json();
   */
  options(path: string) {
    return this.#createRequest('OPTIONS', path);
  }

  /**
   * Sets multiple headers for all API requests
   * @param {Record<string, string>} headers - An object containing header key-value pairs
   * @returns {Aspi} The Aspi instance for chaining
   * @example
   * const api = new Aspi({ baseUrl: 'https://api.example.com' });
   * api.setHeaders({
   *   'Content-Type': 'application/json',
   *   'Accept': 'application/json'
   * });
   */
  setHeaders(headers: Record<string, string>) {
    this.#globalRequestInit.headers = headers;
    return this;
  }

  /**
   * Sets a single header for all API requests
   * @param {string} key - The header key
   * @param {string} value - The header value
   * @returns {Aspi} The Aspi instance for chaining
   * @example
   * const api = new Aspi({ baseUrl: 'https://api.example.com' });
   * api.setHeader('Content-Type', 'application/json');
   */
  setHeader(key: string, value: string) {
    this.#globalRequestInit.headers = {
      ...this.#globalRequestInit.headers,
      [key]: value,
    };
    return this;
  }

  /**
   * Sets the Authorization header with a Bearer token
   * @param {string} token - The Bearer token
   * @returns {Aspi} The Aspi instance for chaining
   * @example
   * const api = new Aspi({ baseUrl: 'https://api.example.com' });
   * api.setBearer('myAuthToken123');
   */
  setBearer(token: string) {
    return this.setHeader('Authorization', `Bearer ${token}`);
  }

  /**
   * Use a middleware function to transform requests
   * @param {Middleware<T, U>} fn - The middleware function to apply
   * @returns {Aspi<U>} A new Aspi instance with the applied middleware
   * @example
   * const api = new Aspi({ baseUrl: 'https://api.example.com' });
   * api.use((req) => {
   *   // Add custom headers
   *   req.headers = {
   *     ...req.headers,
   *     'x-custom-header': 'custom-value'
   *   };
   *   return req;
   * });
   */
  use<T extends TRequest, U extends TRequest>(fn: Middleware<T, U>): Aspi<U> {
    this.#middlewares = [...this.#middlewares, fn as any];
    return this as unknown as Aspi<U>;
  }
}
