import type { PacingState } from '../trade/client.ts';
import { laneDelayMs } from '../trade/client.ts';
import { DATA_LANE, FETCH_LANE, SEARCH_LANE } from '../trade/endpoints.ts';
import { evenIntervalMs } from '../trade/ledger.ts';

/** First backoff on a lane with no policy read yet: the even interval of the `600:21600` bucket. */
export const COLD_EVEN_INTERVAL_MS = 36_000;

function entryLanes(hasGate: boolean): readonly string[] {
  return hasGate ? [DATA_LANE, SEARCH_LANE, FETCH_LANE] : [SEARCH_LANE, FETCH_LANE];
}

/** The pre-wait before the next chunk: the largest spread delay over the lanes it will spend on. */
export function preWaitMs(pacing: PacingState, now: string, hasGate: boolean): number {
  return Math.max(0, ...entryLanes(hasGate).map((lane) => laneDelayMs(pacing, lane, now, true)));
}

/** The tightest even interval over an entry's lanes; an unread policy is the cold interval. */
export function sessionEvenIntervalMs(pacing: PacingState, hasGate: boolean): number {
  return Math.max(
    ...entryLanes(hasGate).map(
      (lane) => evenIntervalMs(pacing.ledger, pacing.lanePolicies.get(lane)) ?? COLD_EVEN_INTERVAL_MS,
    ),
  );
}
