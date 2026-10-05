import type { HttpPort, HttpRequest, HttpResponse } from '../http.ts';

/** A pure in-memory `HttpPort`. An unfixtured request rejects instead of answering a default, so a network escape fails loudly (NFR-1). */

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
      return response === undefined ? Promise.reject(
          new Error(
            `[fake-http] no fixture for ${keyOf(request.method, request.url)} — record one rather than letting the request escape (NFR-1)`,
          ),
        ) : Promise.resolve(response);
    },
  };
}
