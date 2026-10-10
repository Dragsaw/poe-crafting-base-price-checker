import type { Parsed } from '../load/artifacts';
import { plural } from '../shared/text';
import { compactAge } from '../shared/time';
import { syncedAt } from './header-facts';
import type { ProblemSummary } from './problem-summary';
import { count, type ProblemMark } from './segments';
import { NOT_SYNCED_YET, SYNCED_LABEL } from './trust-copy';

/** What the sync button prints: the problem count in place of the age, never both (state 31). */
export type SyncButtonFace =
  | { readonly kind: 'problem'; readonly mark: ProblemMark; readonly text: string }
  | { readonly kind: 'synced'; readonly text: string }
  | { readonly kind: 'not-synced'; readonly text: string };

export function syncButtonFace(problems: ProblemSummary, report: Parsed<'syncReport'> | undefined, now: number): SyncButtonFace {
  if (problems.kind !== undefined) {
    const total = problems.broken + problems.starved;
    return { kind: 'problem', mark: problems.kind, text: `${count(total)} ${plural(total, 'problem', 'problems')}` };
  }
  return report === undefined
    ? { kind: 'not-synced', text: NOT_SYNCED_YET }
    : { kind: 'synced', text: `${SYNCED_LABEL} ${compactAge(now - syncedAt(report))}` };
}
