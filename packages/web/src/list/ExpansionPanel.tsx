import type { JSX } from 'react';

import { colors, px, layout, typeStyle } from '../theme/tokens';
import { CombinationRow, type Combination } from './CombinationRow';
import { combinationString } from './combination-text';
import type { ClassDisplayRow, CraftedCombination, DisplayRow } from './display-rows';
import { classPanelSubLine, NO_AFFIXES, rawCombinationNote, rawPanelSubLine } from './format';
import { tradeSearchHref } from './trade-link';
import { UnitGlyph, type Unit } from './UnitGlyph';

// A Raw Base is the degenerate Combination of no affixes (FR-8, FR-3). An unpriced one takes its
// state's note in place of the raw note (decision 2026-09-26).
function rawCombination(row: DisplayRow, activeLeague: string): Combination {
  return {
    key: row.key,
    text: [{ text: NO_AFFIXES, verbatim: false }],
    pinned: row.status === 'pinned',
    state: row.state,
    note: rawCombinationNote(row.state, row.itemLevel),
    ages: row.ages,
    tradeHref: tradeSearchHref({ ...row.entry, status: row.status }, activeLeague),
    tradeLabel: `Open the trade search for ${row.label}`,
  };
}

// Follows the raw path; the text is its tier + short form, or the verbatim fallback.
function craftedCombination(combination: CraftedCombination, className: string, activeLeague: string): Combination {
  return {
    key: combination.key,
    text: combination.text,
    pinned: combination.status === 'pinned',
    state: combination.state,
    note: combination.note,
    ages: combination.ages,
    tradeHref: tradeSearchHref({ ...combination.entry, status: combination.status }, activeLeague),
    tradeLabel: `Open the trade search for ${combinationString(combination.text)} on ${className}`,
  };
}

// `{components.expansion-panel}`: the row's bottom rule is the panel's top edge, so no top border.
function ExpansionPanel({
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
        width: px(layout.contentWidth),
        boxSizing: 'border-box',
        margin: `0 0 ${px(layout.s4)}`,
        padding: `${px(layout.panelPadTop)} ${px(layout.panelPadX)} ${px(layout.panelPadBottom)}`,
        background: colors.ground,
        border: `${px(layout.hairline)} solid ${colors['line-strong']}`,
        borderTop: 'none',
        whiteSpace: 'normal',
        cursor: 'default',
      }}
    >
      <h4
        data-panel-title=""
        style={{ ...typeStyle('row-name'), display: 'flex', alignItems: 'baseline', margin: 0, color: colors.text }}
      >
        <UnitGlyph unit={unit} />
        <span data-panel-name="" style={{ fontStyle: unit === 'raw' ? 'italic' : 'normal' }}>
          {label}
        </span>
      </h4>
      <div
        data-panel-sub=""
        style={{
          ...typeStyle('note'),
          margin: `${px(layout.panelSubMarginTop)} 0 ${px(layout.panelSubMarginBottom)}`,
          color: colors['text-secondary'],
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

// Non-pruned entries only: the summands in `core`'s order, then the rest by canonical key.
export function ClassExpansionPanel({
  row,
  threshold,
  recipeWord,
  activeLeague,
}: {
  readonly row: ClassDisplayRow;
  readonly threshold: number;
  readonly recipeWord: string;
  readonly activeLeague: string;
}): JSX.Element {
  return (
    <ExpansionPanel
      unit={row.unit}
      label={row.label}
      subLine={classPanelSubLine(threshold, recipeWord)}
      combinations={row.combinations.map((combination) => craftedCombination(combination, row.label, activeLeague))}
    />
  );
}
