// Spelled once so `fixtures:record` and `catalogue:refresh` cannot drift apart (AD-25, AD-12).
// Data only: no request, no client, no filesystem.

/** `IMPLEMENTATION-NOTES.md` §5.1: realm `poe2` on the `trade2` API. */
export const TRADE_API_BASE = 'https://www.pathofexile.com/api/trade2';

/** One shared label, so the four data GETs pace against one ledger entry, not four cold lanes. */
export const DATA_LANE = 'trade-data-get';

// Not part of the catalogue: `catalogue:refresh` costs exactly four requests (AD-25).
// The run-start league gate (AD-19) GETs it in `DATA_LANE`.
export const TRADE_LEAGUES_URL = `${TRADE_API_BASE}/data/leagues`;

/** `IMPLEMENTATION-NOTES.md` §5.1: the realm segment of every search and fetch path. */
const TRADE_REALM = 'poe2';

/** Two labels, because a search and a fetch spend against two different buckets (AD-8). */
export const SEARCH_LANE = 'trade-search-post';
export const FETCH_LANE = 'trade-fetch-get';

// Only the league segment is percent-encoded: ids carry spaces (IMPLEMENTATION-NOTES.md §5.4).
export function tradeSearchUrl(league: string): string {
  return `${TRADE_API_BASE}/search/${TRADE_REALM}/${encodeURIComponent(league)}`;
}

/** Each id is encoded as one component, so a stray character cannot split the path. */
export function tradeFetchUrl(ids: readonly string[], searchId: string): string {
  const segment = ids.map((id) => encodeURIComponent(id)).join(',');
  return `${TRADE_API_BASE}/fetch/${segment}?query=${encodeURIComponent(searchId)}&realm=${TRADE_REALM}`;
}

/** The four committed catalogue artifacts, named by their file stem. */
export type CatalogueArtifact = 'items' | 'stats' | 'filters' | 'static';

export interface CatalogueEndpoint {
  /** Names the artifact, and with it the file stem on both sides. */
  readonly artifact: CatalogueArtifact;
  readonly url: string;
  /** Where the refreshed artifact is committed, relative to the repository root. */
  readonly outputPath: string;
}

// Order is pinned: `catalogue-refresh.test.ts` expects `items` and `stats` before `filters`.
export const CATALOGUE_ENDPOINTS: readonly CatalogueEndpoint[] = [
  {
    artifact: 'items',
    url: `${TRADE_API_BASE}/data/items`,
    outputPath: 'data/catalogue/items.json',
  },
  {
    artifact: 'stats',
    url: `${TRADE_API_BASE}/data/stats`,
    outputPath: 'data/catalogue/stats.json',
  },
  {
    artifact: 'filters',
    url: `${TRADE_API_BASE}/data/filters`,
    outputPath: 'data/catalogue/filters.json',
  },
  {
    artifact: 'static',
    url: `${TRADE_API_BASE}/data/static`,
    outputPath: 'data/catalogue/static.json',
  },
];
