import { execFile } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import nodePath from 'node:path';
import { fileURLToPath } from 'node:url';

import { createFakeFilesystemPort } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import { main } from './check.ts';
import { crafted, trackedText } from './check.test-support.ts';

const SCRIPT = fileURLToPath(new URL('check.ts', import.meta.url));
const REPO_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const DATA_DIR = fileURLToPath(new URL('../../../../data', import.meta.url));

interface Run {
  readonly code: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

function runScript(arguments_: readonly string[] = []): Promise<Run> {
  return new Promise((done) => {
    const child = execFile(process.execPath, [SCRIPT, ...arguments_], { encoding: 'utf8' }, (_error, stdout, stderr) => {
      done({ code: child.exitCode, stdout, stderr });
    });
  });
}

/** Every path under `data/` with its size and modification time. */
function snapshot(directory: string): Record<string, string> {
  const found: Record<string, string> = {};
  for (const name of readdirSync(directory)) {
    const path = nodePath.join(directory, name);
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

  it('exits 1 with a failed cross-file check naming an unparseable weights file', async () => {
    let stdout = '';
    let stderr = '';
    const fs = createFakeFilesystemPort({
      'data/tracked.json': { contents: trackedText([crafted]) },
      'data/weights.json': { contents: '{ not json' },
    });

    const code = await main([], fs, { write: (text: string) => (stdout += text) }, { write: (text: string) => (stderr += text) });

    expect(code).toBe(1);
    expect(stderr).toBe('');
    const report = JSON.parse(stdout) as { checks: unknown[]; issues: { check: string; message: string }[] };
    expect(report.checks).toContainEqual({ check: 'cross-file', status: 'failed' });
    const issue = report.issues.find((candidate) => candidate.check === 'cross-file');
    expect(issue?.message).toMatch(/^data\/weights\.json: not valid JSON/);
  });

  it('writes nothing to disk over the committed data/', async () => {
    // The exit code over the live files is asserted by pnpm test:data.
    const before = snapshot(DATA_DIR);

    const run = await runScript();

    // The script ran to an exit: a guard over a script that never started proves nothing.
    expect(typeof run.code).toBe('number');
    expect(snapshot(DATA_DIR)).toEqual(before);
  });

  it('exits 1 with the usage on stderr when given an argument', async () => {
    const run = await runScript(['extra']);

    expect(run.code).toBe(1);
    expect(run.stdout).toBe('');
    expect(run.stderr).toContain('usage: pnpm tracked:check');
  });

  it('is reachable at the script name', () => {
    const manifest = JSON.parse(readFileSync(nodePath.join(REPO_ROOT, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };
    const script = manifest.scripts['tracked:check'];

    expect(script).toBe('node packages/sync/src/curation/check.ts');
    expect(nodePath.resolve(REPO_ROOT, (script ?? '').split(/\s+/).at(-1) ?? '')).toBe(SCRIPT);
  });
});
