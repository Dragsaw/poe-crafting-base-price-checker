import type { LeagueId } from '@poe/contracts';

/** The configured league is not among the trade API's ids; `runChunk` reports it as `league-mismatch`. */
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
