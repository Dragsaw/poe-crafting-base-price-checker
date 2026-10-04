import type { JSX } from 'react';

import { CraftRecipe, type RecipeCost, type RecipeOption } from '../recipe/CraftRecipe';
import { DENOMINATION } from '../shared/product';
import { colors, columnSums, px, spacing, typeStyle } from '../theme/tokens';
import { PayoutThreshold } from '../threshold/PayoutThreshold';

/** The title is the DESIGN mockup string (`mockups/key-hero-resting.html`); the dek is EXPERIENCE.md's masthead copy. */
export const MASTHEAD_TITLE = 'What is worth picking up';
export const MASTHEAD_DEK = `Item Classes ranked by expected payout per craft, beside the Base Types worth selling raw. Every figure is in ${DENOMINATION}.`;

function eyebrowText(league: string): string {
  return `League ${league}`;
}

/** The right-hand control group's width: 216 recipe + 16 gap + 276 threshold. */
export const CONTROL_GROUP_WIDTH = columnSums.mastheadControls.reduce((a, b) => a + b, 0);

/** 170px: 34 pad + eyebrow 14 + 8 + title 44 + 8 + two-line dek 42 + 20 pad; the recipe slot stays empty at its width with no recipe. */
export function Masthead({
  league,
  threshold,
  onThresholdChange,
  recipe,
}: {
  readonly league: string | undefined;
  readonly threshold: number;
  readonly onThresholdChange: (value: number) => void;
  /** The Craft Recipe control's inputs; absent while pending, or when `recipes.json` holds no recipe. */
  readonly recipe?: MastheadRecipe;
}): JSX.Element {
  return (
    <header
      data-masthead=""
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        paddingTop: px(spacing.gutter),
        paddingBottom: px(spacing.s5),
        boxSizing: 'border-box',
        height: px(170),
      }}
    >
      <MastheadTitle league={league} />
      <div
        data-control-group=""
        style={{
          display: 'flex',
          alignItems: 'stretch',
          gap: px(spacing.mastheadControlGap),
          width: px(CONTROL_GROUP_WIDTH),
          flex: '0 0 auto',
        }}
      >
        <RecipeSlot recipe={recipe} />
        <PayoutThreshold value={threshold} onChange={onThresholdChange} />
      </div>
    </header>
  );
}

function MastheadTitle({ league }: { readonly league: string | undefined }): JSX.Element {
  return (
    <div style={{ maxWidth: px(spacing.dekMaxWidth) }}>
      <div style={{ ...typeStyle('eyebrow'), color: colors.sepia, textTransform: 'uppercase' }}>
        {league === undefined ? '\u{A0}' : eyebrowText(league)}
      </div>
      <h1 style={{ ...typeStyle('masthead-title'), color: colors.ink, margin: `${px(spacing.s2)} 0 0` }}>
        {MASTHEAD_TITLE}
      </h1>
      <p style={{ ...typeStyle('dek'), color: colors['ink-secondary'], margin: `${px(spacing.s2)} 0 0` }}>
        {MASTHEAD_DEK}
      </p>
    </div>
  );
}

/** The Craft Recipe's inboard slot: the control, or an empty slot of its width. */
function RecipeSlot({ recipe }: { readonly recipe: MastheadRecipe | undefined }): JSX.Element {
  return (
    <div
      data-recipe-slot=""
      aria-hidden={recipe === undefined ? 'true' : undefined}
      style={{ width: px(spacing.recipePanelWidth), flex: '0 0 auto', display: 'flex' }}
    >
      {recipe === undefined ? undefined : (
        <CraftRecipe options={recipe.options} activeId={recipe.activeId} cost={recipe.cost} onChange={recipe.onChange} />
      )}
    </div>
  );
}

/** What the masthead's Craft Recipe control prints and calls. */
export interface MastheadRecipe {
  readonly options: readonly RecipeOption[];
  readonly activeId: string;
  readonly cost: RecipeCost;
  readonly onChange: (recipeId: string) => void;
}
