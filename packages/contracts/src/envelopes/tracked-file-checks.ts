import type { z } from 'zod';

import { canonicalKey } from '../canonical-key.ts';
import {
  describeOverlap,
  linesOf,
  hasHybridAffix,
  CAN_NEVER_CO_OCCUR,
  OVERLAP_SLOTS,
  overlapBranches,
  summedStatIds,
} from '../overlap.ts';
import type { CraftedTrackedEntry, TrackedEntry } from '../tracked-entry.ts';

type TrackedEntries = readonly TrackedEntry[];

/** The kind a tracked line declares: both edges make it banded, none makes it valueless (§4.1). */
type LineKind = 'banded' | 'valueless';

function checkUniqueKeys(entries: TrackedEntries, context: z.RefinementCtx): void {
  const firstIndexByKey = new Map<string, number>();
  for (const [index, entry] of entries.entries()) {
    const key = canonicalKey(entry);
    const first = firstIndexByKey.get(key);
    if (first === undefined) {
      firstIndexByKey.set(key, index);
      continue;
    }
    context.addIssue({
      code: 'custom',
      path: ['entries', index],
      message: `canonical key ${key} repeats entries.${String(first)}; a key may appear once in the tracked list`,
    });
  }
}

function checkSharedFloors(entries: TrackedEntries, context: z.RefinementCtx): void {
  const firstFloorByClass = new Map<string, { readonly index: number; readonly floor: number }>();
  for (const [index, entry] of entries.entries()) {
    if (entry.kind !== 'crafted' || entry.status === 'pruned') {
      continue;
    }
    const classKey = JSON.stringify([entry.categoryId, entry.className]);
    const first = firstFloorByClass.get(classKey);
    if (first === undefined) {
      firstFloorByClass.set(classKey, { index, floor: entry.itemLevelMin });
      continue;
    }
    if (first.floor === entry.itemLevelMin) {
      continue;
    }
    context.addIssue({
      code: 'custom',
      path: ['entries', index, 'itemLevelMin'],
      message: `item class ${entry.categoryId}/${entry.className} declares itemLevelMin ${String(entry.itemLevelMin)} here and ${String(first.floor)} at entries.${String(first.index)}; the crafted entries of one item class share one floor (AD-17)`,
    });
  }
}

function checkWithinFileOverlap(entries: TrackedEntries, context: z.RefinementCtx): void {
  const earlierByClass = new Map<string, { readonly index: number; readonly key: string; readonly entry: CraftedTrackedEntry }[]>();
  for (const [index, entry] of entries.entries()) {
    if (entry.kind !== 'crafted' || entry.status === 'pruned') {
      continue;
    }
    const classKey = JSON.stringify([entry.categoryId, entry.className]);
    const earlier = earlierByClass.get(classKey) ?? [];
    const key = canonicalKey(entry);
    for (const other of earlier) {
      // A twin is the uniqueness rule's issue; a pair with a hybrid is core's (§2.1).
      if (other.key === key || hasHybridAffix(other.entry) || hasHybridAffix(entry)) {
        continue;
      }
      const branches = overlapBranches(other.entry, entry, CAN_NEVER_CO_OCCUR);
      if (branches === undefined) {
        continue;
      }
      context.addIssue({
        code: 'custom',
        path: ['entries', index],
        message: `entries ${other.key} (entries.${String(other.index)}) and ${key} overlap on ${describeOverlap(branches)}; one item satisfies both and would be counted twice (AD-17)`,
      });
    }
    earlier.push({ index, key, entry });
    earlierByClass.set(classKey, earlier);
  }
}

type FirstKindByStatId = Map<string, { readonly kind: LineKind; readonly at: string }>;

interface SlotSite {
  readonly entry: CraftedTrackedEntry;
  readonly index: number;
  readonly slot: (typeof OVERLAP_SLOTS)[number];
  readonly summed: ReadonlySet<string>;
}

function checkSlotKinds(site: SlotSite, firstKindByStatId: FirstKindByStatId, context: z.RefinementCtx): void {
  const { entry, index, slot, summed } = site;
  const reference = entry[slot];
  for (const [lineIndex, line] of linesOf(reference).entries()) {
    const path = reference.kind === 'hybrid' ? ['entries', index, slot, 'lines', lineIndex] : ['entries', index, slot];
    const at = path.join('.');
    const kind: LineKind = 'valueMin' in line ? 'banded' : 'valueless';
    if (kind === 'valueless' && summed.has(line.statId)) {
      context.addIssue({
        code: 'custom',
        path,
        message: `entry ${canonicalKey(entry)} sums statId ${line.statId} across its prefix and suffix, and its ${slot} line on it is valueless; a summed operand needs both edges (IMPLEMENTATION-NOTES.md §2.3, §5.5)`,
      });
    }
    const first = firstKindByStatId.get(line.statId);
    if (first === undefined) {
      firstKindByStatId.set(line.statId, { kind, at });
      continue;
    }
    if (first.kind !== kind) {
      context.addIssue({
        code: 'custom',
        path,
        message: `statId ${line.statId} is ${kind} at ${at} and ${first.kind} at ${first.at}; every tracked line on one statId takes one kind (IMPLEMENTATION-NOTES.md §2.3)`,
      });
    }
  }
}

function checkLineKinds(entries: TrackedEntries, context: z.RefinementCtx): void {
  const firstKindByStatId: FirstKindByStatId = new Map();
  for (const [index, entry] of entries.entries()) {
    if (entry.kind !== 'crafted' || entry.status === 'pruned') {
      continue;
    }
    const summed = summedStatIds(entry);
    for (const slot of OVERLAP_SLOTS) {
      checkSlotKinds({ entry, index, slot, summed }, firstKindByStatId, context);
    }
  }
}

export function checkTrackedEntries(entries: TrackedEntries, context: z.RefinementCtx): void {
  checkUniqueKeys(entries, context);
  checkSharedFloors(entries, context);
  checkWithinFileOverlap(entries, context);
  checkLineKinds(entries, context);
}
