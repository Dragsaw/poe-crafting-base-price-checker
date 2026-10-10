import { RECIPE_UNREACHABLE, type UnrankableClass, type UnrankableReason } from '@poe/core';
import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { mount, rgb, unmount } from '../test-support/dom';
import { colors, spacing, typeRoles } from '../theme/tokens';
import {
  APPENDIX_LEAD,
  APPENDIX_TITLE,
  APPENDIX_NOTES,
  appendixClassKey,
  appendixCount,
  NOTE_JOINER,
  RAW_RANKS_NOTE,
  UnrankableAppendix,
} from './UnrankableAppendix';

const REASON = 'class absent from weights file';

afterEach(unmount);

function klass(className: string, reason: UnrankableReason = REASON): UnrankableClass {
  return { categoryId: `c.${className.toLowerCase()}`, className, reason };
}

function mountAppendix(classes: readonly UnrankableClass[], rawRanks?: ReadonlySet<string>): HTMLElement {
  const container = mount(<UnrankableAppendix classes={classes} rawRanks={rawRanks} />);
  const panel = container.querySelector<HTMLElement>('[data-unrankable-appendix]');
  if (panel === null) {
    throw new Error('no appendix rendered');
  }
  return panel;
}

function count(panel: HTMLElement): HTMLElement {
  const found = panel.querySelector<HTMLElement>('[data-appendix-count]');
  if (found === null) {
    throw new Error('no count');
  }
  return found;
}

function cell(row: Element | null | undefined, name: string): HTMLElement | null | undefined {
  return row?.querySelector<HTMLElement>(`[data-cell="${name}"]`);
}

describe('the count', () => {
  it('reads N Item Classes, and 1 Item Class in the singular', () => {
    expect(appendixCount(0)).toBe('0 Item Classes');
    expect(appendixCount(1)).toBe('1 Item Class');
    expect(appendixCount(29)).toBe('29 Item Classes');
  });
});

describe('the block', () => {
  it('has a line-strong top rule, no surface fill, no side border and no mark', () => {
    const panel = mountAppendix([klass('Bows')]);
    expect(panel.style.borderTop).toBe(`1px solid ${rgb(colors['line-strong'])}`);
    expect(panel.style.background).toBe('');
    expect(panel.style.borderLeft).toBe('');
    expect(panel.querySelector('[data-mark], [data-trust-mark]')).toBeNull();
  });
});

describe('the empty appendix (state 37)', () => {
  it('is the title alone, with a neutral count', () => {
    const panel = mountAppendix([]);
    expect(panel.textContent).toBe(`${APPENDIX_TITLE}${appendixCount(0)}`);
    expect(count(panel).style.color).toBe(rgb(colors.text));
    expect(panel.querySelector('[data-appendix-lead]')).toBeNull();
    expect(panel.querySelectorAll('[data-appendix-row]')).toHaveLength(0);
  });
});

describe('the non-empty appendix', () => {
  it('titles in row-name with a neutral count, and leads in note, text-secondary', () => {
    const panel = mountAppendix([klass('Bows')]);
    const title = panel.querySelector<HTMLElement>('h2');
    expect(title?.textContent).toBe(`${APPENDIX_TITLE}${appendixCount(1)}`);
    expect(title?.style.fontSize).toBe(typeRoles['row-name'].fontSize);
    expect(title?.style.fontWeight).toBe(typeRoles['row-name'].fontWeight);
    expect(count(panel).style.color).toBe(rgb(colors.text));
    const lead = panel.querySelector<HTMLElement>('[data-appendix-lead]');
    expect(lead?.textContent).toBe(APPENDIX_LEAD);
    expect(lead?.style.fontSize).toBe(typeRoles.note.fontSize);
    expect(lead?.style.color).toBe(rgb(colors['text-secondary']));
  });

  it('renders every row, in the given order, on the blank rank · class · reason · note grid', () => {
    const classes = Array.from({ length: 29 }, (_, index) => klass(`Class ${String(index).padStart(2, '0')}`));
    const panel = mountAppendix(classes);
    const rows = [...panel.querySelectorAll<HTMLElement>('[data-appendix-row]')];
    expect(rows).toHaveLength(29);
    expect(rows.map((row) => row.querySelector('[data-appendix-class]')?.textContent)).toEqual(
      classes.map((item) => item.className),
    );
    for (const row of rows) {
      expect(row.style.height).toBe(spacing['line-height-expansion']);
      expect(row.style.gridTemplateColumns).toBe(
        `${spacing['col-rank']} ${spacing['col-name']} ${spacing['expansion-trust-cell']} minmax(0, 1fr)`,
      );
      expect(row.style.columnGap).toBe(spacing['col-gap']);
      expect(cell(row, 'rank')?.textContent).toBe('');
    }
    expect(count(panel).textContent).toBe(appendixCount(29));
  });

  // Matrix: underscored class. The web trims at render time (AD-5).
  it('prints an underscored class name with spaces and its defence suffix as words', () => {
    const panel = mountAppendix([klass('Body_Armours_dex_int')]);
    expect(panel.querySelector('[data-appendix-class]')?.textContent).toBe('Body Armours (Dex/Int)');
  });

  it('sets the class in magic, the reason verbatim in text-secondary and the note upright in text-tertiary', () => {
    const panel = mountAppendix([klass('Bows'), klass('Wands')]);
    for (const row of panel.querySelectorAll<HTMLElement>('[data-appendix-row]')) {
      const name = cell(row, 'class');
      expect(name?.style.color).toBe(rgb(colors['rarity-magic']));
      expect(name?.style.fontSize).toBe(typeRoles['line-text'].fontSize);
      const reason = cell(row, 'reason');
      expect(reason?.textContent).toBe(REASON);
      expect(reason?.style.color).toBe(rgb(colors['text-secondary']));
      expect(reason?.style.fontSize).toBe(typeRoles['line-text'].fontSize);
      const note = cell(row, 'note');
      expect(note?.style.color).toBe(rgb(colors['text-tertiary']));
      expect(note?.style.fontSize).toBe(typeRoles.note.fontSize);
      expect(note?.style.fontStyle).toBe('');
    }
    expect(panel.querySelector('[style*="italic"], [style*="700"]')).toBeNull();
  });

  it('drops the rule under the last row only', () => {
    const panel = mountAppendix([klass('Bows'), klass('Staves'), klass('Wands')]);
    const rows = [...panel.querySelectorAll<HTMLElement>('[data-appendix-row]')];
    expect(rows.map((row) => row.style.borderBottom)).toEqual([
      `1px solid ${rgb(colors.line)}`,
      `1px solid ${rgb(colors.line)}`,
      '',
    ]);
  });

  it('makes no row interactive: no role, tabindex, title, cursor, hover class or control', () => {
    const panel = mountAppendix([klass('Bows'), klass('Wands')]);
    expect(panel.querySelectorAll('button, a, input, [role], [tabindex], [title]')).toHaveLength(0);
    for (const row of panel.querySelectorAll<HTMLElement>('[data-appendix-row]')) {
      expect(row.className).toBe('');
      expect(row.style.cursor).toBe('');
      const before = panel.outerHTML;
      act(() => {
        row.click();
      });
      expect(panel.outerHTML).toBe(before);
    }
  });
});

const noteOf = (item: UnrankableClass, rawRanks?: ReadonlySet<string>): string =>
  cell(mountAppendix([item], rawRanks).querySelector('[data-appendix-row]'), 'note')?.textContent ?? '';

describe('the note cell (states 14 to 16, 36)', () => {
  it.each(['pool partial', 'class absent from weights file', 'class disagrees with weights file'] as const)(
    'prints the deck note for %s',
    (reason) => {
      expect(noteOf(klass('Bows', reason))).toBe(APPENDIX_NOTES[reason]);
    },
  );

  it('never names a check, an entry or a key on the 15a row', () => {
    expect(noteOf(klass('Bows', 'class disagrees with weights file'))).not.toMatch(
      /edge|containment|coOccur|kind-|discriminab|stat_|\[/i,
    );
  });

  // Matrix: pool partial + raw ranks.
  it('joins the state 16 note after the reason note when a Raw Base of the class ranks', () => {
    const item = klass('Bows', 'pool partial');
    expect(noteOf(item, new Set([appendixClassKey(item)]))).toBe(
      [APPENDIX_NOTES['pool partial'], RAW_RANKS_NOTE].join(NOTE_JOINER),
    );
    expect(noteOf(item, new Set([appendixClassKey(klass('Wands'))]))).toBe(APPENDIX_NOTES['pool partial']);
  });

  // Matrix: unreachable.
  it('prints the state 36 reason and no note, even when a base of the class ranks', () => {
    const item = { ...klass('Bows', RECIPE_UNREACHABLE), recipeId: 'greater' };
    const panel = mountAppendix([item], new Set([appendixClassKey(item)]));
    const row = panel.querySelector('[data-appendix-row]');
    expect(cell(row, 'reason')?.textContent).toBe(RECIPE_UNREACHABLE);
    expect(cell(row, 'note')?.textContent).toBe('');
  });
});
