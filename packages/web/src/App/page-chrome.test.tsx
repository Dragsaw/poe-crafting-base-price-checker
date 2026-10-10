import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { COLUMN_LABELS } from '../list/ColumnHeader';
import { FOOTER_LEGEND_ITEMS } from '../list/FooterLegend';
import { VERDICT_WORDS } from '../list/row/trust-words';
import { MARK_COLORS } from '../marks/marks';
import { MISSING_FIGURE } from '../list/row/ExpectedValueCell';
import { bodiesWith, hoursBefore, priced, rawEntry, unpriced } from '../test-support/list-fixtures';
import { gatedArtifacts, serveArtifacts } from '../test-support/artifact-server';
import { flush, rgb, settleTo, unmount } from '../test-support/dom';
import { colors, footerLegend, px, spacing, typeRoles } from '../theme/tokens';
import { server, mount, frame } from './test-support';

afterEach(unmount);

describe('the resting chrome', () => {
  function chrome(): Record<string, boolean> {
    return Object.fromEntries(
      ['data-column-header', 'data-footer-legend'].map((attribute) => [
        attribute,
        frame().querySelector(`[${attribute}]`) !== null,
      ]),
    );
  }
  const ALL = {
    'data-column-header': true,
    'data-footer-legend': true,
  };
  const NONE = Object.fromEntries(Object.keys(ALL).map((key) => [key, false]));

  // Matrix: skeleton.
  // Matrix: pending.
  it('paints the labelled header, the slots and the footer legend while pending, with no appendix', () => {
    const held = gatedArtifacts();
    serveArtifacts(server, held.answers);
    mount();
    expect(frame().dataset['state']).toBe('pending');
    expect(chrome()).toEqual(ALL);
    expect(frame().querySelector('[data-column-header]')?.textContent).toContain(COLUMN_LABELS.name);
    // The legend carries the asking-price sentence (FR-13), in text-secondary, never the accent.
    const asking = FOOTER_LEGEND_ITEMS.at(-1)?.meaning ?? '';
    expect(frame().querySelector('[data-footer-legend]')?.textContent).toContain(asking);
    expect(frame().querySelector<HTMLElement>('[data-footer-legend]')?.style.color).toBe(rgb(colors['text-secondary']));
    expect(frame().querySelector('[data-unrankable-appendix]')).toBeNull();
    held.openAll();
  });

  it('renders the chrome in order around the ranked rows when ready', async () => {
    const now = Date.now();
    const belt = rawEntry('Wide Belt');
    const ring = rawEntry('Coral Ring');
    const lost = rawEntry('Lost Ring');
    const bodies = bodiesWith(
      [belt, ring, lost],
      [
        priced(belt, 0.5, hoursBefore(now, 3)),
        unpriced(ring, { state: 'no-listings' }, hoursBefore(now, 9 * 24 + 2)),
        unpriced(lost, { state: 'unresolvable' }, hoursBefore(now, 1)),
      ],
    );
    serveArtifacts(server, {
      tracked: { kind: 'json', body: bodies.tracked },
      dataset: { kind: 'json', body: bodies.dataset },
    });
    mount();
    await settleTo('ready');
    expect(chrome()).toEqual(ALL);
    const order = Array.from(
      frame().querySelectorAll(
        '[data-header-bar], [data-sync-report-panel], [data-list-statement], [data-column-header], [data-ranked-row], [data-unrankable-appendix], [data-footer-legend]',
      ),
      (node) => Object.keys((node as HTMLElement).dataset)[0],
    );
    expect(order).toEqual([
      'headerBar',
      'columnHeader',
      'rankedRow',
      'rankedRow',
      'rankedRow',
      'unrankableAppendix',
      'footerLegend',
    ]);
    const rows = frame().querySelectorAll('[data-ranked-row]');
    expect(rows[0]?.textContent).toContain('0.50');
    expect(rows[1]?.querySelector('[data-cell="ev"]')?.textContent).toBe(MISSING_FIGURE);
    expect(rows[1]?.querySelector<HTMLElement>('[data-row-mark]')?.dataset['rowMark']).toBe('pending');
    // Matrix: unresolvable — a trailing row, broken.
    expect(rows[2]?.textContent).toContain('Lost Ring');
    expect(rows[2]?.querySelector<HTMLElement>('[data-row-mark]')?.dataset['rowMark']).toBe('broken');
  });

  it('paints none of it on the refusal screen', async () => {
    serveArtifacts(server, { tracked: { kind: 'status', status: 404 } });
    mount();
    await settleTo('refused');
    expect(chrome()).toEqual(NONE);
  });

  it('paints none of it on the fetch-failure screen', async () => {
    serveArtifacts(server, { config: { kind: 'network-error' } });
    mount();
    await settleTo('failed');
    expect(chrome()).toEqual(NONE);
  });

  it('ranks the frozen data fixture into rows, dropping the below-threshold bases', async () => {
    const committed = import.meta.glob<unknown>('../../../../test/fixtures/frozen-data/{dataset,tracked}.json', { eager: true, import: 'default' });
    const dataset = committed['../../../../test/fixtures/frozen-data/dataset.json'];
    const tracked = committed['../../../../test/fixtures/frozen-data/tracked.json'];
    serveArtifacts(server, { tracked: { kind: 'json', body: tracked }, dataset: { kind: 'json', body: dataset } });
    mount();
    await settleTo('ready');
    const rows = [...frame().querySelectorAll('[data-ranked-row]')];
    expect(rows.map((row) => row.querySelector('[data-unit-name]')?.textContent)).toEqual(['Gold Amulet']);
    expect(frame().textContent).not.toContain('Solar Amulet');
    expect(frame().textContent).not.toContain('Utility Belt');
    for (const row of rows) {
      expect(row.querySelectorAll('[data-sell-as-is]')).toHaveLength(1);
    }
  });

  it('opens a panel on the frozen data fixture, the priced row linking a Forbidden%20Rites search, with no request', async () => {
    const committed = import.meta.glob<unknown>('../../../../test/fixtures/frozen-data/{dataset,tracked}.json', { eager: true, import: 'default' });
    const requests = serveArtifacts(server, {
      tracked: { kind: 'json', body: committed['../../../../test/fixtures/frozen-data/tracked.json'] },
      dataset: { kind: 'json', body: committed['../../../../test/fixtures/frozen-data/dataset.json'] },
    });
    mount();
    await settleTo('ready');
    const fetched = requests.length;
    const rows = [...frame().querySelectorAll<HTMLElement>('[data-ranked-row]')];
    act(() => {
      rows[0]?.click();
    });
    await flush();
    const panels = [...frame().querySelectorAll<HTMLElement>('[data-expansion-panel]')];
    expect(panels).toHaveLength(1);
    expect(panels.map((panel) => panel.previousElementSibling)).toEqual(rows.slice(0, 1));
    const links = panels.map((panel) => panel.querySelector<HTMLAnchorElement>('[data-cell="trade-link"] a'));
    for (const link of links) {
      expect(link?.getAttribute('href')).toMatch(
        /^https:\/\/www\.pathofexile\.com\/trade2\/search\/poe2\/Forbidden%20Rites\/[^/\s]+$/,
      );
    }
    expect(panels.map((panel) => panel.querySelector('[data-context-name]')?.textContent)).toEqual(
      rows.slice(0, 1).map((row) => row.querySelector('[data-unit-name]')?.textContent),
    );
    expect(requests).toHaveLength(fetched);
  });
});

describe('the frame', () => {
  it('is one centred column between content-min and content-max, with gutters, on the ground and no fixed size', async () => {
    serveArtifacts(server);
    mount();
    await settleTo('ready');
    const style = frame().style;
    expect(style.minWidth).toBe(spacing['content-min']);
    expect(style.maxWidth).toBe(spacing['content-max']);
    expect(style.width).toBe('');
    expect(style.height).toBe('');
    expect(style.minHeight).toBe('');
    expect(style.boxSizing).toBe('border-box');
    expect(style.padding).toBe(`0px ${spacing.gutter}`);
    expect(style.margin).toBe('0px auto');
    expect(style.background).toBe(rgb(colors.ground));
    expect(style.outline).toBe('');
    expect(style.overflow).toBe('');
    expect(style.border).toBe('');
  });
});

async function legend(): Promise<HTMLElement> {
  serveArtifacts(server);
  mount();
  await settleTo('ready');
  const found = frame().querySelector<HTMLElement>('[data-footer-legend]');
  if (found === null) {
    throw new Error('no footer legend rendered');
  }
  return found;
}

/** A mark's drawn shapes, without its name or colour. */
function drawing(item: Element | undefined): string {
  const serializer = new XMLSerializer();
  return Array.from(item?.querySelector('svg')?.children ?? [], (shape) => serializer.serializeToString(shape)).join('');
}

const legendItems = (root: HTMLElement): HTMLElement[] => [...root.querySelectorAll<HTMLElement>('[data-legend-item]')];

describe('the footer legend', () => {
  // Matrix: ready, healthy.
  it('prints the nine Copy Deck items in deck order, each mark drawn, the text items as Inter text', async () => {
    const found = legendItems(await legend());
    expect(found).toHaveLength(FOOTER_LEGEND_ITEMS.length);
    expect(found).toHaveLength(9);
    for (const [index, item] of FOOTER_LEGEND_ITEMS.entries()) {
      const node = found[index];
      const word = item.kind === 'verdict' ? VERDICT_WORDS[item.verdict] : '';
      expect(node?.textContent).toBe(`${word}${item.meaning}`);
      const mark = node?.querySelector('svg')?.dataset['mark'];
      const expected = {
        swatch: item.kind === 'swatch' ? `swatch-${item.unit}` : undefined,
        verdict: item.kind === 'verdict' ? item.verdict : undefined,
        estimate: 'estimate',
        text: undefined,
      }[item.kind];
      expect(mark).toBe(expected);
    }
  });

  it('sets each verdict word in its mark colour at 600 and the meaning in text-secondary', async () => {
    const root = await legend();
    expect(root.style.color).toBe(rgb(colors['text-secondary']));
    const verdicts = legendItems(root).filter((item) => item.dataset['legendItem'] === 'verdict');
    expect(verdicts).toHaveLength(3);
    for (const node of verdicts) {
      const verdict = node.querySelector('svg')?.dataset['mark'] as keyof typeof VERDICT_WORDS;
      const word = node.querySelector<HTMLElement>('[data-legend-word]');
      expect(word?.textContent).toBe(VERDICT_WORDS[verdict]);
      expect(word?.style.color).toBe(rgb(MARK_COLORS[verdict]));
      expect(word?.style.fontWeight).toBe('600');
      expect(node.querySelector<HTMLElement>('[data-legend-meaning]')?.style.color).toBe('');
    }
    expect(root.querySelector('[style*="italic"], [style*="700"]')).toBeNull();
  });

  it('lays one wrapping row in the note role after a line rule, the last item at the right edge', async () => {
    const root = await legend();
    expect(root.style.display).toBe('flex');
    expect(root.style.flexWrap).toBe('wrap');
    expect(root.style.gap).toBe(px(footerLegend.gap));
    expect(root.style.marginTop).toBe(px(footerLegend.marginTop));
    expect(root.style.paddingTop).toBe(px(footerLegend.paddingTop));
    expect(root.style.borderTop).toBe(`1px solid ${rgb(colors.line)}`);
    expect(root.style.fontSize).toBe(typeRoles.note.fontSize);
    const found = legendItems(root);
    expect(found.at(-1)?.style.marginLeft).toBe('auto');
    expect(found.slice(0, -1).map((node) => node.style.marginLeft)).toEqual(found.slice(0, -1).map(() => ''));
  });

  // NFR-10: with colour removed, every cue still differs by silhouette or words.
  it('tells crafted from Raw Base by words, and the trust states and ≈ apart by silhouette', async () => {
    const found = legendItems(await legend());
    // The drawings alone, colour aside: ◐ ○ ✕ and ≈ must each draw a different shape.
    const shapes = found
      .filter((node) => node.dataset['legendItem'] === 'verdict' || node.dataset['legendItem'] === 'estimate')
      .map((node) => drawing(node));
    expect(shapes).toHaveLength(4);
    expect(shapes.every((shape) => shape !== '')).toBe(true);
    expect(new Set(shapes).size).toBe(shapes.length);
    // The two swatches draw one shape, so their meaning words carry the difference.
    const [crafted, raw] = found;
    expect(drawing(crafted)).toBe(drawing(raw));
    const craftedWords = crafted?.querySelector('[data-legend-meaning]')?.textContent ?? '';
    const rawWords = raw?.querySelector('[data-legend-meaning]')?.textContent ?? '';
    expect(craftedWords).not.toBe('');
    expect(rawWords).not.toBe('');
    expect(craftedWords).not.toBe(rawWords);
  });
});
