import type { LedgerEntry } from './ledger.ts';

// The three forms are word for word the ones of `.claude/skills/deferred-work-sweep/SKILL.md` §5.2.

const STORY_FORM = /^Story (\d+\.\d+) is done in sprint-status\.yaml$/;
const SHA_FORM = /^master has moved past [0-9a-f]{7,40}$/;
const NEVER_FORM = 'never — needs a human';
const STORY_KEY = /^ {2}(\d+)-(\d+)-/;

const FORMS =
  '`Story <n.n> is done in sprint-status.yaml`, `master has moved past <sha>` or `never — needs a human`';

/** Each story id (`4.7`) that a two-space-indented `n-n-` key line of `sprint-status.yaml` names. */
export function storyIds(sprintStatus: string): Set<string> {
  const ids = new Set<string>();
  for (const line of sprintStatus.split(/\r?\n/)) {
    const key = STORY_KEY.exec(line);
    if (key !== null) {
      ids.add(`${key[1] ?? ''}.${key[2] ?? ''}`);
    }
  }
  return ids;
}

/** Why the entry's `retry_when` is one a sweep cannot test, or `undefined` when it can. */
export function retryWhenProblem(entry: LedgerEntry, stories: ReadonlySet<string>): string | undefined {
  const retryWhen = entry.retryWhen;
  if (retryWhen === undefined || retryWhen === NEVER_FORM || SHA_FORM.test(retryWhen)) {
    return undefined;
  }
  const story = STORY_FORM.exec(retryWhen)?.[1];
  if (story === undefined) {
    return `${entry.id} "${entry.title}": retry_when "${retryWhen}" is not one of ${FORMS}`;
  }
  return stories.has(story)
    ? undefined
    : `${entry.id} "${entry.title}": retry_when names Story ${story}, which sprint-status.yaml does not list`;
}
