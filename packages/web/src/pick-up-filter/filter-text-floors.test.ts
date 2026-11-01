import { describe, expect, it } from 'vitest';

import { rawEntry } from '../test-support/list-fixtures';
import { filterText } from './filter-text';
import { BASE_FILTER, blocksOf, classRow, isCaughtBy, purposesOf, rawRow } from './filter-text-support';

const BASE = 'Solar Amulet';
const low = rawEntry(BASE, 75);
const high = rawEntry(BASE, 82);
/** The Amulets class worth crafting (EV 2) at the given shared floor. */
const amulets = (itemLevelMin: number) => classRow(low.categoryId, low.className, 2, itemLevelMin);
const ITEM_LEVELS = Array.from({ length: 100 }, (_, index) => index + 1);

function boundOf(block: readonly string[], operator: '>=' | '<='): number | undefined {
  const line = block.find((candidate) => candidate.startsWith(`\tItemLevel ${operator} `));
  return line === undefined ? undefined : Number(line.split(' ').at(-1));
}

/** The blocks that catch a drop of `BASE` at `itemLevel`, as the game's conditions read them; the tier is assumed met. */
const blocksCatching = (text: string, rarity: 'Normal' | 'Magic', itemLevel: number): string[][] =>
  blocksOf(text).filter(
    (block) =>
      isCaughtBy(block, BASE) &&
      block.includes(`\tRarity ${rarity}`) &&
      itemLevel >= (boundOf(block, '>=') ?? 0) &&
      itemLevel <= (boundOf(block, '<=') ?? Infinity),
  );

describe('filterText of pickUpPurposes: Story 6.4, one base tracked at two floors', () => {
  it('AC 1: exactly one block catches each drop of each rarity, with its own Raw Base’s purpose', () => {
    const text = filterText(purposesOf([amulets(78), rawRow(low, 3), rawRow(high, 1)], [high, low]), BASE_FILTER);
    for (const itemLevel of ITEM_LEVELS) {
      expect(blocksCatching(text, 'Normal', itemLevel)).toHaveLength(itemLevel >= 75 ? 1 : 0);
      expect(blocksCatching(text, 'Magic', itemLevel)).toHaveLength(itemLevel >= 78 ? 1 : 0);
    }
    expect(blocksCatching(text, 'Normal', 81)[0]).toContain('\tItemLevel <= 81');
    expect(blocksCatching(text, 'Magic', 81)[0]).toContain('\tItemLevel <= 81');
    expect(blocksCatching(text, 'Normal', 82)[0]).toContain('\tSetBorderColor 255 127 127 255');
    expect(text.split('\n').filter((line) => /Continue|Hide/.test(line))).toEqual([]);
    expect(text).toMatch(/\n\nImport "Base\.filter"\n$/);
  });

  it('AC 2: when the higher Raw Base gives no purpose, no block catches a drop at or above its floor', () => {
    const text = filterText(purposesOf([rawRow(low, 3)], [low, high]), BASE_FILTER);
    expect(blocksCatching(text, 'Normal', 81)).toHaveLength(1);
    expect(blocksCatching(text, 'Normal', 82)).toEqual([]);
    expect(blocksCatching(text, 'Normal', 100)).toEqual([]);
  });

  it('AC 3: a lower craft tier whose class floor reaches the higher floor writes no block; the higher purpose catches the drop', () => {
    const text = filterText(purposesOf([amulets(84), rawRow(low, 1), rawRow(high, 3)], [low, high]), BASE_FILTER);
    expect(blocksOf(text).some((block) => block.includes('\tItemLevel >= 75'))).toBe(false);
    expect(blocksCatching(text, 'Normal', 84)).toHaveLength(1);
    expect(blocksCatching(text, 'Normal', 84)[0]).toContain('\tItemLevel >= 82');
  });
});
