import { describe, expect, it } from 'vitest';

import { TRADE_SEARCH_ROOT, tradeSearchHref } from './trade-link';

const LEAGUE = 'Forbidden Rites';

describe('tradeSearchHref', () => {
  it('builds the §5.4 URL, encoding the league segment alone', () => {
    expect(tradeSearchHref({ lastSearchId: 'Ab/C+d', lastSearchLeague: LEAGUE, status: 'active' }, LEAGUE)).toBe(
      'https://www.pathofexile.com/trade2/search/poe2/Forbidden%20Rites/Ab/C+d',
    );
    expect(TRADE_SEARCH_ROOT).toBe('https://www.pathofexile.com/trade2/search/poe2');
  });

  it('links a pinned entry', () => {
    expect(tradeSearchHref({ lastSearchId: 'x', lastSearchLeague: LEAGUE, status: 'pinned' }, LEAGUE)).toBe(
      `${TRADE_SEARCH_ROOT}/Forbidden%20Rites/x`,
    );
  });

  it('is undefined with no stored search', () => {
    expect(tradeSearchHref({ status: 'active' }, LEAGUE)).toBeUndefined();
    expect(tradeSearchHref({ lastSearchLeague: LEAGUE, status: 'active' }, LEAGUE)).toBeUndefined();
  });

  it('is undefined for a search from another league', () => {
    expect(tradeSearchHref({ lastSearchId: 'x', lastSearchLeague: 'Standard', status: 'active' }, LEAGUE)).toBeUndefined();
    expect(tradeSearchHref({ lastSearchId: 'x', status: 'active' }, LEAGUE)).toBeUndefined();
  });

  it('is undefined for a pruned entry', () => {
    expect(tradeSearchHref({ lastSearchId: 'x', lastSearchLeague: LEAGUE, status: 'pruned' }, LEAGUE)).toBeUndefined();
  });
});
