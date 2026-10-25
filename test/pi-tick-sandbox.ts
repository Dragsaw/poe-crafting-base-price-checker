import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));
export const OPS_PI = path.join(REPO_ROOT, 'ops/pi');

// pgrep reports no git process, so a git child of a parallel test file never makes a stale
// index.lock look live. FAKE_PNPM_RUN is a command that pnpm runs while it "installs".
const FAKES: Readonly<Record<string, string>> = {
  pnpm: 'printf "%s\\n" "$*" >>"$FAKE_LOG"\nif [[ -n ${FAKE_PNPM_RUN:-} ]]; then bash -c "$FAKE_PNPM_RUN"; fi\nexit "${FAKE_PNPM_EXIT:-0}"',
  systemctl: 'printf "systemctl %s\\n" "$*" >>"$FAKE_LOG"\n[[ $1 == show ]] && printf "%s\\n" "${FAKE_TICK_STATE:-inactive}"\nexit 0',
  sudo: 'exec "$@"',
  pgrep: 'exit "${FAKE_PGREP_EXIT:-1}"',
};

// A POE_REPO_DIR from the caller would point the no-argument tick at a real checkout.
const INHERITED_DROP = /^(?:GIT_|FAKE_)|^(?:EMAIL|POE_REPO_DIR)$/;

export interface RunResult {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly output: string;
}

export interface RunOptions {
  readonly cwd?: string;
  readonly env?: NodeJS.ProcessEnv;
  readonly input?: string;
}

export function writeExecutable(file: string, body: string): void {
  writeFileSync(file, `#!/usr/bin/env bash\n${body}\n`);
  chmodSync(file, 0o755);
}

export function writeLine(directory: string, file: string, content: string): void {
  writeFileSync(path.join(directory, file), `${content}\n`);
}

export function readText(directory: string, file: string): string {
  return readFileSync(path.join(directory, file), 'utf8');
}

/** A temporary directory with fake pnpm, systemctl, sudo and pgrep first on PATH and no user git config. */
export class Sandbox {
  private readonly logPath: string;
  readonly work: string;
  readonly environment: NodeJS.ProcessEnv;

  constructor() {
    this.work = mkdtempSync(path.join(tmpdir(), 'pi-tick-'));
    this.logPath = path.join(this.work, 'fake.log');
    const bin = path.join(this.work, 'bin');
    mkdirSync(bin);
    for (const [name, body] of Object.entries(FAKES)) {
      writeExecutable(path.join(bin, name), body);
    }
    const inherited = Object.entries(process.env).filter(([name]) => !INHERITED_DROP.test(name));
    this.environment = {
      ...Object.fromEntries(inherited),
      PATH: `${bin}${path.delimiter}${process.env.PATH ?? ''}`,
      HOME: this.work,
      FAKE_LOG: this.logPath,
      GIT_CONFIG_GLOBAL: '/dev/null',
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_EDITOR: 'true',
    };
    this.clearFakeLog();
  }

  run(command: string, arguments_: readonly string[], options: RunOptions = {}): RunResult {
    const result = spawnSync(command, arguments_, {
      encoding: 'utf8',
      cwd: options.cwd,
      env: { ...this.environment, ...options.env },
      input: options.input ?? '',
    });
    return { status: result.status, stdout: result.stdout, stderr: result.stderr, output: `${result.stdout}${result.stderr}` };
  }

  git(cwd: string, ...arguments_: string[]): string {
    const result = this.run('git', arguments_, { cwd });
    if (result.status !== 0) {
      throw new Error(`git ${arguments_.join(' ')} failed in ${cwd}:\n${result.output}`);
    }
    return result.stdout.trim();
  }

  /** The argument lines the fakes recorded since the last clear. */
  fakeLog(): string[] {
    return readFileSync(this.logPath, 'utf8').split('\n').filter(Boolean);
  }

  clearFakeLog(): void {
    writeFileSync(this.logPath, '');
  }

  dispose(): void {
    rmSync(this.work, { recursive: true, force: true });
  }
}
