import { spawnSync } from 'node:child_process';
import { type AddressInfo, createServer, type Server } from 'node:net';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_PORT, listenerPids, listenersWindows, snapshot } from './dev-stop';

/** While set, the mocked execFileSync runs the listener query against a missing cmdlet. */
const MISSING_CMDLET = 'Get-NoSuchNetTCPConnection';
const failure = vi.hoisted(() => ({ inject: false, badShape: false }));

function injectedArguments(arguments_: readonly string[]): readonly string[] {
  if (failure.inject) {
    return arguments_.map((argument) => argument.replaceAll('Get-NetTCPConnection', () => MISSING_CMDLET));
  }
  return failure.badShape
    ? arguments_.map((argument) => argument.replaceAll('ForEach-Object OwningProcess', "ForEach-Object { 'not-a-pid' }"))
    : arguments_;
}

vi.mock('node:child_process', async (importOriginal) => {
  const real = await importOriginal<typeof import('node:child_process')>();
  const execFileSync = ((file: string, arguments_: readonly string[] = [], options?: object) =>
    real.execFileSync(file, injectedArguments(arguments_), options)) as typeof real.execFileSync;
  return { ...real, execFileSync };
});

afterEach(() => {
  failure.inject = false;
  failure.badShape = false;
});

/** The POSIX reader needs lsof; Windows always has the PowerShell query. */
// eslint-disable-next-line sonarjs/no-os-command-from-path -- boundary: the probe asks whether lsof is on PATH, the same lookup the tool under test makes
const canQuery = process.platform === 'win32' || spawnSync('lsof', ['-v']).error === undefined;

describe('listenerPids', () => {
  let server: Server | undefined;

  afterEach(async () => {
    const open = server;
    server = undefined;
    if (open?.listening) {await new Promise<void>((done) => open.close(() => done()));}
  });

  it.skipIf(!canQuery)(
    'lists this process on a real loopback listener, then nothing once it closes',
    async () => {
      const open = createServer();
      server = open;
      await new Promise<void>((done) => open.listen(0, '127.0.0.1', done));
      const { port } = open.address() as AddressInfo;

      expect(listenerPids(port)).toContain(process.pid);

      await new Promise<void>((done, fail) => open.close((error) => (error ? fail(error) : done())));
      expect(listenerPids(port)).toEqual([]);
    },
    30_000,
  );
});

/** A loopback server on a free port the OS picks. */
async function listen(): Promise<Server> {
  const server = createServer();
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  return server;
}

function portOf(server: Server): number {
  return (server.address() as AddressInfo).port;
}

async function close(server: Server): Promise<void> {
  await new Promise<void>((done, fail) => server.close((error) => (error ? fail(error) : done())));
}

// Each query starts powershell.exe, which can take seconds.
const POWERSHELL_TIMEOUT_MS = 30_000;

describe.skipIf(!canQuery)('snapshot', () => {
  it(
    'reads this process as the listener of a real port, then no listener once it closes',
    async () => {
      const server = await listen();
      const port = portOf(server);
      try {
        const open = snapshot(port);
        expect(open.listeners).toContain(process.pid);
        expect(open.processes.some((entry) => entry.pid === process.pid)).toBe(true);
      } finally {
        await close(server);
      }
      expect(snapshot(port).listeners).toEqual([]);
    },
    POWERSHELL_TIMEOUT_MS,
  );
});

describe.runIf(process.platform === 'win32')('snapshot with an unreadable listener list', () => {
  it(
    'throws instead of passing a non-PID listener on',
    async () => {
      const server = await listen();
      try {
        failure.badShape = true;
        expect(() => snapshot(portOf(server))).toThrow(/unexpected listener query result/);
      } finally {
        failure.badShape = false;
        await close(server);
      }
    },
    POWERSHELL_TIMEOUT_MS,
  );
});

describe.runIf(process.platform === 'win32')('listenersWindows', () => {
  it(
    'reads a free port as no listener',
    async () => {
      const server = await listen();
      const port = portOf(server);
      await close(server);
      expect(listenersWindows(port)).toEqual([]);
    },
    POWERSHELL_TIMEOUT_MS,
  );

  it(
    'reads a listening port as the PID of its process',
    async () => {
      const server = await listen();
      try {
        expect(listenersWindows(portOf(server))).toContain(process.pid);
      } finally {
        await close(server);
      }
    },
    POWERSHELL_TIMEOUT_MS,
  );

  it(
    'fails loudly when the listener query fails, and does not read it as a free port',
    () => {
      failure.inject = true;
      let thrown: unknown;
      try {
        listenersWindows(DEFAULT_PORT);
      } catch (error) {
        thrown = error;
      }
      // stderr, not the message: it quotes the script, which names the cmdlet on a parse error.
      const stderr = String((thrown as { stderr?: unknown } | undefined)?.stderr);
      expect(stderr).toContain(MISSING_CMDLET);
      expect(stderr).toContain('CommandNotFoundException');
    },
    POWERSHELL_TIMEOUT_MS,
  );
});
