// Run-start cross-file gate (AD-12, AD-17, FR-33): `core`'s `crossFileChecks` owns the six checks.
// A failure throws before the order exists, so no budget is spent and nothing is published.
// Unvalidated marks never fail it; no weights file is skipped (AD-24).

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

/** One record per failure, in the checks' own order. */
export function crossFileGateRecords(error: CrossFileGateError): CrossFileGateFailureRecord[] {
  return error.failures.map((failure) => ({
    kind: 'cross-file-gate-failure',
    check: failure.check,
    entryKey: failure.entryKey,
    detail: failure.detail,
  }));
}
