import type { CrossFileFailure } from '@poe/core';

import type { Parsed } from '../load/artifacts';
import { plural } from '../shared/text';
import { relativeAge } from '../shared/time';

// Every figure is read as published; counting records is the only derivation (AD-27).
// A missing value is `undefined`, which the view sets as the italic *unknown*.

type WeightsEnvelope = Parsed<'weights'>;
type SyncReport = Parsed<'syncReport'>;

export const UNKNOWN = 'unknown';
export const NOT_MEASURED = 'not measured';
const NOT_COMMITTED_SUFFIX = ' (not committed)';

export const WEIGHTS_FILE_LABEL = 'Weights File';
export const LAST_SYNCED_LABEL = 'Last synced';
export const TRACKED_LIST_EDITED_LABEL = 'Tracked List last edited';

export const AFFORDANCE_CLOSED = '+ the full sync report';
/** U+2212, the minus sign, never a hyphen or an em dash. */
export const AFFORDANCE_OPEN = '− the full sync report';

export const PANEL_HEADINGS = ['The sync run', 'What is broken', 'What the weights cover'] as const;

/** An ISO-8601 instant as its UTC calendar date, `YYYY-MM-DD`. */
export function utcDate(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

/** One field of line one: its printed name and its value, or `undefined` for *unknown*. */
export interface WeightsFact {
  readonly name: 'producer' | 'generatedAt' | 'gamePatch';
  readonly value: string | undefined;
}

/** Line one, from the weights header as published (FR-10). An absent file leaves all three *unknown*. */
export function weightsFacts(weights: WeightsEnvelope | undefined): readonly [WeightsFact, WeightsFact, WeightsFact] {
  return [
    { name: 'producer', value: weights?.producer.id },
    { name: 'generatedAt', value: weights === undefined ? undefined : utcDate(weights.producer.generatedAt) },
    { name: 'gamePatch', value: weights?.gamePatch },
  ];
}

/** `Last synced`: the run's finish, or its start on an aborted run, against the load's `now`. */
export function lastSynced(report: SyncReport | undefined, now: number): string | undefined {
  if (report === undefined) {
    return undefined;
  }
  const at = report.runFinishedAt ?? report.runStartedAt;
  return relativeAge(now - Date.parse(at));
}

/** The Tracked List edit date (FR-18): a bare UTC date, with the plain suffix for a `file-modified` clock. */
export interface TrackedListEdit {
  readonly date: string;
  readonly suffix: string;
}

export function trackedListEdit(report: SyncReport | undefined): TrackedListEdit | undefined {
  const edited = report?.figures.trackedListEditedAt;
  if (edited === undefined) {
    return undefined;
  }
  return { date: utcDate(edited.at), suffix: edited.source === 'file-modified' ? NOT_COMMITTED_SUFFIX : '' };
}

function countUnresolvable(report: SyncReport): number {
  return report.records.filter((record) => record.kind === 'unresolvable').length;
}

/** The loaded curation that a `pinned-starvation` record must describe to count on the health line. */
export interface Curation {
  /** The number of Tracked List entries with `status: 'pinned'`. */
  readonly pinnedCount: number;
  /** The loaded `config.minChunkSearches`. */
  readonly minChunkSearches: number;
}

// The words are DESIGN.md's `healthSignals` (UX-DR21). The starvation trigger reads only the record
// whose `pinnedCount` and `declaredMinChunkSearches` match the loaded curation, wherever it sits.
export function healthSignals(report: SyncReport | undefined, curation: Curation): readonly string[] {
  if (report === undefined) {
    return [];
  }
  const signals: string[] = [];
  const unresolvable = countUnresolvable(report);
  if (unresolvable > 0) {
    signals.push(`${unresolvable.toLocaleString('en-US')} unresolvable`);
  }
  const starvation = report.records.find(
    (record) =>
      record.kind === 'pinned-starvation' &&
      record.pinnedCount === curation.pinnedCount &&
      record.declaredMinChunkSearches === curation.minChunkSearches,
  );
  // M = 0 has nothing pinned to starve, and would print a zero.
  if (starvation?.kind === 'pinned-starvation' && starvation.pinnedCount > 0) {
    const total = starvation.pinnedCount.toLocaleString('en-US');
    const starved = starvation.pinnedCount - starvation.pinnedRefreshed;
    signals.push(
      starved === 0
        ? `${total} pinned entries left the rotation no search`
        : `${starved.toLocaleString('en-US')} of ${total} pinned entries starved`,
    );
  }
  return signals;
}

// --- the panel ------------------------------------------------------------

/** A run of panel prose; `verbatim` is mono with no semantic ink (the cross-file diagnosis). */
export type Segment =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'figure'; readonly text: string }
  | { readonly kind: 'missing'; readonly text: string }
  | { readonly kind: 'verbatim'; readonly text: string };

/** One figure group: one or more lines of segments. */
export type FigureGroup = readonly (readonly Segment[])[];

/** The three columns, in order, each a vertical stack of groups. The second may carry a third group, the cross-file diagnosis. */
export type PanelColumns = readonly [readonly FigureGroup[], readonly FigureGroup[], readonly FigureGroup[]];

const text = (value: string): Segment => ({ kind: 'text', text: value });
const figure = (value: number | string): Segment => ({
  kind: 'figure',
  text: typeof value === 'number' ? value.toLocaleString('en-US') : value,
});
const missing = (value: string): Segment => ({ kind: 'missing', text: value });

const UNKNOWN_GROUP: FigureGroup = [[missing(UNKNOWN)]];

/** What one diagnosis line prints: the check, the canonical key and the detail. */
export type DiagnosisFailure = Pick<CrossFileFailure, 'check' | 'entryKey' | 'detail'>;

/** One diagnosis line, verbatim: `check · canonical key · detail`. */
function diagnosisLine(failure: DiagnosisFailure): string {
  return `${failure.check} · ${failure.entryKey} · ${failure.detail}`;
}

// No failure, no group: not even a zero. With no weights envelope the checks did not run,
// so the group is one *unknown* line.
function diagnosisGroups(failures: readonly DiagnosisFailure[], areWeightsLoaded: boolean): FigureGroup[] {
  if (!areWeightsLoaded) {
    return [UNKNOWN_GROUP];
  }
  return failures.length === 0 ? [] : [failures.map((failure) => [{ kind: 'verbatim', text: diagnosisLine(failure) }])];
}

// Five groups from `sync-report.json` plus the cross-file diagnosis `web` ran at load (AD-17).
// Zeros print here; the no-zero rule is the strip's. Omitted coverage never reads `0` (AD-27).
export function panelColumns(
  report: SyncReport | undefined,
  areWeightsLoaded: boolean,
  crossFileFailures: readonly DiagnosisFailure[] = [],
): PanelColumns {
  const diagnosis = diagnosisGroups(crossFileFailures, areWeightsLoaded);
  if (report === undefined) {
    return [
      [UNKNOWN_GROUP, UNKNOWN_GROUP],
      [UNKNOWN_GROUP, UNKNOWN_GROUP, ...diagnosis],
      [UNKNOWN_GROUP],
    ];
  }
  const { figures } = report;
  const leagueValidationCount = figures.requestsBySource['league-validation'];
  const requests: FigureGroup = [
    [
      figure(figures.requestsBySource['tracked-list']),
      text(' tracked list · '),
      figure(leagueValidationCount),
      text(` league validation ${plural(leagueValidationCount, 'request', 'requests')} this pass.`),
    ],
  ];
  const notReachedCount = figures.notReachedCount;
  const notReached: FigureGroup = [
    [
      figure(notReachedCount),
      text(
        ` tracked ${plural(notReachedCount, 'entry', 'entries')} ${plural(notReachedCount, 'was', 'were')} not reached in the last sync pass.`,
      ),
    ],
  ];
  const unresolvableCount = countUnresolvable(report);
  const unresolvable: FigureGroup = [
    [
      figure(unresolvableCount),
      text(` ${plural(unresolvableCount, 'entry is', 'entries are')} unresolvable.`),
    ],
  ];
  const starvation = report.records.flatMap((record) => (record.kind === 'pinned-starvation' ? [record] : []));
  const starved: FigureGroup = [
    [figure(starvation.length), text(` pinned-starvation ${plural(starvation.length, 'record', 'records')}.`)],
    ...starvation.map((record) => [
      figure(record.pinnedRefreshed),
      text(' of '),
      figure(record.pinnedCount),
      text(` ${plural(record.pinnedCount, 'pinned entry', 'pinned entries')} refreshed`),
    ]),
  ];
  return [[requests, notReached], [unresolvable, starved, ...diagnosis], [coverageGroup(figures, areWeightsLoaded)]];
}

function coverageGroup(figures: SyncReport['figures'], areWeightsLoaded: boolean): FigureGroup {
  if (figures.coverage === undefined) {
    return [[missing(areWeightsLoaded ? NOT_MEASURED : UNKNOWN)]];
  }
  const denominator =
    figures.rankableClassCount === undefined ? missing(UNKNOWN) : figure(figures.rankableClassCount);
  // An unknown denominator keeps the plural.
  const classes = plural(figures.rankableClassCount ?? 0, 'tracked Item Class', 'tracked Item Classes');
  return [[figure(`${String(coveragePercent(figures.coverage))}%`), text(' of '), denominator, text(` ${classes}.`)]];
}

// Non-zero coverage never reads 0% and partial coverage never reads 100%.
// The epsilon absorbs float error such as `0.29 * 100 === 28.999999999999996`.
function coveragePercent(coverage: number): number {
  const floored = Math.floor(coverage * 100 + 1e-9);
  if (floored === 0 && coverage > 0) {
    return 1;
  }
  return coverage < 1 ? Math.min(floored, 99) : floored;
}

/** A group as plain text, for tests and for reading. */
export function groupText(group: FigureGroup): string {
  return group.map((line) => line.map((segment) => segment.text).join('')).join('\n');
}
