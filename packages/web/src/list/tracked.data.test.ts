import { CatalogueStatsFileSchema, TrackedFileSchema } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import { combinationCellAtContentMin, cssNumber } from '../test-support/css-number';
import { typeRoles } from '../theme/tokens';
import { combinationString, combinationText, statTexts } from './combination-text';
import { CURATION_MARKS } from './format';
import { shortForm } from './short-forms';

/** The live data/tracked.json against the short-form table and the cell width (pnpm test:data). */
const committed = import.meta.glob<unknown>('../../../../data/{tracked.json,catalogue/stats.json}', {
  eager: true,
  import: 'default',
});
const tracked = TrackedFileSchema.parse(committed['../../../../data/tracked.json']);
const stats = statTexts(CatalogueStatsFileSchema.parse(committed['../../../../data/catalogue/stats.json']));

const live = tracked.entries.flatMap((entry) => (entry.kind === 'crafted' && entry.status !== 'pruned' ? [entry] : []));
const texts = live.map((entry) => combinationText(entry, stats));
const ADVANCE_EM = 0.6;

describe('the live data/tracked.json', () => {
  it('has a short form for every crafted statId', () => {
    const statIds = new Set(
      tracked.entries.flatMap((entry) =>
        entry.kind === 'crafted' ? [entry.prefix, entry.suffix].flatMap((reference) => (reference.kind === 'hybrid' ? reference.lines.map((line) => line.statId) : reference.statId)) : [],
      ),
    );
    expect(statIds.size).toBeGreaterThan(0);
    expect([...statIds].filter((statId) => shortForm(statId) === undefined)).toEqual([]);
  });

  it('reads every crafted entry in its curated form: no verbatim fallback', () => {
    expect(live.length).toBeGreaterThan(0);
    const fallbacks = texts.flatMap((parts) => parts.filter((part) => part.verbatim).map((part) => part.text));
    expect(fallbacks).toEqual([]);
  });

  it('fits the longest combination text, led by * pinned, inside the combination cell at content-min', () => {
    const available = combinationCellAtContentMin();
    const fontSize = cssNumber(typeRoles['line-text'].fontSize);
    const overlong = texts
      .map((parts) => `${CURATION_MARKS.pinned} ${combinationString(parts)}`)
      .filter((text) => text.length * ADVANCE_EM * fontSize > available);
    expect(overlong).toEqual([]);
  });
});
