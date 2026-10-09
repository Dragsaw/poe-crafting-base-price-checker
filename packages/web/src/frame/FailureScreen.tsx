import '../shared/affordance.css';

import type { JSX } from 'react';

import type { RefusalCause } from '../load/load-artifacts';
import { colors, glyphs, px, layout, typeStyle } from '../theme/tokens';

/** DESIGN.md `components.refusal-screen` / `components.fetch-failure-screen` copy. */
export const REFUSAL_EYEBROW = 'THE PAGE WILL NOT RENDER THIS';
export const REFUSAL_TITLE = 'A required file cannot be used.';
export const REFUSAL_RECOVERY =
  'The page renders again as soon as a valid set is published, and serves nothing old in the meantime.';
export const FETCH_FAILURE_EYEBROW = 'THE PAGE COULD NOT LOAD ITS DATA';
// Not "required": a tolerable file's 5xx shows this screen too (user decision 2026-09-27).
// DESIGN.md `fetch-failure-screen.titleText` differs until UX reconciles it (deferred-work.md).
export const FETCH_FAILURE_TITLE = 'One of the data files did not arrive.';
const FETCH_FAILURE_RECOVERY =
  'The page shows nothing rather than a partial set, because half a ranking is worse than no ranking.';
export const TRY_AGAIN = `${glyphs.open} Try again`;

/** Fixed refusal body parts, one per cause (DESIGN.md `refusal-screen.bodyByCause`). */
export const REFUSAL_VERSION_DECLARES = 'It declares schema version';
export const REFUSAL_NO_VERSION_DECLARED = 'It declares no schema version';
export const REFUSAL_VERSION_EXPECTS = 'the page expects';
export const REFUSAL_CONTENT = 'Its content does not match the schema the page expects, version';
export const REFUSAL_MISSING = 'It was not published, and the page cannot render without it.';

export type FailureScreenProperties =
  | {
      readonly variant: 'refused';
      readonly path: string;
      readonly cause: RefusalCause;
      /** The declared `schemaVersion`, or `undefined` where the file declares no string one. */
      readonly declared: string | undefined;
      readonly expected: string;
    }
  | { readonly variant: 'failed'; readonly path: string; readonly onRetry: () => void };

const bodyStyle = {
  ...typeStyle('line-text'),
  color: colors['text-secondary'],
  maxWidth: px(layout.failureBodyMaxWidth),
  margin: `${px(layout.s4)} 0 0`,
};

// A content fault names only the expected version: the declared one is not what is wrong.
function RefusalCauseSentence({
  cause,
  declared,
  expected,
}: {
  readonly cause: RefusalCause;
  readonly declared: string | undefined;
  readonly expected: string;
}): JSX.Element {
  switch (cause) {
    case 'version': {
      return (
        <>
          {declared === undefined ? (
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

/** Each failure screen replaces the whole page: no header bar, no list, nothing stale served. */
export function FailureScreen(properties: FailureScreenProperties): JSX.Element {
  const isRefused = properties.variant === 'refused';
  return (
    <section data-failure={properties.variant} role="alert" style={{ paddingTop: px(layout.gutter) }}>
      <div style={{ ...typeStyle('eyebrow'), color: colors['trust-broken'] }}>
        {isRefused ? REFUSAL_EYEBROW : FETCH_FAILURE_EYEBROW}
      </div>
      <h1 style={{ ...typeStyle('title'), color: colors.text, margin: `${px(layout.s2)} 0 0` }}>
        {isRefused ? REFUSAL_TITLE : FETCH_FAILURE_TITLE}
      </h1>
      {properties.variant === 'refused' ? (
        <>
          <p style={bodyStyle}>
            <span data-artifact="" style={{ color: colors.text }}>
              {properties.path}
            </span>{' '}
            <span style={{ ...typeStyle('mark'), fontSize: 'inherit', lineHeight: 'inherit', fontWeight: 700, color: colors['trust-broken'] }}>
              {glyphs.unresolvable} unresolvable
            </span>
            . <RefusalCauseSentence cause={properties.cause} declared={properties.declared} expected={properties.expected} />
          </p>
          <p style={bodyStyle}>{REFUSAL_RECOVERY}</p>
        </>
      ) : (
        <>
          <p style={bodyStyle}>
            <span data-artifact="" style={{ color: colors.text }}>
              {properties.path}
            </span>{' '}
            did not arrive.
          </p>
          <p style={bodyStyle}>{FETCH_FAILURE_RECOVERY}</p>
          <p style={{ margin: `${px(layout.s4)} 0 0` }}>
            <button type="button" className="fg-affordance" style={typeStyle('trust')} onClick={properties.onRetry}>
              {TRY_AGAIN}
            </button>
          </p>
        </>
      )}
    </section>
  );
}
