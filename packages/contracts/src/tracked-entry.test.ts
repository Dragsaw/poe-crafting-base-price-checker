import { describe, expect, it } from 'vitest';

import { without } from './test-support';
import { TrackedEntrySchema } from './tracked-entry';
import type { TrackedEntry } from './tracked-entry';

const craftedEntry = {
  kind: 'crafted',
  categoryId: 'weapon.bow',
  className: 'Bows',
  itemLevelMin: 79,
  prefix: { kind: 'banded', statId: 'explicit.stat_1', valueMin: 43, valueMax: 56.5 },
  status: 'active',
} as const;

const rawEntry = {
  kind: 'raw',
  baseTypeId: 'Advanced Dualstring Bow',
  itemLevelMin: 82,
  status: 'active',
} as const;

function issuesOf(data: unknown) {
  const result = TrackedEntrySchema.safeParse(data);
  return result.success ? [] : result.error.issues;
}

describe('TrackedEntrySchema', () => {
  it('parses both arms', () => {
    expect(TrackedEntrySchema.parse(craftedEntry)).toEqual(craftedEntry);
    expect(TrackedEntrySchema.parse(rawEntry)).toEqual(rawEntry);
  });

  it('refuses a crafted entry whose prefix is an inverted band, with the issue on prefix.valueMax', () => {
    const inverted = {
      ...craftedEntry,
      prefix: { kind: 'banded', statId: 'explicit.stat_1', valueMin: 56.5, valueMax: 43 },
    };
    expect(issuesOf(inverted).map((issue) => issue.path.join('.'))).toEqual(['prefix.valueMax']);
  });

  // I/O matrix: "Kind named, not inferred".
  it('refuses a crafted entry carrying neither prefix nor suffix', () => {
    const issues = issuesOf({
      kind: 'crafted',
      categoryId: 'weapon.bow',
      className: 'Bows',
      itemLevelMin: 79,
      status: 'active',
    });
    expect(issues).toHaveLength(1);
    expect(issues[0]?.message).toContain('at least one affix');
  });

  it('accepts a crafted entry carrying only a suffix', () => {
    expect(
      TrackedEntrySchema.safeParse({
        kind: 'crafted',
        categoryId: 'weapon.bow',
        className: 'Bows',
        itemLevelMin: 79,
        suffix: { kind: 'valueless', statId: 'explicit.stat_2' },
        status: 'active',
      }).success,
    ).toBe(true);
  });

  // I/O matrix: "Raw entry with an affix".
  it('refuses a raw entry carrying an affix — the arm has no affix members', () => {
    const keys = issuesOf({ ...rawEntry, prefix: { kind: 'valueless', statId: 's' } }).flatMap(
      (issue) => (issue.code === 'unrecognized_keys' ? issue.keys : []),
    );
    expect(keys).toContain('prefix');
  });

  it('refuses a raw entry carrying a category', () => {
    const keys = issuesOf({ ...rawEntry, categoryId: 'weapon.bow' }).flatMap((issue) =>
      issue.code === 'unrecognized_keys' ? issue.keys : [],
    );
    expect(keys).toContain('categoryId');
  });

  it('carries status as a schema member, not a convention', () => {
    expect(TrackedEntrySchema.safeParse({ ...craftedEntry, status: 'pinned' }).success).toBe(true);
    expect(TrackedEntrySchema.safeParse({ ...craftedEntry, status: 'retired' }).success).toBe(
      false,
    );
    expect(TrackedEntrySchema.safeParse(without(craftedEntry, 'status')).success).toBe(false);
  });

  // I/O matrix: "Pruned entry".
  it('refuses a pruned entry with no reason, with the issue on the reason field', () => {
    const issues = issuesOf({ ...craftedEntry, status: 'pruned' });
    expect(issues.map((issue) => issue.path.join('.'))).toContain('prunedReason');
  });

  it('accepts a pruned entry whose reason is a free string', () => {
    expect(
      TrackedEntrySchema.parse({
        ...craftedEntry,
        status: 'pruned',
        prunedReason: 'patch 0.5.6 removed the modifier family',
      }),
    ).toMatchObject({ prunedReason: 'patch 0.5.6 removed the modifier family' });
  });

  it('refuses a prune reason on an entry that is not pruned', () => {
    const issues = issuesOf({ ...craftedEntry, prunedReason: 'why?' });
    expect(issues.map((issue) => issue.path.join('.'))).toContain('prunedReason');
  });

  /** AC: an exhaustive `switch` over the two kinds, with no default arm. */
  it('exhausts both kinds with no default arm', () => {
    function unitOf(entry: TrackedEntry): string {
      switch (entry.kind) {
        case 'crafted':
          return `${entry.categoryId}/${entry.className}`;
        case 'raw':
          return entry.baseTypeId;
      }
    }

    expect(unitOf(TrackedEntrySchema.parse(craftedEntry))).toBe('weapon.bow/Bows');
    expect(unitOf(TrackedEntrySchema.parse(rawEntry))).toBe('Advanced Dualstring Bow');
  });
});
