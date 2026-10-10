import type { DatasetEntry } from '@poe/contracts';

import type { ProblemSummary } from '../frame/problem-summary';
import { groupText } from '../frame/segments';
import type { Parsed } from '../load/artifacts';
import { VALID_BODIES } from './artifact-server';
import { NOW } from './dom';
import { priced, rawEntry, unpriced } from './list-fixtures';

export type SyncReport = Parsed<'syncReport'>;
type Weights = Parsed<'weights'>;

export const WEIGHTS = VALID_BODIES.weights as Weights;
export const BASE_REPORT = VALID_BODIES.syncReport as SyncReport;

export function report(overrides: Partial<SyncReport> = {}, figures: Partial<SyncReport['figures']> = {}): SyncReport {
  return { ...BASE_REPORT, ...overrides, figures: { ...BASE_REPORT.figures, ...figures } };
}

/** `n` dataset entries the catalogue lost (state `unresolvable`), plus one priced entry. */
export function datasetWithBroken(n: number): DatasetEntry[] {
  const broken = Array.from({ length: n }, (_, index) => unpriced(rawEntry(`Lost ${String(index)}`), { state: 'unresolvable' }));
  return [...broken, priced(rawEntry('Kept'), 1, new Date(NOW).toISOString())];
}

/** Five report records that outlived a recovered id: they never count (AD-12). */
export const STALE_RECORDS: SyncReport['records'] =
  Array.from({ length: 5 }, (_, index) => ({
    kind: 'unresolvable' as const,
    entryKey: `raw:Base ${String(index)}`,
    identifier: `Base ${String(index)}`,
    identifierKind: 'baseTypeId' as const,
  }));

export const starvation = {
  kind: 'pinned-starvation' as const,
  discoveredAllowance: 4,
  declaredMinChunkSearches: 8,
  pinnedCount: 6,
  pinnedRefreshed: 5,
  activeRefreshed: 0,
};

// The loaded curation that the `starvation` fixture describes: 6 pinned, yardstick 8.
export const CURATION = { pinnedCount: 6, minChunkSearches: 8, prunedKeys: new Set<string>() };

export const lines = (summary: ProblemSummary): string[] => summary.lines.map((line) => groupText([line]));
