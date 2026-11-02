import { ConfigFileSchema } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import { checkTracked } from './check.ts';
import { trackedText } from './check.test-support.ts';

const gold = { kind: 'raw', baseTypeId: 'Gold Amulet', categoryId: 'accessory.amulet', className: 'Amulets', itemLevelMin: 82, status: 'active' };
const rawJewel = { kind: 'raw', baseTypeId: 'Emerald', categoryId: 'jewel', className: 'Emerald', itemLevelMin: 1, status: 'active' };

describe('pnpm tracked:check, a raw entry in the jewel category', () => {
  it('reports it as a schema issue at its categoryId and fails (FR-36)', () => {
    const report = checkTracked({
      tracked: trackedText([gold, rawJewel]),
      config: { ok: true, value: ConfigFileSchema.parse({ schemaVersion: '1.0.0', league: 'Test League', minChunkSearches: 2 }) },
      catalogue: { ok: true, value: { statIds: new Set(), baseTypeIds: new Set(['Gold Amulet', 'Emerald']), categoryIds: new Set(['accessory.amulet', 'jewel']) } },
      weights: { ok: true, value: undefined },
      recipes: { ok: true, value: undefined },
    });

    expect(report.ok).toBe(false);
    expect(report.checks).toEqual([
      { check: 'schema', status: 'failed' },
      { check: 'pinned-cap', status: 'skipped' },
      { check: 'catalogue', status: 'skipped' },
      { check: 'cross-file', status: 'skipped' },
      { check: 'recipe-reach', status: 'skipped' },
    ]);
    expect(report.issues).toEqual([{ check: 'schema', path: 'entries.1.categoryId', message: expect.stringContaining('FR-36') as unknown }]);
  });
});
