import { describe, expect, it } from 'vitest';

import { ModifierRefSchema } from './modifier-ref';
import type { ModifierRef } from './modifier-ref';

function issuePaths(data: unknown): string[] {
  const result = ModifierRefSchema.safeParse(data);
  if (result.success) {
    return [];
  }
  return result.error.issues.map((issue) => issue.path.join('.'));
}

function unrecognisedKeys(data: unknown): string[] {
  const result = ModifierRefSchema.safeParse(data);
  if (result.success) {
    return [];
  }
  return result.error.issues.flatMap((issue) =>
    issue.code === 'unrecognized_keys' ? issue.keys : [],
  );
}

describe('ModifierRefSchema', () => {
  it('accepts a closed band carrying both edges', () => {
    expect(
      ModifierRefSchema.parse({
        kind: 'banded',
        statId: 'explicit.stat_1509134228',
        valueMin: 43,
        valueMax: 56.5,
      }),
    ).toEqual({
      kind: 'banded',
      statId: 'explicit.stat_1509134228',
      valueMin: 43,
      valueMax: 56.5,
    });
  });

  it('takes a non-integer edge — band edges are `number`, never `integer`', () => {
    const parsed = ModifierRefSchema.parse({
      kind: 'banded',
      statId: 'explicit.stat_518292764',
      valueMin: 4.5,
      valueMax: 6.5,
    });
    expect(parsed).toMatchObject({ valueMin: 4.5, valueMax: 6.5 });
  });

  // I/O matrix: "Open-top band".
  it('refuses an open-top band, with the issue on valueMax', () => {
    expect(
      issuePaths({ kind: 'banded', statId: 'explicit.stat_1', valueMin: 43 }),
    ).toContain('valueMax');
  });

  it('accepts an ordered band and a point band', () => {
    const ordered = { kind: 'banded', statId: 'explicit.stat_1', valueMin: 43, valueMax: 56.5 };
    const point = { kind: 'banded', statId: 'explicit.stat_1', valueMin: 5, valueMax: 5 };
    expect(issuePaths(ordered)).toEqual([]);
    expect(issuePaths(point)).toEqual([]);
  });

  it('refuses an inverted band, with the issue on valueMax', () => {
    expect(
      issuePaths({ kind: 'banded', statId: 'explicit.stat_1', valueMin: 56.5, valueMax: 43 }),
    ).toEqual(['valueMax']);
  });

  it('accepts a valueless reference carrying no edges at all', () => {
    expect(ModifierRefSchema.parse({ kind: 'valueless', statId: 'explicit.stat_9' })).toEqual({
      kind: 'valueless',
      statId: 'explicit.stat_9',
    });
  });

  // I/O matrix: "Valueless with edges".
  it('refuses a valueless reference carrying edges — never sentinels', () => {
    expect(
      unrecognisedKeys({
        kind: 'valueless',
        statId: 'explicit.stat_9',
        valueMin: 0,
        valueMax: 9999,
      }),
    ).toEqual(expect.arrayContaining(['valueMin', 'valueMax']));
  });

  it('carries acceptedTier as an optional free string on both arms', () => {
    expect(
      ModifierRefSchema.parse({
        kind: 'banded',
        statId: 'explicit.stat_1',
        valueMin: 1,
        valueMax: 2,
        acceptedTier: 'not a tier name at all',
      }),
    ).toMatchObject({ acceptedTier: 'not a tier name at all' });

    expect(
      ModifierRefSchema.parse({
        kind: 'valueless',
        statId: 'explicit.stat_1',
        acceptedTier: 'T1',
      }),
    ).toMatchObject({ acceptedTier: 'T1' });
  });

  it('names its own kind, so a reference with no kind does not parse', () => {
    expect(
      ModifierRefSchema.safeParse({ statId: 'explicit.stat_1', valueMin: 1, valueMax: 2 }).success,
    ).toBe(false);
  });

  /**
   * AC: an exhaustive `switch` over the three kinds type-checks with **no
   * default arm**. `tsc -b` compiles this file; a fourth arm added to the union
   * without a case here is a compile error, not a runtime surprise.
   */
  it('exhausts every kind with no default arm', () => {
    function describeRef(ref: ModifierRef): string {
      switch (ref.kind) {
        case 'banded': {
          return `${ref.statId}:${String(ref.valueMin)}-${String(ref.valueMax)}`;
        }
        case 'valueless': {
          return `${ref.statId}:valueless`;
        }
        case 'hybrid': {
          return ref.lines.map((line) => line.statId).join('+');
        }
      }
    }

    expect(
      describeRef({ kind: 'banded', statId: 's', valueMin: 1, valueMax: 2 }),
    ).toBe('s:1-2');
    expect(describeRef({ kind: 'valueless', statId: 's' })).toBe('s:valueless');
    expect(describeRef({ kind: 'hybrid', lines: [{ statId: 'a' }, { statId: 'b' }] })).toBe('a+b');
  });
});

/** The Bows phys%+accuracy hybrid (SPEC-tracked-hybrid-mods CAP-1). */
const ACCURACY = 'explicit.stat_691932474';
const PHYS = 'explicit.stat_1509134228';

function hybrid(lines: unknown[], extra: Record<string, unknown> = {}): unknown {
  return { kind: 'hybrid', lines, ...extra };
}

describe('ModifierRefSchema, the hybrid arm (IMPLEMENTATION-NOTES §4.1)', () => {
  it('accepts a banded hybrid and sorts its lines by statId', () => {
    const parsed = ModifierRefSchema.parse(
      hybrid(
        [
          { statId: ACCURACY, valueMin: 16, valueMax: 20 },
          { statId: PHYS, valueMin: 25, valueMax: 34 },
        ],
        { acceptedTier: 'T1' },
      ),
    );
    expect(parsed).toEqual({
      kind: 'hybrid',
      lines: [
        { statId: PHYS, valueMin: 25, valueMax: 34 },
        { statId: ACCURACY, valueMin: 16, valueMax: 20 },
      ],
      acceptedTier: 'T1',
    });
  });

  it('accepts a hybrid that mixes a banded and a valueless line', () => {
    expect(
      ModifierRefSchema.safeParse(hybrid([{ statId: 'explicit.stat_1', valueMin: 1, valueMax: 2 }, { statId: 'explicit.stat_2' }]))
        .success,
    ).toBe(true);
  });

  it('rejects fewer than two lines at lines', () => {
    expect(issuePaths(hybrid([]))).toEqual(['lines']);
    expect(issuePaths(hybrid([{ statId: 'explicit.stat_1' }]))).toEqual(['lines']);
  });

  it('rejects a repeated statId at the line', () => {
    expect(issuePaths(hybrid([{ statId: 'explicit.stat_1' }, { statId: 'explicit.stat_1', valueMin: 1, valueMax: 2 }]))).toEqual([
      'lines.1.statId',
    ]);
  });

  it('rejects an empty statId at the line', () => {
    expect(issuePaths(hybrid([{ statId: '' }, { statId: 'explicit.stat_2' }]))).toEqual(['lines.0.statId']);
  });

  it.each([
    ['min > max', { valueMin: 3, valueMax: 2 }],
    ['a negative edge', { valueMin: -1, valueMax: 2 }],
    ['an infinite edge', { valueMin: 1, valueMax: Number.POSITIVE_INFINITY }],
    ['a NaN edge', { valueMin: Number.NaN, valueMax: 2 }],
    ['one edge only', { valueMin: 1 }],
  ])('rejects a line band with %s at the line', (_name, band) => {
    expect(issuePaths(hybrid([{ statId: 'explicit.stat_1', ...band }, { statId: 'explicit.stat_2' }]))).toEqual(['lines.0']);
  });

  it.each([
    ['kind', { kind: 'valueless' }],
    ['acceptedTier', { acceptedTier: 'T1' }],
  ])('rejects a line that carries %s (strict)', (_name, extra) => {
    expect(issuePaths(hybrid([{ statId: 'explicit.stat_1', ...extra }, { statId: 'explicit.stat_2' }]))).toEqual(['lines.0']);
  });
});
