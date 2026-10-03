import { TrackedFileSchema } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import { SHORT_FORMS, shortForm } from './short-forms';

const committed = import.meta.glob<unknown>('../../../../data/tracked.json', { eager: true, import: 'default' });
const tracked = TrackedFileSchema.parse(committed['../../../../data/tracked.json']);

describe('the short-form table', () => {
  it('gives no two modifiers one form (coinage rule 3), but for a Local variant that shares its global twin’s form', () => {
    // A jewel or ring rolls the global modifier and a weapon the Local one; to the player they are one stat.
    const LOCAL_VARIANTS = new Set(['explicit.stat_210067635']);
    const forms = Object.entries(SHORT_FORMS)
      .filter(([statId]) => !LOCAL_VARIANTS.has(statId))
      .map(([, form]) => form);
    expect(new Set(forms).size).toBe(forms.length);
    for (const statId of LOCAL_VARIANTS) {
      expect(forms).toContain(SHORT_FORMS[statId]);
    }
  });

  it('holds no value and no tier in a form, and no stray whitespace', () => {
    for (const [statId, form] of Object.entries(SHORT_FORMS)) {
      expect(form, statId).not.toMatch(/\d/);
      expect(form, statId).toBe(form.trim());
      expect(form, statId).not.toMatch(/\s{2}/);
      expect(form, statId).not.toContain('·');
    }
  });

  it('keys every form by a trade explicit stat id', () => {
    for (const statId of Object.keys(SHORT_FORMS)) {
      expect(statId).toMatch(/^explicit\.stat_\d+$/);
    }
  });

  it('has a form for every statId in the committed data/tracked.json', () => {
    const statIds = new Set(
      tracked.entries.flatMap((entry) =>
        entry.kind === 'crafted' ? [entry.prefix, entry.suffix].flatMap((ref) => (ref === undefined ? [] : [ref.statId])) : [],
      ),
    );
    expect(statIds.size).toBeGreaterThan(0);
    expect([...statIds].filter((statId) => shortForm(statId) === undefined)).toEqual([]);
  });

  it('answers undefined for an id it does not hold, including an inherited property name', () => {
    expect(shortForm('explicit.stat_0')).toBeUndefined();
    expect(shortForm('toString')).toBeUndefined();
  });
});
