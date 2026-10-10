import { useState, type JSX, type ReactNode } from 'react';

import type { ArtifactSet, TolerableKey } from '../load/artifacts';
import { NBSP } from '../shared/text';
import { colors, glyphs, px, layout, typeStyle } from '../theme/tokens';
import { AbsenceLines } from './AbsenceLines';
import { SyncReportPanel } from './SyncReportPanel';
import {
  AFFORDANCE_CLOSED,
  AFFORDANCE_OPEN,
  LAST_SYNCED_LABEL,
  lastSynced,
  lineText,
  panelColumns,
  problemSummary,
  TRACKED_LIST_EDITED_LABEL,
  trackedListEdit,
  UNKNOWN,
  WEIGHTS_FILE_LABEL,
  weightsFacts,
  type DiagnosisFailure,
} from './trust-facts';

function Label({ children }: { readonly children: ReactNode }): JSX.Element {
  return <b style={{ color: colors.text, fontWeight: 600 }}>{children}</b>;
}

/** The strip's field separator: `|` in text-tertiary, 9px each side. Never the page's middle dot. */
function Separator(): JSX.Element {
  return (
    <span
      data-separator=""
      style={{ color: colors['text-tertiary'], fontWeight: 400, padding: `0 ${px(layout.trustSeparatorPadX)}` }}
    >
      |
    </span>
  );
}

/** A value, or the italic *unknown* a missing value always reads. Never a placeholder. */
function Value({ value }: { readonly value: string | undefined }): JSX.Element {
  return value === undefined ? <em data-missing="" style={{ fontStyle: 'italic' }}>{UNKNOWN}</em> : <>{value}</>;
}

/** The strip toggles `{components.sync-report-panel}`, closed on load (FR-18). */
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
  const problems = problemSummary(set.dataset.entries, report, {
    pinnedCount: set.tracked.entries.filter((entry) => entry.status === 'pinned').length,
    minChunkSearches: set.config.minChunkSearches,
  });
  const signals = problems.lines.map((line) => lineText(line));

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
          ...typeStyle('note'),
          color: colors['text-secondary'],
          borderTop: `${px(layout.hairline)} solid ${colors['line-strong']}`,
          borderBottom: `${px(layout.hairline)} solid ${colors.line}`,
          padding: `${px(layout.trustStripPadTop)} 0 ${px(layout.trustStripPadBottom)}`,
          cursor: 'pointer',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <WeightsLine facts={weightsFacts(set.weights)} />
          <span
            data-strip-affordance=""
            className="fg-strip-affordance"
            style={{ ...typeStyle('trust'), color: colors.accent, alignSelf: 'center', whiteSpace: 'nowrap' }}
          >
            {open ? AFFORDANCE_OPEN : AFFORDANCE_CLOSED}
          </span>
        </div>
        <SyncLine lastSyncedText={lastSynced(report, now)} edit={edit} />
        <AbsenceLines absent={absent} />
        <HealthLine signals={signals} />
      </div>
      {open ? (
        <SyncReportPanel
          columns={panelColumns({ report, weights: set.weights, absent, now, problems, crossFileFailures })}
        />
      ) : undefined}
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
        height: px(layout.healthLineHeight),
        lineHeight: px(layout.healthLineHeight),
      }}
    >
      {signals.map((signal, index) => (
        <span key={signal}>
          {index > 0 ? <Separator /> : undefined}
          <span data-health-signal="" style={{ color: colors['trust-broken'], fontWeight: 700 }}>
            <span style={{ fontSize: px(9) }}>{`${glyphs.unresolvable}${NBSP}`}</span>
            {signal}
          </span>
        </span>
      ))}
    </div>
  );
}

