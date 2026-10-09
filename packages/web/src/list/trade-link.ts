import type { CurationStatus, DatasetEntry } from '@poe/contracts';

/** The trade site's search root. */
export const TRADE_SEARCH_ROOT = 'https://www.pathofexile.com/trade2/search/poe2';

/** What the link test reads: the two stored search fields and the Curation Status. Never the Price State. */
export type TradeLinkEntry = Pick<DatasetEntry, 'lastSearchId' | 'lastSearchLeague'> & {
  readonly status: CurationStatus;
};

/** The outbound link, or `undefined` for a blank cell (AD-24). */
export function tradeSearchHref(entry: TradeLinkEntry, activeLeague: string): string | undefined {
  const { lastSearchId, lastSearchLeague, status } = entry;
  return status === 'pruned' || lastSearchId === undefined || lastSearchLeague !== activeLeague ? undefined : `${TRADE_SEARCH_ROOT}/${encodeURIComponent(lastSearchLeague)}/${lastSearchId}`;
}
