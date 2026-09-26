import type { JSX } from 'react';

import { colors, glyphs, px, spacing, typeStyle } from '../theme/tokens';

export type Unit = 'class' | 'raw';

/**
 * The unit glyph that opens every ranked row (FR-3): `≡` an Item Class, `▪` a
 * Base Type. Sepia only, never a semantic ink; no word and no key-block entry.
 * Both centre in one fixed 14px box at `flex: 0 0 auto`, so every name starts
 * at the same x and a long name yields first.
 */
export function UnitGlyph({ unit }: { readonly unit: Unit }): JSX.Element {
  return (
    <span
      data-unit-glyph={unit}
      aria-hidden="true"
      style={{
        ...typeStyle('row-unit-glyph'),
        flex: '0 0 auto',
        width: px(spacing.unitGlyphBox),
        marginRight: px(spacing.s1),
        textAlign: 'center',
        fontStyle: 'normal',
        color: colors.sepia,
      }}
    >
      {unit === 'class' ? glyphs.unitClass : glyphs.unitRaw}
    </span>
  );
}
