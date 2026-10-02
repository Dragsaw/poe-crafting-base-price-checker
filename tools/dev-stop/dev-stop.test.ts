import { spawnSync } from 'node:child_process';
import { type AddressInfo, createServer, type Server } from 'node:net';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_PORT,
  listenerPids,
  listenersWindows,
  ownAncestry,
  parseListenerJson,
  parsePort,
  planStop,
  type ProcessInfo,
  snapshot,
} from './dev-stop';

/** While set, the mocked execFileSync runs the listener query against a cmdlet that does not exist. */
const MISSING_CMDLET = 'Get-NoSuchNetTCPConnection';
const failure = vi.hoisted(() => ({ inject: false, badShape: false }));

vi.mock('node:child_process', async (importOriginal) => {
  const real = await importOriginal<typeof import('node:child_process')>();
  const execFileSync = ((file: string, args: readonly string[] = [], options?: object) =>
    real.execFileSync(
      file,
      failure.inject
        ? args.map((arg) => arg.replaceAll('Get-NetTCPConnection', MISSING_CMDLET))
        : failure.badShape
          ? args.map((arg) => arg.replaceAll('ForEach-Object OwningProcess', "ForEach-Object { 'not-a-pid' }"))
          : args,
      options,
    )) as typeof real.execFileSync;
  return { ...real, execFileSync };
});

afterEach(() => {
  failure.inject = false;
  failure.badShape = false;
});

const ROOT = 'E:\\Projects\\poe';
const NONE = new Set<number>();

/** The chain observed under a background `pnpm dev` on Windows, harness shell included. */
const CHAIN: readonly ProcessInfo[] = [
  { pid: 1, ppid: 0, commandLine: 'C:\\Users\\me\\.local\\bin\\claude.exe' },
  { pid: 10, ppid: 1, commandLine: 'bash -c "pnpm dev --port 5199"' },
  { pid: 11, ppid: 10, commandLine: '"C:\\Program Files\\Git\\usr\\bin\\sh.exe" /c/Users/me/npm/pnpm dev --port 5199' },
  { pid: 12, ppid: 11, commandLine: 'C:\\Users\\me\\npm\\node_modules\\pnpm\\pnpm.exe dev --port 5199' },
  { pid: 13, ppid: 12, commandLine: 'cmd.exe /d /c ""C:\\pnpm\\12.5.1\\bin\\pnpm.cmd" dev --port 5199"' },
  { pid: 14, ppid: 13, commandLine: '"C:\\pnpm\\12.5.1\\pnpm.exe" dev --port 5199' },
  { pid: 15, ppid: 14, commandLine: 'cmd.exe /d /s /c vite --config packages/web/vite.config.ts "--port" "5199"' },
  {
    pid: 16,
    ppid: 15,
    commandLine: 'node "E:\\Projects\\poe\\node_modules\\.bin\\\\..\\vite\\bin\\vite.js" --config packages/web/vite.config.ts',
  },
];

describe('parsePort', () => {
  it('defaults to the vite.config.ts port', () => {
    expect(parsePort([])).toBe(DEFAULT_PORT);
  });

  it('reads --port <n> and --port=<n>', () => {
    expect(parsePort(['--port', '5199'])).toBe(5199);
    expect(parsePort(['--port=5174'])).toBe(5174);
  });

  it('rejects a port that is not an integer in range', () => {
    expect(() => parsePort(['--port'])).toThrow(/--port/);
    expect(() => parsePort(['--port', 'abc'])).toThrow(/"abc"/);
    expect(() => parsePort(['--port=70000'])).toThrow(/"70000"/);
  });
});

describe('planStop', () => {
  it('is idle when nothing listens', () => {
    expect(planStop([], CHAIN, ROOT, NONE)).toEqual({ kind: 'idle' });
  });

  it('climbs from Vite to pnpm dev and no higher', () => {
    expect(planStop([16], CHAIN, ROOT, NONE)).toEqual({ kind: 'kill', roots: [14] });
  });

  it('stops at the script shell when pnpm dev is gone and its PID is free', () => {
    const orphaned = CHAIN.filter((info) => info.pid !== 14);
    expect(planStop([16], orphaned, ROOT, NONE)).toEqual({ kind: 'kill', roots: [15] });
  });

  it('climbs a POSIX chain through sh -c vite to pnpm dev', () => {
    // `ps -o args=` prints argv joined by spaces, with no quotes.
    const posix: ProcessInfo[] = [
      { pid: 50, ppid: 1, commandLine: 'node /home/me/.local/share/pnpm/pnpm.cjs dev' },
      { pid: 51, ppid: 50, commandLine: 'sh -c vite --config packages/web/vite.config.ts' },
      { pid: 52, ppid: 51, commandLine: 'node /home/me/poe/node_modules/.bin/../vite/bin/vite.js --config packages/web/vite.config.ts' },
    ];
    expect(planStop([52], posix, '/home/me/poe', NONE)).toEqual({ kind: 'kill', roots: [50] });
  });

  it('reads the real Windows forms: quoted cmd.exe path, extra cmd switches, pnpm store path', () => {
    const real = CHAIN.map((info) => {
      if (info.pid === 15) return { ...info, commandLine: '"C:\\WINDOWS\\system32\\cmd.exe" /d /s /c vite --config x' };
      if (info.pid === 14) return { ...info, commandLine: '"C:\\pnpm\\bin\\\\..\\node_modules\\pnpm\\pnpm.exe"   dev --port 5199' };
      return info;
    });
    expect(planStop([16], real, ROOT, NONE)).toEqual({ kind: 'kill', roots: [14] });
  });

  it('accepts pnpm run dev and node running pnpm.cjs dev as the root', () => {
    for (const commandLine of ['pnpm run dev', 'node C:\\npm\\pnpm\\bin\\pnpm.cjs dev', 'node --no-warnings pnpm.mjs run dev']) {
      const chain = CHAIN.map((info) => (info.pid === 14 ? { ...info, commandLine } : info));
      expect(planStop([16], chain, ROOT, NONE)).toEqual({ kind: 'kill', roots: [14] });
    }
  });

  it('stops at the first pnpm dev even when its parent also looks like pnpm dev', () => {
    const nested = CHAIN.map((info) => (info.pid === 13 ? { ...info, commandLine: 'pnpm dev --port 5199' } : info));
    expect(planStop([16], nested, ROOT, NONE)).toEqual({ kind: 'kill', roots: [14] });
  });

  it('never climbs into a shell that runs pnpm dev beside other commands', () => {
    for (const commandLine of ['bash -c "pnpm dev & pnpm test"', 'cmd /c "pnpm dev && pnpm test"', 'cmd.exe /d /s /c vite & pnpm test']) {
      // The shell is the script shell's parent: no pnpm dev between it and Vite.
      const chain: ProcessInfo[] = [
        { pid: 30, ppid: 1, commandLine },
        { pid: 15, ppid: 30, commandLine: 'cmd.exe /d /s /c vite --config packages/web/vite.config.ts' },
        CHAIN.find((info) => info.pid === 16)!,
      ];
      expect(planStop([16], chain, ROOT, NONE)).toEqual({ kind: 'kill', roots: [15] });
    }
  });

  it('never climbs into a shell whose vite command is followed by another on a new line', () => {
    const chain: ProcessInfo[] = [
      { pid: 30, ppid: 1, commandLine: 'sh -c vite --config packages/web/vite.config.ts\npnpm test' },
      { ...CHAIN.find((info) => info.pid === 16)!, ppid: 30 },
    ];
    expect(planStop([16], chain, ROOT, NONE)).toEqual({ kind: 'kill', roots: [16] });
  });

  it('does not take a workspace runner such as pnpm -r --parallel dev as the root', () => {
    const recursive: ProcessInfo[] = [
      { pid: 40, ppid: 1, commandLine: 'bash -c "pnpm -r --parallel dev"' },
      { pid: 41, ppid: 40, commandLine: 'C:\\pnpm\\pnpm.exe -r --parallel dev' },
      { pid: 15, ppid: 41, commandLine: 'cmd.exe /d /s /c vite --config packages/web/vite.config.ts' },
      CHAIN.find((info) => info.pid === 16)!,
    ];
    expect(planStop([16], recursive, ROOT, NONE)).toEqual({ kind: 'kill', roots: [15] });
    const filtered = recursive.map((info) =>
      info.pid === 41 ? { ...info, commandLine: 'pnpm --filter @poe/web dev' } : info,
    );
    expect(planStop([16], filtered, ROOT, NONE)).toEqual({ kind: 'kill', roots: [15] });
  });

  it('stops below a reused PID whose process started after its child', () => {
    // Each process started in PID order; pnpm 14 is gone, and Windows gave its
    // PID to another checkout's later `pnpm dev`.
    const timed = CHAIN.map((info) => ({ ...info, started: info.pid * 1000 }));
    const reused = timed.map((info) =>
      info.pid === 14 ? { pid: 14, ppid: 1, commandLine: 'pnpm dev', started: 99_000 } : info,
    );
    expect(planStop([16], reused, ROOT, NONE)).toEqual({ kind: 'kill', roots: [15] });
  });

  it('ends the climb on a ppid cycle', () => {
    // A reused PID 16 as the script shell's ppid closes the loop 16 → 15 → 16.
    const cyclic = CHAIN.map((info) => (info.pid === 15 ? { ...info, ppid: 16 } : info));
    expect(planStop([16], cyclic, ROOT, NONE)).toEqual({ kind: 'kill', roots: [15] });
  });

  it('stops at a parent that is not part of a pnpm dev chain', () => {
    const interactive = CHAIN.map((info) => (info.pid === 14 ? { ...info, commandLine: 'bash --login -i' } : info));
    expect(planStop([16], interactive, ROOT, NONE)).toEqual({ kind: 'kill', roots: [15] });
  });

  it('never climbs into a protected PID', () => {
    expect(planStop([16], CHAIN, ROOT, new Set([14]))).toEqual({ kind: 'kill', roots: [15] });
  });

  it('matches the checkout path case- and separator-insensitively', () => {
    expect(planStop([16], CHAIN, 'e:/projects/POE', NONE)).toMatchObject({ kind: 'kill' });
  });

  it("refuses another worktree's Vite", () => {
    expect(planStop([16], CHAIN, 'E:\\Projects\\poe-other', NONE)).toMatchObject({
      kind: 'refuse',
      reason: expect.stringContaining('PID 16 is not this checkout'),
    });
  });

  it('refuses a listener that is not Vite', () => {
    const other = [{ pid: 50, ppid: 1, commandLine: 'E:\\Projects\\poe\\node_modules\\x\\server.exe' }];
    expect(planStop([50], other, ROOT, NONE)).toMatchObject({ kind: 'refuse' });
  });

  it('refuses a listener missing from the process table', () => {
    expect(planStop([99], CHAIN, ROOT, NONE)).toMatchObject({
      kind: 'refuse',
      reason: expect.stringContaining('PID 99'),
    });
  });
});

describe('ownAncestry', () => {
  it('protects the caller and every live ancestor', () => {
    expect(ownAncestry(CHAIN, 13)).toEqual(new Set([13, 12, 11, 10, 1, 0]));
  });

  it('ends on a ppid cycle', () => {
    const cyclic = [
      { pid: 5, ppid: 6, commandLine: 'a' },
      { pid: 6, ppid: 5, commandLine: 'b' },
    ];
    expect(ownAncestry(cyclic, 5)).toEqual(new Set([5, 6]));
  });

  it('keeps a dev:stop run from inside the chain from killing its caller', () => {
    // dev:stop runs as a child of the pnpm at 14, so the climb stops below it.
    const inside = [...CHAIN, { pid: 20, ppid: 14, commandLine: 'node tools/dev-stop/dev-stop.ts' }];
    expect(planStop([16], inside, ROOT, ownAncestry(inside, 20))).toEqual({ kind: 'kill', roots: [15] });
  });
});

describe('parseListenerJson', () => {
  it('reads [], the real query\'s free-port answer, as no listener', () => {
    expect(parseListenerJson(JSON.parse('[]'))).toEqual([]);
  });

  it('reads null as no listener', () => {
    expect(parseListenerJson(JSON.parse('null'))).toEqual([]);
  });

  it('reads one listener as an array', () => {
    expect(parseListenerJson(JSON.parse('[1708]'))).toEqual([1708]);
  });

  it('reads one listener as a bare number, which ConvertTo-Json can print', () => {
    expect(parseListenerJson(JSON.parse('1708'))).toEqual([1708]);
  });

  it('reads several listeners', () => {
    expect(parseListenerJson(JSON.parse('[1708,2210]'))).toEqual([1708, 2210]);
  });

  it.each(['"x"', '{}', '[1.5]', '["1708"]'])('throws on %s and names the value', (json) => {
    expect(() => parseListenerJson(JSON.parse(json))).toThrow(json);
  });
});

/** The POSIX reader needs lsof; Windows always has the PowerShell query. */
const canQuery = process.platform === 'win32' || spawnSync('lsof', ['-v']).error === undefined;

describe('listenerPids', () => {
  let server: Server | undefined;

  afterEach(async () => {
    const open = server;
    server = undefined;
    if (open?.listening) await new Promise<void>((done) => open.close(() => done()));
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
      // stderr, not the message: the message quotes the script, which names the cmdlet even on a parse error.
      const stderr = String((thrown as { stderr?: unknown } | undefined)?.stderr);
      expect(stderr).toContain(MISSING_CMDLET);
      expect(stderr).toContain('CommandNotFoundException');
    },
    POWERSHELL_TIMEOUT_MS,
  );
});
