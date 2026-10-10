import { canonicalKey } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import { rawEntry, unpriced } from '../test-support/list-fixtures';
import { problemSummary } from './problem-summary';

const CURATION = { pinnedCount: 0, minChunkSearches: 8 };
const NONE = { broken: 0, starved: 0, kind: undefined, lines: [] };

describe('the problem summary and pruned entries (AD-12)', () => {
  const pruned = rawEntry('Gone');
  const lost = unpriced(rawEntry('Lost'), { state: 'unresolvable' });
  const goneDataset = unpriced(pruned, { state: 'unresolvable' });
  const prunedKeys = new Set([canonicalKey(pruned)]);

  it('never counts a pruned unresolvable entry', () => {
    expect(problemSummary([goneDataset], undefined, { ...CURATION, prunedKeys })).toEqual(NONE);
  });

  it('still counts a non-pruned unresolvable entry beside a pruned one', () => {
    const summary = problemSummary([goneDataset, lost], undefined, { ...CURATION, prunedKeys });
    expect(summary).toMatchObject({ broken: 1, kind: 'broken' });
  });
});
