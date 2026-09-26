import type { CurationStatus, DatasetEntry } from '@poe/contracts';

/** The trade site's search root (IMPLEMENTATION-NOTES.md §5.4). */
export const TRADE_SEARCH_ROOT = 'https://www.pathofexile.com/trade2/search/poe2';

/** What the link test reads: the two stored search fields and the Curation Status. Never the Price State. */
export type TradeLinkEntry = Pick<DatasetEntry, 'lastSearchId' | 'lastSearchLeague'> & {
  readonly status: CurationStatus;
};

/**
 * The outbound link for one entry (AD-24, IMPLEMENTATION-NOTES.md §5.4), or
 * `undefined` where the cell is blank. It renders only when the entry carries
 * a stored `lastSearchId`, that search's `lastSearchLeague` equals the active
 * league, and the entry is not `pruned`. The league segment alone is
 * percent-encoded: live league ids carry spaces, and an unencoded segment
 * silently 404s. The id is stored verbatim and passed through verbatim.
 */
export function tradeSearchHref(entry: TradeLinkEntry, activeLeague: string): string | undefined {
  const { lastSearchId, lastSearchLeague, status } = entry;
  if (status === 'pruned' || lastSearchId === undefined || lastSearchLeague !== activeLeague) {
    return undefined;
  }
  return `${TRADE_SEARCH_ROOT}/${encodeURIComponent(lastSearchLeague)}/${lastSearchId}`;
}
