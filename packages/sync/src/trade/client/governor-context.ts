import type { ClockPort, HttpResponse } from '@poe/contracts';

import type { TradeGovernorAuth } from '../client.ts';
import type { InvalidRequestCounts } from '../invalid-requests.ts';
import type { PolicyObservation } from '../ledger.ts';
import { recordObservation } from '../ledger.ts';
import { parseRateLimitHeaders } from '../rate-limit-headers.ts';
import type { RateLimitHeaders } from '../rate-limit-headers.ts';
import { laneDelayMs } from './pacing-state.ts';
import type { PacingState } from './pacing-state.ts';
import type { YieldPenalty } from './yield-penalty.ts';

// Bounds a map whose key space is the caller's; least recently used goes first.
const MAX_REMEMBERED_LANES = 64;

/** The governor's injected effects and its mutable state, shared by the functions of `client/`. */
export interface GovernorContext {
  readonly clock: ClockPort;
  readonly wait: (ms: number) => Promise<void>;
  readonly userAgent: string;
  readonly invalidRequestThreshold: number | undefined;
  readonly log: ((line: string) => void) | undefined;
  readonly auth: TradeGovernorAuth | undefined;
  readonly isSpread: boolean;
  readonly pacing: PacingState;
  /** Per governor: a count shared across chunks would refuse a policy for the whole session. */
  invalidRequests: InvalidRequestCounts;
  /** A probe `429`'s penalty (IN §13.3): once set, every later `send` yields it. */
  latched: YieldPenalty | undefined;
  /** Set before the holder hears of a downgrade, so the cookie is dropped first (§13.4 step 1). */
  isCookieDropped: boolean;
}

/** What a settled answer needs from the request that produced it. */
export interface IssuedExchange {
  readonly lane: string;
  readonly knownPolicy: string | undefined;
  readonly waitedMs: number;
  /** The reading the wait was paced on, kept for a `429`'s operator line. */
  readonly pacedOn: PolicyObservation | undefined;
  readonly isWithCookie: boolean;
  readonly response: HttpResponse;
}

export interface FoldedResponse {
  readonly parsed: RateLimitHeaders;
  readonly respondedAt: string;
  readonly policy: string | undefined;
}

function rememberPolicy(pacing: PacingState, lane: string, policy: string): void {
  const { lanePolicies } = pacing;
  // Delete-then-set moves the lane to the end of insertion order, so eviction drops the least
  // recently used.
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

// Computed once and waited once: recomputing after the wait would not terminate under a fixed test
// clock, and `send` queues, so only this call's own responses move the ledger.
export async function paceLane(context: GovernorContext, lane: string): Promise<number> {
  const delayMs = laneDelayMs(context.pacing, lane, context.clock.now(), context.isSpread);
  if (delayMs <= 0) {
    return 0;
  }
  await context.wait(delayMs);
  return delayMs;
}

export function readingFor(pacing: PacingState, policy: string | undefined): PolicyObservation | undefined {
  return policy === undefined ? undefined : pacing.ledger[policy];
}

/** Folds one response's headers into the ledger and the lane memo. */
export function fold(
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
