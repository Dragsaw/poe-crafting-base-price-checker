import { parseEnvelope, SyncProgressFileSchema, SyncReportFileSchema } from '@poe/contracts';
import type { FilesystemPort, SyncProgressFile } from '@poe/contracts';

import { writeArtifact } from '../../write-artifact.ts';
import { isLockHeld } from '../lock.ts';
import type { ChunkOutcome } from '../run-chunk.ts';
import { buildSyncReport } from '../sync-report.ts';
import { PROGRESS_PATH, REPORT_PATH } from './data-paths.ts';
import { loadEnvelope } from './load-envelope.ts';
import { carriedCoverage } from './run-state.ts';
import type { RunContext } from './run-state.ts';

export interface ProgressLoad {
  readonly progress: SyncProgressFile | undefined;
  /** An unreadable progress file throws later, at its usual place, so the run still reports. */
  readonly fault: { readonly error: unknown } | undefined;
}

/** The penalty memory (AD-8, IMPLEMENTATION-NOTES.md §5.3) is read before every other load. */
export async function loadProgress(fs: FilesystemPort): Promise<ProgressLoad> {
  try {
    const progress = await loadEnvelope(fs, PROGRESS_PATH, (data) => parseEnvelope(SyncProgressFileSchema, data));
    return { progress, fault: undefined };
  } catch (error) {
    return { progress: undefined, fault: { error } };
  }
}

/** The one write of a deferred run: a broken stale lock's record is the only trace of the crash. */
async function writePauseReport(context: RunContext): Promise<void> {
  const { fs, clock } = context.ports;
  const previous = await loadEnvelope(fs, REPORT_PATH, (data) => parseEnvelope(SyncReportFileSchema, data));
  await writeArtifact(
    fs,
    REPORT_PATH,
    SyncReportFileSchema,
    buildSyncReport({
      previous,
      newRecords: context.records,
      // The pause is no re-read of the weights file: the figure stays.
      figures: { requestsBySource: {}, notReachedCount: 0, ...carriedCoverage(previous) },
      runStartedAt: context.mine.startedAt,
      runFinishedAt: clock.now(),
    }),
  );
}

function isBefore(now: string, notBefore: string): boolean {
  return Date.parse(now) < Date.parse(notBefore);
}

/** Before `notBefore` the run sends and writes nothing, except a broken lock's record (AD-8). */
export async function deferIfPaused(
  context: RunContext,
  progress: SyncProgressFile | undefined,
): Promise<ChunkOutcome | undefined> {
  const { fs, clock } = context.ports;
  const notBefore = progress?.notBefore;
  if (notBefore === undefined || !isBefore(clock.now(), notBefore)) {
    return undefined;
  }
  context.log(
    `sync: a previous chunk set a pause until ${notBefore} (a 429 or a rejected request); nothing sent this invocation`,
  );
  if (context.records.length > 0 && (await isLockHeld(fs, context.mine))) {
    await writePauseReport(context);
  }
  return { kind: 'deferred', completed: [], entries: [], records: context.records, notBefore };
}
