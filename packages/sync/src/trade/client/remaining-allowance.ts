import type { RateLimitHeaders } from '../rate-limit-headers.ts';

/** The allowance a response declares is left, or `undefined` where it declared no readable rule. */
export function remainingAllowance(parsed: RateLimitHeaders): number | undefined {
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
