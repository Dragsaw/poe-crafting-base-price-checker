import type { JSX } from 'react';

import { MARK_COLORS } from '../../marks/marks';
import { JOINER } from '../../shared/text';
import type { TrustParts } from './trust-words';

interface TrustWordsProperties {
  readonly parts: TrustParts;
  readonly fontWeight?: number;
  /** An expansion line tags the word and the reason; the mark tooltip does not. */
  readonly isTagged?: boolean;
}

/** The verdict word in its mark colour, then ` · <reason>` (DESIGN.md `mark-tooltip`, `trust-mark.onLine`). */
export function TrustWords({ parts, fontWeight, isTagged = false }: TrustWordsProperties): JSX.Element {
  return (
    <>
      <span data-trust-word={isTagged ? '' : undefined} style={{ fontWeight, color: MARK_COLORS[parts.verdict] }}>
        {parts.word}
      </span>
      <span data-trust-reason={isTagged ? '' : undefined}>
        {JOINER}
        {parts.reason}
      </span>
    </>
  );
}
