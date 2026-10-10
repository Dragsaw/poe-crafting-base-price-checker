import { crossFileChecks, rank } from '@poe/core';
import type { CrossFileFailure, Ranking } from '@poe/core';
import { useCallback, useEffect, useMemo, useState, type JSX, type ReactNode } from 'react';

import { FailureScreen } from './frame/FailureScreen';
import { Frame } from './frame/Frame';
import { HeaderBar } from './frame/HeaderBar';
import { pendingControls, readyControls, useReportToggle, type ReadyControlsInput } from './frame/header-controls';
import { RowSlots } from './frame/RowSlots';
import { AskingPriceLine } from './list/AskingPriceLine';
import { forRecipe, type ListRecipe } from './list/active-ranking';
import { statTexts } from './list/combination-text';
import { toListBranches } from './list/display-rows';
import { KeyBlock } from './list/KeyBlock';
import { listStatement } from './list/list-statement';
import { ListStatement } from './list/ListStatement';
import { RankedList } from './list/RankedList';
import { RunningFoot } from './list/RunningFoot';
import { isBannerRaised, UniformPriorBanner } from './list/UniformPriorBanner';
import { UnrankableAppendix } from './list/UnrankableAppendix';
import type { ArtifactSet } from './load/artifacts';
import { loadArtifacts, type LoadOutcome } from './load/load-artifacts';
import { readStoredRecipe, writeStoredRecipe } from './recipe/recipe-storage';
import { expectedValueCost } from './recipe/recipe-view';
import type { ExpectedValueNote } from './list/ColumnHeader';
import { readStoredThreshold, writeStoredThreshold } from './threshold/threshold-storage';

type ReadyOutcome = Extract<LoadOutcome, { readonly kind: 'ready' }>;

/** A ready outcome holds the "now" its ages read against and the cross-file failures (AD-17). */
type ViewState =
  Exclude<LoadOutcome, ReadyOutcome> | (ReadyOutcome & { readonly now: number; readonly crossFileFailures: readonly CrossFileFailure[] }) | { readonly kind: 'pending' };

/** One transition from skeleton to one outcome, never row by row (AD-24, FR-33). */
export function App(): JSX.Element {
  const [view, retry] = useLoadedView();
  const [threshold, changeThreshold] = usePersistedThreshold();
  const [storedRecipe, changeRecipe] = usePersistedRecipe();
  const ranking = useRanking(view, threshold);
  const [isReportOpen, toggleReport] = useReportToggle();

  switch (view.kind) {
    case 'pending': {
      return renderPending({ threshold, onThresholdChange: changeThreshold });
    }
    case 'ready': {
      if (ranking === undefined) {
        throw new Error('a ready view always has a ranking');
      }
      return renderReady({
        view,
        ranking,
        threshold,
        storedRecipe,
        onThresholdChange: changeThreshold,
        onRecipeChange: changeRecipe,
        isReportOpen,
        onReportToggle: toggleReport,
      });
    }
    case 'refused': {
      return (
        <Frame state="refused">
          <FailureScreen
            variant="refused"
            path={view.path}
            cause={view.cause}
            declared={view.declared}
            expected={view.expected}
          />
        </Frame>
      );
    }
    case 'failed': {
      return (
        <Frame state="failed">
          <FailureScreen variant="failed" path={view.path} onRetry={retry} />
        </Frame>
      );
    }
  }
}

/** "Now" is read once, as the set resolves, and held: ages never tick. */
function resolveView(outcome: LoadOutcome): ViewState {
  return outcome.kind === 'ready'
    ? {
        ...outcome,
        now: Date.now(),
        crossFileFailures: crossFileChecks(outcome.set.tracked.entries, outcome.set.weights).failures,
      }
    : outcome;
}

function useLoadedView(): readonly [ViewState, () => void] {
  const [attempt, setAttempt] = useState(0);
  const [view, setView] = useState<ViewState>({ kind: 'pending' });

  useEffect(() => {
    let isLive = true;
    const controller = new AbortController();
    void loadArtifacts({ signal: controller.signal }).then((outcome) => {
      if (isLive) {
        setView(resolveView(outcome));
      }
    });
    return () => {
      isLive = false;
      controller.abort();
    };
  }, [attempt]);

  const retry = useCallback(() => {
    setView({ kind: 'pending' });
    setAttempt((count) => count + 1);
  }, []);
  return [view, retry];
}

/** The threshold survives a reload (FR-7): read once at mount, written on each change. */
function usePersistedThreshold(): readonly [number, (value: number) => void] {
  const [threshold, setThreshold] = useState(() => readStoredThreshold());
  const changeThreshold = useCallback((value: number) => {
    setThreshold(value);
    writeStoredThreshold(value);
  }, []);
  return [threshold, changeThreshold];
}

/** The active Craft Recipe survives a reload beside the threshold (EXPERIENCE.md). */
function usePersistedRecipe(): readonly [string | undefined, (recipeId: string) => void] {
  const [storedRecipe, setStoredRecipe] = useState(() => readStoredRecipe());
  const changeRecipe = useCallback((recipeId: string) => {
    setStoredRecipe(recipeId);
    writeStoredRecipe(recipeId);
  }, []);
  return [storedRecipe, changeRecipe];
}

/** `core` ranks every (Item Class, recipe) pair at once: a recipe switch re-filters only. */
function useRanking(view: ViewState, threshold: number): Ranking | undefined {
  const readySet = view.kind === 'ready' ? view.set : undefined;
  const readyFailures = view.kind === 'ready' ? view.crossFileFailures : undefined;
  const readyNow = view.kind === 'ready' ? view.now : undefined;
  return useMemo(
    () =>
      readySet === undefined || readyNow === undefined
        ? undefined
        : rank({
            now: new Date(readyNow).toISOString(),
            tracked: readySet.tracked.entries,
            dataset: readySet.dataset.entries,
            activeLeague: readySet.config.league,
            threshold,
            weights: readySet.weights,
            crossFileFailures: readyFailures,
            recipes: readySet.recipes?.recipes ?? [],
            currencyRates: readySet.dataset.currencyRates,
          }),
    [readySet, readyFailures, readyNow, threshold],
  );
}

/** A plain call, not a component: the frame and header bar keep their identity into ready. */
function renderPending({
  threshold,
  onThresholdChange,
}: {
  readonly threshold: number;
  readonly onThresholdChange: (value: number) => void;
}): JSX.Element {
  return (
    <Frame state="pending">
      <HeaderBar league={undefined} controls={pendingControls(threshold, onThresholdChange)} />
      <AskingPriceLine />
      <RowSlots />
      <PageTail />
    </Frame>
  );
}

function renderReady({
  view,
  ...rest
}: Omit<ReadyControlsInput, 'set' | 'absent' | 'now' | 'crossFileFailures'> & {
  readonly view: Extract<ViewState, { readonly kind: 'ready' }>;
}): JSX.Element {
  const { set } = view;
  const { controls, panel, active, cost } = readyControls({
    ...rest,
    set,
    absent: view.absent,
    now: view.now,
    crossFileFailures: view.crossFileFailures,
  });
  return (
    <Frame state="ready">
      <HeaderBar league={set.config.league} controls={controls} />
      {panel}
      <AskingPriceLine />
      <ReadyBody
        set={set}
        threshold={rest.threshold}
        ranking={rest.ranking}
        recipe={active}
        note={{ threshold: rest.threshold, cost: expectedValueCost(cost) }}
      />
    </Frame>
  );
}

/** `web` renders the one ranking and orders nothing (AD-4); a recipe click narrows it. */
function ReadyBody({
  set,
  threshold,
  ranking,
  recipe,
  note,
}: {
  readonly set: ArtifactSet;
  readonly threshold: number;
  readonly ranking: Ranking;
  /** The active Craft Recipe, or `undefined` when no recipe is loaded. */
  readonly recipe: ListRecipe | undefined;
  readonly note: ExpectedValueNote;
}): JSX.Element {
  // The catalogue's stat texts, for the Combination fallback: built once per load.
  const stats = useMemo(() => statTexts(set.catalogueStats), [set]);
  // The banner's dismissal lives in memory for the session only: a reload brings it back.
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const { branches, statement, unrankable, banner } = useMemo(() => {
    const active = forRecipe(ranking, recipe);
    return {
      branches: toListBranches(active, set.dataset.entries, { tracked: set.tracked.entries, stats }),
      statement: listStatement(active, threshold, set.config.league),
      unrankable: active.unrankable,
      banner: isBannerRaised(active),
    };
  }, [ranking, recipe, set, threshold, stats]);
  return (
    <>
      {banner && !bannerDismissed ? <UniformPriorBanner onDismiss={() => { setBannerDismissed(true); }} /> : undefined}
      <ListStatement statement={statement} />
      <RankedList
        branches={branches}
        activeLeague={set.config.league}
        note={note}
      />
      <PageTail appendix={<UnrankableAppendix classes={unrankable} />} />
    </>
  );
}

/** Pushed to the frame's foot by `margin-top: auto`; the appendix is ready only. */
function PageTail({ appendix }: { readonly appendix?: ReactNode }): JSX.Element {
  return (
    <div data-page-tail="" style={{ marginTop: 'auto' }}>
      {appendix}
      <KeyBlock />
      <RunningFoot />
    </div>
  );
}
