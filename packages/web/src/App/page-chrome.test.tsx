import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { ASKING_PRICE_COPY } from '../list/AskingPriceLine';
import { bodiesWith, hoursBefore, priced, rawEntry, unpriced } from '../test-support/list-fixtures';
import { gatedArtifacts, serveArtifacts } from '../test-support/artifact-server';
import { flush, rgb, settleTo, unmount } from '../test-support/dom';
import { colors, spacing } from '../theme/tokens';
import { server, mount, frame } from './test-support';

afterEach(unmount);

describe('the resting chrome', () => {
  function chrome(): Record<string, boolean> {
    return Object.fromEntries(
      ['data-asking-price-line', 'data-column-header', 'data-key-block', 'data-running-foot'].map((attribute) => [
        attribute,
        frame().querySelector(`[${attribute}]`) !== null,
      ]),
    );
  }
  const ALL = {
    'data-asking-price-line': true,
    'data-column-header': true,
    'data-key-block': true,
    'data-running-foot': true,
  };
  const NONE = Object.fromEntries(Object.keys(ALL).map((key) => [key, false]));

  // Matrix: skeleton.
  it('paints the asking line, the labelled header, the slots, the key block and the foot while pending', () => {
    const held = gatedArtifacts();
    serveArtifacts(server, held.answers);
    mount();
    expect(frame().dataset['state']).toBe('pending');
    expect(chrome()).toEqual(ALL);
    expect(frame().querySelector('[data-column-header]')?.textContent).toContain('Item Class / Base Type');
    expect(frame().textContent).toContain(ASKING_PRICE_COPY);
    // A statement, not a control: never the accent.
    expect(frame().querySelector<HTMLElement>('[data-asking-price-line]')?.style.color).toBe(
      rgb(colors['text-secondary']),
    );
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
        '[data-header-bar], [data-interim-controls], [data-trust-strip], [data-asking-price-line], [data-column-header], [data-ranked-row], [data-unrankable-appendix], [data-key-block], [data-running-foot]',
      ),
      (node) => Object.keys((node as HTMLElement).dataset)[0],
    );
    expect(order).toEqual([
      'headerBar',
      'interimControls',
      'trustStrip',
      'askingPriceLine',
      'columnHeader',
      'rankedRow',
      'rankedRow',
      'rankedRow',
      'unrankableAppendix',
      'keyBlock',
      'runningFoot',
    ]);
    const rows = frame().querySelectorAll('[data-ranked-row]');
    expect(rows[0]?.textContent).toContain('0.50');
    expect(rows[1]?.textContent).toContain('an open question');
    // Matrix: unresolvable — a trailing row, not valued.
    expect(rows[2]?.textContent).toContain('Lost Ring');
    expect(rows[2]?.textContent).toContain('not valued');
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
      expect(row.querySelectorAll('[data-unit-glyph]')).toHaveLength(1);
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
    expect(panels.map((panel) => panel.querySelector('[data-panel-sub]')?.textContent)).toEqual([
      expect.stringContaining('Payout Threshold 0.25 Divine.'),
    ]);
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

describe('the trust strip', () => {
  it('sits between the interim controls and the asking-price line, closed on load, and toggles with no request', async () => {
    const requests = serveArtifacts(server);
    mount();
    await settleTo('ready');
    const strip = frame().querySelector<HTMLElement>('[data-trust-strip]');
    expect(strip?.previousElementSibling?.hasAttribute('data-interim-controls')).toBe(true);
    expect(strip?.nextElementSibling?.hasAttribute('data-asking-price-line')).toBe(true);
    expect(frame().querySelector('[data-sync-report-panel]')).toBeNull();
    expect(strip?.textContent).toContain('producer poe-mod-weights-producer');
    // A healthy run: no third line, no count of nothing.
    expect(strip?.querySelector('[data-health-line]')).toBeNull();
    expect(strip?.textContent).not.toContain('0 unresolvable');
    const fetched = requests.length;

    act(() => {
      strip?.click();
    });
    await flush();
    const panel = frame().querySelector('[data-sync-report-panel]');
    expect(panel).not.toBeNull();
    expect(strip?.nextElementSibling).toBe(panel);
    expect(panel?.nextElementSibling?.hasAttribute('data-asking-price-line')).toBe(true);

    act(() => {
      strip?.click();
    });
    await flush();
    expect(frame().querySelector('[data-sync-report-panel]')).toBeNull();
    expect(requests).toHaveLength(fetched);
  });
});
