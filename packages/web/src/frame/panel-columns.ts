import type { CrossFileFailure } from '@poe/core';

import type { Parsed, TolerableKey } from '../load/artifacts';
import { JOINER, plural } from '../shared/text';
import { lastSynced, trackedListEdit, weightsFacts } from './header-facts';
import type { ProblemSummary } from './problem-summary';
import { figure, type FigureGroup, type FigureLine, missing, text, valueOrUnknown } from './segments';
import {
  ABSENCE_ORDER,
  absenceLine,
  DIAGNOSIS_LEAD,
  LAST_SYNCED_LABEL,
  LEAGUE_CHECKS_LABEL,
  NOT_MEASURED,
  NOT_REACHED_TAIL,
  NOT_REACHED_TEXT,
  POOL_COVERAGE_LABEL,
  PRICE_SEARCHES_LABEL,
  REQUESTS_LABEL,
  TRACKED_LIST_EDITED_LABEL,
  UNKNOWN,
  WEIGHTS_FILE_LABEL,
} from './trust-copy';

type SyncReport = Parsed<'syncReport'>;

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
  return [failure.check, failure.entryKey, failure.detail].join(JOINER);
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
  readonly weights: Parsed<'weights'> | undefined;
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
