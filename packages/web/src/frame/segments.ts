import { UNKNOWN } from './trust-copy';

/** The mark a problem line leads with: ✕ broken or ◐ rough. */
export type ProblemMark = 'broken' | 'rough';

/** A run of panel prose; `verbatim` is the file's register (the cross-file diagnosis). */
export type Segment =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'figure'; readonly text: string }
  | { readonly kind: 'missing'; readonly text: string }
  | { readonly kind: 'verbatim'; readonly text: string }
  | { readonly kind: 'mark'; readonly mark: ProblemMark; readonly text: string };

/** One line of segments. */
export type FigureLine = readonly Segment[];

/** One figure group: one or more lines. */
export type FigureGroup = readonly FigureLine[];

export const text = (value: string): Segment => ({ kind: 'text', text: value });
export const count = (value: number): string => value.toLocaleString('en-US');
export const figure = (value: number | string): Segment => ({
  kind: 'figure',
  text: typeof value === 'number' ? count(value) : value,
});
export const missing = (value: string): Segment => ({ kind: 'missing', text: value });
export const valueOrUnknown = (value: string | undefined): Segment => (value === undefined ? missing(UNKNOWN) : figure(value));

/** The mark's text twin is empty: the drawing carries it, and `lineText` stays readable. */
export const mark = (problem: ProblemMark): Segment => ({ kind: 'mark', mark: problem, text: '' });

/** A line as plain text, marks dropped. */
function lineText(line: FigureLine): string {
  return line.map((segment) => segment.text).join('').trim();
}

/** A group as plain text, for tests and for reading. */
export function groupText(group: FigureGroup): string {
  return group.map((line) => lineText(line)).join('\n');
}
