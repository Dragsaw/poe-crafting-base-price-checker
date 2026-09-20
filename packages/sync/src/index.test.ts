import { expect, it } from 'vitest';

import { SYNC_CONTRACTS_ROOT, SYNC_PLACEHOLDER } from './index';

it('runs the sync suite and resolves both allowed workspace dependencies', () => {
  expect(SYNC_PLACEHOLDER).toBe('contracts:core:sync');
  expect(SYNC_CONTRACTS_ROOT).toBe('contracts');
});
