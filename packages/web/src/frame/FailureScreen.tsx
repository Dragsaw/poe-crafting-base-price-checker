import './frame.css';

import type { JSX } from 'react';

import { colors, glyphs, px, spacing, typeStyle } from '../theme/tokens';

/** DESIGN.md `components.refusal-screen` / `components.fetch-failure-screen` copy. */
export const REFUSAL_EYEBROW = 'THE PAGE WILL NOT RENDER THIS';
export const REFUSAL_TITLE = 'A published file does not match its schema.';
export const REFUSAL_RECOVERY =
  'The page renders again as soon as a valid set is published, and serves nothing old in the meantime.';
export const FETCH_FAILURE_EYEBROW = 'THE PAGE COULD NOT LOAD ITS DATA';
export const FETCH_FAILURE_TITLE = 'One of the eight files did not arrive.';
export const FETCH_FAILURE_RECOVERY =
  'The page shows nothing rather than a partial set, because half a ranking is worse than no ranking.';
export const TRY_AGAIN = `${glyphs.open} Try again`;

export type FailureScreenProps =
  | { readonly variant: 'refused'; readonly path: string; readonly declared: string; readonly expected: string }
  | { readonly variant: 'failed'; readonly path: string; readonly onRetry: () => void };

const bodyStyle = {
  ...typeStyle('failure-body'),
  color: colors['ink-secondary'],
  maxWidth: px(spacing.dekMaxWidth),
  margin: `${px(spacing.s4)} 0 0`,
};

/**
 * The two full-page failure screens. Same shape, different fact. Each replaces
 * the whole page — no masthead, no list, nothing stale served. No card, no
 * icon, no illustration: the failure is set like the rest of the page.
 */
export function FailureScreen(props: FailureScreenProps): JSX.Element {
  const refused = props.variant === 'refused';
  return (
    <section data-failure={props.variant} role="alert" style={{ paddingTop: px(spacing.gutter) }}>
      <div style={{ ...typeStyle('eyebrow'), color: colors.rust }}>
        {refused ? REFUSAL_EYEBROW : FETCH_FAILURE_EYEBROW}
      </div>
      <h1 style={{ ...typeStyle('masthead-title'), color: colors.ink, margin: `${px(spacing.s2)} 0 0` }}>
        {refused ? REFUSAL_TITLE : FETCH_FAILURE_TITLE}
      </h1>
      {props.variant === 'refused' ? (
        <>
          <p style={bodyStyle}>
            <span data-artifact="" style={{ color: colors.ink }}>
              {props.path}
            </span>{' '}
            <span style={{ ...typeStyle('row-mark'), fontSize: 'inherit', lineHeight: 'inherit', fontWeight: 700, color: colors.rust }}>
              {glyphs.unresolvable} unresolvable
            </span>
            . It declares schema version <span data-declared="">{props.declared}</span>; the page expects{' '}
            <span data-expected="">{props.expected}</span>.
          </p>
          <p style={bodyStyle}>{REFUSAL_RECOVERY}</p>
        </>
      ) : (
        <>
          <p style={bodyStyle}>
            <span data-artifact="" style={{ color: colors.ink }}>
              {props.path}
            </span>{' '}
            did not arrive.
          </p>
          <p style={bodyStyle}>{FETCH_FAILURE_RECOVERY}</p>
          <p style={{ margin: `${px(spacing.s4)} 0 0` }}>
            <button type="button" className="fg-affordance" style={typeStyle('expand-affordance')} onClick={props.onRetry}>
              {TRY_AGAIN}
            </button>
          </p>
        </>
      )}
    </section>
  );
}
