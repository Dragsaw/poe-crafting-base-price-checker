/**
 * The Sync Report a chunk writes to `data/sync-report.json` (FR-25, AD-12).
 *
 * A **figure** describes this chunk and replaces the previous one. A **record**
 * stays until the player deletes it from the file by hand, so the report
 * carries forward every record the previous file still holds, in its order,
 * and places this chunk's new records against them (Consistency Conventions,
 * *Logging*). A new record that is `sameRecord` with one already present —
 * the same kind and the same subject fields (IMPLEMENTATION-NOTES.md §12) —
 * replaces it at its index, so a record that carries a live measurement keeps
 * its position and shows the latest one. Any other new record is appended.
 *
 * The figure keys on the two chunk sources only (AD-12): the counter tracks all
 * three declared sources, and this is where the report narrows to the two a
 * chunk can spend on.
 *
 * Pure: the previous report, the records and the figures come in as values,
 * and the file comes out.
 */

import { ChunkRequestSourceSchema, sameRecord, SYNC_REPORT_SCHEMA_VERSION } from '@poe/contracts';
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
  readonly runFinishedAt?: string | undefined;
}

/**
 * The previous records in their order. Each new record replaces the first
 * earlier record it is `sameRecord` with, at that record's index; otherwise it
 * is appended. A replacement is not a clear: only the player's edit removes a
 * record.
 */
export function carryRecords(
  previous: readonly SyncRunRecord[],
  newRecords: readonly SyncRunRecord[],
): SyncRunRecord[] {
  const records = [...previous];
  for (const record of newRecords) {
    const index = records.findIndex((present) => sameRecord(present, record));
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
    ...(runFinishedAt === undefined ? {} : { runFinishedAt }),
    figures: {
      ...figures,
      requestsBySource: chunkRequests(figures.requestsBySource),
    },
    records: carryRecords(previous?.records ?? [], newRecords),
    schemaVersion: SYNC_REPORT_SCHEMA_VERSION,
  };
}
