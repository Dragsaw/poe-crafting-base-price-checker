import { afterEach, describe, expect, it, vi } from 'vitest';

import { TEST_LEAGUE } from '../../test-support/artifact-server';
import { cellIn as cell, mountList, NOW, rowsIn, unmount } from '../../test-support/dom';
import { hoursBefore, priced, rawEntry } from '../../test-support/list-fixtures';
import { click, openOne, panelsIn, SEARCH } from './test-support';

afterEach(() => {
  unmount();
  vi.restoreAllMocks();
});

// jsdom does not navigate; keep it from trying.
const stop = (event: Event): void => {
  event.preventDefault();
};

describe('the trade link', () => {
  it('does not toggle the row on a click, and no request fires on expand or on the click', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const openSpy = vi.spyOn(globalThis, 'open').mockImplementation(() => null); // eslint-disable-line unicorn/no-null -- boundary: `window.open` is typed to return `WindowProxy | null`, so the stub must return null.
    const belt = rawEntry('Wide Belt');
    const view = mountList([belt], [priced(belt, 0.8, hoursBefore(NOW, 1), { search: SEARCH })]);
    click(rowsIn(view)[0]);
    const link = view.querySelector<HTMLAnchorElement>('[data-cell="trade-link"] a');
    document.addEventListener('click', stop);
    try {
      click(link);
    } finally {
      document.removeEventListener('click', stop);
    }
    expect(rowsIn(view)[0]?.hasAttribute('data-open')).toBe(true);
    expect(panelsIn(view)).toHaveLength(1);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(openSpy).not.toHaveBeenCalled();
  });

  // Matrix: league with spaces.
  it('encodes the league segment alone', () => {
    const belt = rawEntry('Wide Belt');
    const row = openOne(belt, priced(belt, 0.8, hoursBefore(NOW, 1), { search: { id: 'A/b+c', league: TEST_LEAGUE } }));
    expect(cell(row, 'trade-link').querySelector('a')?.getAttribute('href')).toBe(
      'https://www.pathofexile.com/trade2/search/poe2/Forbidden%20Rites/A/b+c',
    );
  });
});
