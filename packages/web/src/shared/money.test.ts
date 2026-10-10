import { describe, expect, it } from 'vitest';

import { BELOW_PRINTABLE, formatDivine, formatThreshold, LOSS_BELOW_PRINTABLE, MINUS } from './money';

describe('formatDivine', () => {
  it('prints 2dp', () => {
    expect(formatDivine(0.5)).toBe('0.50');
    expect(formatDivine(1)).toBe('1.00');
    expect(formatDivine(2.4249)).toBe('2.42');
    expect(formatDivine(0.005)).toBe('0.01');
  });

  it('prints a present figure too small for 2dp as < 0.01, never 0.00', () => {
    expect(BELOW_PRINTABLE).toBe('< 0.01');
    expect(formatDivine(0.0031)).toBe('< 0.01');
    expect(formatDivine(0.0049)).toBe('< 0.01');
    expect(formatDivine(0.0001)).toBe('< 0.01');
  });
});

describe('formatDivine on a negative figure', () => {
  it('prints a loss too small for 2dp as < 0.00, never 0.00 or -0.00', () => {
    expect(LOSS_BELOW_PRINTABLE).toBe('< 0.00');
    expect(formatDivine(-0.001)).toBe('< 0.00');
    expect(formatDivine(-0.0049)).toBe('< 0.00');
    expect(formatDivine(-0.00499999)).toBe('< 0.00');
  });

  it('prints -0.005 as a figure, the mirror of 0.005', () => {
    expect(formatDivine(-0.005)).toBe(`${MINUS}0.01`);
  });

  it('prints negative zero as 0.00', () => {
    expect(formatDivine(-0)).toBe('0.00');
  });

  it('keeps the sign of a negative figure that rounds to a non-zero value, as U+2212', () => {
    expect(MINUS).toBe('\u{2212}');
    expect(formatDivine(-0.01)).toBe(`${MINUS}0.01`);
    expect(formatDivine(-2.5)).toBe(`${MINUS}2.50`);
    expect(formatDivine(-2.5)).not.toContain('-');
  });
});

describe('formatThreshold', () => {
  it('always prints two decimals, zero included', () => {
    expect(formatThreshold(0.25)).toBe('0.25');
    expect(formatThreshold(3)).toBe('3.00');
    expect(formatThreshold(0.6)).toBe('0.60');
    expect(formatThreshold(0)).toBe('0.00');
  });

  it('has no < 0.01 or < 0.00 floor, unlike formatDivine', () => {
    expect(formatThreshold(0.004)).toBe('0.00');
    expect(formatThreshold(-0.003)).toBe('0.00');
    expect(formatDivine(0.004)).toBe(BELOW_PRINTABLE);
  });
});
