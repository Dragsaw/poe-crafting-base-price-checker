import { isLockHeld } from '../lock.ts';
import type { ChunkOutcome, ChunkSetup, GateResult } from '../run-chunk.ts';
import { notBeforeAfter429 } from './not-before.ts';
import { publish } from './publish-artifacts.ts';
import { logLockTakenOver, newRecords, passNow, starvationNow } from './run-state.ts';
import type { RunState } from './run-state.ts';
import type { ChunkStop } from './step-loop.ts';
import { writeReport } from './write-report.ts';

function dispossessedOutcome(state: RunState): ChunkOutcome {
  logLockTakenOver(state);
  return {
    kind: 'dispossessed',
    completed: state.completed,
    entries: state.stepEntries,
    records: state.records,
    ...starvationNow(state),
    ...passNow(state),
  };
}

/** A gate yield is a chunk yield with no entry attempted (AD-8, AD-12). */
export async function gateYieldOutcome(
  state: RunState,
  ready: ChunkSetup,
  gated: Extract<GateResult, { kind: 'yield' }>,
): Promise<ChunkOutcome> {
  const { fs, clock } = state.ports;
  if (!(await isLockHeld(fs, state.mine))) {
    return dispossessedOutcome(state);
  }
  state.log('sync: the league check got no answer; the chunk yields with no entry attempted');
  await publish(
    state,
    ready.publication,
    [],
    gated.retryAfterMs === undefined ? undefined : notBeforeAfter429(clock.now(), gated.retryAfterMs),
  );
  await writeReport(state, newRecords(state), clock.now());
  return {
    kind: 'yielded',
    completed: state.completed,
    entries: state.stepEntries,
    records: state.records,
    ...passNow(state),
  };
}

/** A probe 429 settles nothing and ends the chunk as a 429 yield, even with no later request. */
function withLatchedPenalty(state: RunState, stop: ChunkStop): ChunkStop {
  const latchedMs = state.ports.latchedRetryAfterMs?.();
  return latchedMs === undefined
    ? stop
    : { ending: { kind: 'yielded' }, until: notBeforeAfter429(state.ports.clock.now(), latchedMs) };
}

export async function finishChunk(state: RunState, ready: ChunkSetup, stop: ChunkStop): Promise<ChunkOutcome> {
  const { ending, until } = withLatchedPenalty(state, stop);
  const starvation = starvationNow(state);
  // Re-read immediately before committing: a run dispossessed at the staleness threshold writes
  // nothing, and the `finally` of `runChunk` then releases nothing, because the lock on disk is no
  // longer its own.
  if (!(await isLockHeld(state.ports.fs, state.mine))) {
    return dispossessedOutcome(state);
  }
  await publish(state, ready.publication, state.stepEntries, until);
  await writeReport(state, newRecords(state), state.ports.clock.now());
  return {
    ...ending,
    completed: state.completed,
    entries: state.stepEntries,
    records: state.records,
    ...starvation,
    ...passNow(state),
  };
}
