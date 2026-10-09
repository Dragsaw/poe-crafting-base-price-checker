import { EMPTY_LEDGER, paceBeforeNext, spreadBeforeNext } from '../ledger.ts';
import type { RateLimitLedger } from '../ledger.ts';

// Mutable and shared on purpose: the `pnpm sync` session hands one to every chunk's governor
// (AD-8). Invalid-request counts stay per governor.
export interface PacingState {
  ledger: RateLimitLedger;
  /** lane -> the policy that lane's last response was accounted against. */
  readonly lanePolicies: Map<string, string>;
}

export function createPacingState(): PacingState {
  return { ledger: EMPTY_LEDGER, lanePolicies: new Map<string, string>() };
}

// In place (AD-30), so no authenticated reading paces an unauthenticated request. The ledger
// becomes a new reference, so a caller comparing by reference sees no fresh State reading.
export function resetPacingState(pacing: PacingState): void {
  pacing.ledger = EMPTY_LEDGER;
  pacing.lanePolicies.clear();
}

/** The delay before the next request on `lane`; a lane with no known policy asks nothing. */
export function laneDelayMs(pacing: PacingState, lane: string, now: string, isSpread: boolean): number {
  const policy = pacing.lanePolicies.get(lane);
  const decision = isSpread
    ? spreadBeforeNext(pacing.ledger, policy, now)
    : paceBeforeNext(pacing.ledger, policy, now);
  // Whole milliseconds, rounded up: the clock reads whole milliseconds, so a fractional spread
  // would leave a residue.
  return Math.max(0, Math.ceil(decision.delayMs));
}
