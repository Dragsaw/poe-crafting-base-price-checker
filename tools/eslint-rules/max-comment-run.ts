import type { Rule } from 'eslint';

/** Run by bare `node` (type stripping), so this module imports only types. */

export const DEFAULT_MAX_LINES = 6;

interface Options {
  readonly maxLines?: number;
}

type Location = NonNullable<Rule.Node['loc']>;

interface CommentLike {
  readonly value: string;
  readonly loc?: Location | null;
}

interface Run {
  readonly first: Location;
  readonly lines: number;
}

const DIRECTIVE = /^\s*(?:eslint(?:-[a-z-]+)?|globals?|exported)\b/;

/** Runs of comments on adjacent lines. Blank lines, code and directives end a run; trailing comments are skipped. */
function findRuns(comments: readonly CommentLike[], isOwnLine: (location: Location) => boolean): Run[] {
  const runs: Run[] = [];
  let first: Location | undefined;
  let endLine = 0;

  const flush = (): void => {
    if (first !== undefined) {
      runs.push({ first, lines: endLine - first.start.line + 1 });
    }
    first = undefined;
  };

  for (const { value, loc } of comments) {
    if (!loc || DIRECTIVE.test(value) || !isOwnLine(loc)) {
      flush();
      continue;
    }
    if (first !== undefined && loc.start.line > endLine + 1) {
      flush();
    }
    first ??= loc;
    endLine = loc.end.line;
  }
  flush();
  return runs;
}

const rule: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: { description: 'Limit how many consecutive lines a comment may span.' },
    schema: [
      {
        type: 'object',
        properties: { maxLines: { type: 'integer', minimum: 1 } },
        additionalProperties: false,
      },
    ],
    messages: {
      tooLong:
        'Comment spans {{lines}} consecutive lines; the limit is {{max}}. State only the non-obvious why and cite the owner document by id.',
    },
  },
  create(context) {
    const { maxLines = DEFAULT_MAX_LINES } = (context.options[0] ?? {}) as Options;
    const { sourceCode } = context;

    const isOwnLine = ({ start }: Location): boolean =>
      (sourceCode.lines[start.line - 1] ?? '').slice(0, start.column).trim() === '';

    return {
      'Program:exit'() {
        for (const { first, lines } of findRuns(sourceCode.getAllComments(), isOwnLine)) {
          if (lines > maxLines) {
            context.report({ loc: first, messageId: 'tooLong', data: { lines, max: maxLines } });
          }
        }
      },
    };
  },
};

export default rule;
