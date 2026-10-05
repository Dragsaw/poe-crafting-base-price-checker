// The Payout Threshold's bounds and its one persisted value (FR-7, AD-15, UX-DR37), the only thing
// the page writes to browser storage. Each access is guarded: a failing storage gives the default.

import { MONEY_DECIMALS } from '../shared/money';
import { DEFAULT_THRESHOLD } from '../shared/product';

export const THRESHOLD_MIN = 0;
export const THRESHOLD_MAX = 3;
export const THRESHOLD_STEP = 0.05;
export const THRESHOLD_DECIMALS = MONEY_DECIMALS;

export const THRESHOLD_STORAGE_KEY = 'poe-cbpc.payoutThreshold';

/** Plain decimal notation only: no sign, exponent, hex or padding. */
const STORED_FORM = /^\d+(\.\d+)?$/;

function roundToDecimals(value: number): number {
  const factor = 10 ** THRESHOLD_DECIMALS;
  return Math.round(value * factor) / factor;
}

/** A finite value into [0, 3], at 2dp. A parse above 3 ranks at 3. */
export function clampThreshold(value: number): number {
  return roundToDecimals(Math.min(THRESHOLD_MAX, Math.max(THRESHOLD_MIN, value)));
}

function defaultStorage(): Storage {
  return globalThis.localStorage;
}

/** Read once at mount; anything but a finite number in [0, 3] gives `DEFAULT_THRESHOLD`. */
export function readStoredThreshold(storage?: Pick<Storage, 'getItem'>): number {
  try {
    const raw = (storage ?? defaultStorage()).getItem(THRESHOLD_STORAGE_KEY);
    if (raw === null || !STORED_FORM.test(raw)) {
      return DEFAULT_THRESHOLD;
    }
    const value = Number(raw);
    return !Number.isFinite(value) || value < THRESHOLD_MIN || value > THRESHOLD_MAX ? DEFAULT_THRESHOLD : roundToDecimals(value);
  } catch {
    return DEFAULT_THRESHOLD;
  }
}

/** Persists the ranking threshold. A storage that throws is ignored. */
export function writeStoredThreshold(value: number, storage?: Pick<Storage, 'setItem'>): void {
  try {
    (storage ?? defaultStorage()).setItem(THRESHOLD_STORAGE_KEY, String(clampThreshold(value)));
  } catch {
    // Browser storage is a convenience: a blocked write leaves the page as it is.
  }
}
