import '../frame/frame.css';

import { useCallback, useState, type JSX } from 'react';

import { colors, glyphs, px, spacing, typeStyle } from '../theme/tokens';
import { ColumnHeader } from './ColumnHeader';
import type { DisplayRow } from './display-rows';
import { TOP_ROWS } from './format';
import { RankedRow } from './RankedRow';

export function expandCopy(remaining: number): string {
  return `${glyphs.open} Read the remaining ${String(remaining)} rows`;
}

export const COLLAPSE_COPY = `${glyphs.close} Show only the top ${String(TOP_ROWS)}`;

/**
 * The column header and the list. `core` ordered the rows; the top-20 bound is
 * a view slice (FR-5). `+ Read the remaining N rows` grows the list in place and
 * names no unit; ranks 21 and beyond already carry tier 3. The grown flag and
 * the open-row set are the list's own state and reset on reload. The expansion
 * panel under an open row is Story 2.5's.
 */
export function RankedList({ rows }: { readonly rows: readonly DisplayRow[] }): JSX.Element {
  const [grown, setGrown] = useState(false);
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set());

  const toggle = useCallback((key: string) => {
    setOpen((current) => {
      const next = new Set(current);
      if (!next.delete(key)) {
        next.add(key);
      }
      return next;
    });
  }, []);

  const remaining = rows.length - TOP_ROWS;
  const visible = grown ? rows : rows.slice(0, TOP_ROWS);

  return (
    <div data-ranked-list="">
      <ColumnHeader />
      {visible.map((row) => (
        <RankedRow key={row.key} row={row} open={open.has(row.key)} onToggle={toggle} />
      ))}
      {remaining > 0 ? (
        <div style={{ paddingTop: px(spacing.expandPadTop) }}>
          <button
            type="button"
            data-expand-affordance=""
            className="fg-affordance"
            aria-expanded={grown}
            onClick={() => {
              setGrown((current) => !current);
            }}
            style={{ ...typeStyle('expand-affordance'), color: colors.sepia }}
          >
            {grown ? COLLAPSE_COPY : expandCopy(remaining)}
          </button>
        </div>
      ) : null}
    </div>
  );
}
