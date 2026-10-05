import type { DatasetEntry } from '@poe/contracts';

import type { RequestKind } from './price-entry.ts';

/**
 * A 2xx body of the wrong shape aborts the chunk; `entry` has search fields after a search (AD-9).
 */
export class UnexpectedTradeResponseError extends Error {
  readonly entryKey: string;
  readonly requestKind: RequestKind;
  readonly entry?: DatasetEntry;

  constructor(entryKey: string, requestKind: RequestKind, detail: string, entry?: DatasetEntry) {
    super(`${entryKey}: the trade ${requestKind} answered an unexpected body: ${detail}`);
    this.name = 'UnexpectedTradeResponseError';
    this.entryKey = entryKey;
    this.requestKind = requestKind;
    if (entry !== undefined) {
      this.entry = entry;
    }
  }
}
