import { MINUTE_MS } from '@poe/core';
import { describe, expect, it } from 'vitest';

import { NOW } from '../test-support/dom';
import { CURATION, datasetWithBroken, report, starvation, type SyncReport } from '../test-support/sync-report-fixtures';
import { problemSummary } from './problem-summary';
import { syncButtonFace } from './sync-button-face';
import { NOT_SYNCED_YET } from './trust-copy';

/** A report whose run finished `minutesAgo` before `NOW`. */
function finished(minutesAgo: number): SyncReport {
  return report({
    runStartedAt: new Date(NOW - (minutesAgo + 1) * MINUTE_MS).toISOString(),
    runFinishedAt: new Date(NOW - minutesAgo * MINUTE_MS).toISOString(),
  });
}

describe('the sync button face', () => {
  const healthy = problemSummary([], undefined, CURATION);

  it('reads the compact age when healthy, and nothing else', () => {
    expect(syncButtonFace(healthy, finished(40), NOW)).toEqual({ kind: 'synced', text: 'Synced 40m ago' });
    expect(syncButtonFace(healthy, finished(0), NOW).text).toBe('Synced just now');
  });

  it('reads Not synced yet with no report and no problem', () => {
    expect(syncButtonFace(healthy, undefined, NOW)).toEqual({ kind: 'not-synced', text: NOT_SYNCED_YET });
  });

  it('puts the count in place of the age, with the kind of the summary', () => {
    const broken = problemSummary(datasetWithBroken(2), finished(40), CURATION);
    expect(syncButtonFace(broken, finished(40), NOW)).toEqual({ kind: 'problem', mark: 'broken', text: '2 problems' });
    const starved = problemSummary([], report({ records: [starvation] }), CURATION);
    expect(syncButtonFace(starved, finished(40), NOW)).toEqual({ kind: 'problem', mark: 'rough', text: '1 problem' });
    const both = problemSummary(datasetWithBroken(998), report({ records: [starvation] }), CURATION);
    expect(syncButtonFace(both, undefined, NOW).text).toBe('999 problems');
  });
});
