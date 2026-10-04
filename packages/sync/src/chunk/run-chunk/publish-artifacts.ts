import {
  compareCanonicalKeys,
  DatasetFileSchema,
  SYNC_PROGRESS_SCHEMA_VERSION,
  SyncProgressFileSchema,
} from '@poe/contracts';
import type { DatasetEntry, SyncProgressFile } from '@poe/contracts';

import { writeArtifact } from '../../write-artifact.ts';
import { buildDatasetFile } from '../publish-dataset.ts';
import type { ChunkPublication } from '../run-chunk.ts';
import { DATASET_PATH, PROGRESS_PATH } from './data-paths.ts';
import type { RunState } from './run-state.ts';

/** How long a failed session cookie is held off (AD-30, IMPLEMENTATION-NOTES.md §13.3). */
const AUTH_HOLD_OFF_MS = 24 * 60 * 60 * 1000;

/** `write` sets the field from this write's `now`, `clear` removes it, and none carries the loaded value forward (§13.3). */
function nextHoldOff(state: RunState, holdOff: 'write' | 'clear' | undefined): string | undefined {
  if (holdOff === 'write') {
    return new Date(Date.parse(state.ports.clock.now()) + AUTH_HOLD_OFF_MS).toISOString();
  }
  return holdOff === 'clear' ? undefined : state.progress?.authHoldOffUntil;
}

function progressFileOf(
  state: RunState,
  until: string | undefined,
  authHoldOffUntil: string | undefined,
): SyncProgressFile {
  return {
    schemaVersion: SYNC_PROGRESS_SCHEMA_VERSION,
    completed: [...new Set([...(state.order?.completed ?? []), ...state.rotationCompleted])].toSorted(
      compareCanonicalKeys,
    ),
    ...(until !== undefined && { notBefore: until }),
    ...(authHoldOffUntil !== undefined && { authHoldOffUntil }),
  };
}

/** Dataset first, so progress never records a completion the dataset does not publish; `until` is the `notBefore` written, absent clears it. */
export async function publish(
  state: RunState,
  publication: ChunkPublication,
  published: readonly DatasetEntry[],
  until: string | undefined,
): Promise<void> {
  const { fs, clock, auth } = state.ports;
  state.isPublishAttempted = true;
  await writeArtifact(
    fs,
    DATASET_PATH,
    DatasetFileSchema,
    buildDatasetFile({
      tracked: state.entries,
      previous: state.dataset?.entries ?? [],
      // A step entry for the same key wins over an offline mark.
      stepEntries: [...state.marked, ...published],
      // An unconfirmed league never relabels the dataset: before the gate passed, the previous label stands (AD-19).
      league: state.isGatePassed ? publication.league : (state.dataset?.league ?? publication.league),
      currencyRates: publication.currencyRates,
      now: clock.now(),
    }),
  );
  const holdOff = auth?.pendingHoldOff();
  await writeArtifact(
    fs,
    PROGRESS_PATH,
    SyncProgressFileSchema,
    progressFileOf(state, until, nextHoldOff(state, holdOff)),
  );
  if (holdOff !== undefined) {
    auth?.holdOffApplied(holdOff);
  }
}
