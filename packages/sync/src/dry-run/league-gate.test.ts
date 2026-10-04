import { describe, expect, it } from 'vitest';

import { dryRun } from '../dry-run.ts';
import { LeagueMismatchError } from '../league/league-gate.ts';
import { LEAGUES_FIXTURE_NAME } from '../pricing/fixture-names.ts';
import { emptySearches, entries, snapshotOf } from './test-support.ts';

describe('dryRun: the league gate', () => {
  it('sends one leagues GET, counted as league-validation, before the searches', async () => {
    const report = await dryRun(snapshotOf(entries));
    expect(report.report?.figures.requestsBySource).toEqual({
      'tracked-list': 2,
      'league-validation': 1,
      'session-probe': 0,
    });
  });

  it('rejects on a league the recorded answer does not carry, and prices nothing', async () => {
    const fixtures = emptySearches(entries);
    fixtures.set(LEAGUES_FIXTURE_NAME, JSON.stringify({ result: [{ id: 'Standard' }] }));

    await expect(dryRun(snapshotOf(entries, { fixtures }))).rejects.toBeInstanceOf(LeagueMismatchError);
  });

  it('fails loudly, naming the fixture, when the leagues answer is not recorded', async () => {
    const fixtures = emptySearches(entries);
    fixtures.delete(LEAGUES_FIXTURE_NAME);

    await expect(dryRun(snapshotOf(entries, { fixtures }))).rejects.toThrow(LEAGUES_FIXTURE_NAME);
  });
});
