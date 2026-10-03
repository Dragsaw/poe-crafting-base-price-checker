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
});
