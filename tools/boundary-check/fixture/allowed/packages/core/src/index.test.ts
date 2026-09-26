// A `core` test file may import a Node builtin and an npm package: it is not a
// valuation module, so `no-core-to-node-builtin` and `no-core-to-npm-package`
// both exempt `*.test.ts`. Both edges must stay unreported.
import type { Stats } from 'node:fs';

import { expect, it } from 'vitest';

export type ProbeStats = Stats;

it('is exempt from the core purity rules', () => {
  expect(true).toBe(true);
});
