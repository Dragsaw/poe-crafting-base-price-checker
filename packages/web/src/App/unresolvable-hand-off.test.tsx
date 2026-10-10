import { canonicalKey } from '@poe/contracts';
import { afterEach, describe, expect, it } from 'vitest';

import { absenceLine } from '../frame/AbsenceLines';
import { MISSING_FIGURE } from '../list/row/ExpectedValueCell';
import { bodiesWith, hoursBefore, rawEntry, unpriced } from '../test-support/list-fixtures';
import { serveArtifacts, TEST_LEAGUE, VALID_BODIES } from '../test-support/artifact-server';
import { rgb, settleTo, unmount } from '../test-support/dom';
import { colors } from '../theme/tokens';
import { server, mount, frame } from './test-support';

afterEach(unmount);

function lostRow(): HTMLElement {
  const rows = [...frame().querySelectorAll<HTMLElement>('[data-ranked-row]')];
  expect(rows).toHaveLength(1);
  const [row] = rows;
  if (row === undefined) {
    throw new Error('no row');
  }
  expect(row.querySelector('[data-unit-name]')?.textContent).toBe('Lost Ring');
  return row;
}

describe('the unresolvable hand-off (story 2.3 to story 2.6)', () => {
  const lost = rawEntry('Lost Ring');
  const bodies = bodiesWith([lost], [unpriced(lost, { state: 'unresolvable' }, hoursBefore(Date.now(), 1))]);

  // Matrix: report absent.
  it('renders the unresolvable row with sync-report.json absent, and the strip raises no health line', async () => {
    serveArtifacts(server, {
      tracked: { kind: 'json', body: bodies.tracked },
      dataset: { kind: 'json', body: bodies.dataset },
      syncReport: { kind: 'status', status: 404 },
    });
    mount();
    await settleTo('ready');
    // A lone unresolvable row makes the list honest-empty: its EV cell reads `—` beside ✕.
    expect(lostRow().querySelector('[data-cell="ev"]')?.textContent).toBe(MISSING_FIGURE);
    const strip = frame().querySelector<HTMLElement>('[data-trust-strip]');
    const lines = strip?.querySelectorAll('[data-absence-lines] p') ?? [];
    expect(Array.from(lines, (line) => line.textContent)).toEqual([absenceLine('syncReport')]);
    expect(strip?.querySelector('[data-health-line]')).toBeNull();
  });

  it('renders the row, and the health line counts the report record as before', async () => {
    serveArtifacts(server, {
      tracked: { kind: 'json', body: bodies.tracked },
      dataset: { kind: 'json', body: bodies.dataset },
      syncReport: {
        kind: 'json',
        body: {
          ...(VALID_BODIES.syncReport as object),
          records: [{ kind: 'unresolvable', entryKey: canonicalKey(lost), identifier: 'Lost Ring', identifierKind: 'baseTypeId' }],
        },
      },
    });
    mount();
    await settleTo('ready');
    // A lone unresolvable row makes the list honest-empty: its EV cell reads `—` beside ✕.
    expect(lostRow().querySelector('[data-cell="ev"]')?.textContent).toBe(MISSING_FIGURE);
    const health = frame().querySelector('[data-trust-strip] [data-health-line]');
    expect(health?.textContent?.replaceAll('\u{A0}', ' ')).toBe('× 1 unresolvable');
  });

  // Matrix: only unresolvable.
  it('lists a lone unresolvable row under the honest-empty statement', async () => {
    serveArtifacts(server, {
      tracked: { kind: 'json', body: bodies.tracked },
      dataset: { kind: 'json', body: bodies.dataset },
    });
    mount();
    await settleTo('ready');
    expect(lostRow().querySelector('[data-cell="rank"]')?.textContent).toBe('');
    const statementNode = frame().querySelector<HTMLElement>('[data-list-statement]');
    expect(statementNode?.dataset['listStatement']).toBe('honest-empty');
    // EXPERIENCE.md revision 9: a list of only unresolvable rows drops "yet".
    expect(statementNode?.textContent).toBe(`In canonical order, not ranked: no tracked unit has a price from ${TEST_LEAGUE}.`);
    const missing = lostRow().querySelector<HTMLElement>('[data-cell="ev"] [data-ev-missing]');
    expect(missing?.textContent).toBe(MISSING_FIGURE);
    expect(missing?.style.color).toBe(rgb(colors['text-tertiary']));
    expect(lostRow().querySelector<HTMLElement>('[data-row-mark]')?.dataset['rowMark']).toBe('broken');
  });
});
