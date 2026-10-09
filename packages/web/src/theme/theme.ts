import { colorsTuple, createTheme, type CSSVariablesResolver, type MantineColorsTuple } from '@mantine/core';

import { colors, stacks, typeRoles, type TypeRoleName } from './tokens';

/** The Mantine override layer: it inherits component behaviour, layout and CSS variables only. */

const NONE = 'none';

/** Each `lineHeights` key takes a DESIGN.md role's value, so no `Text` resolves Mantine's 1.55. */
const lineHeights = {
  xs: typeRoles.mark.lineHeight,
  sm: typeRoles['line-text'].lineHeight,
  md: typeRoles['row-name'].lineHeight,
  lg: typeRoles.note.lineHeight,
  xl: typeRoles.tooltip.lineHeight,
};

function heading(name: Exclude<TypeRoleName, 'tier'>) {
  const role = typeRoles[name];
  return { fontSize: role.fontSize, fontWeight: role.fontWeight, lineHeight: role.lineHeight };
}

/** Every heading level takes a DESIGN.md role, so no `Title` keeps Mantine's ramp. */
const headings = {
  fontFamily: stacks.sans,
  fontWeight: typeRoles.title.fontWeight,
  textWrap: 'wrap' as const,
  sizes: {
    h1: heading('title'),
    h2: heading('row-name'),
    h3: heading('row-name'),
    h4: heading('control'),
    h5: heading('row-name'),
    h6: heading('line-text'),
  },
};

/**
 * Mantine's dark scheme reads `dark[0..9]` for text, borders, input fills and the body.
 * Built from the neutrals so no Mantine default grey reaches the page.
 */
const dark: MantineColorsTuple = [
  colors.text,
  colors['text-secondary'],
  colors['text-tertiary'],
  colors['text-tertiary'],
  colors['line-strong'],
  colors['surface-raised'],
  colors.surface,
  colors.ground,
  colors.ground,
  colors.ground,
];

const zeroRadius = { xs: '0px', sm: '0px', md: '0px', lg: '0px', xl: '0px' };
const noShadows = { xs: NONE, sm: NONE, md: NONE, lg: NONE, xl: NONE };

/** Every component that ships a `shadow` prop takes `shadow="none"` by default. */
export const SHADOWED_COMPONENTS = [
  'ActionBar',
  'Card',
  'Paper',
  'Popover',
  'Menu',
  'HoverCard',
  'Combobox',
  'Modal',
  'Drawer',
  'Dialog',
] as const;

const shadowless = Object.fromEntries(
  SHADOWED_COMPONENTS.map((name) => [name, { defaultProps: { shadow: NONE } }]),
);

export const theme = createTheme({
  // Blue would read as `{colors.rarity-magic}`; carets, focus and selection take the accent.
  colors: { accent: colorsTuple(colors.accent), dark },
  primaryColor: 'accent',
  black: colors.ground,
  white: colors.text,
  fontFamily: stacks.sans,
  fontFamilyMonospace: stacks.mono,
  lineHeights,
  headings,
  radius: zeroRadius,
  defaultRadius: 0,
  shadows: noShadows,
  components: {
    ...shadowless,
    Accordion: {
      defaultProps: {
        // eslint-disable-next-line unicorn/no-null -- boundary: Mantine Accordion drops the chevron only on an explicit `null`; `undefined` and `false` fall back to the default (Accordion.mjs `chevron === null`).
        chevron: null,
        disableChevronRotation: true,
        transitionDuration: 0,
      },
      styles: {
        chevron: { display: NONE },
        control: { padding: 0, background: 'transparent' },
        label: { padding: 0 },
        content: { padding: 0 },
        item: { border: 0, background: 'transparent' },
      },
    },
    Collapse: {
      defaultProps: {
        transitionDuration: 0,
        animateOpacity: false,
      },
    },
  },
});

/** Colour tokens as `--fg-color-<name>` properties, plus body ground and text. Dark only. */
export const cssVariablesResolver: CSSVariablesResolver = () => {
  const tokens = Object.fromEntries(
    Object.entries(colors).map(([name, value]) => [`--fg-color-${name}`, value]),
  );
  const ground = {
    '--mantine-color-body': colors.ground,
    '--mantine-color-text': colors.text,
  };
  return { variables: tokens, light: ground, dark: ground };
};
