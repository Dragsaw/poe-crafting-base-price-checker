import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/** `pnpm tracked:check` over the live data/ (pnpm test:data). */
const SCRIPT = fileURLToPath(new URL('./check.ts', import.meta.url));

describe('pnpm tracked:check over the live data/', () => {
  it('exits 0 and passes the cross-file check', async () => {
    const run = await new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve) => {
      const child = execFile(process.execPath, [SCRIPT], { encoding: 'utf8' }, (_error, stdout, stderr) => {
        resolve({ code: child.exitCode, stdout, stderr });
      });
    });

    expect(run.code, run.stderr).toBe(0);
    expect(run.stderr).toBe('');
    expect(JSON.parse(run.stdout)).toMatchObject({ ok: true, issues: [] });
    expect(JSON.parse(run.stdout)).toHaveProperty(
      'checks',
      expect.arrayContaining([{ check: 'cross-file', status: 'passed' }]),
    );
  });

  it('leaves no Bows entry unvalidated: the hybrid entries are covered by their pool checks', async () => {
    const run = await new Promise<{ stdout: string }>((resolve) => {
      execFile(process.execPath, [SCRIPT], { encoding: 'utf8' }, (_error, stdout) => {
        resolve({ stdout });
      });
    });

    const { unvalidated } = JSON.parse(run.stdout) as { unvalidated: { className: string }[] };
    expect(unvalidated.filter((mark) => mark.className === 'Bows')).toEqual([]);
  });
});
