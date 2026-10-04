import { CatalogueStatsFileSchema, TrackedFileSchema } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import { cssNumber } from '../test-support/css-number';
import { combinationLine1Columns, glyphs, typeRoles } from '../theme/tokens';
import { combinationString, combinationText, statTexts } from './combination-text';

/**
 * The fit check over the frozen data fixture (the Story 2.5 AC, discharged here).
 * The live data/ runs the same fit check in `tracked.data.test.ts`.
 * Line one of a combination row is `nowrap` in fixed cells, so an overlong
 * text would run into the state cell instead of wrapping. jsdom lays out no
 * text, so the width is an estimate, not a guarantee: every character is
 * taken at a full monospace advance, 0.6em, wider than the serif's average
 * advance, though a serif capital, `*` or `·` can exceed it. The real-width
 * evidence is the agent-browser measurement recorded in the spec's
 * Implementation Notes.
 */
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

/**
 * Every committed chase pairing over the 27-character budget: candidates for
 * pruning, not for a shorter coinage (EXPERIENCE.md, *Escape valve*). Listed
 * in `docs/stories/deferred-work.md` (story 3.5). A change here is a change
 * to the Tracked List, so the ledger entry must follow it.
 */
const PRUNING_CANDIDATES = [
  'T1 % Evasion · T1 Crit Chance',
  'T1 % Evasion · T1 Mana Regen',
  'T1 % Evasion · T1 Melee Skills',
  'T1 % Evasion · T1 Minion Skills',
  'T1 % Evasion · T1 Proj Skills',
  'T1 % Evasion · T1 Spell Skills',
  'T1 % Life · T1 Minion Skills',
  'T1 % Mana · T1 Minion Skills',
  'T1 Ele Atk Dmg · T1 +Crit Chance',
  'T1 Ele Atk Dmg · T1 +Crit Dmg',
  'T1 Ele Atk Dmg · T1 Extra Bolt',
  'T1 Ele Atk Dmg · T1 Proj Skills',
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
  'T1 Spell Dmg · T1 Spell Skills',
  'T1 Spirit · T1 Minion Skills',
  'T1-T2 % Phys · T1 +Crit Chance',
  'T1-T2 % Phys · T1-T2 Extra Arrow',
  'T1-T2 % Phys · T1-T2 Proj Skills',
  'T1-T2 Ele Atk Dmg · T1 +Crit Chance',
  'T1-T2 Ele Atk Dmg · T1 +Crit Dmg',
  'T1-T2 Ele Atk Dmg · T1 Atk Spd',
  'T1-T2 Ele Atk Dmg · T1-T2 Extra Arrow',
  'T1-T2 Ele Atk Dmg · T1-T2 Proj Skills',
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

  it('fits the longest text, led by * pinned, inside the 460px combination cell less its 12px pad, at line one’s size', () => {
    const [cell] = combinationLine1Columns;
    const available = cell.width - cell.padRight;
    const fontSize = cssNumber(typeRoles['detail-row'].fontSize);
    const longest = Math.max(...texts.map((parts) => `${glyphs.pinned} pinned ${combinationString(parts)}`.length));
    expect(available).toBe(448);
    expect(longest * ADVANCE_EM * fontSize).toBeLessThanOrEqual(available);
  });

  it('lists every chase pairing over the 27-character budget as a pruning candidate', () => {
    const over = new Set(
      texts.map((parts) => combinationString(parts)).filter((text) => text.length > CHASE_BUDGET),
    );
    expect([...over].toSorted((a, b) => Number(a > b) - Number(a < b))).toEqual(PRUNING_CANDIDATES.toSorted((a, b) => Number(a > b) - Number(a < b)));
  });
});
