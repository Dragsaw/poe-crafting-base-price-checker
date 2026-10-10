import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DIV_UNIT } from '../shared/product';
import { mount, mountedContainer, rgb, unmount } from '../test-support/dom';
import { blur, pastDebounce, typeInto } from '../test-support/threshold-input';
import { PageProvider } from '../theme/PageProvider';
import { colors, headerControls, px, rounded } from '../theme/tokens';
import { PayoutThreshold, THRESHOLD_UNIT, THRESHOLD_WORD } from './PayoutThreshold';
import { THRESHOLD_STEP } from './threshold-storage';

afterEach(unmount);

function mountControl(value: number, onChange: (value: number) => void = () => {}): HTMLDivElement {
  return mount(
    <PageProvider>
      <PayoutThreshold value={value} onChange={onChange} />
    </PageProvider>,
  );
}

function part<T extends HTMLElement = HTMLElement>(selector: string): T {
  const found = mountedContainer()?.querySelector<T>(selector);
  if (found === null || found === undefined) {
    throw new Error(`no ${selector}`);
  }
  return found;
}

const input = (): HTMLInputElement => part<HTMLInputElement>('[data-threshold-figure] input');
const thumb = (): HTMLElement => part('[role="slider"]');

function press(key: string): void {
  act(() => {
    thumb().dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  });
}

/** A mouse press on the 100px track at `x`, as the slider's own measuring reads it. */
async function pressTrackAt(x: number): Promise<void> {
  const track = part('.mantine-Slider-trackContainer');
  vi.spyOn(track, 'getBoundingClientRect').mockReturnValue(DOMRect.fromRect({ x: 0, y: 0, width: 100, height: 8 }));
  await act(async () => {
    track.dispatchEvent(new MouseEvent('mousedown', { clientX: x, clientY: 4, bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 40));
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
}

describe('the threshold control at rest', () => {
  it('prints the figure at 2dp, and 3.00 rather than 3', () => {
    mountControl(0.25);
    expect(input().value).toBe('0.25');
    unmount();
    mountControl(3);
    expect(input().value).toBe('3.00');
  });

  it('labels the figure with the word and a drawn ≥, and keeps the unit outside the input', () => {
    mountControl(0.25);
    const label = part('[data-threshold-label]');
    expect(label.textContent).toBe(THRESHOLD_WORD);
    expect(label.querySelector('svg[data-mark="greater-equal"]')).not.toBeNull();
    expect(label.getAttribute('for')).toBe(input().id);
    expect(label.style.color).toBe(rgb(colors['text-secondary']));
    const unit = part('[data-threshold-unit]');
    expect(unit.textContent).toBe(THRESHOLD_UNIT);
    expect(THRESHOLD_UNIT).toBe(`\u{A0}${DIV_UNIT}`);
    expect(input().getAttribute('aria-describedby')).toBe(unit.id);
    expect(unit.contains(input())).toBe(false);
    expect(input().value).not.toContain(DIV_UNIT);
    expect(unit.closest('[data-threshold-figure]')).not.toBeNull();
  });

  it('sets the figure in its box: surface, control radius, the DESIGN.md padding and min-width', () => {
    mountControl(0.25);
    const box = part('[data-threshold-figure]');
    expect(box.className).toBe('fg-threshold-figure');
    expect(box.style.background).toBe(rgb(colors.surface));
    expect(box.style.borderRadius).toBe(rounded.control);
    expect(box.style.padding).toBe(`${px(headerControls.figurePadY)} ${px(headerControls.figurePadX)}`);
    expect(box.style.minWidth).toBe(px(headerControls.figureMinWidth));
    expect(box.style.justifyContent).toBe('flex-end');
  });

  it('lays label, figure and slider in one row, 10px apart, with a 100px slider and no floating label', () => {
    mountControl(0.25);
    const control = part('[data-payout-threshold]');
    expect(control.style.gap).toBe(px(headerControls.labelGap));
    expect([...control.children].map((child) => (child as HTMLElement).dataset)).toMatchObject([
      { thresholdLabel: '' },
      { thresholdFigure: '' },
      { thresholdSlider: '' },
    ]);
    expect(part('[data-threshold-slider]').style.width).toBe(px(headerControls.sliderWidth));
    expect(thumb().getAttribute('aria-valuenow')).toBe('0.25');
    expect(thumb().className).toContain('fg-threshold-thumb');
    expect(thumb().style.boxShadow).toBe(`0 0 0 ${px(headerControls.thumbRing)} ${colors.ground}`);
    expect(mountedContainer()?.querySelector('.mantine-Slider-label')).toBeNull();
  });
});

describe('typing the threshold', () => {
  it('commits a valid parse once, after about 150ms, not on each keystroke, and moves the thumb', async () => {
    const onChange = vi.fn();
    mountControl(0.25, onChange);
    typeInto(input(), '0.6');
    expect(onChange).not.toHaveBeenCalled();
    await pastDebounce();
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(0.6);
    expect(thumb().getAttribute('aria-valuenow')).toBe('0.6');
  });

  it('commits to 0.01 and leaves the thumb between steps', async () => {
    const onChange = vi.fn();
    mountControl(0.25, onChange);
    typeInto(input(), '1.234');
    blur(input());
    expect(onChange).toHaveBeenLastCalledWith(1.23);
    expect(input().value).toBe('1.23');
    await pastDebounce();
    expect(thumb().getAttribute('aria-valuenow')).toBe('1.23');
  });

  it('commits a figure with trailing zeros', async () => {
    const onChange = vi.fn();
    mountControl(0.25, onChange);
    typeInto(input(), '0.10');
    await pastDebounce();
    expect(onChange).toHaveBeenLastCalledWith(0.1);
  });

  it('ranks a value above 3 at 3, and blur shows 3.00', async () => {
    const onChange = vi.fn();
    mountControl(0.25, onChange);
    typeInto(input(), '9');
    await pastDebounce();
    expect(onChange).toHaveBeenLastCalledWith(3);
    blur(input());
    expect(input().value).toBe('3.00');
  });

  it.each(['', '.', 'abc'])('does not re-rank on %j, and blur restores the last valid value', async (text) => {
    const onChange = vi.fn();
    mountControl(0.25, onChange);
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

  it('does not enter a minus sign', async () => {
    const onChange = vi.fn();
    mountControl(0.25, onChange);
    typeInto(input(), '-1');
    expect(input().value).not.toContain('-');
    await pastDebounce();
    for (const [value] of onChange.mock.calls as [number][]) {
      expect(value).toBeGreaterThanOrEqual(0);
    }
  });

  it('flushes a pending commit on blur, so the ranking never lags the printed figure', () => {
    const onChange = vi.fn();
    mountControl(0.25, onChange);
    typeInto(input(), '1.2');
    blur(input());
    expect(onChange).toHaveBeenCalledWith(1.2);
    expect(input().value).toBe('1.20');
  });
});

describe('dragging the slider', () => {
  it('commits each step it crosses at once, with no debounce, and the figure follows', () => {
    const onChange = vi.fn();
    mountControl(0.25, onChange);
    press('ArrowRight');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith(0.25 + THRESHOLD_STEP);
    expect(input().value).toBe('0.30');
    press('ArrowRight');
    press('ArrowLeft');
    press('ArrowLeft');
    expect(onChange.mock.calls.map(([value]) => value as number)).toEqual([0.3, 0.35, 0.3, 0.25]);
    expect(input().value).toBe('0.25');
  });

  it('jumps to the nearest step under a track click and commits once', async () => {
    const onChange = vi.fn();
    mountControl(0.25, onChange);
    await pressTrackAt(41);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith(1.25);
    expect(input().value).toBe('1.25');
  });

  it('settles a typed figure still waiting on its debounce before the slider moves on from it', async () => {
    const onChange = vi.fn();
    mountControl(0.25, onChange);
    typeInto(input(), '2');
    press('ArrowRight');
    await pastDebounce();
    expect(onChange.mock.calls).toEqual([[2], [2 + THRESHOLD_STEP]]);
  });

  it('never goes below 0 or above 3', () => {
    mountControl(0);
    press('ArrowLeft');
    expect(thumb().getAttribute('aria-valuenow')).toBe('0');
    expect(input().value).toBe('0.00');
    unmount();
    mountControl(3);
    press('ArrowRight');
    expect(thumb().getAttribute('aria-valuenow')).toBe('3');
    expect(input().value).toBe('3.00');
  });
});
