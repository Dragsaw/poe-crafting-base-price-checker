import { describe, expect, it } from 'vitest';

import { NOW } from '../test-support/dom';
import { hoursBefore } from '../test-support/list-fixtures';
import { DAY_MS, exactAge, HOUR_MS, MINUTE_MS, relativeAge } from './time';

describe('the clock units', () => {
  it('holds a minute, an hour and a day in milliseconds', () => {
    expect(MINUTE_MS).toBe(60_000);
    expect(HOUR_MS).toBe(3_600_000);
    expect(DAY_MS).toBe(86_400_000);
  });
});

describe('exactAge', () => {
  it('prints exact ages with no 48h cut-off: < 1h, whole hours under a day, then whole days', () => {
    expect(exactAge(hoursBefore(NOW, 0), NOW)).toBe('< 1h');
    expect(exactAge(hoursBefore(NOW, 0.99), NOW)).toBe('< 1h');
    expect(exactAge(hoursBefore(NOW, -2), NOW)).toBe('< 1h');
    expect(exactAge(hoursBefore(NOW, 1), NOW)).toBe('1h');
    expect(exactAge(hoursBefore(NOW, 11.5), NOW)).toBe('11h');
    expect(exactAge(hoursBefore(NOW, 23.99), NOW)).toBe('23h');
    expect(exactAge(hoursBefore(NOW, 24), NOW)).toBe('1d');
    expect(exactAge(hoursBefore(NOW, 5 * 24 + 23), NOW)).toBe('5d');
  });
});

describe('relativeAge', () => {
  it('steps the relative age through minutes, hours and days, singular at one', () => {
    expect(relativeAge(0)).toBe('< 1 minute ago');
    expect(relativeAge(59_999)).toBe('< 1 minute ago');
    expect(relativeAge(-5 * MINUTE_MS)).toBe('< 1 minute ago');
    expect(relativeAge(MINUTE_MS)).toBe('1 minute ago');
    expect(relativeAge(59 * MINUTE_MS)).toBe('59 minutes ago');
    expect(relativeAge(60 * MINUTE_MS)).toBe('1 hour ago');
    expect(relativeAge(23 * 60 * MINUTE_MS + 59 * MINUTE_MS)).toBe('23 hours ago');
    expect(relativeAge(24 * 60 * MINUTE_MS)).toBe('1 day ago');
    expect(relativeAge(9 * 24 * 60 * MINUTE_MS)).toBe('9 days ago');
  });
});
