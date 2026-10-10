import type { JSX } from 'react';

import { VerdictMark } from '../marks/marks';
import { colors, layout, px, stacks, typeStyle } from '../theme/tokens';
import type { PanelColumns } from './panel-columns';
import type { FigureGroup, Segment } from './segments';
import { PANEL_HEADINGS } from './trust-copy';

function SegmentText({ segment }: { readonly segment: Segment }): JSX.Element {
  switch (segment.kind) {
    case 'figure': {
      return (
        <span data-figure="" style={{ color: colors.text, fontVariantNumeric: 'tabular-nums' }}>
          {segment.text}
        </span>
      );
    }
    case 'missing': {
      return <span data-missing="">{segment.text}</span>;
    }
    case 'verbatim': {
      // A canonical key has no spaces, so it may break anywhere.
      return (
        <span data-verbatim="" style={{ fontFamily: stacks.mono, overflowWrap: 'anywhere' }}>
          {segment.text}
        </span>
      );
    }
    case 'mark': {
      return (
        <span
          data-problem-mark={segment.mark}
          style={{ display: 'inline-block', verticalAlign: '-0.125em' }}
        >
          <VerdictMark verdict={segment.mark} />
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
        <div key={lineIndex} data-panel-line="">
          {line.map((segment, segmentIndex) => (
            <SegmentText key={segmentIndex} segment={segment} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** `{components.sync-report-panel}`: four equal columns, one heading each, never one per group. */
export function SyncReportPanel({ columns }: { readonly columns: PanelColumns }): JSX.Element {
  return (
    <div
      data-sync-report-panel=""
      style={{
        ...typeStyle('line-text'),
        color: colors['text-secondary'],
        background: colors.surface,
        borderBottom: `${px(layout.hairline)} solid ${colors['line-strong']}`,
        padding: `${px(layout.syncReportPadTop)} ${px(layout.syncReportPadX)} ${px(layout.syncReportPadBottom)}`,
        maxHeight: px(layout.syncReportMaxHeight),
        overflowY: 'auto',
        boxSizing: 'border-box',
        display: 'grid',
        gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
        columnGap: px(layout.syncReportColumnGap),
        alignItems: 'start',
      }}
    >
      {columns.map((groups, columnIndex) => (
        <div key={PANEL_HEADINGS[columnIndex]} data-panel-column="">
          <span
            data-panel-heading=""
            style={{
              ...typeStyle('column-header'),
              display: 'block',
              marginBottom: px(layout.syncReportHeadingGap),
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
      ))}
    </div>
  );
}
