import { describe, expect, it } from 'vitest';

import {
  colors,
  COLUMN_HEADER_HEIGHT,
  columnSums,
  combinationLine1Columns,
  combinationLine2Columns,
  floatingShadows,
  glyphs,
  layout,
  rankedRowGrid,
  REGULAR_ONLY_GLYPHS,
  rounded,
  spacing,
  stacks,
  typeRoles,
} from './tokens';

const design = Object.values(
  import.meta.glob<string>('../../../../docs/ux-designs/ux-poe-crafting-base-price-checker-2026-09-13/DESIGN.md', {
    eager: true,
    query: '?raw',
    import: 'default',
  }),
)[0];

type Section = Record<string, string | Record<string, string>>;

/** The frontmatter's top-level maps, two levels deep; enough for colours, type, radii and spacing. */
function frontmatter(text: string): Record<string, Section> {
  const yaml = text.split(/^---$/m, 2)[1] ?? '';
  const sections: Record<string, Section> = {};
  let section: Section | undefined;
  let group: Record<string, string> | undefined;
  for (const raw of yaml.split(/\r?\n/)) {
    const hash = raw.indexOf(' #');
    const line = (hash === -1 ? raw : raw.slice(0, hash)).trimEnd();
    const top = /^([a-z-]+):$/.exec(line);
    const entry = /^( {2}| {4})([A-Za-z-]+):(.*)$/.exec(line);
    if (top?.[1] !== undefined) {
      section = {};
      sections[top[1]] = section;
      group = undefined;
    } else if (entry !== null && section !== undefined) {
      const [, indent, key = '', rest = ''] = entry;
      const value = rest.trim();
      const unquoted = value.replace(/^'(.*)'$/, '$1');
      if (indent === '  ' && value === '') {
        group = {};
        section[key] = group;
      } else if (indent === '  ') {
        section[key] = unquoted;
        group = undefined;
      } else if (group !== undefined) {
        group[key] = unquoted;
      }
    } else if (line !== '' && !line.startsWith(' ')) {
      section = undefined;
    }
  }
  return sections;
}

const tokens = frontmatter(design ?? '');
const byName = (a: string, b: string): number => a.localeCompare(b);
const RETIRED = /^(surround|paper|ink|rule|edge|sepia|ochre|rust)(-|$)/;

describe('the DESIGN.md transcription', () => {
  it('reads DESIGN.md revision 19', () => {
    expect(design).toMatch(/^revision: 19$/m);
  });

  it('transcribes every colour exactly, and nothing else', () => {
    expect(colors).toEqual(tokens['colors']);
  });

  it('transcribes every radius and every spacing token exactly', () => {
    expect(rounded).toEqual(tokens['rounded']);
    expect(spacing).toEqual(tokens['spacing']);
    expect(Object.keys(spacing)).toHaveLength(15);
  });

  it('transcribes both stacks, Inter first in the sans stack', () => {
    const typography = tokens['typography'] ?? {};
    expect(typography['stack-sans']).toEqual({ fontFamily: stacks.sans });
    expect(typography['stack-mono']).toEqual({ fontFamily: stacks.mono });
    expect(stacks.sans.split(',', 1)[0]).toBe('Inter');
  });

  it('transcribes all seventeen type roles exactly, in the sans stack', () => {
    const typography = tokens['typography'] ?? {};
    const roles = Object.entries(typography).filter(([name]) => !name.startsWith('stack-'));
    expect(roles).toHaveLength(17);
    expect(Object.keys(typeRoles).toSorted(byName)).toEqual(roles.map(([name]) => name).toSorted(byName));
    for (const [name, role] of roles) {
      expect(typeRoles[name as keyof typeof typeRoles], name).toEqual({
        ...(role as Record<string, string>),
        fontFamily: stacks.sans,
      });
    }
  });
});

describe('the token set', () => {
  it('names no retired paper token', () => {
    for (const name of Object.keys(colors)) {
      expect(name).not.toMatch(RETIRED);
    }
  });

  it('declares a lineHeight on every role but the inline tier', () => {
    expect('lineHeight' in typeRoles.tier).toBe(false);
    const lined = Object.entries(typeRoles).filter(([key]) => key !== 'tier');
    for (const [name, role] of lined) {
      expect('lineHeight' in role ? role.lineHeight : undefined, name).toMatch(/^\d+(\.\d+)?$/);
      expect(role.fontSize, name).toMatch(/^\d+(\.5)?px$/);
    }
  });

  it('has no green and no success colour', () => {
    for (const [name, value] of Object.entries(colors)) {
      expect(name).not.toMatch(/green|success|^ok$/i);
      const [r = 0, g = 0, b = 0] = value.startsWith('#')
        ? [1, 3, 5].map((index) => Number.parseInt(value.slice(index, index + 2), 16))
        : (value.match(/\d+/g) ?? []).map(Number);
      expect(g - Math.max(r, b), `${name} ${value} reads green`).toBeLessThan(8);
    }
  });
});

const sum = (values: readonly number[]): number => values.reduce((a, b) => a + b, 0);

describe('the ranked-row grid', () => {
  it('lays rank, name and EV at their spacing widths and gives the chase column the rest', () => {
    expect(rankedRowGrid.gridTemplateColumns).toBe(
      `${spacing['col-rank']} ${spacing['col-name']} ${spacing['col-ev']} minmax(0, 1fr)`,
    );
    expect(rankedRowGrid.columnGap).toBe(spacing['col-gap']);
  });

  it('transcribes the column-header height and both floating shadows', () => {
    const components = tokens['components'] ?? {};
    expect(COLUMN_HEADER_HEIGHT).toBe((components['column-header'] as Record<string, string>)['height']);
    for (const name of ['mark-tooltip', 'ev-tooltip'] as const) {
      expect(floatingShadows[name], name).toBe((components[name] as Record<string, string>)['shadow']);
    }
  });
});

describe('the column contracts later stories replace', () => {

  it('holds every other verified sum', () => {
    expect(columnSums.interimControls).toEqual([
      layout.recipePanelWidth,
      layout.interimControlGap,
      layout.thresholdPanelWidth,
    ]);
    expect(sum(columnSums.combinationLine1)).toBe(966);
    expect(sum(columnSums.combinationLine2)).toBe(966);
    expect(sum(columnSums.tombstoneLine2)).toBe(966);
    expect(sum(columnSums.appendix)).toBe(970);
    expect(layout.contentWidth - 2 * layout.hairline - 2 * layout.appendixPadX).toBe(sum(columnSums.appendix));
    expect(combinationLine1Columns.map((column) => column.width)).toEqual([...columnSums.combinationLine1]);
    expect(combinationLine2Columns.map((column) => column.width)).toEqual([...columnSums.combinationLine2]);
  });

  it('keeps the combination row at 28 + 20 = 48 at minimum', () => {
    expect(layout.combinationRowHeight).toBe(layout.detailRowHeight + layout.combinationRowLine2Height);
  });
});

describe('the glyph vocabulary', () => {
  it('holds each mark once, and pins only ↗ to one weight', () => {
    const values = Object.values(glyphs);
    expect(new Set(values).size).toBe(values.length);
    expect(REGULAR_ONLY_GLYPHS).toEqual(['↗']);
  });
});
