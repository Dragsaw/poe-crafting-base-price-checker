import { describe, expect, it } from 'vitest';

import {
  BELOW_THRESHOLD_NOTE,
  CURATION_MARKS,
  FEWER_LINES_COPY,
  itemLevelFloor,
  MONEY_PHRASES,
  moreLinesCopy,
  prunedCopy,
  SELL_AS_IS,
  sellAsIsLine,
  unitLabel,
} from './format';

describe('the view constants', () => {
  it('holds the five money-slot phrases, none of them number-shaped', () => {
    expect(Object.values(MONEY_PHRASES)).toEqual([
      'an open question',
      'no figure yet',
      'not valued',
      'unknown',
      'not tracked',
    ]);
    for (const phrase of Object.values(MONEY_PHRASES)) {
      expect(phrase).not.toMatch(/\d|—|-/);
    }
  });
});

describe('labels', () => {
  it('trims each underscore of a className to a space and changes nothing else', () => {
    expect(unitLabel('One_Hand_Maces')).toBe('One Hand Maces');
    expect(unitLabel('Bow')).toBe('Bow');
    expect(unitLabel('_a__b_')).toBe(' a  b ');
  });

  // The shipped defect printed `Helmets_str` as `Helmets str`.
  it('spells a trailing defence suffix as a capitalised, slash-joined parenthetical', () => {
    expect(unitLabel('Helmets_str')).toBe('Helmets (Str)');
    expect(unitLabel('Gloves_dex_int')).toBe('Gloves (Dex/Int)');
    expect(unitLabel('Body_Armours_str_dex_int')).toBe('Body Armours (Str/Dex/Int)');
    expect(unitLabel('Bows')).toBe('Bows');
    expect(unitLabel('Amulets')).toBe('Amulets');
  });

  it('keeps a defence word that is the whole name or sits mid-name', () => {
    expect(unitLabel('str')).toBe('str');
    expect(unitLabel('dex_Gloves')).toBe('dex Gloves');
  });

  it('spells the Item Level Floor in the sell-as-is line', () => {
    expect(sellAsIsLine(82)).toBe(`${SELL_AS_IS} · ${itemLevelFloor(82)}`);
    expect(itemLevelFloor(82)).toBe('item level 82+');
    expect(sellAsIsLine(75)).toBe('Sell as is · item level 75+');
  });
});

describe('the expansion copy', () => {
  // State 39 and Interaction 7: one show-more look, `+` closed and `−` open.
  it('counts the hidden lines and the pruned lines in the show-more forms', () => {
    expect(moreLinesCopy(3)).toBe('+ 3 more combinations');
    expect(moreLinesCopy(1)).toBe('+ 1 more combination');
    expect(FEWER_LINES_COPY).toBe('− show fewer');
    expect(prunedCopy(2, false)).toBe('+ 2 pruned');
    expect(prunedCopy(2, true)).toBe('− 2 pruned');
  });

  it('holds the curation marks and the below-threshold word of the Copy Deck', () => {
    expect(CURATION_MARKS).toEqual({ pinned: '* pinned', pruned: '† pruned' });
    expect(BELOW_THRESHOLD_NOTE).toBe('below threshold');
  });
});
