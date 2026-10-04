/**
 * The trade data endpoints, spelled **once** (AD-25, AD-12).
 *
 * Two commands read the same four URLs: `fixtures:record` captures them under
 * `fixtures/`, and `catalogue:refresh` commits them under `data/catalogue/`. A
 * URL spelled in two modules is a URL that can drift in one of them, and the
 * drift would show up as a fixture that no longer describes the artifact the
 * product validates ids against.
 *
 * This module declares data only — no request, no client, no filesystem.
 */

/** `IMPLEMENTATION-NOTES.md` §5.1: realm `poe2` on the `trade2` API. */
export const TRADE_API_BASE = 'https://www.pathofexile.com/api/trade2';

/**
 * The one lane label every data GET shares.
 *
 * The label is **opaque to the client**, which learns the policy behind it from
 * `X-Rate-Limit-Policy`. Sharing it is what makes four requests pace against one
 * ledger entry rather than seeding four cold lanes that each issue unpaced.
 */
export const DATA_LANE = 'trade-data-get';

/**
 * The leagues endpoint. It is recorded as a fixture and is **not** part of the
 * catalogue: `catalogue:refresh` costs exactly four requests (AD-25). The
 * run-start league gate (`../league/league-gate.ts`, AD-19) sends one GET here
 * per chunk, in `DATA_LANE`, counted as `league-validation`.
 */
export const TRADE_LEAGUES_URL = `${TRADE_API_BASE}/data/leagues`;

/** `IMPLEMENTATION-NOTES.md` §5.1: the realm segment of every search and fetch path. */
const TRADE_REALM = 'poe2';

/**
 * The lane labels the pricing step's two requests travel in. Like
 * `DATA_LANE`, each is **opaque to the client**, which learns the policy
 * behind it from `X-Rate-Limit-Policy`. Two labels, because a search and a
 * fetch spend against two different buckets (AD-8).
 */
export const SEARCH_LANE = 'trade-search-post';
export const FETCH_LANE = 'trade-fetch-get';

/**
 * The search URL, `/search/poe2/{league}` (`IMPLEMENTATION-NOTES.md` §5.1).
 * **Only the league segment is percent-encoded**: live league ids carry
 * spaces, and an unencoded segment silently addresses another path (§5.4).
 */
export function tradeSearchUrl(league: string): string {
  return `${TRADE_API_BASE}/search/${TRADE_REALM}/${encodeURIComponent(league)}`;
}

/**
 * The fetch URL for up to ten result ids of one search:
 * `/fetch/{id,id,…}?query={searchId}&realm=poe2`. The ids and the search id
 * are the trade site's own opaque strings; each is encoded as one component so
 * a stray character can never split the path.
 */
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

/**
 * The four data endpoints the catalogue is made of.
 *
 * The order is the recorder's original capture order, kept so that a re-record
 * diffs as changed data rather than as a reordered capture.
 *
 * **No consumer** can observe it — a successful refresh writes all four — but
 * the suite does: the partial-write case in `catalogue-refresh.test.ts` names
 * `items` and `stats` as the two that land before `filters` refuses. That
 * assertion is a deliberate pin on the write order, not an accident, so
 * reordering this array is a test change as well as a data change.
 */
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
