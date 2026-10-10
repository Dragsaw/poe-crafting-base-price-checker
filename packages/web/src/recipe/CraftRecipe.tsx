import './recipe.css';

import type { JSX } from 'react';

import { DIV_UNIT } from '../shared/product';
import { colors, headerControls, px, rounded, typeStyle } from '../theme/tokens';

/** EXPERIENCE.md, Copy Deck: *Recipe* and *Craft Cost*. */
export const RECIPE_LABEL = 'Recipe';
export const RECIPE_COST_UNIT = `${DIV_UNIT} / craft`;

/** `{components.recipe-toggle}.segment`: its padding and radius. */
const SEGMENT_BOX = {
  padding: `${px(headerControls.segmentPadY)} ${px(headerControls.segmentPadX)}`,
  borderRadius: rounded.segment,
} as const;

/** One option: the recipe's id and the one word `recipeWord` derives for it. */
export interface RecipeOption {
  readonly id: string;
  readonly word: string;
}

/** The cost line: the active recipe's Craft Cost at 2dp, or the uncostable phrase. */
export type RecipeCost =
  | { readonly kind: 'figure'; readonly text: string }
  | { readonly kind: 'phrase'; readonly text: string };

/** What the recipe toggle prints and calls. */
export interface HeaderRecipe {
  readonly options: readonly RecipeOption[];
  readonly activeId: string;
  readonly cost: RecipeCost;
  readonly onChange: (recipeId: string) => void;
}

/** `{components.recipe-toggle}` (FR-26): a segmented toggle, or one plain word when one recipe is published (state 42). */
export function CraftRecipe({ recipe }: { readonly recipe: HeaderRecipe }): JSX.Element {
  const { options, activeId, cost, onChange } = recipe;
  const only = options.length === 1 ? options[0] : undefined;
  return (
    <div data-craft-recipe="" style={{ display: 'flex', alignItems: 'center', gap: px(headerControls.labelGap) }}>
      <span data-recipe-label="" style={{ ...typeStyle('label'), color: colors['text-secondary'] }}>
        {RECIPE_LABEL}
      </span>
      {only === undefined ? (
        <RecipeOptions options={options} activeId={activeId} onChange={onChange} />
      ) : (
        <span data-recipe-word="" style={{ ...typeStyle('control'), color: colors.text }}>
          {only.word}
        </span>
      )}
      <RecipeCostLine cost={cost} />
    </div>
  );
}

function RecipeOptions({
  options,
  activeId,
  onChange,
}: {
  readonly options: readonly RecipeOption[];
  readonly activeId: string;
  readonly onChange: (recipeId: string) => void;
}): JSX.Element {
  return (
    <div
      data-recipe-options=""
      role="group"
      aria-label={RECIPE_LABEL}
      style={{
        ...typeStyle('control'),
        display: 'inline-flex',
        background: colors.surface,
        border: `1px solid ${colors['line-strong']}`,
        borderRadius: rounded.control,
        padding: px(headerControls.framePadding),
      }}
    >
      {options.map((option) =>
        option.id === activeId ? (
          <span key={option.id} data-recipe-option={option.id} data-active="" aria-current="true" className="fg-recipe-segment" style={{ ...SEGMENT_BOX, fontWeight: 600 }}>
            {option.word}
          </span>
        ) : (
          <button
            key={option.id}
            type="button"
            data-recipe-option={option.id}
            data-inactive=""
            className="fg-recipe-segment"
            style={SEGMENT_BOX}
            onClick={() => {
              onChange(option.id);
            }}
          >
            {option.word}
          </button>
        ),
      )}
    </div>
  );
}

function RecipeCostLine({ cost }: { readonly cost: RecipeCost }): JSX.Element {
  return (
    <span
      data-recipe-cost={cost.kind}
      style={{ ...typeStyle('craft-cost'), color: colors['text-secondary'], fontVariantNumeric: 'tabular-nums' }}
    >
      {cost.kind === 'figure' ? (
        <>
          <span data-recipe-cost-figure="">{cost.text}</span> {RECIPE_COST_UNIT}
        </>
      ) : (
        cost.text
      )}
    </span>
  );
}
