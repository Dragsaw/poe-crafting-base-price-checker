import { describe, expect, it } from 'vitest';

import {
  colors,
  columnSums,
  committedChrome,
  glyphs,
  INKS,
  PAPER_TONES,
  rankedRowColumns,
  REGULAR_ONLY_GLYPHS,
  reservedChrome,
  RULES,
  SEMANTIC_INKS,
  spacing,
  stacks,
  sumPx,
  typeRoles,
} from './tokens';

const sum = (values: readonly number[]): number => values.reduce((a, b) => a + b, 0);

describe('colour tokens', () => {
  it('has five paper tones, four inks, three rules, one sepia and exactly two semantic inks', () => {
    expect(PAPER_TONES).toHaveLength(5);
    expect(INKS).toHaveLength(4);
    expect(RULES).toHaveLength(3);
    expect(SEMANTIC_INKS).toEqual(['ochre', 'rust']);
    expect(colors.sepia).toBe('#6B4A22');
  });

  it('declares nothing beyond those groups, sepia and the surround', () => {
    const grouped = new Set<string>([
      ...PAPER_TONES,
      ...INKS,
      ...RULES,
      ...SEMANTIC_INKS,
      'sepia',
      'surround',
    ]);
    expect(new Set(Object.keys(colors))).toEqual(grouped);
  });

  it('has no green and no success colour', () => {
    for (const [name, hex] of Object.entries(colors)) {
      expect(name).not.toMatch(/green|success|ok/i);
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      // green-dominant: the green channel above both others by a visible margin
      expect(g - Math.max(r, b), `${name} ${hex} reads green`).toBeLessThan(8);
    }
  });
});

describe('the frame and its column contracts', () => {
  it('holds 1012 = 1060 − 2 × 24', () => {
    expect(spacing.frameWidth - 2 * spacing.framePaddingX).toBe(spacing.contentWidth);
    expect(spacing.contentWidth).toBe(1012);
  });

  it('sums the six ranked-row columns to the content width, exactly', () => {
    expect(rankedRowColumns.map((column) => column.width)).toEqual([32, 222, 84, 88, 94, 492]);
    expect(sum(rankedRowColumns.map((column) => column.width))).toBe(spacing.contentWidth);
  });

  it('holds every other verified sum', () => {
    expect(sum(columnSums.mastheadControls)).toBe(508);
    expect(spacing.contentWidth - sum(columnSums.mastheadControls) - 24).toBe(spacing.dekMaxWidth);
    expect(sum(columnSums.combinationLine1)).toBe(966);
    expect(sum(columnSums.combinationLine2)).toBe(966);
    expect(sum(columnSums.tombstoneLine2)).toBe(966);
    expect(sum(columnSums.appendix)).toBe(970);
  });
});

describe('the vertical budget', () => {
  it('commits 1390px, and the frame-slack token is exactly what is left', () => {
    expect(sumPx(committedChrome)).toBe(1390);
    // UX memlog 210: the frontmatter now reads 530, which is 1920 − 1390.
    expect(spacing.frameSlack).toBe(530);
    expect(spacing.frameSlack).toBe(spacing.frameHeight - sumPx(committedChrome));
  });

  it('keeps committed chrome plus every reserve inside the frame height', () => {
    expect(sumPx(committedChrome) + sumPx(reservedChrome)).toBeLessThanOrEqual(spacing.frameHeight);
  });

  it('gives each absence line its own 21px entry, the same as the health line', () => {
    const absence = reservedChrome.filter((line) => line.block.startsWith('absence line'));
    expect(absence.map((line) => line.block)).toEqual([
      'absence line: weights.json',
      'absence line: recipes.json',
      'absence line: sync-report.json',
    ]);
    for (const line of absence) {
      expect(line.px).toBe(spacing.frameReserveHealthLine);
    }
  });
});

describe('type roles', () => {
  it('uses three system stacks and downloads no font', () => {
    expect(Object.keys(stacks)).toEqual(['serif', 'sans', 'mono']);
    for (const stack of Object.values(stacks)) {
      expect(stack).not.toMatch(/url\(|@font-face/);
    }
  });

  it('gives every role a literal px size and an explicit lineHeight', () => {
    for (const [name, role] of Object.entries(typeRoles)) {
      expect(role.fontSize, name).toMatch(/^\d+(\.5)?px$/);
      expect(role.lineHeight, name).toMatch(/^(\d+(\.\d+)?|\d+px)$/);
      expect(Object.values(stacks), name).toContain(role.fontFamily);
    }
  });

  it('keeps every in-row role at 1.2 so the 28px row holds', () => {
    for (const name of ['row-rank', 'row-unit-name', 'row-ev', 'row-mark', 'row-chase', 'money-phrase'] as const) {
      expect(typeRoles[name].lineHeight).toBe('1.2');
    }
  });
});

describe('the glyph vocabulary', () => {
  it('holds each mark once, and pins only ↗ to one weight', () => {
    const values = Object.values(glyphs);
    expect(new Set(values).size).toBe(values.length);
    expect(REGULAR_ONLY_GLYPHS).toEqual(['↗']);
  });

  it('uses the resident twins, not the retired fallbacks', () => {
    expect(glyphs.notYetSynced).toBe('∆');
    expect(glyphs.prior).toBe('◊');
    expect(glyphs.unresolvable).toBe('×');
    expect(glyphs.close).toBe('−');
  });
});
