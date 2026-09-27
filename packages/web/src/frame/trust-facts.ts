import type { Parsed } from '../load/artifacts';
import { plural } from '../shared/text';
import { relativeAge } from '../shared/time';

/**
 * Pure formatters for `{components.trust-strip}` and
 * `{components.sync-report-panel}`. Every figure is read from the artifact as
 * published; counting records is the only derivation (AD-27). A missing value
 * is `undefined` here, and the view sets it as the italic *unknown*.
 */

type WeightsEnvelope = Parsed<'weights'>;
type SyncReport = Parsed<'syncReport'>;

export const UNKNOWN = 'unknown';
export const NOT_MEASURED = 'not measured';
export const NOT_COMMITTED_SUFFIX = ' (not committed)';

export const WEIGHTS_FILE_LABEL = 'Weights File';
export const LAST_SYNCED_LABEL = 'Last synced';
export const TRACKED_LIST_EDITED_LABEL = 'Tracked List last edited';

export const AFFORDANCE_CLOSED = '+ the full sync report';
/** U+2212, the minus sign, never a hyphen or an em dash. */
export const AFFORDANCE_OPEN = '− the full sync report';

export const PANEL_HEADINGS = ['The sync run', 'What is broken', 'What the weights cover'] as const;

export const HEALTH_STARVED = 'pinned entries starved this run';

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
export function weightsFacts(weights: WeightsEnvelope | null): readonly [WeightsFact, WeightsFact, WeightsFact] {
  return [
    { name: 'producer', value: weights?.producer.id },
    { name: 'generatedAt', value: weights === null ? undefined : utcDate(weights.producer.generatedAt) },
    { name: 'gamePatch', value: weights?.gamePatch },
  ];
}

/** `Last synced`: the run's finish, or its start on an aborted run, against the load's `now`. */
export function lastSynced(report: SyncReport | null, now: number): string | undefined {
  if (report === null) {
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

export function trackedListEdit(report: SyncReport | null): TrackedListEdit | undefined {
  const edited = report?.figures.trackedListEditedAt;
  if (edited === undefined) {
    return undefined;
  }
  return { date: utcDate(edited.at), suffix: edited.source === 'file-modified' ? NOT_COMMITTED_SUFFIX : '' };
}

function countOf(report: SyncReport, kind: SyncReport['records'][number]['kind']): number {
  return report.records.filter((record) => record.kind === kind).length;
}

/**
 * The health line's words, in order (UX-DR21). Exactly two triggers; a healthy
 * run or an absent report raises none, and no trigger ever prints a zero.
 */
export function healthSignals(report: SyncReport | null): readonly string[] {
  if (report === null) {
    return [];
  }
  const signals: string[] = [];
  const unresolvable = countOf(report, 'unresolvable');
  if (unresolvable > 0) {
    signals.push(`${unresolvable.toLocaleString('en-US')} unresolvable`);
  }
  if (report.records.some((record) => record.kind === 'pinned-starvation')) {
    signals.push(HEALTH_STARVED);
  }
  return signals;
}

// --- the panel ------------------------------------------------------------

/** A run of panel prose: plain body text, a figure in ink, or a missing figure in italic. */
export type Segment =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'figure'; readonly text: string }
  | { readonly kind: 'missing'; readonly text: string };

/** One figure group: one or more lines of segments. */
export type FigureGroup = readonly (readonly Segment[])[];

/** The three columns, in order, each a vertical stack of groups (Epic 3 adds a group to the second). */
export type PanelColumns = readonly [readonly FigureGroup[], readonly FigureGroup[], readonly FigureGroup[]];

const text = (value: string): Segment => ({ kind: 'text', text: value });
const figure = (value: number | string): Segment => ({
  kind: 'figure',
  text: typeof value === 'number' ? value.toLocaleString('en-US') : value,
});
const missing = (value: string): Segment => ({ kind: 'missing', text: value });

const UNKNOWN_GROUP: FigureGroup = [[missing(UNKNOWN)]];

/**
 * The five figure groups, from `sync-report.json` as published. The panel
 * prints only published figures: no sum, no numerator. Zeros print here; the
 * strip's no-zero rule is the strip's. An absent report leaves every group
 * *unknown*. Omitted coverage reads *not measured* when the page loaded a
 * weights envelope and *unknown* when it did not, never `0` (AD-27).
 */
export function panelColumns(report: SyncReport | null, weightsLoaded: boolean): PanelColumns {
  if (report === null) {
    return [
      [UNKNOWN_GROUP, UNKNOWN_GROUP],
      [UNKNOWN_GROUP, UNKNOWN_GROUP],
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
  const unresolvableCount = countOf(report, 'unresolvable');
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
  return [[requests, notReached], [unresolvable, starved], [coverageGroup(figures, weightsLoaded)]];
}

function coverageGroup(figures: SyncReport['figures'], weightsLoaded: boolean): FigureGroup {
  if (figures.coverage === undefined) {
    return [[missing(weightsLoaded ? NOT_MEASURED : UNKNOWN)]];
  }
  const denominator =
    figures.rankableClassCount === undefined ? missing(UNKNOWN) : figure(figures.rankableClassCount);
  // An unknown denominator keeps the plural.
  const classes = plural(figures.rankableClassCount ?? 0, 'tracked Item Class', 'tracked Item Classes');
  return [[figure(`${String(coveragePercent(figures.coverage))}%`), text(' of '), denominator, text(` ${classes}.`)]];
}

/**
 * The displayed coverage percent, with three guards: it floors the percent;
 * it lifts a non-zero fraction that floors to 0 up to 1%, so non-zero coverage
 * never reads 0%; and it caps partial coverage at 99%, so it never reads 100%.
 * The epsilon absorbs float error such as `0.29 * 100 === 28.999999999999996`,
 * which is why the 99 cap, not the floor, keeps partial coverage below 100%.
 */
function coveragePercent(coverage: number): number {
  const floored = Math.floor(coverage * 100 + 1e-9);
  if (coverage > 0 && floored === 0) {
    return 1;
  }
  return coverage < 1 ? Math.min(floored, 99) : floored;
}

/** A group as plain text, for tests and for reading. */
export function groupText(group: FigureGroup): string {
  return group.map((line) => line.map((segment) => segment.text).join('')).join('\n');
}
