/**
 * The run-start cross-file gate (AD-12, AD-17, FR-33).
 *
 * `core`'s `crossFileChecks` is the one definition of the six checks; this
 * module only calls it. Any failure throws `CrossFileGateError` before the
 * order exists, so the chunk spends no budget, publishes nothing and leaves
 * `sync-progress.json` untouched. The report carries one
 * `cross-file-gate-failure` record per failure, and the run exits non-zero.
 * The gate ignores the unvalidated marks: a mark is never a failure, and none
 * reaches the report (IMPLEMENTATION-NOTES §2.8). With the weights file absent
 * there is nothing to check (AD-24).
 */

import type { CrossFileGateFailureRecord, TrackedEntry, WeightsFile } from '@poe/contracts';
import { crossFileChecks } from '@poe/core';
import type { CrossFileFailure } from '@poe/core';

export class CrossFileGateError extends Error {
  readonly failures: readonly CrossFileFailure[];

  constructor(failures: readonly CrossFileFailure[]) {
    const [first] = failures;
    const verdict = failures.length === 1 ? 'check fails' : 'checks fail';
    const firstClause = first === undefined ? '' : `, first ${first.check} on ${first.entryKey}: ${first.detail}`;
    super(
      `the tracked list disagrees with the weights file: ${String(failures.length)} cross-file ${verdict}${firstClause}`,
    );
    this.name = 'CrossFileGateError';
    this.failures = failures;
  }
}

/** Throws `CrossFileGateError` on any failure; returns on a clean or absent file. */
export function crossFileGate(entries: readonly TrackedEntry[], weights: WeightsFile | undefined): void {
  const { failures } = crossFileChecks(entries, weights);
  if (failures.length > 0) {
    throw new CrossFileGateError(failures);
  }
}

/** One record per failure, in the checks' own order (§12: `check` + `entryKey` is the subject). */
export function crossFileGateRecords(error: CrossFileGateError): CrossFileGateFailureRecord[] {
  return error.failures.map((failure) => ({
    kind: 'cross-file-gate-failure',
    check: failure.check,
    entryKey: failure.entryKey,
    detail: failure.detail,
  }));
}
