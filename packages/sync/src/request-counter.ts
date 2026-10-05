// Counts before the wrapped port answers: a request that times out or throws still left the
// machine. The source is whatever the caller wrapped the port for (AD-12, FR-14).

import { RequestSourceSchema } from '@poe/contracts';
import type { HttpPort, RequestSource } from '@poe/contracts';

export type RequestsBySource = Readonly<Record<RequestSource, number>>;

export interface RequestCounter {
  /** An `HttpPort` that sends through `http` and counts each request against `source`. */
  counted(http: HttpPort, source: RequestSource): HttpPort;
  /** The requests counted so far, every source present. */
  snapshot(): RequestsBySource;
}

/** Every source, each `0`. */
export function zeroRequests(): Record<RequestSource, number> {
  return Object.fromEntries(RequestSourceSchema.options.map((source) => [source, 0])) as Record<
    RequestSource,
    number
  >;
}

export function createRequestCounter(): RequestCounter {
  const counts = zeroRequests();
  return {
    counted(http, source) {
      return {
        send(request) {
          counts[source] += 1;
          return http.send(request);
        },
      };
    },
    snapshot() {
      return { ...counts };
    },
  };
}

/** `later − earlier`, per source: the requests sent between two snapshots. */
export function requestsBetween(earlier: RequestsBySource, later: RequestsBySource): RequestsBySource {
  const difference = zeroRequests();
  for (const source of RequestSourceSchema.options) {
    difference[source] = later[source] - earlier[source];
  }
  return difference;
}
