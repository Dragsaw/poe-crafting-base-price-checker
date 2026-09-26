/**
 * `pnpm sync` — the live background sync: one bounded chunk per invocation
 * (FR-19, AD-7), behind the run-start league gate (FR-32, AD-19).
 *
 * The composition: the real filesystem at the repository root, the real
 * clock, the `fetch` http port, **one governor** of two sibling trade clients
 * (`createTradeClients`) whose ports are counted as `league-validation` and
 * `tracked-list`, the pricing step, the committed catalogue loader, and the
 * league gate. `runChunk` does the rest under the lock: the gate first, then
 * the catalogue check, the rotation, the steps, and the writes.
 *
 * **The git port is the in-memory fake, with no history.** A real adapter
 * needs a process spawn, which `no-git-write.test.ts` forbids everywhere in
 * `sync`, so it waits for its own design pass (`docs/stories/deferred-work.md`).
 * Until then the tracked-list edit date comes from the `file-modified` clock,
 * which AD-12 allows where the repository yields no date.
 *
 * The config, the rates, the item types and the published dataset are loaded
 * before the lock, as values, and a refusal names its file before any request.
 * A throw from the chunk — a league mismatch included — has already written
 * `sync-report.json` and released the lock by the time it reaches here; the
 * command reports it on stderr and exits `1`.
 *
 * **No test runs `main`.** `sync.test.ts` drives `syncCommand` with injected
 * ports; the entry guard at the bottom means importing the module runs nothing.
 */

import { realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createFakeGitPort, DatasetFileSchema, parseEnvelope } from '@poe/contracts';
import type { ClockPort, FilesystemPort, GitPort, HttpPort } from '@poe/contracts';

import { loadCatalogueIds } from './catalogue/catalogue-ids.ts';
import { DATASET_PATH, runChunk } from './chunk/run-chunk.ts';
import type { ChunkOutcome } from './chunk/run-chunk.ts';
import { createLeagueGate } from './league/league-gate.ts';
import { loadConfig } from './load-config.ts';
import { loadDataFile } from './load-data-file.ts';
import type { DataFileResult } from './load-data-file.ts';
import { pinnedStarvationRecord } from './pinned-cap.ts';
import { loadCurrencies } from './pricing/load-currencies.ts';
import { loadItemTypes } from './pricing/load-item-types.ts';
import { outputRates } from './pricing/normalise.ts';
import { createPricingStep } from './pricing/price-entry.ts';
import { createRequestCounter } from './request-counter.ts';
import { createFetchHttpPort, createNodeFilesystemPort, sleep, systemClock } from './shell.ts';
import { createTradeClients } from './trade/client.ts';
import { resolveUserAgent } from './trade/user-agent.ts';

export interface SyncPorts {
  readonly fs: FilesystemPort;
  readonly clock: ClockPort;
  readonly http: HttpPort;
  /** Read-only. The live command passes the history-less fake (see above). */
  readonly git: GitPort;
  readonly wait: (ms: number) => Promise<void>;
  /** The whole `User-Agent` header (NFR-9). */
  readonly userAgent: string;
  /** The process id written into the lock. */
  readonly pid: number;
  /** One line of operator output. Defaults to stderr inside `runChunk`. */
  readonly log?: (line: string) => void;
}

function valueOf<T>(loaded: DataFileResult<T>): T {
  if (!loaded.ok) {
    throw loaded.error;
  }
  return loaded.value;
}

/** Composes one live chunk from its ports and runs it. Throws what the chunk throws. */
export async function runSync(ports: SyncPorts): Promise<ChunkOutcome> {
  const { fs, clock, http, git, wait, userAgent, pid, log } = ports;

  const config = valueOf(await loadConfig(fs));
  const league = config.league;
  const rates = valueOf(await loadCurrencies(fs));
  const itemTypes = valueOf(await loadItemTypes(fs));
  // Absent means every entry is never attempted, exactly as `runChunk` reads it.
  const published =
    (await fs.exists(DATASET_PATH))
      ? valueOf(
          await loadDataFile(fs, DATASET_PATH, (data) => parseEnvelope(DatasetFileSchema, data)),
        ).entries
      : [];

  const requests = createRequestCounter();
  const clients = createTradeClients({
    http: {
      'league-validation': requests.counted(http, 'league-validation'),
      'tracked-list': requests.counted(http, 'tracked-list'),
    },
    clock,
    wait,
    userAgent,
  });
  const step = createPricingStep({
    client: clients['tracked-list'],
    league,
    rates,
    itemTypes,
    dataset: published,
    clock,
  });

  return runChunk(
    {
      fs,
      clock,
      pid,
      publication: { league, currencyRates: outputRates(rates) },
      git,
      requests,
      starvationRecord: (starvation) => pinnedStarvationRecord(starvation, config),
      catalogue: () => loadCatalogueIds(fs),
      gate: createLeagueGate({ client: clients['league-validation'], league }),
      ...(log === undefined ? {} : { log }),
    },
    step,
  );
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
    stderr(`pnpm sync: ${contact.message}`);
    return 1;
  }
  try {
    const outcome = await runSync({ ...ports, userAgent: contact.userAgent });
    stdout(`pnpm sync: ${outcome.kind}, ${String(outcome.completed.length)} completed`);
    return 0;
  } catch (error) {
    stderr(`pnpm sync: ${error instanceof Error ? error.message : String(error)}`);
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
    git: createFakeGitPort(),
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
    process.stderr.write(`pnpm sync: ${String(error)}\n`);
    // `process.exitCode`, not `process.exit(1)`: an immediate exit truncates a piped stderr write.
    process.exitCode = 1;
  });
}
