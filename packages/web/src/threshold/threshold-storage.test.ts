import { afterEach, describe, expect, it } from 'vitest';

import { DEFAULT_THRESHOLD } from '../shared/product';
import {
  clampThreshold,
  readStoredThreshold,
  THRESHOLD_STORAGE_KEY,
  writeStoredThreshold,
} from './threshold-storage';

function storageHolding(value: string | null): Pick<Storage, 'getItem'> {
  return { getItem: (key) => (key === THRESHOLD_STORAGE_KEY ? value : null) };
}

const throwing: Storage = {
  length: 0,
  clear: () => {},
  key: () => null,
  removeItem: () => {},
  getItem: () => {
    throw new DOMException('blocked', 'SecurityError');
  },
  setItem: () => {
    throw new DOMException('blocked', 'QuotaExceededError');
  },
};

afterEach(() => {
  localStorage.clear();
});

describe('the persisted threshold', () => {
  it('uses the product key', () => {
    expect(THRESHOLD_STORAGE_KEY).toBe('poe-cbpc.payoutThreshold');
  });

  // Matrix: first visit.
  it('gives the 0.25 default when nothing is stored', () => {
    expect(DEFAULT_THRESHOLD).toBe(0.25);
    expect(readStoredThreshold(storageHolding(null))).toBe(0.25);
    expect(readStoredThreshold()).toBe(0.25);
  });

  it('reads a stored value in range, rounded to 2dp', () => {
    expect(readStoredThreshold(storageHolding('0.6'))).toBe(0.6);
    expect(readStoredThreshold(storageHolding('0'))).toBe(0);
    expect(readStoredThreshold(storageHolding('3'))).toBe(3);
    expect(readStoredThreshold(storageHolding('1.23456'))).toBe(1.23);
  });

  // Matrix: bad stored value.
  it.each(['abc', '7', '-1', '', '   ', 'NaN', 'Infinity', '3.01', '0x1'])('falls back to the default for %j', (raw) => {
    expect(readStoredThreshold(storageHolding(raw))).toBe(DEFAULT_THRESHOLD);
  });

  // Matrix: storage throws.
  it('falls back to the default when the accessor throws, and a write that throws is swallowed', () => {
    expect(readStoredThreshold(throwing)).toBe(DEFAULT_THRESHOLD);
    expect(() => {
      writeStoredThreshold(0.6, throwing);
    }).not.toThrow();
  });

  it('round-trips a write through the real localStorage', () => {
    writeStoredThreshold(0.6);
    expect(localStorage.getItem(THRESHOLD_STORAGE_KEY)).toBe('0.6');
    expect(readStoredThreshold()).toBe(0.6);
  });

  // Matrix: cleared storage.
  it('returns to the default after storage is cleared', () => {
    writeStoredThreshold(1.5);
    localStorage.clear();
    expect(readStoredThreshold()).toBe(DEFAULT_THRESHOLD);
  });
});

describe('clampThreshold', () => {
  it('holds a value into [0, 3] at 2dp', () => {
    expect(clampThreshold(5)).toBe(3);
    expect(clampThreshold(-1)).toBe(0);
    expect(clampThreshold(0.6)).toBe(0.6);
    expect(clampThreshold(0.125)).toBe(0.13);
  });
});
