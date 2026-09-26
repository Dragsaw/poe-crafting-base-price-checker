// Carries the four edges `no-core-to-sync`, `no-core-to-web`,
// `no-core-to-node-builtin` and `no-core-to-npm-package` forbid.
//
// Every import here is deliberately spelled `import type`: TypeScript erases
// it, so only a cruise configured with `tsPreCompilationDeps` sees the edge at
// all. Drop that option from the shipped config and this fixture stops
// reporting violations, failing the boundary test.
//
// `dependency-cruiser` stands in for any npm package: it is a root
// devDependency, so it resolves from this fixture into the root store.
import type { ICruiseResult } from 'dependency-cruiser';
import type { Stats } from 'node:fs';

import type { SyncShape } from '../../sync/src/index';
import type { WebShape } from '../../web/src/index';

export type CoreShape = {
  readonly sync: SyncShape;
  readonly web: WebShape;
  readonly stats: Stats;
  readonly cruise: ICruiseResult;
};
