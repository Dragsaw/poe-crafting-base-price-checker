import { beforeAll, expect, it } from 'vitest';

import { ARTIFACT_ORDER, ARTIFACTS } from './artifacts';

interface AllowlistEntry {
  readonly path: string;
  readonly required: boolean;
}

/**
 * `tools/prune-pages.mjs` sits outside this package's `rootDir`, so a static
 * import would pull it into the `web` program; the dynamic import does not.
 */
// `import.meta.dirname`, not `import.meta.url`: under jsdom the url is not `file:`.
const SCRIPT = `${(import.meta as ImportMeta & { readonly dirname: string }).dirname}/../../../../tools/prune-pages.mjs`;

let allowlist: readonly AllowlistEntry[];

beforeAll(async () => {
  ({ ALLOWLIST: allowlist } = (await import(/* @vite-ignore */ SCRIPT)) as { ALLOWLIST: readonly AllowlistEntry[] });
});

/** What `pnpm build` keeps of `data/` is exactly what the page fetches (AD-24). */
it('prunes the Pages copy to exactly ARTIFACTS: the same seven paths in AD-24 order, the same required set', () => {
  expect(allowlist.map((entry) => entry.path)).toEqual(ARTIFACT_ORDER.map((key) => ARTIFACTS[key].path));
  expect(allowlist.map((entry) => entry.required)).toEqual(
    ARTIFACT_ORDER.map((key) => ARTIFACTS[key].class === 'required'),
  );
  expect(Object.keys(ARTIFACTS)).toHaveLength(allowlist.length);
});
