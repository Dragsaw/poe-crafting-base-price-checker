/** A non-2xx that is neither 429 nor 5xx; it names no entry, the gate runs before any entry. */
export class LeagueRequestRejectedError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`the trade leagues request answered ${String(status)}; the run is aborted`);
    this.name = 'LeagueRequestRejectedError';
    this.status = status;
  }
}
