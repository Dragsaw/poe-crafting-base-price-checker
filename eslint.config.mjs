import comments from '@eslint-community/eslint-plugin-eslint-comments/configs';
import js from '@eslint/js';
import vitest from '@vitest/eslint-plugin';
import sonarjs from 'eslint-plugin-sonarjs';
import unicorn from 'eslint-plugin-unicorn';
import tseslint from 'typescript-eslint';

/**
 * ESM, not TypeScript: ESLint 10 needs `jiti` to load a `.ts` config, and `.mjs`
 * removes that dependency entirely.
 *
 * The `files` glob has to cover everything `eslint .` should judge. A file that
 * matches no config block is reported as "ignored because no matching
 * configuration was supplied" and passes silently, which makes
 * `--max-warnings=0` vacuous for it — so the root configs, `test/**` and
 * `tools/**` are all named here, not just `packages/**`.
 */

/** Each message names AD-1 and says where the value comes from instead. */
const pure = (what) => `AD-1: core does not ${what}. The caller passes the value in.`;
const viaPort = (what) => `AD-1: core does not ${what}. \`sync\` or \`web\` does it through a port.`;

const IO = viaPort('perform I/O');
const CLOCK = pure('read the clock');
const RANDOM = pure('generate randomness');
const ENV = pure('read environment or config');

/**
 * AD-1: no `core` module performs I/O, reads the clock, generates randomness,
 * or reads environment or config. dependency-cruiser sees imports only, so a
 * `Date.now()` or `fetch(...)` in `core` would otherwise pass `pnpm check`.
 * These bans, applied by the `core` block below, make that purity checkable
 * through globals.
 */
const coreRestrictedGlobals = [
  ...[
    'fetch',
    'XMLHttpRequest',
    'WebSocket',
    'EventSource',
    'navigator',
    'localStorage',
    'sessionStorage',
    'indexedDB',
    'document',
    'location',
    'caches',
  ].map((name) => ({ name, message: IO })),
  // Banned whole: otherwise `globalThis.fetch` or `globalThis['Date'].now()`
  // bypasses the name bans. `core` has no use for any of them.
  ...['window', 'globalThis', 'self', 'global'].map((name) => ({ name, message: viaPort('reach the global object') })),
  { name: 'process', message: ENV },
  { name: 'crypto', message: RANDOM },
  { name: 'performance', message: CLOCK },
];

/** Test code is exempt from the function, nesting and statement size rules. */
const TEST_FILES = ['**/*.test.{ts,tsx,mts,cts,mjs}', 'test/**'];

const sizeLimits = { skipBlankLines: true, skipComments: true };

export default tseslint.config(
  {
    // An unused `eslint-disable` is a finding, so a suppression cannot outlive
    // the code it excused.
    linterOptions: { reportUnusedDisableDirectives: 'error' },
  },
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      // The boundary fixtures hold deliberate violations and are never linted,
      // typechecked or cruised by the shipped config.
      'tools/boundary-check/fixture/**',
      'docs/**',
      'data/**',
      '_bmad/**',
      // Everything under `.claude/` except the tracked-json skill's scripts,
      // which are code that `pnpm check` judges. A negation cannot reach inside
      // an ignored directory, so each level ignores its children with `*` and
      // un-ignores the one directory on the path.
      '.claude/*',
      '!.claude/skills/',
      '.claude/skills/*',
      '!.claude/skills/tracked-json/',
      '.claude/skills/tracked-json/*',
      '!.claude/skills/tracked-json/scripts/',
      '.serena/**',
      '.impeccable/**',
    ],
  },
  {
    files: [
      'packages/**/*.{ts,tsx,mts,cts}',
      'test/**/*.ts',
      'tools/**/*.ts',
      '.claude/skills/tracked-json/scripts/*.ts',
      '*.{ts,mts,cts,mjs}',
      'tools/**/*.mjs',
      // Leading-dot filenames are not matched by a `*` glob.
      '.dependency-cruiser.mjs',
      // A node script with no extension, so no glob by extension reaches it.
      '.githooks/commit-msg',
    ],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      sonarjs.configs.recommended,
      unicorn.configs.recommended,
      comments.recommended,
    ],
    rules: {
      // Size and complexity.
      'max-lines': ['error', { max: 300, ...sizeLimits }],
      'max-lines-per-function': ['error', { max: 60, ...sizeLimits }],
      complexity: ['error', 10],
      'sonarjs/cognitive-complexity': ['error', 15],
      'max-depth': ['error', 3],
      'max-params': ['error', 4],
      'max-nested-callbacks': ['error', 3],
      'max-statements': ['error', 30],
      'max-classes-per-file': ['error', 1],

      // Type escapes.
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/consistent-type-assertions': [
        'error',
        { assertionStyle: 'as', objectLiteralTypeAssertions: 'never' },
      ],
      '@typescript-eslint/ban-ts-comment': [
        'error',
        {
          'ts-expect-error': 'allow-with-description',
          'ts-ignore': true,
          'ts-nocheck': true,
          'ts-check': false,
          minimumDescriptionLength: 10,
        },
      ],
      '@typescript-eslint/no-explicit-any': 'error',

      // Ways to bypass the gate. Deferred work goes to docs/stories/deferred-work.md.
      '@eslint-community/eslint-comments/require-description': 'error',
      '@eslint-community/eslint-comments/no-unlimited-disable': 'error',
      'no-warning-comments': ['error', { terms: ['todo', 'fixme', 'hack', 'xxx'], location: 'anywhere' }],
      'no-console': 'error',
      eqeqeq: 'error',
      curly: ['error', 'all'],
      'no-param-reassign': 'error',
      'no-else-return': 'error',
      'no-await-in-loop': 'error',
      'no-shadow': 'off',
      '@typescript-eslint/no-shadow': 'error',
    },
  },
  {
    files: TEST_FILES,
    rules: {
      'max-lines-per-function': 'off',
      complexity: 'off',
      'max-depth': 'off',
      'max-nested-callbacks': 'off',
      'max-statements': 'off',
    },
  },
  {
    files: ['**/*.test.{ts,tsx,mts,cts,mjs}'],
    plugins: { vitest },
    rules: {
      'vitest/no-focused-tests': 'error',
      'vitest/no-disabled-tests': 'error',
      'vitest/expect-expect': 'error',
      'vitest/no-conditional-expect': 'error',
      'vitest/no-identical-title': 'error',
      'vitest/valid-expect': 'error',
    },
  },
  {
    // AD-1 purity for `core` (see `coreRestrictedGlobals`). `Date` itself stays
    // legal: `Date.parse(s)` and `new Date(s)` are pure, and `chunk-order.ts`
    // uses `Date.parse`. Tests are exempt.
    files: ['packages/core/src/**/*.{ts,tsx,mts,cts}'],
    ignores: ['packages/core/src/**/*.test.{ts,tsx,mts,cts}'],
    rules: {
      'no-restricted-globals': ['error', ...coreRestrictedGlobals],
      'no-restricted-properties': [
        'error',
        { object: 'Date', property: 'now', message: CLOCK },
        { object: 'Temporal', property: 'Now', message: CLOCK },
        { object: 'Math', property: 'random', message: RANDOM },
      ],
      'no-restricted-syntax': [
        'error',
        { selector: "NewExpression[callee.name='Date'][arguments.length=0]", message: CLOCK },
        // `Date(...)` ignores its arguments and returns the current time as a string.
        { selector: "CallExpression[callee.name='Date']", message: CLOCK },
        { selector: "MemberExpression[object.type='MetaProperty'][property.name='env']", message: ENV },
      ],
    },
  },
);
