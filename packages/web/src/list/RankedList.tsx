import '../shared/affordance.css';

import { Fragment, useCallback, useState, type JSX } from 'react';

import { TOP_ROWS } from '../shared/product';
import { plural } from '../shared/text';
import { colors, glyphs, px, layout, typeStyle } from '../theme/tokens';
import { useChaseCellCount, type ChaseCellCount } from './ranked-list/chase-count';
import { ColumnHeader, type ExpectedValueNote } from './ColumnHeader';
import type { ListBranches, ListRow } from './display-rows';
import { ClassExpansionPanel, RawExpansionPanel } from './ExpansionPanel';
import { RankedRow } from './RankedRow';

export function expandCopy(remaining: number): string {
  return `${glyphs.open} Read the remaining ${String(remaining)} ${plural(remaining, 'row', 'rows')}`;
}

export const COLLAPSE_COPY = `${glyphs.close} Show only the top ${String(TOP_ROWS)}`;

// The top-20 bound is a view slice after the recipe filter (FR-5), per branch in state 35.
// Grown flags and the open set reset on reload but survive a threshold change or recipe switch,
// so a hidden open row reappears open.
export function RankedList({
  rows,
  branches,
  activeLeague,
  note,
}: {
  /** One branch: the list as `toDisplayRows` printed it. Ignored when `branches` is given. */
  readonly rows?: readonly ListRow[];
  /** The list's branches (`toListBranches`). */
  readonly branches?: ListBranches;
  /** The active league, for the trade-link test. */
  readonly activeLeague: string;
  /** The live threshold and Craft Cost the EV tooltip states. */
  readonly note?: ExpectedValueNote;
}): JSX.Element {
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

  const shown = branches ?? [rows ?? []];
  const { measured, count } = useChaseCellCount();

  return (
    <div data-ranked-list="" ref={measured}>
      <ColumnHeader note={note} />
      {shown.map((branch, index) => (
        <Branch
          chaseCells={count}
          // Positional keys: branches are never reordered, and the first keeps its grown flag when state 35 adds the second.
          key={index}
          rows={branch}
          open={open}
          onToggle={toggle}
          activeLeague={activeLeague}
          kind={branchKind(shown.length, index)}
        />
      ))}
    </div>
  );
}

/** Set only in state 35, where the list holds two branches: the first is raw, the second crafted. */
function branchKind(count: number, index: number): 'raw' | 'crafted' | undefined {
  if (count <= 1) {
    return undefined;
  }
  return index === 0 ? 'raw' : 'crafted';
}

/** One branch of the list: its rows, bounded at the top 20, and its own grow affordance. */
function Branch({
  rows,
  open,
  onToggle,
  activeLeague,
  kind,
  chaseCells,
}: {
  readonly rows: readonly ListRow[];
  readonly open: ReadonlySet<string>;
  readonly onToggle: (key: string) => void;
  readonly activeLeague: string;
  readonly chaseCells: ChaseCellCount;
  /** Set only in state 35, where the list holds two branches. */
  readonly kind: 'raw' | 'crafted' | undefined;
}): JSX.Element {
  const [grown, setGrown] = useState(false);
  const remaining = rows.length - TOP_ROWS;
  // A drop to TOP_ROWS or fewer clears the grown state, so a later rise opens
  // collapsed (React adjust-state-during-render pattern).
  if (grown && remaining <= 0) {
    setGrown(false);
  }
  const visible = grown ? rows : rows.slice(0, TOP_ROWS);
  // A closed row unmounts its panel, so the panel's own toggles start closed when it reopens (Interactions 3, 7).
  const expansionPanel = (row: ListRow, isLast: boolean): JSX.Element => {
    return row.unit === 'raw' ? (
      <RawExpansionPanel key={row.key} row={row} activeLeague={activeLeague} last={isLast} />
    ) : (
      <ClassExpansionPanel key={row.key} row={row} activeLeague={activeLeague} last={isLast} />
    );
  };

  return (
    <div data-list-branch={kind}>
      {visible.map((row, index) => {
        const isOpen = open.has(row.key);
        // Show-more is not a row, so the last visible row draws no rule above it (DESIGN.md *Density*).
        const isLast = index === visible.length - 1;
        return (
          <Fragment key={row.key}>
            <RankedRow row={row} open={isOpen} onToggle={onToggle} chaseCells={chaseCells} last={isLast} />
            {isOpen ? expansionPanel(row, isLast) : undefined}
          </Fragment>
        );
      })}
      {remaining > 0 ? (
        <div style={{ paddingTop: px(layout.expandPadTop) }}>
          <button
            type="button"
            data-expand-affordance=""
            className="fg-affordance"
            aria-expanded={grown}
            onClick={() => {
              setGrown((current) => !current);
            }}
            style={{ ...typeStyle('trust'), color: colors.accent }}
          >
            {grown ? COLLAPSE_COPY : expandCopy(remaining)}
          </button>
        </div>
      ) : undefined}
    </div>
  );
}
