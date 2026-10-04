import { resolveTrackedListAge, SyncReportFileSchema } from '@poe/contracts';
import type { SyncRunRecord } from '@poe/contracts';

import { requestsBetween } from '../../request-counter.ts';
import { writeArtifact } from '../../write-artifact.ts';
import { buildSyncReport } from '../sync-report.ts';
import { REPORT_PATH, TRACKED_PATH } from './data-paths.ts';
import { countFrom } from './run-state.ts';
import type { RunState } from './run-state.ts';

export async function writeReport(
  state: RunState,
  chunkRecords: readonly SyncRunRecord[],
  runFinishedAt?: string,
): Promise<void> {
  const { fs, git, requests } = state.ports;
  // Every entry the order made eligible that the chunk did not attempt (AD-7).
  const eligible = state.order === undefined ? 0 : state.order.pinned.length + state.order.rotation.length;
  const trackedListEditedAt = await resolveTrackedListAge({ git, filesystem: fs, path: TRACKED_PATH });
  const report = buildSyncReport({
    previous: state.previousReport,
    newRecords: chunkRecords,
    figures: {
      requestsBySource: requestsBetween(countFrom(state), requests.snapshot()),
      notReachedCount: Math.max(0, eligible - state.attempted),
      ...(trackedListEditedAt !== undefined && { trackedListEditedAt }),
      ...state.coverageFigures,
    },
    runStartedAt: state.runStartedAt,
    runFinishedAt,
  });
  state.isReportAttempted = true;
  await writeArtifact(fs, REPORT_PATH, SyncReportFileSchema, report);
}
