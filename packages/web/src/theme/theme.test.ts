import { DEFAULT_THEME, mergeMantineTheme } from '@mantine/core';
import { describe, expect, it } from 'vitest';

import { cssVariablesResolver, SHADOWED_COMPONENTS, theme } from './theme';
import { colors, stacks, typeRoles } from './tokens';

const merged = mergeMantineTheme(DEFAULT_THEME, theme);

describe('the Mantine override layer', () => {
  it('replaces lineHeights: no key keeps Mantine’s 1.55', () => {
    for (const [key, value] of Object.entries(merged.lineHeights)) {
      expect(value, key).not.toBe(DEFAULT_THEME.lineHeights[key as keyof typeof DEFAULT_THEME.lineHeights]);
    }
  });

  it('replaces the headings ramp: h1 is the masthead title, in the serif, at a literal px size', () => {
    expect(merged.headings.fontFamily).toBe(stacks.serif);
    expect(merged.headings.fontWeight).toBe('400');
    expect(merged.headings.sizes.h1).toEqual({
      fontSize: typeRoles['masthead-title'].fontSize,
      fontWeight: '400',
      lineHeight: typeRoles['masthead-title'].lineHeight,
    });
    for (const [level, style] of Object.entries(merged.headings.sizes)) {
      expect(style.fontSize, level).toMatch(/px$/);
      expect(style.lineHeight, level).not.toBe(
        DEFAULT_THEME.headings.sizes[level as keyof typeof DEFAULT_THEME.headings.sizes].lineHeight,
      );
    }
  });

  it('points primaryColor at a sepia palette, not blue', () => {
    expect(merged.primaryColor).toBe('sepia');
    expect(merged.colors.sepia).toHaveLength(10);
    expect(new Set(merged.colors.sepia)).toEqual(new Set([colors.sepia]));
  });

  it('zeroes every radius and every shadow', () => {
    expect(merged.defaultRadius).toBe(0);
    expect(Object.values(merged.radius)).toEqual(['0px', '0px', '0px', '0px', '0px']);
    expect(Object.values(merged.shadows)).toEqual(['none', 'none', 'none', 'none', 'none']);
  });

  it('defaults shadow="none" on every shadowed component', () => {
    for (const name of SHADOWED_COMPONENTS) {
      expect(merged.components[name]?.defaultProps, name).toEqual({ shadow: 'none' });
    }
  });

  it('strips Accordion of its chevron, padding and height animation', () => {
    const accordion = merged.components['Accordion'];
    expect(accordion?.defaultProps).toMatchObject({ chevron: null, transitionDuration: 0 });
    expect(accordion?.styles).toMatchObject({
      chevron: { display: 'none' },
      control: { padding: 0, background: 'transparent' },
      content: { padding: 0 },
    });
  });

  it('gives Collapse a zero transition', () => {
    expect(merged.components['Collapse']?.defaultProps).toEqual({
      transitionDuration: 0,
      animateOpacity: false,
    });
  });

  it('uses the sans stack by default and the mono stack for monospace', () => {
    expect(merged.fontFamily).toBe(stacks.sans);
    expect(merged.fontFamilyMonospace).toBe(stacks.mono);
  });
});

describe('the css variables', () => {
  it('exposes every colour token and sets the ground to the surround in both schemes', () => {
    const resolved = cssVariablesResolver(merged);
    expect(resolved.variables['--fg-color-sepia']).toBe(colors.sepia);
    expect(Object.keys(resolved.variables)).toHaveLength(Object.keys(colors).length);
    expect(resolved.light['--mantine-color-body']).toBe(colors.surround);
    expect(resolved.dark).toEqual(resolved.light);
  });
});
