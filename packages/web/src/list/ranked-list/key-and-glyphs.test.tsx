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
  it('holds three columns, the first being Silence means healthy, and no curation marks', () => {
    const container = mount(<KeyBlock />);
    const columns = [...container.querySelectorAll('[data-key-column]')];
    expect(columns).toHaveLength(3);
    expect(columns.map((c) => c.firstElementChild?.textContent)).toEqual([...KEY_TITLES]);
    expect(KEY_TITLES[0]).toBe('Silence means healthy');
    const text = container.textContent;
    expect(text).toContain('nothing here is degraded');
    expect(text).toContain('never attempted — no request was ever issued');
    expect(text).not.toContain(glyphs.pruned);
    expect(text).not.toContain(glyphs.unitRaw);
    expect(text).not.toContain(glyphs.unitClass);
  });
});
