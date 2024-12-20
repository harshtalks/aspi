# aspi

I made this project because I am not happy with any of the Rest API clients available in eco system. Sure, Axios is great but it feels so bloated and I am never going to use interceptors or any of the other features it provides. I just want to make a simple request and get the response. That's it. So, I made this project. It is a simple Rest API client that is built on top of native fetch API. It is very simple to use and has a very small bundle size. It is perfect for small projects where you don't want to bloat your project with unnecessary features.

## Why Aspi?
🔷 End to end TypeScript support.
📦 Very small bundle size.
⛓️ Chain of responsibility pattern.
🧮 Monadic API.
⚠️ Errors as values with Result type.
🔍 Errors comes with support for pattern matching.


## Example
```typescript
import { aspi, Result } from 'aspi';

const apiClient = new Aspi({
  baseUrl: "https://api.example.com",
  headers: {
    "Content-Type": "application/json",
  },
});

const getTodos = async (id: number) => {
  const response = await apiClient
    .get(`/todos/${id}`)
    .notFound(() => ({
      message: "Todo not found",
    }))
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
      if (error.tag === "ASPI_ERROR") {
        console.error(error.response.status);
      } else if (error.tag === "NOT_FOUND") {
        console.log(error.data.message);
      }
    },
  });
};

getTodos(1);
```
