/**
 * The Sync Report a chunk writes to `data/sync-report.json` (FR-25, AD-12).
 *
 * A **figure** describes this chunk and replaces the previous one. A **record**
 * stays until the player deletes it from the file by hand, so the report
 * carries forward every record the previous file still holds, in its order,
 * and appends this chunk's new records after them (Consistency Conventions,
 * *Logging*). A new record that deep-equals one already present is not
 * appended again. Records carry no timestamp, so the same starvation two
 * chunks running is one record.
 *
 * Pure: the previous report, the records and the figures come in as values,
 * and the file comes out.
 */

import { isDeepStrictEqual } from 'node:util';

import { SUPPORTED_SCHEMA_VERSION } from '@poe/contracts';
import type { RequestSource, SyncReportFile, SyncRunFigures, SyncRunRecord } from '@poe/contracts';

import { zeroRequests } from '../request-counter.ts';

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

/** The previous records, then each new record not already present. */
export function carryRecords(
  previous: readonly SyncRunRecord[],
  newRecords: readonly SyncRunRecord[],
): SyncRunRecord[] {
  const records = [...previous];
  for (const record of newRecords) {
    if (!records.some((present) => isDeepStrictEqual(present, record))) {
      records.push(record);
    }
  }
  return records;
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
      requestsBySource: { ...zeroRequests(), ...figures.requestsBySource },
    },
    records: carryRecords(previous?.records ?? [], newRecords),
    schemaVersion: SUPPORTED_SCHEMA_VERSION,
  };
}
