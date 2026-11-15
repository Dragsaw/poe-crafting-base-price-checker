import { type ModifierReference, type TrackedEntry, type TrackedFile, WeightsFileSchema } from '@poe/contracts';
import { crossFileChecks } from '@poe/core';
import { describe, expect, it } from 'vitest';

import { isTrackedFile, regenerateEntries } from './regenerate-entries';

const LIGHTNING = 'explicit.stat_lightning';
const LIFE = 'explicit.stat_life';
const HYBRID_A = 'explicit.stat_hybrid_a';
const HYBRID_B = 'explicit.stat_hybrid_b';
const SPEED = 'explicit.stat_speed';
const CRIT = 'explicit.stat_crit';
const BOLTS = 'explicit.stat_bolts';
const LABELLESS = 'explicit.stat_labelless';
const MANA = 'explicit.stat_mana';
const CATEGORY = 'weapon.bow';
const CLASS = 'Bows';

interface TierSpec {
  readonly itemLevelMin: number;
  readonly tierLabel?: string;
  readonly lines: readonly { statId: string; ranges: number[][] }[];
}

function tier(slot: string, moduleGroup: string, { itemLevelMin, tierLabel, lines }: TierSpec): Record<string, unknown> {
  return {
    sourceModifierId: `${slot}\0${moduleGroup}\0${String(itemLevelMin)}`,
    modGroup: moduleGroup,
    addsTags: [],
    blockedByTags: [],
    itemLevelMin,
    ...(tierLabel !== undefined && { tierLabel }),
    weight: 500,
    weightSource: 'published',
    lines,
  };
}

const WEIGHTS = WeightsFileSchema.parse({
  schemaVersion: '7.0.0',
  gamePatch: '0.4.0',
  producer: { id: 'test', generatedAt: '2026-11-15T00:00:00Z' },
  bases: {
    [CATEGORY]: {
      [CLASS]: {
        prefix: {
          poolCoverage: 'complete',
          entries: [
            // Two-`#` line: intervals [75, 80], [79, 103] and [101.5, 123] overlap their neighbours (AD-11).
            tier('prefix', 'Lightning', { itemLevelMin: 60, tierLabel: 'T3', lines: [{ statId: LIGHTNING, ranges: [[50, 60], [100, 100]] }] }),
            tier('prefix', 'Lightning', { itemLevelMin: 70, tierLabel: 'T2', lines: [{ statId: LIGHTNING, ranges: [[50, 70], [108, 136]] }] }),
            tier('prefix', 'Lightning', { itemLevelMin: 82, tierLabel: 'T1', lines: [{ statId: LIGHTNING, ranges: [[80, 100], [123, 146]] }] }),
            tier('prefix', 'Life', { itemLevelMin: 50, tierLabel: 'T2', lines: [{ statId: LIFE, ranges: [[10, 19]] }] }),
            tier('prefix', 'Life', { itemLevelMin: 75, tierLabel: 'T1', lines: [{ statId: LIFE, ranges: [[20, 29]] }] }),
            tier('prefix', 'Hybrid', { itemLevelMin: 40, tierLabel: 'T2', lines: [{ statId: HYBRID_A, ranges: [[5, 9]] }, { statId: HYBRID_B, ranges: [[30, 39]] }] }),
            tier('prefix', 'Hybrid', { itemLevelMin: 81, tierLabel: 'T1', lines: [{ statId: HYBRID_A, ranges: [[10, 14]] }, { statId: HYBRID_B, ranges: [[40, 49]] }] }),
          ],
        },
        suffix: {
          poolCoverage: 'complete',
          entries: [
            tier('suffix', 'Speed', { itemLevelMin: 60, tierLabel: 'T2', lines: [{ statId: SPEED, ranges: [[5, 7]] }] }),
            tier('suffix', 'Speed', { itemLevelMin: 81, tierLabel: 'T1', lines: [{ statId: SPEED, ranges: [[8, 10]] }] }),
            tier('suffix', 'Crit', { itemLevelMin: 30, tierLabel: 'T1', lines: [{ statId: CRIT, ranges: [[1, 3]] }] }),
            tier('suffix', 'LifeSuffix', { itemLevelMin: 1, tierLabel: 'T1', lines: [{ statId: LIFE, ranges: [[1, 5]] }] }),
            tier('suffix', 'Bolts', { itemLevelMin: 82, tierLabel: 'T1', lines: [{ statId: BOLTS, ranges: [[1, 1]] }] }),
            tier('suffix', 'Labelless', { itemLevelMin: 10, lines: [{ statId: LABELLESS, ranges: [[1, 2]] }] }),
            tier('suffix', 'Mana', { itemLevelMin: 50, tierLabel: 'T2', lines: [{ statId: MANA, ranges: [[1, 4]] }] }),
            tier('suffix', 'Mana', { itemLevelMin: 79, tierLabel: 'T1', lines: [{ statId: MANA, ranges: [[5, 9]] }] }),
          ],
        },
      },
    },
  },
});

function banded(statId: string, valueMin: number, valueMax: number, acceptedTier?: string): ModifierReference {
  return { kind: 'banded', statId, valueMin, valueMax, ...(acceptedTier !== undefined && { acceptedTier }) };
}

function crafted(prefix: ModifierReference, suffix: ModifierReference, itemLevelMin = 82): TrackedEntry {
  return { kind: 'crafted', categoryId: CATEGORY, className: CLASS, itemLevelMin, prefix, suffix, status: 'active' };
}

const RAW: TrackedEntry = { kind: 'raw', categoryId: CATEGORY, className: CLASS, baseTypeId: 'Recurve Bow', itemLevelMin: 82, status: 'active' };
const CRIT_T1 = banded(CRIT, 1, 3, 'T1');
const LIFE_T1 = banded(LIFE, 20, 29, 'T1');

function fileOf(...entries: TrackedEntry[]): TrackedFile {
  return { schemaVersion: '1.0.0', entries };
}

function run(...entries: TrackedEntry[]): ReturnType<typeof regenerateEntries> {
  return regenerateEntries(fileOf(...entries), WEIGHTS);
}

function affixes(result: ReturnType<typeof regenerateEntries>): unknown[] {
  return result.file.entries.map((entry) => (entry.kind === 'crafted' ? [entry.prefix, entry.suffix, entry.itemLevelMin] : entry));
}

describe('regenerateEntries', () => {
  it('splits a span into one reference per tier, each on its own interval', () => {
    const result = run(crafted(banded(LIFE, 10, 29, 'T1-T2'), CRIT_T1));

    expect(affixes(result)).toStrictEqual([
      [LIFE_T1, CRIT_T1, 75],
      [banded(LIFE, 10, 19, 'T2'), CRIT_T1, 50],
    ]);
    expect(result.summary.split).toBe(1);
  });

  it('splits overlapping tiers on their own intervals, and both load', () => {
    const result = run(crafted(banded(LIGHTNING, 79, 123, 'T1-T2'), CRIT_T1));

    expect(affixes(result)).toStrictEqual([
      [banded(LIGHTNING, 103.5, 123, 'T1'), CRIT_T1, 82],
      [banded(LIGHTNING, 80.5, 103, 'T2'), CRIT_T1, 70],
    ]);
    expect(crossFileChecks(result.file.entries, WEIGHTS).failures).toStrictEqual([]);
  });

  it('gives a T1-only reference above the low level its T2 sibling', () => {
    const result = run(crafted(banded(LIGHTNING, 103.5, 123, 'T1'), CRIT_T1));

    expect(affixes(result)).toStrictEqual([
      [banded(LIGHTNING, 103.5, 123, 'T1'), CRIT_T1, 82],
      [banded(LIGHTNING, 80.5, 103, 'T2'), CRIT_T1, 70],
    ]);
    expect(result.summary.sibling).toBe(1);
  });

  it('writes all four T1/T2 pairings when both affixes qualify, prefix-major', () => {
    const result = run(crafted(banded(LIGHTNING, 103.5, 123, 'T1'), banded(SPEED, 8, 10, 'T1')));

    expect(affixes(result)).toStrictEqual([
      [banded(LIGHTNING, 103.5, 123, 'T1'), banded(SPEED, 8, 10, 'T1'), 82],
      [banded(LIGHTNING, 103.5, 123, 'T1'), banded(SPEED, 5, 7, 'T2'), 82],
      [banded(LIGHTNING, 80.5, 103, 'T2'), banded(SPEED, 8, 10, 'T1'), 81],
      [banded(LIGHTNING, 80.5, 103, 'T2'), banded(SPEED, 5, 7, 'T2'), 70],
    ]);
  });

  it('keeps one reference, on its own interval, for a T1 at or below the low level', () => {
    const result = run(crafted(banded(LIFE, 15, 29, 'T1'), CRIT_T1));

    expect(affixes(result)).toStrictEqual([[LIFE_T1, CRIT_T1, 75]]);
    expect(result.summary).toMatchObject({ sibling: 0, rebandedSingle: 1 });
  });

  it('splits a hybrid span into one reference per hybrid tier, every banded line on its own interval', () => {
    const span: ModifierReference = {
      kind: 'hybrid',
      lines: [
        { statId: HYBRID_A, valueMin: 5, valueMax: 14 },
        { statId: HYBRID_B, valueMin: 30, valueMax: 49 },
      ],
      acceptedTier: 'T1-T2',
    };
    const result = run(crafted(span, CRIT_T1));

    expect(affixes(result)).toStrictEqual([
      [{ kind: 'hybrid', lines: [{ statId: HYBRID_A, valueMin: 10, valueMax: 14 }, { statId: HYBRID_B, valueMin: 40, valueMax: 49 }], acceptedTier: 'T1' }, CRIT_T1, 81],
      [{ kind: 'hybrid', lines: [{ statId: HYBRID_A, valueMin: 5, valueMax: 9 }, { statId: HYBRID_B, valueMin: 30, valueMax: 39 }], acceptedTier: 'T2' }, CRIT_T1, 40],
    ]);
  });

  it('keeps a summed pair byte-identical', () => {
    const summed = crafted(banded(LIFE, 10, 29, 'T1-T2'), banded(LIFE, 1, 5, 'T1'), 75);

    expect(run(summed).file.entries).toStrictEqual([summed]);
  });

  it('floors an entry at the higher of its two needs', () => {
    const result = run(crafted(banded(LIFE, 20, 29, 'T1'), banded(SPEED, 8, 10, 'T1'), 90));

    expect(result.file.entries[0]).toMatchObject({ itemLevelMin: 81 });
  });

  it('writes a canonical key once when two sources produce it', () => {
    const result = run(crafted(banded(LIFE, 10, 29, 'T1-T2'), CRIT_T1), crafted(LIFE_T1, CRIT_T1, 75));

    expect(result.file.entries).toHaveLength(2);
    expect(result.summary.droppedAsDuplicate).toBe(1);
  });

  it('never revives a pruned combination, whatever its floor and label', () => {
    const tombstone: TrackedEntry = { ...crafted(banded(LIFE, 10, 19), CRIT_T1, 1), status: 'pruned', prunedReason: 'no listings' };
    const result = run(crafted(banded(LIFE, 10, 29, 'T1-T2'), CRIT_T1), tombstone);

    expect(affixes(result)).toStrictEqual([[LIFE_T1, CRIT_T1, 75], [banded(LIFE, 10, 19), CRIT_T1, 1]]);
    expect(result.file.entries[1]).toBe(tombstone);
    expect(result.summary.droppedAsTombstone).toBe(1);
  });

  it('throws, naming the entry, when a contained tier has no label', () => {
    expect(() => run(RAW, crafted(LIFE_T1, banded(LABELLESS, 1, 2)))).toThrow(/entries\.1\.suffix/u);
  });

  it('adds no sibling for a T1 at exactly the low level', () => {
    const result = run(crafted(LIFE_T1, banded(MANA, 5, 9, 'T1')));

    expect(result.file.entries).toHaveLength(1);
    expect(result.summary.sibling).toBe(0);
  });

  it('passes an active crafted entry on a class absent from the weights through as the same object', () => {
    const absent: TrackedEntry = { ...crafted(LIFE_T1, CRIT_T1), categoryId: 'weapon.wand', className: 'Wands' };

    expect(run(absent).file.entries[0]).toBe(absent);
  });

  it('keeps a reference banded outside every tier, at its source floor', () => {
    const outside = crafted(banded(LIFE, 100, 200, 'T1'), CRIT_T1, 77);

    expect(run(outside).file.entries).toStrictEqual([outside]);
  });

  it('names a T1-only reference whose family has no T2, and adds no sibling', () => {
    const result = run(crafted(LIFE_T1, banded(BOLTS, 1, 1, 'T1')));

    expect(result.file.entries).toHaveLength(1);
    expect(result.summary.noT2).toStrictEqual(['entries.0.suffix']);
  });

  it('passes raw entries and tombstones through as the same objects', () => {
    const pruned: TrackedEntry = { ...crafted(LIFE_T1, CRIT_T1), status: 'pruned', prunedReason: 'no listings' };
    const result = run(RAW, pruned);

    expect(result.file.entries[0]).toBe(RAW);
    expect(result.file.entries[1]).toBe(pruned);
  });

  it('keeps the source line order of a hybrid reference', () => {
    const reversed: ModifierReference = {
      kind: 'hybrid',
      lines: [
        { statId: HYBRID_B, valueMin: 40, valueMax: 49 },
        { statId: HYBRID_A, valueMin: 10, valueMax: 14 },
      ],
      acceptedTier: 'T1',
    };
    const [first] = run(crafted(reversed, CRIT_T1)).file.entries;

    expect(first).toMatchObject({ prefix: reversed });
  });

  it('is idempotent: a second run gives the same file', () => {
    const once = run(
      RAW,
      crafted(banded(LIGHTNING, 79, 123, 'T1-T2'), banded(SPEED, 5, 10, 'T1-T2')),
      crafted(banded(LIFE, 10, 29, 'T1-T2'), CRIT_T1),
      crafted(banded(LIGHTNING, 103.5, 123, 'T1'), banded(SPEED, 8, 10, 'T1')),
    ).file;
    const twice = regenerateEntries(once, WEIGHTS).file;

    expect(isTrackedFile(once)).toBe(true);
    expect(JSON.stringify(twice, undefined, 2)).toBe(JSON.stringify(once, undefined, 2));
  });
});
