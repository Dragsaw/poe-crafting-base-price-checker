import { afterEach, describe, expect, it, vi } from 'vitest';

import { unmount } from '../../test-support/dom';
import { px, spacing, stacks } from '../../theme/tokens';
import type { DiagnosisFailure } from '../trust-facts';
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

  it('lists one mono line per failure as the third group of the second column', () => {
    mountStrip({}, [], FAILURES);
    click(strip());
    const broken = panel()?.querySelectorAll<HTMLElement>('[data-panel-column]')[1];
    const groups = broken?.querySelectorAll<HTMLElement>('[data-figure-group]') ?? [];
    expect(groups).toHaveLength(3);
    const diagnosis = groups[2];
    expect(diagnosis?.style.marginTop).toBe(px(spacing.syncReportGroupGap));
    const lines = [...diagnosis?.querySelectorAll<HTMLElement>('[data-verbatim]') ?? []];
    expect(lines.map((element) => element.textContent)).toEqual(
      FAILURES.map((failure) => `${failure.check} · ${failure.entryKey} · ${failure.detail}`),
    );
    for (const verbatim of lines) {
      expect(verbatim.style.fontFamily).toBe(stacks.mono);
      expect(verbatim.style.fontSize).toBe('10.5px');
      expect(verbatim.style.fontWeight).toBe('400');
      expect(verbatim.style.lineHeight).toBe('1.85');
      expect(verbatim.style.color).toBe('');
    }
  });

  it('renders no group without a failure', () => {
    mountStrip();
    click(strip());
    const broken = panel()?.querySelectorAll('[data-panel-column]')[1];
    expect(broken?.querySelectorAll('[data-figure-group]')).toHaveLength(2);
    expect(panel()?.querySelector('[data-verbatim]')).toBeNull();
  });

  it('reads one italic unknown line with weights absent: the checks did not run', () => {
    mountStrip({ weights: undefined }, ['weights']);
    click(strip());
    const broken = panel()?.querySelectorAll('[data-panel-column]')[1];
    const groups = broken?.querySelectorAll<HTMLElement>('[data-figure-group]') ?? [];
    expect(groups).toHaveLength(3);
    const unknown = groups[2]?.querySelectorAll<HTMLElement>('[data-missing]') ?? [];
    expect(Array.from(unknown, (node) => node.textContent)).toEqual(['unknown']);
    expect(unknown[0]?.style.fontStyle).toBe('italic');
    expect(groups[2]?.textContent).toBe('unknown');
  });
});
