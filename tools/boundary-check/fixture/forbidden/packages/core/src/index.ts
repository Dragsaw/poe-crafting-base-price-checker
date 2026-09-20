// Carries the two edges `no-core-to-sync` and `no-core-to-web` forbid.
//
// Every import here is deliberately spelled `import type`: TypeScript erases
// it, so only a cruise configured with `tsPreCompilationDeps` sees the edge at
// all. Drop that option from the shipped config and this fixture stops
// reporting violations, failing the boundary test.
import type { SyncShape } from '../../sync/src/index';
import type { WebShape } from '../../web/src/index';

export type CoreShape = { readonly sync: SyncShape; readonly web: WebShape };
