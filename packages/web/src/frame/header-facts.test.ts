import { describe, expect, it } from 'vitest';

import { BASE_REPORT, report, WEIGHTS } from '../test-support/sync-report-fixtures';
import { NOW } from '../test-support/dom';
import { lastSynced, trackedListEdit, utcDate, weightsFacts } from './header-facts';

describe('line one', () => {
  it('reads producer, generatedAt as a UTC date, and gamePatch from the header', () => {
    expect(weightsFacts(WEIGHTS)).toEqual([
      { name: 'producer', value: 'poe-mod-weights-producer' },
      { name: 'generatedAt', value: '2026-09-26' },
      { name: 'gamePatch', value: '0.5.5' },
    ]);
  });

  it('leaves all three unknown when weights.json is absent', () => {
    expect(weightsFacts(undefined).map((fact) => fact.value)).toEqual([undefined, undefined, undefined]);
  });

  it('prints dates in UTC, never local time', () => {
    expect(utcDate('2026-09-26T23:59:59.999Z')).toBe('2026-09-26');
    expect(utcDate('2026-09-27T00:00:00Z')).toBe('2026-09-27');
  });
});

describe('line two', () => {
  it('suffixes a file-modified date with (not committed)', () => {
    const edited = report({}, { trackedListEditedAt: { source: 'file-modified', at: '2026-09-26T11:23:42.140Z' } });
    expect(trackedListEdit(edited)).toEqual({ date: '2026-09-26', suffix: ' (not committed)' });
  });

  it('prints a git-author-date bare', () => {
    const edited = report({}, { trackedListEditedAt: { source: 'git-author-date', at: '2026-08-01T10:00:00Z' } });
    expect(trackedListEdit(edited)).toEqual({ date: '2026-08-01', suffix: '' });
  });

  it('is unknown with no edit date, or with no report', () => {
    const figures = { ...BASE_REPORT.figures };
    delete figures.trackedListEditedAt;
    expect(trackedListEdit({ ...BASE_REPORT, figures })).toBeUndefined();
    expect(trackedListEdit(undefined)).toBeUndefined();
  });

  it('reads Last synced from runFinishedAt, else runStartedAt, and unknown with no report', () => {
    expect(lastSynced(report({ runStartedAt: '2026-09-26T10:00:00Z', runFinishedAt: '2026-09-26T11:19:00Z' }), NOW)).toBe(
      '41 minutes ago',
    );
    const started = report({ runStartedAt: '2026-09-26T10:00:00Z' });
    delete started.runFinishedAt;
    expect(lastSynced(started, NOW)).toBe('2 hours ago');
    expect(lastSynced(undefined, NOW)).toBeUndefined();
  });
});
