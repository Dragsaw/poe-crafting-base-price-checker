import type { TrackedEntry } from '@poe/contracts';

import { catalogueWithout } from '../test-support.ts';
import type { TestPorts } from '../test-support.ts';

export const withCatalogue = (...missing: string[]): Partial<TestPorts> => ({
  catalogue: () => Promise.resolve({ ok: true, value: catalogueWithout(...missing) }),
});

export function craftedEntry(
  categoryId: string,
  prefix: string,
  className = 'Bows',
  status: TrackedEntry['status'] = 'active',
): TrackedEntry {
  const base = {
    kind: 'crafted',
    categoryId,
    className,
    itemLevelMin: 75,
    prefix: { kind: 'valueless', statId: prefix },
    suffix: { kind: 'valueless', statId: 'explicit.stat_suffix' },
  } as const;
  return status === 'pruned' ? { ...base, status, prunedReason: 'no market' } : { ...base, status };
}
