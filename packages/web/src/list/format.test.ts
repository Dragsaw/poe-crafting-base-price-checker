import { describe, expect, it } from 'vitest';

import { NOW } from '../test-support/dom';
import { hoursBefore, priced, rawEntry, unpriced } from '../test-support/list-fixtures';
import {
  ageMark,
  combinationAges,
  combinationFigure,
  FRESHNESS_CUTOFF_HOURS,
  MONEY_PHRASES,
  PANEL_ASKING_SENTENCE,
  PRICE_STATE_GLYPHS,
  rawCombinationNote,
  rawExpansionNote,
  rawNote,
  rawPanelSubLine,
  sampleText,
  STATE_NOTES,
  stateWord,
  unitLabel,
  type CombinationState,
} from './format';

const BELT = rawEntry('Wide Belt');

describe('the view constants', () => {
  it('cuts freshness at 48h', () => {
    expect(FRESHNESS_CUTOFF_HOURS).toBe(48);
  });

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

describe('ageMark', () => {
  it('is silent under the cut-off', () => {
    expect(ageMark(priced(BELT, 0.5, hoursBefore(NOW, 3)), NOW)).toBeUndefined();
    expect(ageMark(priced(BELT, 0.5, hoursBefore(NOW, 47.99)), NOW)).toBeUndefined();
  });

  it('reads the observation clock for a priced entry, from exactly 48h', () => {
    expect(ageMark(priced(BELT, 0.5, hoursBefore(NOW, 48)), NOW)).toEqual({ kind: 'stale', word: 'priced 2d ago' });
    expect(ageMark(priced(BELT, 0.5, hoursBefore(NOW, 5 * 24 + 4)), NOW)).toEqual({
      kind: 'stale',
      word: 'priced 5d ago',
    });
  });

  it('reads observedAt, not lastAttemptedAt, where the price is priced', () => {
    const entry = { ...priced(BELT, 0.5, hoursBefore(NOW, 72)), lastAttemptedAt: hoursBefore(NOW, 1) };
    expect(ageMark(entry, NOW)).toEqual({ kind: 'stale', word: 'priced 3d ago' });
  });

  it('reads a league-mismatched observation as priced too', () => {
    expect(ageMark(priced(BELT, 0.5, hoursBefore(NOW, 96), 'Standard'), NOW)).toEqual({
      kind: 'stale',
      word: 'priced 4d ago',
    });
  });

  it('reads lastAttemptedAt where there is no observation', () => {
    expect(ageMark(unpriced(BELT, { state: 'no-listings' }, hoursBefore(NOW, 9 * 24 + 1)), NOW)).toEqual({
      kind: 'stale',
      word: 'tried 9d ago',
    });
    expect(ageMark(unpriced(BELT, { state: 'no-listings' }, hoursBefore(NOW, 2)), NOW)).toBeUndefined();
  });

  it('reads never attempted where neither clock exists', () => {
    const never = { kind: 'never', word: 'never attempted' };
    expect(ageMark(undefined, NOW)).toEqual(never);
    expect(ageMark(unpriced(BELT, { state: 'not-yet-synced', reason: 'never-synced' }), NOW)).toEqual(never);
  });
});

describe('labels', () => {
  it('trims each underscore of a className to a space and changes nothing else', () => {
    expect(unitLabel('One_Hand_Maces')).toBe('One Hand Maces');
    expect(unitLabel('Bow')).toBe('Bow');
    expect(unitLabel('_a__b_')).toBe(' a  b ');
  });

  it('spells the Item Level Floor in the raw note', () => {
    expect(rawNote(82)).toBe(
      'uncrafted at Item Level 82 — ranked at its own current asking price, not at a craft outcome',
    );
  });
});

describe('the expansion copy', () => {
  const PRICED: Extract<CombinationState, { state: 'priced' }> = { state: 'priced', priceDivine: 0.8, sampleSize: 10, observedAt: hoursBefore(NOW, 11) };
  const NO_LISTINGS: CombinationState = { state: 'no-listings' };
  const NEVER: CombinationState = { state: 'not-yet-synced', reason: 'never-synced' };
  const MISMATCH: CombinationState = { state: 'not-yet-synced', reason: 'league-mismatch' };
  const NO_RATE: CombinationState = { state: 'not-yet-synced', reason: 'no-exchange-rate' };
  const UNRESOLVABLE: CombinationState = { state: 'unresolvable' };

  it('labels both clocks, shows priced only on a priced row, and leaves a missing clock empty', () => {
    expect(combinationAges(PRICED, hoursBefore(NOW, 3), NOW)).toEqual({ observed: 'priced 11h ago', attempted: 'tried 3h ago' });
    expect(combinationAges(PRICED, undefined, NOW)).toEqual({ observed: 'priced 11h ago', attempted: undefined });
    expect(combinationAges(NO_LISTINGS, hoursBefore(NOW, 3), NOW)).toEqual({ observed: undefined, attempted: 'tried 3h ago' });
    expect(combinationAges(MISMATCH, hoursBefore(NOW, 50), NOW)).toEqual({ observed: undefined, attempted: 'tried 2d ago' });
    expect(combinationAges(UNRESOLVABLE, hoursBefore(NOW, 5), NOW)).toEqual({ observed: undefined, attempted: 'tried 5h ago' });
  });

  it('leaves both age cells empty for a never-synced entry, even with a stamped clock', () => {
    expect(combinationAges(NEVER, undefined, NOW)).toEqual({ observed: undefined, attempted: undefined });
    expect(combinationAges(NEVER, hoursBefore(NOW, 3), NOW)).toEqual({ observed: undefined, attempted: undefined });
  });

  it('prints the sample: N listings, 1 listing, 0 listings found, no sample', () => {
    expect(sampleText(PRICED)).toBe('10 listings');
    expect(sampleText({ ...PRICED, sampleSize: 1 })).toBe('1 listing');
    expect(sampleText(NO_LISTINGS)).toBe('0 listings found');
    expect(sampleText(NEVER)).toBe('no sample');
    expect(sampleText(NO_RATE)).toBe('no sample');
    expect(sampleText(UNRESOLVABLE)).toBe('no sample');
  });

  it('prints the state word, with the reason for not-yet-synced, and a glyph per state', () => {
    expect([PRICED, NO_LISTINGS, NEVER, MISMATCH, NO_RATE, UNRESOLVABLE].map(stateWord)).toEqual([
      'priced',
      'no-listings',
      'not-yet-synced · never-synced',
      'not-yet-synced · league-mismatch',
      'not-yet-synced · no-exchange-rate',
      'unresolvable',
    ]);
    expect(PRICE_STATE_GLYPHS).toEqual({ priced: '●', 'no-listings': '○', 'not-yet-synced': '∆', unresolvable: '×' });
  });

  it('prints a figure at 2dp or < 0.01, and a money phrase for no figure', () => {
    expect(combinationFigure(PRICED)).toEqual({ kind: 'figure', text: '0.80' });
    expect(combinationFigure({ ...PRICED, priceDivine: 0.003 })).toEqual({ kind: 'figure', text: '< 0.01' });
    expect(combinationFigure(NO_LISTINGS)).toEqual({ kind: 'phrase', text: 'an open question' });
    expect(combinationFigure(NEVER)).toEqual({ kind: 'phrase', text: 'no figure yet' });
    expect(combinationFigure(UNRESOLVABLE)).toEqual({ kind: 'phrase', text: 'not valued' });
  });

  it('takes the raw note when priced and the state note verbatim otherwise', () => {
    expect(rawExpansionNote(82)).toBe('no affixes — this Base Type priced as it drops, at Item Level 82');
    expect(rawCombinationNote(PRICED, 75)).toBe('no affixes — this Base Type priced as it drops, at Item Level 75');
    expect(rawCombinationNote(NO_LISTINGS, 82)).toBe('nobody is listing this right now — a jackpot and junk look alike here');
    expect(rawCombinationNote(NEVER, 82)).toBe('no request was ever issued for this entry');
    expect(rawCombinationNote(MISMATCH, 82)).toBe('the observation belongs to another league');
    expect(rawCombinationNote(NO_RATE, 82)).toBe('the listing currency had no rate at sync time');
    expect(rawCombinationNote(UNRESOLVABLE, 82)).toBe('its id is gone from the trade API — a patch did this');
    expect(STATE_NOTES['no-listings']).not.toMatch(/worthless|no value/);
  });

  it('repeats the Item Level, the threshold at 2dp and the asking-price sentence, with no Craft Recipe sentence', () => {
    const line = rawPanelSubLine(82, 0.5);
    expect(line).toBe(
      'Uncrafted at Item Level 82, ranked at its own current asking price and not at a craft outcome. ' +
        'One Combination is tracked here: the degenerate Combination of no affixes. ' +
        'Payout Threshold 0.50 Divine. ' +
        'Every price here is a current asking price from a live instant-buyout listing.',
    );
    expect(line.endsWith(PANEL_ASKING_SENTENCE)).toBe(true);
    expect(rawPanelSubLine(70, 0.25)).toContain('Item Level 70,');
    expect(rawPanelSubLine(70, 0.25)).toContain('Payout Threshold 0.25 Divine.');
    expect(line).not.toMatch(/Craft Recipe|Craft Cost/);
  });
});
