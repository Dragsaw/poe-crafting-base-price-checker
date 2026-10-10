import { afterEach, describe, expect, it } from 'vitest';

import { mount, rgb, unmount } from '../../test-support/dom';
import { colors, glyphs } from '../../theme/tokens';
import { KEY_TITLES, KeyBlock } from '../KeyBlock';
import { HAIR_SPACE } from '../TrustMark';
import { UnitGlyph } from '../UnitGlyph';

afterEach(unmount);

describe('the trust mark and the unit glyphs', () => {
  it('separates glyph and word with a U+200A hair space', () => {
    expect(HAIR_SPACE).toBe('\u{200A}');
  });

  it('renders the class glyph ≡ in text-tertiary', () => {
    const container = mount(<UnitGlyph unit="class" />);
    const glyph = container.querySelector<HTMLElement>('[data-unit-glyph="class"]');
    expect(glyph?.textContent).toBe(glyphs.unitClass);
    expect(glyph?.style.color).toBe(rgb(colors['text-tertiary']));
  });
});

describe('the key block', () => {
  // Story 4.3 retires the row's Provenance cell, so its key lines go; Story 4.6 retires the rest.
  it('holds one column of provenance marks, with no prior-only, unit, curation or age line', () => {
    const container = mount(<KeyBlock />);
    const columns = [...container.querySelectorAll('[data-key-column]')];
    expect(columns).toHaveLength(1);
    expect(columns.map((c) => c.firstElementChild?.textContent)).toEqual([...KEY_TITLES]);
    const text = container.textContent;
    expect(text).not.toContain('prior only');
    expect(text).not.toContain(glyphs.prior);
    expect(text).not.toContain('Provenance cell');
    expect(text).not.toContain('Age cell');
    expect(text).not.toContain('never attempted');
    expect(text).not.toContain(glyphs.unitRaw);
    expect(text).not.toContain(glyphs.unitClass);
  });
});
