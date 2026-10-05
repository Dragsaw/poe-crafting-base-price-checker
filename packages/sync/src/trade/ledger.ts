// Per-policy bucket ledger (AD-8, IMPLEMENTATION-NOTES.md §5.3).
// Pure: no clock, so a backoff test asserts a duration without spending it (NFR-3).
// Keyed on the `X-Rate-Limit-Policy` the response carried, never on an operation.

import type { RateLimitBucket, RateLimitHeaders, RateLimitRule } from './rate-limit-headers.ts';

const MS_PER_SECOND = 1000;

/** Carries its own instant: a rule kept from an older response must age from when it was seen. */
interface ObservedRule extends RateLimitRule {
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

/** `spread` only comes from `spreadBeforeNext`: a satisfied bucket still asking for an even gap. */
type PaceCause = 'penalty' | 'window' | 'spread';

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

// Merges per rule name: dropping a rule the new response could not read would widen the allowance.
// A response with no policy or no readable rule leaves the ledger untouched.
export function recordObservation(
  ledger: RateLimitLedger,
  parsed: RateLimitHeaders,
  observedAt: string,
): RateLimitLedger {
  if (parsed.policy === undefined || parsed.rules.length === 0) {
    return ledger;
  }

  const merged = new Map<string, ObservedRule>();
  const existing = ledger[parsed.policy]?.rules ?? [];
  for (const rule of existing) {
    merged.set(rule.name.toLowerCase(), rule);
  }
  for (const rule of parsed.rules) {
    merged.set(rule.name.toLowerCase(), { ...rule, observedAt });
  }

  return {
    ...ledger,
    [parsed.policy]: { policy: parsed.policy, observedAt, rules: merged.values().toArray() },
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

function paceRule(rule: ObservedRule, policy: string, now: string, from: PaceDecision): PaceDecision {
  let decision = from;
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

    if (used.hits < limit.hits) {
      continue;
    }

    const windowMs = limit.seconds * MS_PER_SECOND - elapsedMs;
    if (windowMs > decision.delayMs) {
      decision = { delayMs: windowMs, policy, rule: rule.name, bucket: limit, cause: 'window' };
    }
  }
  return decision;
}

// The maximum delay over every unsatisfied bucket: serving a penalty, or consumption at its limit.
// Consumption below the limit is satisfied, since the state header is read after the response.
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
    decision = paceRule(rule, policy, now, decision);
  }
  return decision;
}

// The larger of `paceBeforeNext` and the even spread of each bucket's remaining capacity over its
// period, so no bucket fills in normal use (AD-8, IMPLEMENTATION-NOTES.md §5.3).
export function spreadBeforeNext(
  ledger: RateLimitLedger,
  policy: string | undefined,
  now: string,
): PaceDecision {
  let decision = paceBeforeNext(ledger, policy, now);
  if (policy === undefined) {
    return decision;
  }
  const observation = ledger[policy];
  if (observation === undefined) {
    return decision;
  }
  for (const rule of observation.rules) {
    const elapsedMs = elapsedMsSince(rule.observedAt, now);
    for (const [index, limit] of rule.buckets.entries()) {
      const used = rule.state[index];
      if (used === undefined || used.hits >= limit.hits) {
        // A full bucket is `paceBeforeNext`'s window, already in `decision`.
        continue;
      }
      const spreadMs = (limit.seconds * MS_PER_SECOND) / (limit.hits - used.hits) - elapsedMs;
      if (spreadMs > decision.delayMs) {
        decision = { delayMs: spreadMs, policy, rule: rule.name, bucket: limit, cause: 'spread' };
      }
    }
  }
  return decision;
}

/** The largest `seconds × 1000 / hits` of any bucket: the first backoff after no answer (AD-7). */
export function evenIntervalMs(ledger: RateLimitLedger, policy: string | undefined): number | undefined {
  if (policy === undefined) {
    return undefined;
  }
  const observation = ledger[policy];
  if (observation === undefined) {
    return undefined;
  }
  let interval: number | undefined;
  for (const rule of observation.rules) {
    for (const limit of rule.buckets) {
      if (limit.hits <= 0) {
        continue;
      }
      const gap = (limit.seconds * MS_PER_SECOND) / limit.hits;
      interval = interval === undefined ? gap : Math.max(interval, gap);
    }
  }
  return interval;
}

// The delay a `429` implies without `Retry-After`. Where no bucket can be blamed it falls back to
// the largest declared penalty: a `429` has already proved the ledger wrong.
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
