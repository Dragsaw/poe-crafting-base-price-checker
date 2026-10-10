import { describe, expect, it } from 'vitest';

import { CHASE_BUDGET_TEXT, CHASE_CELL_BUDGET, chaseCellCount } from './chase-count';
import { AFFIX_JOIN } from '../combination-text';
import { SHORT_FORMS } from '../short-forms';

/** EXPERIENCE.md *Combinations and short forms*: the working budget of a chase cell, in characters. */
const CHASE_BUDGET_CHARACTERS = 27;

// Inter advances at `typography.chase` (400, 12.5px), read in Chromium with canvas `measureText` beside the
// B measurement. jsdom lays out no text; a glyph missing here means the table grew, so re-measure B.
const ADVANCE_PX: Readonly<Record<string, number>> = {
  ' ': 3.515625,
  '%': 12.274169921875,
  '+': 8.270263671875,
  '1': 5.084228515625,
  '·': 3.60107421875,
  A: 8.624267578125,
  B: 8.1787109375,
  C: 9.130859375,
  D: 9.02099609375,
  E: 7.513427734375,
  F: 7.379150390625,
  I: 3.35693359375,
  L: 7.06787109375,
  M: 11.29150390625,
  P: 7.9833984375,
  R: 8.04443359375,
  S: 8.02001953125,
  T: 8.06884765625,
  a: 7.01904296875,
  c: 7.14111328125,
  d: 7.65380859375,
  e: 7.28759765625,
  f: 4.62646484375,
  g: 7.666015625,
  h: 7.391357421875,
  i: 3.02734375,
  j: 3.02734375,
  k: 6.8603515625,
  l: 3.02734375,
  m: 10.94970703125,
  n: 7.38525390625,
  o: 7.4951171875,
  p: 7.65380859375,
  r: 4.705810546875,
  s: 6.597900390625,
  t: 4.08935546875,
  u: 7.391357421875,
  v: 7.025146484375,
  w: 10.2294921875,
  x: 6.82373046875,
  y: 7.025146484375,
};

/** `T1` at `typography.tier` (600, 0.9em, 0.01em tracking), read with canvas `measureText` beside the B measurement. */
const TIER_T1_PX = 12.4088134765625;
const TIER = 'T1';

function glyphWidth(text: string): number {
  let width = 0;
  for (const glyph of text) {
    const advance = ADVANCE_PX[glyph];
    if (advance === undefined) {
      throw new Error(`no measured advance for "${glyph}": re-measure B`);
    }
    width += advance;
  }
  return width;
}

/** Each affix opens with its tier, which the chase cell sets at `typography.tier`. */
function estimatedWidth(text: string): number {
  const affixes = text.split(AFFIX_JOIN);
  let width = glyphWidth(AFFIX_JOIN) * (affixes.length - 1);
  for (const affix of affixes) {
    if (!affix.startsWith(TIER)) {
      throw new Error(`"${affix}" opens with no ${TIER}`);
    }
    width += TIER_T1_PX + glyphWidth(affix.slice(TIER.length));
  }
  return width;
}

/** Every chase text of two distinct table forms, each led by `T1`, within the character budget. */
function candidates(): readonly string[] {
  const forms = [...new Set(Object.values(SHORT_FORMS))];
  return forms
    .flatMap((first) => forms.filter((second) => second !== first).map((second) => `T1 ${first}${AFFIX_JOIN}T1 ${second}`))
    .filter((text) => text.length <= CHASE_BUDGET_CHARACTERS);
}

describe('the chase-cell budget B', () => {
  it('is a real chase text the short-form table builds', () => {
    expect(candidates()).toContain(CHASE_BUDGET_TEXT);
  });

  it('is measured on the widest candidate, so a wider one in the table fails here', () => {
    const budget = estimatedWidth(CHASE_BUDGET_TEXT);
    const wider = candidates().filter((text) => estimatedWidth(text) > budget);
    expect(wider).toEqual([]);
    expect(CHASE_CELL_BUDGET).toBe(Math.ceil(budget));
  });
});

describe('chaseCellCount', () => {
  // Matrix: wide list, width ≥ 3B + 426; narrow list, below it.
  it('shows three cells from 3B + 426px of list width, and two below', () => {
    const bound = 3 * CHASE_CELL_BUDGET + 426;
    expect(chaseCellCount(bound)).toBe(3);
    expect(chaseCellCount(bound - 0.5)).toBe(2);
  });

  it('shows two at the 952px list width of the minimum frame and three at the 1072px of the maximum (DESIGN.md *The chase column*)', () => {
    expect(chaseCellCount(952)).toBe(2);
    expect(chaseCellCount(1072)).toBe(3);
  });
});
