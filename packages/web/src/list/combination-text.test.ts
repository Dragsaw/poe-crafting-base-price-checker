import { HybridModifierRefSchema, type CraftedTrackedEntry, type ModifierRef } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import { banded } from '../test-support/list-fixtures';
import { affixText, bandedFallback, combinationString, combinationText, statTexts } from './combination-text';

const COLD_RES = 'explicit.stat_4220027924';
const MANA = 'explicit.stat_1050105434';
const PHYS = 'explicit.stat_1509134228';
const BOLT = 'explicit.stat_1967051901';
const FIRE = 'explicit.stat_709508406';
const ES = 'explicit.stat_2482852589';
const EVASION = 'explicit.stat_2106365538';
const UNFORMED = 'explicit.stat_99';

const STATS = statTexts({
  result: [
    {
      id: 'explicit',
      label: 'Explicit',
      entries: [
        { id: COLD_RES, text: '#% to Cold Resistance' },
        { id: FIRE, text: 'Adds # to # Fire Damage' },
        { id: BOLT, text: 'Loads an additional bolt' },
        { id: UNFORMED, text: '#% increased Something' },
      ],
    },
    // A later group naming the same id changes nothing.
    { id: 'implicit', label: 'Implicit', entries: [{ id: COLD_RES, text: 'implicit text' }] },
  ],
});

function entry(prefix: ModifierRef, suffix: ModifierRef): CraftedTrackedEntry {
  return { kind: 'crafted', categoryId: 'armour.helmet', className: 'Helmets', itemLevelMin: 82, prefix, suffix, status: 'active' };
}

describe('combinationText', () => {
  it('prints the tier and the form per affix, prefix first, joined by the middle dot', () => {
    const parts = combinationText(entry(banded(MANA, 150, 180, 'T1'), banded(COLD_RES, 41, 45, 'T1')), STATS);
    expect(parts).toEqual([
      { text: 'T1 Mana', verbatim: false },
      { text: 'T1 Cold Res', verbatim: false },
    ]);
    expect(combinationString(parts)).toBe('T1 Mana · T1 Cold Res');
  });

  it('prints a mixture tier verbatim, hyphen kept', () => {
    expect(affixText(banded(PHYS, 100, 179, 'T1-T2'), STATS)).toEqual({ text: 'T1-T2 % Phys', verbatim: false });
  });

  it('prints a valueless reference as its form alone, with no tier, in the curated register', () => {
    expect(affixText({ kind: 'valueless', statId: BOLT }, STATS)).toEqual({ text: 'Extra Bolt', verbatim: false });
    expect(affixText({ kind: 'valueless', statId: BOLT, acceptedTier: 'T1' }, STATS)).toEqual({
      text: 'Extra Bolt',
      verbatim: false,
    });
  });

  it('falls back to the catalogue text with no band for a valueless reference with no form', () => {
    expect(affixText({ kind: 'valueless', statId: UNFORMED }, STATS)).toEqual({
      text: '#% increased Something',
      verbatim: true,
    });
  });

  it('falls back to the catalogue text with the band for a banded reference with no tier (a curation gap)', () => {
    expect(affixText(banded(COLD_RES, 35, 52.5), STATS)).toEqual({ text: '35–52.5% to Cold Resistance', verbatim: true });
  });

  it('falls back to the catalogue text with the band for a stat with no form (a product gap), even with a tier', () => {
    expect(affixText(banded(UNFORMED, 20, 30, 'T1'), STATS)).toEqual({ text: '20–30% increased Something', verbatim: true });
  });

  it('prints the raw statId and the band for a stat the catalogue does not hold', () => {
    expect(affixText(banded('explicit.stat_404', 1, 2), STATS)).toEqual({ text: 'explicit.stat_404 1–2', verbatim: true });
    expect(affixText({ kind: 'valueless', statId: 'explicit.stat_404' }, STATS)).toEqual({
      text: 'explicit.stat_404',
      verbatim: true,
    });
  });

  it('mixes a curated affix and a fallback affix in one Combination', () => {
    expect(combinationText(entry(banded(MANA, 150, 180, 'T1'), banded(COLD_RES, 41, 45)), STATS)).toEqual([
      { text: 'T1 Mana', verbatim: false },
      { text: '41–45% to Cold Resistance', verbatim: true },
    ]);
  });

  // [NOTE FOR UX] (EXPERIENCE.md memlog 143): nobody has ruled on what the second of two such bands prints.
  it('prints two bands of one modifier that declare one tier identically', () => {
    expect(affixText(banded(PHYS, 100, 139, 'T1'), STATS)).toEqual(affixText(banded(PHYS, 140, 179, 'T1'), STATS));
  });
});

describe('bandedFallback', () => {
  it('substitutes the band for exactly one #', () => {
    expect(bandedFallback('#% to Cold Resistance', 35, 52.5)).toBe('35–52.5% to Cold Resistance');
  });

  it('appends the band when the text holds two #', () => {
    expect(bandedFallback('Adds # to # Fire Damage', 4.41, 5)).toBe('Adds # to # Fire Damage 4.41–5');
  });

  it('appends the band when the text holds no #', () => {
    expect(bandedFallback('explicit.stat_404', 1, 2)).toBe('explicit.stat_404 1–2');
  });

  it('prints the numbers as written, with no rounding', () => {
    expect(bandedFallback('#', 0.333333, 1e-7)).toBe('0.333333–1e-7');
  });
});

/** A hybrid reference built through its schema, so its lines arrive sorted by `statId` as in production. */
function hybrid(lines: readonly object[], acceptedTier?: string): ModifierRef {
  return HybridModifierRefSchema.parse({ kind: 'hybrid', lines, ...(!(acceptedTier === undefined) && { acceptedTier }) });
}

function line(statId: string, valueMin: number, valueMax: number): object {
  return { statId, valueMin, valueMax };
}

describe('affixText: a hybrid reference', () => {
  it('prints the tier, then the short forms, comma-joined, in the curated register', () => {
    expect(affixText(hybrid([line(EVASION, 10, 20), line(ES, 30, 40)], 'T1'), STATS)).toEqual({
      text: 'T1 % ES, % Evasion',
      verbatim: false,
    });
  });

  it('orders the lines by printed text, not by statId, whatever the file order', () => {
    // MANA sorts before PHYS by statId; `% Phys` sorts before `Mana` by code unit.
    expect(MANA < PHYS).toBe(true);
    for (const lines of [
      [line(PHYS, 1, 2), line(MANA, 3, 4)],
      [line(MANA, 3, 4), line(PHYS, 1, 2)],
    ]) {
      expect(affixText(hybrid(lines, 'T1'), STATS)).toEqual({ text: 'T1 % Phys, Mana', verbatim: false });
    }
  });

  it('joins three lines with the same comma, under a mixture tier', () => {
    expect(affixText(hybrid([line(MANA, 1, 2), line(PHYS, 3, 4), line(COLD_RES, 5, 6)], 'T1-T2'), STATS)).toEqual({
      text: 'T1-T2 % Phys, Cold Res, Mana',
      verbatim: false,
    });
  });

  it('prints every line in catalogue form with its band when there is no tier', () => {
    expect(affixText(hybrid([line(COLD_RES, 41, 45), line(FIRE, 4.41, 5)]), STATS)).toEqual({
      text: '41–45% to Cold Resistance, Adds # to # Fire Damage 4.41–5',
      verbatim: true,
    });
  });

  it('prints every line in catalogue form, none short, when one line has no short form', () => {
    expect(affixText(hybrid([line(COLD_RES, 41, 45), line(UNFORMED, 20, 30)], 'T1'), STATS)).toEqual({
      text: '20–30% increased Something, 41–45% to Cold Resistance',
      verbatim: true,
    });
  });

  it('prints every line in catalogue form when a line is valueless, and that line has no band', () => {
    expect(affixText(hybrid([line(COLD_RES, 41, 45), { statId: BOLT }], 'T1'), STATS)).toEqual({
      text: '41–45% to Cold Resistance, Loads an additional bolt',
      verbatim: true,
    });
  });

  it('prints the raw statId, with its band, for a line the catalogue does not hold', () => {
    expect(affixText(hybrid([line(COLD_RES, 41, 45), line('explicit.stat_404', 1, 2)]), STATS)).toEqual({
      text: '41–45% to Cold Resistance, explicit.stat_404 1–2',
      verbatim: true,
    });
  });

  it('joins a hybrid prefix and a single suffix with the middle dot', () => {
    const parts = combinationText(entry(hybrid([line(ES, 1, 2), line(EVASION, 3, 4)], 'T1'), banded(MANA, 150, 180, 'T1')), STATS);
    expect(parts).toEqual([
      { text: 'T1 % ES, % Evasion', verbatim: false },
      { text: 'T1 Mana', verbatim: false },
    ]);
    expect(combinationString(parts)).toBe('T1 % ES, % Evasion · T1 Mana');
  });
});
