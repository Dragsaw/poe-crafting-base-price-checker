import { expect, it } from 'vitest';

import { SYNC_CONTRACTS_SCHEMA_VERSION, SYNC_PLACEHOLDER } from './index';

it('runs the sync suite and resolves both allowed workspace dependencies', () => {
  expect(SYNC_PLACEHOLDER).toBe('contracts@1.0.0:core:sync');
  expect(SYNC_CONTRACTS_SCHEMA_VERSION).toBe('1.0.0');
});

it('exports the league gate and its mismatch error', async () => {
  const sync = await import('./index');
  expect(sync.createLeagueGate).toBeTypeOf('function');
  expect(sync.LeagueMismatchError).toBeTypeOf('function');
  expect(sync.createTradeClients).toBeTypeOf('function');
});
