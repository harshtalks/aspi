# aspi

I made this project because I am not happy with any of the Rest API clients available in eco system. Sure, Axios is great but it feels so bloated and I am never going to use interceptors or any of the other features it provides. I just want to make a simple request and get the response. That's it. So, I made this project. It is a simple Rest API client that is built on top of native fetch API. It is very simple to use and has a very small bundle size. It is perfect for small projects where you don't want to bloat your project with unnecessary features.

## Why Aspi?

- 🔷 End to end TypeScript support
- 📦 Very small bundle size
- 🚀 Built on top of native fetch API
- 📦 No dependencies
- ⛓️ Chain of responsibility pattern
- 🧮 Monadic API
- ⚠️ Errors as values with Result type
- 🔍 Errors comes with support for pattern matching
- 🔄 Retry support
- 📜 Schema validation support - Zod, Arktype etc.


## Example

```typescript
import { aspi, Result } from 'aspi';

const apiClient = new Aspi({
  baseUrl: 'https://api.example.com',
  headers: {
    'Content-Type': 'application/json',
  },
});

const getTodos = async (id: number) => {
  const [value,error] = await apiClient
    .get(`/todos/${id}`)
    .notFound(() => ({
      message: 'Todo not found',
    }))
    .json<{
      id: number;
      title: string;
      completed: boolean;
    }>();

  if(value){
    console.log(value);
  }

  if(error){
    if(error.tag === 'aspiError'){
      console.error(error.response.status);
    }else if(error.tag === 'notFoundError'){
      console.log(error.data.message);
    }
  }

};

getTodos(1);
```

## With Result type

```typescript
  const getTodos = async (id: number) => {
    const [value,error] = await apiClient
      .get(`/todos/${id}`)
      .notFound(() => ({
        message: 'Todo not found',
      }))
      .withResult()
      .json<{
        id: number;
        title: string;
        completed: boolean;
      }>();

    Result.match(response, {
      onOk: (data) => {
        console.log(data);
      },
      onErr: (error) => {
        if (error.tag === 'aspiError') {
          console.error(error.response.status);
        } else if (error.tag === 'notFoundError') {
          console.log(error.data.message);
        }
      },
    });

    getTodos(1);
};
```

## Example with Schema Validation (with Zod)

```typescript
import { aspi, Result } from 'aspi';
import { z, ZodError } from 'zod';

// JSON Placeholder API Client
const apiClient = new Aspi({
  baseUrl: 'https://jsonplaceholder.typicode.com',
  headers: {
    'Content-Type': 'application/json',
  },
});

const getTodo = async (id: number) => {
  const response = await apiClient
    .get(`/todos/${id}`)
    .withResult()
    .schema(
      z.object({
        id: z.number(),
        title: z.string(),
        completed: z.boolean(),
      }),
    )
    .json();

  Result.match(response, {
    onOk: (data) => {
      console.log(data);
    },
    onErr: (err) => {
      if (err.tag === 'parseError') {
        const error = err.data as ZodError;
        console.error(error.errors);
      } else {
        // do something else
      }
    },
  });
};
```

## Example with retry

```typescript
import { aspi, Result } from 'aspi';

const apiClient = new Aspi({
  baseUrl: 'https://example.com',
  headers: {
    'Content-Type': 'application/json',
  },
}).setRetry({
  retries: 3,
  retryDelay: 1000,
  // retry on 404 error
  retryOn: [404],
});

// the given GET endpoint does not exist
apiClient
  .get('/todos/1')
  .setHeader('Content-Type', 'application/json')
  // Updating retry options for this request
  .setRetry({
    // Exponential backoff
    retryDelay: (attempts) => Math.pow(2, attempts) * 1000,
  })
  .withResult()
  .json()
  .then((response) => {
    Result.match(response, {
      onOk: (data) => {
        console.log(data);
      },
      onErr: (error) => {
        if (error.tag === 'aspiError') {
          console.error(error.response);
        } else if (error.tag === 'notFoundError') {
          console.log(error.data.message);
        }
      },
    });
  });
```

### Installation

```bash
npm install aspi
```

### Features

#### Result type

- `Result` type is a union type of `Ok` and `Err` type.
- When you call a method that returns a `Result` type, you can use methods on `Result` to handle the result.
- When the api succeeds, It will yield an `Ok` type with the data.
- When the api fails, It will yield an `Err` type with the error.

When succeded with OK, the data comes in the `AspiSuccessOk` type, where additional information about the request and response is also provided.

#### Error handling

- The error handling is done using the `Result` type, which is a union type of `Ok` and `Err` type.
- When called `json` method on the response, it will return either the AspiSuccessOk with the data or AspiError with the error as well as JSON parsing error.
- Additionally, user can define custom errors to handle specific http status codes, those errors can be pattern matched using any pattern matching library.


#### API Descriptions

##### WithResult
By default, the response is not wrapped in the Result type. It will be a tuple of the value and error. both can be null but only one will be non-null at a time. If you want the response to be wrapped in the Result type, you can call `withResult` method on the response.

```typescript
const response = await new Aspi({ baseUrl: '...' })
  .get('...')
  .json<{ data: any }>();

// [AspiResultOk<AspiRequestInit, {  data: any; }> | null, JSONParseError | AspiError<AspiRequestInit> | null]
```typescript

The above response is a tuple of the value and error. The value itself is wrapped in the AspiResultOk type. It contains the request and response information as well as the data. If you want the response to be wrapped in the Result type, you can call `withResult` method on the response.

```typescript
const response = await new Aspi({ baseUrl: '...' })
  .get('...')
  .withResult()
  .json<{ data: any }>();

// Result<AspiResultOk<AspiRequestInit, { data: any; }>, JSONParseError | AspiError<AspiRequestInit>>
```typescript

The above response is a Result type. It can be pattern matched using any pattern matching library. We also pack one custom Result implementation that can be used to pattern match the response.

```typescript
// handling all the errors
const resultWithoutError = Result.pipe(
  response,
  Result.map((data) => data.data),
)
  .pipe(
    Result.catchError('aspiError', () => {
      console.log('aspi error');
    }),
  )
  .pipe(
    Result.catchError('jsonParseError', () =>
      console.log('failed to parse json error'),
    ),
  )
  .execute();

// Result<AspiResultOk<AspiRequestInit, { data: any; }>, never>
```

##### Schema Validation
Aspi by default implements schema validation using StandardSchemaV1. It means, as of now, it only supports Zod, Arktype and Valibot. If you want to use schema validation, you can call the `schema` method on the response.

```typescript
import { aspi, Result } from 'aspi';
import { z, ZodError } from 'zod';

// JSON Placeholder API Client
const apiClient = new Aspi({
  baseUrl: 'https://jsonplaceholder.typicode.com',
  headers: {
    'Content-Type': 'application/json',
  },
});

const getTodo = async (id: number) => {
  const response = await apiClient
    .get(`/todos/${id}`)
    .withResult()
    .schema(
      z.object({
        id: z.number(),
        title: z.string(),
        completed: z.boolean(),
      }),
    )
    .json();

  Result.match(response, {
    onOk: (data) => {
      console.log(data);
    },
    onErr: (err) => {
      if (err.tag === 'parseError') {
        const error = err.data as ZodError;
        console.error(error.errors);
      } else {
        // do something else
      }
    },
  });
};
```
