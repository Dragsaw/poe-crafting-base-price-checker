import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';
import { pathToFileURL } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { isInvokedDirectly } from './is-invoked-directly.ts';

describe('isInvokedDirectly', () => {
  const originalArgv = process.argv;
  let directory = '';
  let script = '';
  let moduleUrl = '';

  beforeEach(() => {
    directory = mkdtempSync(nodePath.join(tmpdir(), 'invoked-directly-'));
    script = nodePath.join(directory, 'script.ts');
    writeFileSync(script, '');
    moduleUrl = pathToFileURL(script).href;
  });

  afterEach(() => {
    process.argv = originalArgv;
    rmSync(directory, { recursive: true, force: true });
  });

  it('is false when the process has no entry script', () => {
    process.argv = [originalArgv[0] ?? ''];

    expect(isInvokedDirectly(moduleUrl)).toBe(false);
  });

  it('is true when the entry script is the module itself', () => {
    process.argv = [originalArgv[0] ?? '', script];

    expect(isInvokedDirectly(moduleUrl)).toBe(true);
  });

  it('is false when the entry script is another file', () => {
    const other = nodePath.join(directory, 'other.ts');
    writeFileSync(other, '');
    process.argv = [originalArgv[0] ?? '', other];

    expect(isInvokedDirectly(moduleUrl)).toBe(false);
  });

  it('is false when the entry script does not exist', () => {
    process.argv = [originalArgv[0] ?? '', nodePath.join(directory, 'missing.ts')];

    expect(isInvokedDirectly(moduleUrl)).toBe(false);
  });

  it('is true when the entry script is reached through a linked directory', () => {
    const link = nodePath.join(directory, 'link');
    mkdirSync(nodePath.join(directory, 'real'));
    writeFileSync(nodePath.join(directory, 'real', 'script.ts'), '');
    symlinkSync(nodePath.join(directory, 'real'), link, 'junction');
    process.argv = [originalArgv[0] ?? '', nodePath.join(link, 'script.ts')];
    moduleUrl = pathToFileURL(nodePath.join(directory, 'real', 'script.ts')).href;

    expect(isInvokedDirectly(moduleUrl)).toBe(true);
  });
});
