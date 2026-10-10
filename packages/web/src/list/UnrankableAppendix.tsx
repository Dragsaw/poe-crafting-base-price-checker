import type { UnrankableClass } from '@poe/core';
import type { JSX } from 'react';

import { fixedCell } from '../shared/cell';
import { plural } from '../shared/text';
import { colors, columnSums, px, layout, typeStyle } from '../theme/tokens';
import { unitLabel } from './format';
import { TrustMark } from './TrustMark';
import { UnitGlyph } from './UnitGlyph';

const APPENDIX_TITLE = 'Appendix: Unrankable — ';

/** The non-empty appendix's one lead line (Story 2.8, human decision 2026-09-27). */
export const APPENDIX_LEAD = 'Tracked, but kept out of the ordering.';

/** The mark every `class absent from weights file` row carries, as the mockup shows. */
const APPENDIX_MARK_WORD = 'unknown';

// The note for `class disagrees with weights file`; the sync report panel names the entry.
export const DISAGREES_NOTE = 'The pool is published and complete; the disagreement is in your Tracked List.';

/** `1 Item Class`, `N Item Classes`. */
export function appendixCount(count: number): string {
  return `${String(count)} ${plural(count, 'Item Class', 'Item Classes')}`;
}

const [baseWidth, markWidth, reasonWidth, noteWidth] = columnSums.appendix;

// `{components.unrankable-appendix}`: every row renders, nothing switches on a count (UX-DR53).
// Rows are not interactive (UX-DR44). With no rows it is the title alone (EXPERIENCE.md state 37).
export function UnrankableAppendix({ classes }: { readonly classes: readonly UnrankableClass[] }): JSX.Element {
  const isEmpty = classes.length === 0;
  return (
    <section
      data-unrankable-appendix={isEmpty ? 'empty' : ''}
      style={{
        background: colors.surface,
        border: `${px(layout.hairline)} solid ${colors.line}`,
        padding: `${px(layout.appendixPadTop)} ${px(layout.appendixPadX)} ${px(
          isEmpty ? layout.appendixPadTop : layout.appendixPadBottom,
        )}`,
        boxSizing: 'border-box',
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
            style={{
              ...typeStyle('note'),
              margin: `${px(layout.appendixLeadMarginTop)} 0 ${px(layout.appendixLeadMarginBottom)}`,
              maxWidth: px(layout.appendixLeadMaxWidth),
              color: colors['text-secondary'],
            }}
          >
            {APPENDIX_LEAD}
          </p>
          {classes.map((item, index) => (
            <AppendixRow
              key={JSON.stringify([item.categoryId, item.className])}
              item={item}
              last={index === classes.length - 1}
            />
          ))}
        </>
      )}
    </section>
  );
}

function AppendixRow({ item, last }: { readonly item: UnrankableClass; readonly last: boolean }): JSX.Element {
  return (
    <div
      data-appendix-row=""
      style={{
        ...typeStyle('line-text'),
        display: 'flex',
        alignItems: 'center',
        height: px(layout.appendixRowHeight),
        boxSizing: 'border-box',
        borderBottom: last ? undefined : `${px(layout.hairline)} solid ${colors.line}`,
        whiteSpace: 'nowrap',
        color: colors.text,
      }}
    >
      <div data-cell="class" style={{ ...fixedCell({ width: baseWidth }), display: 'flex', alignItems: 'baseline' }}>
        <UnitGlyph unit="class" />
        <span data-appendix-class="" style={{ flex: '1 1 auto', minWidth: 0 }}>
          {unitLabel(item.className)}
        </span>
      </div>
      <div data-cell="mark" style={fixedCell({ width: markWidth })}>
        <TrustMark kind="unknown" word={APPENDIX_MARK_WORD} />
      </div>
      <div
        data-cell="reason"
        style={{
          ...fixedCell({ width: reasonWidth }),
          color: colors['text-secondary'],
        }}
      >
        {item.reason}
      </div>
      <div
        data-cell="note"
        style={{
          ...fixedCell({ width: noteWidth }),
          color: colors['text-tertiary'],
        }}
      >
        {item.reason === 'class disagrees with weights file' ? DISAGREES_NOTE : undefined}
      </div>
    </div>
  );
}
