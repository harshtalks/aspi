# Aspi

A tiny, type‑safe wrapper around the native **fetch** API that gives you a clean, monadic interface for HTTP requests.
It ships with **zero runtime dependencies**, a **tiny bundle size**, and full **TypeScript** support out of the box.

**Why use Aspi?**
- End‑to‑end TypeScript typings (request + response)
- No extra weight – only a thin wrapper around `fetch`
- Chain‑of‑responsibility middleware support via `use`
- Result‑based error handling (values as errors)
- Built‑in retry, header helpers, query‑string handling, and schema validation (Zod, Arktype, Valibot)
- Flexible error mapping with `error` and convenience shortcuts

---

## Installation

npm
`bash
    npm install aspi
    `

yarn
`bash
    yarn add aspi
    `

pnpm
`bash
    pnpm add aspi
    `

---

## Quick start

```ts
import { Aspi, Result } from 'aspi';

// Create a client with a base URL and default headers
const api = new Aspi({
  baseUrl: 'https://api.example.com',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Simple GET request – returns a tuple [value, error]
async function getTodo(id: number) {
  const [value, error] = await api
    .get(`/todos/${id}`)
    .setQueryParams({ include: 'details' }) // optional query string
    .notFound(() => ({ message: 'Todo not found' }))
    .json<{ id: number; title: string; completed: boolean }>();

  if (value) console.log('Todo:', value);
  if (error) {
    if (error.tag === 'aspiError') console.error(error.response.status);
    if (error.tag === 'notFoundError') console.warn(error.data.message);
    if (error.tag === 'jsonParseError') console.error(error.data.message);
  }
}

getTodo(1);
```

---


## Why Aspi?


Most real‑world codebases end up with one or more of these issues:

1. **Inconsistent error handling**

   - Some utilities throw raw `Error`/`AxiosError`.
   - Others return `{ ok: false, error }` or `null` or a custom union.
   - Callers don’t know whether to use `try/catch`, check `ok`, or both.

2. **Retry logic duplicated everywhere**

   - Each service rolls its own `while (attempt <= retries)` loop.
   - Status codes, backoff strategies, and retry limits slowly diverge over time.
   - There is no single place to see “how do we retry HTTP calls in this app?”.

3. **Validation pushed far from the network boundary**

   - Request payloads are sometimes validated, sometimes not.
   - Response validation happens deep in the business logic (if at all).
   - JSON parse errors leak as raw `SyntaxError`, not structured errors.

4. **Configuration scattered across factories and interceptors**

   - Base URL helpers, auth decorators, error mappers, retry plugins, and logging interceptors all live in different files.
   - Global state / interceptors can make it hard to tell what a given request will actually do.

5. **Type systems are bolted on, not designed in**

   - Generic HTTP clients often expose `any` for responses.
   - Error flows are not encoded in the type system, forcing manual guards and casting.

## How Aspi fixes them

Aspi’s design centers around three things:

1. **Mode‑driven responses**

   You decide at call‑site how you want to consume responses:

   - `withResult()` → `json/text/blob` return a `Result.Result<Ok, ErrorUnion>`.
   - `throwable()` → `json/text/blob` return `AspiPlainResponse` and throw on failure.
   - Default → `json/text/blob` return `[ok, err]` tuples.

   All error variants are **tagged** so they can be safely narrowed by `error.tag`.

2. **Centralized, configurable retry layer**

   Retry behavior is described declaratively:

   - `retries`: max attempts.
   - `retryDelay`: number or function `(attempt, maxAttempts, request, response) => delayMs`.
   - `retryOn`: list of HTTP status codes that should trigger a retry.
   - `retryWhile`: predicate `(request, response) => boolean` for custom retry conditions.
   - `onRetry`: hook invoked after each retry attempt.

   This configuration can be applied globally (`Aspi.setRetry`) and overridden per request (`Request.setRetry`).

3. **Validation at the transport boundary**

   Using a `StandardSchemaV1` interface, Aspi integrates with schema libraries (e.g. Zod, Valibot) to:

   - Validate request bodies with `bodySchema` + `bodyJson` **before** the network call.
   - Validate responses with `schema()` + `json()` **after** JSON parsing.

   These failures appear as tagged `parseError` values with structured issue lists, not random runtime exceptions.


---

## Using the `Result` monad

If you prefer a single `Result` value instead of a tuple, call **`.withResult()`** before a body‑parser method.

```ts
async function getTodoResult(id: number) {
  const response = await api
    .get(`/todos/${id}`)
    .notFound(() => ({ message: 'Todo not found' }))
    .withResult() // enable Result mode
    .json<{ id: number; title: string; completed: boolean }>();

  Result.match(response, {
    onOk: (data) => console.log('✅', data),
    onErr: (err) => {
      if (err.tag === 'aspiError') console.error(err.response.status);
      if (err.tag === 'notFoundError') console.warn(err.data.message);
    },
  });
}
```

---

## Throwable

The `throwable()` toggle makes a request **throw** on any non‑2xx HTTP response, allowing you to use the familiar `try / catch` pattern instead of dealing with tuples or `Result` objects.

When a request is in _throwable_ mode, the body‑parser methods (`json()`, `text()`, `blob()`) resolve with the parsed value directly. If the response status indicates an error, the promise is rejected with a typed Aspi error (e.g., `aspiError`, `unauthorisedError`, `jsonParseError`, …).

#### Basic usage

```ts
// Using throwable with async/await + try/catch
try {
  const todo = await api
    .get('/todos/1')
    .throwable() // <─ enable throwable mode
    .json<{ id: number; title: string; completed: boolean }>(); // returns the parsed JSON

  console.log('✅ Todo:', todo);
} catch (err) {
  // `err` is a typed Aspi error
  if (err.tag === 'aspiError') {
    console.error('HTTP error:', err.response.status);
  } else if (err.tag === 'jsonParseError') {
    console.error('Invalid JSON:', err.data.message);
  } else {
    console.error('Unexpected error:', err);
  }
}
```

#### Interaction with `withResult()`

`throwable()` and `withResult()` are _mutually exclusive_ – the last toggle applied wins.

```ts
// Result mode wins (throwable is ignored)
const result = await api
  .post('/login')
  .withResult() // enables Result mode
  .throwable() // ignored because withResult was called later
  .json<{ token: string }>();

// Throwable mode wins (Result is ignored)
const data = await api
  .get('/profile')
  .throwable() // enables throwable mode
  .withResult() // ignored because throwable was called later
  .json();
```

#### When to use `throwable()`

- You prefer native `try / catch` flow over tuple/result handling.
- You want the request to **reject** automatically on HTTP errors, keeping the success path clean.
- You are integrating Aspi into existing codebases that already rely on exception handling.

`throwable()` gives you the flexibility to choose the error‑handling style that best fits your project.

## Schema validation (Zod example)

```ts
import { z } from 'zod';
import { Aspi, Result } from 'aspi';

const api = new Aspi({
  baseUrl: 'https://jsonplaceholder.typicode.com',
  headers: { 'Content-Type': 'application/json' },
});

async function getValidatedTodo(id: number) {
  const response = await api
    .get(`/todos/${id}`)
    .withResult()
    .schema(
      z.object({
        id: z.number(),
        title: z.string(),
        completed: z.boolean(),
      }),
    )
    .json(); // type inferred from the schema

  Result.match(response, {
    onOk: (data) => console.log('Todo ✅', data),
    onErr: (err) => {
      if (err.tag === 'parseError') {
        const parseErr = err.data as z.ZodError;
        console.error('Validation failed:', parseErr.errors);
      } else {
        console.error('Other error', err);
      }
    },
  });
}
```

---

## Retry & back‑off

```ts
const api = new Aspi({
  baseUrl: 'https://example.com',
  headers: { 'Content-Type': 'application/json' },
}).setRetry({
  retries: 3,
  retryDelay: 1000, // simple fixed delay
  retryOn: [404, 500], // retry on specific status codes
});

// Override retry options for a single request
api
  .get('/todos/1')
  .setHeader('Accept', 'application/json')
  .setRetry({
    // exponential back‑off for this call only
    retryDelay: (attempt) => Math.pow(2, attempt) * 1000,
  })
  .withResult()
  .json()
  .then((res) =>
    Result.match(res, {
      onOk: (data) => console.log('Got data', data),
      onErr: (err) => console.error('Failed', err),
    }),
  );
```

---

## Global configuration helpers

| Method                   | Description                                                                                                                                                               |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `setBaseUrl(url)`        | Change the base URL for all subsequent requests.                                                                                                                          |
| `setHeaders(headers)`    | Merge an object of headers with any existing ones.                                                                                                                        |
| `setHeader(key, value)`  | Set a single header.                                                                                                                                                      |
| `setBearer(token)`       | Shortcut for `Authorization: Bearer <token>`.                                                                                                                             |
| `setRetry(retryConfig)`  | Define a global retry strategy (overridable per request).                                                                                                                 |
| `setQueryParams(params)` | Replace the request’s query string – accepts object, `URLSearchParams`, array of tuples, or raw string.                                                                   |
| `schema(schema)`         | Attach a `StandardSchemaV1` validator for the response body.                                                                                                              |
| `use(fn)`                | Register a request‑transformer middleware that receives the current `RequestInit` and returns a new one. Returns a new `Aspi` instance typed with the transformed config. |
| `withResult()`           | Switch the request into Result mode (returns a `Result` instead of a tuple).                                                                                              |
| `throwable()`            | Make the request throw on non‑2xx responses (useful for `try / catch` patterns).                                                                                          |
| `url()`                  | Get the fully‑qualified URL that will be used for the request.                                                                                                            |

---

## Custom error handling

Aspi lets you map **any HTTP status** to a typed error object that can be pattern‑matched later.

```ts
api
  .error('badRequestError', 'BAD_REQUEST', (req, res) => ({
    message: 'The request payload is invalid',
    payload: res.body,
  }))
  .error('unauthorisedError', 'UNAUTHORIZED', () => ({
    message: 'You must log in first',
  }));
```

Convenient shortcuts are provided for the most common statuses (each forwards to `error` internally and augments the generic `Opts['error']` type):

```ts
api.notFound(cb); // 404
api.tooManyRequests(cb); // 429
api.conflict(cb); // 409
api.badRequest(cb); // 400
api.unauthorised(cb); // 401 (British spelling, matches the Request API)
api.forbidden(cb); // 403
api.notImplemented(cb); // 501
api.internalServerError(cb); // 500
```

These helpers allow you to write:

```ts
api
  .get('/secret')
  .unauthorised(() => ({ message: 'You need a token' }))
  .withResult()
  .json()
  .then((res) =>
    Result.match(res, {
      onOk: (data) => console.log(data),
      onErr: (err) => {
        if (err.tag === 'unauthorisedError') {
          console.warn(err.data.message);
        }
      },
    }),
  );
```

---

## API reference (selected)

```ts
class Request<
  Method extends HttpMethods,
  TRequest extends AspiRequestInitWithBody = AspiRequestInit,
  Opts extends Record<any, any> = { error: {} },
> {
  // core request factories
  get(path: string): Request<'GET', TRequest, Opts>;
  post(path: string): Request<'POST', TRequest, Opts>;
  put(path: string): Request<'PUT', TRequest, Opts>;
  patch(path: string): Request<'PATCH', TRequest, Opts>;
  delete(path: string): Request<'DELETE', TRequest, Opts>;
  head(path: string): Request<'HEAD', TRequest, Opts>;
  options(path: string): Request<'OPTIONS', TRequest, Opts>;

  // configuration
  setBaseUrl(url: BaseURL): this;
  setHeaders(headers: HeadersInit): this;
  setHeader(key: string, value: string): this;
  setBearer(token: string): this;
  setRetry(cfg: AspiRetryConfig<TRequest>): this;
  setQueryParams(
    params: Record<string, string> | string[][] | string | URLSearchParams,
  ): this;
  use<T extends TRequest, U extends TRequest>(
    fn: RequestTransformer<T, U>,
  ): Request<U>;

  // schema validation
  schema<TSchema extends StandardSchemaV1>(
    schema: TSchema,
  ): Request<
    Method,
    TRequest,
    Merge<
      Omit<Opts, 'schema'>,
      {
        schema: TSchema;
        error: Merge<
          Opts['error'],
          {
            parseError: CustomError<
              'parseError',
              StandardSchemaV1.FailureResult['issues']
            >;
          }
        >;
      }
    >
  >;

  // result / throwable toggles
  withResult(): Request<
    Method,
    TRequest,
    Merge<
      Omit<Opts, 'withResult' | 'throwable'>,
      {
        withResult: true;
        throwable: false;
      }
    >
  >;
  throwable(): Request<
    Method,
    TRequest,
    Merge<
      Omit<Opts, 'withResult' | 'throwable'>,
      {
        withResult: false;
        throwable: true;
      }
    >
  >;

  // custom error handling
  error<Tag extends string, A extends {}>(
    tag: Tag,
    status: HttpErrorStatus,
    cb: CustomErrorCb<TRequest, A>,
  ): Request<
    Method,
    TRequest,
    Merge<
      Omit<Opts, 'error'>,
      {
        error: {
          [K in Tag | keyof Opts['error']]: K extends Tag
            ? CustomError<Tag, A>
            : Opts['error'][K];
        };
      }
    >
  >;
  notFound<A>(cb: CustomErrorCb<TRequest, A>): this;
  tooManyRequests<A>(cb: CustomErrorCb<TRequest, A>): this;
  conflict<A>(cb: CustomErrorCb<TRequest, A>): this;
  badRequest<A>(cb: CustomErrorCb<TRequest, A>): this;
  unauthorised<A>(cb: CustomErrorCb<TRequest, A>): this;
  forbidden<A>(cb: CustomErrorCb<TRequest, A>): this;
  notImplemented<A>(cb: CustomErrorCb<TRequest, A>): this;
  internalServerError<A>(cb: CustomErrorCb<TRequest, A>): this;

  // helpers
  url(): string;

  // response parsers
  json<T extends StandardSchemaV1.InferOutput<Opts['schema']>>(): Promise<
    Opts['withResult'] extends true
      ? Result.Result<
          AspiResultOk<TRequest, T>,
          | AspiError<TRequest>
          | (Opts extends { error: any }
              ? Opts['error'][keyof Opts['error']]
              : never)
          | JSONParseError
        >
      : Opts['throwable'] extends true
        ? AspiPlainResponse<TRequest, T>
        : [
            AspiResultOk<TRequest, T> | null,
            (
              | (
                  | AspiError<TRequest>
                  | (Opts extends { error: any }
                      ? Opts['error'][keyof Opts['error']]
                      : never)
                  | JSONParseError
                )
              | null
            ),
          ]
  >;
  text(): Promise<
    Opts['withResult'] extends true
      ? Result.Result<
          AspiResultOk<TRequest, string>,
          | AspiError<TRequest>
          | (Opts extends { error: any }
              ? Opts['error'][keyof Opts['error']]
              : never)
        >
      : Opts['throwable'] extends true
        ? AspiPlainResponse<TRequest, string>
        : [
            AspiResultOk<TRequest, string> | null,
            (
              | (
                  | AspiError<TRequest>
                  | (Opts extends { error: any }
                      ? Opts['error'][keyof Opts['error']]
                      : never)
                )
              | null
            ),
          ]
  >;
  blob(): Promise<
    Opts['withResult'] extends true
      ? Result.Result<
          AspiResultOk<TRequest, Blob>,
          | AspiError<TRequest>
          | (Opts extends { error: any }
              ? Opts['error'][keyof Opts['error']]
              : never)
        >
      : Opts['throwable'] extends true
        ? AspiPlainResponse<TRequest, Blob>
        : [
            AspiResultOk<TRequest, Blob> | null,
            (
              | (
                  | AspiError<TRequest>
                  | (Opts extends { error: any }
                      ? Opts['error'][keyof Opts['error']]
                      : never)
                )
              | null
            ),
          ]
  >;
}
```

---

## License

MIT © Aspi contributors
