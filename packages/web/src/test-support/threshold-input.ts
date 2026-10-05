/** Drives the Payout Threshold's input as a keystroke would, for the threshold and App tests. */

import { act } from 'react';

import { COMMIT_DEBOUNCE_MS } from '../threshold/PayoutThreshold';

/** Replaces the field's text as a keystroke would, through React's value tracker. */
export function typeInto(field: HTMLInputElement, text: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  act(() => {
    field.focus();
    setter?.call(field, text);
    field.setSelectionRange(text.length, text.length);
    field.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

export function blur(field: HTMLInputElement): void {
  act(() => {
    field.blur();
  });
}

/** Past the ~150ms debounce, inside `act`. */
export async function pastDebounce(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, COMMIT_DEBOUNCE_MS + 50));
  });
}
