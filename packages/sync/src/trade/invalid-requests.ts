// The Invalid Requests Threshold (AD-8): every `4xx` counts, per policy, toward a revocation
// that waiting cannot undo. The client compiles in no threshold; shells pass it to the factory.

// Not a `data/config.json` field: only `sync` reads it and AD-19 keeps that file to three keys.
// IMPLEMENTATION-NOTES.md §5.3.
export const INVALID_REQUEST_THRESHOLD = 1;

/** Counts keyed by policy, exactly as the ledger is keyed. */
export type InvalidRequestCounts = Readonly<Record<string, number>>;

export const NO_INVALID_REQUESTS: InvalidRequestCounts = {};

// A `403` is the response least likely to carry rate-limit headers, and it must not count for free.
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

/** An `undefined` threshold is "none declared": it never refuses, the count is still surfaced. */
export function isThresholdReached(
  counts: InvalidRequestCounts,
  policy: string | undefined,
  threshold: number | undefined,
): boolean {
  return threshold !== undefined && invalidRequestsFor(counts, policy) >= threshold;
}
