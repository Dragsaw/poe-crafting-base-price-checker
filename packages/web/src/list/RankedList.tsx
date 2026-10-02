import '../shared/affordance.css';

import { Fragment, useCallback, useState, type JSX } from 'react';

import { TOP_ROWS } from '../shared/product';
import { plural } from '../shared/text';
import { colors, glyphs, px, spacing, typeStyle } from '../theme/tokens';
import { ColumnHeader } from './ColumnHeader';
import type { ListBranches, ListRow } from './display-rows';
import { ClassExpansionPanel, RawExpansionPanel } from './ExpansionPanel';
import { RankedRow } from './RankedRow';

export function expandCopy(remaining: number): string {
  return `${glyphs.open} Read the remaining ${String(remaining)} ${plural(remaining, 'row', 'rows')}`;
}

export const COLLAPSE_COPY = `${glyphs.close} Show only the top ${String(TOP_ROWS)}`;

/**
 * The column header and the list. `core` ordered the rows, and the caller
 * has already narrowed them to the active Craft Recipe; the top-20 bound is a
 * view slice applied after that filter (FR-5). In state 35 the list holds two
 * branches, raw then crafted, and the bound applies to each, with one
 * affordance under each (EXPERIENCE.md state 35). `+ Read the remaining N
 * rows` grows its branch in place and names no unit; ranks 21 and beyond
 * already carry tier 3. The grown flags and the open-row set are the list's
 * own state and reset on reload. Each open row carries its expansion panel in
 * place beneath it; many may be open, and only a second click on its own row
 * closes one. Growing or collapsing, a threshold change or a recipe switch
 * never changes the open set, so a hidden open row reappears open.
 */
export function RankedList({
  rows,
  branches,
  threshold,
  activeLeague,
  recipeWord,
}: {
  /** One branch: the list as `toDisplayRows` printed it. Ignored when `branches` is given. */
  readonly rows?: readonly ListRow[];
  /** The list's branches (`toListBranches`). */
  readonly branches?: ListBranches;
  /** The active Payout Threshold, repeated in each open panel's sub-line. */
  readonly threshold: number;
  /** The active league, for the trade-link test. */
  readonly activeLeague: string;
  /** The active Craft Recipe's word, repeated in an open crafted panel's sub-line. */
  readonly recipeWord?: string;
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

  return (
    <div data-ranked-list="">
      <ColumnHeader />
      {shown.map((branch, index) => (
        <Branch
          // Positional keys: branches are never reordered, and the first keeps its grown flag when state 35 adds the second.
          key={index}
          rows={branch}
          open={open}
          onToggle={toggle}
          threshold={threshold}
          activeLeague={activeLeague}
          recipeWord={recipeWord}
          kind={shown.length > 1 ? (index === 0 ? 'raw' : 'crafted') : undefined}
        />
      ))}
    </div>
  );
}

/** One branch of the list: its rows, bounded at the top 20, and its own grow affordance. */
function Branch({
  rows,
  open,
  onToggle,
  threshold,
  activeLeague,
  recipeWord,
  kind,
}: {
  readonly rows: readonly ListRow[];
  readonly open: ReadonlySet<string>;
  readonly onToggle: (key: string) => void;
  readonly threshold: number;
  readonly activeLeague: string;
  readonly recipeWord: string | undefined;
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

  return (
    <div data-list-branch={kind}>
      {visible.map((row) => {
        const isOpen = open.has(row.key);
        return (
          <Fragment key={row.key}>
            <RankedRow row={row} open={isOpen} onToggle={onToggle} />
            {isOpen ? (
              row.unit === 'raw' ? (
                <RawExpansionPanel row={row} threshold={threshold} activeLeague={activeLeague} />
              ) : (
                <ClassExpansionPanel row={row} threshold={threshold} recipeWord={recipeWord ?? ''} />
              )
            ) : null}
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
