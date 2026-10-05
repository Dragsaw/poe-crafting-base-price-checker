import type {
  DatasetEntry,
  DatasetFile,
  SyncLock,
  SyncProgressFile,
  SyncReportFile,
  SyncRunRecord,
  TrackedEntry,
} from '@poe/contracts';
import type { ChunkOrder } from '@poe/core';

import type { RequestsBySource } from '../../request-counter.ts';
import type { ChunkPorts, ChunkSetup, ChunkStarvation } from '../run-chunk.ts';

/** Both fields or neither (AD-27); set once the weights file is read. */
export interface CoverageFigures {
  coverage?: number;
  rankableClassCount?: number;
}

/** What the failure path reads as well as the normal one; stages and the loop mutate it. */
export interface RunState {
  readonly ports: ChunkPorts;
  readonly log: (line: string) => void;
  readonly mine: SyncLock;
  readonly runStartedAt: string;
  readonly requestsAtStart: RequestsBySource;
  readonly records: readonly SyncRunRecord[];
  readonly progress: SyncProgressFile | undefined;
  readonly previousReport: SyncReportFile | undefined;
  dataset: DatasetFile | undefined;
  setup: ChunkSetup | undefined;
  order: ChunkOrder | undefined;
  entries: readonly TrackedEntry[];
  coverageFigures: CoverageFigures;
  current: TrackedEntry | undefined;
  attempted: number;
  isPublishAttempted: boolean;
  /** Set once the league gate passed (or there is none): only then is the league confirmed. */
  isGatePassed: boolean;
  isReportAttempted: boolean;
  readonly completed: string[];
  readonly stepEntries: DatasetEntry[];
  /** The run-start check's offline marks (AD-9). They publish beneath the step entries. */
  marked: readonly DatasetEntry[];
  /** The run-start records: `unresolvable`, then `weights-absent` or `uncatalogued-weights-id`. */
  readonly checkRecords: SyncRunRecord[];
  readonly stepRecords: SyncRunRecord[];
  /** Only rotation completions enter the pass: row 1 is exempt (AD-7). */
  readonly rotationCompleted: string[];
  pinnedVisited: number;
  discoveredAllowance: number | undefined;
  isTruncated: boolean;
}

/** What `runChunk` knows once it holds the lock, before any load. */
export type RunContext = Pick<RunState, 'ports' | 'log' | 'mine' | 'requestsAtStart' | 'records'>;

export type RunStateInput = RunContext & Pick<RunState, 'progress' | 'previousReport'>;

/** A failure before the weights read is no re-read: the previous report's coverage pair stays. */
export function carriedCoverage(previous: SyncReportFile | undefined): CoverageFigures {
  return previous?.figures.coverage === undefined || previous.figures.rankableClassCount === undefined
    ? {}
    : { coverage: previous.figures.coverage, rankableClassCount: previous.figures.rankableClassCount };
}

export function logLockTakenOver(state: RunState): void {
  state.log('sync: the lock was taken over during this chunk; writing nothing');
}

export function createRunState(input: RunStateInput): RunState {
  return {
    ...input,
    runStartedAt: input.mine.startedAt,
    dataset: undefined,
    setup: undefined,
    order: undefined,
    entries: [],
    coverageFigures: carriedCoverage(input.previousReport),
    current: undefined,
    attempted: 0,
    isPublishAttempted: false,
    isGatePassed: false,
    isReportAttempted: false,
    completed: [],
    stepEntries: [],
    marked: [],
    checkRecords: [],
    stepRecords: [],
    rotationCompleted: [],
    pinnedVisited: 0,
    discoveredAllowance: undefined,
    isTruncated: false,
  };
}

/** Where the request figure counts from: this chunk's start, or the session pass's start. */
export function countFrom(state: RunState): RequestsBySource {
  const { order, ports, requestsAtStart } = state;
  return order !== undefined && !order.newPass && ports.session?.requestsSince !== undefined
    ? ports.session.requestsSince
    : requestsAtStart;
}

/** The session fields of an outcome reached once the order exists; a batch outcome carries none. */
export function passNow(state: RunState): { readonly newPass?: boolean; readonly confirmedLeague?: string } {
  const { order, setup, isGatePassed } = state;
  return state.ports.session === undefined
    ? {}
    : {
        ...(order !== undefined && { newPass: order.newPass }),
        ...(isGatePassed && setup !== undefined && { confirmedLeague: setup.publication.league }),
      };
}

export function starvationNow(state: RunState): { readonly pinnedStarvation?: ChunkStarvation } {
  return state.isTruncated
    ? {
        pinnedStarvation: {
          discoveredAllowance: state.discoveredAllowance ?? 0,
          pinnedCount: state.entries.filter((entry) => entry.status === 'pinned').length,
          pinnedRefreshed: state.pinnedVisited,
          activeRefreshed: state.rotationCompleted.length,
        },
      }
    : {};
}

/** This chunk's records: lock, run-start check, steps, starvation, then any failure. */
export function newRecords(state: RunState, failure: readonly SyncRunRecord[] = []): SyncRunRecord[] {
  const { pinnedStarvation } = starvationNow(state);
  return [
    ...state.records,
    ...state.checkRecords,
    ...state.stepRecords,
    // Truncation happens only in the rotation, which runs only after `load`.
    ...(pinnedStarvation === undefined || state.setup === undefined
      ? []
      : [state.setup.starvationRecord(pinnedStarvation)]),
    ...failure,
  ];
}
