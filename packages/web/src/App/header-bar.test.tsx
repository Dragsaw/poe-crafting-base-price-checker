import { afterEach, describe, expect, it } from 'vitest';

import { HEADER_GROUP_GAP, HEADER_SLOT_WIDTHS, HEADER_SLOTS, HEADER_TITLE, HEADER_TITLE_WIDTH } from '../frame/HeaderBar';
import { RECIPES } from '../recipe/craft-recipe/test-support';
import { ROW_SLOT_COUNT } from '../frame/RowSlots';
import { gatedArtifacts, serveArtifacts, TEST_LEAGUE, VALID_BODIES } from '../test-support/artifact-server';
import { cssNumber } from '../test-support/css-number';
import { rgb, settleTo, unmount } from '../test-support/dom';
import { colors, px, spacing, typeRoles } from '../theme/tokens';
import { frame, mount, server } from './test-support';

afterEach(unmount);

/** DESIGN.md, Layout & Spacing: the target monitor's frame width. */
const TARGET_FRAME_WIDTH = 1063;

function headerBar(): HTMLElement {
  const found = frame().querySelector<HTMLElement>(':scope > [data-header-bar]');
  if (found === null) {
    throw new Error('no header bar rendered');
  }
  return found;
}

function slots(): HTMLElement[] {
  return [...headerBar().querySelectorAll<HTMLElement>(':scope > [data-slot]')];
}

describe('the header bar', () => {
  it('is pinned at the top: sticky, the header height, on the ground over a line-strong rule', async () => {
    serveArtifacts(server);
    mount();
    await settleTo('ready');
    const style = headerBar().style;
    expect(style.position).toBe('sticky');
    expect(style.top).toBe('0px');
    expect(style.height).toBe(spacing['header-height']);
    expect(style.background).toBe(rgb(colors.ground));
    expect(style.borderBottom).toBe(`1px solid ${rgb(colors['line-strong'])}`);
    expect(frame().querySelectorAll('[style*="sticky"]')).toHaveLength(1);
  });

  it('lays one row that never wraps or shrinks: the brand block, then the recipe, threshold, filter and sync slots', async () => {
    serveArtifacts(server, { recipes: { kind: 'json', body: { schemaVersion: '1.0.0', recipes: RECIPES } } });
    mount();
    await settleTo('ready');
    const style = headerBar().style;
    expect(style.display).toBe('flex');
    expect(style.flexWrap).toBe('nowrap');
    expect(style.whiteSpace).toBe('nowrap');
    expect(style.gap).toBe('22px');
    expect(headerBar().firstElementChild?.hasAttribute('data-brand')).toBe(true);
    expect(slots().map((slot) => slot.dataset['slot'])).toEqual(['recipe', 'threshold', 'filter', 'sync']);
    // A filled slot sizes to its control, so the brand block takes the free space.
    const [recipe, threshold, filter, sync] = slots();
    for (const slot of [recipe, threshold]) {
      expect(slot?.style.flex).toBe('0 0 auto');
      expect(slot?.style.width).toBe('');
    }
    // The filter and sync slots hold their reserved widths with the button at the start.
    for (const [slot, width] of [
      [filter, HEADER_SLOT_WIDTHS.filter],
      [sync, HEADER_SLOT_WIDTHS.sync],
    ] as const) {
      expect(slot?.style.flex).toBe(`0 0 ${px(width)}`);
      expect(slot?.style.width).toBe(px(width));
      expect(slot?.style.justifyContent).toBe('');
    }
    for (const slot of slots()) {
      expect(slot.childElementCount).toBe(1);
    }
  });

  it('prints the full title beside the reserved slot widths in the target frame, and cuts it at content-min', () => {
    // DESIGN.md width budget: the 1063px target frame and `{spacing.content-min}`, each less its two gutters.
    const titleRoom = (frameWidth: number): number =>
      frameWidth -
      2 * cssNumber(spacing.gutter) -
      HEADER_SLOTS.reduce((sum, slot) => sum + HEADER_SLOT_WIDTHS[slot], 0) -
      HEADER_SLOTS.length * HEADER_GROUP_GAP;
    expect(titleRoom(TARGET_FRAME_WIDTH)).toBeGreaterThanOrEqual(HEADER_TITLE_WIDTH);
    expect(titleRoom(cssNumber(spacing['content-min']))).toBeGreaterThan(0);
    expect(titleRoom(cssNumber(spacing['content-min']))).toBeLessThan(HEADER_TITLE_WIDTH);
  });

  it('prints the league alone in the eyebrow and the Copy Deck title, with no dek', async () => {
    serveArtifacts(server);
    mount();
    await settleTo('ready');
    const eyebrow = headerBar().querySelector<HTMLElement>('[data-eyebrow]');
    expect(eyebrow?.textContent).toBe(TEST_LEAGUE);
    expect(eyebrow?.style.color).toBe(rgb(colors['text-secondary']));
    expect(eyebrow?.style.textTransform).toBe('uppercase');
    expect(eyebrow?.style.fontSize).toBe(typeRoles.eyebrow.fontSize);
    const title = headerBar().querySelector<HTMLElement>('h1');
    expect(title?.textContent).toBe(HEADER_TITLE);
    expect(title?.style.color).toBe(rgb(colors.text));
    expect(title?.style.fontSize).toBe(typeRoles.title.fontSize);
    expect(headerBar().querySelector('p')).toBeNull();
  });

  it('cuts a long league with an ellipsis, and the empty recipe slot keeps its reserved width', async () => {
    const league = 'Forbidden Rites of the Very Long Hardcore Solo Self-Found Event League Name';
    serveArtifacts(server, { config: { kind: 'json', body: { ...(VALID_BODIES.config as object), league } } });
    mount();
    await settleTo('ready');
    const brand = headerBar().querySelector<HTMLElement>('[data-brand]');
    expect(brand?.style.flex).toBe('1 1 auto');
    expect(brand?.style.minWidth).toBe('0px');
    const eyebrow = headerBar().querySelector<HTMLElement>('[data-eyebrow]');
    expect(eyebrow?.textContent).toBe(league);
    for (const cut of [eyebrow, headerBar().querySelector<HTMLElement>('h1')]) {
      expect(cut?.style.overflow).toBe('hidden');
      expect(cut?.style.textOverflow).toBe('ellipsis');
    }
    expect(eyebrow?.style.display).toBe('block');
    const [recipe, threshold, filter, sync] = slots();
    expect(recipe?.style.flex).toBe(`0 0 ${px(HEADER_SLOT_WIDTHS.recipe)}`);
    expect([threshold?.style.flex, filter?.style.flex, sync?.style.flex]).toEqual([
      '0 0 auto',
      `0 0 ${px(HEADER_SLOT_WIDTHS.filter)}`,
      `0 0 ${px(HEADER_SLOT_WIDTHS.sync)}`,
    ]);
  });

  it('holds the recipe toggle, the threshold control, the filter button and the sync button in its slots, with no band under it', async () => {
    serveArtifacts(server, { recipes: { kind: 'json', body: { schemaVersion: '1.0.0', recipes: RECIPES } } });
    mount();
    await settleTo('ready');
    const [recipe, threshold, filter, sync] = slots();
    expect(recipe?.querySelector('[data-craft-recipe]')).not.toBeNull();
    expect(threshold?.querySelector('[data-payout-threshold]')).not.toBeNull();
    expect(filter?.querySelector('[data-filter-button]')).not.toBeNull();
    expect(sync?.querySelector('[data-sync-button]')).not.toBeNull();
    expect(frame().querySelector('[data-interim-controls], [data-trust-strip], [data-asking-price-line]')).toBeNull();
    expect(headerBar().nextElementSibling?.hasAttribute('data-ranked-list')).toBe(true);
    // No tooltip hangs on a header control (Interaction 8).
    expect(headerBar().querySelector('[title], [data-ev-tooltip], [data-mark-tooltip]')).toBeNull();
  });

  it.each([
    ['recipes.json holds no recipe', { kind: 'json', body: { schemaVersion: '1.0.0', recipes: [] } }],
    ['recipes.json is absent', { kind: 'status', status: 404 }],
  ] as const)('holds the same empty recipe slot when %s (state 43)', async (_case, recipes) => {
    serveArtifacts(server, { recipes });
    mount();
    await settleTo('ready');
    const [recipe] = slots();
    expect(recipe?.style.flex).toBe(`0 0 ${px(HEADER_SLOT_WIDTHS.recipe)}`);
    expect(recipe?.style.width).toBe(px(HEADER_SLOT_WIDTHS.recipe));
    expect(recipe?.childElementCount).toBe(0);
    expect(headerBar().style.flexWrap).toBe('nowrap');
  });

  it.each([
    ['refused', { tracked: { kind: 'status', status: 404 } }],
    ['failed', { config: { kind: 'network-error' } }],
  ] as const)('is absent from the %s failure screen, which sits on the dark ground', async (outcome, answers) => {
    serveArtifacts(server, answers);
    mount();
    await settleTo(outcome);
    expect(frame().querySelector('[data-header-bar], [data-interim-controls]')).toBeNull();
    expect(frame().style.background).toBe(rgb(colors.ground));
  });

  it('runs under the one forced dark colour scheme', async () => {
    serveArtifacts(server);
    mount();
    await settleTo('ready');
    expect(document.documentElement.dataset['mantineColorScheme']).toBe('dark');
  });
});

/** The threshold and sync slots' sizes, which decide where the threshold control sits. */
function sizes(): string[] {
  return slots()
    .slice(1)
    .map((slot) => `${slot.style.flex}|${slot.style.width}`);
}

describe('the cold load (state 22)', () => {
  it('paints the bar with a blank eyebrow, the column header and twenty flat surface bars at once', () => {
    const held = gatedArtifacts();
    serveArtifacts(server, held.answers);
    mount();
    expect(frame().getAttribute('aria-busy')).toBe('true');
    expect(headerBar().querySelector('[data-eyebrow]')?.textContent.trim()).toBe('');
    expect(headerBar().querySelector('h1')?.textContent).toBe(HEADER_TITLE);
    expect(slots()).toHaveLength(4);
    // While pending only the threshold control is live; the empty slots hold their reserved widths.
    const [recipe, threshold, filter, sync] = slots();
    expect(recipe?.style.width).toBe(px(HEADER_SLOT_WIDTHS.recipe));
    expect(filter?.style.width).toBe(px(HEADER_SLOT_WIDTHS.filter));
    expect(filter?.childElementCount).toBe(0);
    expect(sync?.style.width).toBe(px(HEADER_SLOT_WIDTHS.sync));
    expect(threshold?.style.flex).toBe('0 0 auto');
    expect(frame().querySelector('[data-column-header]')).not.toBeNull();
    const rows = frame().querySelectorAll<HTMLElement>('[data-row-slot]');
    expect(rows).toHaveLength(ROW_SLOT_COUNT);
    const bars = [...frame().querySelectorAll<HTMLElement>('[data-row-slot] [data-cell] > div')];
    expect(bars.length).toBeGreaterThanOrEqual(ROW_SLOT_COUNT);
    for (const bar of bars) {
      expect(bar.style.height).toBe('10px');
      expect(bar.style.background).toBe(rgb(colors.surface));
      expect(bar.style.animation).toBe('');
      expect(bar.style.transition).toBe('');
    }
    held.openAll();
  });

  it('keeps the same bar into ready and fills the eyebrow in the one transition', async () => {
    const held = gatedArtifacts();
    serveArtifacts(server, held.answers);
    mount();
    const pendingBar = headerBar();
    const pendingSizes = sizes();
    held.openAll();
    await settleTo('ready');
    expect(headerBar()).toBe(pendingBar);
    // The threshold and sync slots keep their sizes, so the threshold control does not move.
    expect(sizes()).toEqual(pendingSizes);
    expect(headerBar().querySelector('[data-eyebrow]')?.textContent).toBe(TEST_LEAGUE);
    expect(frame().querySelectorAll('[data-row-slot]')).toHaveLength(0);
  });
});
