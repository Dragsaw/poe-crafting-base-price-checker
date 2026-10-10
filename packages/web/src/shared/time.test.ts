import { describe, expect, it } from 'vitest';

import { compactAge, DAY_MS, HOUR_MS, MINUTE_MS, relativeAge } from './time';

describe('the clock units', () => {
  it('holds a minute, an hour and a day in milliseconds', () => {
    expect(MINUTE_MS).toBe(60_000);
    expect(HOUR_MS).toBe(3_600_000);
    expect(DAY_MS).toBe(86_400_000);
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

describe('compactAge', () => {
  it('steps the sync button age through just now, minutes, hours and days, rounded down', () => {
    expect(compactAge(0)).toBe('just now');
    expect(compactAge(59_999)).toBe('just now');
    expect(compactAge(-5 * MINUTE_MS)).toBe('just now');
    expect(compactAge(MINUTE_MS)).toBe('1m ago');
    expect(compactAge(40 * MINUTE_MS + 59_999)).toBe('40m ago');
    expect(compactAge(HOUR_MS - 1)).toBe('59m ago');
    expect(compactAge(HOUR_MS)).toBe('1h ago');
    expect(compactAge(DAY_MS - 1)).toBe('23h ago');
    expect(compactAge(DAY_MS)).toBe('1d ago');
    expect(compactAge(9 * DAY_MS + HOUR_MS)).toBe('9d ago');
  });
});
