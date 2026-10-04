import {
  canonicalKey,
  createFakeClockPort,
  createFakeFilesystemPort,
  createFakeGitPort,
  SyncProgressFileSchema,
  SUPPORTED_SCHEMA_VERSION,
  SyncReportFileSchema,
  TRACKED_SCHEMA_VERSION,
  WEIGHTS_SCHEMA_VERSION,
} from '@poe/contracts';
import type {
  DatasetEntry,
  FakeFilesystemPort,
  SyncReportFile,
  TrackedEntry,
} from '@poe/contracts';

import type { CatalogueIds } from '../../catalogue/catalogue-ids.ts';
import { WEIGHTS_PATH } from '../../catalogue/weights-ids.ts';
import { pinnedStarvationRecord } from '../../pinned-cap.ts';
import { createRequestCounter } from '../../request-counter.ts';
import { PROGRESS_PATH, REPORT_PATH, runChunk, TRACKED_PATH } from '../run-chunk.ts';
import type {
  ChunkOutcome,
  ChunkPorts,
  ChunkPublication,
  ChunkSetup,
  ChunkStep,
  StepResult,
} from '../run-chunk.ts';

/** `run` builds the shell's `load` hook from the `publication`, `starvationRecord` and `gate` overrides. */
export type TestPorts = Omit<ChunkPorts, 'load'> & {
  readonly publication?: ChunkPublication;
  readonly starvationRecord?: ChunkSetup['starvationRecord'];
  readonly gate?: NonNullable<ChunkSetup['gate']>;
  /** Replaces the `load` the adapter builds, e.g. to count its calls. */
  readonly load?: ChunkPorts['load'];
};

export const DEFAULT_STARVATION: ChunkSetup['starvationRecord'] = (starvation) =>
  pinnedStarvationRecord(starvation, { minChunkSearches: 10 });

export const NOW = '2026-09-26T12:00:00.000Z';

/** Five hours before NOW: a live lock. */
export const FIVE_HOURS_AGO = '2026-09-26T07:00:00.000Z';

/** Seven hours before NOW: a stale lock. */
export const SEVEN_HOURS_AGO = '2026-09-26T05:00:00.000Z';
export const PID = 1000;
export const PUBLICATION: ChunkPublication = { league: 'Standard', currencyRates: [] };

/** Runs a chunk whose `load` answers the test's publication, starvation record, gate and step. */
export function run(ports: TestPorts, step: ChunkStep): Promise<ChunkOutcome> {
  const { publication = PUBLICATION, starvationRecord = DEFAULT_STARVATION, gate, load, ...base } = ports;
  return runChunk({
    ...base,
    load:
      load ?? (() => Promise.resolve({ publication, starvationRecord, step, ...(gate && { gate }) })),
  });
}

export function raw(baseTypeId: string, status: TrackedEntry['status'] = 'active'): TrackedEntry {
  return status === 'pruned'
    ? { kind: 'raw', baseTypeId, itemLevelMin: 82, status, prunedReason: 'no market' }
    : { kind: 'raw', baseTypeId, itemLevelMin: 82, status };
}

export const A = raw('A');
export const B = raw('B');
export const C = raw('C');
export const PRUNED = raw('P', 'pruned');
export const key = canonicalKey;

export function noListingsEntry(entry: TrackedEntry): DatasetEntry {
  return { entryKey: key(entry), price: { state: 'no-listings' }, lastAttemptedAt: NOW };
}

export function trackedText(entries: readonly TrackedEntry[]): string {
  return JSON.stringify({ schemaVersion: TRACKED_SCHEMA_VERSION, entries });
}

export function progressText(completed: readonly string[]): string {
  return JSON.stringify({ schemaVersion: '1.0.0', completed });
}

/** A set that holds every id except the ones named: a catalogue that is not the test's subject. */
class EverySetExcept extends Set<string> {
  readonly #missing: ReadonlySet<string>;

  constructor(missing: readonly string[] = []) {
    super();
    this.#missing = new Set(missing);
  }

  override has(id: string): boolean {
    return !this.#missing.has(id);
  }
}

/** A catalogue that exposes every id except the ones named. */
export function catalogueWithout(...missing: string[]): CatalogueIds {
  return {
    statIds: new EverySetExcept(missing),
    baseTypeIds: new EverySetExcept(missing),
    categoryIds: new EverySetExcept(missing),
  };
}

/** A catalogue in which every tracked id resolves. */
export const RESOLVES_ALL = catalogueWithout();

/** No history, nothing counted, a yardstick of 10 and every id resolving. */
export function shellPorts(): Pick<TestPorts, 'git' | 'requests' | 'starvationRecord' | 'catalogue'> {
  return {
    git: createFakeGitPort(),
    requests: createRequestCounter(),
    starvationRecord: (starvation) => pinnedStarvationRecord(starvation, { minChunkSearches: 10 }),
    catalogue: () => Promise.resolve({ ok: true, value: RESOLVES_ALL }),
  };
}

/** A present weights file with no ids: no weights record arises. */
export const EMPTY_WEIGHTS = JSON.stringify({ schemaVersion: WEIGHTS_SCHEMA_VERSION, gamePatch: '0.5.5', producer: { id: 'test', generatedAt: '2026-09-26T00:00:00Z' }, bases: {} });

interface Harness {
  readonly fs: FakeFilesystemPort;
  readonly ports: TestPorts;
  readonly logs: string[];
}

export function harness(
  entries: readonly TrackedEntry[] = [A, B, C, PRUNED],
  extra: Parameters<typeof createFakeFilesystemPort>[0] = {},
  overrides: Partial<TestPorts> = {},
): Harness {
  const fs = createFakeFilesystemPort({
    [TRACKED_PATH]: { contents: trackedText(entries) },
    [WEIGHTS_PATH]: { contents: EMPTY_WEIGHTS },
    ...extra,
  });
  const logs: string[] = [];
  const { publication = PUBLICATION, ...rest } = overrides;
  const ports: TestPorts = {
    fs,
    clock: createFakeClockPort(NOW),
    pid: PID,
    ...shellPorts(),
    log: (line) => {
      logs.push(line);
    },
    ...rest,
    publication,
  };
  return { fs, ports, logs };
}

/** A step that answers from a script keyed by entry, recording each visit. */
export function scriptedStep(script: (entry: TrackedEntry) => StepResult = () => ({ kind: 'completed' })): {
  readonly visited: string[];
  readonly step: ChunkStep;
} {
  const visited: string[] = [];
  return {
    visited,
    step: (entry) => {
      visited.push(key(entry));
      return Promise.resolve(script(entry));
    },
  };
}

export async function progressOf(fs: FakeFilesystemPort): Promise<unknown> {
  const text = await fs.readTextFile(PROGRESS_PATH);
  return text === undefined ? undefined : SyncProgressFileSchema.parse(JSON.parse(text));
}

export async function reportOf(fs: FakeFilesystemPort): Promise<SyncReportFile | undefined> {
  const text = await fs.readTextFile(REPORT_PATH);
  return text === undefined ? undefined : SyncReportFileSchema.parse(JSON.parse(text));
}

export function datasetText(entries: readonly { key: string; at?: string; unresolvable?: boolean }[]): string {
  return JSON.stringify({
    schemaVersion: SUPPORTED_SCHEMA_VERSION,
    league: 'Standard',
    generatedAt: NOW,
    entries: entries.map(({ key: entryKey, at, unresolvable }) => ({
      entryKey,
      price: { state: unresolvable === true ? 'unresolvable' : 'no-listings' },
      ...(at !== undefined && { lastAttemptedAt: at }),
    })),
    currencyRates: [],
  });
}
