import '../shared/affordance.css';

import type { JSX } from 'react';

import type { RefusalCause } from '../load/load-artifacts';
import { colors, glyphs, px, spacing, typeStyle } from '../theme/tokens';

/** DESIGN.md `components.refusal-screen` / `components.fetch-failure-screen` copy. */
export const REFUSAL_EYEBROW = 'THE PAGE WILL NOT RENDER THIS';
export const REFUSAL_TITLE = 'A required file cannot be used.';
export const REFUSAL_RECOVERY =
  'The page renders again as soon as a valid set is published, and serves nothing old in the meantime.';
export const FETCH_FAILURE_EYEBROW = 'THE PAGE COULD NOT LOAD ITS DATA';
/**
 * No count, so a change to the AD-24 set needs no copy sweep; not "required",
 * because a tolerable file's 5xx shows this screen too (user decision
 * 2026-09-27). DESIGN.md `fetch-failure-screen.titleText` still reads
 * `A required file did not arrive.` until UX reconciles it (deferred-work.md).
 */
export const FETCH_FAILURE_TITLE = 'One of the data files did not arrive.';
export const FETCH_FAILURE_RECOVERY =
  'The page shows nothing rather than a partial set, because half a ranking is worse than no ranking.';
export const TRY_AGAIN = `${glyphs.open} Try again`;

/**
 * The fixed parts of the refusal body sentence, one per cause (DESIGN.md
 * `components.refusal-screen.bodyByCause`). Each follows "`<path>` × unresolvable.".
 */
export const REFUSAL_VERSION_DECLARES = 'It declares schema version';
export const REFUSAL_NO_VERSION_DECLARED = 'It declares no schema version';
export const REFUSAL_VERSION_EXPECTS = 'the page expects';
export const REFUSAL_CONTENT = 'Its content does not match the schema the page expects, version';
export const REFUSAL_MISSING = 'It was not published, and the page cannot render without it.';

export type FailureScreenProps =
  | {
      readonly variant: 'refused';
      readonly path: string;
      readonly cause: RefusalCause;
      /** The declared `schemaVersion`, or `null` where the file declares no string one. */
      readonly declared: string | null;
      readonly expected: string;
    }
  | { readonly variant: 'failed'; readonly path: string; readonly onRetry: () => void };

const bodyStyle = {
  ...typeStyle('failure-body'),
  color: colors['ink-secondary'],
  maxWidth: px(spacing.dekMaxWidth),
  margin: `${px(spacing.s4)} 0 0`,
};

/**
 * The refusal body sentence for one cause. A version fault names both
 * versions; a content fault names only the expected one, since the declared
 * version is not what is wrong; a missing file names neither.
 */
function RefusalCauseSentence({
  cause,
  declared,
  expected,
}: {
  readonly cause: RefusalCause;
  readonly declared: string | null;
  readonly expected: string;
}): JSX.Element {
  switch (cause) {
    case 'version': {
      return (
        <>
          {declared === null ? (
            REFUSAL_NO_VERSION_DECLARED
          ) : (
            <>
              {REFUSAL_VERSION_DECLARES} <span data-declared="">{declared}</span>
            </>
          )}
          ; {REFUSAL_VERSION_EXPECTS} <span data-expected="">{expected}</span>.
        </>
      );
    }
    case 'content': {
      return (
        <>
          {REFUSAL_CONTENT} <span data-expected="">{expected}</span>.
        </>
      );
    }
    case 'missing': {
      return <>{REFUSAL_MISSING}</>;
    }
  }
}

/**
 * The two full-page failure screens. Same shape, different fact. Each replaces
 * the whole page — no masthead, no list, nothing stale served. No card, no
 * icon, no illustration: the failure is set like the rest of the page.
 */
export function FailureScreen(properties: FailureScreenProps): JSX.Element {
  const refused = properties.variant === 'refused';
  return (
    <section data-failure={properties.variant} role="alert" style={{ paddingTop: px(spacing.gutter) }}>
      <div style={{ ...typeStyle('eyebrow'), color: colors.rust }}>
        {refused ? REFUSAL_EYEBROW : FETCH_FAILURE_EYEBROW}
      </div>
      <h1 style={{ ...typeStyle('masthead-title'), color: colors.ink, margin: `${px(spacing.s2)} 0 0` }}>
        {refused ? REFUSAL_TITLE : FETCH_FAILURE_TITLE}
      </h1>
      {properties.variant === 'refused' ? (
        <>
          <p style={bodyStyle}>
            <span data-artifact="" style={{ color: colors.ink }}>
              {properties.path}
            </span>{' '}
            <span style={{ ...typeStyle('row-mark'), fontSize: 'inherit', lineHeight: 'inherit', fontWeight: 700, color: colors.rust }}>
              {glyphs.unresolvable} unresolvable
            </span>
            . <RefusalCauseSentence cause={properties.cause} declared={properties.declared} expected={properties.expected} />
          </p>
          <p style={bodyStyle}>{REFUSAL_RECOVERY}</p>
        </>
      ) : (
        <>
          <p style={bodyStyle}>
            <span data-artifact="" style={{ color: colors.ink }}>
              {properties.path}
            </span>{' '}
            did not arrive.
          </p>
          <p style={bodyStyle}>{FETCH_FAILURE_RECOVERY}</p>
          <p style={{ margin: `${px(spacing.s4)} 0 0` }}>
            <button type="button" className="fg-affordance" style={typeStyle('expand-affordance')} onClick={properties.onRetry}>
              {TRY_AGAIN}
            </button>
          </p>
        </>
      )}
    </section>
  );
}
