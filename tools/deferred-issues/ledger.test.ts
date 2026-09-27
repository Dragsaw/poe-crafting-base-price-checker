import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { FIXTURE_LEDGER } from './fixture.ts';
import { entryId, issueTitle, parseLedger, TITLE_MAX } from './ledger.ts';

describe('parseLedger', () => {
  const entries = parseLedger(FIXTURE_LEDGER);

  it('takes each top-level source_spec bullet with summary and evidence, in ledger order', () => {
    expect(entries.map((entry) => entry.summary.slice(0, 30))).toEqual([
      "A 429's `retryAfterMs` is not ",
      'The spine edit that story 1.9 ',
      'Once a git remote exists, hard',
      'Lower-severity seam findings f',
      '"[NOTE FOR UX] Copy with no ow',
      '"Note. `packages/web/vite.conf',
    ]);
  });

  it('leaves out a note with no source_spec, and a resolved_by bullet', () => {
    expect(entries.some((entry) => entry.summary.includes('retired'))).toBe(false);
    expect(entries.some((entry) => entry.sourceSpec.startsWith('PRD FR-18'))).toBe(false);
  });

  it('joins a multi-line summary with nested bullets into one value with single spaces', () => {
    const seam = entries[3];
    expect(seam?.summary).toBe(
      "Lower-severity seam findings from the epic 2 diff review. None is reached by today's data: - no error boundary, so a render throw gives a blank page (`App.tsx:122-135`) - no fetch timeout, so a hung request keeps the skeleton indefinitely (`load/load-artifacts.ts:68-89`)",
    );
    expect(seam?.evidence.startsWith('Retro F18.')).toBe(true);
  });

  it('keeps a human-written retry_when as the precondition', () => {
    expect(entries[2]?.retryWhen).toBe('A git remote is configured and `deploy.yml` has run once.');
    expect(entries[0]?.retryWhen).toBeUndefined();
  });

  it('keeps the value verbatim, quotes included', () => {
    expect(entries[5]?.summary).toBe('"Note. `packages/web/vite.config.ts` still has a comment that says \\"eight\\" artifacts."');
    expect(entries[0]?.sourceSpec).toBe('`docs/stories/spec-1-11-league-validation-as-a-run-start-gate.md`');
  });

  it('ends an entry at a blank line, so a later indented line is not a field of it', () => {
    const [entry] = parseLedger('- source_spec: a\n  summary: b\n  evidence: c\n\n  summary: stray\n');
    expect(entry?.summary).toBe('b');
  });

  it('parses CRLF line endings the same way', () => {
    expect(parseLedger(FIXTURE_LEDGER.replaceAll('\n', '\r\n'))).toEqual(entries);
  });

  it('gives each entry its content id', () => {
    for (const entry of entries) {
      expect(entry.id).toBe(entryId(entry.sourceSpec, entry.summary));
    }
  });
});

describe('entryId', () => {
  it('is dw- and the first 10 hex characters of sha256(sourceSpec + newline + summary)', () => {
    const digest = createHash('sha256').update('spec\nsummary').digest('hex');
    expect(entryId('spec', 'summary')).toBe(`dw-${digest.slice(0, 10)}`);
    expect(entryId('spec', 'summary')).toMatch(/^dw-[0-9a-f]{10}$/);
  });

  it('changes when the summary is edited', () => {
    expect(entryId('spec', 'summary')).not.toBe(entryId('spec', 'summary edited'));
  });
});

describe('issueTitle', () => {
  it('removes each double quote', () => {
    expect(issueTitle('"[NOTE FOR UX] short"')).toBe('[NOTE FOR UX] short');
  });

  it('keeps a summary of at most 70 characters whole', () => {
    const text = 'a'.repeat(TITLE_MAX);
    expect(issueTitle(text)).toBe(text);
  });

  it('cuts a longer summary at a word boundary to at most 70 characters', () => {
    const title = issueTitle(parseLedger(FIXTURE_LEDGER)[3]?.summary ?? '');
    expect(title.length).toBeLessThanOrEqual(TITLE_MAX);
    expect(title).toBe('Lower-severity seam findings from the epic 2 diff review. None is');
  });

  it('cuts a word longer than 70 characters hard', () => {
    expect(issueTitle('x'.repeat(100))).toBe('x'.repeat(TITLE_MAX));
  });
});
