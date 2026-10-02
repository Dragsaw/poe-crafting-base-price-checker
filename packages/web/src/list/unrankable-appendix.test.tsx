import type { UnrankableClass } from '@poe/core';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';

import { rgb } from '../test-support/dom';
import { colors, columnSums, glyphs, spacing } from '../theme/tokens';
import { HAIR_SPACE } from './TrustMark';
import { APPENDIX_LEAD, appendixCount, DISAGREES_NOTE, UnrankableAppendix } from './UnrankableAppendix';

const REASON = 'class absent from weights file';

let container: HTMLDivElement | undefined;
let root: Root | undefined;

afterEach(() => {
  const mounted = root;
  if (mounted !== undefined) {
    act(() => {
      mounted.unmount();
    });
  }
  root = undefined;
  container?.remove();
  container = undefined;
});

function klass(className: string, categoryId = `c.${className.toLowerCase()}`): UnrankableClass {
  return { categoryId, className, reason: REASON };
}

function mountAppendix(classes: readonly UnrankableClass[]): HTMLElement {
  container = document.createElement('div');
  document.body.append(container);
  const mounted = createRoot(container);
  root = mounted;
  act(() => {
    mounted.render(<UnrankableAppendix classes={classes} />);
  });
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

describe('the count', () => {
  it('reads N Item Classes, and 1 Item Class in the singular', () => {
    expect(appendixCount(0)).toBe('0 Item Classes');
    expect(appendixCount(1)).toBe('1 Item Class');
    expect(appendixCount(29)).toBe('29 Item Classes');
  });
});

describe('the empty appendix (state 37)', () => {
  it('is the title alone, the count in ink, padded 16px 20px 16px, with no lead, row or reason', () => {
    const panel = mountAppendix([]);
    expect(panel.textContent).toBe('Appendix: Unrankable — 0 Item Classes');
    expect(count(panel).style.color).toBe(rgb(colors.ink));
    expect(panel.style.padding).toBe('16px 20px');
    expect(panel.querySelector('[data-appendix-lead]')).toBeNull();
    expect(panel.querySelectorAll('[data-appendix-row]')).toHaveLength(0);
    expect(panel.style.background).toBe(rgb(colors['paper-inset']));
  });
});

describe('the non-empty appendix', () => {
  it('titles the count in rust, prints the lead, and pads 16px 20px 10px on paper-inset with a hairline', () => {
    const panel = mountAppendix([klass('Bows')]);
    expect(panel.querySelector('h2')?.textContent).toBe('Appendix: Unrankable — 1 Item Class');
    expect(count(panel).style.color).toBe(rgb(colors.rust));
    expect(panel.style.padding).toBe('16px 20px 10px');
    expect(panel.style.background).toBe(rgb(colors['paper-inset']));
    expect(panel.style.border).toBe(`1px solid ${rgb(colors['rule-hairline'])}`);
    const lead = panel.querySelector<HTMLElement>('[data-appendix-lead]');
    expect(lead?.textContent).toBe(APPENDIX_LEAD);
    expect(lead?.style.color).toBe(rgb(colors['ink-secondary']));
    expect(lead?.style.margin).toBe('5px 0px 12px');
  });

  it('renders every row, in the given order, 29px, in four cells of 292/118/250/310', () => {
    const classes = Array.from({ length: 29 }, (_, i) => klass(`Class ${String(i).padStart(2, '0')}`));
    const panel = mountAppendix(classes);
    const rows = Array.from(panel.querySelectorAll<HTMLElement>('[data-appendix-row]'));
    expect(rows).toHaveLength(29);
    expect(rows.map((row) => row.querySelector('[data-appendix-class]')?.textContent)).toEqual(
      classes.map((item) => item.className),
    );
    for (const row of rows) {
      expect(row.style.height).toBe(`${String(spacing.appendixRowHeight)}px`);
      const widths = Array.from(row.children, (child) => (child as HTMLElement).style.width);
      expect(widths).toEqual(columnSums.appendix.map((width) => `${String(width)}px`));
    }
    expect(count(panel).textContent).toBe('29 Item Classes');
  });

  // Matrix: underscored class. The web trims at render time (AD-5).
  it('prints an underscored class name with spaces', () => {
    const panel = mountAppendix([klass('Body_Armours_dex_int')]);
    expect(panel.querySelector('[data-appendix-class]')?.textContent).toBe('Body Armours dex int');
  });

  it('leads each row with the class glyph, marks it unknown, and prints the reason verbatim with an empty note', () => {
    const panel = mountAppendix([klass('Bows'), klass('Wands')]);
    for (const row of Array.from(panel.querySelectorAll<HTMLElement>('[data-appendix-row]'))) {
      const first = row.querySelector('[data-cell="class"]');
      expect(first?.firstElementChild?.getAttribute('data-unit-glyph')).toBe('class');
      expect(first?.firstElementChild?.textContent).toBe(glyphs.unitClass);
      expect(row.querySelector('[data-unit-glyph="raw"]')).toBeNull();
      const mark = row.querySelector('[data-cell="mark"] [data-trust-mark="unknown"]');
      expect(mark?.textContent).toBe(`${glyphs.unknown}${HAIR_SPACE}unknown`);
      expect(row.querySelector('[data-cell="reason"]')?.textContent).toBe(REASON);
      expect(row.querySelector('[data-cell="note"]')?.textContent).toBe('');
    }
  });

  it('drops the rule under the last row only', () => {
    const panel = mountAppendix([klass('Bows'), klass('Staves'), klass('Wands')]);
    const rows = Array.from(panel.querySelectorAll<HTMLElement>('[data-appendix-row]'));
    expect(rows.map((row) => row.style.borderBottom)).toEqual([
      `1px solid ${rgb(colors['rule-hairline'])}`,
      `1px solid ${rgb(colors['rule-hairline'])}`,
      '',
    ]);
  });

  it('truncates nothing: no row clips or ellipsises its class name', () => {
    const panel = mountAppendix([klass('Two Hand Maces')]);
    const name = panel.querySelector<HTMLElement>('[data-appendix-class]');
    expect(name?.style.textOverflow).toBe('');
    expect(name?.style.overflow).toBe('');
  });

  it('makes no row interactive: no role, tabindex, title, cursor, hover class or control', () => {
    const panel = mountAppendix([klass('Bows'), klass('Wands')]);
    expect(panel.querySelectorAll('button, a, input, [role], [tabindex], [title]')).toHaveLength(0);
    for (const row of Array.from(panel.querySelectorAll<HTMLElement>('[data-appendix-row]'))) {
      expect(row.className).toBe('');
      expect(row.style.cursor).toBe('');
      const before = panel.innerHTML;
      act(() => {
        row.click();
      });
      expect(panel.innerHTML).toBe(before);
    }
  });
});

describe('the note cell', () => {
  const note = (item: UnrankableClass): string =>
    mountAppendix([item]).querySelector('[data-cell="note"]')?.textContent ?? '';

  it('says the pool is published and complete and the disagreement is in the Tracked List, naming no check', () => {
    const text = note({ categoryId: 'c.bows', className: 'Bows', reason: 'class disagrees with weights file' });
    expect(text).toBe(DISAGREES_NOTE);
    expect(text).toMatch(/published and complete/);
    expect(text).toMatch(/Tracked List/);
    expect(text).not.toMatch(/edge|containment|coOccur|kind|discriminab|stat_|\[/i);
  });

  it('stays empty for the other reasons', () => {
    expect(note({ categoryId: 'c.bows', className: 'Bows', reason: 'class absent from weights file' })).toBe('');
  });

  it('keeps the unknown mark on a pool partial row carrying provenance absent', () => {
    const panel = mountAppendix([{ categoryId: 'c.bows', className: 'Bows', reason: 'pool partial', provenance: 'absent' }]);
    expect(panel.querySelector('[data-cell="mark"]')?.textContent).toBe(`${glyphs.unknown}${HAIR_SPACE}unknown`);
  });
});
