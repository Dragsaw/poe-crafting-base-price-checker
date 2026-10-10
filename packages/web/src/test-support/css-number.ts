import { expansionLineWidths, spacing } from '../theme/tokens';

/** The leading number of a CSS value such as `448px` or `20%`; NaN when there is none. */
export const cssNumber = (value: string): number => Number(/^[+-]?(?:\d+\.?\d*|\.\d+)/.exec(value)?.[0]);

/** An expansion line's combination cell at `{spacing.content-min}` (DESIGN.md, *Measure at build*). */
export function combinationCellAtContentMin(): number {
  const fixed = [
    spacing['expansion-indent'],
    expansionLineWidths.paddingRight,
    expansionLineWidths.price,
    spacing['expansion-trust-cell'],
    expansionLineWidths.link,
  ].map((width) => cssNumber(width));
  const gaps = 3 * cssNumber(spacing['col-gap']);
  const inner = cssNumber(spacing['content-min']) - 2 * cssNumber(spacing.gutter);
  return inner - fixed.reduce((sum, width) => sum + width, 0) - gaps;
}
