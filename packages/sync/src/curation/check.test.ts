import { execFile } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ConfigFileSchema, createFakeFilesystemPort } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import type { CatalogueIds } from '../catalogue/catalogue-ids.ts';
import { checkTracked, loadTrackedCheckInputs, main, PENDING_CHECKS } from './check.ts';
import type { TrackedCheckInputs } from './check.ts';

const SCRIPT = fileURLToPath(new URL('./check.ts', import.meta.url));
const REPO_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const DATA_DIR = fileURLToPath(new URL('../../../../data', import.meta.url));

const PREFIX_STAT = 'explicit.stat_3981240776';
const SUFFIX_STAT = 'explicit.stat_124131830';

const CATALOGUE: CatalogueIds = {
  statIds: new Set([PREFIX_STAT, SUFFIX_STAT]),
  baseTypeIds: new Set(['Gold Amulet', 'Solar Amulet']),
  categoryIds: new Set(['accessory.amulet']),
};

const crafted = {
  kind: 'crafted',
  categoryId: 'accessory.amulet',
  className: 'Amulets',
  itemLevelMin: 75,
  prefix: { kind: 'banded', statId: PREFIX_STAT, valueMin: 47, valueMax: 50, acceptedTier: 'T1' },
  suffix: { kind: 'banded', statId: SUFFIX_STAT, valueMin: 3, valueMax: 3, acceptedTier: 'T1' },
  status: 'active',
};
const gold = { kind: 'raw', baseTypeId: 'Gold Amulet', itemLevelMin: 82, status: 'active' };
const solar = { kind: 'raw', baseTypeId: 'Solar Amulet', itemLevelMin: 82, status: 'active' };

function trackedText(entries: readonly unknown[], schemaVersion = '1.0.0'): string {
  return JSON.stringify({ schemaVersion, entries });
}

function inputsOf(entries: readonly unknown[], overrides: Partial<TrackedCheckInputs> = {}): TrackedCheckInputs {
  return {
    tracked: trackedText(entries),
    config: {
      ok: true,
      value: ConfigFileSchema.parse({ schemaVersion: '1.0.0', league: 'Test League', minChunkSearches: 2 }),
    },
    catalogue: { ok: true, value: CATALOGUE },
    ...overrides,
  };
}

describe('checkTracked', () => {
  it('passes a valid list: every check passed, the cross-file checks pending', () => {
    const report = checkTracked(inputsOf([crafted, gold, solar]));

    expect(report).toEqual({
      ok: true,
      checks: [
        { check: 'schema', status: 'passed' },
        { check: 'pinned-cap', status: 'passed' },
        { check: 'catalogue', status: 'passed' },
      ],
      issues: [],
      pending: ['five cross-file checks (Story 3.3)'],
    });
    expect(PENDING_CHECKS).toEqual(report.pending);
  });

  it('reports a schema issue at its path and skips the checks that need entries', () => {
    const statusless = { kind: 'raw', baseTypeId: 'Gold Amulet', itemLevelMin: 82 };
    const report = checkTracked(inputsOf([crafted, statusless]));

    expect(report.ok).toBe(false);
    expect(report.checks).toEqual([
      { check: 'schema', status: 'failed' },
      { check: 'pinned-cap', status: 'skipped' },
      { check: 'catalogue', status: 'skipped' },
    ]);
    expect(report.issues.length).toBeGreaterThan(0);
    for (const issue of report.issues) {
      expect(issue.check).toBe('schema');
      expect(issue.path).toMatch(/^entries\.1/);
    }
  });

  it('reports a repeated canonical key at the repeat, naming the first occurrence', () => {
    const report = checkTracked(inputsOf([gold, solar, { ...gold, status: 'pinned' }]));

    expect(report.ok).toBe(false);
    expect(report.issues).toEqual([
      { check: 'schema', path: 'entries.2', message: expect.stringContaining('repeats entries.0') as unknown },
    ]);
  });

  it('refuses an unknown major as one schemaVersion issue', () => {
    const report = checkTracked(inputsOf([], { tracked: trackedText([], '2.0.0') }));

    expect(report.ok).toBe(false);
    expect(report.issues).toEqual([
      { check: 'schema', path: 'schemaVersion', message: expect.stringContaining('unknown-major') as unknown },
    ]);
  });

  it('reports text that is not JSON', () => {
    const report = checkTracked(inputsOf([], { tracked: '{ not json' }));

    expect(report.issues).toEqual([
      { check: 'schema', message: expect.stringContaining('data/tracked.json: not valid JSON') as unknown },
    ]);
  });

  it('reports a pinned set over the cap (0.5 × minChunkSearches)', () => {
    const report = checkTracked(inputsOf([{ ...gold, status: 'pinned' }, { ...solar, status: 'pinned' }]));

    expect(report.ok).toBe(false);
    expect(report.checks).toContainEqual({ check: 'pinned-cap', status: 'failed' });
    expect(report.checks).toContainEqual({ check: 'catalogue', status: 'passed' });
    expect(report.issues).toEqual([
      { check: 'pinned-cap', message: expect.stringContaining('exceed the cap of 1') as unknown },
    ]);
  });

  it('reports each id absent from the catalogue as one issue at its entry', () => {
    const missing = { ...crafted, categoryId: 'accessory.nope', prefix: { ...crafted.prefix, statId: 'explicit.stat_0' } };
    const report = checkTracked(inputsOf([gold, missing, { ...solar, baseTypeId: 'Nope Amulet' }]));

    expect(report.ok).toBe(false);
    expect(report.checks).toContainEqual({ check: 'catalogue', status: 'failed' });
    expect(report.issues.map((issue) => [issue.check, issue.path])).toEqual([
      ['catalogue', 'entries.1'],
      ['catalogue', 'entries.1'],
      ['catalogue', 'entries.2'],
    ]);
    expect(report.issues[0]?.message).toContain('categoryId accessory.nope');
    expect(report.issues[1]?.message).toContain('statId explicit.stat_0');
    expect(report.issues[2]?.message).toContain('baseTypeId Nope Amulet');
  });

  it('does not check a pruned entry against the catalogue', () => {
    const report = checkTracked(inputsOf([{ ...solar, baseTypeId: 'Nope Amulet', status: 'pruned', prunedReason: 'x' }]));

    expect(report.ok).toBe(true);
  });

  it('reports an absent tracked file, config file and first catalogue file by name', async () => {
    const report = checkTracked(await loadTrackedCheckInputs(createFakeFilesystemPort({})));

    expect(report.ok).toBe(false);
    expect(report.checks).toEqual([
      { check: 'schema', status: 'failed' },
      { check: 'pinned-cap', status: 'failed' },
      { check: 'catalogue', status: 'failed' },
    ]);
    expect(report.issues.map((issue) => issue.message)).toEqual([
      'data/tracked.json: the file is absent',
      'data/config.json: the file is absent',
      'data/catalogue/stats.json: the file is absent',
    ]);
  });
});

interface Run {
  readonly code: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

function runScript(args: readonly string[] = []): Promise<Run> {
  return new Promise((done) => {
    const child = execFile(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' }, (_error, stdout, stderr) => {
      done({ code: child.exitCode, stdout, stderr });
    });
  });
}

/** Every path under `data/` with its size and modification time. */
function snapshot(directory: string): Record<string, string> {
  const found: Record<string, string> = {};
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    const stats = statSync(path);
    if (stats.isDirectory()) {
      Object.assign(found, snapshot(path));
    } else {
      found[path] = `${String(stats.size)}:${String(stats.mtimeMs)}`;
    }
  }
  return found;
}

describe('pnpm tracked:check', () => {
  it('exits 1 with an ok:false report on stdout for a failing input', async () => {
    let stdout = '';
    let stderr = '';
    const fs = createFakeFilesystemPort({ 'data/tracked.json': { contents: '{ not json' } });

    const code = await main([], fs, { write: (text: string) => (stdout += text) }, { write: (text: string) => (stderr += text) });

    expect(code).toBe(1);
    expect(stderr).toBe('');
    expect(JSON.parse(stdout)).toMatchObject({ ok: false, issues: expect.arrayContaining([expect.objectContaining({ check: 'schema' })]) as unknown });
  });

  it('exits 0 over the committed data/ and writes nothing to disk', async () => {
    const before = snapshot(DATA_DIR);

    const run = await runScript();

    expect(run.code, run.stderr).toBe(0);
    expect(run.stderr).toBe('');
    expect(JSON.parse(run.stdout)).toMatchObject({ ok: true, issues: [], pending: PENDING_CHECKS });
    expect(snapshot(DATA_DIR)).toEqual(before);
  });

  it('exits 1 with the usage on stderr when given an argument', async () => {
    const run = await runScript(['extra']);

    expect(run.code).toBe(1);
    expect(run.stdout).toBe('');
    expect(run.stderr).toContain('usage: pnpm tracked:check');
  });

  it('is reachable at the script name', () => {
    const manifest = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };
    const script = manifest.scripts['tracked:check'];

    expect(script).toBe('node packages/sync/src/curation/check.ts');
    expect(resolve(REPO_ROOT, (script ?? '').split(/\s+/).at(-1) ?? '')).toBe(SCRIPT);
  });
});
