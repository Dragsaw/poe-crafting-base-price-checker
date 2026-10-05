import { execFileSync } from 'node:child_process';
import nodePath from 'node:path';

import { isInvokedDirectly } from '../entry-guard/is-invoked-directly.ts';

// A runtime's "stop background task" kills only the PID it spawned, and on Windows Vite sits
// five processes below it. This climbs from the port's listener to `pnpm dev` and kills that tree.
// Run by bare `node` (type stripping), so this module imports only builtins and `.ts` siblings.

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
  for (const [index, argument] of argv.entries()) {
    if (argument === '--port') {raw = argv[index + 1] ?? '';}
    else if (argument.startsWith('--port=')) {raw = argument.slice('--port='.length);}
  }
  if (raw === undefined) {return DEFAULT_PORT;}
  const port = Number(raw);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`--port needs an integer from 1 to 65535, got "${raw}"`);
  }
  return port;
}

/** Lowercase, forward slashes, collapsed repeats: Windows paths compare case-insensitively. */
function normalize(text: string): string {
  return text.replaceAll('\\', '/').replaceAll(/\/+/g, '/').toLowerCase();
}

/** The arguments of a command line. Double quotes group, and backslashes are literal (Windows paths). */
function tokenize(commandLine: string): string[] {
  return [...commandLine.matchAll(/(?:"[^"]*"|[^\s"])+/g)].map((match) => match[0].replaceAll('"', ''));
}

/** The program name of a path: last segment, lowercase, no Windows executable extension. */
function programName(token = ''): string {
  return (normalize(token).split('/').pop() ?? '').replace(/\.(exe|cmd|bat|ps1)$/, '');
}

// An option before the `dev` script (`pnpm -r --parallel dev`, `pnpm --filter x dev`) makes
// it some other invocation.
function isPnpmDevelopment(info: ProcessInfo): boolean {
  const tokens = tokenize(info.commandLine);
  let arguments_: string[];
  if (programName(tokens[0]) === 'pnpm') {
    arguments_ = tokens.slice(1);
  } else if (programName(tokens[0]) === 'node') {
    const entry = tokens.findIndex((token, index) => index > 0 && !token.startsWith('-'));
    if (entry === -1 || !/^pnpm\.[cm]?js$/.test(programName(tokens[entry]))) {return false;}
    arguments_ = tokens.slice(entry + 1);
  } else {
    return false;
  }
  return arguments_[0] === 'dev' || ((arguments_[0] === 'run' || arguments_[0] === 'run-script') && arguments_[1] === 'dev');
}

const SHELLS = new Set(['cmd', 'sh', 'bash', 'dash', 'zsh', 'powershell', 'pwsh']);

// A separator or another command (`bash -c "pnpm dev & pnpm test"`) makes it some other
// shell, which can own other work.
function isScriptShell(info: ProcessInfo): boolean {
  const tokens = tokenize(info.commandLine);
  if (!SHELLS.has(programName(tokens[0]))) {return false;}
  const flag = tokens.findIndex((token) => /^[/-]c$/i.test(token));
  if (flag === -1) {return false;}
  // Test separators on the raw text: tokenize drops a newline between commands.
  const command = /\s[/-]c\s([\s\S]*)$/i.exec(info.commandLine)?.[1] ?? '';
  return programName(tokens[flag + 1]) === 'vite' && !/[&|;\n`]|\$\(/.test(command);
}

// Windows keeps a dead parent's PID in `ppid` and reuses PIDs, so a process that started
// after the child is not its parent. Without both creation times, trust `ppid`.
function isStartedBefore(parent: ProcessInfo, child: ProcessInfo): boolean {
  return parent.started === undefined || child.started === undefined || parent.started <= child.started;
}

/** The highest process of the listener's chain that planStop may kill. */
function climbToRoot(
  listener: ProcessInfo,
  byPid: ReadonlyMap<number, ProcessInfo>,
  protectedPids: ReadonlySet<number>,
): ProcessInfo {
  let top = listener;
  // A reused PID can close a `ppid` cycle; the seen set ends the climb there.
  const seen = new Set<number>([top.pid]);
  for (;;) {
    const parent = byPid.get(top.ppid);
    if (
      parent === undefined ||
      seen.has(parent.pid) ||
      protectedPids.has(parent.pid) ||
      !(isScriptShell(parent) || isPnpmDevelopment(parent)) ||
      !isStartedBefore(parent, top)
    ) {
      return top;
    }
    seen.add(parent.pid);
    top = parent;
    if (isPnpmDevelopment(top)) {return top;}
  }
}

// The root is never above `pnpm dev`: its parents (a runtime's shell, `pnpm -r --parallel dev`)
// can own other work, and exit on their own when it ends. Without a `pnpm dev` in the
// chain, the root is the listener or its script shell.
export function planStop(
  listeners: readonly number[],
  processes: readonly ProcessInfo[],
  repositoryRoot: string,
  protectedPids: ReadonlySet<number>,
): StopPlan {
  if (listeners.length === 0) {return { kind: 'idle' };}
  const byPid = new Map(processes.map((info) => [info.pid, info]));
  const ownVite = normalize(`${repositoryRoot}/node_modules/`);
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
    const top = climbToRoot(listener, byPid, protectedPids);
    roots.add(top.pid);
  }
  return { kind: 'kill', roots: [...roots] };
}

export interface Snapshot {
  readonly listeners: readonly number[];
  readonly processes: readonly ProcessInfo[];
}

/** A Windows system tool by absolute path, so a directory early on PATH cannot shadow it; the bare name where SystemRoot is unset. */
export function windowsTool(name: string, directory = ''): string {
  const root = process.env.SystemRoot;
  return root === undefined || root === '' ? name : nodePath.join(root, 'System32', directory, name);
}

function powershell(script: string): string {
  return execFileSync(windowsTool('powershell.exe', nodePath.join('WindowsPowerShell', 'v1.0')), ['-NoProfile', '-NonInteractive', '-Command', script], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
}

// `CmdletizationQuery_NotFound` (no listener) reads as an empty list; any other error is
// rethrown, so a failed query never reads as a free port. Match the error id, not the category.
function listenerScript(port: number): string {
  return `$l = @(try { Get-NetTCPConnection -State Listen -LocalPort ${port} -ErrorAction Stop | ForEach-Object OwningProcess | Sort-Object -Unique } catch { if ($_.FullyQualifiedErrorId -notlike 'CmdletizationQuery_NotFound*') { throw } })`;
}

// `null` and a bare number are accepted defensively. Any other shape throws: an unreadable
// answer must never read as a free port.
export function parseListenerJson(value: unknown): number[] {
  if (value === null) {return [];}
  if (Number.isSafeInteger(value)) {return [value as number];}
  if (Array.isArray(value) && value.every((item) => Number.isSafeInteger(item))) {return [...(value as number[])];}
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
    // eslint-disable-next-line sonarjs/no-os-command-from-path -- boundary: lsof sits in /usr/bin or /usr/sbin by distro, so only PATH finds it on every POSIX platform this tool supports
    const out = execFileSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'], { encoding: 'utf8' });
    return [...new Set(out.split('\n').filter(Boolean).map(Number))];
  } catch (error) {
    // lsof exits 1 when nothing matches. Any other failure, such as a missing
    // lsof, must not read as a free port.
    if ((error as { status?: unknown }).status !== 1) {throw error;}
    return [];
  }
}

// No creation time needed: an orphan is reparented to init or a subreaper, so `ppid` never
// names a dead, reusable PID.
function snapshotPosix(port: number): Snapshot {
  const listeners = listenersPosix(port);
  // eslint-disable-next-line sonarjs/no-os-command-from-path -- boundary: ps sits in /bin or /usr/bin by platform, so only PATH finds it on every POSIX platform this tool supports
  const ps = execFileSync('ps', ['-A', '-o', 'pid=,ppid=,args='], { encoding: 'utf8' });
  const processes: ProcessInfo[] = [];
  for (const line of ps.split('\n')) {
    const [, pid, ppid, commandLine] = /^\s*(\d+)\s+(\d+)\s+(\S.*)$/.exec(line) ?? [];
    if (pid !== undefined && ppid !== undefined && commandLine !== undefined) {
      processes.push({ pid: Number(pid), ppid: Number(ppid), commandLine });
    }
  }
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
  let next = byPid.get(selfPid)?.ppid;
  while (next !== undefined && !out.has(next)) {
    out.add(next);
    next = byPid.get(next)?.ppid;
  }
  return out;
}

/** Kills `pid` and every descendant, children first on POSIX. */
function killTree(pid: number, processes: readonly ProcessInfo[]): void {
  if (process.platform === 'win32') {
    try {
      execFileSync(windowsTool('taskkill.exe'), ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
    } catch {
      // The root already exited, or one descendant would not end. The port poll decides.
    }
    return;
  }
  for (const child of processes) {
    if (child.ppid === pid) {killTree(child.pid, processes);}
  }
  try {
    process.kill(pid, 'SIGTERM');
  } catch {
    // Already gone.
  }
}

async function main(): Promise<number> {
  const port = parsePort(process.argv.slice(2));
  const repositoryRoot = nodePath.resolve(import.meta.dirname, '../..');
  const before = snapshot(port);
  const plan = planStop(before.listeners, before.processes, repositoryRoot, ownAncestry(before.processes, process.pid));
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
    // eslint-disable-next-line no-await-in-loop -- sequential on purpose: poll interval between listener checks
    await new Promise((done) => setTimeout(done, 250));
  }
  process.stderr.write(`dev-stop: port ${port} is still taken after killing PID ${plan.roots.join(', ')}.\n`);
  return 1;
}

if (isInvokedDirectly(import.meta.url)) {
  try {
    process.exitCode = await main();
  } catch (error) {
    process.stderr.write(`dev-stop: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
