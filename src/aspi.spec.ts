/**
 * Our Test Suite
 * We will write some tests here uwu
 *
 */

import { describe, expect, it } from 'vitest';
import { Aspi } from './aspi';
import { Result, type HttpErrorCodes } from '.';
import { z } from 'zod';

describe('JSON Response Suite', () => {
  const aspi = new Aspi({
    baseUrl: 'https://jsonplaceholder.typicode.com',
    headers: {
      'Content-Type': 'application/json',
    },
  }).use((request) => ({
    ...request,
    'custom-key': 'custom-value',
  }));

  describe('should get a todo - Tuple', async () => {
    const [todo, todoError] = await aspi.get('/todos/1').json<{
      userId: number;
      id: number;
      title: string;
      completed: boolean;
    }>();

    it('should yield a value and error as null', () => {
      expect(todo).toBeDefined();
      expect(todoError).toBeNull();
    });

    it('should have a custom value associated with custom key in the request', () => {
      expect(todo?.request.requestInit['custom-key']).toBe('custom-value');
    });

    it('should have url https://jsonplaceholder.typicode.com/todos/1', () => {
      expect(todo?.response.response?.url).toBe(
        'https://jsonplaceholder.typicode.com/todos/1',
      );
    });

    it('should have user id 1', () =>
      expect(todo?.data).toStrictEqual({
        userId: 1,
        id: 1,
        title: 'delectus aut autem',
        completed: false,
      }));

    it('should pass with status 200', () =>
      expect(todo?.response.status).toStrictEqual(200));
  });

  describe('should get a todo - Result', async () => {
    const todoResult = await aspi.get('/todos/1').withResult().json<{
      userId: number;
      id: number;
      title: string;
      completed: boolean;
    }>();

    it('should yield an Ok (success)', () => {
      expect(Result.isOk(todoResult)).toBeTruthy();
    });

    it('should have user id equal to 1', () => {
      expect(
        Result.pipe(
          todoResult,
          Result.map((todo) => todo.data.userId),
        ),
      ).toStrictEqual(Result.ok(1));
    });
  });

  describe('Should get a todo - Object', async () => {
    const todoObject = await aspi.get('/todos/1').throwable().json<{
      userId: number;
      id: number;
      title: string;
      completed: boolean;
    }>();

    it('should yield an Ok (success)', () => {
      expect(todoObject).toBeTruthy();
    });

    it('should have user id equal to 1', () => {
      expect(todoObject.data).toBeDefined();
      expect(todoObject.data).toHaveProperty('id', 1);
    });
  });

  describe('Should work well with throwable and result type', async () => {
    const response = await aspi.get('/todos/1').throwable().withResult().json<{
      userId: number;
      id: number;
      title: string;
      completed: boolean;
    }>();

    it('should yield a Result type when used withResult after throwable', () => {
      expect(response).toHaveProperty('__tag');
      expect(response).toHaveProperty('__tag', 'ok');
    });

    const resp = await aspi.get('/todos/1').withResult().throwable().json<{
      userId: number;
      id: number;
      title: string;
      completed: boolean;
    }>();

    it('should have todo object when throwable used after withResult', () => {
      expect(resp.data).toBeDefined();
      expect(resp.data).toHaveProperty('id', 1);
    });
  });

  describe('should get a todo - Schema validated', async () => {
    const [todo, todoError] = await aspi
      .get('/todos/1')
      .schema(
        z.object({
          userId: z.number(),
          id: z.number(),
          title: z.string(),
          completed: z.boolean(),
        }),
      )
      .json<{
        userId: number;
        id: number;
        title: string;
        completed: boolean;
      }>();

    it('should yield a value and error as null', () => {
      expect(todo).toBeDefined();
      expect(todoError).toBeNull();
    });

    it('should have user id equal to 1', () => {
      expect(todo?.data.userId).toStrictEqual(1);
    });
  });

  describe('should yield error when schema fails', async () => {
    const [todo, todoError] = await aspi
      .get('/todos/1')
      .schema(
        z.object({
          userId: z.string(),
          id: z.number(),
          title: z.string(),
          completed: z.boolean(),
        }),
      )
      // @ts-ignore
      .json<{
        userId: number;
        id: number;
        title: string;
        completed: boolean;
      }>();

    it('should yield a value as null and error', () => {
      expect(todo).toBeNull();
      expect(todoError).toBeDefined();
    });

    it('should have error tag as parseError"', () => {
      expect(todoError?.tag).toBe('parseError');
    });
  });
});

describe('Error Suite', () => {
  const aspi = new Aspi({
    baseUrl: 'https://mock.httpstatus.io',
  });

  describe('Http Status code errors', () => {
    const getHttpCodeResult = (status: HttpErrorCodes) =>
      aspi.get(`/${status}`).text();

    describe('it should yield with aspiError on 500 status code', async () => {
      const [response, error] = await getHttpCodeResult(500);

      it('should yield a response as null and error', () => {
        expect(response).toBeNull();
        expect(error).toBeDefined();
      });

      it('should yield with aspiError', () => {
        expect(error?.tag).toBe('aspiError');
      });

      it('should yield with an error that is instance of Error', () => {
        expect(error).toBeInstanceOf(Error);
      });

      it('should yield with an error that has status 500', () => {
        expect(error?.response.status).toBe(500);
      });
    });

    describe('it should yield with aspiError on 404 status code', async () => {
      const [response, error] = await getHttpCodeResult(404);

      it('should yield a response as null and error', () => {
        expect(response).toBeNull();
        expect(error).toBeDefined();
      });

      it('should yield with aspiError', () => {
        expect(error?.tag).toBe('aspiError');
      });

      it('should yield with an error that is instance of Error', () => {
        expect(error).toBeInstanceOf(Error);
      });

      it('should yield with an error that has status 404', () => {
        expect(error?.response.status).toBe(404);
      });
    });
  });

  describe('404 Error with custom tag', async () => {
    const [response, error] = await aspi
      .get('/404')
      .notFound(() => '404 not found')
      .text();

    it('should yield a response as null and error', () => {
      expect(response).toBeNull();
      expect(error).toBeDefined();
    });

    it('should yield with custom tag', () => {
      expect(error?.tag).toBe('notFoundError');
    });

    it('should yield with custom message', () => {
      if (error?.tag === 'notFoundError') {
        expect(error.data).toBe('404 not found');
      }
    });

    it('should yield an instance of Error', () => {
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('401 Error with custom tag and custom error callback', async () => {
    const [response, error] = await aspi
      .get('/401')
      .unauthorised(({ request, response }) => ({
        status: response.status,
        data: response.responseData,
      }))
      .text();

    it('should yield a response as null and error', () => {
      expect(response).toBeNull();
      expect(error).toBeDefined();
    });

    it('should yield with custom tag', () => {
      expect(error?.tag).toBe('unauthorisedError');
    });

    it('should yield an instance of Error', () => {
      expect(error).toBeInstanceOf(Error);
    });

    it('should yield with custom message', () => {
      if (error?.tag === 'unauthorisedError') {
        expect(error.data).toStrictEqual({
          status: 401,
          data: '401 Unauthorized',
        });
      }
    });
  });
});

describe('API Suite', () => {
  const aspi = new Aspi({
    baseUrl: 'https://jsonplaceholder.typicode.com',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  it("should have a header with 'custom key'", () => {
    aspi.setHeader('custom key', 'custom value');
    aspi.use((req) => {
      const headers = new Headers(req.headers);
      expect(headers.get('custom key')).toBe('custom value');
      return req;
    });
  });

  it('should have bearer token in the header', () => {
    aspi.setBearer('token');
    aspi.use((req) => {
      const headers = new Headers(req.headers);
      expect(headers.get('Authorization')).toBe('Bearer token');
      return req;
    });
  });
});

describe('Schema Suite', () => {
  const aspi = new Aspi({
    baseUrl: 'https://jsonplaceholder.typicode.com',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  describe('should yield error when schema fails', async () => {
    const [todo, todoError] = await aspi
      .post('/todos')
      .bodySchema(
        z.object({
          name: z.string(),
        }),
      )
      .bodyJson({
        // @ts-ignore
        name: 10,
      })
      .json();

    it('should yield a value as null and error', () => {
      expect(todo).toBeNull();
      expect(todoError).toBeDefined();
    });

    it('should have error tag as parseError"', () => {
      expect(todoError?.tag).toBe('parseError');
    });

    it('should yield an instance of Error', () => {
      expect(todoError).toBeInstanceOf(Error);
    });
  });
});

describe('Retry Suite', () => {
  const aspi = new Aspi({
    baseUrl: 'https://mock.httpstatus.io',
  });

  it('should retry 3 times', async () => {
    let count = 0;
    const [response] = await aspi
      .get('/500')
      .setRetry({
        retries: 3,
        retryOn: [500, 413],
        onRetry: () => {
          count++;
        },
      })
      .text();

    expect(response).toBeNull();
    expect(count).toBe(3);
  });

  it('should retry 4 times while condition is true', async () => {
    let count = 0;
    const [response] = await aspi
      .get('/500')
      .setRetry({
        retries: 4,
        retryWhile: () => true,
        onRetry: () => {
          count++;
        },
      })
      .text();

    expect(response).toBeNull();
    expect(count).toBe(4);
  });

  it('should retry while async condition is true', async () => {
    let count = 0;
    const [response] = await aspi
      .get('/500')
      .setRetry({
        retries: 4,
        retryWhile: async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));
          return true;
        },
        onRetry: () => {
          count++;
        },
      })
      .text();

    expect(response).toBeNull();
    expect(count).toBe(4);
  });

  it('should have retries with delay', async () => {
    let count = 0;
    const startTime = performance.now();
    const retries = 2;
    const totalTimeout = 1000 * (retries - 1);
    const [response] = await aspi
      .get('/500')
      .setRetry({
        retries,
        retryOn: [500],
        retryDelay: 1000,
        onRetry: () => {
          count++;
        },
      })
      .text();

    const totalTime = performance.now() - startTime;
    expect(response).toBeNull();
    expect(count).toBe(retries);
    expect(totalTime).toBeGreaterThanOrEqual(totalTimeout);
  });

  it('should have exponential backoff', async () => {
    let count = 0;
    const startTime = performance.now();
    const retries = 4;
    const baseDelay = 10;
    const [response] = await aspi
      .get('/500')
      .setRetry({
        retries,
        retryOn: [500],
        retryDelay: (remaining, total) =>
          baseDelay * Math.pow(2, total - remaining),
        onRetry: () => {
          count++;
        },
      })
      .text();

    const totalTime = performance.now() - startTime;
    const expectedDelay =
      baseDelay + baseDelay * 2 + baseDelay * 4 + baseDelay * 8;

    expect(response).toBeNull();
    expect(count).toBe(retries);
    expect(totalTime).toBeGreaterThanOrEqual(expectedDelay);
  });

  it('should have retries with delay as promise', async () => {
    let count = 0;
    const startTime = performance.now();
    const retries = 2;
    const totalTimeout = 1000 * (retries - 1);
    const [response] = await aspi
      .get('/500')
      .setRetry({
        retries,
        retryOn: [500],
        retryDelay: async () => {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          return 1000;
        },
        onRetry: () => {
          count++;
        },
      })
      .text();

    const totalTime = performance.now() - startTime;
    expect(response).toBeNull();
    expect(count).toBe(retries);
    expect(totalTime).toBeGreaterThanOrEqual(totalTimeout);
  });
});
