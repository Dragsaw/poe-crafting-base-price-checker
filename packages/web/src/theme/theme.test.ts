import { DEFAULT_THEME, mergeMantineTheme } from '@mantine/core';
import { describe, expect, it } from 'vitest';

import { cssVariablesResolver, MARK_TOOLTIP_SHELL, SHADOWED_COMPONENTS, theme, TOOLTIP_DEFAULT_PROPS } from './theme';
import { colors, floatingShadows, rounded, stacks, typeRoles } from './tokens';

const merged = mergeMantineTheme(DEFAULT_THEME, theme);

describe('the Mantine override layer', () => {
  it('replaces lineHeights: every key takes a DESIGN.md role value, none left at Mantine’s default for that key', () => {
    const roleValues = new Set(Object.values(typeRoles).map((role) => ('lineHeight' in role ? role.lineHeight : '')));
    for (const [key, value] of Object.entries(merged.lineHeights)) {
      expect(roleValues, key).toContain(value);
      expect(value, key).not.toBe(DEFAULT_THEME.lineHeights[key]);
    }
  });

  it('replaces the headings ramp: h1 is the title, in the Inter stack, at a literal px size', () => {
    expect(merged.headings.fontFamily).toBe(stacks.sans);
    expect(merged.headings.sizes.h1).toEqual({
      fontSize: typeRoles.title.fontSize,
      fontWeight: typeRoles.title.fontWeight,
      lineHeight: typeRoles.title.lineHeight,
    });
    for (const [level, style] of Object.entries(merged.headings.sizes)) {
      expect(style.fontSize, level).toMatch(/px$/);
      expect(style.lineHeight, level).not.toBe(
        DEFAULT_THEME.headings.sizes[level as keyof typeof DEFAULT_THEME.headings.sizes].lineHeight,
      );
    }
  });

  it('points primaryColor at a palette built from the accent, never a Mantine blue', () => {
    expect(merged.primaryColor).toBe('accent');
    expect(merged.colors['accent']).toHaveLength(10);
    expect(new Set(merged.colors['accent'])).toEqual(new Set([colors.accent]));
  });

  it('builds the dark palette from the neutral tokens only', () => {
    const neutrals = new Set<string>([
      colors.ground,
      colors.surface,
      colors['surface-raised'],
      colors['line-strong'],
      colors.text,
      colors['text-secondary'],
      colors['text-tertiary'],
    ]);
    expect(merged.colors.dark).toHaveLength(10);
    for (const shade of merged.colors.dark) {
      expect(neutrals).toContain(shade);
    }
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
    expect(accordion?.defaultProps).toMatchObject({ transitionDuration: 0 });
    expect(Reflect.get(new Object(accordion?.defaultProps), 'chevron')).toBeNull();
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

  it('gives every Tooltip the mark-tooltip shell: raised, line-strong, rounded, shadowed, instant, no arrow', () => {
    const tooltip = merged.components['Tooltip'];
    expect(tooltip?.defaultProps).toEqual(TOOLTIP_DEFAULT_PROPS);
    expect(TOOLTIP_DEFAULT_PROPS).toMatchObject({ withArrow: false, radius: rounded.tooltip, transitionProps: { duration: 0 } });
    expect(tooltip?.styles).toEqual({ tooltip: MARK_TOOLTIP_SHELL });
    expect(MARK_TOOLTIP_SHELL).toMatchObject({
      background: colors['surface-raised'],
      border: `1px solid ${colors['line-strong']}`,
      borderRadius: rounded.tooltip,
      boxShadow: floatingShadows['mark-tooltip'],
      color: colors['text-secondary'],
      fontSize: typeRoles.trust.fontSize,
      lineHeight: typeRoles.trust.lineHeight,
    });
  });

  it('uses the Inter stack by default and the mono stack for monospace', () => {
    expect(merged.fontFamily).toBe(stacks.sans);
    expect(merged.fontFamilyMonospace).toBe(stacks.mono);
  });
});

describe('the css variables', () => {
  it('exposes every colour token and sets the dark body ground and text in both schemes', () => {
    const resolved = cssVariablesResolver(merged);
    expect(resolved.variables['--fg-color-accent']).toBe(colors.accent);
    expect(Object.keys(resolved.variables)).toHaveLength(Object.keys(colors).length);
    expect(resolved.dark['--mantine-color-body']).toBe(colors.ground);
    expect(resolved.dark['--mantine-color-text']).toBe(colors.text);
    expect(resolved.light).toEqual(resolved.dark);
  });
});
