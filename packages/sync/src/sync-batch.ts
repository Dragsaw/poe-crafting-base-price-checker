/**
 * `pnpm sync:batch` — one bounded chunk per invocation (FR-19, AD-7), behind
 * the run-start league gate (FR-32, AD-19), for an external scheduler. The
 * long-running session that paces request by request is `pnpm sync`
 * (`./sync.ts`); both run the same chunk.
 *
 * The composition is `composeChunk` (`./compose-chunk.ts`), the one
 * `pnpm sync` and `pnpm sync:dry` share: this command passes the real filesystem at the
 * repository root, the real clock and the `fetch` http port. `runChunk` does
 * the rest under the lock, in AD-12's cost order: the `notBefore` check, the
 * loads, the catalogue check, the order, the league gate, the rotation and
 * the writes.
 *
 * **The git port is the real read-only one** (`./git/read-only-git-port.ts`),
 * reading the repository at the same root. The tracked-list edit date is
 * therefore the author date of `data/tracked.json`'s last commit, tagged
 * `git-author-date` — AD-12's first clock. Where the repository yields no date
 * (no commit yet, no repository, no `git` binary is found) the resolver falls
 * back to the `file-modified` clock. `pnpm sync:dry` keeps the history-less
 * fake: its report is a prediction over a fake filesystem.
 *
 * The config, the rates, the item types and the published dataset are loaded
 * under the lock, and a refusal names its file before any request, in a
 * `run-failure` record. A pinned set over IMPLEMENTATION-NOTES.md §6's cap is
 * refused the same way. A throw from the chunk — a league mismatch included —
 * has already written `sync-report.json` and released the lock by the time it
 * reaches here; the command reports it on stderr and exits `1`.
 *
 * **No test runs `main`.** `sync-batch.test.ts` drives `syncCommand` with injected
 * ports; the entry guard at the bottom means importing the module runs nothing.
 */

import { realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { ChunkOutcome } from './chunk/run-chunk.ts';
import { composeChunk } from './compose-chunk.ts';
import type { ComposeChunkPorts } from './compose-chunk.ts';
import { createReadOnlyGitPort } from './git/read-only-git-port.ts';
import { createFetchHttpPort, createNodeFilesystemPort, sleep, systemClock } from './shell.ts';
import { resolveUserAgent } from './trade/user-agent.ts';

/**
 * The batch command's ports. The live command passes the read-only git port at
 * the repository root (see above). The session-only options of `composeChunk`
 * are left out, so the batch chunk paces and counts exactly as before.
 */
export type SyncPorts = Omit<ComposeChunkPorts, 'pacing' | 'spread' | 'requests' | 'session'>;

/** Composes one live chunk from its ports and runs it. Throws what the chunk throws. */
export function runSync(ports: SyncPorts): Promise<ChunkOutcome> {
  return composeChunk(ports).run();
}

export interface SyncCommandDeps extends Omit<SyncPorts, 'userAgent'> {
  /** Where the contact `User-Agent` is read from (`POE_SYNC_USER_AGENT`). */
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly stdout: (line: string) => void;
  readonly stderr: (line: string) => void;
}

/** The command: the exit code it should end with. `0` on any outcome, `1` on a refusal or a throw. */
export async function syncCommand(deps: SyncCommandDeps): Promise<number> {
  const { env, stdout, stderr, ...ports } = deps;
  const contact = resolveUserAgent(env);
  if (!contact.ok) {
    // Refused before anything is issued (NFR-9).
    stderr(`pnpm sync:batch: ${contact.message}`);
    return 1;
  }
  try {
    const outcome = await runSync({ ...ports, userAgent: contact.userAgent });
    const kind = outcome.kind === 'deferred' ? `deferred until ${outcome.notBefore}` : outcome.kind;
    stdout(`pnpm sync:batch: ${kind}, ${String(outcome.completed.length)} completed`);
    return 0;
  } catch (error) {
    stderr(`pnpm sync:batch: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
}

/** `packages/sync/src/` → the repository root, whose `data/` the chunk owns. */
const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

async function main(): Promise<void> {
  process.exitCode = await syncCommand({
    fs: createNodeFilesystemPort(REPO_ROOT),
    clock: systemClock,
    http: createFetchHttpPort(),
    git: createReadOnlyGitPort(REPO_ROOT),
    wait: sleep,
    pid: process.pid,
    env: process.env,
    stdout: (line) => process.stdout.write(`${line}\n`),
    stderr: (line) => process.stderr.write(`${line}\n`),
  });
}

/** Realpaths both sides, as `dry-run.ts` does, so a junction path still runs. */
function isInvokedDirectly(): boolean {
  const entry = process.argv[1];
  if (entry === undefined) {
    return false;
  }
  try {
    return realpathSync(resolve(entry)) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isInvokedDirectly()) {
  main().catch((error: unknown) => {
    process.stderr.write(`pnpm sync:batch: ${String(error)}\n`);
    // `process.exitCode`, not `process.exit(1)`: an immediate exit truncates a piped stderr write.
    process.exitCode = 1;
  });
}
