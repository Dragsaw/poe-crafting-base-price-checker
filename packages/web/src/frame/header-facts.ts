import type { Parsed } from '../load/artifacts';
import { relativeAge } from '../shared/time';
import { NOT_COMMITTED_SUFFIX } from './trust-copy';

// Every figure is read as published (AD-27). A missing value is `undefined`, which the view prints as `unknown`.

type WeightsEnvelope = Parsed<'weights'>;
type SyncReport = Parsed<'syncReport'>;

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
export function syncedAt(report: SyncReport): number {
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
