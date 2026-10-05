import { rules } from './depcruise.rules.mjs';

// `tsPreCompilationDeps` keeps a type-only `import type` edge visible to the rules.
// `exclude` stays narrow: npm targets under `.pnpm/**/dist/` must stay, or
// `no-core-to-npm-package` never fires. The config must be an object literal, not a factory.
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
