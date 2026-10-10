import type { DatasetEntry } from '@poe/contracts';

import type { Parsed } from '../load/artifacts';
import { plural } from '../shared/text';
import { count, type FigureLine, mark, type ProblemMark, text } from './segments';

// Counting entries and records is the only derivation (AD-27).

type SyncReport = Parsed<'syncReport'>;

/** The loaded curation that a `pinned-starvation` record must describe to count (AD-12). */
export interface Curation {
  /** The number of Tracked List entries with `status: 'pinned'`. */
  readonly pinnedCount: number;
  /** The loaded `config.minChunkSearches`. */
  readonly minChunkSearches: number;
  /** Canonical keys of `pruned` entries: they are never re-checked, so they never count as broken. */
  readonly prunedKeys: ReadonlySet<string>;
}

/** The counted problems: broken dataset entries and starved pinned entries, with their lines. */
export interface ProblemSummary {
  readonly broken: number;
  readonly starved: number;
  /** ✕ when any counted entry is broken, ◐ otherwise; `undefined` when nothing counts. */
  readonly kind: ProblemMark | undefined;
  readonly lines: readonly FigureLine[];
}

function matchingStarvation(report: SyncReport | undefined, curation: Curation) {
  const record = report?.records.find(
    (candidate) =>
      candidate.kind === 'pinned-starvation' &&
      candidate.pinnedCount === curation.pinnedCount &&
      candidate.declaredMinChunkSearches === curation.minChunkSearches,
  );
  // M = 0 has nothing pinned to starve.
  return record?.kind === 'pinned-starvation' && record.pinnedCount > 0 ? record : undefined;
}

function starvationLine(pinned: number, left: number): FigureLine {
  const total = count(pinned);
  const words =
    left === 0
      ? `${total} ${plural(pinned, 'pinned entry takes', 'pinned entries take')} every search, so nothing else rotates`
      : `${count(left)} of ${total} pinned entries are not being refreshed`;
  return [mark('rough'), text(` ${words}`)];
}

/** Broken non-pruned entries from the dataset, starved ones from the matching record; a stale patch has no source (AD-12). */
export function problemSummary(
  dataset: readonly DatasetEntry[],
  report: SyncReport | undefined,
  curation: Curation,
): ProblemSummary {
  const broken = dataset.filter((entry) => entry.price.state === 'unresolvable' && !curation.prunedKeys.has(entry.entryKey)).length;
  const lines: FigureLine[] = [];
  if (broken > 0) {
    lines.push([mark('broken'), text(` ${count(broken)} ${plural(broken, 'entry', 'entries')} can no longer be priced`)]);
  }
  const record = matchingStarvation(report, curation);
  let starved = 0;
  if (record !== undefined) {
    const left = Math.max(record.pinnedCount - record.pinnedRefreshed, 0);
    starved = Math.max(left, 1);
    lines.push(starvationLine(record.pinnedCount, left));
  }
  let kind: ProblemMark | undefined;
  if (broken > 0) {
    kind = 'broken';
  } else if (starved > 0) {
    kind = 'rough';
  }
  return { broken, starved, kind, lines };
}
