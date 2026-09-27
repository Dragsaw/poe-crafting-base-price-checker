import { execFileSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * `pnpm dev:stop [--port <n>]` stops the `pnpm dev` server that listens on a
 * port (default 5173) and checks that the port is free afterwards.
 *
 * It exists because a runtime's "stop background task" can kill only the PID
 * it spawned. On Windows a parent's death does not reach its children, and
 * `pnpm dev` puts Vite five processes below that PID (sh → pnpm → cmd → pnpm →
 * cmd → node), so Vite keeps the port. This tool starts from the listener and
 * climbs to the top of the `pnpm dev` chain, then kills that tree.
 *
 * It refuses a listener that is not this checkout's Vite: another worktree's
 * server, or an unrelated program on the port.
 *
 * Run by bare `node` (type stripping), so this module imports only builtins.
 */

export const DEFAULT_PORT = 5173;

/** How long to wait for the port to free after the kill. */
const STOP_TIMEOUT_MS = 5000;

export interface ProcessInfo {
  readonly pid: number;
  readonly ppid: number;
  readonly commandLine: string;
  /** Creation time in epoch ms, where the platform reports it (Windows). */
  readonly started?: number;
}

export type StopPlan =
  | { readonly kind: 'idle' }
  | { readonly kind: 'refuse'; readonly reason: string }
  | { readonly kind: 'kill'; readonly roots: readonly number[] };

/** The port from `--port <n>` or `--port=<n>`, else the default. */
export function parsePort(argv: readonly string[]): number {
  let raw: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === '--port') raw = argv[i + 1] ?? '';
    else if (arg.startsWith('--port=')) raw = arg.slice('--port='.length);
  }
  if (raw === undefined) return DEFAULT_PORT;
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`--port needs an integer from 1 to 65535, got "${raw}"`);
  }
  return port;
}

/** Lowercase, forward slashes, collapsed repeats: Windows paths compare case-insensitively. */
function normalize(text: string): string {
  return text.replaceAll('\\', '/').replace(/\/+/g, '/').toLowerCase();
}

/** A process that belongs to a `pnpm dev` chain: a pnpm or Vite process, or the shell that runs one. */
function isDevChainProcess(info: ProcessInfo): boolean {
  return /\b(pnpm|vite)\b/i.test(info.commandLine);
}

/**
 * Whether `parent` can be the process that started `child`. Windows keeps a
 * dead parent's PID in `ppid` and reuses PIDs, so the process that now holds
 * an orphan's `ppid` may be unrelated. It started after the child, which the
 * real parent cannot have. Without both creation times, trust the `ppid`.
 */
function startedBefore(parent: ProcessInfo, child: ProcessInfo): boolean {
  return parent.started === undefined || child.started === undefined || parent.started <= child.started;
}

/**
 * What to kill for the given listener PIDs. Each listener must be Vite run from
 * `repoRoot`'s `node_modules`. From each listener, climb while the parent is
 * alive, started before its child, is part of the `pnpm dev` chain, and is not
 * one of `protectedPids` (this tool's own ancestors). The highest process
 * reached is a root.
 */
export function planStop(
  listeners: readonly number[],
  processes: readonly ProcessInfo[],
  repoRoot: string,
  protectedPids: ReadonlySet<number>,
): StopPlan {
  if (listeners.length === 0) return { kind: 'idle' };
  const byPid = new Map(processes.map((info) => [info.pid, info]));
  const ownVite = normalize(`${repoRoot}/node_modules/`);
  const roots = new Set<number>();
  for (const pid of listeners) {
    const listener = byPid.get(pid);
    if (listener === undefined) {
      return { kind: 'refuse', reason: `PID ${pid} listens on the port but is not in the process table` };
    }
    const commandLine = normalize(listener.commandLine);
    if (!commandLine.includes('vite') || !commandLine.includes(ownVite)) {
      return {
        kind: 'refuse',
        reason: `PID ${pid} is not this checkout's Vite, so it is left running: ${listener.commandLine}`,
      };
    }
    let top = listener;
    // A reused PID can close a `ppid` cycle; the seen set ends the climb there.
    const seen = new Set<number>([top.pid]);
    for (;;) {
      const parent = byPid.get(top.ppid);
      if (
        parent === undefined ||
        seen.has(parent.pid) ||
        protectedPids.has(parent.pid) ||
        !isDevChainProcess(parent) ||
        !startedBefore(parent, top)
      ) {
        break;
      }
      seen.add(parent.pid);
      top = parent;
    }
    roots.add(top.pid);
  }
  return { kind: 'kill', roots: [...roots] };
}

interface Snapshot {
  readonly listeners: readonly number[];
  readonly processes: readonly ProcessInfo[];
}

function snapshotWindows(port: number): Snapshot {
  const script = [
    `$l = @(Get-NetTCPConnection -State Listen -LocalPort ${port} -ErrorAction SilentlyContinue | ForEach-Object OwningProcess | Sort-Object -Unique)`,
    '$p = @(Get-CimInstance Win32_Process | ForEach-Object { $i = @{ pid = [int]$_.ProcessId; ppid = [int]$_.ParentProcessId; commandLine = [string]$_.CommandLine }; if ($_.CreationDate) { $i.started = ([DateTimeOffset]$_.CreationDate).ToUnixTimeMilliseconds() }; $i })',
    '@{ listeners = $l; processes = $p } | ConvertTo-Json -Compress -Depth 3',
  ].join('; ');
  const out = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  const parsed = JSON.parse(out) as { listeners: number[] | null; processes: ProcessInfo[] };
  return { listeners: parsed.listeners ?? [], processes: parsed.processes };
}

/**
 * POSIX reports no creation time here. It needs none: an orphan is reparented
 * to init or a subreaper, so its `ppid` never names a dead, reusable PID.
 */
function snapshotPosix(port: number): Snapshot {
  let listeners: number[] = [];
  try {
    const out = execFileSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'], { encoding: 'utf8' });
    listeners = [...new Set(out.split('\n').filter(Boolean).map(Number))];
  } catch (error) {
    // lsof exits 1 when nothing matches. Any other failure, such as a missing
    // lsof, must not read as a free port.
    if ((error as { status?: unknown }).status !== 1) throw error;
  }
  const ps = execFileSync('ps', ['-A', '-o', 'pid=,ppid=,args='], { encoding: 'utf8' });
  const processes = ps
    .split('\n')
    .map((line) => /^\s*(\d+)\s+(\d+)\s+(.*)$/.exec(line))
    .filter((match) => match !== null)
    .map((match) => ({ pid: Number(match[1]), ppid: Number(match[2]), commandLine: match[3]! }));
  return { listeners, processes };
}

function snapshot(port: number): Snapshot {
  return process.platform === 'win32' ? snapshotWindows(port) : snapshotPosix(port);
}

/** `selfPid` and every live ancestor. Killing one would kill the caller. */
export function ownAncestry(processes: readonly ProcessInfo[], selfPid: number): Set<number> {
  const byPid = new Map(processes.map((info) => [info.pid, info]));
  const out = new Set<number>([selfPid]);
  let pid: number | undefined = selfPid;
  while (pid !== undefined) {
    const next: number | undefined = byPid.get(pid)?.ppid;
    if (next === undefined || out.has(next)) break;
    out.add(next);
    pid = next;
  }
  return out;
}

/** Kills `pid` and every descendant, children first on POSIX. */
function killTree(pid: number, processes: readonly ProcessInfo[]): void {
  if (process.platform === 'win32') {
    try {
      execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
    } catch {
      // The root already exited, or one descendant would not end. The port poll decides.
    }
    return;
  }
  for (const child of processes.filter((info) => info.ppid === pid)) killTree(child.pid, processes);
  try {
    process.kill(pid, 'SIGTERM');
  } catch {
    // Already gone.
  }
}

async function main(): Promise<number> {
  const port = parsePort(process.argv.slice(2));
  const repoRoot = resolve(import.meta.dirname, '../..');
  const before = snapshot(port);
  const plan = planStop(before.listeners, before.processes, repoRoot, ownAncestry(before.processes, process.pid));
  if (plan.kind === 'idle') {
    process.stdout.write(`dev-stop: nothing listens on port ${port}.\n`);
    return 0;
  }
  if (plan.kind === 'refuse') {
    process.stderr.write(`dev-stop: ${plan.reason}\n`);
    return 1;
  }
  for (const root of plan.roots) killTree(root, before.processes);
  // taskkill returns before the socket is released, so poll. Each snapshot
  // starts a shell and can take seconds, so bound the wait by time, not attempts.
  const deadline = Date.now() + STOP_TIMEOUT_MS;
  for (;;) {
    if (snapshot(port).listeners.length === 0) {
      process.stdout.write(`dev-stop: stopped PID ${plan.roots.join(', ')}; port ${port} is free.\n`);
      return 0;
    }
    if (Date.now() >= deadline) break;
    await new Promise((done) => setTimeout(done, 250));
  }
  process.stderr.write(`dev-stop: port ${port} is still taken after killing PID ${plan.roots.join(', ')}.\n`);
  return 1;
}

/**
 * The entry guard, as in `tools/dts-specifiers/rewrite-dts-specifiers.ts`:
 * running the file stops the server, and importing it (the co-located test)
 * runs nothing.
 */
function isInvokedDirectly(): boolean {
  const entry = process.argv[1];
  if (entry === undefined) return false;
  try {
    return realpathSync(resolve(entry)) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isInvokedDirectly()) {
  main().then(
    (code) => {
      process.exitCode = code;
    },
    (error: unknown) => {
      process.stderr.write(`dev-stop: ${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 1;
    },
  );
}
