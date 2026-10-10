import type { TrackedEntry } from '@poe/contracts';
import { RECIPE_UNREACHABLE } from '@poe/core';
import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { ARTIFACT_ORDER } from '../load/artifacts';
import { APPENDIX_NOTES, NOTE_JOINER, RAW_RANKS_NOTE } from '../list/UnrankableAppendix';
import { serveArtifacts, VALID_BODIES } from '../test-support/artifact-server';
import { settleTo, unmount } from '../test-support/dom';
import { bodiesWith, craftedEntry, hoursBefore, priced, rawEntry } from '../test-support/list-fixtures';
import { frame, mount, server } from './test-support';

afterEach(() => {
  unmount();
  localStorage.clear();
});

const BOWS = { categoryId: 'weapon.bow', className: 'Bows' } as const;
const WANDS = { categoryId: 'weapon.wand', className: 'Wands' } as const;
const STAVES = { categoryId: 'weapon.staff', className: 'Staves' } as const;
const BELTS = { categoryId: 'accessory.belt', className: 'Belts' } as const;
const PREFIX_STAT = 'explicit.stat_3299347043';
const SUFFIX_STAT = 'explicit.stat_1967051901';
const BANDED_STAT = 'explicit.stat_1';

const tier = (statId: string, itemLevelMin: number, ranges: number[][]) => ({
  sourceModifierId: `${statId}.${String(itemLevelMin)}`,
  modGroup: statId,
  itemLevelMin,
  weight: 100,
  weightSource: 'published',
  lines: [{ statId, ranges }],
});
const slot = (poolCoverage: string, entries: unknown[]) => ({ poolCoverage, entries });
const valuelessPools = (suffixCoverage: string) => ({
  prefix: slot('complete', [tier(PREFIX_STAT, 1, [])]),
  suffix: slot(suffixCoverage, [tier(SUFFIX_STAT, 1, [])]),
});

/** One world for matrix rows 1 to 4 of Story 4.8, under the frozen fixture's two recipes. */
function serveWorld(): ReturnType<typeof serveArtifacts> {
  const seen = hoursBefore(Date.now(), 1);
  const bowBase = rawEntry('Advanced Dualstring Bow', 82, BOWS);
  const wandBase = rawEntry('Withered Wand', 82, WANDS);
  const staffBase: TrackedEntry = { ...rawEntry('Gnarled Staff', 82, STAVES), status: 'pruned', prunedReason: 'no market' };
  const amuletBase = rawEntry('Gold Amulet');
  const beltBase = rawEntry('Wide Belt', 82, BELTS);
  // Its one containing tier sits below the perfect floor, in a group with a tier above it (AD-17).
  const amulets: TrackedEntry = {
    ...craftedEntry('Amulets', 'accessory.amulet'),
    prefix: { kind: 'banded', statId: BANDED_STAT, valueMin: 1, valueMax: 5 },
  };
  const weights = {
    ...(VALID_BODIES.weights as object),
    bases: {
      'accessory.amulet': {
        Amulets: {
          prefix: slot('complete', [tier(BANDED_STAT, 50, [[1, 5]]), tier(BANDED_STAT, 80, [[10, 20]])]),
          suffix: slot('complete', [tier(SUFFIX_STAT, 1, [])]),
        },
      },
      'accessory.belt': { Belts: valuelessPools('complete') },
      'weapon.bow': { Bows: valuelessPools('partial') },
      'weapon.staff': { Staves: valuelessPools('partial') },
    },
  };
  const recipes = import.meta.glob<unknown>('../../../../test/fixtures/frozen-data/recipes.json', { eager: true, import: 'default' });
  const crafted = [amulets, ...[BOWS, WANDS, STAVES, BELTS].map((unit) => craftedEntry(unit.className, unit.categoryId))];
  const bodies = bodiesWith(
    [...crafted, bowBase, wandBase, staffBase, amuletBase, beltBase],
    // The wand base is below the default threshold: never in the ordering.
    [priced(bowBase, 0.3, seen), priced(wandBase, 0.1, seen), priced(amuletBase, 0.5, seen), priced(beltBase, 0.5, seen)],
  );
  return serveArtifacts(server, {
    tracked: { kind: 'json', body: bodies.tracked },
    dataset: { kind: 'json', body: bodies.dataset },
    weights: { kind: 'json', body: weights },
    recipes: { kind: 'json', body: recipes['../../../../test/fixtures/frozen-data/recipes.json'] },
  });
}

/** Each appendix row as `class → [reason, note]`. */
function appendixCells(): Record<string, [string, string]> {
  return Object.fromEntries(
    Array.from(frame().querySelectorAll<HTMLElement>('[data-appendix-row]'), (row) => [
      row.querySelector('[data-cell="class"]')?.textContent ?? '',
      [row.querySelector('[data-cell="reason"]')?.textContent ?? '', row.querySelector('[data-cell="note"]')?.textContent ?? ''],
    ]),
  );
}

function stepThresholdUp(): void {
  const thumb = frame().querySelector<HTMLElement>('[data-payout-threshold] [role="slider"]');
  act(() => {
    thumb?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  });
}

describe('the state 16 note through the page', () => {
  const PARTIAL = APPENDIX_NOTES['pool partial'];
  const ABSENT = APPENDIX_NOTES['class absent from weights file'];

  it('joins the note only where a Raw Base of the class is in the active ordering, and follows it with no request', async () => {
    const requests = serveWorld();
    mount();
    await settleTo('ready');
    // Rows 1, 2 and 4: Bows ranks a raw base; Staves' is pruned, Wands' below threshold; Belts ranks.
    expect(appendixCells()).toEqual({
      Bows: ['pool partial', [PARTIAL, RAW_RANKS_NOTE].join(NOTE_JOINER)],
      Staves: ['pool partial', PARTIAL],
      Wands: ['class absent from weights file', ABSENT],
    });

    // Row 3: the perfect recipe cannot reach Amulets, whose raw base ranks; state 36 takes no note.
    act(() => {
      frame().querySelector<HTMLElement>('[data-recipe-option="perfect"]')?.click();
    });
    expect(appendixCells()).toEqual({
      Amulets: [RECIPE_UNREACHABLE, ''],
      Bows: ['pool partial', [PARTIAL, RAW_RANKS_NOTE].join(NOTE_JOINER)],
      Staves: ['pool partial', PARTIAL],
      Wands: ['class absent from weights file', ABSENT],
    });

    // 0.30 still keeps the 0.3 bow base; 0.35 drops it from the ordering, and the note with it.
    stepThresholdUp();
    expect(appendixCells()['Bows']).toEqual(['pool partial', [PARTIAL, RAW_RANKS_NOTE].join(NOTE_JOINER)]);
    stepThresholdUp();
    expect(appendixCells()['Bows']).toEqual(['pool partial', PARTIAL]);

    expect(frame().querySelector('[data-unrankable-appendix] [title]')).toBeNull();
    expect(requests).toHaveLength(ARTIFACT_ORDER.length);
  });
});
