import { useCallback, useEffect, useState, type JSX } from 'react';

import { AbsenceLines } from './frame/AbsenceLines';
import { FailureScreen } from './frame/FailureScreen';
import { Frame } from './frame/Frame';
import { Masthead } from './frame/Masthead';
import { RowSlots } from './frame/RowSlots';
import { loadArtifacts, type LoadOutcome } from './load/load-artifacts';

type ViewState = { readonly kind: 'pending' } | LoadOutcome;

/**
 * The page's substrate. It paints the masthead and twenty skeleton slots at
 * once, then moves to exactly one outcome in a single state transition — a
 * whole set, the refusal screen or the fetch-failure screen — never row by row
 * (AD-24, FR-33). `+ Try again` re-runs all eight fetches.
 *
 * Stories 2.2 and 2.3 render the ranked rows into the ready state.
 */
export function App(): JSX.Element {
  const [attempt, setAttempt] = useState(0);
  const [view, setView] = useState<ViewState>({ kind: 'pending' });

  useEffect(() => {
    let live = true;
    void loadArtifacts().then((outcome) => {
      if (live) {
        setView(outcome);
      }
    });
    return () => {
      live = false;
    };
  }, [attempt]);

  const retry = useCallback(() => {
    setView({ kind: 'pending' });
    setAttempt((count) => count + 1);
  }, []);

  switch (view.kind) {
    case 'pending':
      return (
        <Frame state="pending">
          <Masthead league={undefined} />
          <RowSlots />
        </Frame>
      );
    case 'ready':
      return (
        <Frame state="ready">
          <Masthead league={view.set.config.league} />
          <AbsenceLines absent={view.absent} />
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
