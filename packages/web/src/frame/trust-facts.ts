import type { DatasetEntry } from '@poe/contracts';
import type { CrossFileFailure } from '@poe/core';

import { ARTIFACTS, type Parsed, type TolerableKey } from '../load/artifacts';
import { plural } from '../shared/text';
import { compactAge, relativeAge } from '../shared/time';

// Every figure is read as published; counting entries and records is the only derivation (AD-27).
// A missing value is `undefined`, which the view prints as `unknown`.

type WeightsEnvelope = Parsed<'weights'>;
type SyncReport = Parsed<'syncReport'>;

export const UNKNOWN = 'unknown';
export const NOT_MEASURED = 'not measured';
const NOT_COMMITTED_SUFFIX = ' (not committed)';

const WEIGHTS_FILE_LABEL = 'Weights File';
const LAST_SYNCED_LABEL = 'Last synced';
export const TRACKED_LIST_EDITED_LABEL = 'Tracked List last edited';

/** EXPERIENCE.md, Copy Deck: *Sync report* column headings, in order. */
export const PANEL_HEADINGS = ['Problems', 'Sync run', 'Weights coverage', 'Built from'] as const;

const REQUESTS_LABEL = 'Requests';
const PRICE_SEARCHES_LABEL = 'price searches';
const LEAGUE_CHECKS_LABEL = 'league checks';
const POOL_COVERAGE_LABEL = 'Pool coverage';
const NOT_REACHED_TAIL = 'not reached in the last sync pass';
const NOT_REACHED_TEXT = `entries ${NOT_REACHED_TAIL}`;
export const DIAGNOSIS_LEAD = 'Disagreements with the weights file';

/** EXPERIENCE.md, Copy Deck: the sync button's words. */
export const SYNCED_LABEL = 'Synced';
export const NOT_SYNCED_YET = 'Not synced yet';

const ABSENCE_LEAD = 'Not published';
/** What each absence costs the page (EXPERIENCE.md, Copy Deck, *Sync report*). */
const ABSENCE_CONSEQUENCE: Readonly<Record<TolerableKey, string>> = {
  syncReport: 'the sync report is unavailable.',
  weights: 'every crafted class is unrankable.',
  recipes: 'no crafted rows can be ranked.',
};
/** The absence lines appear in this order, and only for absent files. */
const ABSENCE_ORDER = ['weights', 'recipes', 'syncReport'] as const satisfies readonly TolerableKey[];

function absenceBody(key: TolerableKey): string {
  return `${ARTIFACTS[key].path} — ${ABSENCE_CONSEQUENCE[key]}`;
}

export function absenceLine(key: TolerableKey): string {
  return `${ABSENCE_LEAD} ${absenceBody(key)}`;
}

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

/** The run's finish, or its start on an aborted run. */
function syncedAt(report: SyncReport): number {
  return Date.parse(report.runFinishedAt ?? report.runStartedAt);
}

/** `Last synced`: the run's age against the load's `now`. */
export function lastSynced(report: SyncReport | undefined, now: number): string | undefined {
  return report === undefined ? undefined : relativeAge(now - syncedAt(report));
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

/** The loaded curation that a `pinned-starvation` record must describe to count (AD-12). */
export interface Curation {
  /** The number of Tracked List entries with `status: 'pinned'`. */
  readonly pinnedCount: number;
  /** The loaded `config.minChunkSearches`. */
  readonly minChunkSearches: number;
  /** Canonical keys of `pruned` entries: they are never re-checked, so they never count as broken. */
  readonly prunedKeys: ReadonlySet<string>;
}

// --- segments -------------------------------------------------------------

/** The mark a problem line leads with: ✕ broken or ◐ rough. */
type ProblemMark = 'broken' | 'rough';

/** A run of panel prose; `verbatim` is the file's register (the cross-file diagnosis). */
export type Segment =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'figure'; readonly text: string }
  | { readonly kind: 'missing'; readonly text: string }
  | { readonly kind: 'verbatim'; readonly text: string }
  | { readonly kind: 'mark'; readonly mark: ProblemMark; readonly text: string };

/** One line of segments. */
type FigureLine = readonly Segment[];

/** One figure group: one or more lines. */
export type FigureGroup = readonly FigureLine[];

const text = (value: string): Segment => ({ kind: 'text', text: value });
const count = (value: number): string => value.toLocaleString('en-US');
const figure = (value: number | string): Segment => ({
  kind: 'figure',
  text: typeof value === 'number' ? count(value) : value,
});
const missing = (value: string): Segment => ({ kind: 'missing', text: value });
const valueOrUnknown = (value: string | undefined): Segment => (value === undefined ? missing(UNKNOWN) : figure(value));

/** The mark's text twin is empty: the drawing carries it, and `lineText` stays readable. */
const mark = (problem: ProblemMark): Segment => ({ kind: 'mark', mark: problem, text: '' });

/** A line as plain text, marks dropped. */
function lineText(line: FigureLine): string {
  return line.map((segment) => segment.text).join('').trim();
}

/** A group as plain text, for tests and for reading. */
export function groupText(group: FigureGroup): string {
  return group.map((line) => lineText(line)).join('\n');
}

// --- problems (AD-12) -----------------------------------------------------

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

/** What the sync button prints: the problem count in place of the age, never both (state 31). */
export type SyncButtonFace =
  | { readonly kind: 'problem'; readonly mark: ProblemMark; readonly text: string }
  | { readonly kind: 'synced'; readonly text: string }
  | { readonly kind: 'not-synced'; readonly text: string };

export function syncButtonFace(problems: ProblemSummary, report: SyncReport | undefined, now: number): SyncButtonFace {
  if (problems.kind !== undefined) {
    const total = problems.broken + problems.starved;
    return { kind: 'problem', mark: problems.kind, text: `${count(total)} ${plural(total, 'problem', 'problems')}` };
  }
  return report === undefined
    ? { kind: 'not-synced', text: NOT_SYNCED_YET }
    : { kind: 'synced', text: `${SYNCED_LABEL} ${compactAge(now - syncedAt(report))}` };
}

// --- the panel ------------------------------------------------------------

/** The four columns, in order, each a vertical stack of groups. */
export type PanelColumns = readonly [
  readonly FigureGroup[],
  readonly FigureGroup[],
  readonly FigureGroup[],
  readonly FigureGroup[],
];

/** What one diagnosis line prints: the check, the canonical key and the detail. */
type DiagnosisFailure = Pick<CrossFileFailure, 'check' | 'entryKey' | 'detail'>;

/** One diagnosis line, verbatim: `check · canonical key · detail`. */
function diagnosisLine(failure: DiagnosisFailure): string {
  return `${failure.check} · ${failure.entryKey} · ${failure.detail}`;
}

// No failure, no group. With no weights envelope the checks did not run: one `unknown` line.
function diagnosisGroups(failures: readonly DiagnosisFailure[], areWeightsLoaded: boolean): FigureGroup[] {
  const lines: FigureLine[] = areWeightsLoaded
    ? failures.map((failure) => [{ kind: 'verbatim', text: diagnosisLine(failure) }])
    : [[missing(UNKNOWN)]];
  return lines.length === 0 ? [] : [[[text(DIAGNOSIS_LEAD)], ...lines]];
}

function syncRunGroups(report: SyncReport | undefined): FigureGroup[] {
  if (report === undefined) {
    return [
      [[text(`${REQUESTS_LABEL} `), missing(UNKNOWN)]],
      [[missing(UNKNOWN), text(` ${NOT_REACHED_TEXT}`)]],
    ];
  }
  const { requestsBySource, notReachedCount } = report.figures;
  // `session-probe` is never rendered (AD-30).
  return [
    [
      [
        text(`${REQUESTS_LABEL} ${PRICE_SEARCHES_LABEL} `),
        figure(requestsBySource['tracked-list']),
        text(` | ${LEAGUE_CHECKS_LABEL} `),
        figure(requestsBySource['league-validation']),
      ],
    ],
    [[figure(notReachedCount), text(` ${plural(notReachedCount, 'entry', 'entries')} ${NOT_REACHED_TAIL}`)]],
  ];
}

function coverageGroup(report: SyncReport | undefined, areWeightsLoaded: boolean): FigureGroup {
  const lead = text(`${POOL_COVERAGE_LABEL} `);
  const coverage = report?.figures.coverage;
  if (coverage === undefined) {
    return [[lead, missing(areWeightsLoaded && report !== undefined ? NOT_MEASURED : UNKNOWN)]];
  }
  const classCount = report?.figures.rankableClassCount;
  const denominator = classCount === undefined ? missing(UNKNOWN) : figure(classCount);
  // An unknown denominator keeps the plural.
  const classes = plural(classCount ?? 0, 'tracked Item Class', 'tracked Item Classes');
  return [[lead, figure(`${String(coveragePercent(coverage))}%`), text(' of '), denominator, text(` ${classes}`)]];
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

function builtFromGroups(input: PanelInput): FigureGroup[] {
  const [producer, generatedAt, gamePatch] = weightsFacts(input.weights);
  const edit = trackedListEdit(input.report);
  const attribution: FigureGroup = [
    [
      text(`${WEIGHTS_FILE_LABEL} ${producer.name} `),
      valueOrUnknown(producer.value),
      text(` | ${generatedAt.name} `),
      valueOrUnknown(generatedAt.value),
      text(` | ${gamePatch.name} `),
      valueOrUnknown(gamePatch.value),
    ],
    [
      text(`${LAST_SYNCED_LABEL} `),
      valueOrUnknown(lastSynced(input.report, input.now)),
      text(` | ${TRACKED_LIST_EDITED_LABEL} `),
      valueOrUnknown(edit === undefined ? undefined : `${edit.date}${edit.suffix}`),
    ],
  ];
  const absences = ABSENCE_ORDER.filter((key) => input.absent.includes(key)).map((key) => [text(absenceLine(key))]);
  return absences.length === 0 ? [attribution] : [attribution, absences];
}

/** The panel's inputs: the published files, the load's clock, and what `web` checked at load (AD-17). */
export interface PanelInput {
  readonly report: SyncReport | undefined;
  readonly weights: WeightsEnvelope | undefined;
  readonly absent: readonly TolerableKey[];
  readonly now: number;
  readonly problems: ProblemSummary;
  readonly crossFileFailures?: readonly DiagnosisFailure[];
}

/** `Problems` · `Sync run` · `Weights coverage` · `Built from` (EXPERIENCE.md, *The sync report*). */
export function panelColumns(input: PanelInput): PanelColumns {
  const areWeightsLoaded = input.weights !== undefined;
  const problems: FigureGroup[] = input.problems.lines.length === 0 ? [] : [input.problems.lines];
  return [
    [...problems, ...diagnosisGroups(input.crossFileFailures ?? [], areWeightsLoaded)],
    syncRunGroups(input.report),
    [coverageGroup(input.report, areWeightsLoaded)],
    builtFromGroups(input),
  ];
}
