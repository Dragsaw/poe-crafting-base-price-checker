import { rank } from '@poe/core';
import { useCallback, useEffect, useMemo, useState, type JSX, type ReactNode } from 'react';

import { FailureScreen } from './frame/FailureScreen';
import { Frame } from './frame/Frame';
import { Masthead } from './frame/Masthead';
import { RowSlots } from './frame/RowSlots';
import { TrustStrip, TrustStripSlot } from './frame/TrustStrip';
import { AskingPriceLine } from './list/AskingPriceLine';
import { toDisplayRows } from './list/display-rows';
import { KeyBlock } from './list/KeyBlock';
import { listStatement } from './list/list-statement';
import { ListStatement } from './list/ListStatement';
import { RankedList } from './list/RankedList';
import { RunningFoot } from './list/RunningFoot';
import { UnrankableAppendix } from './list/UnrankableAppendix';
import type { ArtifactSet } from './load/artifacts';
import { loadArtifacts, type LoadOutcome } from './load/load-artifacts';
import { readStoredThreshold, writeStoredThreshold } from './threshold/threshold-storage';

type ReadyOutcome = Extract<LoadOutcome, { readonly kind: 'ready' }>;

/** A ready outcome carries the "now" its ages are read against, taken once when the load resolved. */
type ViewState =
  | { readonly kind: 'pending' }
  | Exclude<LoadOutcome, ReadyOutcome>
  | (ReadyOutcome & { readonly now: number });

/**
 * The page's substrate. It paints the masthead and twenty skeleton slots at
 * once, then moves to exactly one outcome in a single state transition — a
 * whole set, the refusal screen or the fetch-failure screen — never row by row
 * (AD-24, FR-33). `+ Try again` re-runs all eight fetches.
 *
 * The resting chrome, in order: masthead, trust strip, asking-price line, the
 * list statement when the ranking makes one (states 23 and 25), column header,
 * list, then the Unrankable appendix, the key block and the running foot. The skeleton paints the same
 * chrome around its slots, with a blank trust-strip slot of the strip's height; the two failure screens paint none of it.
 */
export function App(): JSX.Element {
  const [attempt, setAttempt] = useState(0);
  const [view, setView] = useState<ViewState>({ kind: 'pending' });

  useEffect(() => {
    let live = true;
    const controller = new AbortController();
    void loadArtifacts({ signal: controller.signal }).then((outcome) => {
      if (live) {
        // "Now" is read once, as the set resolves, and held: ages never tick.
        setView(outcome.kind === 'ready' ? { ...outcome, now: Date.now() } : outcome);
      }
    });
    return () => {
      live = false;
      controller.abort();
    };
  }, [attempt]);

  // The only value that survives a reload (FR-7): read once at mount, written on each change.
  const [threshold, setThreshold] = useState(() => readStoredThreshold());
  const changeThreshold = useCallback((value: number) => {
    setThreshold(value);
    writeStoredThreshold(value);
  }, []);

  const retry = useCallback(() => {
    setView({ kind: 'pending' });
    setAttempt((count) => count + 1);
  }, []);

  switch (view.kind) {
    case 'pending':
      return (
        <Frame state="pending">
          <Masthead league={undefined} threshold={threshold} onThresholdChange={changeThreshold} />
          <TrustStripSlot />
          <AskingPriceLine />
          <RowSlots />
          <PageTail />
        </Frame>
      );
    case 'ready':
      return (
        <Frame state="ready">
          <Masthead league={view.set.config.league} threshold={threshold} onThresholdChange={changeThreshold} />
          <TrustStrip set={view.set} absent={view.absent} now={view.now} />
          <AskingPriceLine />
          <ReadyBody set={view.set} now={view.now} threshold={threshold} />
        </Frame>
      );
    case 'refused':
      return (
        <Frame state="refused">
          <FailureScreen variant="refused" path={view.path} declared={view.declared} expected={view.expected} />
        </Frame>
      );
    case 'failed':
      return (
        <Frame state="failed">
          <FailureScreen variant="failed" path={view.path} onRetry={retry} />
        </Frame>
      );
  }
}

/**
 * `core` ranks the whole loaded set at the player's threshold; `web` renders
 * what it returns and orders nothing itself (AD-4). Memoised on the set,
 * `now` and the threshold. Renders the ready body below the asking-price
 * line: the list statement, the ranked list, and the page tail led by the
 * Unrankable appendix — all from one ranking.
 */
function ReadyBody({
  set,
  now,
  threshold,
}: {
  readonly set: ArtifactSet;
  readonly now: number;
  readonly threshold: number;
}): JSX.Element {
  const { rows, statement, unrankable } = useMemo(() => {
    const ranking = rank({
      tracked: set.tracked.entries,
      dataset: set.dataset.entries,
      activeLeague: set.config.league,
      threshold,
      weightsLoaded: set.weights !== null,
    });
    return {
      rows: toDisplayRows(ranking, set.dataset.entries, now),
      statement: listStatement(ranking, threshold, set.config.league),
      unrankable: ranking.unrankable,
    };
  }, [set, now, threshold]);
  return (
    <>
      <ListStatement statement={statement} />
      <RankedList rows={rows} threshold={threshold} activeLeague={set.config.league} />
      <PageTail appendix={<UnrankableAppendix classes={unrankable} />} />
    </>
  );
}

/**
 * What closes every state but the two failure screens, pushed to the frame's
 * foot by `margin-top: auto`: the Unrankable appendix (ready only — while
 * pending no count is known), then the key block and the running foot. One
 * arrangement in every data state; more rows grow the document.
 */
function PageTail({ appendix }: { readonly appendix?: ReactNode }): JSX.Element {
  return (
    <div data-page-tail="" style={{ marginTop: 'auto' }}>
      {appendix}
      <KeyBlock />
      <RunningFoot />
    </div>
  );
}
