import type { TrackedEntry } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import { buildSearchBody } from './search-body.ts';
import { crafted, itemTypes } from './search-body.test-support.ts';

describe('buildSearchBody: a hybrid reference', () => {
  it('sends one filter per line under the one and group: {min,max} banded, {} valueless', () => {
    const entry = crafted('weapon.bow', 'Bows', {
      prefix: {
        kind: 'hybrid',
        lines: [
          { statId: 'explicit.stat_1', valueMin: 10, valueMax: 20.5 },
          { statId: 'explicit.stat_3' },
        ],
      },
      suffix: { kind: 'valueless', statId: 'explicit.stat_2' },
    });
    const body = buildSearchBody(entry, itemTypes);

    expect(body.query.stats).toEqual([
      {
        type: 'and',
        filters: [
          { id: 'explicit.stat_1', value: { min: 10, max: 20.5 }, disabled: false },
          { id: 'explicit.stat_3', value: {}, disabled: false },
          { id: 'explicit.stat_2', value: {}, disabled: false },
        ],
      },
    ]);
  });

  it('expands a hybrid suffix after the prefix and leaves the rest of the body unchanged', () => {
    const entry = crafted('weapon.bow', 'Bows', {
      prefix: { kind: 'valueless', statId: 'explicit.stat_2' },
      suffix: {
        kind: 'hybrid',
        lines: [
          { statId: 'explicit.stat_1', valueMin: 1, valueMax: 2 },
          { statId: 'explicit.stat_3', valueMin: 3, valueMax: 4 },
        ],
      },
    });
    const body = buildSearchBody(entry, itemTypes);

    expect(body.query.stats[0].filters.map((f) => f.id)).toEqual([
      'explicit.stat_2',
      'explicit.stat_1',
      'explicit.stat_3',
    ]);
    expect(body.query.filters.type_filters.filters.rarity).toEqual({ option: 'magic' });
  });
});

const filtersOf = (entry: TrackedEntry) => buildSearchBody(entry, itemTypes).query.stats[0].filters;
const ids = (entry: TrackedEntry) => filtersOf(entry).map((filter) => filter.id);

describe('buildSearchBody: a summed statId', () => {
  const RARITY = 'explicit.stat_3917489142';
  const PHYS = 'explicit.stat_1509134228';
  const ACCURACY = 'explicit.stat_691932474';
  const LIGHT = 'explicit.stat_1263695895';

  it('pure + pure: one rarity filter whose edges are the sums', () => {
    const entry = crafted('accessory.amulet', 'Amulets', {
      prefix: { kind: 'banded', statId: RARITY, valueMin: 16, valueMax: 19, acceptedTier: 'T1' },
      suffix: { kind: 'banded', statId: RARITY, valueMin: 15, valueMax: 18, acceptedTier: 'T1' },
    });
    expect(filtersOf(entry)).toEqual([{ id: RARITY, value: { min: 31, max: 37 }, disabled: false }]);
  });

  it('hybrid + pure: one summed filter in the prefix line’s place, and the other hybrid line', () => {
    const entry = crafted('weapon.bow', 'Bows', {
      prefix: {
        kind: 'hybrid',
        lines: [
          { statId: PHYS, valueMin: 75, valueMax: 79 },
          { statId: ACCURACY, valueMin: 175, valueMax: 200 },
        ],
      },
      suffix: { kind: 'banded', statId: ACCURACY, valueMin: 41, valueMax: 60 },
    });
    expect(filtersOf(entry)).toEqual([
      { id: PHYS, value: { min: 75, max: 79 }, disabled: false },
      { id: ACCURACY, value: { min: 216, max: 260 }, disabled: false },
    ]);
  });

  it('pure + hybrid: the summed filter sits at the prefix, the suffix’s other line follows', () => {
    const entry = crafted('weapon.bow', 'Bows', {
      prefix: { kind: 'banded', statId: ACCURACY, valueMin: 551, valueMax: 650 },
      suffix: {
        kind: 'hybrid',
        lines: [
          { statId: LIGHT, valueMin: 15, valueMax: 15 },
          { statId: ACCURACY, valueMin: 41, valueMax: 60 },
        ],
      },
    });
    expect(filtersOf(entry)).toEqual([
      { id: ACCURACY, value: { min: 592, max: 710 }, disabled: false },
      { id: LIGHT, value: { min: 15, max: 15 }, disabled: false },
    ]);
  });

  it('hybrid + hybrid: the Bows phys%+accuracy prefix with LightRadiusAndAccuracy; no id repeats', () => {
    const entry = crafted('weapon.bow', 'Bows', {
      prefix: {
        kind: 'hybrid',
        lines: [
          { statId: PHYS, valueMin: 75, valueMax: 79 },
          { statId: ACCURACY, valueMin: 175, valueMax: 200 },
        ],
      },
      suffix: {
        kind: 'hybrid',
        lines: [
          { statId: LIGHT, valueMin: 15, valueMax: 15 },
          { statId: ACCURACY, valueMin: 41, valueMax: 60 },
        ],
      },
    });
    expect(filtersOf(entry)).toEqual([
      { id: PHYS, value: { min: 75, max: 79 }, disabled: false },
      { id: ACCURACY, value: { min: 216, max: 260 }, disabled: false },
      { id: LIGHT, value: { min: 15, max: 15 }, disabled: false },
    ]);
    expect(new Set(ids(entry)).size).toBe(ids(entry).length);
  });

  it('adds half-integer edges exactly, never rounded', () => {
    const entry = crafted('weapon.bow', 'Bows', {
      prefix: { kind: 'banded', statId: 'explicit.stat_1', valueMin: 43, valueMax: 56.5 },
      suffix: { kind: 'banded', statId: 'explicit.stat_1', valueMin: 0.5, valueMax: 10 },
    });
    expect(filtersOf(entry)).toEqual([{ id: 'explicit.stat_1', value: { min: 43.5, max: 66.5 }, disabled: false }]);
  });

  it('throws on a valueless operand, which the tracked schema refuses first', () => {
    const entry = crafted('weapon.bow', 'Bows', {
      prefix: { kind: 'valueless', statId: 'explicit.stat_1' },
      suffix: { kind: 'banded', statId: 'explicit.stat_1', valueMin: 1, valueMax: 2 },
    });
    expect(() => buildSearchBody(entry, itemTypes)).toThrow(/explicit\.stat_1.*valueless operand/);
  });

  it('leaves a statId that only one slot names as its own filter', () => {
    const entry = crafted('weapon.bow', 'Bows', {
      prefix: { kind: 'banded', statId: 'explicit.stat_1', valueMin: 1, valueMax: 2 },
      suffix: { kind: 'banded', statId: 'explicit.stat_2', valueMin: 3, valueMax: 4 },
    });
    expect(ids(entry)).toEqual(['explicit.stat_1', 'explicit.stat_2']);
  });
});
