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

import { createSerialSender } from './client/serial-sender.ts';
import type { GovernorContext } from './client/governor-context.ts';
import { createPacingState, laneDelayMs } from './client/pacing-state.ts';
import type { PacingState } from './client/pacing-state.ts';
import { NO_INVALID_REQUESTS } from './invalid-requests.ts';
import type { RateLimitSkip } from './rate-limit-headers.ts';
import type { SessionAuth } from './session-auth.ts';
import { MissingUserAgentError } from './user-agent.ts';

export { createPacingState, laneDelayMs, resetPacingState } from './client/pacing-state.ts';
export type { PacingState } from './client/pacing-state.ts';

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
  /**
   * One line of operator output, written once per `429` the server returns —
   * never on a threshold refusal, which sends nothing. Omitted, nothing is
   * written. The client never reaches for `process`
   * itself: the shell decides where the line goes.
   */
  readonly log?: (line: string) => void;
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
  /**
   * `true` on a pricing search and a pricing fetch, and on nothing else
   * (AD-30, IMPLEMENTATION-NOTES.md §13.2). The governor probes and attaches
   * the session cookie only on a marked request; it never guesses from the
   * method or the lane, because lanes are opaque (AD-8). The league request
   * stays unmarked, so it never carries the cookie.
   */
  readonly cookieEligible?: boolean;
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
  /**
   * The allowance left on the policy this response was spent against: the
   * smallest `hits - state.hits` over every bucket of every rule the response
   * declared, never below `0`. Absent where the response declared no readable
   * rule, or where nothing was issued. The chunk runner stops once it drops
   * below `1`; the number is always read from the headers, never assumed.
   */
  readonly remaining?: number;
}

export interface TradeResponseResult extends TradeExchange {
  readonly kind: 'response';
  readonly response: HttpResponse;
}

/**
 * `session-expired` is AD-30's downgrade (IMPLEMENTATION-NOTES.md §13.4): a
 * request that carried the session cookie got a `401`, a `403` or a 2xx that
 * failed the liveness test. It carries no response and no penalty, so the
 * pricing step reads it as AD-9's request with no answer.
 */
export type TradeYieldReason =
  | 'retry-after-header'
  | 'derived-penalty'
  | 'invalid-request-threshold'
  | 'session-expired';

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
   * recoverable by waiting — the run has to stop, not pause. `0` on a
   * `session-expired` yield too, which carries no penalty:
   * `penaltyRetryAfterMs` answers `undefined` for both.
   */
  readonly retryAfterMs: number;
  readonly reason: TradeYieldReason;
  /**
   * Absent on a threshold refusal: nothing was issued, so nothing came back.
   * Absent on a `session-expired` yield: the downgrading answer is discarded.
   */
  readonly response?: HttpResponse;
}

/**
 * The delay a `429` yield carried — the `Retry-After` header, or the floor the
 * client derived from the same response — or `undefined` on a threshold
 * refusal, which no wait recovers. This is the `retryAfter` of
 * IMPLEMENTATION-NOTES.md §5.3, the input to a chunk's `notBefore`.
 */
export function penaltyRetryAfterMs(result: TradeYieldResult): number | undefined {
  // `invalid-request-threshold` and `session-expired` carry no penalty.
  return result.reason === 'retry-after-header' || result.reason === 'derived-penalty'
    ? result.retryAfterMs
    : undefined;
}

export type TradeResult = TradeResponseResult | TradeYieldResult;

export interface TradeClient {
  send(request: TradeRequest): Promise<TradeResult>;
}

/**
 * Builds the client. It **refuses at construction** when the contact
 * `User-Agent` is blank, so no request is ever issued without one (NFR-9).
 */
export function createTradeClient(options: TradeClientOptions): TradeClient {
  const { http, ...shared } = options;
  return createTradeClients({ ...shared, http: { only: http } }).only;
}

export interface TradeClientsOptions<Source extends string>
  extends Omit<TradeClientOptions, 'http'> {
  /** One `HttpPort` per client, typically one per request source (`../request-counter.ts`). */
  readonly http: Readonly<Record<Source, HttpPort>>;
}

/**
 * Sibling clients, one per `HttpPort`, that are **one governor**: they share
 * the ledger, the invalid-request counts, the lane memo and the serial queue.
 *
 * This is how two request sources are counted apart without being paced
 * apart. The counter tells a source by the port it wrapped (AD-12), so each
 * source needs its own port; but the budget is the trade API's, not the
 * source's. Two independent clients would each start cold and each spend
 * unpaced against the same buckets, which is the failure this module exists
 * to prevent (AD-8). It refuses a blank `User-Agent` exactly as
 * `createTradeClient` does.
 */
export function createTradeClients<Source extends string>(
  options: TradeClientsOptions<Source>,
): Readonly<Record<Source, TradeClient>> {
  return createTradeGovernor(options).clients;
}

export interface TradeGovernorOptions<Source extends string> extends TradeClientsOptions<Source> {
  /** Shared pacing memory. Omitted, the governor starts cold with its own. */
  readonly pacing?: PacingState;
  /**
   * `true` paces with the even spread (`spreadBeforeNext`). Omitted or
   * `false`, the batch pacer (`paceBeforeNext`), which waits only on a
   * restriction or a full bucket.
   */
  readonly spread?: boolean;
  /**
   * The process auth holder and the port the session probe goes out on
   * (AD-30, IMPLEMENTATION-NOTES.md §13). Omitted, nothing probes, nothing
   * carries a cookie and errors pass on unchanged: the shells that cannot
   * reach a holder have no value to send or remove.
   */
  readonly auth?: TradeGovernorAuth;
}

/** The session-cookie half of a governor (AD-30). */
export interface TradeGovernorAuth {
  /**
   * The process auth holder. It owns the value and the state; the governor
   * asks it to settle and to add the cookie header (§13.2, §13.3). Every
   * error the governor passes on is redacted through it first (§13.6).
   */
  readonly holder: SessionAuth;
  /**
   * The port the one probe goes out on, counted as `session-probe` by the
   * composition (AD-12). It shares this governor's pacing and serial queue.
   */
  readonly probe: HttpPort;
}

export interface TradeGovernor<Source extends string> {
  readonly clients: Readonly<Record<Source, TradeClient>>;
  /** The pacing memory this governor reads and writes. */
  readonly pacing: PacingState;
  /** The delay the next request on `lane` would wait now. */
  delayBeforeMs(lane: string): number;
  /**
   * The retry delay of a probe `429` this governor latched, or `undefined`.
   * The chunk runner reads it before `publish`: a latched penalty makes the
   * chunk a `429` yield, whatever bound ended it (IMPLEMENTATION-NOTES.md
   * §13.3). A new governor starts with no latch.
   */
  latchedRetryAfterMs(): number | undefined;
}

/**
 * The one governor behind `createTradeClients`, with the pacing memory and the
 * pacer made explicit (AD-8). Every request of every client it builds passes
 * through one serial queue and one ledger.
 */
export function createTradeGovernor<Source extends string>(
  options: TradeGovernorOptions<Source>,
): TradeGovernor<Source> {
  const { clock, wait, userAgent, invalidRequestThreshold, log, auth } = options;
  if (userAgent.trim() === '') {
    throw new MissingUserAgentError();
  }
  const context: GovernorContext = {
    clock,
    wait,
    userAgent,
    invalidRequestThreshold,
    log,
    auth,
    isSpread: options.spread === true,
    pacing: options.pacing ?? createPacingState(),
    invalidRequests: NO_INVALID_REQUESTS,
    latched: undefined,
    isCookieDropped: false,
  };
  const sendSerially = createSerialSender(context);

  const clients = Object.fromEntries(
    (Object.entries(options.http) as [Source, HttpPort][]).map(([source, http]) => [
      source,
      { send: (request: TradeRequest) => sendSerially(http, request) },
    ]),
  ) as Record<Source, TradeClient>;

  return {
    clients,
    pacing: context.pacing,
    delayBeforeMs: (lane) => laneDelayMs(context.pacing, lane, clock.now(), context.isSpread),
    latchedRetryAfterMs: () => context.latched?.retryAfterMs,
  };
}
