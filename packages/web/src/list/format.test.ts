import { describe, expect, it } from 'vitest';

import { hoursBefore, priced, rawEntry, unpriced } from '../test-support/list-fixtures';
import {
  ageMark,
  DEFAULT_THRESHOLD,
  formatDivine,
  FRESHNESS_CUTOFF_HOURS,
  MONEY_PHRASES,
  rawNote,
  TOP_ROWS,
  unitLabel,
} from './format';

const NOW = Date.parse('2026-09-26T12:00:00.000Z');
const BELT = rawEntry('Wide Belt');

describe('the view constants', () => {
  it('cuts freshness at 48h, shows the top 20 and starts at 0.25 Divine', () => {
    expect(FRESHNESS_CUTOFF_HOURS).toBe(48);
    expect(TOP_ROWS).toBe(20);
    expect(DEFAULT_THRESHOLD).toBe(0.25);
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

describe('formatDivine', () => {
  it('prints 2dp', () => {
    expect(formatDivine(0.5)).toBe('0.50');
    expect(formatDivine(1)).toBe('1.00');
    expect(formatDivine(2.4249)).toBe('2.42');
    expect(formatDivine(0.005)).toBe('0.01');
  });

  it('prints a present figure too small for 2dp as < 0.01, never 0.00', () => {
    expect(formatDivine(0.0031)).toBe('< 0.01');
    expect(formatDivine(0.0049)).toBe('< 0.01');
    expect(formatDivine(0.0001)).toBe('< 0.01');
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
