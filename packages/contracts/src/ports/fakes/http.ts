import type { HttpPort, HttpRequest, HttpResponse } from '../http';

/**
 * A pure in-memory `HttpPort`. It holds its state in the closure and imports no
 * `node:` builtin, which is what lets Stories 1.3 onward test against the port
 * before its adapter exists.
 *
 * An unfixtured request **rejects** rather than returning a default. NFR-1's
 * whole point is that an unfixtured request fails loudly; a fake that answered
 * `404` would be a quieter version of the network escape the test setup exists
 * to catch.
 */

/** Keyed `"<METHOD> <url>"`, e.g. `"POST https://example.test/search"`. */
export type HttpFixtures = Readonly<Record<string, HttpResponse>>;

export interface FakeHttpPort extends HttpPort {
  /** Every request sent, in order. */
  readonly requests: readonly HttpRequest[];
  /** Adds or replaces one fixture. */
  respondTo(method: HttpRequest['method'], url: string, response: HttpResponse): void;
}

function keyOf(method: string, url: string): string {
  return `${method} ${url}`;
}

export function createFakeHttpPort(fixtures: HttpFixtures = {}): FakeHttpPort {
  const responses = new Map<string, HttpResponse>(Object.entries(fixtures));
  const requests: HttpRequest[] = [];

  return {
    requests,
    respondTo(method, url, response) {
      responses.set(keyOf(method, url), response);
    },
    send(request) {
      requests.push(request);
      const response = responses.get(keyOf(request.method, request.url));
      if (response === undefined) {
        return Promise.reject(
          new Error(
            `[fake-http] no fixture for ${keyOf(request.method, request.url)} — record one rather than letting the request escape (NFR-1)`,
          ),
        );
      }
      return Promise.resolve(response);
    },
  };
}
