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

/** The whole strip toggles `{components.sync-report-panel}`, closed on every load; a cross-file failure shows only in the panel (FR-10, FR-18, FR-24). */
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
          <WeightsLine facts={weightsFacts(set.weights)} />
          <span
            data-strip-affordance=""
            className="fg-strip-affordance"
            style={{ ...typeStyle('expand-affordance'), color: colors.sepia, alignSelf: 'center', whiteSpace: 'nowrap' }}
          >
            {open ? AFFORDANCE_OPEN : AFFORDANCE_CLOSED}
          </span>
        </div>
        <SyncLine lastSyncedText={lastSynced(report, now)} edit={edit} />
        <AbsenceLines absent={absent} />
        <HealthLine signals={signals} />
      </div>
      {open ? <SyncReportPanel columns={panelColumns(report, set.weights !== undefined, crossFileFailures)} /> : undefined}
    </>
  );
}

type WeightsFacts = ReturnType<typeof weightsFacts>;

function WeightsLine({ facts }: { readonly facts: WeightsFacts }): JSX.Element {
  const [producer, generatedAt, gamePatch] = facts;
  return (
    <div data-trust-line="weights">
      <Label>{WEIGHTS_FILE_LABEL}</Label>
      {`${NBSP} `}
      {producer.name} <Value value={producer.value} /> <Separator /> {generatedAt.name}{' '}
      <Value value={generatedAt.value} /> <Separator /> {gamePatch.name} <Value value={gamePatch.value} />
    </div>
  );
}

function SyncLine({
  lastSyncedText,
  edit,
}: {
  readonly lastSyncedText: string | undefined;
  readonly edit: ReturnType<typeof trackedListEdit>;
}): JSX.Element {
  return (
    <div data-trust-line="sync">
      <Label>{LAST_SYNCED_LABEL}</Label>
      {`${NBSP} `}
      <Value value={lastSyncedText} /> <Separator /> <Label>{TRACKED_LIST_EDITED_LABEL}</Label>
      {`${NBSP} `}
      {edit === undefined ? <Value value={undefined} /> : `${edit.date}${edit.suffix}`}
    </div>
  );
}

function HealthLine({ signals }: { readonly signals: readonly string[] }): JSX.Element | undefined {
  if (signals.length === 0) {
    return undefined;
  }
  return (
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
  );
}

/** The skeleton's strip: same rules, padding and two empty lines, so the page never jumps at pending → ready (EXPERIENCE.md state 22). */
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
