import { rules } from './depcruise.rules.mjs';

/**
 * dependency-cruiser requires an exported **object literal**, not a factory —
 * hence the spread rather than a call.
 *
 * `tsPreCompilationDeps: true` is what makes a type-only `import type` visible:
 * without it TypeScript erases the edge before dependency-cruiser sees it, and a
 * forbidden import spelled `import type` would pass the check.
 */
export default {
  forbidden: [...rules],
  options: {
    tsPreCompilationDeps: true,
    doNotFollow: { path: 'node_modules' },
    exclude: {
      path: '(^|/)(node_modules|dist)/|^tools/boundary-check/fixture/',
    },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default'],
    },
  },
};
