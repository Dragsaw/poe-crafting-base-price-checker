import type { JSX } from 'react';

import { CraftRecipe, type RecipeCost, type RecipeOption } from '../recipe/CraftRecipe';
import { columnSums, layout, px } from '../theme/tokens';
import { PayoutThreshold } from '../threshold/PayoutThreshold';

/** The control group's width: 216 recipe + 16 gap + 276 threshold. */
export const CONTROL_GROUP_WIDTH = columnSums.interimControls.reduce((a, b) => a + b, 0);

/**
 * The current controls in a band under the header bar; it scrolls away. Story 4.5 moves them
 * into the bar's slots and deletes this band.
 */
export function InterimControls({
  threshold,
  onThresholdChange,
  recipe,
}: {
  readonly threshold: number;
  readonly onThresholdChange: (value: number) => void;
  /** The Craft Recipe control's inputs; absent while pending, or when `recipes.json` holds no recipe. */
  readonly recipe?: HeaderRecipe;
}): JSX.Element {
  return (
    <div
      data-interim-controls=""
      style={{ display: 'flex', justifyContent: 'flex-end', padding: `${px(layout.s4)} 0` }}
    >
      <div
        data-control-group=""
        style={{
          display: 'flex',
          alignItems: 'stretch',
          gap: px(layout.interimControlGap),
          width: px(CONTROL_GROUP_WIDTH),
          flex: '0 0 auto',
        }}
      >
        <RecipeSlot recipe={recipe} />
        <PayoutThreshold value={threshold} onChange={onThresholdChange} />
      </div>
    </div>
  );
}

/** The Craft Recipe's inboard slot: the control, or an empty slot of its width. */
function RecipeSlot({ recipe }: { readonly recipe: HeaderRecipe | undefined }): JSX.Element {
  return (
    <div
      data-recipe-slot=""
      aria-hidden={recipe === undefined ? 'true' : undefined}
      style={{ width: px(layout.recipePanelWidth), flex: '0 0 auto', display: 'flex' }}
    >
      {recipe === undefined ? undefined : (
        <CraftRecipe options={recipe.options} activeId={recipe.activeId} cost={recipe.cost} onChange={recipe.onChange} />
      )}
    </div>
  );
}

/** What the Craft Recipe control prints and calls. */
export interface HeaderRecipe {
  readonly options: readonly RecipeOption[];
  readonly activeId: string;
  readonly cost: RecipeCost;
  readonly onChange: (recipeId: string) => void;
}
