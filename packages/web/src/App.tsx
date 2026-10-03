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
import { bannerRaised, UniformPriorBanner } from './list/UniformPriorBanner';
import { UnrankableAppendix } from './list/UnrankableAppendix';
import type { ArtifactSet } from './load/artifacts';
import { loadArtifacts, type LoadOutcome } from './load/load-artifacts';
import { activeRecipe, readStoredRecipe, writeStoredRecipe } from './recipe/recipe-storage';
import { recipeCostLine, recipeOptions } from './recipe/recipe-view';
import { readStoredThreshold, writeStoredThreshold } from './threshold/threshold-storage';

type ReadyOutcome = Extract<LoadOutcome, { readonly kind: 'ready' }>;

/**
 * A ready outcome carries the "now" its ages are read against, taken once when
 * the load resolved, and the cross-file failures, run once per load (AD-17).
 */
type ViewState =
  | { readonly kind: 'pending' }
  | Exclude<LoadOutcome, ReadyOutcome>
  | (ReadyOutcome & { readonly now: number; readonly crossFileFailures: readonly CrossFileFailure[] });

/**
 * The page's substrate. It paints the masthead and twenty skeleton slots at
 * once, then moves to exactly one outcome in a single state transition — a
 * whole set, the refusal screen or the fetch-failure screen — never row by row
 * (AD-24, FR-33). `+ Try again` re-runs all seven fetches.
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
        setView(
          outcome.kind === 'ready'
            ? {
                ...outcome,
                now: Date.now(),
                crossFileFailures: crossFileChecks(outcome.set.tracked.entries, outcome.set.weights).failures,
              }
            : outcome,
        );
      }
    });
    return () => {
      live = false;
      controller.abort();
    };
  }, [attempt]);

  // The threshold survives a reload (FR-7): read once at mount, written on each change.
  const [threshold, setThreshold] = useState(() => readStoredThreshold());
  const changeThreshold = useCallback((value: number) => {
    setThreshold(value);
    writeStoredThreshold(value);
  }, []);

  // The active Craft Recipe survives a reload beside the threshold (EXPERIENCE.md): read once, written on each click.
  const [storedRecipe, setStoredRecipe] = useState(() => readStoredRecipe());
  const changeRecipe = useCallback((recipeId: string) => {
    setStoredRecipe(recipeId);
    writeStoredRecipe(recipeId);
  }, []);

  // `core` ranks every (Item Class, recipe) pair at once, so a recipe switch re-filters and never re-ranks.
  const readySet = view.kind === 'ready' ? view.set : undefined;
  const readyFailures = view.kind === 'ready' ? view.crossFileFailures : undefined;
  const ranking = useMemo(
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
    case 'ready': {
      if (ranking === undefined) {
        throw new Error('a ready view always has a ranking');
      }
      const recipes = view.set.recipes?.recipes ?? [];
      const recipe = activeRecipe(recipes, storedRecipe);
      const options = recipeOptions(recipes);
      const active = options.find((option) => option.id === recipe?.id);
      return (
        <Frame state="ready">
          <Masthead
            league={view.set.config.league}
            threshold={threshold}
            onThresholdChange={changeThreshold}
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
                    onChange: changeRecipe,
                  }
            }
          />
          <TrustStrip set={view.set} absent={view.absent} now={view.now} crossFileFailures={view.crossFileFailures} />
          <AskingPriceLine />
          <ReadyBody
            set={view.set}
            now={view.now}
            threshold={threshold}
            ranking={ranking}
            recipe={active}
          />
        </Frame>
      );
    }
    case 'refused':
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
    case 'failed':
      return (
        <Frame state="failed">
          <FailureScreen variant="failed" path={view.path} onRetry={retry} />
        </Frame>
      );
  }
}

/**
 * `core` ranks the whole loaded set at the player's threshold, with the
 * load's cross-file failures excluding their classes (AD-17); `web` renders
 * what it returns and orders nothing itself (AD-4). The ranking is memoised
 * on the set and the threshold; the active recipe only narrows it, so a click
 * re-renders in the same pass with no re-rank (state 34). Renders the ready body below the asking-price
 * line: the list statement, the ranked list, and the page tail led by the
 * Unrankable appendix — all from one ranking.
 */
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
      banner: bannerRaised(active),
    };
  }, [ranking, recipe, set, now, threshold, stats]);
  return (
    <>
      {banner && !bannerDismissed ? <UniformPriorBanner onDismiss={() => { setBannerDismissed(true); }} /> : null}
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
