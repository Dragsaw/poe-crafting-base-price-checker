import type { JSX } from 'react';

import { colors, px, spacing, typeStyle } from '../theme/tokens';
import { PANEL_HEADINGS, type FigureGroup, type PanelColumns, type Segment } from './trust-facts';

function SegmentText({ segment }: { readonly segment: Segment }): JSX.Element {
  switch (segment.kind) {
    case 'figure': {
      return (
        <span data-figure="" style={{ color: colors.ink, fontVariantNumeric: 'tabular-nums', fontStyle: 'normal' }}>
          {segment.text}
        </span>
      );
    }
    case 'missing': {
      return (
        <em data-missing="" style={{ fontStyle: 'italic' }}>
          {segment.text}
        </em>
      );
    }
    case 'verbatim': {
      // The panel's own size, weight and line height in the mono stack; the
      // panel's ink, never a semantic colour. A canonical key has no spaces,
      // so it may break anywhere.
      return (
        <span
          data-verbatim=""
          style={{ ...typeStyle('sync-report-verbatim'), fontStyle: 'normal', overflowWrap: 'anywhere' }}
        >
          {segment.text}
        </span>
      );
    }
    case 'text': {
      return <>{segment.text}</>;
    }
  }
}

function Group({ group, first }: { readonly group: FigureGroup; readonly first: boolean }): JSX.Element {
  return (
    <div data-figure-group="" style={{ marginTop: first ? 0 : px(spacing.syncReportGroupGap) }}>
      {group.map((line, lineIndex) => (
        <div key={lineIndex}>
          {line.map((segment, segmentIndex) => (
            <SegmentText key={segmentIndex} segment={segment} />
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * `{components.sync-report-panel}`: opens in place under the trust strip and
 * pushes everything below it down. A paper-inset band between two hairlines,
 * capped at `syncReportMaxHeight` and scrolling inside its own band past it —
 * the one capped band on the page. Three equal columns, **one heading per
 * column, never per group**; groups in a column are a vertical stack 8px
 * apart, so the sixth group under *What is broken*, the cross-file diagnosis,
 * takes vertical space alone. No hover state.
 */
export function SyncReportPanel({ columns }: { readonly columns: PanelColumns }): JSX.Element {
  return (
    <div
      data-sync-report-panel=""
      style={{
        ...typeStyle('key-body'),
        color: colors['ink-secondary'],
        background: colors['paper-inset'],
        borderTop: `${px(spacing.hairline)} solid ${colors['rule-hairline']}`,
        borderBottom: `${px(spacing.hairline)} solid ${colors['rule-hairline']}`,
        padding: `${px(spacing.syncReportPadTop)} ${px(spacing.syncReportPadX)} ${px(spacing.syncReportPadBottom)}`,
        maxHeight: px(spacing.syncReportMaxHeight),
        overflowY: 'auto',
        boxSizing: 'border-box',
        display: 'flex',
      }}
    >
      {columns.map((groups, columnIndex) => {
        const isLast = columnIndex === columns.length - 1;
        return (
          <div
            key={PANEL_HEADINGS[columnIndex]}
            data-panel-column=""
            style={{ flex: '1 1 0', minWidth: 0, paddingRight: isLast ? 0 : px(spacing.syncReportColumnGap) }}
          >
            <span
              data-panel-heading=""
              style={{
                ...typeStyle('key-heading'),
                display: 'block',
                marginBottom: px(spacing.keyHeadingGap),
                textTransform: 'uppercase',
                color: colors['ink-tertiary'],
              }}
            >
              {PANEL_HEADINGS[columnIndex]}
            </span>
            {groups.map((group, groupIndex) => (
              <Group key={groupIndex} group={group} first={groupIndex === 0} />
            ))}
          </div>
        );
      })}
    </div>
  );
}
