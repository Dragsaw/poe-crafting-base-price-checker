import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseLedger } from '../tools/deferred-issues/ledger.ts';

// A duplicate id from parallel branches, or an old sweep marker that puts run state back in the
// ledger (it lives in the GitHub issues), must fail here so `pnpm deferred:issues` keeps parsing.
const LEDGER = readFileSync(nodePath.resolve(import.meta.dirname, '..', 'docs/stories/deferred-work.md'), 'utf8');

describe('docs/stories/deferred-work.md', () => {
  const entries = parseLedger(LEDGER);

  it('parses every top-level source_spec bullet as an entry, so none is dropped for a missing or mis-indented field', () => {
    const bullets = LEDGER.split(/\r?\n/).filter((line) => line.startsWith('- source_spec:')).length;
    expect(entries).toHaveLength(bullets);
  });

  it('has no duplicate entry id', () => {
    const seen = new Map<string, string>();
    const duplicates: string[] = [];
    for (const entry of entries) {
      const earlier = seen.get(entry.id);
      if (earlier !== undefined) {
        duplicates.push(`${entry.id}: "${earlier}" and "${entry.summary}"`);
      }
      seen.set(entry.id, entry.summary);
    }
    expect(duplicates).toEqual([]);
  });

  it('has no auto_attempt: or integrate_branch: line, because run state lives in the issues', () => {
    const lines = LEDGER.split(/\r?\n/)
      .map((line, index) => ({ line, number: index + 1 }))
      .filter(({ line }) => /^\s*(?:-\s+)?(?:auto_attempt|integrate_branch):/.test(line))
      .map(({ line, number }) => `${number}: ${line.trim()}`);
    expect(lines).toEqual([]);
  });
});
