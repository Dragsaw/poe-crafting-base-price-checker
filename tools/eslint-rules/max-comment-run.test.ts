import { RuleTester } from 'eslint';
import { describe, expect, it } from 'vitest';

import plugin from './index';
import rule from './max-comment-run';

describe('local plugin', () => {
  it('registers the rule as local/max-comment-run', () => {
    expect(plugin.rules['max-comment-run']).toBe(rule);
  });
});

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const options = [{ maxLines: 3 }];
const tooLong = (line = 1) => ({ messageId: 'tooLong', data: { lines: 4, max: 3 }, line });

new RuleTester().run('max-comment-run', rule, {
  valid: [
    { name: 'a run at the limit', code: '// a\n// b\n// c\nconst x = 1;', options },
    { name: 'a block comment at the limit', code: '/**\n * a\n * b\n * c\n */\nconst x = 1;', options },
    { name: 'a one-line block comment', code: '/** a */\nconst x = 1;', options },
    { name: 'a blank line splits two runs', code: '// a\n// b\n// c\n\n// d\n// e\n// f\nconst x = 1;', options },
    { name: 'code splits two runs', code: '// a\n// b\n// c\nconst x = 1;\n// d\n// e\n// f\n', options },
    { name: 'trailing comments are not counted', code: 'const a = 1; // a\nconst b = 2; // b\nconst c = 3; // c\nconst d = 4; // d', options },
    {
      name: 'directives end a run and are not counted',
      code: '// a\n// b\n// c\n// eslint-disable-next-line no-console -- reason\nconsole.log(1);',
      options,
    },
    { name: 'the default limit is generous', code: '// a\n// b\n// c\n// d\n// e\n// f\nconst x = 1;' },
  ],
  invalid: [
    { name: 'one line over', code: '// a\n// b\n// c\n// d\nconst x = 1;', options, errors: [tooLong()] },
    { name: 'a long block comment', code: '/**\n * a\n * b\n * c\n * d\n */\nconst x = 1;', options, errors: [tooLong()] },
    {
      name: 'a block followed by line comments is one run',
      code: '/* a\n b */\n// c\n// d\nconst x = 1;',
      options,
      errors: [tooLong()],
    },
    {
      name: 'reports each long run at its own start',
      code: '// a\n// b\n// c\n// d\n\nconst x = 1;\n// e\n// f\n// g\n// h\n',
      options,
      errors: [tooLong(), tooLong(7)],
    },
    {
      name: 'the default limit applies without options',
      code: '// a\n// b\n// c\n// d\n// e\n// f\n// g\nconst x = 1;',
      errors: [{ messageId: 'tooLong', data: { lines: 7, max: 6 }, line: 1 }],
    },
  ],
});
