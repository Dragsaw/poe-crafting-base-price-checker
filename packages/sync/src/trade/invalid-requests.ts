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
 * **No threshold number lives here.** The threshold arrives as a factory value,
 * exactly as no rate, window or penalty is compiled in.
 */

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

export function policyKeyOf(policy: string | undefined): string {
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
export function thresholdReached(
  counts: InvalidRequestCounts,
  policy: string | undefined,
  threshold: number | undefined,
): boolean {
  if (threshold === undefined) {
    return false;
  }
  return invalidRequestsFor(counts, policy) >= threshold;
}
