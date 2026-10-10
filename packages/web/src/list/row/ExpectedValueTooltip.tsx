import type { JSX, ReactNode } from 'react';

import { EstimateMark, VerdictMark } from '../../marks/marks';
import { formatThreshold } from '../../shared/money';
import { DIV_UNIT } from '../../shared/product';
import { colors } from '../../theme/tokens';
import { JOINER } from '../../shared/text';

/** The active recipe's Craft Cost as the EV tooltip states it (EXPERIENCE.md Copy Deck, three variants). */
export type ExpectedValueCost =
  | { readonly kind: 'costed'; readonly text: string }
  | { readonly kind: 'uncostable' }
  | { readonly kind: 'no-recipe' };

/** EXPERIENCE.md Copy Deck, *EV tooltip*. */
export const EXPECTED_VALUE_TOOLTIP_COPY = {
  head: 'Expected value per craft.',
  what: 'What one craft on this item class returns on average, in Divine. It counts only outcomes worth at least',
  subtracts: 'and subtracts the',
  craftCost: 'craft cost.',
  uncostable: 'Craft cost is unknown for this recipe, so crafted rows have no figure yet.',
  noRecipe: 'No recipe is published, so crafted rows have no figure yet.',
  raw: "For a base you sell as is, it is that base's asking price. Every price is a live asking price, not a sale.",
  estimate: 'some roll odds are estimated',
  rough: 'unreliable price',
  pending: 'no price yet',
  broken: 'broken',
  hover: 'Hover a mark for the reason.',
} as const;

/** A decoded mark sits on the text baseline, in its own 1em box. */
const MARK_INLINE = { display: 'inline-flex', verticalAlign: '-0.125em' } as const;

function Figure({ children }: { readonly children: ReactNode }): JSX.Element {
  return <span style={{ fontWeight: 600 }}>{children}</span>;
}

/** ¶1's last sentence: the live threshold, then the Craft Cost or the variant's sentence. */
function CostSentence({ threshold, cost }: { readonly threshold: number; readonly cost: ExpectedValueCost }): JSX.Element {
  const atLeast = (
    <>
      {EXPECTED_VALUE_TOOLTIP_COPY.what} <Figure>{formatThreshold(threshold)}</Figure> {DIV_UNIT}
    </>
  );
  switch (cost.kind) {
    case 'costed': {
      return (
        <>
          {atLeast} {EXPECTED_VALUE_TOOLTIP_COPY.subtracts} <Figure>{cost.text}</Figure> {DIV_UNIT} {EXPECTED_VALUE_TOOLTIP_COPY.craftCost}
        </>
      );
    }
    case 'uncostable': {
      return (
        <>
          {atLeast}. {EXPECTED_VALUE_TOOLTIP_COPY.uncostable}
        </>
      );
    }
    case 'no-recipe': {
      return (
        <>
          {atLeast}. {EXPECTED_VALUE_TOOLTIP_COPY.noRecipe}
        </>
      );
    }
  }
}

/** One decoded mark in ¶3, in its own colour. */
function Decoded({ mark, words }: { readonly mark: ReactNode; readonly words: string }): JSX.Element {
  return (
    <>
      <span style={MARK_INLINE}>{mark}</span> {words}
    </>
  );
}

/** `{components.ev-tooltip}`: three paragraphs, the last in text-secondary decoding every mark. */
export function ExpectedValueTooltipLabel({ threshold, cost }: { readonly threshold: number; readonly cost: ExpectedValueCost }): JSX.Element {
  return (
    <div data-ev-tooltip={cost.kind}>
      <p style={{ margin: 0 }}>
        {EXPECTED_VALUE_TOOLTIP_COPY.head} <CostSentence threshold={threshold} cost={cost} />
      </p>
      <p style={{ margin: '6px 0 0' }}>{EXPECTED_VALUE_TOOLTIP_COPY.raw}</p>
      <p style={{ margin: '6px 0 0', color: colors['text-secondary'] }}>
        <Decoded mark={<EstimateMark />} words={EXPECTED_VALUE_TOOLTIP_COPY.estimate} />
        {JOINER}
        <Decoded mark={<VerdictMark verdict="rough" />} words={EXPECTED_VALUE_TOOLTIP_COPY.rough} />
        {JOINER}
        <Decoded mark={<VerdictMark verdict="pending" />} words={EXPECTED_VALUE_TOOLTIP_COPY.pending} />
        {JOINER}
        <Decoded mark={<VerdictMark verdict="broken" />} words={EXPECTED_VALUE_TOOLTIP_COPY.broken} />. {EXPECTED_VALUE_TOOLTIP_COPY.hover}
      </p>
    </div>
  );
}
