/**
 * The run-start league gate (FR-32, AD-19, AD-12): one governed GET, ids compared byte for byte as the search URL uses them.
 */

import { LeaguesPayloadSchema } from '@poe/contracts';
import type { LeagueId } from '@poe/contracts';

import type { GateContext, GateResult } from '../chunk/run-chunk.ts';
import { penaltyRetryAfterMs } from '../trade/client.ts';
import type { TradeClient, TradeResult } from '../trade/client.ts';
import { DATA_LANE, TRADE_LEAGUES_URL } from '../trade/endpoints.ts';
import { isTransportFailure } from '../trade/transport-failure.ts';
import { LeagueMismatchError } from './league-mismatch-error.ts';
import { LeagueRequestRejectedError } from './league-request-rejected-error.ts';

export { LeagueMismatchError } from './league-mismatch-error.ts';
export { LeagueRequestRejectedError } from './league-request-rejected-error.ts';

const SERVER_ERROR = 500;

/** A 2xx whose body is not the leagues payload shape. */
export class UnexpectedLeaguesResponseError extends Error {
  constructor(detail: string) {
    super(`the trade leagues request answered an unexpected body: ${detail}`);
    this.name = 'UnexpectedLeaguesResponseError';
  }
}

export interface LeagueGateOptions {
  /** The governed client whose port the shell counts as `league-validation`. */
  readonly client: TradeClient;
  /** The active league (AD-19). The caller reads it; this module never does. */
  readonly league: LeagueId;
}

function parseLeagueIds(body: string): LeagueId[] {
  let data: unknown;
  try {
    data = JSON.parse(body);
  } catch {
    throw new UnexpectedLeaguesResponseError('not valid JSON');
  }
  const parsed = LeaguesPayloadSchema.safeParse(data);
  if (!parsed.success) {
    throw new UnexpectedLeaguesResponseError(
      parsed.error.issues
        .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
        .join('; '),
    );
  }
  return parsed.data.result.map((entry) => entry.id);
}

const YIELD: GateResult = { kind: 'yield' };
const PASS: GateResult = { kind: 'pass' };

export function createLeagueGate(
  options: LeagueGateOptions,
): (context: GateContext) => Promise<GateResult> {
  const { client, league } = options;
  return async () => {
    let result: TradeResult;
    try {
      result = await client.send({ method: 'GET', url: TRADE_LEAGUES_URL, lane: DATA_LANE });
    } catch (error) {
      if (isTransportFailure(error)) {
        return YIELD;
      }
      throw error;
    }
    // A 429 and the invalid-request threshold arrive as a client yield. Only
    // a 429 carries the delay the chunk remembers as `notBefore` (§5.3).
    if (result.kind === 'yield') {
      const retryAfterMs = penaltyRetryAfterMs(result);
      return retryAfterMs === undefined ? YIELD : { kind: 'yield', retryAfterMs };
    }
    const { status, body } = result.response;
    if (status >= SERVER_ERROR) {
      return YIELD;
    }
    if (status < 200 || status >= 300) {
      throw new LeagueRequestRejectedError(status);
    }
    const available = parseLeagueIds(body);
    if (!available.includes(league)) {
      throw new LeagueMismatchError(league, available);
    }
    return PASS;
  };
}
