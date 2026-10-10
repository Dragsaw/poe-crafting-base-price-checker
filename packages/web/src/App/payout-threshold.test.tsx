import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { bodiesWith, hoursBefore, priced, rawEntry } from '../test-support/list-fixtures';
import { gate, gatedArtifacts, serveArtifacts, type ArtifactAnswer } from '../test-support/artifact-server';
import { ARTIFACT_ORDER, type ArtifactKey } from '../load/artifacts';
import { settleTo, unmount } from '../test-support/dom';
import { blur, pastDebounce, typeInto } from '../test-support/threshold-input';
import { THRESHOLD_STORAGE_KEY } from '../threshold/threshold-storage';
import { server, mount, frame, payoutField, unitNames } from './test-support';

afterEach(unmount);

// React's generated ids differ per mount; everything else must match byte for byte.
const withoutIds = (html: string): string => html.replaceAll(/\s(id|for|aria-describedby)="[^"]*"/g, '');

/** Remounts the page, as a reload does: every view state starts again from rest. */
function reload(): void {
  unmount();
  mount();
}

/** Bases at 0.1268, 0.5 and 0.8, and twenty filler bases above 1 so the list can grow. */
function serveLadder(held?: Promise<void>): ReturnType<typeof serveArtifacts> {
  const now = Date.now();
  const low = rawEntry('Low Belt');
  const mid = rawEntry('Mid Belt');
  const high = rawEntry('High Belt');
  const filler = Array.from({ length: 20 }, (_, index) => rawEntry(`Filler Ring ${String(index + 1).padStart(2, '0')}`));
  const bodies = bodiesWith(
    [low, mid, high, ...filler],
    [
      priced(low, 0.1268, hoursBefore(now, 1)),
      priced(mid, 0.5, hoursBefore(now, 1)),
      priced(high, 0.8, hoursBefore(now, 1)),
      ...filler.map((entry, index) => priced(entry, 2 + index, hoursBefore(now, 1))),
    ],
  );
  const answers: Partial<Record<ArtifactKey, ArtifactAnswer>> = {
    tracked: { kind: 'json', body: bodies.tracked },
    dataset: { kind: 'json', body: bodies.dataset },
  };
  if (held === undefined) {
    return serveArtifacts(server, answers);
  }
  // Every artifact waits on `held`, then answers with the ladder (or its valid body).
  return serveArtifacts(
    server,
    Object.fromEntries(
      ARTIFACT_ORDER.map((key) => [key, { kind: 'gated', gate: held, afterGate: answers[key] }]),
    ),
  );
}

function growList(): void {
  const button = frame().querySelector<HTMLButtonElement>('[data-expand-affordance]');
  act(() => {
    button?.click();
  });
}

describe('the payout threshold', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('sits in the header bar threshold slot, and the interim band is gone', async () => {
    serveArtifacts(server);
    mount();
    await settleTo('ready');
    const control = frame().querySelector<HTMLElement>('[data-payout-threshold]');
    expect(control?.parentElement?.dataset['slot']).toBe('threshold');
    expect(control?.closest('[data-header-bar]')).not.toBeNull();
    expect(frame().querySelector('[data-interim-controls], [data-control-group]')).toBeNull();
  });

  // I/O matrix: drag.
  it('re-ranks at each slider step with no debounce and no request, and the figure follows', async () => {
    const requests = serveLadder();
    mount();
    await settleTo('ready');
    growList();
    expect(unitNames()).toContain('Mid Belt');
    const thumb = frame().querySelector<HTMLElement>('[data-payout-threshold] [role="slider"]');
    const seen: boolean[] = [];
    for (let step = 0; step < 5; step += 1) {
      act(() => {
        thumb?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      });
      seen.push(unitNames().includes('Mid Belt'));
    }
    // 0.30 … 0.50 keep the 0.5 base; the sixth step, 0.55, drops it at once.
    expect(seen).toEqual([true, true, true, true, true]);
    act(() => {
      thumb?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    });
    expect(unitNames()).not.toContain('Mid Belt');
    expect(payoutField().value).toBe('0.55');
    expect(localStorage.getItem(THRESHOLD_STORAGE_KEY)).toBe('0.55');
    expect(requests).toHaveLength(ARTIFACT_ORDER.length);
  });

  // I/O matrix: drag, then type.
  it('slides to 0.40, then a typed 1.234 blurs to 1.23 and re-ranks debounced', async () => {
    serveLadder();
    mount();
    await settleTo('ready');
    growList();
    const thumb = frame().querySelector<HTMLElement>('[data-payout-threshold] [role="slider"]');
    for (let step = 0; step < 3; step += 1) {
      act(() => {
        thumb?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      });
    }
    expect(payoutField().value).toBe('0.40');
    typeInto(payoutField(), '1.234');
    expect(unitNames()).toContain('High Belt');
    await pastDebounce();
    expect(unitNames()).not.toContain('High Belt');
    blur(payoutField());
    expect(payoutField().value).toBe('1.23');
    expect(thumb?.getAttribute('aria-valuenow')).toBe('1.23');
  });

  it('renders while pending and ready, and not on the two failure screens', async () => {
    const held = gatedArtifacts();
    serveArtifacts(server, held.answers);
    mount();
    expect(frame().dataset['state']).toBe('pending');
    expect(payoutField().value).toBe('0.25');
    held.openAll();
    await settleTo('ready');
    expect(payoutField().value).toBe('0.25');

    serveArtifacts(server, { tracked: { kind: 'status', status: 404 } });
    reload();
    await settleTo('refused');
    expect(frame().querySelector('[data-payout-threshold]')).toBeNull();

    serveArtifacts(server, { config: { kind: 'network-error' } });
    reload();
    await settleTo('failed');
    expect(frame().querySelector('[data-payout-threshold]')).toBeNull();
  });

  // Matrix: raise threshold.
  it('re-ranks a raised threshold after the debounce with no request, and the dropped base is absent from the grown list', async () => {
    const requests = serveLadder();
    mount();
    await settleTo('ready');
    expect(requests).toHaveLength(ARTIFACT_ORDER.length);
    growList();
    expect(unitNames()).toContain('Mid Belt');
    expect(unitNames()).toContain('High Belt');
    expect(unitNames()).not.toContain('Low Belt');

    typeInto(payoutField(), '0.6');
    // Before the debounce the ranking has not moved.
    expect(unitNames()).toContain('Mid Belt');
    await pastDebounce();
    expect(unitNames()).not.toContain('Mid Belt');
    expect(unitNames()).toContain('High Belt');
    // The list is still grown, every ranked row is on the page, and the 0.5 base is nowhere.
    expect(unitNames()).toHaveLength(21);
    expect(frame().textContent).not.toContain('Mid Belt');
    expect(requests).toHaveLength(ARTIFACT_ORDER.length);
    expect(localStorage.getItem(THRESHOLD_STORAGE_KEY)).toBe('0.6');
    // The slider follows the typed value.
    expect(frame().querySelector('[data-payout-threshold] [role="slider"]')?.getAttribute('aria-valuenow')).toBe('0.6');
  });

  it('keeps a threshold typed while pending through the move to ready, and ranks at it', async () => {
    const held = gate();
    serveLadder(held.promise);
    mount();
    expect(frame().dataset['state']).toBe('pending');
    typeInto(payoutField(), '0.6');
    // The set arrives before the debounce elapses.
    held.open();
    await settleTo('ready');
    await pastDebounce();
    expect(payoutField().value).toBe('0.60');
    expect(localStorage.getItem(THRESHOLD_STORAGE_KEY)).toBe('0.6');
    growList();
    expect(unitNames()).not.toContain('Mid Belt');
    expect(unitNames()).toContain('High Belt');
  });

  // Matrix: lower threshold.
  it('gives a sub-0.25 base a row when the threshold is lowered below it', async () => {
    const requests = serveLadder();
    mount();
    await settleTo('ready');
    growList();
    expect(unitNames()).not.toContain('Low Belt');
    typeInto(payoutField(), '0.1');
    await pastDebounce();
    expect(unitNames().at(-1)).toBe('Low Belt');
    expect(requests).toHaveLength(ARTIFACT_ORDER.length);
  });

  // Matrix: emptied.
  it('does not re-rank on an emptied field, and blur restores the last valid value', async () => {
    serveLadder();
    mount();
    await settleTo('ready');
    growList();
    const before = unitNames();
    typeInto(payoutField(), '');
    await pastDebounce();
    expect(unitNames()).toEqual(before);
    blur(payoutField());
    expect(payoutField().value).toBe('0.25');
    expect(localStorage.getItem(THRESHOLD_STORAGE_KEY)).toBeNull();
  });

  // Matrix: reload.
  it('keeps the set threshold across a reload, and resets the grown list and the open rows', async () => {
    serveLadder();
    mount();
    await settleTo('ready');
    typeInto(payoutField(), '0.6');
    await pastDebounce();
    growList();
    const firstRow = frame().querySelector<HTMLElement>('[data-ranked-row]');
    act(() => {
      firstRow?.click();
    });
    expect(frame().querySelectorAll('[data-ranked-row][data-open]')).toHaveLength(1);
    const ordering = unitNames();

    serveLadder();
    reload();
    await settleTo('ready');
    expect(payoutField().value).toBe('0.60');
    expect(frame().querySelectorAll('[data-ranked-row][data-open]')).toHaveLength(0);
    expect(frame().querySelector('[data-expand-affordance]')?.getAttribute('aria-expanded')).toBe('false');
    growList();
    expect(unitNames()).toEqual(ordering);
  });

  it('ranks at a stored 0.6 from the first paint', async () => {
    localStorage.setItem(THRESHOLD_STORAGE_KEY, '0.6');
    serveLadder();
    mount();
    await settleTo('ready');
    expect(payoutField().value).toBe('0.60');
    growList();
    expect(unitNames()).not.toContain('Mid Belt');
    expect(unitNames()).toContain('High Belt');
  });

  // Matrix: bad stored value.
  it.each(['abc', '7', '-1'])('falls back to 0.25 for a stored %j', async (stored) => {
    localStorage.setItem(THRESHOLD_STORAGE_KEY, stored);
    serveLadder();
    mount();
    await settleTo('ready');
    expect(payoutField().value).toBe('0.25');
    growList();
    expect(unitNames()).toContain('Mid Belt');
    expect(unitNames()).not.toContain('Low Belt');
  });

  // Matrix: storage throws.
  it('falls back to 0.25 when storage throws, and typing still re-ranks', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    serveLadder();
    mount();
    await settleTo('ready');
    expect(payoutField().value).toBe('0.25');
    growList();
    typeInto(payoutField(), '0.6');
    await pastDebounce();
    expect(unitNames()).not.toContain('Mid Belt');
    expect(unitNames()).toContain('High Belt');
  });

  // Matrix: cleared storage.
  it('returns to 0.25 after storage is cleared, and the rest of the page is identical', async () => {
    serveLadder();
    mount();
    await settleTo('ready');
    const atRest = frame().outerHTML;
    typeInto(payoutField(), '0.6');
    await pastDebounce();
    blur(payoutField());
    expect(localStorage.getItem(THRESHOLD_STORAGE_KEY)).toBe('0.6');

    localStorage.clear();
    serveLadder();
    reload();
    await settleTo('ready');
    expect(payoutField().value).toBe('0.25');
    expect(withoutIds(frame().outerHTML)).toBe(withoutIds(atRest));
  });
});
