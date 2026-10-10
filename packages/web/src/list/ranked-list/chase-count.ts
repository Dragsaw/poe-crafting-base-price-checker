import { useCallback, useState, type RefCallback } from 'react';

import { JOINER } from '../../shared/text';
import { spacing } from '../../theme/tokens';
import { CHASE_CELLS } from '../display-rows';

/** The widest chase text of at most 27 characters that the short-form table builds (spec Q1). */
export const CHASE_BUDGET_TEXT = `T1 % Armour${JOINER}T1 Mana Regen`;

/**
 * The chase-cell budget *B* in px: {@link CHASE_BUDGET_TEXT} at `typography.chase` in bundled Inter, its tiers at
 * `typography.tier`, 176.09px in Chromium, rounded up (DESIGN.md *Measure at build*). `chase-count.test.ts` fails when
 * the table outgrows it.
 */
export const CHASE_CELL_BUDGET = 177;

const pixels = (value: string): number => Number(value.replace(/px$/u, ''));

/** Rank, name and EV columns and their three gaps: what the chase column leaves of the list's width. */
const FIXED_COLUMNS = pixels(spacing['col-rank']) + pixels(spacing['col-name']) + pixels(spacing['col-ev']) + 3 * pixels(spacing['col-gap']);

export type ChaseCellCount = 2 | typeof CHASE_CELLS;

/** DESIGN.md *The chase column*: three cells while each is at least *B* wide, otherwise two. */
export function chaseCellCount(listWidth: number): ChaseCellCount {
  const threeCells = (listWidth - FIXED_COLUMNS - 2 * pixels(spacing['chase-gap'])) / CHASE_CELLS;
  return threeCells >= CHASE_CELL_BUDGET ? CHASE_CELLS : 2;
}

/** One cell count for the whole list, from the width of the element `measured` lands on; three until it is measured. */
export function useChaseCellCount(): { readonly measured: RefCallback<HTMLElement>; readonly count: ChaseCellCount } {
  const [count, setCount] = useState<ChaseCellCount>(CHASE_CELLS);
  const measured = useCallback<RefCallback<HTMLElement>>((element) => {
    if (!element) {
      return;
    }
    // Seeded before paint, so a narrow list never shows three cells for a frame; an unrendered element has no box.
    if (element.getClientRects().length > 0) {
      const style = getComputedStyle(element);
      setCount(chaseCellCount(element.clientWidth - pixels(style.paddingLeft) - pixels(style.paddingRight)));
    }
    const observer = new ResizeObserver((entries) => {
      const last = entries.at(-1);
      if (last !== undefined) {
        setCount(chaseCellCount(last.contentRect.width));
      }
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, []);
  return { measured, count };
}
