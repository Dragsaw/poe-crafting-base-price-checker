import { RECIPE_UNREACHABLE, type UnrankableClass, type UnrankableReason } from '@poe/core';
import type { JSX } from 'react';

import { plural } from '../shared/text';
import { colors, layout, px, spacing, typeStyle } from '../theme/tokens';
import { unitLabel } from './format';

export const APPENDIX_TITLE = 'Appendix: Unrankable — ';

/** The non-empty appendix's one lead line (EXPERIENCE.md Copy Deck). */
export const APPENDIX_LEAD = 'Tracked, but kept out of the ordering.';

/** The notes of states 14, 15 and 15a; state 36's reason takes none (EXPERIENCE.md Copy Deck). */
export const APPENDIX_NOTES: Readonly<Partial<Record<UnrankableReason, string>>> = {
  'pool partial': 'ranks once the weights file covers its whole pool',
  'class absent from weights file': 'may return after the next weights run',
  'class disagrees with weights file': 'fixable in data/tracked.json · the sync report has the detail',
};

/** State 16's note: the class's Base Types still rank as Raw Base rows. */
export const RAW_RANKS_NOTE = 'some of its bases still rank, sold as is';

export const NOTE_JOINER = ' · ';

/** `1 Item Class`, `N Item Classes`. */
export function appendixCount(count: number): string {
  return `${String(count)} ${plural(count, 'Item Class', 'Item Classes')}`;
}

/** The key of an Item Class in the `rawRanks` set. */
export function appendixClassKey(item: Pick<UnrankableClass, 'categoryId' | 'className'>): string {
  return JSON.stringify([item.categoryId, item.className]);
}

/** The row's note: its reason's note, then state 16's. */
function appendixNote(item: UnrankableClass, hasRankingBases: boolean): string {
  if (item.reason === RECIPE_UNREACHABLE) {
    return '';
  }
  const notes = [APPENDIX_NOTES[item.reason], hasRankingBases ? RAW_RANKS_NOTE : undefined];
  return notes.filter((note) => note !== undefined).join(NOTE_JOINER);
}

const APPENDIX_GRID = {
  display: 'grid',
  gridTemplateColumns: `${spacing['col-rank']} ${spacing['col-name']} ${spacing['expansion-trust-cell']} minmax(0, 1fr)`,
  columnGap: spacing['col-gap'],
  alignItems: 'center',
} as const;

// `{components.unrankable-appendix}`: every row renders, nothing switches on a count; rows are not interactive.
export function UnrankableAppendix({
  classes,
  rawRanks = new Set(),
}: {
  readonly classes: readonly UnrankableClass[];
  /** The `appendixClassKey` of each class with a Raw Base row in the active ordering (state 16). */
  readonly rawRanks?: ReadonlySet<string>;
}): JSX.Element {
  const isEmpty = classes.length === 0;
  return (
    <section
      data-unrankable-appendix={isEmpty ? 'empty' : ''}
      style={{
        marginTop: px(layout.s6),
        paddingTop: px(layout.s4),
        borderTop: `${px(layout.hairline)} solid ${colors['line-strong']}`,
      }}
    >
      <h2 data-appendix-title="" style={{ ...typeStyle('row-name'), margin: 0, color: colors.text }}>
        {APPENDIX_TITLE}
        <span data-appendix-count="" style={{ color: colors.text }}>
          {appendixCount(classes.length)}
        </span>
      </h2>
      {isEmpty ? undefined : (
        <>
          <p
            data-appendix-lead=""
            style={{ ...typeStyle('note'), margin: `${px(layout.s1)} 0 ${px(layout.s2)}`, color: colors['text-secondary'] }}
          >
            {APPENDIX_LEAD}
          </p>
          {classes.map((item, index) => (
            <AppendixRow
              key={`${appendixClassKey(item)}${item.recipeId ?? ''}`}
              item={item}
              note={appendixNote(item, rawRanks.has(appendixClassKey(item)))}
              last={index === classes.length - 1}
            />
          ))}
        </>
      )}
    </section>
  );
}

function AppendixRow({
  item,
  note,
  last,
}: {
  readonly item: UnrankableClass;
  readonly note: string;
  readonly last: boolean;
}): JSX.Element {
  return (
    <div
      data-appendix-row=""
      style={{
        ...APPENDIX_GRID,
        height: spacing['line-height-expansion'],
        boxSizing: 'border-box',
        borderBottom: last ? undefined : `${px(layout.hairline)} solid ${colors.line}`,
        whiteSpace: 'nowrap',
      }}
    >
      <span data-cell="rank" />
      <span data-cell="class" data-appendix-class="" style={{ ...typeStyle('line-text'), color: colors['rarity-magic'] }}>
        {unitLabel(item.className)}
      </span>
      <span data-cell="reason" style={{ ...typeStyle('line-text'), color: colors['text-secondary'] }}>
        {item.reason}
      </span>
      <span data-cell="note" style={{ ...typeStyle('note'), color: colors['text-tertiary'] }}>
        {note}
      </span>
    </div>
  );
}
