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
  type PolicyObservation,
  recordObservation,
  spreadBeforeNext,
  type RateLimitLedger,
} from './ledger.ts';
import {
  countInvalidRequest,
  type InvalidRequestCounts,
  invalidRequestsFor,
  isInvalidRequest,
  isSuccess,
  NO_INVALID_REQUESTS,
  isThresholdReached,
} from './invalid-requests.ts';
import {
  parseRateLimitHeaders,
  type RateLimitBucket,
  type RateLimitHeaders,
  type RateLimitSkip,
  rateLimitPolicyOf,
  ruleNameCount,
} from './rate-limit-headers.ts';
import type { SessionAuth } from './session-auth.ts';
import { MissingUserAgentError } from './user-agent.ts';

const USER_AGENT_HEADER = 'user-agent';
const REQUESTED_WITH_HEADER = 'x-requested-with';
const REQUESTED_WITH_VALUE = 'XMLHttpRequest';
const CONTENT_TYPE_HEADER = 'content-type';
const JSON_CONTENT_TYPE = 'application/json';
const RETRY_AFTER_HEADER = 'retry-after';

const TOO_MANY_REQUESTS = 429;
const UNAUTHORIZED = 401;
const FORBIDDEN = 403;
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
  return segments.length <= 1 ? `${request.method} ${pathname}` : `${request.method} /${segments.slice(0, -1).join('/')}`;
}

function laneOf(request: TradeRequest): string {
  return request.lane !== undefined && request.lane.trim() !== '' ? request.lane : defaultLaneOf(request);
}

/**
 * The standing headers of `IMPLEMENTATION-NOTES.md` §5.1, applied last so a
 * caller cannot drop the contact address or the `XMLHttpRequest` marker.
 */
function headersFor(request: TradeRequest, userAgent: string): Record<string, string> {
  const headers: Record<string, string> = {};
  const given = Object.entries(request.headers ?? {});
  for (const [name, value] of given) {
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

/**
 * The allowance a response declares is left, or `undefined` where it declared
 * no readable rule. Positional pairing is the header contract, and the parser
 * has already refused any rule whose two lists disagree in length.
 */
function remainingAllowance(parsed: RateLimitHeaders): number | undefined {
  let remaining: number | undefined;
  for (const rule of parsed.rules) {
    for (const [index, bucket] of rule.buckets.entries()) {
      const used = rule.state[index]?.hits ?? 0;
      const left = Math.max(0, bucket.hits - used);
      remaining = remaining === undefined ? left : Math.min(remaining, left);
    }
  }
  return remaining;
}

const RATE_LIMIT_HEADER_PREFIX = 'x-rate-limit-';

function tripletsOf(buckets: readonly RateLimitBucket[]): string {
  return buckets
    .map(({ hits, seconds, penalty }) => `${String(hits)}:${String(seconds)}:${String(penalty)}`)
    .join(',');
}

/**
 * The operator line for one `429`: the instant, the lane, the policy the
 * response named, the wait the client spent, the response's raw `Retry-After`
 * and `X-Rate-Limit-*` headers, and the reading the wait was paced on — keyed
 * by the policy the lane had remembered, which is the one `laneDelayMs` read
 * and which a 429 may not repeat. A 429 means that reading was wrong, and the
 * response headers alone cannot say why — the pair can, and each rule's
 * `observedAt` against the instant gives its age. Both halves are JSON,
 * because the header values carry commas.
 */
function describe429(
  exchange: {
    readonly at: string;
    readonly lane: string;
    readonly policy: string | undefined;
    readonly waitedMs: number;
  },
  headers: Readonly<Record<string, string>>,
  pacedOn: PolicyObservation | undefined,
): string {
  const rateHeaders = Object.entries(headers)
    .map(([name, value]): [string, string] => [name.toLowerCase(), value])
    .filter(([name]) => name === RETRY_AFTER_HEADER || name.startsWith(RATE_LIMIT_HEADER_PREFIX))
    .toSorted(([left], [right]) => compareCodeUnits(left, right));
  const reading =
    pacedOn === undefined
      ? 'no reading'
      : `policy ${pacedOn.policy} ${JSON.stringify(
          pacedOn.rules.map((rule) => ({
            rule: rule.name,
            observedAt: rule.observedAt,
            policy: tripletsOf(rule.buckets),
            state: tripletsOf(rule.state),
          })),
        )}`;
  return (
    `sync: the trade API answered 429 at ${exchange.at} on lane ${exchange.lane} ` +
    `(policy ${exchange.policy ?? 'unknown'}) after waiting ${String(exchange.waitedMs)} ms; ` +
    `response headers ${JSON.stringify(Object.fromEntries(rateHeaders))}; paced on ${reading}`
  );
}

/** Orders two strings by code unit, as the relational operators do. */
function compareCodeUnits(left: string, right: string): number {
  if (left < right) {
    return -1;
  }
  return left > right ? 1 : 0;
}

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

/**
 * The pacing memory a governor reads and writes: the bucket ledger and the lane
 * memo. **Mutable and shared on purpose.** A governor built without one starts
 * cold and keeps its own. The `pnpm sync` session builds one per process and
 * hands it to the fresh governor of every chunk, so a chunk starts from what
 * the previous one read rather than cold (AD-8). Invalid-request counts are
 * **not** part of it: they stay per governor, because a shared count would
 * refuse a policy for the rest of the session after one `4xx`.
 */
export interface PacingState {
  ledger: RateLimitLedger;
  /** lane -> the policy that lane's last response was accounted against. */
  readonly lanePolicies: Map<string, string>;
}

export function createPacingState(): PacingState {
  return { ledger: EMPTY_LEDGER, lanePolicies: new Map<string, string>() };
}

/**
 * Resets `pacing` to cold **in place** (AD-30, IMPLEMENTATION-NOTES.md §13.4):
 * the same object keeps living in the session, with an empty ledger and an
 * empty lane memo, so no authenticated reading paces an unauthenticated
 * request. The ledger becomes a new reference, so a caller that compares
 * ledgers by reference must not read the reset as a fresh State reading.
 */
export function resetPacingState(pacing: PacingState): void {
  pacing.ledger = EMPTY_LEDGER;
  pacing.lanePolicies.clear();
}

/**
 * The delay the governor would ask before the next request on `lane`, at
 * `now`. `isSpread` selects the session's even spread (`spreadBeforeNext`) over
 * the batch pacer (`paceBeforeNext`). A lane whose policy is unknown asks
 * nothing: the request goes out cold.
 */
export function laneDelayMs(pacing: PacingState, lane: string, now: string, isSpread: boolean): number {
  const policy = pacing.lanePolicies.get(lane);
  const decision = isSpread
    ? spreadBeforeNext(pacing.ledger, policy, now)
    : paceBeforeNext(pacing.ledger, policy, now);
  // Whole milliseconds, rounded up: the clock reads whole milliseconds, so a
  // fractional spread would leave a sub-millisecond residue to wait again.
  return Math.max(0, Math.ceil(decision.delayMs));
}

/**
 * A downgrade (§13.4): the answer to a request that carried the cookie is a
 * `401` or a `403` (a Cloudflare `403` too; no rule reads the body or a
 * header), or a 2xx under the baseline's policy whose rule-name count is not
 * above the baseline's. Counts only, as the probe's test (§13.2). A 2xx under
 * another policy (a fetch) is not: the search baseline's count says nothing
 * about it. A `429`, a `5xx` and any other `4xx` are not.
 */
function isDowngrade(holder: SessionAuth, response: HttpResponse): boolean {
  if (response.status === UNAUTHORIZED || response.status === FORBIDDEN) {
    return true;
  }
  const baseline = holder.baselineRuleCount;
  return (
    isSuccess(response.status) &&
    baseline !== undefined &&
    rateLimitPolicyOf(response.headers) === holder.baselinePolicy &&
    ruleNameCount(response.headers) <= baseline
  );
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

/** The governor's injected effects and its mutable state, shared by the functions below. */
interface GovernorContext {
  readonly clock: ClockPort;
  readonly wait: (ms: number) => Promise<void>;
  readonly userAgent: string;
  readonly invalidRequestThreshold: number | undefined;
  readonly log: ((line: string) => void) | undefined;
  readonly auth: TradeGovernorAuth | undefined;
  readonly isSpread: boolean;
  readonly pacing: PacingState;
  /** Per governor: a count shared across chunks would refuse a policy for the rest of the session. */
  invalidRequests: InvalidRequestCounts;
  /**
   * A probe `429`'s penalty (IMPLEMENTATION-NOTES.md §13.3). Once set, every later `send` of this
   * governor yields it and sends nothing.
   */
  latched: YieldPenalty | undefined;
  /** Set before the holder hears of a downgrade, so the cookie is dropped first (§13.4 step 1). */
  isCookieDropped: boolean;
}

interface YieldPenalty {
  readonly retryAfterMs: number;
  readonly reason: TradeYieldReason;
}

/** What a settled answer needs from the request that produced it. */
interface IssuedExchange {
  readonly lane: string;
  readonly knownPolicy: string | undefined;
  readonly waitedMs: number;
  /** The reading the wait was paced on, kept for a `429`'s operator line before the response replaces it. */
  readonly pacedOn: PolicyObservation | undefined;
  readonly isWithCookie: boolean;
  readonly response: HttpResponse;
}

interface FoldedResponse {
  readonly parsed: RateLimitHeaders;
  readonly respondedAt: string;
  readonly policy: string | undefined;
}

function rememberPolicy(pacing: PacingState, lane: string, policy: string): void {
  const { lanePolicies } = pacing;
  // Delete-then-set moves the lane to the end of insertion order, so eviction drops the least recently used.
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

/** The standing headers, plus the cookie on a marked request once the holder settled `authenticated` (AD-30). */
function outboundHeaders(context: GovernorContext, request: TradeRequest, hasCookie: boolean): Record<string, string> {
  const headers = headersFor(request, context.userAgent);
  return hasCookie && context.auth !== undefined ? context.auth.holder.withCookie(headers) : headers;
}

function shouldCarryCookie(context: GovernorContext, request: TradeRequest): boolean {
  return !context.isCookieDropped && request.cookieEligible === true && context.auth?.holder.isAuthenticated === true;
}

/**
 * Computed once and waited once: recomputing after the wait would not terminate under a
 * fixed test clock, and `send` queues, so only this call's own responses move the ledger.
 */
async function paceLane(context: GovernorContext, lane: string): Promise<number> {
  const delayMs = laneDelayMs(context.pacing, lane, context.clock.now(), context.isSpread);
  if (delayMs <= 0) {
    return 0;
  }
  await context.wait(delayMs);
  return delayMs;
}

function readingFor(pacing: PacingState, policy: string | undefined): PolicyObservation | undefined {
  return policy === undefined ? undefined : pacing.ledger[policy];
}

/** Folds one response's headers into the ledger and the lane memo. */
function fold(
  context: GovernorContext,
  lane: string,
  knownPolicy: string | undefined,
  response: HttpResponse,
): FoldedResponse {
  const parsed = parseRateLimitHeaders(response.headers);
  const respondedAt = context.clock.now();
  context.pacing.ledger = recordObservation(context.pacing.ledger, parsed, respondedAt);
  if (parsed.policy !== undefined) {
    rememberPolicy(context.pacing, lane, parsed.policy);
  }
  return { parsed, respondedAt, policy: parsed.policy ?? knownPolicy };
}

/** The delay and the reason a `429` yields with (§5.3). */
function penaltyOf(
  context: GovernorContext,
  response: HttpResponse,
  parsed: RateLimitHeaders,
  policy: string | undefined,
): YieldPenalty {
  const fromHeader = retryAfterMsOf(response.headers);
  const derived = derivedYieldDelayMs(context.pacing.ledger, policy);
  return {
    retryAfterMs: fromHeader ?? (derived > 0 ? derived : declaredYieldFloorMs(parsed)),
    reason: fromHeader === undefined ? 'derived-penalty' : 'retry-after-header',
  };
}

/** The holder's verdict on the probe's answer, once it is neither a throw nor a `429`. */
function settleProbeStatus(holder: SessionAuth, baseline: HttpResponse, response: HttpResponse): void {
  const { status } = response;
  if (isSuccess(status)) {
    // Kept by the holder: every later cookie answer under the baseline's policy is tested against it (§13.4).
    const baselineCount = ruleNameCount(baseline.headers);
    holder.rememberBaseline(baselineCount, rateLimitPolicyOf(baseline.headers));
    holder.settle(ruleNameCount(response.headers) > baselineCount ? 'authenticated' : 'not-elevated');
  } else if (isInvalidRequest(status)) {
    // Every 401 and 403 included, a Cloudflare 403 too (AD-30).
    holder.settle('probe-rejected');
  } else {
    // A 5xx, or any other answer that is neither 2xx nor 4xx.
    holder.settle('probe-failed');
  }
}

/** The baseline a probe repeats: its request, its lane and the answer it got. */
interface ProbeBaseline {
  readonly request: TradeRequest;
  readonly lane: string;
  readonly response: HttpResponse;
}

/**
 * The one session probe (IMPLEMENTATION-NOTES.md §13.2, §13.3): the baseline's request sent
 * once with the cookie on the probe port, after the same pacing wait and inside the same queue
 * slot. It never counts toward the invalid-request count, and its answer and error are never returned.
 */
async function probe(context: GovernorContext, auth: TradeGovernorAuth, baseline: ProbeBaseline): Promise<void> {
  const { request, lane } = baseline;
  const knownPolicy = context.pacing.lanePolicies.get(lane);
  const waitedMs = await paceLane(context, lane);
  const pacedOn = readingFor(context.pacing, knownPolicy);

  let response: HttpResponse;
  try {
    response = await auth.probe.send({
      method: request.method,
      url: request.url,
      headers: auth.holder.withCookie(headersFor(request, context.userAgent)),
      body: request.body,
    });
  } catch {
    // The error may quote the request, so it goes nowhere. Pricing continues unauthenticated (§13.3).
    auth.holder.settle('probe-failed');
    return;
  }

  const { parsed, respondedAt, policy } = fold(context, lane, knownPolicy, response);
  if (response.status === TOO_MANY_REQUESTS) {
    // Settles nothing. The next `send` yields with this penalty (§13.3).
    context.log?.(describe429({ at: respondedAt, lane, policy, waitedMs }, response.headers, pacedOn));
    context.latched = penaltyOf(context, response, parsed, policy);
    return;
  }
  settleProbeStatus(auth.holder, baseline.response, response);
}

/**
 * A latched probe `429` or a reached invalid-request threshold: nothing is sent. The threshold
 * is checked before the wait, because waiting does not clear it and passing it revokes access.
 */
function refusalOf(context: GovernorContext, policy: string | undefined): YieldPenalty | undefined {
  if (context.latched !== undefined) {
    return context.latched;
  }
  return isThresholdReached(context.invalidRequests, policy, context.invalidRequestThreshold)
    ? { retryAfterMs: 0, reason: 'invalid-request-threshold' }
    : undefined;
}

function refusalYield(context: GovernorContext, lane: string, knownPolicy: string | undefined): TradeYieldResult | undefined {
  const refusal = refusalOf(context, knownPolicy);
  if (refusal === undefined) {
    return undefined;
  }
  return {
    kind: 'yield',
    lane,
    policy: knownPolicy,
    waitedMs: 0,
    skips: [],
    invalidRequests: invalidRequestsFor(context.invalidRequests, knownPolicy),
    retryAfterMs: refusal.retryAfterMs,
    reason: refusal.reason,
  };
}

/**
 * The downgrade (§13.4): 1. drop the cookie, 2. reset the pacing to cold in place, 3. the
 * holder settles `expired`, 4. yield. The downgrading answer is neither counted nor returned.
 */
function expireSession(
  context: GovernorContext,
  auth: TradeGovernorAuth,
  issued: IssuedExchange,
  { parsed, policy }: FoldedResponse,
): TradeYieldResult {
  context.isCookieDropped = true;
  resetPacingState(context.pacing);
  auth.holder.expire();
  return {
    kind: 'yield',
    lane: issued.lane,
    policy,
    waitedMs: issued.waitedMs,
    skips: parsed.skips,
    invalidRequests: invalidRequestsFor(context.invalidRequests, policy),
    retryAfterMs: 0,
    reason: 'session-expired',
  };
}

/** Folds the answer into the ledger, then turns it into a downgrade yield, a `429` yield or a response. */
function settleAnswer(context: GovernorContext, issued: IssuedExchange): TradeResult {
  const { lane, knownPolicy, waitedMs, pacedOn, isWithCookie, response } = issued;
  const folded = fold(context, lane, knownPolicy, response);
  const { parsed, respondedAt, policy } = folded;
  if (isWithCookie && context.auth !== undefined && isDowngrade(context.auth.holder, response)) {
    return expireSession(context, context.auth, issued, folded);
  }
  if (isInvalidRequest(response.status)) {
    context.invalidRequests = countInvalidRequest(context.invalidRequests, policy);
  }
  const remaining = remainingAllowance(parsed);
  const common = {
    lane,
    policy,
    waitedMs,
    skips: parsed.skips,
    invalidRequests: invalidRequestsFor(context.invalidRequests, policy),
    ...(remaining !== undefined && { remaining }),
  };
  if (response.status !== TOO_MANY_REQUESTS) {
    return { kind: 'response', ...common, response };
  }
  context.log?.(describe429({ at: respondedAt, lane, policy, waitedMs }, response.headers, pacedOn));
  return { kind: 'yield', ...common, response, ...penaltyOf(context, response, parsed, policy) };
}

/** The first `2xx` marked request, sent without the cookie, is the baseline: probe once (§13.2). */
function shouldProbe(auth: TradeGovernorAuth | undefined, request: TradeRequest, response: HttpResponse): auth is TradeGovernorAuth {
  return auth !== undefined && request.cookieEligible === true && auth.holder.canProbe && isSuccess(response.status);
}

async function runExchange(context: GovernorContext, http: HttpPort, request: TradeRequest): Promise<TradeResult> {
  const lane = laneOf(request);
  const knownPolicy = context.pacing.lanePolicies.get(lane);
  const refusal = refusalYield(context, lane, knownPolicy);
  if (refusal !== undefined) {
    return refusal;
  }

  const waitedMs = await paceLane(context, lane);
  const pacedOn = readingFor(context.pacing, knownPolicy);
  const isWithCookie = shouldCarryCookie(context, request);
  const response = await http.send({
    method: request.method,
    url: request.url,
    headers: outboundHeaders(context, request, isWithCookie),
    body: request.body,
  });

  const result = settleAnswer(context, { lane, knownPolicy, waitedMs, pacedOn, isWithCookie, response });
  if (result.kind === 'response' && shouldProbe(context.auth, request, response)) {
    await probe(context, context.auth, { request, lane, response });
  }
  return result;
}

/** Requests go **one at a time**, chained onto the previous call, so the ledger is at most one request out of date. */
function createSerialSender(context: GovernorContext): (http: HttpPort, request: TradeRequest) => Promise<TradeResult> {
  let tail: Promise<unknown> = Promise.resolve();

  // Redacted in place, then rethrown: the class, the `name` and the identity
  // survive, so `isTransportFailure` still classifies the throw (§13.6).
  const redactedExchange = async (
    holderAuth: TradeGovernorAuth,
    http: HttpPort,
    request: TradeRequest,
  ): Promise<TradeResult> => {
    try {
      return await runExchange(context, http, request);
    } catch (error) {
      throw holderAuth.holder.redact(error);
    }
  };

  const redacted = (http: HttpPort, request: TradeRequest): Promise<TradeResult> =>
    context.auth === undefined ? runExchange(context, http, request) : redactedExchange(context.auth, http, request);

  // The queue must survive a rejected exchange, or one failure would wedge every later request behind it.
  const settle = async (promise: Promise<unknown>): Promise<void> => {
    try {
      await promise;
    } catch {
      // Swallowed on purpose: the caller of `send` gets the rejection.
    }
  };

  const issueAfter = async (previous: Promise<unknown>, http: HttpPort, request: TradeRequest): Promise<TradeResult> => {
    await previous;
    return redacted(http, request);
  };

  return (http, request) => {
    const issued = issueAfter(tail, http, request);
    tail = settle(issued);
    return issued;
  };
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
