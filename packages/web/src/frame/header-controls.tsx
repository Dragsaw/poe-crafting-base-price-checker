import { canonicalKey } from '@poe/contracts';
import type { CrossFileFailure, Ranking } from '@poe/core';
import { useCallback, useState, type ReactNode } from 'react';

import type { ArtifactSet, TolerableKey } from '../load/artifacts';
import { CraftRecipe, type RecipeCost, type RecipeOption } from '../recipe/CraftRecipe';
import { activeRecipe } from '../recipe/recipe-storage';
import { recipeCostLine, recipeOptions } from '../recipe/recipe-view';
import { PayoutThreshold } from '../threshold/PayoutThreshold';
import type { HeaderSlot } from './HeaderBar';
import { SyncButton } from './SyncButton';
import { SyncReportPanel } from './SyncReportPanel';
import { panelColumns } from './panel-columns';
import { problemSummary } from './problem-summary';
import { syncButtonFace } from './sync-button-face';

/** The sync report starts closed on every load and never persists; opening it brings it into view (Interaction 5). */
export function useReportToggle(): readonly [boolean, () => void] {
  const [isOpen, setOpen] = useState(false);
  const toggle = useCallback(() => {
    if (!isOpen && globalThis.scrollY > 0) {
      globalThis.scrollTo(0, 0);
    }
    setOpen(!isOpen);
  }, [isOpen]);
  return [isOpen, toggle];
}

/** The threshold control alone: the one slot the cold load fills (state 22). */
export function pendingControls(threshold: number, onThresholdChange: (value: number) => void): Partial<Record<HeaderSlot, ReactNode>> {
  return { threshold: <PayoutThreshold value={threshold} onChange={onThresholdChange} /> };
}

export interface ReadyControlsInput {
  readonly set: ArtifactSet;
  readonly absent: readonly TolerableKey[];
  readonly now: number;
  readonly crossFileFailures: readonly CrossFileFailure[];
  readonly ranking: Ranking;
  readonly threshold: number;
  readonly storedRecipe: string | undefined;
  readonly onThresholdChange: (value: number) => void;
  readonly onRecipeChange: (recipeId: string) => void;
  readonly isReportOpen: boolean;
  readonly onReportToggle: () => void;
}

/** The header's three controls, the sync report under it, and the active recipe the list reads. */
export interface ReadyControls {
  readonly controls: Partial<Record<HeaderSlot, ReactNode>>;
  readonly panel: ReactNode;
  readonly active: RecipeOption | undefined;
  readonly cost: RecipeCost | undefined;
}

export function readyControls(input: ReadyControlsInput): ReadyControls {
  const { set } = input;
  const recipes = set.recipes?.recipes ?? [];
  const recipe = activeRecipe(recipes, input.storedRecipe);
  const options = recipeOptions(recipes);
  const cost =
    recipe === undefined
      ? undefined
      : recipeCostLine(
          recipe,
          set.dataset.currencyRates,
          set.config.league,
          input.ranking.uncostableRecipes.some((item) => item.recipeId === recipe.id),
        );
  const problems = problemSummary(set.dataset.entries, set.syncReport, {
    pinnedCount: set.tracked.entries.filter((entry) => entry.status === 'pinned').length,
    minChunkSearches: set.config.minChunkSearches,
    prunedKeys: new Set(set.tracked.entries.filter((entry) => entry.status === 'pruned').map((entry) => canonicalKey(entry))),
  });
  const panel = input.isReportOpen ? (
    <SyncReportPanel
      columns={panelColumns({
        report: set.syncReport,
        weights: set.weights,
        absent: input.absent,
        now: input.now,
        problems,
        crossFileFailures: input.crossFileFailures,
      })}
    />
  ) : undefined;
  return {
    controls: {
      ...pendingControls(input.threshold, input.onThresholdChange),
      recipe:
        recipe === undefined || cost === undefined ? undefined : (
          <CraftRecipe recipe={{ options, activeId: recipe.id, cost, onChange: input.onRecipeChange }} />
        ),
      sync: (
        <SyncButton
          face={syncButtonFace(problems, set.syncReport, input.now)}
          open={input.isReportOpen}
          onToggle={input.onReportToggle}
        />
      ),
    },
    panel,
    active: options.find((option) => option.id === recipe?.id),
    cost,
  };
}
