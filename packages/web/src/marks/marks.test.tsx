import { afterEach, describe, expect, it } from 'vitest';

import { mount, rgb, unmount } from '../test-support/dom';
import { colors } from '../theme/tokens';
import { EstimateMark, SwatchMark, TradeLinkMark, VerdictMark } from './marks';

afterEach(unmount);

function drawn(node: Parameters<typeof mount>[0]): SVGSVGElement {
  const svg = mount(node).querySelector('svg');
  if (svg === null) {
    throw new Error('no drawing');
  }
  return svg;
}

describe('the drawn marks', () => {
  it.each([
    ['rough', colors['trust-rough']],
    ['pending', colors['trust-pending']],
    ['broken', colors['trust-broken']],
  ] as const)('draws %s as inline SVG in a 1em box painted in currentColor set to its token', (verdict, token) => {
    const svg = drawn(<VerdictMark verdict={verdict} />);
    expect(svg.dataset['mark']).toBe(verdict);
    expect(svg.getAttribute('width')).toBe('1em');
    expect(svg.getAttribute('height')).toBe('1em');
    expect(svg.getAttribute('stroke')).toBe('currentColor');
    expect(svg.style.color).toBe(rgb(token));
    expect(svg.textContent).toBe('');
  });

  it('draws ≈ in the rough token, as the trust marks are drawn', () => {
    const svg = drawn(<EstimateMark />);
    expect(svg.dataset['mark']).toBe('estimate');
    expect(svg.getAttribute('width')).toBe('1em');
    expect(svg.style.color).toBe(rgb(colors['trust-rough']));
  });

  it('draws ↗ as one open-headed shaft in its host colour, with no glyph', () => {
    const svg = drawn(<TradeLinkMark />);
    expect(svg.dataset['mark']).toBe('trade-link');
    expect(svg.getAttribute('width')).toBe('1em');
    expect(svg.getAttribute('fill')).toBe('none');
    expect(svg.style.color).toBe('currentcolor');
    expect(svg.querySelector('path')?.getAttribute('d')?.match(/M/g)).toHaveLength(2);
    expect(svg.textContent).toBe('');
  });

  it('gives ◐ and ○ one ring, ◐ filling its left half, and ✕ two crossing strokes', () => {
    const rough = drawn(<VerdictMark verdict="rough" />);
    const roughRing = rough.querySelector('circle')?.getAttribute('r');
    expect(rough.querySelector('path')?.getAttribute('fill')).toBe('currentColor');
    const pending = drawn(<VerdictMark verdict="pending" />);
    expect(pending.querySelector('circle')?.getAttribute('r')).toBe(roughRing);
    expect(pending.querySelector('path')).toBeNull();
    const broken = drawn(<VerdictMark verdict="broken" />);
    expect(broken.querySelector('circle')).toBeNull();
    expect(broken.querySelector('path')?.getAttribute('d')?.match(/M/g)).toHaveLength(2);
  });

  it.each([
    ['crafted', colors['rarity-magic']],
    ['raw', colors['rarity-normal']],
  ] as const)('draws the %s swatch as one solid square in its rarity colour, with no glyph', (unit, token) => {
    const svg = drawn(<SwatchMark unit={unit} />);
    expect(svg.dataset['mark']).toBe(`swatch-${unit}`);
    expect(svg.getAttribute('width')).toBe('1em');
    expect(svg.style.color).toBe(rgb(token));
    const square = svg.querySelector('rect');
    expect(square?.getAttribute('fill')).toBe('currentColor');
    expect(square?.getAttribute('width')).toBe(square?.getAttribute('height'));
    expect(svg.textContent).toBe('');
  });
});
