import { CatalogueStatsFileSchema, TrackedFileSchema } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import { combinationCellAtContentMin, cssNumber } from '../test-support/css-number';
import { typeRoles } from '../theme/tokens';
import { combinationString, combinationText, statTexts } from './combination-text';
import { CURATION_MARKS } from './format';

// An expansion line is `nowrap` and never cut, so overlong text would run into the price cell. jsdom lays out no text:
// the width is an estimate at 0.6em per character. Real widths: Story 2.5 Implementation Notes.
const committed = import.meta.glob<unknown>('../../../../test/fixtures/frozen-data/{tracked.json,catalogue/stats.json}', {
  eager: true,
  import: 'default',
});
const tracked = TrackedFileSchema.parse(committed['../../../../test/fixtures/frozen-data/tracked.json']);
const stats = statTexts(CatalogueStatsFileSchema.parse(committed['../../../../test/fixtures/frozen-data/catalogue/stats.json']));

const live = tracked.entries.flatMap((entry) => (entry.kind === 'crafted' && entry.status !== 'pruned' ? [entry] : []));
const texts = live.map((entry) => combinationText(entry, stats));

/** EXPERIENCE.md memlog 104: the chase cell's budget, in characters. */
const CHASE_BUDGET = 27;
const ADVANCE_EM = 0.6;

// Pairings over the 27-character budget: pruning candidates (EXPERIENCE.md, *Escape valve*).
// Listed in `docs/stories/deferred-work.md` (story 3.5); a change here must follow in that entry.
const PRUNING_CANDIDATES = [
  'T1 % Evasion · T1 Crit Chance',
  'T1 % Evasion · T1 Mana Regen',
  'T1 % Evasion · T1 Melee Skills',
  'T1 % Evasion · T1 Minion Skills',
  'T1 % Evasion · T1 Proj Skills',
  'T1 % Life · T1 Minion Skills',
  'T1 % Mana · T1 Minion Skills',
  'T1 Elem Atk Dmg · T1 +Crit Chance',
  'T1 Elem Atk Dmg · T1 +Crit Dmg',
  'T1 Elem Atk Dmg · T1 Atk Spd',
  'T1 Elem Atk Dmg · T1 Extra Bolt',
  'T1 Elem Atk Dmg · T1 Proj Skills',
  'T1 Flat Cold · T1 +Crit Chance',
  'T1 Flat Cold · T1 Extra Bolt',
  'T1 Flat Cold · T1 Proj Skills',
  'T1 Flat Fire · T1 +Crit Chance',
  'T1 Flat Fire · T1 Extra Bolt',
  'T1 Flat Fire · T1 Proj Skills',
  'T1 Flat Lightning · T1 +Crit Chance',
  'T1 Flat Lightning · T1 +Crit Dmg',
  'T1 Flat Lightning · T1 Atk Spd',
  'T1 Flat Lightning · T1 Extra Bolt',
  'T1 Flat Lightning · T1 Proj Skills',
  'T1 Flat Phys · T1 +Crit Chance',
  'T1 Flat Phys · T1 Extra Bolt',
  'T1 Flat Phys · T1 Proj Skills',
  'T1 Flat Phys · T1-T2 Extra Arrow',
  'T1 Flat Phys · T1-T2 Proj Skills',
  'T1 Rarity · T1 Minion Skills',
  'T1 Spell Dmg · T1 Crit Chance',
  'T1 Spell Dmg · T1 Mana Regen',
  'T1 Spell Dmg · T1 Melee Skills',
  'T1 Spell Dmg · T1 Minion Skills',
  'T1 Spell Dmg · T1 Proj Skills',
  'T1 Spirit · T1 Minion Skills',
  'T1-T2 % Phys · T1 +Crit Chance',
  'T1-T2 % Phys · T1-T2 Extra Arrow',
  'T1-T2 % Phys · T1-T2 Proj Skills',
  'T1-T2 Elem Atk Dmg · T1 +Crit Chance',
  'T1-T2 Elem Atk Dmg · T1 +Crit Dmg',
  'T1-T2 Elem Atk Dmg · T1 Atk Spd',
  'T1-T2 Elem Atk Dmg · T1-T2 Extra Arrow',
  'T1-T2 Elem Atk Dmg · T1-T2 Proj Skills',
  'T1-T2 Flat Cold · T1 +Crit Chance',
  'T1-T2 Flat Cold · T1 +Crit Dmg',
  'T1-T2 Flat Cold · T1 Atk Spd',
  'T1-T2 Flat Cold · T1-T2 Extra Arrow',
  'T1-T2 Flat Cold · T1-T2 Proj Skills',
  'T1-T2 Flat Fire · T1 +Crit Chance',
  'T1-T2 Flat Fire · T1 +Crit Dmg',
  'T1-T2 Flat Fire · T1 Atk Spd',
  'T1-T2 Flat Fire · T1-T2 Extra Arrow',
  'T1-T2 Flat Fire · T1-T2 Proj Skills',
  'T1-T2 Flat Lightning · T1 +Crit Chance',
  'T1-T2 Flat Lightning · T1 +Crit Dmg',
  'T1-T2 Flat Lightning · T1 Atk Spd',
  'T1-T2 Flat Lightning · T1-T2 Extra Arrow',
  'T1-T2 Flat Lightning · T1-T2 Proj Skills',
];

describe('the frozen Combination texts', () => {
  it('reads every crafted entry of the fixture in its curated form: no fallback, and no numeral but the tier', () => {
    expect(live.length).toBeGreaterThan(0);
    for (const parts of texts) {
      for (const part of parts) {
        expect(part.verbatim, part.text).toBe(false);
        expect(part.text.replace(/^T\d+(?:-T\d+)?\s/, ''), part.text).not.toMatch(/\d/);
      }
    }
  });

  it('fits the longest text, led by * pinned, inside the combination cell at content-min, at the line size', () => {
    const available = combinationCellAtContentMin();
    const fontSize = cssNumber(typeRoles['line-text'].fontSize);
    const longest = Math.max(...texts.map((parts) => `${CURATION_MARKS.pinned} ${combinationString(parts)}`.length));
    expect(available).toBe(464);
    expect(longest * ADVANCE_EM * fontSize).toBeLessThanOrEqual(available);
  });

  it('lists every chase pairing over the 27-character budget as a pruning candidate', () => {
    const over = new Set(
      texts.map((parts) => combinationString(parts)).filter((text) => text.length > CHASE_BUDGET),
    );
    expect([...over].toSorted((a, b) => Number(a > b) - Number(a < b))).toEqual(PRUNING_CANDIDATES.toSorted((a, b) => Number(a > b) - Number(a < b)));
  });
});
