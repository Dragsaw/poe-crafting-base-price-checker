import js from '@eslint/js';
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
export default tseslint.config(
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
      '.claude/**',
      '.serena/**',
      '.impeccable/**',
    ],
  },
  {
    files: [
      'packages/**/*.{ts,tsx,mts,cts}',
      'test/**/*.ts',
      'tools/**/*.ts',
      '*.{ts,mts,cts,mjs}',
      // Leading-dot filenames are not matched by a `*` glob.
      '.dependency-cruiser.mjs',
    ],
    extends: [js.configs.recommended, tseslint.configs.recommended],
  },
);
