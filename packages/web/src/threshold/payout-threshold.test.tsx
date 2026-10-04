import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { rgb } from '../test-support/dom';
import { blur, pastDebounce, typeInto } from '../test-support/threshold-input';
import { PageProvider } from '../theme/PageProvider';
import { colors, spacing } from '../theme/tokens';
import {
  PayoutThreshold,
  RANGE_HIGH,
  RANGE_LOW,
  THRESHOLD_LABEL,
  THRESHOLD_UNIT,
} from './PayoutThreshold';

let container: HTMLDivElement | undefined;
let root: Root | undefined;

afterEach(() => {
  const mounted = root;
  if (mounted !== undefined) {
    act(() => {
      mounted.unmount();
    });
  }
  root = undefined;
  container?.remove();
  container = undefined;
});

function mountPanel(value: number, onChange: (value: number) => void = () => {}): HTMLDivElement {
  container = document.createElement('div');
  document.body.append(container);
  const mounted = createRoot(container);
  root = mounted;
  act(() => {
    mounted.render(
      <PageProvider>
        <PayoutThreshold value={value} onChange={onChange} />
      </PageProvider>,
    );
  });
  return container;
}

function input(): HTMLInputElement {
  const found = container?.querySelector('input');
  if (found === null || found === undefined) {
    throw new Error('no input rendered');
  }
  return found;
}

function part(attribute: string): HTMLElement {
  const found = container?.querySelector<HTMLElement>(`[${attribute}]`);
  if (found === null || found === undefined) {
    throw new Error(`no ${attribute}`);
  }
  return found;
}

describe('the panel at rest', () => {
  // Matrix: first visit.
  it('prints the figure at 2dp with the marker and the fill at value / 3', () => {
    mountPanel(0.25);
    expect(input().value).toBe('0.25');
    expect(part('data-threshold-marker').style.left).toBe(`${String((0.25 / 3) * 100)}%`);
    expect(part('data-threshold-fill').style.width).toBe(`${String((0.25 / 3) * 100)}%`);
    expect(Number.parseFloat(part('data-threshold-marker').style.left)).toBeCloseTo(8.33, 2);
  });

  it('prints 3.00, not 3', () => {
    mountPanel(3);
    expect(input().value).toBe('3.00');
  });

  it('labels the figure, and keeps the unit outside the input', () => {
    mountPanel(0.25);
    const label = part('data-threshold-label');
    expect(label.textContent).toBe(THRESHOLD_LABEL);
    expect(label.style.textTransform).toBe('uppercase');
    expect(label.getAttribute('for')).toBe(input().id);
    const unit = part('data-threshold-unit');
    expect(unit.textContent).toBe(THRESHOLD_UNIT);
    expect(THRESHOLD_UNIT).toBe('\u{A0}Divine');
    expect(unit.id).not.toBe('');
    expect(input().getAttribute('aria-describedby')).toBe(unit.id);
    expect(unit.contains(input())).toBe(false);
    expect(input().contains(unit)).toBe(false);
    expect(input().value).not.toContain('Divine');
    expect(unit.style.color).toBe(rgb(colors['ink-secondary']));
  });

  it('takes the panel chrome: paper-inset, a hairline border, 13×15 padding, 276 wide', () => {
    mountPanel(0.25);
    const panel = part('data-payout-threshold');
    expect(panel.style.width).toBe(`${String(spacing.thresholdPanelWidth)}px`);
    expect(panel.style.boxSizing).toBe('border-box');
    expect(panel.style.background).toBe(rgb(colors['paper-inset']));
    expect(panel.style.border).toBe(`1px solid ${rgb(colors['rule-hairline'])}`);
    expect(panel.style.padding).toBe('13px 15px');
  });

  it('is a number input with no stepper and no slider', () => {
    mountPanel(0.25);
    expect(container?.querySelectorAll('input')).toHaveLength(1);
    expect(input().type).toBe('text');
    expect(input().inputMode).toBe('decimal');
    expect(input().closest('.fg-threshold')).not.toBeNull();
    expect(container?.querySelector('[role="slider"], input[type="range"], button')).toBeNull();
  });

  it('draws a non-interactive readout: no pointer events, no handlers, and the range endpoints', () => {
    mountPanel(0.25);
    for (const attribute of ['data-threshold-track', 'data-threshold-fill', 'data-threshold-marker']) {
      const node = part(attribute);
      expect(node.style.pointerEvents, attribute).toBe('none');
      const properties = Object.entries(node).find(([key]) => key.startsWith('__reactProps'))?.[1] as Record<string, unknown>;
      expect(Object.keys(properties).filter((key) => key.startsWith('on')), attribute).toEqual([]);
    }
    const marker = part('data-threshold-marker');
    expect([marker.style.width, marker.style.height]).toEqual(['11px', '14px']);
    expect(marker.style.background).toBe(rgb(colors.ink));
    expect(part('data-threshold-fill').style.background).toBe(rgb(colors.sepia));
    expect(part('data-threshold-track').style.height).toBe('4px');
    const range = Array.from(part('data-threshold-range').children, (node) => node.textContent);
    expect(range).toEqual([RANGE_LOW, RANGE_HIGH]);
    expect(range).toEqual(['0 Divine', '3 Divine']);
    expect(RANGE_LOW).toBe('0 Divine');
    expect(RANGE_HIGH).toBe('3 Divine');
  });
});

describe('typing the threshold', () => {
  it('commits a valid parse once, after about 150ms, not on each keystroke', async () => {
    const onChange = vi.fn();
    mountPanel(0.25, onChange);
    typeInto(input(), '0.6');
    expect(onChange).not.toHaveBeenCalled();
    await pastDebounce();
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(0.6);
  });

  it('commits a figure with trailing zeros', async () => {
    const onChange = vi.fn();
    mountPanel(0.25, onChange);
    typeInto(input(), '0.10');
    await pastDebounce();
    expect(onChange).toHaveBeenLastCalledWith(0.1);
  });

  // Matrix: over max.
  it('ranks a value above 3 at 3, and blur shows 3.00', async () => {
    const onChange = vi.fn();
    mountPanel(0.25, onChange);
    typeInto(input(), '5');
    await pastDebounce();
    expect(onChange).toHaveBeenLastCalledWith(3);
    blur(input());
    expect(input().value).toBe('3.00');
  });

  // Matrix: emptied.
  it.each(['', '.'])('does not re-rank on %j, and blur restores the last valid value', async (text) => {
    const onChange = vi.fn();
    mountPanel(0.25, onChange);
    typeInto(input(), '0.6');
    await pastDebounce();
    onChange.mockClear();
    typeInto(input(), text);
    await pastDebounce();
    expect(onChange).not.toHaveBeenCalled();
    blur(input());
    expect(input().value).toBe('0.60');
    await pastDebounce();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('restores a clamped value after a later clear and blur', async () => {
    const onChange = vi.fn();
    mountPanel(0.25, onChange);
    typeInto(input(), '5');
    blur(input());
    expect(input().value).toBe('3.00');
    typeInto(input(), '');
    expect(input().value).toBe('');
    blur(input());
    expect(input().value).toBe('3.00');
    await pastDebounce();
    expect(onChange).toHaveBeenLastCalledWith(3);
  });

  // Matrix: negative.
  it('does not enter a minus sign', async () => {
    const onChange = vi.fn();
    mountPanel(0.25, onChange);
    typeInto(input(), '-');
    expect(input().value).not.toContain('-');
    typeInto(input(), '-1');
    expect(input().value).not.toContain('-');
    await pastDebounce();
    for (const [value] of onChange.mock.calls as [number][]) {
      expect(value).toBeGreaterThanOrEqual(0);
    }
  });

  it('flushes a pending commit on blur, so the ranking never lags the printed figure', () => {
    const onChange = vi.fn();
    mountPanel(0.25, onChange);
    typeInto(input(), '1.2');
    blur(input());
    expect(onChange).toHaveBeenCalledWith(1.2);
    expect(input().value).toBe('1.20');
  });
});
