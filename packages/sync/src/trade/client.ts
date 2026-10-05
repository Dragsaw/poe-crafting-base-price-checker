// Exactly one module in `sync` issues a trade request: a second call site would pace independently
// against one shared budget (FR-20, AD-8). It transports only: no body building, parsing or retry.

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
  /** Injected so a backoff test asserts recorded durations without waiting (NFR-3). */
  readonly wait: (ms: number) => Promise<void>;
  /** The whole `User-Agent` header, read from the overlay at the shell edge. */
  readonly userAgent: string;
  /** `4xx` count per policy that stops issuing (Invalid Requests Threshold); omitted: none. */
  readonly invalidRequestThreshold?: number;
  /** One line per `429`, never on a threshold refusal; the shell decides where it goes. */
  readonly log?: (line: string) => void;
}

export interface TradeRequest {
  readonly method: HttpRequest['method'];
  readonly url: string;
  readonly body?: string;
  /** Extra request headers. The standing headers below always win. */
  readonly headers?: Readonly<Record<string, string>>;
  // Opaque to the client: a request is paced before its response names a policy, so the lane
  // remembers its last policy (AD-8). Omitted, it defaults to the method and URL path.
  readonly lane?: string;
  /** True only on a pricing search or fetch; never inferred from method or lane (AD-30, §13.2). */
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
  /** `4xx` responses on this policy so far, so a caller sees the threshold coming. */
  readonly invalidRequests: number;
  // Smallest `hits - state.hits` over every declared bucket, never below 0; absent where no rule
  // was readable. Read from the headers, never assumed.
  readonly remaining?: number;
}

export interface TradeResponseResult extends TradeExchange {
  readonly kind: 'response';
  readonly response: HttpResponse;
}

/** `session-expired` is AD-30's downgrade (§13.4): no response, no penalty, so AD-9's no answer. */
export type TradeYieldReason =
  | 'retry-after-header'
  | 'derived-penalty'
  | 'invalid-request-threshold'
  | 'session-expired';

// A `429` or a threshold refusal is never retried or slept out: stopping is a decision for the
// whole chunk, and sleeping here would hold its lock through the penalty window.
export interface TradeYieldResult extends TradeExchange {
  readonly kind: 'yield';
  /** `0` where no wait recovers: a threshold or `session-expired` yield. */
  readonly retryAfterMs: number;
  readonly reason: TradeYieldReason;
  /** Absent where nothing came back: a threshold refusal or a discarded `session-expired` answer. */
  readonly response?: HttpResponse;
}

/** The `retryAfter` of §5.3, the input to `notBefore`; `undefined` where no wait recovers. */
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

/** Refuses a blank `User-Agent` at construction, so no request goes without one (NFR-9). */
export function createTradeClient(options: TradeClientOptions): TradeClient {
  const { http, ...shared } = options;
  return createTradeClients({ ...shared, http: { only: http } }).only;
}

export interface TradeClientsOptions<Source extends string>
  extends Omit<TradeClientOptions, 'http'> {
  /** One `HttpPort` per client, typically one per request source (`../request-counter.ts`). */
  readonly http: Readonly<Record<Source, HttpPort>>;
}

// Sources are counted by port (AD-12) but the budget is the trade API's, so the siblings share
// one governor: independent clients would each start cold and spend unpaced (AD-8).
export function createTradeClients<Source extends string>(
  options: TradeClientsOptions<Source>,
): Readonly<Record<Source, TradeClient>> {
  return createTradeGovernor(options).clients;
}

export interface TradeGovernorOptions<Source extends string> extends TradeClientsOptions<Source> {
  /** Shared pacing memory. Omitted, the governor starts cold with its own. */
  readonly pacing?: PacingState;
  /** `true`: even spread (`spreadBeforeNext`); otherwise the batch pacer (`paceBeforeNext`). */
  readonly spread?: boolean;
  /** The auth holder and the session-probe port (AD-30, §13). Omitted: no probe, no cookie. */
  readonly auth?: TradeGovernorAuth;
}

/** The session-cookie half of a governor (AD-30). */
export interface TradeGovernorAuth {
  /** Owns the value and state (§13.2); every error the governor passes on goes through it (§13.6). */
  readonly holder: SessionAuth;
  /** Counted as `session-probe` (AD-12); shares this governor's pacing and serial queue. */
  readonly probe: HttpPort;
}

export interface TradeGovernor<Source extends string> {
  readonly clients: Readonly<Record<Source, TradeClient>>;
  /** The pacing memory this governor reads and writes. */
  readonly pacing: PacingState;
  /** The delay the next request on `lane` would wait now. */
  delayBeforeMs(lane: string): number;
  /** A latched probe `429` makes the chunk a `429` yield, whatever bound ended it (§13.3). */
  latchedRetryAfterMs(): number | undefined;
}

/** The governor behind `createTradeClients`: one serial queue and one ledger for all (AD-8). */
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
