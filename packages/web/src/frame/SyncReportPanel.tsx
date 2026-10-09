import type { JSX } from 'react';

import { colors, layout, px, stacks, typeStyle } from '../theme/tokens';
import { PANEL_HEADINGS, type FigureGroup, type PanelColumns, type Segment } from './trust-facts';

function SegmentText({ segment }: { readonly segment: Segment }): JSX.Element {
  switch (segment.kind) {
    case 'figure': {
      return (
        <span data-figure="" style={{ color: colors.text, fontVariantNumeric: 'tabular-nums', fontStyle: 'normal' }}>
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
      // panel's text colour, never a semantic colour. A canonical key has no spaces,
      // so it may break anywhere.
      return (
        <span
          data-verbatim=""
          style={{ ...typeStyle('note'), fontFamily: stacks.mono, fontStyle: 'normal', overflowWrap: 'anywhere' }}
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
    <div data-figure-group="" style={{ marginTop: first ? 0 : px(layout.syncReportGroupGap) }}>
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

/** `{components.sync-report-panel}`: one heading per column, never per group. */
export function SyncReportPanel({ columns }: { readonly columns: PanelColumns }): JSX.Element {
  return (
    <div
      data-sync-report-panel=""
      style={{
        ...typeStyle('note'),
        color: colors['text-secondary'],
        background: colors.surface,
        borderTop: `${px(layout.hairline)} solid ${colors.line}`,
        borderBottom: `${px(layout.hairline)} solid ${colors.line}`,
        padding: `${px(layout.syncReportPadTop)} ${px(layout.syncReportPadX)} ${px(layout.syncReportPadBottom)}`,
        maxHeight: px(layout.syncReportMaxHeight),
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
            style={{ flex: '1 1 0', minWidth: 0, paddingRight: isLast ? 0 : px(layout.syncReportColumnGap) }}
          >
            <span
              data-panel-heading=""
              style={{
                ...typeStyle('column-header'),
                display: 'block',
                marginBottom: px(layout.keyHeadingGap),
                textTransform: 'uppercase',
                color: colors['text-tertiary'],
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
