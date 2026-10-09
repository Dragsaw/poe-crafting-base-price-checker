// One bounded chunk per run, behind the league gate (FR-19, FR-32, AD-7, AD-19).
// The real read-only git port; the tracked-list date falls back to `file-modified` (AD-12).
// No test runs `main`: `sync-batch.test.ts` drives `syncCommand` with injected ports.

import { fileURLToPath } from 'node:url';

import type { ChunkOutcome } from './chunk/run-chunk.ts';
import { composeChunk } from './compose-chunk.ts';
import type { ComposeChunkPorts } from './compose-chunk.ts';
import { isInvokedDirectly } from './entry/is-invoked-directly.ts';
import { createReadOnlyGitPort } from './git/read-only-git-port.ts';
import { createFetchHttpPort, createNodeFilesystemPort, sleep, systemClock } from './shell.ts';
import { createSessionAuth } from './trade/session-auth.ts';
import { resolveUserAgent } from './trade/user-agent.ts';

/** The session-only options of `composeChunk` are left out, so the batch chunk paces as before. */
export type SyncPorts = Omit<ComposeChunkPorts, 'pacing' | 'spread' | 'requests' | 'session'>;

/** Composes one live chunk from its ports and runs it. Throws what the chunk throws. */
export function runSync(ports: SyncPorts): Promise<ChunkOutcome> {
  return composeChunk(ports).run();
}

export interface SyncCommandDependencies extends Omit<SyncPorts, 'userAgent' | 'auth'> {
  /** Source of `POE_SYNC_USER_AGENT` and the optional `POESESSID` (AD-30). */
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly stdout: (line: string) => void;
  readonly stderr: (line: string) => void;
}

/** The command: the exit code it should end with. `0` on any outcome, `1` on a refusal or a throw. */
export async function syncCommand(dependencies: SyncCommandDependencies): Promise<number> {
  const { env, stdout, stderr, ...ports } = dependencies;
  const contact = resolveUserAgent(env);
  if (!contact.ok) {
    // Refused before anything is issued (NFR-9).
    stderr(`pnpm sync:batch: ${contact.message}`);
    return 1;
  }
  // After the contact refusal. Each settle prints one line, at the moment it
  // settles: an edge state here, before the first request; a probe outcome
  // from the governor.
  const auth = createSessionAuth(env, { onSettle: (line) => stderr(`pnpm sync:batch: ${line}`) });
  try {
    const outcome = await runSync({ ...ports, userAgent: contact.userAgent, auth });
    const kind = outcome.kind === 'deferred' ? `deferred until ${outcome.notBefore}` : outcome.kind;
    stdout(`pnpm sync:batch: ${kind}, ${String(outcome.completed.length)} completed`);
    return 0;
  } catch (error) {
    // The governor already redacted what it passed on; this covers the rest.
    const redacted = auth.redact(error);
    stderr(`pnpm sync:batch: ${redacted instanceof Error ? redacted.message : String(redacted)}`);
    return 1;
  } finally {
    // The process ends after this one chunk: a holder still unsettled had no
    // 2xx pricing search to probe on, or only a probe 429.
    auth.settle('not-probed');
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
if (isInvokedDirectly(import.meta.url)) {
  try {
    await main();
  } catch (error) {
    process.stderr.write(`pnpm sync:batch: ${String(error)}\n`);
    // `process.exitCode`, not `process.exit(1)`: an immediate exit truncates a piped stderr write.
    process.exitCode = 1;
  }
}
