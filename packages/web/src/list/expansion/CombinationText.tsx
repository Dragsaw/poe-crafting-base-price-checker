import { Fragment, type JSX } from 'react';

import { stacks, typeStyle } from '../../theme/tokens';
import { AFFIX_JOIN, type AffixPart } from '../combination-text';

/** The Accepted Tier that opens a curated affix: `T1`, or a mixture such as `T1–T2`. */
const TIER = /^T\d+(?:[–-]T\d+)?(?= )/u;

/** The tier and joiner colours (DESIGN.md `expansion-line.combination`, `chase-cell`). */
export interface CombinationTones {
  readonly tier: string;
  readonly joiner: string;
}

function Affix({ text, tones }: { readonly text: string; readonly tones: CombinationTones | undefined }): JSX.Element {
  const tier = tones === undefined ? undefined : TIER.exec(text)?.[0];
  return tier === undefined || tones === undefined ? (
    <span data-affix="">{text}</span>
  ) : (
    <span data-affix="">
      <span data-tier="" style={{ ...typeStyle('tier'), color: tones.tier }}>
        {tier}
      </span>
      {text.slice(tier.length)}
    </span>
  );
}

/** A fallback affix is set in the mono verbatim register only: no colour, mark or glyph. */
export function CombinationText({
  parts,
  tones,
}: {
  readonly parts: readonly AffixPart[];
  /** Unset, the tier and joiner take the host's colour and type. */
  readonly tones?: CombinationTones;
}): JSX.Element {
  return (
    <>
      {parts.map((part, index) => (
        <Fragment key={index}>
          {index === 0 ? undefined : (
            <span data-joiner="" style={tones === undefined ? undefined : { color: tones.joiner }}>
              {AFFIX_JOIN}
            </span>
          )}
          {part.verbatim ? (
            <span data-verbatim="" style={{ fontFamily: stacks.mono }}>
              {part.text}
            </span>
          ) : (
            <Affix text={part.text} tones={tones} />
          )}
        </Fragment>
      ))}
    </>
  );
}
