import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { retryWhenProblem, storyIds } from './ledger-rules.ts';
import { parseLedger } from './ledger.ts';

const STORIES_DIR = path.resolve(import.meta.dirname, '../../docs/stories');
const SHA = 'ce1186585cf58e2fbf2448338fe04baa0dd3000c';

function entryWith(retryWhen: string | undefined): ReturnType<typeof parseLedger>[number] {
  const line = retryWhen === undefined ? '' : `  retry_when: ${retryWhen}\n`;
  const [entry] = parseLedger(`- source_spec: a\n  summary: b\n  evidence: c\n${line}`);
  if (entry === undefined) {
    throw new Error('fixture entry did not parse');
  }
  return entry;
}

describe('storyIds', () => {
  it('reads each two-space-indented n-n- key line as an n.n story id', () => {
    const ids = storyIds('development_status:\n  epic-4: done\n  4-7-the-recipe-floor: done\n  10-12-x: review\n');
    expect([...ids]).toEqual(['4.7', '10.12']);
  });
});

describe('retryWhenProblem', () => {
  const stories = new Set(['4.7']);

  it.each([
    ['absent', undefined],
    ['never', 'never — needs a human'],
    ['full sha', `master has moved past ${SHA}`],
    ['short sha', `master has moved past ${SHA.slice(0, 7)}`],
    ['known story', 'Story 4.7 is done in sprint-status.yaml'],
  ])('accepts a %s retry_when', (_name, retryWhen) => {
    expect(retryWhenProblem(entryWith(retryWhen), stories)).toBeUndefined();
  });

  it('names the entry and the story that sprint-status.yaml does not list', () => {
    const entry = entryWith('Story 9.9 is done in sprint-status.yaml');
    const problem = retryWhenProblem(entry, stories);
    expect(problem).toContain(entry.id);
    expect(problem).toContain('Story 9.9');
  });

  it('rejects a sha shorter than 7 hex characters', () => {
    expect(retryWhenProblem(entryWith(`master has moved past ${SHA.slice(0, 6)}`), stories)).toBeDefined();
  });

  it('names the entry and lists the three forms for a planning event', () => {
    const entry = entryWith('after the restyle stories');
    const problem = retryWhenProblem(entry, stories);
    expect(problem).toContain(entry.id);
    expect(problem).toContain('`Story <n.n> is done in sprint-status.yaml`');
    expect(problem).toContain('`master has moved past <sha>`');
    expect(problem).toContain('`never — needs a human`');
  });
});

describe('the real ledger', () => {
  it('gives every entry a retry_when that a sweep can test', () => {
    const ledger = readFileSync(path.join(STORIES_DIR, 'deferred-work.md'), 'utf8');
    const stories = storyIds(readFileSync(path.join(STORIES_DIR, 'sprint-status.yaml'), 'utf8'));
    const problems = parseLedger(ledger).map((entry) => retryWhenProblem(entry, stories));
    expect(problems.filter((problem) => problem !== undefined)).toEqual([]);
  });
});
