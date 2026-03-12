import type { AspiRequest, AspiRequestInit } from './types';

/**
 * Arguments passed to a capability factory.
 *
 * @template T - The concrete request-init type used by this Aspi instance.
 */
export type CapabilityArgs<T extends AspiRequestInit = AspiRequestInit> = {
  /**
   * The fully constructed AspiRequest that will be used to execute `fetch`.
   *
   * You can:
   * - inspect `request.path`, `request.requestInit`, `request.retryConfig`, etc.
   * - mutate `request.requestInit.headers`, `signal`, or other properties
   *   before the network call is made.
   */
  request: AspiRequest<AspiRequestInit>;
};

/**
 * A capability is a small wrapper around the low-level `fetch` call that can
 * intercept outgoing requests and incoming responses.
 *
 * It is a factory function that receives the current {@link AspiRequest}
 * and returns an object exposing a single `run` method. The `run` method is
 * responsible for invoking the provided `runner` (which performs the actual
 * `fetch`) and may:
 *
 * - call `runner()` directly and return its result
 * - call `runner()` multiple times (e.g. retry, refresh token then retry)
 * - short‑circuit by *not* calling `runner()` and returning a synthetic
 *   {@link Response} instead
 *
 * Capabilities are composed in the order they are registered via
 * `Aspi.useCapability`, with each capability wrapping the next one in the
 * chain.
 *
 * @template T - The concrete request-init type used by this Aspi instance.
 *
 * @example
 * ```ts
 * // Simple logging capability
 * const loggingCapability: Capability = ({ request }) => ({
 *   async run(runner) {
 *     console.log('→', request.path, request.requestInit);
 *     const res = await runner();
 *     console.log('←', res.status, res.statusText);
 *     return res;
 *   },
 * });
 *
 * const api = new Aspi({ baseUrl: 'https://api.example.com' })
 *   .useCapability(loggingCapability);
 * ```
 */
export type Capability<T extends AspiRequestInit = AspiRequestInit> = ({
  request,
}: CapabilityArgs<T>) => {
  /**
   * Executes the next step in the capability chain.
   *
   * @param runner - A function that, when called, performs the actual
   *   network request (or the next capability in the chain) and resolves to
   *   a {@link Response}.
   *
   * @returns A promise resolving to the final {@link Response} that should be
   *   used by Aspi for this request.
   */
  run: (runner: () => Promise<Response>) => Promise<Response>;
};
