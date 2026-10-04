/**
 * The Invalid Requests Threshold (AD-8, renegotiated 2026-09-20).
 *
 * GGG's documentation counts **every `4xx`** — `401`, `403` and `429` named
 * explicitly — toward a threshold that **revokes access**, and asks for
 * reasonable attempts to avoid passing it. It is the one limit whose breach is
 * not recoverable by waiting, which is why a `4xx` cannot simply be handed back
 * as an ordinary response and forgotten: a caller looping on a `403` would
 * spend the threshold at full speed and lose the endpoint for good.
 *
 * Counted **per policy**, on the same key the bucket ledger uses, so a run of
 * invalid searches does not close the fetch bucket.
 *
 * **The client compiles in no threshold.** The threshold arrives as a factory
 * value, exactly as no rate, window or penalty is compiled in. Every shell that
 * builds a client passes `INVALID_REQUEST_THRESHOLD`.
 */

/**
 * The `sync`-side threshold every shell passes to the client factory
 * (IMPLEMENTATION-NOTES.md §5.3). A constant, not a `data/config.json` field:
 * nothing but `sync` reads it, and AD-19 keeps that file to three keys. On the
 * chunk path the first `4xx` ends the chunk, so `1` refuses any second request
 * on a policy that has already answered one.
 */
export const INVALID_REQUEST_THRESHOLD = 1;

/** Counts keyed by policy, exactly as the ledger is keyed. */
export type InvalidRequestCounts = Readonly<Record<string, number>>;

export const NO_INVALID_REQUESTS: InvalidRequestCounts = {};

/**
 * Where a response named no policy the count still has to go somewhere, or a
 * `403` carrying no rate-limit headers would be free — and a `403` is exactly
 * the response least likely to carry them.
 */
export const UNGOVERNED_POLICY_KEY = '(no policy named)';

const CLIENT_ERROR_MIN = 400;
const CLIENT_ERROR_MAX = 499;

/** Every `4xx`, not merely the ones the documentation lists by number. */
export function isInvalidRequest(status: number): boolean {
  return status >= CLIENT_ERROR_MIN && status <= CLIENT_ERROR_MAX;
}

const SUCCESS_MIN = 200;
const SUCCESS_MAX = 299;

/** Every `2xx`: an answered request, the only kind a session probe follows or reads as live (§13.2). */
export function isSuccess(status: number): boolean {
  return status >= SUCCESS_MIN && status <= SUCCESS_MAX;
}

function policyKeyOf(policy: string | undefined): string {
  return policy ?? UNGOVERNED_POLICY_KEY;
}

export function invalidRequestsFor(
  counts: InvalidRequestCounts,
  policy: string | undefined,
): number {
  return counts[policyKeyOf(policy)] ?? 0;
}

export function countInvalidRequest(
  counts: InvalidRequestCounts,
  policy: string | undefined,
): InvalidRequestCounts {
  const key = policyKeyOf(policy);
  return { ...counts, [key]: (counts[key] ?? 0) + 1 };
}

/**
 * `true` once the policy has spent its whole allowance. A threshold of
 * `undefined` is *no declared threshold*, and never refuses — the count is
 * still surfaced on every result, so a caller can see what it is spending.
 */
export function isThresholdReached(
  counts: InvalidRequestCounts,
  policy: string | undefined,
  threshold: number | undefined,
): boolean {
  return threshold !== undefined && invalidRequestsFor(counts, policy) >= threshold;
}
