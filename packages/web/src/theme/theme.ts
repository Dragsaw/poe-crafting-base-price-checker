import { colorsTuple, createTheme, type CSSVariablesResolver } from '@mantine/core';

import { colors, stacks, typeRoles } from './tokens';

/** The Mantine override layer: it inherits component behaviour, layout and CSS variables only. */

const NONE = 'none';

/** Each `lineHeights` key takes a DESIGN.md role's value; `xl` is `failure-body`'s 1.55. */
const lineHeights = {
  xs: typeRoles['row-mark'].lineHeight,
  sm: typeRoles['detail-row'].lineHeight,
  md: typeRoles['row-unit-name'].lineHeight,
  lg: typeRoles.dek.lineHeight,
  xl: typeRoles['failure-body'].lineHeight,
};

const title = typeRoles['masthead-title'];

/** Every heading level takes a DESIGN.md role, so no `Title` keeps Mantine's ramp. */
const headings = {
  fontFamily: stacks.serif,
  fontWeight: '400',
  textWrap: 'wrap' as const,
  sizes: {
    h1: { fontSize: title.fontSize, fontWeight: title.fontWeight, lineHeight: title.lineHeight },
    h2: {
      fontSize: typeRoles['panel-title'].fontSize,
      fontWeight: '400',
      lineHeight: typeRoles['panel-title'].lineHeight,
    },
    h3: {
      fontSize: typeRoles['appendix-title'].fontSize,
      fontWeight: '400',
      lineHeight: typeRoles['appendix-title'].lineHeight,
    },
    h4: {
      fontSize: typeRoles['recipe-option'].fontSize,
      fontWeight: '400',
      lineHeight: typeRoles['recipe-option'].lineHeight,
    },
    h5: {
      fontSize: typeRoles['row-unit-name'].fontSize,
      fontWeight: '400',
      lineHeight: typeRoles['row-unit-name'].lineHeight,
    },
    h6: {
      fontSize: typeRoles['appendix-row'].fontSize,
      fontWeight: '400',
      lineHeight: typeRoles['appendix-row'].lineHeight,
    },
  },
};

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
  // A palette built from sepia: carets, focus and selection never go blue.
  colors: { sepia: colorsTuple(colors.sepia) },
  primaryColor: 'sepia',
  black: colors.ink,
  white: colors.paper,
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

/** Colour tokens as `--fg-color-<name>` properties, plus body ground and text. Light only. */
export const cssVariablesResolver: CSSVariablesResolver = () => {
  const tokens = Object.fromEntries(
    Object.entries(colors).map(([name, hex]) => [`--fg-color-${name}`, hex]),
  );
  const ground = {
    '--mantine-color-body': colors.surround,
    '--mantine-color-text': colors.ink,
  };
  return { variables: tokens, light: ground, dark: ground };
};
