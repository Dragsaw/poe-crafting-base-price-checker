import { describe, expect, it } from 'vitest';

import { parseEnvelope, TrackedFileSchema } from '../envelopes';
import { TRACKED_SCHEMA_VERSION } from '../schema-version';

const parse = (entries: readonly unknown[]) =>
  parseEnvelope(TrackedFileSchema, { schemaVersion: TRACKED_SCHEMA_VERSION, entries }, TRACKED_SCHEMA_VERSION);

const amulet = (itemLevelMin: number, statId: string, status = 'active') => ({
  kind: 'crafted',
  categoryId: 'accessory.amulet',
  className: 'Amulets',
  itemLevelMin,
  prefix: { kind: 'valueless', statId },
  suffix: { kind: 'valueless', statId: 'explicit.suffix' },
  status,
  ...((status === 'pruned') && { prunedReason: 'no market' }),
});

describe('TrackedFileSchema shared floor (AD-17, FR-22)', () => {
  // I/O matrix: "Shared floor".
  it('refuses two non-pruned crafted entries on one class at 82 and 75, with the issue at the second', () => {
    const result = parse([amulet(82, 'explicit.a'), amulet(75, 'explicit.b')]);
    if (result.ok || result.reason !== 'invalid') {
      throw new Error(`expected an invalid refusal, got ${JSON.stringify(result)}`);
    }
    expect(result.issues).toHaveLength(1);
    const [issue] = result.issues;
    expect(issue?.path).toEqual(['entries', 1, 'itemLevelMin']);
    expect(issue?.message).toContain('accessory.amulet/Amulets');
    expect(issue?.message).toContain('82');
    expect(issue?.message).toContain('75');
    expect(issue?.message).toContain('entries.0');
  });

  it('reports one issue per breaching entry', () => {
    const result = parse([amulet(82, 'explicit.a'), amulet(75, 'explicit.b'), amulet(70, 'explicit.c')]);
    if (result.ok || result.reason !== 'invalid') {
      throw new Error(`expected an invalid refusal, got ${JSON.stringify(result)}`);
    }
    expect(result.issues.map((issue) => issue.path)).toEqual([
      ['entries', 1, 'itemLevelMin'],
      ['entries', 2, 'itemLevelMin'],
    ]);
  });

  // I/O matrix: "Shared floor, exempt".
  it('loads a pruned entry at 75 beside 82', () => {
    expect(parse([amulet(82, 'explicit.a'), amulet(75, 'explicit.b', 'pruned')]).ok).toBe(true);
  });

  it('never lets a pruned entry set the class floor', () => {
    expect(
      parse([amulet(75, 'explicit.a', 'pruned'), amulet(82, 'explicit.b'), amulet(82, 'explicit.c')]).ok,
    ).toBe(true);
  });

  it('loads a raw entry at 75 beside a crafted entry at 82', () => {
    const raw = { kind: 'raw', baseTypeId: 'Gold Amulet', categoryId: 'accessory.amulet', className: 'Amulets', itemLevelMin: 75, status: 'active' };
    expect(parse([amulet(82, 'explicit.a'), raw]).ok).toBe(true);
  });

  it('keeps separate floors for separate classes', () => {
    expect(parse([amulet(82, 'explicit.a'), { ...amulet(1, 'explicit.b'), className: 'Rings' }]).ok).toBe(true);
  });
});

const hybridPrefix = (min: number, max: number) => ({
  kind: 'hybrid',
  lines: [
    { statId: 'explicit.stat_691932474', valueMin: min, valueMax: max },
    { statId: 'explicit.stat_1509134228', valueMin: 25, valueMax: 34 },
  ],
});

const craftedBow = (prefix: unknown) => ({
  kind: 'crafted',
  categoryId: 'weapon.bow',
  className: 'Bows',
  itemLevelMin: 82,
  prefix,
  suffix: { kind: 'valueless', statId: 'explicit.stat_2' },
  status: 'active',
});

describe('TrackedFileSchema, hybrid references (CAP-1)', () => {
  it('parses an entry whose prefix is the Bows phys%+accuracy hybrid', () => {
    expect(parse([craftedBow(hybridPrefix(16, 20))]).ok).toBe(true);
  });

  it('does not evaluate the within-file overlap of a pair with a hybrid reference', () => {
    // The two hybrids' bands intersect on every line; core evaluates the pair.
    expect(parse([craftedBow(hybridPrefix(16, 20)), craftedBow(hybridPrefix(18, 22))]).ok).toBe(true);
    expect(
      parse([
        craftedBow(hybridPrefix(16, 20)),
        craftedBow({ kind: 'banded', statId: 'explicit.stat_691932474', valueMin: 16, valueMax: 20 }),
      ]).ok,
    ).toBe(true);
  });
});

const banded = (statId: string, valueMin: number, valueMax: number) => ({ kind: 'banded', statId, valueMin, valueMax });

const valueless = (statId: string) => ({ kind: 'valueless', statId });

const craftedAmulet = (
  prefix: unknown,
  suffix: unknown,
  { className = 'Amulets', status = 'active' }: { className?: string; status?: 'active' | 'pruned' } = {},
) => ({
  kind: 'crafted',
  categoryId: 'accessory.amulet',
  className,
  itemLevelMin: 82,
  prefix,
  suffix,
  status,
  ...((status === 'pruned') && { prunedReason: 'no market' }),
});

const summedIssuesOf = (entries: readonly unknown[]) => {
  const result = parse(entries);
  if (result.ok || result.reason !== 'invalid') {
    throw new Error(`expected an invalid refusal, got ${JSON.stringify(result)}`);
  }
  return result.issues;
};

describe('TrackedFileSchema, within-file kind agreement and summed operands', () => {
  const RARITY = 'explicit.stat_3917489142';

  it('loads a summed statId with two banded operands', () => {
    expect(parse([craftedAmulet(banded(RARITY, 16, 19), banded(RARITY, 15, 18))]).ok).toBe(true);
  });

  it('refuses a summed statId with a valueless operand, naming the entry, the slot and the statId', () => {
    const entry = craftedAmulet(valueless(RARITY), valueless(RARITY));
    const issues = summedIssuesOf([entry]);
    expect(issues.map((issue) => issue.path)).toEqual([
      ['entries', 0, 'prefix'],
      ['entries', 0, 'suffix'],
    ]);
    for (const issue of issues) {
      expect(issue.message).toContain(RARITY);
      expect(issue.message).toContain('valueless');
      expect(issue.message).toContain('["crafted","accessory.amulet","Amulets"');
    }
    expect(issues[0]?.message).toContain('prefix line');
    expect(issues[1]?.message).toContain('suffix line');
  });

  it('refuses a valueless hybrid line on a summed statId at that line', () => {
    const prefix = { kind: 'hybrid', lines: [{ statId: 'explicit.stat_1' }, { statId: RARITY }] };
    const issues = summedIssuesOf([craftedAmulet(prefix, valueless(RARITY))]);
    expect(issues.map((issue) => issue.path)).toEqual([
      ['entries', 0, 'prefix', 'lines', 1],
      ['entries', 0, 'suffix'],
    ]);
  });

  it('refuses a summed operand with a missing bound as a shape issue at that slot', () => {
    const shapeIssuesAt = (issues: ReturnType<typeof summedIssuesOf>) =>
      issues.filter((issue) => issue.code !== 'custom').map((issue) => issue.path.slice(0, 3));
    const issues = summedIssuesOf([craftedAmulet(banded(RARITY, 16, 19), { kind: 'banded', statId: RARITY, valueMin: 15 })]);
    expect(shapeIssuesAt(issues)).toEqual([['entries', 0, 'suffix']]);
    const hybridIssues = summedIssuesOf([
      craftedAmulet(
        { kind: 'hybrid', lines: [{ statId: 'explicit.stat_1', valueMin: 1, valueMax: 2 }, { statId: RARITY, valueMin: 16 }] },
        banded(RARITY, 15, 18),
      ),
    ]);
    expect(shapeIssuesAt(hybridIssues)).toEqual([['entries', 0, 'prefix']]);
  });

  it('refuses one statId banded in one line and valueless in another, at the later line, naming both locations', () => {
    const issues = summedIssuesOf([
      craftedAmulet(banded('explicit.stat_a', 1, 2), banded('explicit.stat_s', 1, 2)),
      craftedAmulet(banded('explicit.stat_b', 1, 2), valueless('explicit.stat_a'), { className: 'Other' }),
    ]);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.path).toEqual(['entries', 1, 'suffix']);
    expect(issues[0]?.message).toContain('explicit.stat_a');
    expect(issues[0]?.message).toContain('valueless at entries.1.suffix');
    expect(issues[0]?.message).toContain('banded at entries.0.prefix');
  });

  it('refuses a kind clash on a hybrid line, and inside one entry', () => {
    const prefix = { kind: 'hybrid', lines: [{ statId: 'explicit.stat_a', valueMin: 1, valueMax: 2 }, { statId: 'explicit.stat_z' }] };
    const issues = summedIssuesOf([
      craftedAmulet(prefix, banded('explicit.stat_s', 1, 2)),
      craftedAmulet(banded('explicit.stat_b', 1, 2), banded('explicit.stat_z', 1, 2), { className: 'Other' }),
    ]);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.path).toEqual(['entries', 1, 'suffix']);
    expect(issues[0]?.message).toContain('banded at entries.1.suffix');
    expect(issues[0]?.message).toContain('valueless at entries.0.prefix.lines.1');
    // Summed with a valueless operand as well: both rules speak.
    const summed = summedIssuesOf([craftedAmulet(valueless(RARITY), banded(RARITY, 15, 18))]);
    expect(summed.map((issue) => issue.path)).toEqual([
      ['entries', 0, 'prefix'],
      ['entries', 0, 'suffix'],
    ]);
    expect(summed[0]?.message).toContain(`sums statId ${RARITY} across its prefix and suffix`);
    expect(summed[0]?.message).toContain('its prefix line on it is valueless');
    expect(summed[1]?.message).toContain(
      `statId ${RARITY} is banded at entries.0.suffix and valueless at entries.0.prefix`,
    );
  });

  it('loads one statId under one kind in many lines', () => {
    expect(
      parse([
        craftedAmulet(banded('explicit.stat_a', 1, 2), valueless('explicit.stat_v')),
        craftedAmulet(banded('explicit.stat_a', 3, 4), valueless('explicit.stat_v'), { className: 'Other' }),
      ]).ok,
    ).toBe(true);
  });

  it('skips pruned and raw entries', () => {
    expect(
      parse([
        craftedAmulet(banded('explicit.stat_a', 1, 2), banded('explicit.stat_s', 1, 2)),
        craftedAmulet(valueless('explicit.stat_a'), valueless('explicit.stat_a'), { status: 'pruned' }),
        { kind: 'raw', baseTypeId: 'Gold Amulet', categoryId: 'accessory.amulet', className: 'Amulets', itemLevelMin: 82, status: 'active' },
      ]).ok,
    ).toBe(true);
  });
});
