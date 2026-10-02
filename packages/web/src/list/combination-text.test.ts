import type { CraftedTrackedEntry, ModifierRef } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import { banded } from '../test-support/list-fixtures';
import { affixText, bandedFallback, combinationString, combinationText, statTexts } from './combination-text';

const COLD_RES = 'explicit.stat_4220027924';
const MANA = 'explicit.stat_1050105434';
const PHYS = 'explicit.stat_1509134228';
const BOLT = 'explicit.stat_1967051901';
const FIRE = 'explicit.stat_709508406';
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

function entry(prefix: ModifierRef | undefined, suffix: ModifierRef | undefined): CraftedTrackedEntry {
  const base = { kind: 'crafted', categoryId: 'armour.helmet', className: 'Helmets', itemLevelMin: 82, status: 'active' } as const;
  return { ...base, ...(prefix === undefined ? {} : { prefix }), ...(suffix === undefined ? {} : { suffix }) };
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

  it('prints one affix alone', () => {
    expect(combinationString(combinationText(entry(undefined, banded(COLD_RES, 41, 45, 'T1')), STATS))).toBe('T1 Cold Res');
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
