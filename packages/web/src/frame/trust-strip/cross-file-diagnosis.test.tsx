import { afterEach, describe, expect, it, vi } from 'vitest';

import { unmount } from '../../test-support/dom';
import { stacks } from '../../theme/tokens';
import { DIAGNOSIS_LEAD, UNKNOWN, type DiagnosisFailure } from '../trust-facts';
import { click, mountStrip, panel, strip } from './test-support';

afterEach(() => {
  unmount();
  vi.restoreAllMocks();
});

describe('the cross-file diagnosis (AD-17)', () => {
  const FAILURES: readonly DiagnosisFailure[] = [
    {
      check: 'edge-alignment',
      entryKey: '["crafted","weapon.bow","Bows",82,["explicit.stat_1",0,9999],null]',
      detail: 'prefix explicit.stat_1 band [0, 9999] at floor 82: its edges are not the extremes [43, 56.5] of the tiers it contains',
    },
    {
      check: 'kind-agreement',
      entryKey: '["crafted","weapon.crossbow","Crossbows",82,null,["explicit.stat_2",null,null]]',
      detail: 'suffix explicit.stat_2 valueless at floor 82: 1 scoped line on that statId is banded',
    },
  ];

  it('leaves the strip unchanged', () => {
    mountStrip();
    const before = strip().textContent;
    unmount();
    mountStrip({}, [], FAILURES);
    expect(strip().textContent).toBe(before);
    expect(strip().querySelector('[data-health-line]')).toBeNull();
  });

  it('lists one mono line per failure in the Problems column, under its lead', () => {
    mountStrip({}, [], FAILURES);
    click(strip());
    const problems = panel()?.querySelectorAll<HTMLElement>('[data-panel-column]')[0];
    const groups = problems?.querySelectorAll<HTMLElement>('[data-figure-group]') ?? [];
    expect(groups).toHaveLength(1);
    expect(groups[0]?.firstElementChild?.textContent).toBe(DIAGNOSIS_LEAD);
    const lines = [...(groups[0]?.querySelectorAll<HTMLElement>('[data-verbatim]') ?? [])];
    expect(lines.map((element) => element.textContent)).toEqual(
      FAILURES.map((failure) => `${failure.check} · ${failure.entryKey} · ${failure.detail}`),
    );
    for (const verbatim of lines) {
      expect(verbatim.style.fontFamily).toBe(stacks.mono);
      expect(verbatim.style.color).toBe('');
    }
  });

  it('renders no group without a failure', () => {
    mountStrip();
    click(strip());
    const problems = panel()?.querySelectorAll('[data-panel-column]')[0];
    expect(problems?.querySelectorAll('[data-figure-group]')).toHaveLength(0);
    expect(panel()?.querySelector('[data-verbatim]')).toBeNull();
  });

  it('reads one unknown line with weights absent: the checks did not run', () => {
    mountStrip({ weights: undefined }, ['weights']);
    click(strip());
    const problems = panel()?.querySelectorAll('[data-panel-column]')[0];
    const unknown = problems?.querySelectorAll<HTMLElement>('[data-missing]') ?? [];
    expect(Array.from(unknown, (node) => node.textContent)).toEqual([UNKNOWN]);
  });
});
