import type { DatasetEntry } from '@poe/contracts';

import { LeagueMismatchError, LeagueRequestRejectedError } from '../../league/league-gate.ts';
import { MalformedRequestError, UnexpectedTradeResponseError } from '../../pricing/price-entry.ts';
import { isLockHeld } from '../lock.ts';
import type { ChunkSetup } from '../run-chunk.ts';
import { failureRecords } from './failure-records.ts';
import { failureNotBefore } from './not-before.ts';
import { publish } from './publish-artifacts.ts';
import { logLockTakenOver, newRecords } from './run-state.ts';
import type { RunState } from './run-state.ts';
import { writeReport } from './write-report.ts';

/** The original error is always the one rethrown: a fault in a failure-path write goes to the log. */
async function attempt(state: RunState, what: string, write: () => Promise<void>): Promise<void> {
  try {
    await write();
  } catch (error) {
    state.log(`sync: ${what} failed on the failure path: ${String(error)}`);
  }
}

/** The entry a `MalformedRequestError` or an unexpected search or fetch body carries, as the step left it (AD-9). */
function failingEntry(error: unknown): DatasetEntry | undefined {
  return error instanceof MalformedRequestError || error instanceof UnexpectedTradeResponseError
    ? error.entry
    : undefined;
}

/** Publishes the step entries, the marks and the failing entry; a rejected request remembers the abort as `notBefore` (AD-9, §5.3). */
async function publishOnFailure(state: RunState, setup: ChunkSetup, error: unknown): Promise<void> {
  // The gate's non-429 4xx is a rejected request too, and would be refused again on the next tick.
  const isRejected = error instanceof MalformedRequestError || error instanceof LeagueRequestRejectedError;
  const failing = failingEntry(error);
  // A probe 429 latched before the throw still persists its penalty (§13.3).
  const latchedMs = isRejected ? undefined : state.ports.latchedRetryAfterMs?.();
  await attempt(state, 'publishing the dataset and progress', () =>
    publish(
      state,
      setup.publication,
      failing === undefined ? state.stepEntries : [...state.stepEntries, failing],
      failureNotBefore(state.ports.clock.now(), isRejected, latchedMs),
    ),
  );
}

/** Writes what a throw leaves behind, then rethrows it; a report or publish already attempted is not attempted again. */
export async function failRun(state: RunState, error: unknown): Promise<never> {
  if (state.isReportAttempted) {
    throw error;
  }
  if (!(await isLockHeld(state.ports.fs, state.mine))) {
    logLockTakenOver(state);
    throw error;
  }
  if (error instanceof LeagueMismatchError) {
    // The run's premise is wrong: the report alone, with this chunk's lock record and the mismatch (AD-12).
    await attempt(state, 'writing the report', () =>
      writeReport(state, [...state.records, ...failureRecords(error, state.current)]),
    );
    throw error;
  }
  if (state.order !== undefined && state.setup !== undefined && !state.isPublishAttempted) {
    await publishOnFailure(state, state.setup, error);
  }
  await attempt(state, 'writing the report', () =>
    writeReport(state, newRecords(state, failureRecords(error, state.current))),
  );
  throw error;
}
