import { crossFileChecks, rank } from '@poe/core';
import type { CrossFileFailure, Ranking } from '@poe/core';
import { useCallback, useEffect, useMemo, useState, type JSX, type ReactNode } from 'react';

import { FailureScreen } from './frame/FailureScreen';
import { Frame } from './frame/Frame';
import { Masthead } from './frame/Masthead';
import { RowSlots } from './frame/RowSlots';
import { TrustStrip, TrustStripSlot } from './frame/TrustStrip';
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
import { activeRecipe, readStoredRecipe, writeStoredRecipe } from './recipe/recipe-storage';
import { recipeCostLine, recipeOptions } from './recipe/recipe-view';
import { readStoredThreshold, writeStoredThreshold } from './threshold/threshold-storage';

type ReadyOutcome = Extract<LoadOutcome, { readonly kind: 'ready' }>;

/** A ready outcome holds the "now" its ages read against and its cross-file failures, both taken once per load (AD-17). */
type ViewState =
  Exclude<LoadOutcome, ReadyOutcome> | (ReadyOutcome & { readonly now: number; readonly crossFileFailures: readonly CrossFileFailure[] }) | { readonly kind: 'pending' };

/** One state transition from skeleton to a single outcome, never row by row (AD-24, FR-33); failure screens paint no chrome. */
export function App(): JSX.Element {
  const [view, retry] = useLoadedView();
  const [threshold, changeThreshold] = usePersistedThreshold();
  const [storedRecipe, changeRecipe] = usePersistedRecipe();
  const ranking = useRanking(view, threshold);

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

/** `core` ranks every (Item Class, recipe) pair at once, so a recipe switch re-filters and never re-ranks. */
function useRanking(view: ViewState, threshold: number): Ranking | undefined {
  const readySet = view.kind === 'ready' ? view.set : undefined;
  const readyFailures = view.kind === 'ready' ? view.crossFileFailures : undefined;
  return useMemo(
    () =>
      readySet === undefined
        ? undefined
        : rank({
            tracked: readySet.tracked.entries,
            dataset: readySet.dataset.entries,
            activeLeague: readySet.config.league,
            threshold,
            weights: readySet.weights,
            crossFileFailures: readyFailures,
            recipes: readySet.recipes?.recipes ?? [],
            currencyRates: readySet.dataset.currencyRates,
          }),
    [readySet, readyFailures, threshold],
  );
}

/** A plain call, not a component: the frame and masthead keep their identity across the move to ready. */
function renderPending({
  threshold,
  onThresholdChange,
}: {
  readonly threshold: number;
  readonly onThresholdChange: (value: number) => void;
}): JSX.Element {
  return (
    <Frame state="pending">
      <Masthead league={undefined} threshold={threshold} onThresholdChange={onThresholdChange} />
      <TrustStripSlot />
      <AskingPriceLine />
      <RowSlots />
      <PageTail />
    </Frame>
  );
}

function renderReady({
  view,
  ranking,
  threshold,
  storedRecipe,
  onThresholdChange,
  onRecipeChange,
}: {
  readonly view: Extract<ViewState, { readonly kind: 'ready' }>;
  readonly ranking: Ranking;
  readonly threshold: number;
  readonly storedRecipe: string | undefined;
  readonly onThresholdChange: (value: number) => void;
  readonly onRecipeChange: (recipeId: string) => void;
}): JSX.Element {
  const recipes = view.set.recipes?.recipes ?? [];
  const recipe = activeRecipe(recipes, storedRecipe);
  const options = recipeOptions(recipes);
  const active = options.find((option) => option.id === recipe?.id);
  return (
    <Frame state="ready">
      <Masthead
        league={view.set.config.league}
        threshold={threshold}
        onThresholdChange={onThresholdChange}
        recipe={
          recipe === undefined
            ? undefined
            : {
                options,
                activeId: recipe.id,
                cost: recipeCostLine(
                  recipe,
                  view.set.dataset.currencyRates,
                  view.set.config.league,
                  ranking.uncostableRecipes.some((item) => item.recipeId === recipe.id),
                ),
                onChange: onRecipeChange,
              }
        }
      />
      <TrustStrip set={view.set} absent={view.absent} now={view.now} crossFileFailures={view.crossFileFailures} />
      <AskingPriceLine />
      <ReadyBody set={view.set} now={view.now} threshold={threshold} ranking={ranking} recipe={active} />
    </Frame>
  );
}

/** `web` renders the one ranking and orders nothing (AD-4); a recipe click only narrows it, no re-rank (state 34). */
function ReadyBody({
  set,
  now,
  threshold,
  ranking,
  recipe,
}: {
  readonly set: ArtifactSet;
  readonly now: number;
  readonly threshold: number;
  readonly ranking: Ranking;
  /** The active Craft Recipe, or `undefined` when no recipe is loaded. */
  readonly recipe: ListRecipe | undefined;
}): JSX.Element {
  // The catalogue's stat texts, for the Combination fallback: built once per load.
  const stats = useMemo(() => statTexts(set.catalogueStats), [set]);
  // The banner's dismissal lives in memory for the session only: a reload brings it back.
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const { branches, statement, unrankable, banner } = useMemo(() => {
    const active = forRecipe(ranking, recipe);
    return {
      branches: toListBranches(active, set.dataset.entries, now, {
        tracked: set.tracked.entries,
        stats,
        activeLeague: set.config.league,
      }),
      statement: listStatement(active, threshold, set.config.league),
      unrankable: active.unrankable,
      banner: isBannerRaised(active),
    };
  }, [ranking, recipe, set, now, threshold, stats]);
  return (
    <>
      {banner && !bannerDismissed ? <UniformPriorBanner onDismiss={() => { setBannerDismissed(true); }} /> : undefined}
      <ListStatement statement={statement} />
      <RankedList
        branches={branches}
        threshold={threshold}
        activeLeague={set.config.league}
        recipeWord={recipe?.word}
      />
      <PageTail appendix={<UnrankableAppendix classes={unrankable} />} />
    </>
  );
}

/** Pushed to the frame's foot by `margin-top: auto`; the appendix is ready only, as no count is known while pending. */
function PageTail({ appendix }: { readonly appendix?: ReactNode }): JSX.Element {
  return (
    <div data-page-tail="" style={{ marginTop: 'auto' }}>
      {appendix}
      <KeyBlock />
      <RunningFoot />
    </div>
  );
}
