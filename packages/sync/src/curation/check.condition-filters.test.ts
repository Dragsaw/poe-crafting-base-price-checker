import { ConfigFileSchema } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import { checkTracked } from './check.ts';
import { trackedText } from './check.test-support.ts';

const gold = { kind: 'raw', baseTypeId: 'Gold Amulet', categoryId: 'accessory.amulet', className: 'Amulets', itemLevelMin: 82, status: 'active' };
const tablet = { kind: 'raw', baseTypeId: 'Abyss Tablet', categoryId: 'map.tablet', className: 'Tablet', itemLevelMin: 1, status: 'active' };

describe('checkTracked: condition filters', () => {
  it('reports a missing condition stat at its entry, naming the condition table rather than the entry', () => {
    const report = checkTracked({
      tracked: trackedText([gold, tablet]),
      config: { ok: true, value: ConfigFileSchema.parse({ schemaVersion: '1.0.0', league: 'Test League', minChunkSearches: 2 }) },
      catalogue: {
        ok: true,
        value: {
          statIds: new Set(),
          baseTypeIds: new Set(['Gold Amulet', 'Abyss Tablet']),
          categoryIds: new Set(['accessory.amulet', 'map.tablet']),
        },
      },
      weights: { ok: true, value: undefined },
      recipes: { ok: true, value: undefined },
    });

    expect(report.checks).toContainEqual({ check: 'catalogue', status: 'failed' });
    expect(report.issues).toEqual([
      {
        check: 'catalogue',
        path: 'entries.1',
        message:
          'statId pseudo.pseudo_number_of_uses_remaining is absent from the committed catalogue ' +
          '(condition filter of category map.tablet in packages/sync/src/pricing/condition-filters.ts)',
      },
    ]);
  });

  it('names the entry, not the condition table, for a non-condition miss on a tablet', () => {
    const report = checkTracked({
      tracked: trackedText([tablet]),
      config: { ok: true, value: ConfigFileSchema.parse({ schemaVersion: '1.0.0', league: 'Test League', minChunkSearches: 2 }) },
      catalogue: {
        ok: true,
        value: {
          statIds: new Set(['pseudo.pseudo_number_of_uses_remaining']),
          baseTypeIds: new Set(),
          categoryIds: new Set(['map.tablet']),
        },
      },
      weights: { ok: true, value: undefined },
      recipes: { ok: true, value: undefined },
    });

    expect(report.issues.map((issue) => issue.message)).toEqual([
      'baseTypeId Abyss Tablet is absent from the committed catalogue (entry ["raw","Abyss Tablet",1])',
    ]);
    expect(report.issues[0]?.message).not.toContain('condition-filters.ts');
  });
});
