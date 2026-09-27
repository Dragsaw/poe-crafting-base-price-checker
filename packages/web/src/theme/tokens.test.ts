import { describe, expect, it } from 'vitest';

import {
  colors,
  columnSums,
  combinationLine1Columns,
  combinationLine2Columns,
  committedChrome,
  coOccurringReserve,
  glyphs,
  INKS,
  PAPER_TONES,
  px,
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

describe('the payout-threshold panel', () => {
  it('takes the mockup geometry: 13×15 padding, 4/10/7 gaps, a 4px track and an 11×14 marker centred on it', () => {
    expect([spacing.controlPanelPadY, spacing.controlPanelPadX]).toEqual([13, 15]);
    expect([spacing.thresholdValueGap, spacing.thresholdTrackGap, spacing.thresholdRangeGap]).toEqual([4, 10, 7]);
    expect(spacing.thresholdTrackHeight).toBe(4);
    expect([spacing.thresholdMarkerWidth, spacing.thresholdMarkerHeight]).toEqual([11, 14]);
    expect(spacing.thresholdMarkerRise).toBe((spacing.thresholdMarkerHeight - spacing.thresholdTrackHeight) / 2);
  });

  it('keeps the control group widths the spacing tokens name', () => {
    expect(columnSums.mastheadControls).toEqual([
      spacing.recipePanelWidth,
      spacing.mastheadControlGap,
      spacing.thresholdPanelWidth,
    ]);
  });
});

describe('the expansion panel and the combination row', () => {
  it('pads the panel 18/22/20 inside a 1px border, leaving 966 inside the content width', () => {
    expect([spacing.panelPadTop, spacing.panelPadX, spacing.panelPadBottom]).toEqual([18, 22, 20]);
    expect([spacing.panelSubMarginTop, spacing.panelSubMarginBottom]).toEqual([4, 13]);
    expect(spacing.contentWidth - 2 * spacing.hairline - 2 * spacing.panelPadX).toBe(966);
  });

  it('cuts line one as 460 + 250 + 116 + 116 + 24 and line two as 560 + 200 + 206, each 966', () => {
    const line1 = combinationLine1Columns.map((column) => column.width);
    const line2 = combinationLine2Columns.map((column) => column.width);
    expect(line1).toEqual([...columnSums.combinationLine1]);
    expect(line2).toEqual([...columnSums.combinationLine2]);
    expect(sum(line1)).toBe(966);
    expect(sum(line2)).toBe(966);
  });

  it('pads every text cell 12px on the right, and the trade-link cell not at all', () => {
    for (const column of [...combinationLine1Columns, ...combinationLine2Columns]) {
      expect(column.padRight, column.name).toBe(column.name === 'trade-link' ? 0 : spacing.padCombinationCellRight);
    }
    expect(spacing.padCombinationCellRight).toBe(12);
  });

  it('is 28 + 20 = 48 at minimum, and line two steps by its absolute 20px lineHeight', () => {
    expect(spacing.detailRowHeight).toBe(28);
    expect(spacing.combinationRowLine2Height).toBe(20);
    expect(spacing.combinationRowHeight).toBe(spacing.detailRowHeight + spacing.combinationRowLine2Height);
    expect(typeRoles['combination-line-2'].lineHeight).toBe(px(spacing.combinationRowLine2Height));
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

  it('gives each absence line its own 21px frameReserveAbsenceLine entry', () => {
    expect(spacing.frameReserveAbsenceLine).toBe(21);
    const absence = reservedChrome.filter((line) => line.block.startsWith('absence line'));
    expect(absence.map((line) => line.block)).toEqual([
      'absence line: weights.json',
      'absence line: recipes.json',
      'absence line: sync-report.json',
    ]);
    for (const line of absence) {
      expect(line.px).toBe(spacing.frameReserveAbsenceLine);
    }
  });

  it('counts a 95px co-occurring worst case, and caps the sync report inside what it leaves', () => {
    expect(coOccurringReserve).toBe(95);
    expect(sumPx(committedChrome) + coOccurringReserve).toBe(1485);
    expect(spacing.syncReportMaxHeight).toBe(400);
    expect(spacing.syncReportMaxHeight).toBeLessThanOrEqual(spacing.frameSlack - coOccurringReserve);
  });
});

describe('the trust strip and the sync report panel', () => {
  it('rests at 68px: two 11.5px × 1.85 lines inside 11/12 padding and two hairlines', () => {
    const line = parseFloat(typeRoles['trust-strip'].fontSize) * parseFloat(typeRoles['trust-strip'].lineHeight);
    const height = 2 * spacing.hairline + spacing.trustStripPadTop + spacing.trustStripPadBottom + 2 * line;
    expect(Math.round(height)).toBe(68);
    expect(committedChrome.find((block) => block.block === 'trust strip')?.px).toBe(68);
    expect(spacing.trustSeparatorPadX).toBe(9);
  });

  it('pads the panel 14/16/12, gaps its columns 22px and its groups 8px', () => {
    expect([spacing.syncReportPadTop, spacing.syncReportPadX, spacing.syncReportPadBottom]).toEqual([14, 16, 12]);
    expect(spacing.syncReportColumnGap).toBe(22);
    expect(spacing.syncReportGroupGap).toBe(spacing.s2);
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
