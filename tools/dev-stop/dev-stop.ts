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
 * climbs to the `pnpm dev` process that runs it, then kills that tree.
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
    if (arg === '--port') {raw = argv[i + 1] ?? '';}
    else if (arg.startsWith('--port=')) {raw = arg.slice('--port='.length);}
  }
  if (raw === undefined) {return DEFAULT_PORT;}
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

/** The arguments of a command line. Double quotes group, and backslashes are literal (Windows paths). */
function tokenize(commandLine: string): string[] {
  return [...commandLine.matchAll(/(?:"[^"]*"|[^\s"])+/g)].map((match) => match[0].replaceAll('"', ''));
}

/** The program name of a path: last segment, lowercase, no Windows executable extension. */
function programName(token: string | undefined): string {
  return (normalize(token ?? '').split('/').pop() ?? '').replace(/\.(exe|cmd|bat|ps1)$/, '');
}

/**
 * Whether the process is `pnpm dev` or `pnpm run dev`: a pnpm executable, or
 * node running pnpm's entry script, whose first argument is the `dev` script.
 * An option before the script (`pnpm -r --parallel dev`, `pnpm --filter x dev`)
 * makes it some other invocation.
 */
function isPnpmDev(info: ProcessInfo): boolean {
  const tokens = tokenize(info.commandLine);
  let args: string[];
  if (programName(tokens[0]) === 'pnpm') {
    args = tokens.slice(1);
  } else if (programName(tokens[0]) === 'node') {
    const entry = tokens.findIndex((token, i) => i > 0 && !token.startsWith('-'));
    if (entry === -1 || !/^pnpm\.[cm]?js$/.test(programName(tokens[entry]))) {return false;}
    args = tokens.slice(entry + 1);
  } else {
    return false;
  }
  return args[0] === 'dev' || ((args[0] === 'run' || args[0] === 'run-script') && args[1] === 'dev');
}

const SHELLS = new Set(['cmd', 'sh', 'bash', 'dash', 'zsh', 'powershell', 'pwsh']);

/**
 * Whether the process is the shell that pnpm starts to run the `dev` script: a
 * shell whose `/c` or `-c` command is one `vite` command. A command separator
 * or another command (`bash -c "pnpm dev & pnpm test"`) makes it some other
 * shell, which can own other work.
 */
function isScriptShell(info: ProcessInfo): boolean {
  const tokens = tokenize(info.commandLine);
  if (!SHELLS.has(programName(tokens[0]))) {return false;}
  const flag = tokens.findIndex((token) => /^[/-]c$/i.test(token));
  if (flag === -1) {return false;}
  // Test separators on the raw text: tokenize drops a newline between commands.
  const command = /\s[/-]c\s([\s\S]*)$/i.exec(info.commandLine)?.[1] ?? '';
  return programName(tokens[flag + 1]) === 'vite' && !/[&|;\n`]|\$\(/.test(command);
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
 * alive, started before its child, is not one of `protectedPids` (this tool's
 * own ancestors), and is pnpm's script shell for `vite` or `pnpm dev` itself.
 * The climb ends at the first `pnpm dev`. The highest process reached is a root.
 *
 * The root is never above `pnpm dev`. The processes that started it (a
 * runtime's shell, a pnpm shim, `pnpm -r --parallel dev`, `bash -c "pnpm dev &
 * pnpm test"`) can own other work, and a tree kill there ends that work too.
 * They exit on their own when their `pnpm dev` child ends. With no `pnpm dev`
 * in the chain, the root is the listener or its script shell.
 */
export function planStop(
  listeners: readonly number[],
  processes: readonly ProcessInfo[],
  repoRoot: string,
  protectedPids: ReadonlySet<number>,
): StopPlan {
  if (listeners.length === 0) {return { kind: 'idle' };}
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
        !(isScriptShell(parent) || isPnpmDev(parent)) ||
        !startedBefore(parent, top)
      ) {
        break;
      }
      seen.add(parent.pid);
      top = parent;
      if (isPnpmDev(top)) {break;}
    }
    roots.add(top.pid);
  }
  return { kind: 'kill', roots: [...roots] };
}

export interface Snapshot {
  readonly listeners: readonly number[];
  readonly processes: readonly ProcessInfo[];
}

function powershell(script: string): string {
  return execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
}

/**
 * PowerShell that sets `$l` to the PIDs that listen on the port. With no
 * listener, `Get-NetTCPConnection` raises `CmdletizationQuery_NotFound`, which
 * reads as an empty list. Every other error, such as a missing cmdlet or
 * denied access, is rethrown: PowerShell exits non-zero and `execFileSync`
 * throws, so a failed query never reads as a free port. Match on the error id,
 * not the category: a missing cmdlet is also category `ObjectNotFound`.
 */
function listenerScript(port: number): string {
  return `$l = @(try { Get-NetTCPConnection -State Listen -LocalPort ${port} -ErrorAction Stop | ForEach-Object OwningProcess | Sort-Object -Unique } catch { if ($_.FullyQualifiedErrorId -notlike 'CmdletizationQuery_NotFound*') { throw } })`;
}

/**
 * The listener PIDs from PowerShell's JSON. The real query prints `[]` or
 * `[pid, …]`. `null` and a bare number are accepted defensively, for other
 * invocations or PowerShell versions. Any other shape throws: an unreadable
 * answer must never read as a free port.
 */
export function parseListenerJson(value: unknown): number[] {
  if (value === null) {return [];}
  if (Number.isInteger(value)) {return [value as number];}
  if (Array.isArray(value) && value.every((item) => Number.isInteger(item))) {return [...(value as number[])];}
  throw new Error(`unexpected listener query result: ${JSON.stringify(value)}`);
}

export function listenersWindows(port: number): number[] {
  const out = powershell(`${listenerScript(port)}; ConvertTo-Json -Compress -InputObject $l`);
  return parseListenerJson(JSON.parse(out));
}

function snapshotWindows(port: number): Snapshot {
  const script = [
    listenerScript(port),
    '$p = @(Get-CimInstance Win32_Process | ForEach-Object { $i = @{ pid = [int]$_.ProcessId; ppid = [int]$_.ParentProcessId; commandLine = [string]$_.CommandLine }; if ($_.CreationDate) { $i.started = ([DateTimeOffset]$_.CreationDate).ToUnixTimeMilliseconds() }; $i })',
    '@{ listeners = $l; processes = $p } | ConvertTo-Json -Compress -Depth 3',
  ].join('; ');
  const parsed = JSON.parse(powershell(script)) as { listeners: unknown; processes: ProcessInfo[] };
  return { listeners: parseListenerJson(parsed.listeners), processes: parsed.processes };
}

function listenersPosix(port: number): number[] {
  try {
    const out = execFileSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'], { encoding: 'utf8' });
    return [...new Set(out.split('\n').filter(Boolean).map(Number))];
  } catch (error) {
    // lsof exits 1 when nothing matches. Any other failure, such as a missing
    // lsof, must not read as a free port.
    if ((error as { status?: unknown }).status !== 1) {throw error;}
    return [];
  }
}

/**
 * POSIX reports no creation time here. It needs none: an orphan is reparented
 * to init or a subreaper, so its `ppid` never names a dead, reusable PID.
 */
function snapshotPosix(port: number): Snapshot {
  const listeners = listenersPosix(port);
  const ps = execFileSync('ps', ['-A', '-o', 'pid=,ppid=,args='], { encoding: 'utf8' });
  const processes = ps
    .split('\n')
    .map((line) => /^\s*(\d+)\s+(\d+)\s+(.*)$/.exec(line))
    .filter((match) => match !== null)
    .map((match) => ({ pid: Number(match[1]), ppid: Number(match[2]), commandLine: match[3]! }));
  return { listeners, processes };
}

export function snapshot(port: number): Snapshot {
  return process.platform === 'win32' ? snapshotWindows(port) : snapshotPosix(port);
}

/** Only the listener PIDs. The stop poll needs no process table. */
export function listenerPids(port: number): number[] {
  return process.platform === 'win32' ? listenersWindows(port) : listenersPosix(port);
}

/** `selfPid` and every live ancestor. Killing one would kill the caller. */
export function ownAncestry(processes: readonly ProcessInfo[], selfPid: number): Set<number> {
  const byPid = new Map(processes.map((info) => [info.pid, info]));
  const out = new Set<number>([selfPid]);
  let pid: number | undefined = selfPid;
  while (pid !== undefined) {
    const next: number | undefined = byPid.get(pid)?.ppid;
    if (next === undefined || out.has(next)) {break;}
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
  for (const child of processes.filter((info) => info.ppid === pid)) {killTree(child.pid, processes);}
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
  for (const root of plan.roots) {killTree(root, before.processes);}
  // taskkill returns before the socket is released, so poll. Each query
  // starts a shell and can take seconds, so bound the wait by time, not attempts.
  const deadline = Date.now() + STOP_TIMEOUT_MS;
  for (;;) {
    if (listenerPids(port).length === 0) {
      process.stdout.write(`dev-stop: stopped PID ${plan.roots.join(', ')}; port ${port} is free.\n`);
      return 0;
    }
    if (Date.now() >= deadline) {break;}
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
  if (entry === undefined) {return false;}
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
