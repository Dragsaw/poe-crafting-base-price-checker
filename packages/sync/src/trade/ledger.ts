/**
 * The per-policy bucket ledger and the tightest-unsatisfied delay computation
 * (AD-8, `IMPLEMENTATION-NOTES.md` §5.3).
 *
 * **Pure.** No clock, no `wait`, no `Date.now()`. Every function here takes the
 * parsed headers and an instant and returns a number, which is what lets a
 * backoff test assert a duration without spending it (NFR-3).
 *
 * The ledger is keyed on the **`X-Rate-Limit-Policy` value the response carried**
 * and never on an operation. The client cannot be told "this is a search"
 * without a caller that knows what a search is, and the header names the bucket
 * in the response itself — so the split between the search bucket and the fetch
 * bucket arrives for free, and survives GGG adding a third policy.
 *
 * The ledger is in memory and per client instance. Nothing here persists across
 * processes.
 */

import type { RateLimitBucket, RateLimitHeaders, RateLimitRule } from './rate-limit-headers.ts';

const MS_PER_SECOND = 1000;

/**
 * One rule as last read, carrying **its own** instant. A rule the newest
 * response could not read is kept from the response that could, and its
 * consumption has to age from when *it* was seen, not from when the newer
 * response arrived.
 */
export interface ObservedRule extends RateLimitRule {
  readonly observedAt: string;
}

/** What has been read about one policy, rule by rule. */
export interface PolicyObservation {
  readonly policy: string;
  /** The instant of the most recent response folded in, ISO-8601 UTC. */
  readonly observedAt: string;
  readonly rules: readonly ObservedRule[];
}

/** Keyed by the policy value. Two policies never share a ledger entry. */
export type RateLimitLedger = Readonly<Record<string, PolicyObservation>>;

export const EMPTY_LEDGER: RateLimitLedger = {};

/** Why a bucket is unsatisfied — a serving penalty, or a saturated window. */
export type PaceCause = 'penalty' | 'window';

export interface PaceDecision {
  /** Milliseconds to wait before issuing. `0` when every bucket is clear. */
  readonly delayMs: number;
  readonly policy: string | undefined;
  /** The rule whose bucket governed the wait, for a report and a test. */
  readonly rule: string | undefined;
  readonly bucket: RateLimitBucket | undefined;
  readonly cause: PaceCause | undefined;
}

const CLEAR: PaceDecision = {
  delayMs: 0,
  policy: undefined,
  rule: undefined,
  bucket: undefined,
  cause: undefined,
};

/**
 * Folds one response's headers into the ledger, returning a new ledger.
 *
 * The merge is **per rule name**, not per policy. A later response whose rule
 * was malformed or absent must not drop what an earlier response said about
 * that rule: replacing the whole entry would discard a saturated bucket and
 * silently widen the allowance, which is the one direction a pacer must never
 * fail in. A rule the new response *could* read replaces its older self.
 *
 * A response carrying no policy, or no readable rule at all, leaves the ledger
 * untouched for the same reason.
 */
export function recordObservation(
  ledger: RateLimitLedger,
  parsed: RateLimitHeaders,
  observedAt: string,
): RateLimitLedger {
  if (parsed.policy === undefined || parsed.rules.length === 0) {
    return ledger;
  }

  const merged = new Map<string, ObservedRule>();
  for (const rule of ledger[parsed.policy]?.rules ?? []) {
    merged.set(rule.name.toLowerCase(), rule);
  }
  for (const rule of parsed.rules) {
    merged.set(rule.name.toLowerCase(), { ...rule, observedAt });
  }

  return {
    ...ledger,
    [parsed.policy]: { policy: parsed.policy, observedAt, rules: [...merged.values()] },
  };
}

function elapsedMsSince(observedAt: string, now: string): number {
  const from = Date.parse(observedAt);
  const to = Date.parse(now);
  if (Number.isNaN(from) || Number.isNaN(to)) {
    // An unparseable instant must not become a `NaN` delay that compares false
    // against every threshold and silently disables pacing.
    return 0;
  }
  return Math.max(0, to - from);
}

/**
 * The delay before the next request against `policy`, taken as the **maximum**
 * over every unsatisfied bucket of every rule in that policy — the tightest
 * bucket governs, and the tightest is the one that makes you wait longest.
 *
 * A bucket is unsatisfied when it is serving a penalty, or when its consumption
 * has reached its limit. Consumption *below* the limit is satisfied: the state
 * header describes the situation after the response that carried it, so one
 * more request is exactly what the remaining allowance is for. The client
 * issues serially and folds every response back in, so the consumption is never
 * more than one request out of date.
 */
export function paceBeforeNext(
  ledger: RateLimitLedger,
  policy: string | undefined,
  now: string,
): PaceDecision {
  if (policy === undefined) {
    return CLEAR;
  }
  const observation = ledger[policy];
  if (observation === undefined) {
    // Cold start: nothing has been observed for this policy, so issue now and
    // seed the ledger from the response.
    return { ...CLEAR, policy };
  }

  let decision: PaceDecision = { ...CLEAR, policy };

  for (const rule of observation.rules) {
    // Each rule ages from its own reading, so a rule carried over from an
    // earlier response is not credited with time it did not serve.
    const elapsedMs = elapsedMsSince(rule.observedAt, now);
    for (const [index, limit] of rule.buckets.entries()) {
      const used = rule.state[index];
      if (used === undefined) {
        continue;
      }

      const penaltyMs = used.penalty * MS_PER_SECOND - elapsedMs;
      if (penaltyMs > decision.delayMs) {
        decision = { delayMs: penaltyMs, policy, rule: rule.name, bucket: limit, cause: 'penalty' };
      }

      if (used.hits >= limit.hits) {
        const windowMs = limit.seconds * MS_PER_SECOND - elapsedMs;
        if (windowMs > decision.delayMs) {
          decision = { delayMs: windowMs, policy, rule: rule.name, bucket: limit, cause: 'window' };
        }
      }
    }
  }

  return decision;
}

/**
 * The delay a `429` implies when the response carried no `Retry-After`.
 *
 * It derives from the penalty the buckets themselves declare: the state's own
 * remaining penalty where the server reported one, the declared penalty of any
 * bucket whose consumption has reached its limit, and — where neither applies,
 * so the ledger cannot say which bucket was overspent — the largest penalty the
 * policy declares at all. Yielding for the longest declared penalty is the
 * conservative reading, and a `429` has already proved the ledger was wrong.
 */
export function derivedYieldDelayMs(
  ledger: RateLimitLedger,
  policy: string | undefined,
): number {
  if (policy === undefined) {
    return 0;
  }
  const observation = ledger[policy];
  if (observation === undefined) {
    return 0;
  }

  let attributed = 0;
  let declared = 0;
  for (const rule of observation.rules) {
    for (const [index, limit] of rule.buckets.entries()) {
      const used = rule.state[index];
      declared = Math.max(declared, limit.penalty * MS_PER_SECOND);
      if (used === undefined) {
        continue;
      }
      attributed = Math.max(attributed, used.penalty * MS_PER_SECOND);
      if (used.hits >= limit.hits) {
        attributed = Math.max(attributed, limit.penalty * MS_PER_SECOND);
      }
    }
  }

  return attributed > 0 ? attributed : declared;
}
