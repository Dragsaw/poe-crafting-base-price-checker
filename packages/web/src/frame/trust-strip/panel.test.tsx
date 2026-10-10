import { afterEach, describe, expect, it, vi } from 'vitest';

import { unmount } from '../../test-support/dom';
import { AFFORDANCE_CLOSED, AFFORDANCE_OPEN, PANEL_HEADINGS } from '../trust-facts';
import { affordance, click, mountStrip, panel, strip } from './test-support';

afterEach(() => {
  unmount();
  vi.restoreAllMocks();
});

// The strip leaves the page in Story 4.5 and is deleted in Story 4.6; until then it is tested alone.
describe('the toggle and the panel', () => {
  it('is closed on load, and a click anywhere on the strip opens then closes it', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    mountStrip();
    expect(panel()).toBeUndefined();
    expect(affordance()).toBe(AFFORDANCE_CLOSED);
    click(strip().querySelector('[data-trust-line="sync"]'));
    expect(panel()).not.toBeUndefined();
    expect(affordance()).toBe(AFFORDANCE_OPEN);
    click(strip().querySelector('[data-trust-line="weights"]'));
    expect(panel()).toBeUndefined();
    expect(affordance()).toBe(AFFORDANCE_CLOSED);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('does not close when the panel itself is clicked', () => {
    mountStrip();
    click(strip());
    click(panel());
    expect(panel()).not.toBeUndefined();
  });

  it('opens the four-column sync report panel', () => {
    mountStrip();
    click(strip());
    const headings = [...(panel()?.querySelectorAll('[data-panel-heading]') ?? [])].map((heading) => heading.textContent);
    expect(headings).toEqual([...PANEL_HEADINGS]);
  });
});
