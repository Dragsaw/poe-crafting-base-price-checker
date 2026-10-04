import type { SyncRunRecord } from '@poe/contracts';

import type { ChunkStep } from '../../run-chunk.ts';
import { raw, scriptedStep, SEVEN_HOURS_AGO } from '../test-support.ts';

/** P1–P3 pinned and A, B waiting: the first pinned step reports R=2, so P3 is cut. */
export function starvingStep(): ChunkStep {
  let remaining = 3;
  return scriptedStep((entry) => {
    remaining -= 1;
    return entry.status === 'pinned'
      ? { kind: 'completed', searchRemaining: remaining }
      : { kind: 'completed' };
  }).step;
}
export const D = raw('D');
export const E = raw('E');
export const P1 = raw('P1', 'pinned');
export const P2 = raw('P2', 'pinned');
export const P3 = raw('P3', 'pinned');
export const ZERO = { 'tracked-list': 0, 'league-validation': 0, 'session-probe': 0 };
export const BROKEN: SyncRunRecord = { kind: 'stale-lock-broken', pid: 7, startedAt: SEVEN_HOURS_AGO };

export function reportText(records: readonly SyncRunRecord[], schemaVersion = '1.0.0'): string {
  return JSON.stringify({
    runStartedAt: SEVEN_HOURS_AGO,
    runFinishedAt: SEVEN_HOURS_AGO,
    figures: { requestsBySource: { ...ZERO, 'tracked-list': 40 }, notReachedCount: 9 },
    records,
    schemaVersion,
  });
}
