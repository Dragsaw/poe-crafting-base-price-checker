import { readFileSync } from 'node:fs';
import nodePath from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalKey, compareCanonicalKeys, DatasetFileSchema } from '@poe/contracts';
import type { TrackedEntry } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import { dryRun, readRepositorySnapshot } from '../dry-run.ts';
import type { DryRunSnapshot } from '../dry-run.ts';
import { FIXTURE_WORKLOAD_PATH } from '../pricing/fixture-names.ts';

const REPO_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const FROZEN_DATA_DIR = fileURLToPath(new URL('../../../../test/fixtures/frozen-data', import.meta.url));

describe('dryRun: the repository snapshot and its recorded fixtures', () => {
  it('prices every non-pruned entry of the fixture workload from the recorded captures', async () => {
    // The real inputs, with the fixture workload for the tracked list. The
    // real dataset, report and progress describe the real list, so they are
    // left out: every workload entry is never attempted.
    const workload: DryRunSnapshot = {
      ...(await readRepositorySnapshot(FROZEN_DATA_DIR)),
      tracked: readFileSync(nodePath.join(REPO_ROOT, FIXTURE_WORKLOAD_PATH), 'utf8'),
      dataset: undefined,
      report: undefined,
      progress: undefined,
    };
    const tracked = JSON.parse(workload.tracked ?? '{"entries":[]}') as { entries: TrackedEntry[] };
    const active = tracked.entries.filter((entry) => entry.status !== 'pruned');
    expect(active.length).toBeGreaterThan(0);

    const report = await dryRun(workload);

    expect(report.outcome).toBe('completed');
    expect(report.entries).toHaveLength(active.length);
    expect(new Set(report.entries.map((entry) => entry.entryKey))).toEqual(new Set(active.map((entry) => canonicalKey(entry))));
    for (const entry of report.entries) {
      expect(entry.price.state, entry.entryKey).toBe('priced');
    }
    // Every tracked id resolves against the committed catalogue.
    expect(report.report?.records.filter((record) => record.kind === 'unresolvable')).toEqual([]);
    // weights.json is committed, so its absence is not recorded.
    expect(report.report?.records.some((record) => record.kind === 'weights-absent')).toBe(false);
    // The published dataset holds every tracked entry, pruned ones included.
    expect(report.dataset).not.toBeNull();
    expect(DatasetFileSchema.safeParse(report.dataset).success).toBe(true);
    expect(report.dataset?.entries.map((entry) => entry.entryKey)).toEqual(
      [...new Set(tracked.entries.map((entry) => canonicalKey(entry)))].toSorted(compareCanonicalKeys),
    );
    expect(report).not.toHaveProperty('unrecorded');
  });

  it('runs the real tracked list to completion: each visited entry is priced or listed as unrecorded', async () => {
    const report = await dryRun(await readRepositorySnapshot(FROZEN_DATA_DIR));

    expect(report.outcome).toBe('completed');
    const unrecorded = new Set(report.unrecorded);
    const priced = report.entries.map((entry) => entry.entryKey);
    expect(priced.filter((key) => unrecorded.has(key))).toEqual([]);
    expect(new Set([...priced, ...unrecorded])).toEqual(new Set(report.completed));
  });
});
