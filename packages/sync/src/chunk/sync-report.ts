// Sync Report (FR-25, AD-12): figures replace the previous ones; records carry forward and are
// replaced by identity at their index. Pure.
// The figure keys on chunk sources only, `session-probe` included and always written (AD-12).

import { ChunkRequestSourceSchema, isSameRecord, SYNC_REPORT_SCHEMA_VERSION } from '@poe/contracts';
import type {
  ChunkRequestSource,
  RequestSource,
  SyncReportFile,
  SyncRunFigures,
  SyncRunRecord,
} from '@poe/contracts';

/** The figures as a chunk knows them. A source it sent nothing for may be left out. */
export type SyncReportFigures = Omit<SyncRunFigures, 'requestsBySource'> & {
  readonly requestsBySource: Readonly<Partial<Record<RequestSource, number>>>;
};

export interface SyncReportInputs {
  /** The report the previous chunk wrote, already validated, or `undefined` if none. */
  readonly previous: SyncReportFile | undefined;
  /** This chunk's records, in the order they arose. */
  readonly newRecords: readonly SyncRunRecord[];
  readonly figures: SyncReportFigures;
  readonly runStartedAt: string;
  /** Only a normal finish passes it. The failure path leaves it absent. */
  readonly runFinishedAt?: string;
}

/** Previous records in order; a new record replaces its `isSameRecord` twin in place or appends. */
export function carryRecords(
  previous: readonly SyncRunRecord[],
  newRecords: readonly SyncRunRecord[],
): SyncRunRecord[] {
  const records = [...previous];
  for (const record of newRecords) {
    const index = records.findIndex((present) => isSameRecord(present, record));
    if (index === -1) {
      records.push(record);
    } else {
      records[index] = record;
    }
  }
  return records;
}

/** The chunk sources, each `0` unless the chunk counted a request for it. */
function chunkRequests(
  counted: Readonly<Partial<Record<RequestSource, number>>>,
): Record<ChunkRequestSource, number> {
  return Object.fromEntries(
    ChunkRequestSourceSchema.options.map((source) => [source, counted[source] ?? 0]),
  ) as Record<ChunkRequestSource, number>;
}

export function buildSyncReport({
  previous,
  newRecords,
  figures,
  runStartedAt,
  runFinishedAt,
}: SyncReportInputs): SyncReportFile {
  return {
    runStartedAt,
    ...(runFinishedAt !== undefined && { runFinishedAt }),
    figures: {
      ...figures,
      requestsBySource: chunkRequests(figures.requestsBySource),
    },
    records: carryRecords(previous?.records ?? [], newRecords),
    schemaVersion: SYNC_REPORT_SCHEMA_VERSION,
  };
}
