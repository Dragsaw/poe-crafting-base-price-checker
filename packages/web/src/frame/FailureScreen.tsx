import type { CSSProperties, JSX } from 'react';

import type { RefusalCause } from '../load/load-artifacts';
import { VerdictMark } from '../marks/marks';
import { ShowMore } from '../shared/ShowMore';
import { colors, failureScreen, glyphs, layout, px, typeStyle } from '../theme/tokens';

/** EXPERIENCE.md Copy Deck, *Appendix and failure screens*; the eyebrows are set uppercase by CSS. */
export const REFUSAL_EYEBROW = 'The page will not render this';
export const REFUSAL_TITLE = 'A required file cannot be used.';
export const REFUSAL_RECOVERY =
  'The page renders again as soon as a valid set is published, and serves nothing old in the meantime.';
export const FETCH_FAILURE_EYEBROW = 'The page could not load its data';
// Not "required": a tolerable file's 5xx shows this screen too (user decision 2026-09-27).
export const FETCH_FAILURE_TITLE = 'One of the data files did not arrive.';
export const FETCH_FAILURE_RECOVERY =
  'The page shows nothing rather than a partial set, because half a ranking is worse than no ranking.';
export const TRY_AGAIN = `${glyphs.open} Try again`;

/** A body sentence: plain text, or a value the screen tags so a reader can find it. */
export type BodyPart = string | { readonly field: 'artifact' | 'declared' | 'expected'; readonly text: string };

/** The fixed text of the refusal sentences (Copy Deck, *Refusal body, by cause*), between the file and the versions. */
export const REFUSAL_FRAGMENTS = {
  declares: ' declares schema version ',
  expects: '; the page expects ',
  noVersion: ' declares no schema version; the page expects ',
  content: ' does not match the schema the page expects, version ',
  missing: ' was not published, and the page cannot render without it.',
  end: '.',
} as const;

/** The refusal's per-cause sentence (state 26): it names the file and why. */
function refusalSentence(
  cause: RefusalCause,
  path: string,
  declared: string | undefined,
  expected: string,
): readonly BodyPart[] {
  const file = { field: 'artifact', text: path } as const;
  const version = { field: 'expected', text: expected } as const;
  switch (cause) {
    case 'version': {
      return declared === undefined
        ? [file, REFUSAL_FRAGMENTS.noVersion, version, REFUSAL_FRAGMENTS.end]
        : [file, REFUSAL_FRAGMENTS.declares, { field: 'declared', text: declared }, REFUSAL_FRAGMENTS.expects, version, REFUSAL_FRAGMENTS.end];
    }
    case 'content': {
      return [file, REFUSAL_FRAGMENTS.content, version, REFUSAL_FRAGMENTS.end];
    }
    case 'missing': {
      return [file, REFUSAL_FRAGMENTS.missing];
    }
  }
}

/** The fetch failure's sentence (state 28). */
export function fetchFailureSentence(path: string): readonly BodyPart[] {
  return [{ field: 'artifact', text: path }, ' did not arrive.'];
}

/** The plain text of a sentence. */
export function sentenceText(parts: readonly BodyPart[]): string {
  return parts.map((part) => (typeof part === 'string' ? part : part.text)).join('');
}

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

const bodyStyle: CSSProperties = {
  ...typeStyle('line-text'),
  color: colors['text-secondary'],
  maxWidth: px(failureScreen.bodyMaxWidth),
  margin: `${px(layout.s4)} 0 0`,
};

function Sentence({ parts }: { readonly parts: readonly BodyPart[] }): JSX.Element {
  return (
    <p data-failure-sentence="" style={bodyStyle}>
      {parts.map((part, index) =>
        typeof part === 'string' ? (
          part
        ) : (
          <span key={`${part.field}${String(index)}`} data-part={part.field}>
            {part.text}
          </span>
        ),
      )}
    </p>
  );
}

/** `{components.failure-screen}`: replaces the whole page, with no header bar, list or legend (FR-33, NFR-8). */
export function FailureScreen(properties: FailureScreenProperties): JSX.Element {
  const isRefused = properties.variant === 'refused';
  return (
    <section data-failure={properties.variant} role="alert" style={{ paddingTop: px(failureScreen.paddingTop) }}>
      <div
        data-failure-eyebrow=""
        style={{
          ...typeStyle('eyebrow'),
          display: 'flex',
          alignItems: 'center',
          gap: '0.3em',
          textTransform: 'uppercase',
          color: colors['trust-broken'],
        }}
      >
        <VerdictMark verdict="broken" />
        {isRefused ? REFUSAL_EYEBROW : FETCH_FAILURE_EYEBROW}
      </div>
      <h1 style={{ ...typeStyle('title'), color: colors.text, margin: `${px(layout.s2)} 0 0` }}>
        {isRefused ? REFUSAL_TITLE : FETCH_FAILURE_TITLE}
      </h1>
      {properties.variant === 'refused' ? (
        <>
          <Sentence
            parts={refusalSentence(properties.cause, properties.path, properties.declared, properties.expected)}
          />
          <p style={bodyStyle}>{REFUSAL_RECOVERY}</p>
        </>
      ) : (
        <>
          <Sentence parts={fetchFailureSentence(properties.path)} />
          <p style={bodyStyle}>{FETCH_FAILURE_RECOVERY}</p>
          <ShowMore name="retry" onToggle={properties.onRetry}>
            {TRY_AGAIN}
          </ShowMore>
        </>
      )}
    </section>
  );
}
