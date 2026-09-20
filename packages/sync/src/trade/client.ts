/**
 * The one governed trade client (FR-20, AD-8).
 *
 * **Exactly one module in `sync` issues a trade request.** Stories 1.4, 1.7 and
 * 1.11 all spend through this factory; a second call site that built its own
 * `HttpPort` request would pace independently against one shared budget, which
 * is the failure this module exists to prevent.
 *
 * What it does, in order: applies the standing headers, consults the ledger for
 * the policy the request is about to spend against, waits if the tightest
 * bucket is unsatisfied, issues through `HttpPort`, folds the response headers
 * back into the ledger, and returns either the response or a **yield**.
 *
 * What it does not do: build a search body, parse a result, take a median,
 * convert to Divine, retry, queue, or persist anything. It transports.
 */

import type { ClockPort, HttpPort, HttpRequest, HttpResponse } from '@poe/contracts';

import {
  derivedYieldDelayMs,
  EMPTY_LEDGER,
  paceBeforeNext,
  recordObservation,
  type RateLimitLedger,
} from './ledger.ts';
import {
  countInvalidRequest,
  type InvalidRequestCounts,
  invalidRequestsFor,
  isInvalidRequest,
  NO_INVALID_REQUESTS,
  thresholdReached,
} from './invalid-requests.ts';
import {
  parseRateLimitHeaders,
  type RateLimitHeaders,
  type RateLimitSkip,
} from './rate-limit-headers.ts';
import { MissingUserAgentError } from './user-agent.ts';

const USER_AGENT_HEADER = 'user-agent';
const REQUESTED_WITH_HEADER = 'x-requested-with';
const REQUESTED_WITH_VALUE = 'XMLHttpRequest';
const CONTENT_TYPE_HEADER = 'content-type';
const JSON_CONTENT_TYPE = 'application/json';
const RETRY_AFTER_HEADER = 'retry-after';

const TOO_MANY_REQUESTS = 429;
const MS_PER_SECOND = 1000;

/**
 * How many lanes the policy memo keeps. The key space belongs to the caller, so
 * without a cap a long-running process that labels its own lanes would grow the
 * map forever. Least recently used is evicted, which costs only a cold start on
 * the lane that has waited longest.
 */
const MAX_REMEMBERED_LANES = 64;

/** `Retry-After` in delta-seconds. A non-integer value is treated as absent. */
const DELTA_SECONDS = /^\d+$/;

export interface TradeClientOptions {
  readonly http: HttpPort;
  readonly clock: ClockPort;
  /**
   * Injected delay. `ClockPort` carries `now()` only and this story adds
   * nothing to it (a `contracts` change lands alone and first), so the delay is
   * a passed-in value on the factory — which is exactly what NFR-3 asks for and
   * is what lets a backoff test assert recorded durations without waiting on
   * the wall clock.
   */
  readonly wait: (ms: number) => Promise<void>;
  /** The whole `User-Agent` header, read from the overlay at the shell edge. */
  readonly userAgent: string;
  /**
   * How many `4xx` responses one policy may accumulate before the client stops
   * issuing against it (GGG's Invalid Requests Threshold, which revokes
   * access). **A value, never a compiled-in number**, exactly as no rate is.
   *
   * Omitted, nothing is refused and the running count is still surfaced on
   * every result — which is the right shape for a short command that aborts on
   * its own first failure, and the wrong one for a long chunk run.
   */
  readonly invalidRequestThreshold?: number;
}

export interface TradeRequest {
  readonly method: HttpRequest['method'];
  readonly url: string;
  readonly body?: string;
  /** Extra request headers. The standing headers below always win. */
  readonly headers?: Readonly<Record<string, string>>;
  /**
   * An **opaque** grouping label, meaningful only to the caller.
   *
   * A response names its own policy, but a request must be paced *before* one
   * arrives, so the client remembers which policy each lane's last response
   * carried and paces the next request in that lane against it. The client
   * never interprets the label, never compares it to a literal, and never maps
   * it to a policy in code — the mapping is learned from `X-Rate-Limit-Policy`.
   * Omitted, it defaults to the request's method and URL path.
   */
  readonly lane?: string;
}

interface TradeExchange {
  readonly lane: string;
  /** The policy this exchange was accounted against, where one was named. */
  readonly policy: string | undefined;
  /** What the client actually waited before issuing. `0` when it did not. */
  readonly waitedMs: number;
  /** Rules named in the response that could not be read, never thrown. */
  readonly skips: readonly RateLimitSkip[];
  /**
   * `4xx` responses seen on this policy so far, this result included. It rides
   * on **every** result, so a caller can see the threshold approaching rather
   * than only learning it has arrived.
   */
  readonly invalidRequests: number;
}

export interface TradeResponseResult extends TradeExchange {
  readonly kind: 'response';
  readonly response: HttpResponse;
}

export type TradeYieldReason =
  | 'retry-after-header'
  | 'derived-penalty'
  | 'invalid-request-threshold';

/**
 * A `429`, or a refusal at the Invalid Requests Threshold. The client **never
 * retries and never sleeps out a `429`**: the ledger was already wrong, and the
 * right response is to stop spending — a decision about the whole chunk rather
 * than about one request. Returning the delay lets Story 1.5's runner release
 * its lock and exit; sleeping here would hold the lock through a penalty
 * window.
 */
export interface TradeYieldResult extends TradeExchange {
  readonly kind: 'yield';
  /**
   * `0` on an `invalid-request-threshold` yield, because that breach is not
   * recoverable by waiting — the run has to stop, not pause.
   */
  readonly retryAfterMs: number;
  readonly reason: TradeYieldReason;
  /** Absent on a threshold refusal: nothing was issued, so nothing came back. */
  readonly response?: HttpResponse;
}

export type TradeResult = TradeResponseResult | TradeYieldResult;

export interface TradeClient {
  send(request: TradeRequest): Promise<TradeResult>;
}

/**
 * The default lane drops the **final** path segment, because that is where the
 * varying part of a trade URL lives — a result id on a fetch, a league on a
 * search. Keeping it would make every fetch its own lane, so the ledger would
 * miss on every call and each request would issue unpaced against a bucket the
 * previous one had already spent from.
 */
function defaultLaneOf(request: TradeRequest): string {
  let pathname: string;
  try {
    pathname = new URL(request.url).pathname;
  } catch {
    return `${request.method} ${request.url}`;
  }
  const segments = pathname.split('/').filter((segment) => segment !== '');
  if (segments.length <= 1) {
    return `${request.method} ${pathname}`;
  }
  return `${request.method} /${segments.slice(0, -1).join('/')}`;
}

function laneOf(request: TradeRequest): string {
  if (request.lane !== undefined && request.lane.trim() !== '') {
    return request.lane;
  }
  return defaultLaneOf(request);
}

/**
 * The standing headers of `IMPLEMENTATION-NOTES.md` §5.1, applied last so a
 * caller cannot drop the contact address or the `XMLHttpRequest` marker.
 */
function headersFor(request: TradeRequest, userAgent: string): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const [name, value] of Object.entries(request.headers ?? {})) {
    headers[name.toLowerCase()] = value;
  }
  headers[USER_AGENT_HEADER] = userAgent;
  headers[REQUESTED_WITH_HEADER] = REQUESTED_WITH_VALUE;
  if (request.method === 'POST') {
    headers[CONTENT_TYPE_HEADER] = JSON_CONTENT_TYPE;
  }
  return headers;
}

function retryAfterMsOf(headers: Readonly<Record<string, string>>): number | undefined {
  for (const [name, value] of Object.entries(headers)) {
    if (name.toLowerCase() !== RETRY_AFTER_HEADER) {
      continue;
    }
    const trimmed = value.trim();
    if (!DELTA_SECONDS.test(trimmed)) {
      // An HTTP-date form, or garbage. Either way the ledger's own penalty is a
      // better answer than a `NaN` the caller would have to guard against.
      return undefined;
    }
    const delayMs = Number(trimmed) * MS_PER_SECOND;
    // `Retry-After: 0` is honoured as *absent*, not as "come straight back".
    // The server has just refused the request; a zero-length yield would send
    // the caller round again immediately, which is the tight retry AD-8
    // forbids.
    return delayMs > 0 ? delayMs : undefined;
  }
  return undefined;
}

/**
 * The floor under a derived yield, taken from what **this** response declared.
 *
 * `derivedYieldDelayMs` reads the ledger, and the ledger can be empty — a `429`
 * carrying no readable rule, or the very first request of a process. A yield of
 * `0` ms tells the caller to re-enter at once, so the widest window or penalty
 * the response itself named is used instead, and `MINIMUM_YIELD_MS` catches the
 * case where it named nothing at all. It is a floor on a refusal, not a rate:
 * nothing paces from it and it is never compared against a bucket.
 */
const MINIMUM_YIELD_MS = 1000;

function declaredYieldFloorMs(parsed: RateLimitHeaders): number {
  let floor = 0;
  for (const rule of parsed.rules) {
    for (const bucket of rule.buckets) {
      floor = Math.max(floor, bucket.penalty * MS_PER_SECOND, bucket.seconds * MS_PER_SECOND);
    }
  }
  return Math.max(floor, MINIMUM_YIELD_MS);
}

/**
 * Builds the client. It **refuses at construction** when the contact
 * `User-Agent` is blank, so no request is ever issued without one (NFR-9).
 */
export function createTradeClient(options: TradeClientOptions): TradeClient {
  const { http, clock, wait, userAgent, invalidRequestThreshold } = options;
  if (userAgent.trim() === '') {
    throw new MissingUserAgentError();
  }

  let ledger: RateLimitLedger = EMPTY_LEDGER;
  let invalidRequests: InvalidRequestCounts = NO_INVALID_REQUESTS;
  /** lane -> the policy that lane's last response was accounted against. */
  const lanePolicies = new Map<string, string>();

  function rememberPolicy(lane: string, policy: string): void {
    // Delete-then-set moves the lane to the end of the Map's insertion order,
    // so the eviction below drops the least recently used lane. The cap bounds
    // a map whose key space is the caller's, not this module's.
    lanePolicies.delete(lane);
    lanePolicies.set(lane, policy);
    while (lanePolicies.size > MAX_REMEMBERED_LANES) {
      const oldest = lanePolicies.keys().next();
      if (oldest.done === true) {
        break;
      }
      lanePolicies.delete(oldest.value);
    }
  }

  /**
   * Requests are issued **one at a time**, chained onto the previous call.
   *
   * The pacing logic assumes the ledger is at most one request out of date, and
   * that only holds if nothing else is in flight: two concurrent calls would
   * both read the same stale ledger, both see room, and both issue. The queue
   * is what makes the assumption true rather than hoped for.
   */
  let tail: Promise<unknown> = Promise.resolve();

  async function exchange(request: TradeRequest): Promise<TradeResult> {
    const lane = laneOf(request);
    const knownPolicy = lanePolicies.get(lane);

    // Checked before the wait and before the request, because the threshold is
    // the one limit that waiting does not clear: passing it revokes access.
    // Refusing costs a chunk; spending it costs the product.
    if (thresholdReached(invalidRequests, knownPolicy, invalidRequestThreshold)) {
      return {
        kind: 'yield',
        lane,
        policy: knownPolicy,
        waitedMs: 0,
        skips: [],
        invalidRequests: invalidRequestsFor(invalidRequests, knownPolicy),
        retryAfterMs: 0,
        reason: 'invalid-request-threshold',
      };
    }

    // Computed once and waited once. Recomputing after the wait would not
    // terminate under a fixed test clock, and the ledger cannot have changed
    // in the meantime — `send` queues, so only this call's own response moves
    // it.
    const pace = paceBeforeNext(ledger, knownPolicy, clock.now());
    let waitedMs = 0;
    if (pace.delayMs > 0) {
      waitedMs = pace.delayMs;
      await wait(pace.delayMs);
    }

    const response = await http.send({
      method: request.method,
      url: request.url,
      headers: headersFor(request, userAgent),
      body: request.body,
    });

    const parsed = parseRateLimitHeaders(response.headers);
    ledger = recordObservation(ledger, parsed, clock.now());
    if (parsed.policy !== undefined) {
      rememberPolicy(lane, parsed.policy);
    }
    const policy = parsed.policy ?? knownPolicy;

    // Every `4xx` counts, not only the three the documentation names.
    if (isInvalidRequest(response.status)) {
      invalidRequests = countInvalidRequest(invalidRequests, policy);
    }
    const counted = invalidRequestsFor(invalidRequests, policy);

    if (response.status === TOO_MANY_REQUESTS) {
      const fromHeader = retryAfterMsOf(response.headers);
      const derived = derivedYieldDelayMs(ledger, policy);
      return {
        kind: 'yield',
        lane,
        policy,
        waitedMs,
        skips: parsed.skips,
        invalidRequests: counted,
        response,
        retryAfterMs: fromHeader ?? (derived > 0 ? derived : declaredYieldFloorMs(parsed)),
        reason: fromHeader === undefined ? 'derived-penalty' : 'retry-after-header',
      };
    }

    // Every other status — a `503` included, and a counted `403` — is the
    // caller's to decide on, returned unchanged. `HttpPort` is a value both
    // ways and this client does not narrow that.
    return {
      kind: 'response',
      lane,
      policy,
      waitedMs,
      skips: parsed.skips,
      invalidRequests: counted,
      response,
    };
  }

  return {
    send(request) {
      const issued = tail.then(
        () => exchange(request),
        () => exchange(request),
      );
      // The queue must survive a rejected exchange, or one failure would wedge
      // every later request behind it.
      tail = issued.catch(() => undefined);
      return issued;
    },
  };
}
