/**
 * The one-way package graph (AD-1, NFR-4): `contracts` -> `core` -> `sync` / `web`,
 * plus the import purity of `core` (AD-1): a `core` module imports no Node
 * builtin and nothing outside `packages/`. Edges into `packages/` are left to
 * the direction rules above.
 * The purity rules cover `packages/core/src/` only; test files (`*.test.ts`)
 * there are exempt, and package tooling such as `vitest.config.ts` is outside
 * it: neither is a valuation module.
 *
 * This module is the single source of the rules. `.dependency-cruiser.mjs`
 * spreads it into the shipped config, and `tools/boundary-check/boundary.test.ts`
 * cruises a fixture with it **unmodified** — so a `severity: "warn"` or a
 * mistyped rule name here fails that test rather than silently disarming the
 * shipped check.
 *
 * A plain array, deliberately: dependency-cruiser requires the config itself to
 * be an object literal, not a factory, so the composition happens there.
 */
/** @type {import('dependency-cruiser').IForbiddenRuleType[]} */
export const rules = [
  {
    name: 'no-core-to-sync',
    severity: 'error',
    comment:
      'Forbidden edge core -> sync. The graph is one-way: contracts -> core -> sync/web. `core` is pure and must not reach into the imperative shell (AD-1).',
    from: { path: '^packages/core/' },
    to: { path: '^packages/sync/' },
  },
  {
    name: 'no-core-to-web',
    severity: 'error',
    comment:
      'Forbidden edge core -> web. The graph is one-way: contracts -> core -> sync/web. `core` is pure and must not reach into the view (AD-1).',
    from: { path: '^packages/core/' },
    to: { path: '^packages/web/' },
  },
  {
    name: 'no-sync-to-web',
    severity: 'error',
    comment:
      'Forbidden edge sync -> web. `sync` and `web` are siblings and never import each other; a shape they both need belongs in `contracts` or `core` (AD-1).',
    from: { path: '^packages/sync/' },
    to: { path: '^packages/web/' },
  },
  {
    name: 'no-web-to-sync',
    severity: 'error',
    comment:
      'Forbidden edge web -> sync. `sync` and `web` are siblings and never import each other; a shape they both need belongs in `contracts` or `core` (AD-1).',
    from: { path: '^packages/web/' },
    to: { path: '^packages/sync/' },
  },
  {
    name: 'no-contracts-to-sibling',
    severity: 'error',
    comment:
      'Forbidden edge contracts -> sibling. `contracts` sits at the root of the graph and depends on nothing in this workspace (AD-1).',
    from: { path: '^packages/contracts/' },
    to: { path: '^packages/(core|sync|web)/' },
  },
  {
    name: 'no-core-to-node-builtin',
    severity: 'error',
    comment:
      'Forbidden edge core -> Node builtin (`node:fs`, `fs`, ...). `core` performs no I/O; I/O belongs in the imperative shell (AD-1). Test files are exempt.',
    from: { path: '^packages/core/src/', pathNot: String.raw`\.test\.ts$` },
    to: { dependencyTypes: ['core'] },
  },
  {
    name: 'no-core-to-npm-package',
    severity: 'error',
    comment:
      'Forbidden edge core -> npm package. `core` is pure and imports nothing outside `packages/`; workspace edges are left to the direction rules (AD-1). Path-based, so an undeclared package (npm-no-pkg, unknown) is caught too; builtins are left to no-core-to-node-builtin. Test files are exempt.',
    from: { path: '^packages/core/src/', pathNot: String.raw`\.test\.ts$` },
    to: { pathNot: '^packages/', dependencyTypesNot: ['core'] },
  },
];
