import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { OPS_PI, type RunResult, Sandbox } from './pi-tick-sandbox.ts';

const SET_POESESSID = path.join(OPS_PI, 'set-poesessid.sh');

describe.skipIf(process.platform === 'win32')('ops/pi/set-poesessid.sh', () => {
  let sandbox: Sandbox;
  let host = '';

  const environmentFile = (): string => path.join(host, '.env');
  const readEnvironment = (): string => readFileSync(environmentFile(), 'utf8');
  const setSession = (value: string, environment: NodeJS.ProcessEnv = {}): RunResult =>
    sandbox.run('bash', [SET_POESESSID, host], { env: environment, input: `${value}\n` });

  beforeEach(() => {
    sandbox = new Sandbox();
    host = path.join(sandbox.work, 'host');
    mkdirSync(host);
  });

  afterEach(() => {
    sandbox.dispose();
  });

  it('replaces only the POESESSID line, never prints the value, and restarts poe-sync', () => {
    writeFileSync(environmentFile(), 'POE_SYNC_USER_AGENT=ua-line\n# comment\nPOESESSID=old\nOTHER=x\n');
    const result = setSession('newsecretvalue');
    expect(result.status, result.output).toBe(0);
    expect(readEnvironment()).toBe('POE_SYNC_USER_AGENT=ua-line\n# comment\nPOESESSID=newsecretvalue\nOTHER=x\n');
    expect(result.output).not.toContain('newsecretvalue');
    expect(statSync(environmentFile()).mode & 0o777).toBe(0o600);
    expect(readdirSync(host)).toEqual(['.env']);
    expect(sandbox.fakeLog()).toContain('systemctl try-restart --no-block poe-sync.service');
  });

  it('adds the line when .env has none', () => {
    writeFileSync(environmentFile(), 'POE_SYNC_USER_AGENT=ua-line');
    expect(setSession('added').status).toBe(0);
    expect(readEnvironment()).toBe('POE_SYNC_USER_AGENT=ua-line\nPOESESSID=added\n');
  });

  it('creates a missing .env holding only POESESSID, with mode 600 and a warning on stderr', () => {
    const result = setSession('created');
    expect(result.status, result.output).toBe(0);
    expect(readEnvironment()).toBe('POESESSID=created\n');
    expect(statSync(environmentFile()).mode & 0o777).toBe(0o600);
    expect(result.stderr).toContain('add POE_SYNC_USER_AGENT');
  });

  it('refuses an empty value and leaves .env unchanged', () => {
    writeFileSync(environmentFile(), 'POESESSID=kept\n');
    expect(setSession('').status).toBe(1);
    expect(readEnvironment()).toBe('POESESSID=kept\n');
    expect(sandbox.fakeLog()).toEqual([]);
  });

  it('refuses a value with whitespace, leaves .env unchanged and never prints the value', () => {
    writeFileSync(environmentFile(), 'POESESSID=kept\n');
    const result = setSession('refusedsecret part');
    expect(result.status).toBe(1);
    expect(readEnvironment()).toBe('POESESSID=kept\n');
    expect(result.output).not.toContain('refusedsecret');
    expect(sandbox.fakeLog()).toEqual([]);
  });

  it.each(['activating', 'active'])('skips the restart while the tick is %s', (state) => {
    writeFileSync(environmentFile(), 'POESESSID=old\n');
    expect(setSession('during-tick', { FAKE_TICK_STATE: state }).status).toBe(0);
    expect(readEnvironment()).toBe('POESESSID=during-tick\n');
    expect(sandbox.fakeLog().some((line) => line.includes('try-restart'))).toBe(false);
  });
});
