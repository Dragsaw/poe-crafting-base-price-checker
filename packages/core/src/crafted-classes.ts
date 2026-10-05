import type { CraftedTrackedEntry, TrackedEntry } from '@poe/contracts';

/** The serialised Item Class key, `["crafted", categoryId, className]`: the class prefix of its entries' canonical keys (§4.1). */
export function classKeyOf(categoryId: string, className: string): string {
  return JSON.stringify(['crafted', categoryId, className]);
}

/**
 * The one grouping of non-pruned crafted entries by Item Class (`classKeyOf`), in insertion order.
 */
export function craftedClassesOf(entries: readonly TrackedEntry[]): Map<string, CraftedTrackedEntry[]> {
  const classes = new Map<string, CraftedTrackedEntry[]>();
  for (const entry of entries) {
    if (entry.kind !== 'crafted' || entry.status === 'pruned') {
      continue;
    }
    const key = classKeyOf(entry.categoryId, entry.className);
    const members = classes.get(key);
    if (members === undefined) {
      classes.set(key, [entry]);
    } else {
      members.push(entry);
    }
  }
  return classes;
}
