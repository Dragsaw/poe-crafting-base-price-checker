import type { HttpResponse } from '@poe/contracts';

import { derivedYieldDelayMs } from '../ledger.ts';
import type { RateLimitLedger } from '../ledger.ts';
import type { RateLimitHeaders } from '../rate-limit-headers.ts';
import type { TradeYieldReason } from '../client.ts';

export const TOO_MANY_REQUESTS = 429;
export const RETRY_AFTER_HEADER = 'retry-after';

const MS_PER_SECOND = 1000;
const MINIMUM_YIELD_MS = 1000;

/** `Retry-After` in delta-seconds. A non-integer value is treated as absent. */
const DELTA_SECONDS = /^\d+$/;

export interface YieldPenalty {
  readonly retryAfterMs: number;
  readonly reason: TradeYieldReason;
}

function retryAfterMsOf(headers: Readonly<Record<string, string>>): number | undefined {
  for (const [name, value] of Object.entries(headers)) {
    if (name.toLowerCase() !== RETRY_AFTER_HEADER) {
      continue;
    }
    const trimmed = value.trim();
    if (!DELTA_SECONDS.test(trimmed)) {
      // An HTTP-date form, or garbage: the ledger's own penalty beats a `NaN` the caller guards.
      return undefined;
    }
    const delayMs = Number(trimmed) * MS_PER_SECOND;
    // `Retry-After: 0` counts as absent: a zero-length yield is the tight retry AD-8 forbids.
    return delayMs > 0 ? delayMs : undefined;
  }
  return undefined;
}

// A floor on a refusal, not a rate: the ledger can be empty and a yield of 0 ms would send the
// caller straight back.
function declaredYieldFloorMs(parsed: RateLimitHeaders): number {
  let floor = 0;
  for (const rule of parsed.rules) {
    for (const bucket of rule.buckets) {
      floor = Math.max(floor, bucket.penalty * MS_PER_SECOND, bucket.seconds * MS_PER_SECOND);
    }
  }
  return Math.max(floor, MINIMUM_YIELD_MS);
}

/** The delay and the reason a `429` yields with (§5.3). */
export function penaltyOf(
  ledger: RateLimitLedger,
  response: HttpResponse,
  parsed: RateLimitHeaders,
  policy: string | undefined,
): YieldPenalty {
  const fromHeader = retryAfterMsOf(response.headers);
  const derived = derivedYieldDelayMs(ledger, policy);
  return {
    retryAfterMs: fromHeader ?? (derived > 0 ? derived : declaredYieldFloorMs(parsed)),
    reason: fromHeader === undefined ? 'derived-penalty' : 'retry-after-header',
  };
}
