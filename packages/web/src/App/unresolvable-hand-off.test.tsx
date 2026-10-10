import { canonicalKey } from '@poe/contracts';
import { afterEach, describe, expect, it } from 'vitest';

import { absenceLine, PANEL_HEADINGS } from '../frame/trust-copy';
import { MISSING_FIGURE } from '../list/row/ExpectedValueCell';
import { bodiesWith, hoursBefore, rawEntry, unpriced } from '../test-support/list-fixtures';
import { serveArtifacts, TEST_LEAGUE, VALID_BODIES } from '../test-support/artifact-server';
import { rgb, settleTo, unmount } from '../test-support/dom';
import { colors } from '../theme/tokens';
import { server, mount, frame, panelLines, syncButton, toggleReport } from './test-support';

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
  // I/O matrix: report absent. The count still comes from the dataset (AD-12).
  it('renders the unresolvable row with sync-report.json absent, and the button counts the broken entry', async () => {
    serveArtifacts(server, {
      tracked: { kind: 'json', body: bodies.tracked },
      dataset: { kind: 'json', body: bodies.dataset },
      syncReport: { kind: 'status', status: 404 },
    });
    mount();
    await settleTo('ready');
    // A lone unresolvable row makes the list honest-empty: its EV cell reads `—` beside ✕.
    expect(lostRow().querySelector('[data-cell="ev"]')?.textContent).toBe(MISSING_FIGURE);
    expect(syncButton().dataset['syncButton']).toBe('problem');
    expect(syncButton().textContent).toBe('1 problem');
    expect(syncButton().querySelector('[data-problem-count="broken"] svg[data-mark="broken"]')).not.toBeNull();
    toggleReport();
    expect(panelLines(PANEL_HEADINGS.indexOf('Built from')).at(-1)).toBe(absenceLine('syncReport'));
  });

  it('counts the dataset entry, not the report record that names it', async () => {
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
    expect(syncButton().dataset['syncButton']).toBe('problem');
    expect(syncButton().textContent).toBe('1 problem');
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
