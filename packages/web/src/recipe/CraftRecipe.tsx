import './recipe.css';

import { Fragment, type JSX } from 'react';

import { DENOMINATION } from '../shared/product';
import { colors, px, layout, typeStyle } from '../theme/tokens';

const RECIPE_LABEL = 'Craft Recipe';
/** The cost line's unit: *Divine* spelled, `/ craft` the one contraction the panel allows. */
const RECIPE_COST_UNIT = `${DENOMINATION} / craft`;

/** One option: the recipe's id and the one word `recipeWord` derives for it. */
export interface RecipeOption {
  readonly id: string;
  readonly word: string;
}

/** The cost line: the active recipe's Craft Cost at 2dp, or the money-slot phrase when it is uncostable. */
export type RecipeCost =
  | { readonly kind: 'figure'; readonly text: string }
  | { readonly kind: 'phrase'; readonly text: string };

/** `{components.craft-recipe}` (FR-26): the words are the control; the inactive one applies. */
export function CraftRecipe({
  options,
  activeId,
  cost,
  onChange,
}: {
  readonly options: readonly RecipeOption[];
  readonly activeId: string;
  readonly cost: RecipeCost;
  readonly onChange: (recipeId: string) => void;
}): JSX.Element {
  return (
    <div
      data-craft-recipe=""
      style={{
        width: px(layout.recipePanelWidth),
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        background: colors.surface,
        border: `${px(layout.hairline)} solid ${colors.line}`,
        padding: `${px(layout.controlPanelPadY)} ${px(layout.controlPanelPadX)}`,
      }}
    >
      <div
        data-recipe-label=""
        style={{ ...typeStyle('label'), color: colors['text-tertiary'], textTransform: 'uppercase' }}
      >
        {RECIPE_LABEL}
      </div>
      <RecipeOptions options={options} activeId={activeId} onChange={onChange} />
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
      style={{ ...typeStyle('control'), marginTop: px(layout.recipeOptionsGap), whiteSpace: 'nowrap' }}
    >
      {options.map((option, index) => (
        <Fragment key={option.id}>
          {index > 0 ? (
            <span
              data-separator=""
              aria-hidden="true"
              style={{ color: colors['text-tertiary'], fontWeight: 400, padding: `0 ${px(layout.trustSeparatorPadX)}` }}
            >
              |
            </span>
          ) : undefined}
          {option.id === activeId ? (
            <span data-recipe-option={option.id} data-active="" aria-current="true" className="fg-recipe-option">
              {option.word}
            </span>
          ) : (
            <button
              type="button"
              data-recipe-option={option.id}
              data-inactive=""
              className="fg-recipe-option"
              onClick={() => {
                onChange(option.id);
              }}
            >
              {option.word}
            </button>
          )}
        </Fragment>
      ))}
    </div>
  );
}

function RecipeCostLine({ cost }: { readonly cost: RecipeCost }): JSX.Element {
  return (
    <div
      data-recipe-cost={cost.kind}
      style={{ marginTop: 'auto', paddingTop: px(layout.recipeCostGap) }}
    >
      {cost.kind === 'figure' ? (
        <span style={{ ...typeStyle('craft-cost'), color: colors['text-secondary'] }}>
          <span
            data-recipe-cost-figure=""
            style={{
              ...typeStyle('craft-cost'),
              color: colors.text,
              fontVariantNumeric: 'tabular-nums',
              marginRight: px(layout.recipeCostFigureGap),
            }}
          >
            {cost.text}
          </span>
          {RECIPE_COST_UNIT}
        </span>
      ) : (
        <span
          data-money-phrase=""
          style={{ ...typeStyle('trust'), fontStyle: 'italic', color: colors.text }}
        >
          {cost.text}
        </span>
      )}
    </div>
  );
}
