import type { TrackedEntry } from '@poe/contracts';
import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { bodiesWith, craftedEntry, hoursBefore, priced, rawEntry } from '../test-support/list-fixtures';
import { gatedArtifacts, serveArtifacts, VALID_BODIES } from '../test-support/artifact-server';
import { rgb, settleTo, unmount } from '../test-support/dom';
import { hover, leave } from '../test-support/hover';
import { MISSING_FIGURE } from '../list/row/ExpectedValueCell';
import { colors } from '../theme/tokens';
import { APPENDIX_NOTES, APPENDIX_TITLE, appendixCount } from '../list/UnrankableAppendix';
import { server, mount, frame, reportPanel, syncButton, toggleReport } from './test-support';

afterEach(unmount);

/** Served out of order (a stride-7 walk) so the page's order can only come from `core`'s sort. */
function twentyNineClasses(): ReturnType<typeof craftedEntry>[] {
  return Array.from({ length: 29 }, (_, index) => {
    const n = String(((index * 7) % 29) + 1).padStart(2, '0');
    return craftedEntry(`Class ${n}`, `fixture.class${n}`);
  });
}

/** The fixture's class names in the order the page must show them. */
function sortedClassNames(): string[] {
  return Array.from({ length: 29 }, (_, index) => `Class ${String(index + 1).padStart(2, '0')}`);
}

const ABSENT_REASON = 'class absent from weights file';

const tierOf = (statId: string, ranges: number[][]) => ({
  sourceModifierId: statId,
  modGroup: statId,
  itemLevelMin: 1,
  weight: 100,
  weightSource: 'published',
  lines: [{ statId, ranges }],
});
const poolsOf = (statId: string, ranges: number[][]) => ({
  prefix: { poolCoverage: 'complete', entries: [tierOf(statId, ranges)] },
  // The valueless suffix every `craftedEntry` carries.
  suffix: { poolCoverage: 'complete', entries: [tierOf('explicit.stat_1967051901', [])] },
});

function appendix(): HTMLElement {
  const found = frame().querySelector<HTMLElement>('[data-unrankable-appendix]');
  if (found === null) {
    throw new Error('no appendix rendered');
  }
  return found;
}

function appendixRows(): HTMLElement[] {
  return [...frame().querySelectorAll<HTMLElement>('[data-appendix-row]')];
}

/** The page tail's children, by their first data attribute. */
function tailOrder(): string[] {
  const tail = frame().querySelector<HTMLElement>('[data-page-tail]');
  return Array.from(tail?.children ?? [], (node) => Object.keys((node as HTMLElement).dataset)[0] ?? '');
}

describe('the Unrankable appendix', () => {
  afterEach(() => {
    localStorage.clear();
  });

  // Matrix: committed.
  it('renders the appendix on the frozen data fixture, above the footer legend, as the title alone', async () => {
    const committed = import.meta.glob<unknown>('../../../../test/fixtures/frozen-data/{dataset,tracked,recipes,weights}.json', {
      eager: true,
      import: 'default',
    });
    serveArtifacts(server, {
      tracked: { kind: 'json', body: committed['../../../../test/fixtures/frozen-data/tracked.json'] },
      dataset: { kind: 'json', body: committed['../../../../test/fixtures/frozen-data/dataset.json'] },
      recipes: { kind: 'json', body: committed['../../../../test/fixtures/frozen-data/recipes.json'] },
      weights: { kind: 'json', body: committed['../../../../test/fixtures/frozen-data/weights.json'] },
    });
    mount();
    await settleTo('ready');
    // Producer 6.1.0 declares every pool `complete`, and the recipe floor keeps each group's top
    // tier (AD-17), so every crafted pair of the fixture ranks and the appendix is empty.
    expect(appendixRows()).toEqual([]);
    expect(appendix().textContent).toBe(`${APPENDIX_TITLE}${appendixCount(0)}`);
    expect(tailOrder()).toEqual(['unrankableAppendix', 'footerLegend']);
    expect(frame().querySelector<HTMLElement>('[data-page-tail]')?.style.marginTop).toBe('auto');
    // The pin needs the tail to be a direct child of the flex frame.
    expect(frame().querySelector('[data-page-tail]')?.parentElement).toBe(frame());
    expect(frame().style.display).toBe('flex');
    expect(frame().style.flexDirection).toBe('column');
  });

  // Matrix: absent weights.
  it('lists 29 crafted classes when weights.json is absent, every row whole, then the footer legend', async () => {
    const now = Date.now();
    const belt = rawEntry('Wide Belt');
    const classes = twentyNineClasses();
    const bodies = bodiesWith([...classes, belt], [priced(belt, 0.5, hoursBefore(now, 1))]);
    serveArtifacts(server, {
      tracked: { kind: 'json', body: bodies.tracked },
      dataset: { kind: 'json', body: bodies.dataset },
      weights: { kind: 'status', status: 404 },
    });
    mount();
    await settleTo('ready');
    const rows = appendixRows();
    expect(rows).toHaveLength(29);
    expect(classes.map((entry) => entry.className)).not.toEqual(sortedClassNames());
    expect(rows.map((row) => row.querySelector('[data-appendix-class]')?.textContent)).toEqual(sortedClassNames());
    for (const row of rows) {
      expect(row.querySelector('[data-cell="reason"]')?.textContent).toBe(ABSENT_REASON);
      // State 15: every absent class carries its note, as no signal marks a fresh scrape.
      expect(row.querySelector('[data-cell="note"]')?.textContent).toBe(APPENDIX_NOTES[ABSENT_REASON]);
    }
    const count = appendix().querySelector<HTMLElement>('[data-appendix-count]');
    expect(count?.textContent).toBe('29 Item Classes');
    expect(count?.style.color).toBe(rgb(colors.text));
    // Readable with nothing expanded.
    expect(frame().querySelectorAll('[data-expansion-panel]')).toHaveLength(0);
    expect(tailOrder()).toEqual(['unrankableAppendix', 'footerLegend']);
    const order = Array.from(
      frame().querySelectorAll('[data-ranked-row], [data-appendix-row], [data-footer-legend]'),
      (node) => Object.keys((node as HTMLElement).dataset)[0],
    );
    expect(order).toEqual(['rankedRow', ...rows.map(() => 'appendixRow'), 'footerLegend']);
    // No appendix row is a Base Type.
    expect(appendix().textContent).not.toContain('Wide Belt');
  });

  // Matrix: absent weights and absent recipes.
  it('lists the same classes when weights.json and recipes.json are both absent', async () => {
    const bodies = bodiesWith(twentyNineClasses(), []);
    serveArtifacts(server, {
      tracked: { kind: 'json', body: bodies.tracked },
      dataset: { kind: 'json', body: bodies.dataset },
      weights: { kind: 'status', status: 404 },
      recipes: { kind: 'status', status: 404 },
    });
    mount();
    await settleTo('ready');
    expect(appendixRows()).toHaveLength(29);
    expect(appendix().querySelector('[data-appendix-count]')?.textContent).toBe('29 Item Classes');
  });

  // Matrix: web, a cross-file failure on one class (AD-17).
  it('excludes only the class a cross-file check fails, prints the reason alone, and lists the diagnosis in the panel', async () => {
    const now = Date.now();
    const belt = rawEntry('Wide Belt');
    const amulets = craftedEntry('Amulets', 'accessory.amulet');
    const sentinel: TrackedEntry = {
      ...craftedEntry('Bows', 'weapon.bow'),
      prefix: { kind: 'banded', statId: 'explicit.stat_1', valueMin: 0, valueMax: 9999 },
    };
    const weights = {
      ...(VALID_BODIES.weights as object),
      bases: {
        'accessory.amulet': { Amulets: poolsOf('explicit.stat_3299347043', []) },
        'weapon.bow': { Bows: poolsOf('explicit.stat_1', [[43, 56.5]]) },
      },
    };
    const bodies = bodiesWith([amulets, sentinel, belt], [priced(belt, 0.5, hoursBefore(now, 1))]);
    serveArtifacts(server, {
      tracked: { kind: 'json', body: bodies.tracked },
      dataset: { kind: 'json', body: bodies.dataset },
      weights: { kind: 'json', body: weights },
    });
    mount();
    await settleTo('ready');

    const rows = appendixRows();
    expect(rows.map((row) => row.querySelector('[data-appendix-class]')?.textContent)).toEqual(['Bows']);
    expect(rows[0]?.querySelector('[data-cell="reason"]')?.textContent).toBe('class disagrees with weights file');
    // Matrix: disagrees — the 15a note, no check name.
    expect(rows[0]?.querySelector('[data-cell="note"]')?.textContent).toBe(APPENDIX_NOTES['class disagrees with weights file']);
    expect(appendix().textContent).not.toContain('edge-alignment');
    // Amulets is rankable but no recipe is served: an unranked crafted row (state 43).
    expect(frame().querySelectorAll('[data-ranked-row]')).toHaveLength(2);

    // Listed in the sync report, never counted (state 27).
    expect(syncButton().dataset['syncButton']).toBe('synced');
    toggleReport();
    const problems = reportPanel()?.querySelectorAll('[data-panel-column]')[0];
    const lines = Array.from(problems?.querySelectorAll('[data-verbatim]') ?? [], (node) => node.textContent);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/^edge-alignment · \["crafted","weapon\.bow","Bows",82,/);
  });

  // State 43 and state 37: no recipe served.
  it('lists a rankable class with no recipe as an unnumbered pending row below the Raw Bases, and the appendix title alone', async () => {
    const now = Date.now();
    const belt = rawEntry('Wide Belt');
    const amulet = rawEntry('Gold Amulet');
    const amulets = craftedEntry('Amulets', 'accessory.amulet');
    const weights = {
      ...(VALID_BODIES.weights as object),
      bases: { 'accessory.amulet': { Amulets: poolsOf('explicit.stat_3299347043', []) } },
    };
    const bodies = bodiesWith([amulets, belt, amulet], [priced(belt, 0.5, hoursBefore(now, 1)), priced(amulet, 0.4, hoursBefore(now, 1))]);
    serveArtifacts(server, {
      tracked: { kind: 'json', body: bodies.tracked },
      dataset: { kind: 'json', body: bodies.dataset },
      weights: { kind: 'json', body: weights },
    });
    mount();
    await settleTo('ready');

    const rows = [...frame().querySelectorAll<HTMLElement>('[data-ranked-row]')];
    expect(rows.map((row) => row.querySelector('[data-unit-name]')?.textContent)).toEqual(['Wide Belt', 'Gold Amulet', 'Amulets']);
    expect(rows.map((row) => row.querySelector('[data-cell="rank"]')?.textContent)).toEqual(['1', '2', '']);
    const crafted = rows[2];
    expect(crafted?.querySelector('[data-ev-missing]')?.textContent).toBe(MISSING_FIGURE);
    expect(crafted?.querySelector<HTMLElement>('[data-row-mark]')?.dataset['rowMark']).toBe('pending');
    const mark = crafted?.querySelector('[data-row-mark]');
    hover(mark);
    expect(document.body.querySelector('[data-mark-tooltip]')?.textContent).toBe('pending · no recipe published');
    leave(mark);
    act(() => {
      crafted?.click();
    });
    const lines = [...frame().querySelectorAll<HTMLElement>('[data-expansion-panel] [data-expansion-line]')];
    expect(lines.map((line) => line.dataset['verdict'])).toEqual(['pending']);

    expect(appendix().textContent).toBe('Appendix: Unrankable — 0 Item Classes');
    expect(appendixRows()).toHaveLength(0);
  });

  // Matrix: no crafted entries.
  it('is the empty treatment when weights.json is absent and every entry is raw', async () => {
    const now = Date.now();
    const belt = rawEntry('Wide Belt');
    const bodies = bodiesWith([belt], [priced(belt, 0.5, hoursBefore(now, 1))]);
    serveArtifacts(server, {
      tracked: { kind: 'json', body: bodies.tracked },
      dataset: { kind: 'json', body: bodies.dataset },
      weights: { kind: 'status', status: 404 },
    });
    mount();
    await settleTo('ready');
    expect(appendix().textContent).toBe('Appendix: Unrankable — 0 Item Classes');
    expect(appendixRows()).toHaveLength(0);
  });

  // Matrix: loading.
  it('is absent while pending, and the tail keeps the footer legend', async () => {
    const held = gatedArtifacts();
    serveArtifacts(server, held.answers);
    mount();
    expect(frame().dataset['state']).toBe('pending');
    expect(frame().querySelector('[data-unrankable-appendix]')).toBeNull();
    expect(tailOrder()).toEqual(['footerLegend']);
    expect(frame().querySelector('[data-page-tail]')?.parentElement).toBe(frame());
    held.openAll();
    await settleTo('ready');
  });

  it('is absent from the refusal screen', async () => {
    serveArtifacts(server, { tracked: { kind: 'status', status: 404 } });
    mount();
    await settleTo('refused');
    expect(frame().querySelector('[data-unrankable-appendix]')).toBeNull();
  });

  it('is absent from the fetch-failure screen', async () => {
    serveArtifacts(server, { config: { kind: 'network-error' } });
    mount();
    await settleTo('failed');
    expect(frame().querySelector('[data-unrankable-appendix]')).toBeNull();
  });
});
