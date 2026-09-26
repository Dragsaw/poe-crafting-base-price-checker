import { rules } from './depcruise.rules.mjs';

/**
 * dependency-cruiser requires an exported **object literal**, not a factory —
 * hence the spread rather than a call.
 *
 * `tsPreCompilationDeps: true` is what makes a type-only `import type` visible:
 * without it TypeScript erases the edge before dependency-cruiser sees it, and a
 * forbidden import spelled `import type` would pass the check.
 *
 * `exclude` drops only a workspace package's own `node_modules/` and `dist/`,
 * never the root store. A resolved npm module lives under
 * `node_modules/.pnpm/...` (and often under a `dist/` inside it), so a broader
 * `(^|/)(node_modules|dist)/` exclude removes every npm target from the graph
 * and leaves `no-core-to-npm-package` inert. `doNotFollow` already stops the
 * cruise from traversing into those modules.
 */
export default {
  forbidden: [...rules],
  options: {
    tsPreCompilationDeps: true,
    doNotFollow: { path: 'node_modules' },
    exclude: {
      path: '^packages/[^/]+/(node_modules|dist)/|^tools/boundary-check/fixture/',
    },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default'],
    },
  },
};
