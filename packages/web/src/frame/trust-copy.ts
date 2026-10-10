import { ARTIFACTS, type TolerableKey } from '../load/artifacts';

// The header and sync report words (EXPERIENCE.md, Copy Deck, *Sync report*).

export const UNKNOWN = 'unknown';
export const NOT_MEASURED = 'not measured';
export const NOT_COMMITTED_SUFFIX = ' (not committed)';

export const WEIGHTS_FILE_LABEL = 'Weights File';
export const LAST_SYNCED_LABEL = 'Last synced';
export const TRACKED_LIST_EDITED_LABEL = 'Tracked List last edited';

/** EXPERIENCE.md, Copy Deck: *Sync report* column headings, in order. */
export const PANEL_HEADINGS = ['Problems', 'Sync run', 'Weights coverage', 'Built from'] as const;

export const REQUESTS_LABEL = 'Requests';
export const PRICE_SEARCHES_LABEL = 'price searches';
export const LEAGUE_CHECKS_LABEL = 'league checks';
export const POOL_COVERAGE_LABEL = 'Pool coverage';
export const NOT_REACHED_TAIL = 'not reached in the last sync pass';
export const NOT_REACHED_TEXT = `entries ${NOT_REACHED_TAIL}`;
export const DIAGNOSIS_LEAD = 'Disagreements with the weights file';

/** EXPERIENCE.md, Copy Deck: the sync button's words. */
export const SYNCED_LABEL = 'Synced';
export const NOT_SYNCED_YET = 'Not synced yet';

const ABSENCE_LEAD = 'Not published';
/** What each absence costs the page (EXPERIENCE.md, Copy Deck, *Sync report*). */
const ABSENCE_CONSEQUENCE: Readonly<Record<TolerableKey, string>> = {
  syncReport: 'the sync report is unavailable.',
  weights: 'every crafted class is unrankable.',
  recipes: 'no crafted rows can be ranked.',
};
/** The absence lines appear in this order, and only for absent files. */
export const ABSENCE_ORDER = ['weights', 'recipes', 'syncReport'] as const satisfies readonly TolerableKey[];

function absenceBody(key: TolerableKey): string {
  return `${ARTIFACTS[key].path} — ${ABSENCE_CONSEQUENCE[key]}`;
}

export function absenceLine(key: TolerableKey): string {
  return `${ABSENCE_LEAD} ${absenceBody(key)}`;
}
