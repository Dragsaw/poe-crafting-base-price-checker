import type { DatasetEntry } from '@poe/contracts';
import { afterEach, describe, expect, it } from 'vitest';

import { cellIn as cell, NOW, rgb, unmount } from '../../test-support/dom';
import { hoursBefore, priced, rawEntry, unpriced } from '../../test-support/list-fixtures';
import { colors } from '../../theme/tokens';
import { CURATION_MARKS } from '../format';
import { MISSING_FIGURE } from '../row/ExpectedValueCell';
import { FIXED_ROW_REASONS, NO_LISTINGS_LINE, rowReasonWords, TRUST_JOINER, VERDICT_WORDS } from '../row/trust-words';
import { HREF, lineText, openOne, SEARCH } from './test-support';

afterEach(unmount);

const DAY_HOURS = 24;

const trustText = (word: string, ...reasons: string[]): string => [word, ...reasons].join(TRUST_JOINER);

function withSample(entry: DatasetEntry, sampleSize: number): DatasetEntry {
  if (entry.price.state !== 'priced') {
    throw new Error('fixture');
  }
  return { ...entry, price: { ...entry.price, observation: { ...entry.price.observation, sampleSize } } };
}

describe('the Raw Base expansion line', () => {
  // Matrix: priced, current; Raw Base (state 1).
  it('prints a current price with no Combination text, an empty trust cell and a drawn ↗', () => {
    const belt = rawEntry('Wide Belt', 82);
    const line = openOne(belt, priced(belt, 0.8, hoursBefore(NOW, 11), { search: SEARCH }));
    expect(lineText(line)).toEqual(['', '0.80', '']);
    expect(cell(line, 'trust').childNodes).toHaveLength(0);
    const link = cell(line, 'trade-link').querySelector<HTMLAnchorElement>('a');
    expect(link?.getAttribute('href')).toBe(HREF);
    expect(link?.target).toBe('_blank');
    expect(link?.rel).toBe('noopener');
    expect(link?.textContent).toBe('');
    expect(link?.querySelector('svg[data-mark="trade-link"]')).not.toBeNull();
    expect(link?.getAttribute('aria-label')).toBe('Open the trade search for Wide Belt');
  });

  it('prints a tiny price as < 0.01', () => {
    const belt = rawEntry('Wide Belt');
    const line = openOne(belt, priced(belt, 0.003, hoursBefore(NOW, 2)), 0);
    expect(cell(line, 'price').textContent).toBe('< 0.01');
  });

  // Matrix: rough, old 4 and thin 2. The age leads; no listing count prints elsewhere.
  it('prints ◐ rough with both reasons, age first', () => {
    const belt = rawEntry('Wide Belt');
    const line = openOne(belt, withSample(priced(belt, 0.8, hoursBefore(NOW, 4 * DAY_HOURS + 1)), 2));
    expect(lineText(line)).toEqual([
      '',
      '0.80',
      trustText(VERDICT_WORDS.rough, rowReasonWords({ kind: 'old', days: 4 }), rowReasonWords({ kind: 'thin', listings: 2 })),
    ]);
    expect(cell(line, 'trust').querySelector('[data-line-mark="rough"] svg[data-mark="rough"]')).not.toBeNull();
  });

  // Matrix: no listings, days 2 (state 2). The attempt's clock, not the tooltip's words.
  it('prints — and ○ pending with the attempt age on a no-listings entry', () => {
    const ring = rawEntry('Coral Ring');
    const line = openOne(ring, unpriced(ring, { state: 'no-listings' }, hoursBefore(NOW, 2 * DAY_HOURS + 3), SEARCH));
    expect(lineText(line)).toEqual([
      '',
      MISSING_FIGURE,
      trustText(VERDICT_WORDS.pending, `tried 2 days ago${TRUST_JOINER}${NO_LISTINGS_LINE}`),
    ]);
    expect(cell(line, 'trust').textContent).not.toContain(FIXED_ROW_REASONS['no-listings']);
    expect(cell(line, 'trust').querySelector('svg[data-mark="pending"]')).not.toBeNull();
    // The link test reads the stored search, never the trust verdict.
    expect(cell(line, 'trade-link').querySelector('a')?.getAttribute('href')).toBe(HREF);
  });

  // Matrix: not yet synced (states 5–7). Three causes, three reasons, no age.
  const coral = rawEntry('Coral Ring');
  const longAgo = hoursBefore(NOW, 6 * DAY_HOURS);
  it.each([
    ['never-synced', undefined],
    ['league-mismatch', priced(coral, 3, longAgo, { league: 'Standard' })],
    ['no-exchange-rate', unpriced(coral, { state: 'not-yet-synced', reason: 'no-exchange-rate' }, longAgo)],
  ] as const)('prints — and ○ pending with the %s reason and no age', (reason, published) => {
    const line = openOne(coral, published);
    expect(lineText(line)).toEqual(['', MISSING_FIGURE, trustText(VERDICT_WORDS.pending, FIXED_ROW_REASONS[reason])]);
    expect(cell(line, 'trust').textContent).not.toContain('ago');
  });

  // Matrix: broken (state 4).
  it('prints — and ✕ broken on an unresolvable entry', () => {
    const ring = rawEntry('Lost Ring');
    const line = openOne(ring, unpriced(ring, { state: 'unresolvable' }, hoursBefore(NOW, 5), SEARCH));
    expect(lineText(line)).toEqual(['', MISSING_FIGURE, trustText(VERDICT_WORDS.broken, FIXED_ROW_REASONS.unresolvable)]);
    expect(cell(line, 'trust').querySelector('svg[data-mark="broken"]')).not.toBeNull();
  });

  // Matrix: foreign search. A `lastSearchId` from another league leaves the cell empty.
  it('leaves the link cell empty for a search stored under another league', () => {
    const ring = rawEntry('Coral Ring');
    const line = openOne(
      ring,
      unpriced(ring, { state: 'no-listings' }, hoursBefore(NOW, 3), { id: 'old', league: 'Standard' }),
    );
    expect(cell(line, 'trade-link').childNodes).toHaveLength(0);
  });

  // Matrix: pinned (state 9).
  it('leads a pinned line with * pinned, at 600 in text-tertiary', () => {
    const belt = { ...rawEntry('Wide Belt'), status: 'pinned' as const };
    const line = openOne(belt, priced(belt, 0.8, hoursBefore(NOW, 1)));
    expect(cell(line, 'combination').textContent).toBe(CURATION_MARKS.pinned);
    const mark = cell(line, 'combination').querySelector<HTMLElement>('[data-curation="pinned"]');
    expect(mark?.style.fontWeight).toBe('600');
    expect(mark?.style.color).toBe(rgb(colors['text-tertiary']));
  });
});
