import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { bodiesWith, hoursBefore, priced, rawEntry, unpriced } from '../test-support/list-fixtures';
import { serveArtifacts, TEST_LEAGUE } from '../test-support/artifact-server';
import { ARTIFACT_ORDER } from '../load/artifacts';
import { settleTo, unmount } from '../test-support/dom';
import { pastDebounce, typeInto } from '../test-support/threshold-input';
import { MISSING_FIGURE } from '../list/row/ExpectedValueCell';
import { server, mount, frame, payoutField, unitNames } from './test-support';

afterEach(unmount);

function serveBodies(bodies: ReturnType<typeof bodiesWith>): ReturnType<typeof serveArtifacts> {
  return serveArtifacts(server, {
    tracked: { kind: 'json', body: bodies.tracked },
    dataset: { kind: 'json', body: bodies.dataset },
  });
}

function statement(): HTMLElement | null {
  return frame().querySelector<HTMLElement>('[data-list-statement]');
}

function numerals(): string[] {
  return Array.from(frame().querySelectorAll('[data-ranked-row] [data-cell="rank"]'), (node) => node.textContent ?? '');
}

function eventCells(): string[] {
  return Array.from(frame().querySelectorAll('[data-ranked-row] [data-cell="ev"]'), (node) => node.textContent ?? '');
}

function expectChromeAround(): void {
  for (const attribute of ['data-asking-price-line', 'data-unrankable-appendix', 'data-key-block', 'data-running-foot']) {
    expect(frame().querySelector(`[${attribute}]`), attribute).not.toBeNull();
  }
}

describe('the list statement', () => {
  afterEach(() => {
    localStorage.clear();
  });

  // Matrix: league reset.
  it('lists a league reset in canonical order, with no numerals, a dash in every EV cell and the canonical statement', async () => {
    const now = Date.now();
    const belt = rawEntry('Wide Belt');
    const ring = rawEntry('Coral Ring');
    const amulet = rawEntry('Gold Amulet');
    serveBodies(
      bodiesWith(
        [belt, ring, amulet],
        [
          priced(belt, 1.5, hoursBefore(now, 30 * 24), { league: 'Standard' }),
          priced(ring, 0.8, hoursBefore(now, 30 * 24), { league: 'Standard' }),
          priced(amulet, 2, hoursBefore(now, 30 * 24), { league: 'Standard' }),
        ],
      ),
    );
    mount();
    await settleTo('ready');
    expect(statement()?.dataset['listStatement']).toBe('honest-empty');
    expect(statement()?.textContent).toBe(
      `In canonical order, not ranked: no tracked unit has a price from ${TEST_LEAGUE} yet.`,
    );
    // Under the asking-price line, above the column header.
    expect(statement()?.previousElementSibling?.hasAttribute('data-asking-price-line')).toBe(true);
    expect(statement()?.nextElementSibling?.querySelector('[data-column-header]')).not.toBeNull();
    expect(statement()?.style.height).toBe('21px');
    // Canonical key order: for three iLvl-82 raw bases, the base type ids in order.
    expect(unitNames()).toEqual(['Coral Ring', 'Gold Amulet', 'Wide Belt']);
    expect(numerals()).toEqual(['', '', '']);
    expect(eventCells()).toEqual([MISSING_FIGURE, MISSING_FIGURE, MISSING_FIGURE]);
    // None of last league's figures, anywhere on the list.
    expect(frame().querySelector('[data-ranked-list]')?.textContent).not.toMatch(/\d\.\d\d/);

    const first = frame().querySelector<HTMLElement>('[data-ranked-row]');
    act(() => {
      first?.click();
    });
    expect(frame().querySelector('[data-expansion-panel] [data-cell="state"]')?.textContent).toBe(
      '∆\u{A0}not-yet-synced · league-mismatch',
    );
    expectChromeAround();
  });

  // Matrix: mixed reset. A league reset mid-refill, where one entry already reads no-listings.
  it('lists a mixed reset in canonical order across both unpriced groups, a dash in every EV cell', async () => {
    const now = Date.now();
    const belt = rawEntry('Wide Belt');
    const ring = rawEntry('Coral Ring');
    const amulet = rawEntry('Gold Amulet');
    serveBodies(
      bodiesWith(
        [belt, ring, amulet],
        [
          priced(belt, 1.5, hoursBefore(now, 30 * 24), { league: 'Standard' }),
          priced(ring, 0.8, hoursBefore(now, 30 * 24), { league: 'Standard' }),
          unpriced(amulet, { state: 'no-listings' }, hoursBefore(now, 2)),
        ],
      ),
    );
    mount();
    await settleTo('ready');
    expect(statement()?.dataset['listStatement']).toBe('honest-empty');
    expect(statement()?.textContent).toBe(
      `In canonical order, not ranked: no tracked unit has a price from ${TEST_LEAGUE} yet.`,
    );
    // Canonical key order across the groups, not no-listings first.
    expect(unitNames()).toEqual(['Coral Ring', 'Gold Amulet', 'Wide Belt']);
    expect(numerals()).toEqual(['', '', '']);
    expect(eventCells()).toEqual([MISSING_FIGURE, MISSING_FIGURE, MISSING_FIGURE]);
    expect(frame().querySelector('[data-ranked-list]')?.textContent).not.toMatch(/\d\.\d\d/);

    // The no-listings row's expansion keeps its own state and phrase.
    const amuletRow = frame().querySelectorAll<HTMLElement>('[data-ranked-row]')[1];
    act(() => {
      amuletRow?.click();
    });
    const panel = frame().querySelector('[data-expansion-panel]');
    expect(panel?.querySelector('[data-cell="state"]')?.textContent).toContain('no-listings');
    expect(panel?.querySelector('[data-cell="figure"]')?.textContent).toBe('an open question');
  });

  // Matrix: partial refresh.
  it('ranks a partial refresh normally, with no statement', async () => {
    const now = Date.now();
    const belt = rawEntry('Wide Belt');
    const ring = rawEntry('Coral Ring');
    serveBodies(
      bodiesWith(
        [belt, ring],
        [priced(belt, 1.5, hoursBefore(now, 1)), priced(ring, 0.8, hoursBefore(now, 30 * 24), { league: 'Standard' })],
      ),
    );
    mount();
    await settleTo('ready');
    expect(statement()).toBeNull();
    expect(unitNames()).toEqual(['Wide Belt', 'Coral Ring']);
    expect(numerals()).toEqual(['1', '']);
    expect(eventCells()).toEqual(['1.50', MISSING_FIGURE]);
    expect(frame().textContent).not.toMatch(/stale/i);
    expectChromeAround();
  });

  // Matrix: nothing clears, then threshold lowered.
  it('states that nothing clears 3.00, keeps the trail rows, and drops the statement once a row clears', async () => {
    const now = Date.now();
    const belt = rawEntry('Wide Belt');
    const ring = rawEntry('Coral Ring');
    const never = rawEntry('Lost Belt');
    const requests = serveBodies(
      bodiesWith([belt, ring, never], [priced(belt, 1.5, hoursBefore(now, 1)), priced(ring, 0.8, hoursBefore(now, 1))]),
    );
    mount();
    await settleTo('ready');
    expect(statement()).toBeNull();

    typeInto(payoutField(), '3');
    await pastDebounce();
    expect(statement()?.dataset['listStatement']).toBe('nothing-clears');
    expect(statement()?.textContent).toBe('Nothing clears your Payout Threshold of 3.00 Divine.');
    expect(statement()?.previousElementSibling?.hasAttribute('data-asking-price-line')).toBe(true);
    // Not a money-slot phrase: the trail row keeps its own phrase, as it was.
    expect(unitNames()).toEqual(['Lost Belt']);
    expect(eventCells()).toEqual([MISSING_FIGURE]);
    expectChromeAround();

    typeInto(payoutField(), '1');
    await pastDebounce();
    expect(statement()).toBeNull();
    expect(unitNames()).toEqual(['Wide Belt', 'Lost Belt']);
    expect(numerals()).toEqual(['1', '']);
    expect(requests).toHaveLength(ARTIFACT_ORDER.length);
  });

  it('prints no recipes.json absence line on the frozen data fixture, and the control prints its two recipes', async () => {
    const committed = import.meta.glob<unknown>('../../../../test/fixtures/frozen-data/{dataset,tracked,recipes}.json', {
      eager: true,
      import: 'default',
    });
    const recipes = committed['../../../../test/fixtures/frozen-data/recipes.json'];
    serveArtifacts(server, {
      tracked: { kind: 'json', body: committed['../../../../test/fixtures/frozen-data/tracked.json'] },
      dataset: { kind: 'json', body: committed['../../../../test/fixtures/frozen-data/dataset.json'] },
      recipes: { kind: 'json', body: recipes },
    });
    mount();
    await settleTo('ready');
    expect((recipes as { readonly recipes: readonly unknown[] }).recipes).toHaveLength(2);
    expect(frame().querySelector('[data-recipe-options]')?.textContent).toBe('greater|perfect');
    // The committed dataset now has an orb rate: the cost line is a figure, not the no-figure one.
    expect(frame().querySelector('[data-recipe-cost]')?.textContent).toBe('0.01Divine / craft');
    expect(frame().querySelector('[data-absence-lines]')).toBeNull();
    expect(frame().textContent).not.toContain('recipes.json');
    expect(statement()).toBeNull();
    expect(frame().textContent).not.toContain('not ranked yet');
  });
});
