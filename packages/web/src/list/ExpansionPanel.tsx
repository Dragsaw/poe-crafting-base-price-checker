import type { JSX } from 'react';

import { colors, px, spacing, typeStyle } from '../theme/tokens';
import { CombinationRow, type Combination } from './CombinationRow';
import type { DisplayRow } from './display-rows';
import { NO_AFFIXES, rawCombinationNote, rawPanelSubLine } from './format';
import { tradeSearchHref } from './trade-link';
import { UnitGlyph, type Unit } from './UnitGlyph';

/**
 * A Raw Base's one combination row, for the degenerate Combination of no
 * affixes (FR-8, FR-3). A priced entry takes the raw note; an unpriced one
 * takes its state's note in its place (decision 2026-09-26).
 */
export function rawCombination(row: DisplayRow, activeLeague: string): Combination {
  return {
    key: row.key,
    text: NO_AFFIXES,
    pinned: row.status === 'pinned',
    state: row.state,
    note: rawCombinationNote(row.state, row.itemLevel),
    ages: row.ages,
    tradeHref: tradeSearchHref({ ...row.entry, status: row.status }, activeLeague),
    tradeLabel: `Open the trade search for ${row.label}`,
  };
}

/**
 * `{components.expansion-panel}`: a bordered paper card at the full content
 * width, flush under its row — the row's `rule-strong` bottom is the panel's
 * top edge, so the panel draws no top border. No animation, not a modal.
 * Inside: the unit glyph and name, the context sub-line, then one
 * `{components.combination-row}` per Tracked Entry.
 */
export function ExpansionPanel({
  unit,
  label,
  subLine,
  combinations,
}: {
  readonly unit: Unit;
  readonly label: string;
  readonly subLine: string;
  readonly combinations: readonly Combination[];
}): JSX.Element {
  return (
    <div
      data-expansion-panel=""
      style={{
        width: px(spacing.contentWidth),
        boxSizing: 'border-box',
        margin: `0 0 ${px(spacing.s4)}`,
        padding: `${px(spacing.panelPadTop)} ${px(spacing.panelPadX)} ${px(spacing.panelPadBottom)}`,
        background: colors.paper,
        border: `${px(spacing.hairline)} solid ${colors.edge}`,
        borderTop: 'none',
        whiteSpace: 'normal',
        cursor: 'default',
      }}
    >
      <h4
        data-panel-title=""
        style={{ ...typeStyle('panel-title'), display: 'flex', alignItems: 'baseline', margin: 0, color: colors.ink }}
      >
        <UnitGlyph unit={unit} />
        <span data-panel-name="" style={{ fontStyle: unit === 'raw' ? 'italic' : 'normal' }}>
          {label}
        </span>
      </h4>
      <div
        data-panel-sub=""
        style={{
          ...typeStyle('panel-sub'),
          margin: `${px(spacing.panelSubMarginTop)} 0 ${px(spacing.panelSubMarginBottom)}`,
          color: colors['ink-secondary'],
        }}
      >
        {subLine}
      </div>
      {combinations.map((combination, index) => (
        <CombinationRow key={combination.key} combination={combination} last={index === combinations.length - 1} />
      ))}
    </div>
  );
}

/** The panel under an open Raw Base row: its sub-line and its single combination. */
export function RawExpansionPanel({
  row,
  threshold,
  activeLeague,
}: {
  readonly row: DisplayRow;
  readonly threshold: number;
  readonly activeLeague: string;
}): JSX.Element {
  return (
    <ExpansionPanel
      unit={row.unit}
      label={row.label}
      subLine={rawPanelSubLine(row.itemLevel, threshold)}
      combinations={[rawCombination(row, activeLeague)]}
    />
  );
}
