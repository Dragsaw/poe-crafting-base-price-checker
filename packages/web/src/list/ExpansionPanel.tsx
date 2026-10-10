import { useState, type JSX } from 'react';

import { EstimateMark } from '../marks/marks';
import { TOP_LINES } from '../shared/product';
import { ShowMore } from '../shared/ShowMore';
import { colors, spacing, typeStyle } from '../theme/tokens';
import { combinationString } from './combination-text';
import { hasEstimate, type ClassDisplayRow, type CraftedCombination, type DisplayRow, type PrunedCombination } from './display-rows';
import { ExpansionLine, PrunedLine, type LineView } from './expansion/ExpansionLine';
import { ESTIMATED_ODDS_CONTEXT, FEWER_LINES_COPY, moreLinesCopy, prunedCopy } from './format';
import { NAME_COLORS } from './RankedRow';
import { tradeSearchHref } from './trade-link';
import { JOINER } from '../shared/text';

/** A Raw Base expands to one line with no Combination text: the context line names it. */
function rawLine(row: DisplayRow, activeLeague: string): LineView {
  return {
    key: row.key,
    text: [],
    isPinned: row.status === 'pinned',
    price: row.price,
    trust: row.trust,
    isBelowThreshold: false,
    tradeHref: tradeSearchHref({ ...row.entry, status: row.status }, activeLeague),
    tradeLabel: `Open the trade search for ${row.label}`,
  };
}

function craftedLine(combination: CraftedCombination, className: string, activeLeague: string): LineView {
  return {
    key: combination.key,
    text: combination.text,
    isPinned: combination.status === 'pinned',
    price: combination.price,
    trust: combination.trust,
    isBelowThreshold: combination.isBelowThreshold,
    tradeHref: tradeSearchHref({ ...combination.entry, status: combination.status }, activeLeague),
    tradeLabel: `Open the trade search for ${combinationString(combination.text)} on ${className}`,
  };
}

/** The name in the row's rarity colour, then the ≈ sentence when the row carries ≈ (state 12). */
function ContextLine({ row }: { readonly row: DisplayRow | ClassDisplayRow }): JSX.Element {
  const isEstimated = hasEstimate(row);
  return (
    <div data-context-line="" style={{ ...typeStyle('note'), padding: '4px 0 8px', color: colors['text-tertiary'] }}>
      <span data-context-name="" style={{ color: NAME_COLORS[row.unit] }}>
        {row.label}
      </span>
      {isEstimated ? (
        <span data-context-estimate="">
          {JOINER}
          <span style={{ display: 'inline-flex', verticalAlign: '-0.125em' }}>
            <EstimateMark />
          </span>{' '}
          {ESTIMATED_ODDS_CONTEXT}
        </span>
      ) : undefined}
    </div>
  );
}

// `{components.expansion-panel}`: flush under its open row, the row's bar continued down its edge.
// Its two toggles are local state, so they reset when the row closes and unmounts the panel.
function ExpansionPanel({
  row,
  lines,
  pruned,
  last,
}: {
  readonly row: DisplayRow | ClassDisplayRow;
  readonly lines: readonly LineView[];
  readonly pruned: readonly PrunedCombination[];
  readonly last: boolean;
}): JSX.Element {
  const [isGrown, setGrown] = useState(false);
  const [isPrunedShown, setPrunedShown] = useState(false);
  const hidden = lines.length - TOP_LINES;
  const visible = isGrown ? lines : lines.slice(0, TOP_LINES);
  return (
    <div
      data-expansion-panel=""
      style={{
        padding: `6px 0 14px ${spacing['expansion-indent']}`,
        background: colors.surface,
        borderBottom: last ? undefined : `1px solid ${colors.line}`,
        boxShadow: `inset ${spacing['open-row-bar']} 0 0 ${colors.accent}`,
        cursor: 'default',
      }}
    >
      <ContextLine row={row} />
      {visible.map((line) => (
        <ExpansionLine key={line.key} line={line} />
      ))}
      {hidden > 0 ? (
        <ShowMore
          name="lines"
          isOpen={isGrown}
          onToggle={() => {
            setGrown((current) => !current);
          }}
        >
          {isGrown ? FEWER_LINES_COPY : moreLinesCopy(hidden)}
        </ShowMore>
      ) : undefined}
      {isPrunedShown ? pruned.map((line) => <PrunedLine key={line.key} text={line.text} reason={line.reason} />) : undefined}
      {pruned.length > 0 ? (
        <ShowMore
          name="pruned"
          isOpen={isPrunedShown}
          onToggle={() => {
            setPrunedShown((current) => !current);
          }}
        >
          {prunedCopy(pruned.length, isPrunedShown)}
        </ShowMore>
      ) : undefined}
    </div>
  );
}

/** The panel under an open Raw Base row: its context line and its one line. */
export function RawExpansionPanel({
  row,
  activeLeague,
  last = false,
}: {
  readonly row: DisplayRow;
  readonly activeLeague: string;
  /** Under the list's last row, or the row above show-more: no rule (DESIGN.md *Density*). */
  readonly last?: boolean;
}): JSX.Element {
  return <ExpansionPanel row={row} lines={[rawLine(row, activeLeague)]} pruned={[]} last={last} />;
}

/** The panel under an open crafted row: one line per entry in `core`'s order, then the pruned. */
export function ClassExpansionPanel({
  row,
  activeLeague,
  last = false,
}: {
  readonly row: ClassDisplayRow;
  readonly activeLeague: string;
  /** Under the list's last row, or the row above show-more: no rule (DESIGN.md *Density*). */
  readonly last?: boolean;
}): JSX.Element {
  return (
    <ExpansionPanel
      row={row}
      lines={row.combinations.map((combination) => craftedLine(combination, row.label, activeLeague))}
      pruned={row.pruned}
      last={last}
    />
  );
}
