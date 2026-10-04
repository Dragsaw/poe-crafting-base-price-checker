import { canonicalKey } from '@poe/contracts';
import type { LeagueMismatchRecord, RunFailureRecord, SyncRunRecord, TrackedEntry } from '@poe/contracts';

import { LeagueMismatchError, LeagueRequestRejectedError } from '../../league/league-gate.ts';
import { MalformedRequestError } from '../../pricing/price-entry.ts';
import { CrossFileGateError, crossFileGateRecords } from '../cross-file-gate.ts';

/** The records a throw leaves in the report: one per failing check of a cross-file gate failure, otherwise one (AD-19 for a league mismatch). */
export function failureRecords(error: unknown, current: TrackedEntry | undefined): SyncRunRecord[] {
  return error instanceof CrossFileGateError ? crossFileGateRecords(error) : [failureRecord(error, current)];
}

function failureRecord(error: unknown, current: TrackedEntry | undefined): LeagueMismatchRecord | RunFailureRecord {
  if (error instanceof LeagueMismatchError) {
    return {
      kind: 'league-mismatch',
      configuredLeague: error.configuredLeague,
      availableLeagues: [...error.availableLeagues],
    };
  }
  const message = (error instanceof Error ? error.message : String(error)) || 'unknown error';
  if (error instanceof LeagueRequestRejectedError) {
    return { kind: 'run-failure', reason: 'trade-request-rejected', status: error.status, message };
  }
  if (error instanceof MalformedRequestError) {
    return {
      kind: 'run-failure',
      reason: 'trade-request-rejected',
      entryKey: error.entryKey,
      status: error.status,
      message,
    };
  }
  return {
    kind: 'run-failure',
    reason: 'unrecoverable-error',
    ...(current !== undefined && { entryKey: canonicalKey(current) }),
    message,
  };
}
