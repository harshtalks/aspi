# aspi

[![Bundle Size](https://img.shields.io/bundlephobia/minzip/aspi)](https://bundlephobia.com/package/aspi)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

A tiny, type-safe HTTP client for TypeScript built on native `fetch`.

Zero runtime dependencies. Three response modes. Full error-union types.

---

## Features

- **Zero dependencies** — thin wrapper around the platform `fetch` API
- **Three response modes** — tuple `[data, error]`, `Result` monad, or `throwable` (your choice per call)
- **Typed error unions** — every error variant is tagged and narrowable at compile time
- **Custom error mapping** — map any HTTP status code to a structured, typed error object
- **Retry with back-off** — fixed or dynamic delay, status-code filtering, custom predicates
- **Schema validation** — validate request bodies and responses via any [StandardSchemaV1](https://github.com/standard-schema/standard-schema) library (Zod, Valibot, Arktype, …)
- **Middleware** — transform the `RequestInit` for every request via `use()`
- **Capabilities** — plugin-level interception of the raw `fetch` call (logging, token refresh, tracing)

---

## Installation

```bash
npm install aspi
# or
yarn add aspi
# or
pnpm add aspi
```

TypeScript 5+ is required as a peer dependency.

---

## Quick start

```ts
import { Aspi, Result } from 'aspi';

const api = new Aspi({
  baseUrl: 'https://jsonplaceholder.typicode.com',
  headers: { 'Content-Type': 'application/json' },
});

// Tuple mode — default
const [data, error] = await api
  .get('/todos/1')
  .notFound(() => ({ message: 'Todo not found' }))
  .json<{ id: number; title: string; completed: boolean }>();

if (error) {
  if (error.tag === 'aspiError') console.error(error.response.status);
  if (error.tag === 'notFoundError') console.warn(error.data.message);
  if (error.tag === 'jsonParseError') console.error(error.data.message);
}

if (data) console.log(data.title);
```

---

## Response modes

Every request can be consumed in one of three modes. Switch mode by calling `.withResult()` or `.throwable()` before the body-parser method.

### 1. Tuple mode (default)

Returns `[AspiResultOk | null, ErrorUnion | null]`. Familiar to anyone who has used Go-style error handling.

```ts
const [data, error] = await api.get('/users/1').json<User>();

if (error) {
  /* handle */
}
console.log(data!.name);
```

### 2. Result mode

Returns a `Result<Ok, ErrorUnion>` tagged union. Use `.withResult()` to enable.

```ts
const result = await api.get('/users/1').withResult().json<User>();

Result.match(result, {
  onOk: ({ data }) => console.log(data.name),
  onErr: (err) => console.error(err.tag, err),
});
```

### 3. Throwable mode

Returns the parsed value directly and throws a typed error on any non-2xx response. Use `.throwable()` to enable.

```ts
try {
  const { data } = await api.get('/users/1').throwable().json<User>();
  console.log(data.name);
} catch (err) {
  if (err.tag === 'aspiError') console.error(err.response.status);
}
```

> `throwable()` and `withResult()` are mutually exclusive — the **last one called wins**.

---

## Error handling

### Built-in error variants

Every response mode surfaces the same tagged error variants:

| Tag              | When                                                         |
| ---------------- | ------------------------------------------------------------ |
| `aspiError`      | Any non-2xx response with no matching custom handler         |
| `jsonParseError` | Response body could not be parsed as JSON                    |
| `parseError`     | Response failed schema validation (when `.schema()` is used) |
| _custom_         | Any tag you define via `.error()` or a convenience shortcut  |

### Custom error mapping

Map an HTTP status to a typed, tagged error object. The callback receives the full request and response.

```ts
const [data, error] = await api
  .post('/login')
  .bodyJson({ email, password })
  .error('rateLimitedError', 'TOO_MANY_REQUESTS', ({ response }) => ({
    retryAfter: response.response.headers.get('Retry-After'),
  }))
  .json<{ token: string }>();

if (error?.tag === 'rateLimitedError') {
  console.warn('Retry after', error.data.retryAfter, 'seconds');
}
```

### Convenience shortcuts

Pre-built shortcuts for the most common statuses. Each produces a typed error with a predictable tag.

| Method                     | Status | Error tag              |
| -------------------------- | ------ | ---------------------- |
| `.notFound(cb)`            | 404    | `notFoundError`        |
| `.badRequest(cb)`          | 400    | `badRequestError`      |
| `.unauthorized(cb)`        | 401    | `unauthorizedError`    |
| `.forbidden(cb)`           | 403    | `forbiddenError`       |
| `.conflict(cb)`            | 409    | `conflictError`        |
| `.tooManyRequests(cb)`     | 429    | `tooManyRequestsError` |
| `.notImplemented(cb)`      | 501    | `notImplementedError`  |
| `.internalServerError(cb)` | 500    | `internalServerError`  |

> Note: When calling these on the `Request` object (e.g. `api.get('/…').unauthorised(…)`) the method is spelled `.unauthorised()` (British) and produces an `unauthorisedError` tag. On the `Aspi` instance itself the method is `.unauthorized()` (American). All other shortcuts are spelled identically on both.

```ts
const [data, error] = await api
  .get('/account')
  .notFound(() => ({ message: 'Account does not exist' }))
  .unauthorized(() => ({ message: 'Please sign in' }))
  .json<Account>();

if (error?.tag === 'notFoundError') redirect('/signup');
if (error?.tag === 'unauthorizedError') redirect('/login');
```

### Inspecting `AspiError`

The base `aspiError` variant exposes the full request and response, plus an `.ifMatch()` helper for conditional handling.

```ts
if (error?.tag === 'aspiError') {
  console.log(error.response.status); // numeric HTTP status code
  console.log(error.response.statusLabel); // e.g. "NOT_FOUND"
  console.log(error.response.statusText); // raw status text
  console.log(error.request.path); // request path

  // Run a callback only for a specific status
  error.ifMatch('INTERNAL_SERVER_ERROR', ({ response }) => {
    reportToSentry(response);
  });
}
```

---

## Making requests

### HTTP methods

```ts
api.get('/users');
api.post('/users');
api.put('/users/1');
api.patch('/users/1');
api.delete('/users/1');
api.head('/users');
api.options('/users');
```

### Request body

Use `.bodyJson()` to send a JSON payload. Pair it with `.bodySchema()` to validate the body before the network call.

```ts
// Plain JSON body
const [data, error] = await api
  .post('/users')
  .bodyJson({ name: 'Alice', email: 'alice@example.com' })
  .json<User>();

// Validated body (Zod example)
import { z } from 'zod';

const CreateUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});

const [data, error] = await api
  .post('/users')
  .bodySchema(CreateUserSchema) // validate before sending
  .bodyJson({ name: 'Alice', email: 'alice@example.com' })
  .json<User>();

// If bodyJson fails validation, error.tag === 'parseError'
```

### Query parameters

`.setQueryParams()` accepts an object, `URLSearchParams`, an array of tuples, or a raw string.

```ts
// Object — most common
api.get('/todos').setQueryParams({ page: '2', limit: '20' }).json();

// URLSearchParams
api
  .get('/todos')
  .setQueryParams(new URLSearchParams({ q: 'typescript' }))
  .json();

// Check the resolved URL before sending
console.log(api.get('/todos').setQueryParams({ page: '2' }).url());
// → https://api.example.com/todos?page=2
```

### Headers

```ts
// Single header
api.get('/data').setHeader('X-Request-ID', crypto.randomUUID());

// Multiple headers
api.get('/data').setHeaders({ Accept: 'application/json', 'X-Version': '2' });

// Bearer token shortcut
api.get('/me').setBearer(accessToken);
```

---

## Retry

Configure retry behavior globally on the `Aspi` instance, then override per request as needed.

```ts
const api = new Aspi({
  baseUrl: 'https://api.example.com',
  headers: { 'Content-Type': 'application/json' },
}).setRetry({
  retries: 3,
  retryDelay: 500, // fixed 500 ms between attempts
  retryOn: [429, 500, 502, 503, 504],
});

// Override for a single request — exponential back-off
const [data, error] = await api
  .get('/reports/heavy')
  .setRetry({
    retryDelay: (remaining, total) => Math.pow(2, total - remaining) * 200,
    retryWhile: (_req, res) => res.status >= 500,
    onRetry: (_req, res) => console.warn('Retrying after', res.status),
  })
  .withResult()
  .json<Report>();
```

### Retry config options

| Option       | Type                                                        | Description                                   |
| ------------ | ----------------------------------------------------------- | --------------------------------------------- |
| `retries`    | `number`                                                    | Maximum number of retry attempts              |
| `retryDelay` | `number \| (remaining, total, request, response) => number` | Delay in ms, or a function returning one      |
| `retryOn`    | `number[]`                                                  | HTTP status codes that should trigger a retry |
| `retryWhile` | `(request, response) => boolean`                            | Custom predicate — return `true` to retry     |
| `onRetry`    | `(request, response) => void`                               | Hook called after each failed attempt         |

---

## Schema validation

Aspi integrates with any library that implements the [StandardSchemaV1](https://github.com/standard-schema/standard-schema) interface, including **Zod**, **Valibot**, and **Arktype**.

Attach a schema with `.schema()` before the body-parser. The inferred output type is used automatically — you don't need to pass a generic.

```ts
import { z } from 'zod';

const TodoSchema = z.object({
  id: z.number(),
  title: z.string(),
  completed: z.boolean(),
});

const result = await api.get('/todos/1').withResult().schema(TodoSchema).json(); // return type is inferred from the schema

Result.match(result, {
  onOk: ({ data }) => console.log(data.title), // data: { id: number; title: string; completed: boolean }
  onErr: (err) => {
    if (err.tag === 'parseError') {
      console.error('Validation failed:', err.data); // StandardSchemaV1 issue list
    }
  },
});
```

---

## Middleware

`.use()` registers a request transformer that runs for every request created from the instance. It returns a **new `Aspi` instance** typed with the transformed request shape.

```ts
// Add a correlation ID to every outgoing request
const api = new Aspi({ baseUrl: 'https://api.example.com' }).use((req) => ({
  ...req,
  headers: {
    ...req.headers,
    'X-Correlation-ID': crypto.randomUUID(),
  },
}));

// Chain multiple transformers
const authedApi = api.use((req) => ({
  ...req,
  headers: { ...req.headers, Authorization: `Bearer ${getToken()}` },
}));
```

---

## Capabilities

> **Experimental** — names and behavior may change in minor versions.

Capabilities are plugins that wrap the low-level `fetch` call. Unlike middleware (which transforms the `RequestInit`), capabilities can inspect the raw `Response`, call `runner()` multiple times, or return a synthetic response entirely.

```ts
import type { Capability } from 'aspi';

const loggingCapability: Capability = ({ request }) => ({
  async run(runner) {
    console.log('→', request.requestInit.method, request.path);
    const res = await runner();
    console.log('←', res.status, res.statusText);
    return res;
  },
});

const api = new Aspi({ baseUrl: 'https://api.example.com' }).useCapability(
  loggingCapability,
);
```

Capabilities are composed in registration order, each wrapping the next.

```ts
const api = new Aspi({ baseUrl: 'https://api.example.com' })
  .useCapability(loggingCapability)
  .useCapability(tracingCapability)
  .useCapability(tokenRefreshCapability);
```

### Example: token refresh capability

```ts
import type { Capability } from 'aspi';

let tokens = { access: '', refresh: '' };

const tokenRefreshCapability: Capability = () => {
  let isRefreshing = false;

  return {
    async run(runner) {
      const res = await runner();
      if (res.status !== 401 || !tokens.refresh || isRefreshing) return res;

      isRefreshing = true;
      try {
        const refreshRes = await fetch('/auth/refresh', {
          method: 'POST',
          body: JSON.stringify({ refreshToken: tokens.refresh }),
          headers: { 'Content-Type': 'application/json' },
        });
        const body = await refreshRes.json();
        tokens = { access: body.accessToken, refresh: body.refreshToken };
      } finally {
        isRefreshing = false;
      }

      // Retry the original request with the new token
      return runner();
    },
  };
};
```

---

## Result module

`aspi` exports a standalone `Result` module — a small tagged-union utility used internally and available for your own code.

```ts
import * as Result from 'aspi/result';
// or
import { Result } from 'aspi';
```

### Creating results

```ts
const success = Result.ok(42); // { __tag: 'ok', value: 42 }
const failure = Result.err('not found'); // { __tag: 'err', error: 'not found' }
```

### Checking and extracting

```ts
Result.isOk(success); // true
Result.isErr(failure); // true

Result.getOrNull(success); // 42
Result.getOrNull(failure); // null

Result.getErrorOrNull(failure); // 'not found'
Result.getOrElse(failure, 0); // 0

Result.getOrThrow(success); // 42
Result.getOrThrow(failure); // throws 'not found'

Result.getOrThrowWith(failure, (e) => new Error(e)); // throws Error('not found')
```

### Transforming

```ts
Result.map(success, (n) => n * 2); // ok(84)
Result.mapErr(failure, (e) => e.toUpperCase()); // err('NOT FOUND')

// Curried style (useful in pipelines)
const double = Result.map((n: number) => n * 2);
double(success); // ok(84)
```

### Pattern matching

```ts
const message = Result.match(result, {
  onOk: ({ data }) => `Loaded ${data.name}`,
  onErr: (err) => `Failed: ${err.tag}`,
});
```

### Handling tagged errors

When the error type is a tagged union, use `catchError` and `catchErrors` to handle specific variants and narrow the remaining type.

```ts
type AppError =
  | { tag: 'notFoundError'; message: string }
  | { tag: 'unauthorizedError' }
  | { tag: 'aspiError'; response: AspiResponse };

// Handle one tag
Result.catchError(result, 'notFoundError', (e) => {
  console.warn(e.message);
});

// Handle multiple tags
Result.catchErrors(result, {
  notFoundError: (e) => console.warn(e.message),
  unauthorizedError: () => redirect('/login'),
});
```

### Pipe utility

```ts
const price = Result.pipe(
  1234,
  (cents) => cents / 100,
  (amount) => amount.toFixed(2),
  (str) => `$${str}`,
);
// '$12.34'
```

---

## Global configuration reference

These methods are available on the `Aspi` instance and affect all requests created from it.

| Method                    | Description                                  |
| ------------------------- | -------------------------------------------- |
| `setBaseUrl(url)`         | Change the base URL                          |
| `setHeaders(headers)`     | Merge an object of headers                   |
| `setHeader(key, value)`   | Set a single header                          |
| `setBearer(token)`        | Shortcut for `Authorization: Bearer <token>` |
| `setRetry(config)`        | Set a global retry strategy                  |
| `use(fn)`                 | Register a request-transformer middleware    |
| `useCapability(cap)`      | Register a capability                        |
| `withResult()`            | Switch all requests to Result mode           |
| `throwable()`             | Switch all requests to throwable mode        |
| `.error(tag, status, cb)` | Map an HTTP status to a typed error          |

Per-request methods (`api.get('/…').setQueryParams(…)`, `.schema(…)`, `.bodyJson(…)`, etc.) override the global config for that call only.

---

## Contributing

```bash
# Install dependencies
pnpm install

# Run tests in watch mode
pnpm test

# Run tests once (used in CI)
pnpm test:run

# Build
pnpm build

# Type-check
pnpm lint

# Format
pnpm format
```

All CI checks (`pnpm ci`) run test, build, format check, and type-check in sequence. Please ensure they pass before opening a pull request.

---

## License

MIT © [Harsh Pareek](https://hrshwrites.vercel.app)
