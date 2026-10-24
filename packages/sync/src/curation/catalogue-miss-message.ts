import type { TrackedEntry, UnresolvableRecord } from '@poe/contracts';

import { conditionFiltersOf } from '../pricing/condition-filters.ts';

const CONDITION_FILTERS_PATH = 'packages/sync/src/pricing/condition-filters.ts';

/** A condition id is not the entry's to fix, so its miss names the table that owns it. */
export function catalogueMissMessage(record: UnresolvableRecord, entry: TrackedEntry | undefined): string {
  const isCondition =
    entry !== undefined && conditionFiltersOf(entry.categoryId).some((condition) => condition.id === record.identifier);
  const owner = isCondition
    ? `condition filter of category ${entry.categoryId} in ${CONDITION_FILTERS_PATH}`
    : `entry ${record.entryKey}`;
  return `${record.identifierKind} ${record.identifier} is absent from the committed catalogue (${owner})`;
}
