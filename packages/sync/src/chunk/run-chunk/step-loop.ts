import { canonicalKey } from '@poe/contracts';
import type { TrackedEntry } from '@poe/contracts';
import { pinnedToKeep } from '@poe/core';
import type { ChunkOrder } from '@poe/core';

import type { ChunkBound, ChunkSetup, StepResult } from '../run-chunk.ts';
import { notBeforeAfter429 } from './not-before.ts';
import type { RunState } from './run-state.ts';

type CompletedStep = Extract<StepResult, { kind: 'completed' }>;
type YieldedStep = Extract<StepResult, { kind: 'yielded' }>;

type ChunkEnding =
  | { readonly kind: 'completed' }
  | { readonly kind: 'yielded'; readonly sessionExpired?: true }
  | { readonly kind: 'bounded'; readonly bound: ChunkBound };

/** How the step loop ended, and the `notBefore` it writes: set only by a step's 429 (§5.3). */
export interface ChunkStop {
  readonly ending: ChunkEnding;
  readonly until: string | undefined;
}

/** Where the loop stands in row 1 (cut by `pinnedToKeep`) and in the rotation. */
interface Cursor {
  pinnedLimit: number;
  rotationVisited: number;
}

function boundOf(step: CompletedStep): ChunkBound | undefined {
  if (step.searchRemaining !== undefined && step.searchRemaining < 1) {
    return 'search';
  }
  return step.fetchRemaining !== undefined && step.fetchRemaining < 1 ? 'fetch' : undefined;
}

function nextEntry(
  state: RunState,
  plan: ChunkOrder,
  cursor: Cursor,
): { readonly entry: TrackedEntry; readonly isInPinned: boolean } | undefined {
  const isInPinned = state.pinnedVisited < cursor.pinnedLimit;
  const entry = isInPinned ? plan.pinned[state.pinnedVisited] : plan.rotation[cursor.rotationVisited];
  return entry === undefined ? undefined : { entry, isInPinned };
}

function recordStep(state: RunState, result: StepResult): void {
  if (result.entry !== undefined) {
    state.stepEntries.push(result.entry);
  }
  if (result.kind === 'completed' && result.records !== undefined) {
    state.stepRecords.push(...result.records);
  }
}

/** A downgrade writes no `notBefore` and tells the session (§13.4). */
function yieldedStop(state: RunState, result: YieldedStep): ChunkStop {
  return {
    ending: result.sessionExpired === true ? { kind: 'yielded', sessionExpired: true } : { kind: 'yielded' },
    until:
      result.retryAfterMs === undefined
        ? undefined
        : notBeforeAfter429(state.ports.clock.now(), result.retryAfterMs),
  };
}

function notePinnedStep(state: RunState, plan: ChunkOrder, cursor: Cursor, result: CompletedStep): void {
  state.pinnedVisited += 1;
  const remaining = result.searchRemaining;
  if (remaining === undefined) {
    return;
  }
  // Every step so far spent one search, the reporting one included.
  state.discoveredAllowance ??= remaining + state.completed.length;
  const left = cursor.pinnedLimit - state.pinnedVisited;
  const isRotationWaiting = plan.rotation.length > 0;
  // R < P + 1 with rows 2–3 waiting is starvation, even when nothing is left to cut.
  if (isRotationWaiting && remaining < left + 1) {
    state.isTruncated = true;
  }
  cursor.pinnedLimit = state.pinnedVisited + (isRotationWaiting ? pinnedToKeep(left, remaining) : left);
}

function boundAfter(state: RunState, plan: ChunkOrder, cursor: Cursor, result: CompletedStep): ChunkBound | undefined {
  const hasNext = state.pinnedVisited < cursor.pinnedLimit || cursor.rotationVisited < plan.rotation.length;
  const bound = boundOf(result);
  if (bound !== undefined && hasNext) {
    return bound;
  }
  const { maxEntries } = state.ports.session ?? {};
  return hasNext && maxEntries !== undefined && state.attempted >= maxEntries ? 'entries' : undefined;
}

export async function runSteps(state: RunState, ready: ChunkSetup, plan: ChunkOrder): Promise<ChunkStop> {
  const cursor: Cursor = { pinnedLimit: plan.pinned.length, rotationVisited: 0 };
  for (;;) {
    const next = nextEntry(state, plan, cursor);
    if (next === undefined) {
      return { ending: { kind: 'completed' }, until: undefined };
    }
    state.current = next.entry;
    state.attempted += 1;
    // eslint-disable-next-line no-await-in-loop -- sequential on purpose: one step per entry in plan order, each step's pacing and bounds depend on the last
    const result = await ready.step(next.entry);
    state.current = undefined;
    recordStep(state, result);
    if (result.kind === 'yielded') {
      return yieldedStop(state, result);
    }
    const key = canonicalKey(next.entry);
    state.completed.push(key);
    if (next.isInPinned) {
      notePinnedStep(state, plan, cursor, result);
    } else {
      cursor.rotationVisited += 1;
      state.rotationCompleted.push(key);
    }
    const bound = boundAfter(state, plan, cursor, result);
    if (bound !== undefined) {
      return { ending: { kind: 'bounded', bound }, until: undefined };
    }
  }
}
