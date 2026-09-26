/**
 * The run-start league gate (FR-32, AD-19, AD-12).
 *
 * `runChunk` calls it through `ChunkPorts.gate`, under the lock and before any
 * search. It sends **exactly one** GET to the trade leagues endpoint through
 * the governed client, which the shell counts as `league-validation`, and
 * checks that the configured league is one of the ids the endpoint answered.
 * The ids compare **byte for byte**: `forbidden rites` is not
 * `Forbidden Rites`, because the search URL addresses the league by that
 * exact string.
 *
 * The consequences, by answer. The classes mirror the pricing step's
 * (`../pricing/price-entry.ts`):
 *
 * | Answer | Gate result | Report (`runChunk`) |
 * | --- | --- | --- |
 * | 2xx, the league is an id | `pass` | no record |
 * | 2xx, the league is not an id | throws `LeagueMismatchError` | `league-mismatch` |
 * | 2xx body that is not the payload shape | throws `UnexpectedLeaguesResponseError` | `run-failure`, `unrecoverable-error` |
 * | a client yield (429, invalid-request threshold), 5xx, timeout, network failure | `yield` | no record; the chunk yields (AD-8) |
 * | any other non-2xx | throws `LeagueRequestRejectedError` | `run-failure`, `trade-request-rejected` |
 * | any other port rejection | rethrown | `run-failure`, `unrecoverable-error` |
 *
 * A yield sends no search: the chunk ends before its first entry, so no
 * budget is spent on a league that was not validated.
 *
 * The league arrives as a value; this module never names `config.json`.
 */

import { LeaguesPayloadSchema } from '@poe/contracts';
import type { LeagueId } from '@poe/contracts';

import type { GateContext, GateResult } from '../chunk/run-chunk.ts';
import type { TradeClient, TradeResult } from '../trade/client.ts';
import { DATA_LANE, TRADE_LEAGUES_URL } from '../trade/endpoints.ts';
import { isTransportFailure } from '../trade/transport-failure.ts';

const SERVER_ERROR = 500;

/**
 * The configured league is not among the ids the trade API carries. A routine
 * configuration fault: `runChunk` turns it into a `league-mismatch` record
 * carrying the list the player corrects `config.json` from.
 */
export class LeagueMismatchError extends Error {
  readonly configuredLeague: LeagueId;
  /** Every id the endpoint answered, in endpoint order. */
  readonly availableLeagues: readonly LeagueId[];

  constructor(configuredLeague: LeagueId, availableLeagues: readonly LeagueId[]) {
    super(
      `the configured league ${JSON.stringify(configuredLeague)} is not one the trade API carries (${
        availableLeagues.length === 0
          ? 'it listed none'
          : availableLeagues.map((id) => JSON.stringify(id)).join(', ')
      }); the run is aborted`,
    );
    this.name = 'LeagueMismatchError';
    this.configuredLeague = configuredLeague;
    this.availableLeagues = availableLeagues;
  }
}

/**
 * The leagues request answered a non-2xx that is neither a 429 nor a 5xx. It
 * names no entry: the gate runs before any entry is visited.
 */
export class LeagueRequestRejectedError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`the trade leagues request answered ${String(status)}; the run is aborted`);
    this.name = 'LeagueRequestRejectedError';
    this.status = status;
  }
}

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
    // A 429 and the invalid-request threshold arrive as a client yield.
    if (result.kind === 'yield') {
      return YIELD;
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
