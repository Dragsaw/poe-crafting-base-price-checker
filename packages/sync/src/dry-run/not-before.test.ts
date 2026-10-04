import { describe, expect, it } from 'vitest';

import { dryRun } from '../dry-run.ts';
import { entries, snapshotOf } from './test-support.ts';

describe('dryRun: notBefore', () => {
  it('surfaces the real sync-progress.json’s notBefore without deferring the run', async () => {
    const progress = JSON.stringify({
      completed: [],
      notBefore: '2099-01-01T00:00:00.000Z',
      schemaVersion: '1.1.0',
    });
    const report = await dryRun(snapshotOf(entries, { progress }));
    expect(report.notBefore).toBe('2099-01-01T00:00:00.000Z');
    expect(report.outcome).toBe('completed');
  });

  it('omits notBefore when the snapshot carries no progress file', async () => {
    const report = await dryRun(snapshotOf(entries));
    expect(report.notBefore).toBeUndefined();
  });

  it('refuses an invalid progress file loudly, naming the file', async () => {
    await expect(dryRun(snapshotOf(entries, { progress: '{"schemaVersion":"9.0.0"}' }))).rejects.toThrow(
      /sync-progress\.json/,
    );
  });
});
