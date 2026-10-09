import type { DatasetEntry } from '@poe/contracts';

import type { StepResult } from '../chunk/run-chunk.ts';
import { penaltyRetryAfterMs } from '../trade/client.ts';
import type { TradeResult } from '../trade/client.ts';
import { isTransportFailure } from '../trade/transport-failure.ts';

type Leg =
  | { readonly kind: 'answered'; readonly result: Extract<TradeResult, { kind: 'response' }> }
  | {
      readonly kind: 'yield';
      /** Set only on a `429` yield: the delay the client's yield carried. */
      readonly retryAfterMs?: number;
      /** AD-30's downgrade: read as a request with no answer. */
      readonly sessionExpired?: true;
    }
  | { readonly kind: 'malformed'; readonly status: number };

/** The step's yield, carrying the leg's `retryAfterMs` where it has one. */
export function yieldedWith(
  leg: Extract<Leg, { kind: 'yield' }>,
  entry: DatasetEntry,
): Extract<StepResult, { kind: 'yielded' }> {
  return {
    kind: 'yielded',
    entry,
    ...(leg.retryAfterMs !== undefined && { retryAfterMs: leg.retryAfterMs }),
    ...((leg.sessionExpired === true) && { sessionExpired: true }),
  };
}

const SERVER_ERROR = 500;

/** A timeout or a lost connection yields as a 429 and a 5xx do: server trouble stops the chunk. */
export async function sendLeg(send: () => Promise<TradeResult>): Promise<Leg> {
  let result: TradeResult;
  try {
    result = await send();
  } catch (error) {
    if (isTransportFailure(error)) {
      return { kind: 'yield' };
    }
    throw error;
  }
  if (result.kind === 'yield') {
    if (result.reason === 'session-expired') {
      // The downgrading answer is discarded: AD-9's request with no answer.
      return { kind: 'yield', sessionExpired: true };
    }
    const retryAfterMs = penaltyRetryAfterMs(result);
    return retryAfterMs === undefined ? { kind: 'yield' } : { kind: 'yield', retryAfterMs };
  }
  const { status } = result.response;
  if (status >= SERVER_ERROR) {
    return { kind: 'yield' };
  }
  return status < 200 || status >= 300 ? { kind: 'malformed', status } : { kind: 'answered', result };
}
