import '../shared/affordance.css';

import { Fragment, useCallback, useState, type JSX } from 'react';

import { TOP_ROWS } from '../shared/product';
import { plural } from '../shared/text';
import { colors, glyphs, px, spacing, typeStyle } from '../theme/tokens';
import { ColumnHeader } from './ColumnHeader';
import type { DisplayRow } from './display-rows';
import { RawExpansionPanel } from './ExpansionPanel';
import { RankedRow } from './RankedRow';

export function expandCopy(remaining: number): string {
  return `${glyphs.open} Read the remaining ${String(remaining)} ${plural(remaining, 'row', 'rows')}`;
}

export const COLLAPSE_COPY = `${glyphs.close} Show only the top ${String(TOP_ROWS)}`;

/**
 * The column header and the list. `core` ordered the rows; the top-20 bound is
 * a view slice (FR-5). `+ Read the remaining N rows` grows the list in place and
 * names no unit; ranks 21 and beyond already carry tier 3. The grown flag and
 * the open-row set are the list's own state and reset on reload. Each open row
 * carries its expansion panel in place beneath it; many may be open, and only
 * a second click on its own row closes one. Growing or collapsing the list
 * never changes the open set, so a hidden open row reappears open.
 */
export function RankedList({
  rows,
  threshold,
  activeLeague,
}: {
  readonly rows: readonly DisplayRow[];
  /** The active Payout Threshold, repeated in each open panel's sub-line. */
  readonly threshold: number;
  /** The active league, for the trade-link test. */
  readonly activeLeague: string;
}): JSX.Element {
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
  // A drop to TOP_ROWS or fewer clears the grown state, so a later rise opens
  // collapsed (React adjust-state-during-render pattern).
  if (grown && remaining <= 0) {
    setGrown(false);
  }
  const visible = grown ? rows : rows.slice(0, TOP_ROWS);

  return (
    <div data-ranked-list="">
      <ColumnHeader />
      {visible.map((row) => {
        const isOpen = open.has(row.key);
        return (
          <Fragment key={row.key}>
            <RankedRow row={row} open={isOpen} onToggle={toggle} />
            {isOpen ? <RawExpansionPanel row={row} threshold={threshold} activeLeague={activeLeague} /> : null}
          </Fragment>
        );
      })}
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
