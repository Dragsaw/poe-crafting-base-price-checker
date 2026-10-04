import { useState, type JSX, type ReactNode } from 'react';

import type { ArtifactSet, TolerableKey } from '../load/artifacts';
import { NBSP } from '../shared/text';
import { colors, glyphs, px, spacing, typeStyle } from '../theme/tokens';
import { AbsenceLines } from './AbsenceLines';
import { SyncReportPanel } from './SyncReportPanel';
import {
  AFFORDANCE_CLOSED,
  AFFORDANCE_OPEN,
  healthSignals,
  LAST_SYNCED_LABEL,
  lastSynced,
  panelColumns,
  TRACKED_LIST_EDITED_LABEL,
  trackedListEdit,
  UNKNOWN,
  WEIGHTS_FILE_LABEL,
  weightsFacts,
  type DiagnosisFailure,
} from './trust-facts';

function Label({ children }: { readonly children: ReactNode }): JSX.Element {
  return <b style={{ color: colors.ink, fontWeight: 600 }}>{children}</b>;
}

/** The strip's field separator: `|` in ink-tertiary, 9px each side. Never the page's middle dot. */
function Separator(): JSX.Element {
  return (
    <span
      data-separator=""
      style={{ color: colors['ink-tertiary'], fontWeight: 400, padding: `0 ${px(spacing.trustSeparatorPadX)}` }}
    >
      |
    </span>
  );
}

/** A value, or the italic *unknown* a missing value always reads. Never a placeholder. */
function Value({ value }: { readonly value: string | undefined }): JSX.Element {
  return value === undefined ? <em data-missing="" style={{ fontStyle: 'italic' }}>{UNKNOWN}</em> : <>{value}</>;
}

/**
 * `{components.trust-strip}`: between the masthead and the asking-price line,
 * always present, never dismissible. Two lines of plain facts — attribution,
 * not health — with no mark and no colour on any of them (FR-10, FR-18). Then
 * one line per absent tolerable artifact, then the rust health line, raised by
 * data only for unresolvable entries or pinned starvation (FR-24, FR-25).
 *
 * The whole strip is the click target for `{components.sync-report-panel}`,
 * which opens in place beneath it and is closed on every load. A cross-file
 * failure changes nothing here: its diagnosis is the panel's sixth group. The request
 * log is untouched: toggling reads what the load already holds.
 */
export function TrustStrip({
  set,
  absent,
  now,
  crossFileFailures = [],
}: {
  readonly set: ArtifactSet;
  readonly absent: readonly TolerableKey[];
  readonly now: number;
  /** The load's cross-file failures (AD-17): the panel's diagnosis, never a strip line. */
  readonly crossFileFailures?: readonly DiagnosisFailure[];
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const report = set.syncReport;
  const edit = trackedListEdit(report);
  const signals = healthSignals(report, {
    pinnedCount: set.tracked.entries.filter((entry) => entry.status === 'pinned').length,
    minChunkSearches: set.config.minChunkSearches,
  });
  const [producer, generatedAt, gamePatch] = weightsFacts(set.weights);

  return (
    <>
      <div
        data-trust-strip=""
        data-open={open ? '' : undefined}
        className="fg-trust-strip"
        onClick={() => {
          setOpen((was) => !was);
        }}
        style={{
          ...typeStyle('trust-strip'),
          color: colors['ink-secondary'],
          borderTop: `${px(spacing.hairline)} solid ${colors['rule-strong']}`,
          borderBottom: `${px(spacing.hairline)} solid ${colors['rule-hairline']}`,
          padding: `${px(spacing.trustStripPadTop)} 0 ${px(spacing.trustStripPadBottom)}`,
          cursor: 'pointer',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <div data-trust-line="weights">
            <Label>{WEIGHTS_FILE_LABEL}</Label>
            {`${NBSP} `}
            {producer.name} <Value value={producer.value} /> <Separator /> {generatedAt.name}{' '}
            <Value value={generatedAt.value} /> <Separator /> {gamePatch.name} <Value value={gamePatch.value} />
          </div>
          <span
            data-strip-affordance=""
            className="fg-strip-affordance"
            style={{ ...typeStyle('expand-affordance'), color: colors.sepia, alignSelf: 'center', whiteSpace: 'nowrap' }}
          >
            {open ? AFFORDANCE_OPEN : AFFORDANCE_CLOSED}
          </span>
        </div>
        <div data-trust-line="sync">
          <Label>{LAST_SYNCED_LABEL}</Label>
          {`${NBSP} `}
          <Value value={lastSynced(report, now)} /> <Separator /> <Label>{TRACKED_LIST_EDITED_LABEL}</Label>
          {`${NBSP} `}
          {edit === undefined ? <Value value={undefined} /> : `${edit.date}${edit.suffix}`}
        </div>
        <AbsenceLines absent={absent} />
        {signals.length > 0 ? (
          <div
            data-health-line=""
            style={{
              height: px(spacing.frameReserveHealthLine),
              lineHeight: px(spacing.frameReserveHealthLine),
            }}
          >
            {signals.map((signal, index) => (
              <span key={signal}>
                {index > 0 ? <Separator /> : undefined}
                <span data-health-signal="" style={{ color: colors.rust, fontWeight: 700 }}>
                  <span style={{ fontSize: px(9) }}>{`${glyphs.unresolvable}${NBSP}`}</span>
                  {signal}
                </span>
              </span>
            ))}
          </div>
        ) : undefined}
      </div>
      {open ? <SyncReportPanel columns={panelColumns(report, set.weights !== undefined, crossFileFailures)} /> : undefined}
    </>
  );
}

/**
 * The skeleton's trust strip: the resting strip's rules, padding and two
 * empty lines, so the page below never jumps at the pending → ready
 * transition (EXPERIENCE.md state 22). No text, no affordance, no click.
 */
export function TrustStripSlot(): JSX.Element {
  const role = typeStyle('trust-strip');
  return (
    <div
      data-trust-strip-slot=""
      aria-hidden="true"
      style={{
        ...role,
        borderTop: `${px(spacing.hairline)} solid ${colors['rule-strong']}`,
        borderBottom: `${px(spacing.hairline)} solid ${colors['rule-hairline']}`,
        padding: `${px(spacing.trustStripPadTop)} 0 ${px(spacing.trustStripPadBottom)}`,
      }}
    >
      <div style={{ height: `${String(2 * Number(role.lineHeight))}em` }} />
    </div>
  );
}
