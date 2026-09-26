/**
 * One bounded, resumable, single-instance chunk (AD-7, FR-19).
 *
 * One call runs one chunk and returns. The chunk stops at whichever comes
 * first: the step reports a search allowance below `1`, the step reports a
 * fetch allowance below `1`, the step yields, or the order runs out. The
 * allowances are whatever the step read from live headers; this module holds
 * no rate and no floor of its own.
 *
 * The order comes from `core` (the Refresh Rotation, AD-7) and is recomputed
 * on every run from the tracked list, `data/dataset.json`, the completed keys
 * and the clock, so a resumed chunk never replays a frozen plan.
 * `sync-progress.json` records only what was **completed**, and only in rows
 * 2–3: row 1 is exempt from the pass. A pinned entry that is `unresolvable`
 * sits in row 3, so its key is recorded like any other row 3 key.
 *
 * The runtime half of the pinned cap lives here: after each pinned step that
 * reports a search allowance, `pinnedToKeep` may cut the rest of row 1 so the
 * rotation keeps at least one search. A shortfall surfaces as
 * `pinnedStarvation` on the outcome; the kind is unchanged. The load-time half, which reads the
 * player's declared yardstick, is outside this directory (`../pinned-cap.ts`).
 *
 * The lock path is fixed here and later stories do not rewrite it: Story 1.8
 * and 1.9 add to the outcome, and Story 1.11 plugs its run-start check into
 * `gate`. Release runs in a `finally`, so a throw from `gate` or from the step
 * still releases a lock this run holds.
 */

import {
  canonicalKey,
  compareCanonicalKeys,
  DatasetFileSchema,
  parseEnvelope,
  SUPPORTED_SCHEMA_VERSION,
  SyncProgressFileSchema,
  TrackedFileSchema,
} from '@poe/contracts';
import type {
  ClockPort,
  EnvelopeResult,
  FilesystemPort,
  SyncProgressFile,
  SyncRunRecord,
  TrackedEntry,
} from '@poe/contracts';
import { chunkOrder, pinnedToKeep } from '@poe/core';

import { serialiseJsonArtifact } from '../shell.ts';
import { acquireLock, holdsLock, releaseLockIfOwn } from './lock.ts';

export const TRACKED_PATH = 'data/tracked.json';
export const PROGRESS_PATH = 'data/sync-progress.json';
/** Read only, for the rotation's `lastAttemptedAt` and price state. Story 1.8 writes it. */
export const DATASET_PATH = 'data/dataset.json';

/**
 * What one step reports for one entry. `completed` carries the allowances the
 * step observed in the live headers of its last search and fetch; an absent
 * allowance bounds nothing, because nothing was observed. `yielded` means the
 * entry was **not** completed and the chunk must stop now — a `429`, or the
 * client's invalid-request refusal.
 */
export type StepResult =
  | {
      readonly kind: 'completed';
      readonly searchRemaining?: number;
      readonly fetchRemaining?: number;
    }
  | { readonly kind: 'yielded' };

export type ChunkStep = (entry: TrackedEntry) => Promise<StepResult>;

/** What the run-start gate sees. Later stories add to it. */
export interface GateContext {
  readonly entries: readonly TrackedEntry[];
}

export interface ChunkPorts {
  readonly fs: FilesystemPort;
  readonly clock: ClockPort;
  /** The process id written into the lock. */
  readonly pid: number;
  /**
   * The run-start gate. It runs under the lock, before any step. A throw
   * aborts the chunk; the lock is still released.
   */
  readonly gate?: (context: GateContext) => Promise<void>;
  /** One line of operator output. Defaults to stderr. */
  readonly log?: (line: string) => void;
}

export type ChunkBound = 'search' | 'fetch';

interface ChunkOutcomeBase {
  /**
   * Canonical keys this chunk completed, in visiting order, row 1 (pinned)
   * included. Progress records only the rows 2–3 subset of these.
   */
  readonly completed: readonly string[];
  /** Report records this chunk produced. Story 1.9 writes them out. */
  readonly records: readonly SyncRunRecord[];
  /**
   * Present only when a pinned step reported an allowance below the pinned
   * entries left plus one while rows 2–3 had work waiting, whether or not any
   * pinned entry was left to cut (AD-7, IMPLEMENTATION-NOTES.md §6). It is not an error and does not
   * change the outcome kind. `pinnedStarvationRecord` in `../pinned-cap.ts`
   * adds the declared yardstick to make the report record.
   */
  readonly pinnedStarvation?: ChunkStarvation;
}

/** The four observed fields of a pinned-starvation record. */
export interface ChunkStarvation {
  /** The search allowance the chunk received: the first reported remaining search count plus the steps it had already taken. */
  readonly discoveredAllowance: number;
  /** The size of the pinned set at load: every tracked entry with status `pinned`, `unresolvable` ones included. */
  readonly pinnedCount: number;
  /** How many pinned entries the chunk completed. */
  readonly pinnedRefreshed: number;
  /** How many rotation (rows 2–3) entries the chunk completed. */
  readonly activeRefreshed: number;
}

export type ChunkOutcome =
  | (ChunkOutcomeBase & { readonly kind: 'completed' })
  | (ChunkOutcomeBase & { readonly kind: 'bounded'; readonly bound: ChunkBound })
  | (ChunkOutcomeBase & { readonly kind: 'yielded' })
  | (ChunkOutcomeBase & { readonly kind: 'busy' })
  | (ChunkOutcomeBase & { readonly kind: 'dispossessed' });

export type ChunkOutcomeKind = ChunkOutcome['kind'];

const writeStderr = (line: string): void => {
  process.stderr.write(`${line}\n`);
};

function describeRefusal(path: string, result: Exclude<EnvelopeResult<unknown>, { ok: true }>): string {
  switch (result.reason) {
    case 'unknown-major':
    case 'malformed-version':
      return `${path}: schemaVersion ${result.found} refused (${result.reason}; this build reads ${result.expected})`;
    case 'invalid':
      return `${path}: invalid: ${result.issues
        .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
        .join('; ')}`;
  }
}

async function loadEnvelope<T>(
  fs: FilesystemPort,
  path: string,
  parse: (data: unknown) => EnvelopeResult<T>,
): Promise<T | undefined> {
  const text = await fs.readTextFile(path);
  if (text === undefined) {
    return undefined;
  }
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (error) {
    throw new Error(`${path}: not valid JSON: ${String(error)}`, { cause: error });
  }
  const result = parse(data);
  if (!result.ok) {
    throw new Error(describeRefusal(path, result));
  }
  return result.value;
}

function boundOf(step: Extract<StepResult, { kind: 'completed' }>): ChunkBound | undefined {
  if (step.searchRemaining !== undefined && step.searchRemaining < 1) {
    return 'search';
  }
  if (step.fetchRemaining !== undefined && step.fetchRemaining < 1) {
    return 'fetch';
  }
  return undefined;
}

export async function runChunk(ports: ChunkPorts, step: ChunkStep): Promise<ChunkOutcome> {
  const { fs, clock, pid, gate } = ports;
  const log = ports.log ?? writeStderr;

  const acquisition = await acquireLock(fs, clock, pid);
  if (acquisition.kind === 'busy') {
    const holder =
      acquisition.holder === undefined
        ? 'an unreadable lock'
        : `pid ${String(acquisition.holder.pid)} since ${acquisition.holder.startedAt}`;
    log(`sync: another run holds the lock (${holder}); nothing to do this invocation`);
    return { kind: 'busy', completed: [], records: [] };
  }

  const mine = acquisition.lock;
  const records: SyncRunRecord[] = acquisition.broken === undefined ? [] : [acquisition.broken];

  try {
    const tracked = await loadEnvelope(fs, TRACKED_PATH, (data) =>
      parseEnvelope(TrackedFileSchema, data),
    );
    const entries = tracked?.entries ?? [];

    if (gate !== undefined) {
      await gate({ entries });
    }

    const progress = await loadEnvelope(fs, PROGRESS_PATH, (data) =>
      parseEnvelope(SyncProgressFileSchema, data),
    );
    // Absent means every entry is never attempted.
    const dataset = await loadEnvelope(fs, DATASET_PATH, (data) =>
      parseEnvelope(DatasetFileSchema, data),
    );
    const order = chunkOrder({
      tracked: entries,
      dataset: dataset?.entries ?? [],
      completed: progress?.completed ?? [],
      now: clock.now(),
    });

    const completed: string[] = [];
    // Only rotation completions enter the pass: row 1 is exempt (AD-7).
    const rotationCompleted: string[] = [];
    let ending: { readonly kind: 'completed' } | { readonly kind: 'yielded' } | {
      readonly kind: 'bounded';
      readonly bound: ChunkBound;
    } = { kind: 'completed' };

    const rotationWaiting = order.rotation.length > 0;
    let pinnedLimit = order.pinned.length;
    let pinnedVisited = 0;
    let rotationVisited = 0;
    let discoveredAllowance: number | undefined;
    let truncated = false;

    for (;;) {
      const inPinned = pinnedVisited < pinnedLimit;
      const entry = inPinned ? order.pinned[pinnedVisited] : order.rotation[rotationVisited];
      if (entry === undefined) {
        break;
      }
      const result = await step(entry);
      if (result.kind === 'yielded') {
        ending = { kind: 'yielded' };
        break;
      }
      const key = canonicalKey(entry);
      completed.push(key);

      if (inPinned) {
        pinnedVisited += 1;
        const remaining = result.searchRemaining;
        if (remaining !== undefined) {
          // Every step so far spent one search, the reporting one included.
          discoveredAllowance ??= remaining + completed.length;
          const left = pinnedLimit - pinnedVisited;
          // R < P + 1 with rows 2–3 waiting is starvation, even when nothing is left to cut.
          if (rotationWaiting && remaining < left + 1) {
            truncated = true;
          }
          pinnedLimit = pinnedVisited + pinnedToKeep(left, remaining, rotationWaiting);
        }
      } else {
        rotationVisited += 1;
        rotationCompleted.push(key);
      }

      const hasNext = pinnedVisited < pinnedLimit || rotationVisited < order.rotation.length;
      const bound = boundOf(result);
      if (bound !== undefined && hasNext) {
        ending = { kind: 'bounded', bound };
        break;
      }
    }

    const starvation: { readonly pinnedStarvation?: ChunkStarvation } = truncated
      ? {
          pinnedStarvation: {
            discoveredAllowance: discoveredAllowance ?? 0,
            pinnedCount: entries.filter((entry) => entry.status === 'pinned').length,
            pinnedRefreshed: pinnedVisited,
            activeRefreshed: rotationCompleted.length,
          },
        }
      : {};

    // Re-read immediately before committing. A run dispossessed at the
    // staleness threshold writes nothing, and the `finally` below then
    // releases nothing, because the lock on disk is no longer its own.
    if (!(await holdsLock(fs, mine))) {
      log('sync: the lock was taken over during this chunk; writing nothing');
      return { kind: 'dispossessed', completed, records, ...starvation };
    }

    const file: SyncProgressFile = {
      schemaVersion: SUPPORTED_SCHEMA_VERSION,
      completed: [...new Set([...order.completed, ...rotationCompleted])].toSorted(
        compareCanonicalKeys,
      ),
    };
    await fs.writeTextFile(PROGRESS_PATH, serialiseJsonArtifact(file));

    return { ...ending, completed, records, ...starvation };
  } finally {
    await releaseLockIfOwn(fs, mine);
  }
}
