import './recipe.css';

import { Fragment, type JSX } from 'react';

import { DENOMINATION } from '../shared/product';
import { colors, px, spacing, typeStyle } from '../theme/tokens';

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

/**
 * `{components.craft-recipe}`: the page's second ranking dial (FR-26). It
 * takes `{components.payout-threshold}`'s chrome exactly. The words are the
 * control: no Mantine form control, no select, no pill. They are divided by
 * the trust strip's pipe, never the middle dot. Only the inactive word is a
 * target; a click on it makes it active at once, with no debounce (state 34).
 * The Craft Cost prints once beneath the options — the page's only printing
 * of it.
 */
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
        width: px(spacing.recipePanelWidth),
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        background: colors['paper-inset'],
        border: `${px(spacing.hairline)} solid ${colors['rule-hairline']}`,
        padding: `${px(spacing.controlPanelPadY)} ${px(spacing.controlPanelPadX)}`,
      }}
    >
      <div
        data-recipe-label=""
        style={{ ...typeStyle('recipe-label'), color: colors['ink-tertiary'], textTransform: 'uppercase' }}
      >
        {RECIPE_LABEL}
      </div>
      <div
        data-recipe-options=""
        role="group"
        aria-label={RECIPE_LABEL}
        style={{ ...typeStyle('recipe-option'), marginTop: px(spacing.recipeOptionsGap), whiteSpace: 'nowrap' }}
      >
        {options.map((option, index) => (
          <Fragment key={option.id}>
            {index > 0 ? (
              <span
                data-separator=""
                aria-hidden="true"
                style={{ color: colors['ink-tertiary'], fontWeight: 400, padding: `0 ${px(spacing.trustSeparatorPadX)}` }}
              >
                |
              </span>
            ) : null}
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
      <div
        data-recipe-cost={cost.kind}
        style={{ marginTop: 'auto', paddingTop: px(spacing.recipeCostGap) }}
      >
        {cost.kind === 'figure' ? (
          <span style={{ ...typeStyle('recipe-cost'), color: colors['ink-secondary'] }}>
            <span
              data-recipe-cost-figure=""
              style={{
                ...typeStyle('recipe-cost-figure'),
                color: colors.ink,
                fontVariantNumeric: 'tabular-nums',
                marginRight: px(spacing.recipeCostFigureGap),
              }}
            >
              {cost.text}
            </span>
            {RECIPE_COST_UNIT}
          </span>
        ) : (
          <span
            data-money-phrase=""
            style={{ ...typeStyle('money-phrase'), fontStyle: 'italic', color: colors.ink }}
          >
            {cost.text}
          </span>
        )}
      </div>
    </div>
  );
}
