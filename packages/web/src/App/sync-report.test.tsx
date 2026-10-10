import type { TrackedEntry } from '@poe/contracts';
import { MINUTE_MS } from '@poe/core';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { absenceLine, NOT_SYNCED_YET, PANEL_HEADINGS, SYNCED_LABEL, TRACKED_LIST_EDITED_LABEL, UNKNOWN } from '../frame/trust-copy';
import { MARK_COLORS } from '../marks/marks';
import { serveArtifacts, VALID_BODIES, type ArtifactAnswer } from '../test-support/artifact-server';
import { ARTIFACT_ORDER, type ArtifactKey } from '../load/artifacts';
import { rgb, settleTo, unmount } from '../test-support/dom';
import { bodiesWith, hoursBefore, priced, rawEntry, unpriced } from '../test-support/list-fixtures';
import { RECIPES } from '../recipe/craft-recipe/test-support';
import { pastDebounce, typeInto } from '../test-support/threshold-input';
import { server, mount, frame, panelLines, payoutField, reportPanel, syncButton, toggleReport } from './test-support';

afterEach(() => {
  unmount();
  vi.restoreAllMocks();
});

const BUILT_FROM = PANEL_HEADINGS.indexOf('Built from');
const PROBLEMS = PANEL_HEADINGS.indexOf('Problems');

interface World {
  readonly broken?: number;
  readonly pinned?: number;
  readonly records?: readonly unknown[];
  readonly report?: Partial<Record<string, unknown>> | 'absent';
  readonly answers?: Partial<Record<ArtifactKey, ArtifactAnswer>>;
}

/** One priced base, `broken` lost bases and `pinned` pinned bases; the report finished 40 minutes ago. */
function serveWorld({ broken = 0, pinned = 0, records = [], report = {}, answers = {} }: World = {}): ReturnType<typeof serveArtifacts> {
  const now = Date.now();
  const kept = rawEntry('Wide Belt');
  const lost = Array.from({ length: broken }, (_, index) => rawEntry(`Lost Ring ${String(index)}`));
  const pins: TrackedEntry[] = Array.from({ length: pinned }, (_, index) => ({ ...rawEntry(`Pinned Amulet ${String(index)}`), status: 'pinned' }));
  const bodies = bodiesWith(
    [kept, ...lost, ...pins],
    [
      priced(kept, 2, hoursBefore(now, 1)),
      ...lost.map((entry) => unpriced(entry, { state: 'unresolvable' }, hoursBefore(now, 1))),
      ...pins.map((entry) => priced(entry, 3, hoursBefore(now, 1))),
    ],
  );
  const syncReport: ArtifactAnswer =
    report === 'absent'
      ? { kind: 'status', status: 404 }
      : {
          kind: 'json',
          body: {
            ...(VALID_BODIES.syncReport as object),
            runStartedAt: new Date(now - 41 * MINUTE_MS).toISOString(),
            runFinishedAt: new Date(now - 40 * MINUTE_MS - 30_000).toISOString(),
            records,
            ...report,
          },
        };
  return serveArtifacts(server, {
    tracked: { kind: 'json', body: bodies.tracked },
    dataset: { kind: 'json', body: bodies.dataset },
    syncReport,
    ...answers,
  });
}

/** A `pinned-starvation` record for six pins under the default `minChunkSearches: 1`. */
const starvation = (pinnedRefreshed: number): unknown => ({
  kind: 'pinned-starvation',
  discoveredAllowance: 1,
  declaredMinChunkSearches: 1,
  pinnedCount: 6,
  pinnedRefreshed,
  activeRefreshed: 0,
});

const STALE_UNRESOLVABLE = Array.from({ length: 5 }, (_, index) => ({
  kind: 'unresolvable',
  entryKey: `raw:Old ${String(index)}`,
  identifier: `Old ${String(index)}`,
  identifierKind: 'baseTypeId',
}));

function face(): { kind: string | undefined; text: string; mark: string | undefined } {
  return {
    kind: syncButton().dataset['syncButton'],
    text: syncButton().textContent,
    mark: syncButton().querySelector<HTMLElement>('[data-problem-count]')?.dataset['problemCount'],
  };
}

describe('the sync button (states 30, 31)', () => {
  it('reads Synced and a compact age when healthy, and nothing else (state 30)', async () => {
    serveWorld();
    mount();
    await settleTo('ready');
    expect(face()).toEqual({ kind: 'synced', text: `${SYNCED_LABEL} 40m ago`, mark: undefined });
    // The open sign is the only drawing: no dot, no count, no colour of its own.
    expect([...syncButton().querySelectorAll('svg')].map((svg) => svg.dataset['mark'])).toEqual(['open-sign']);
    expect(syncButton().textContent).not.toMatch(/problem|0 /);
  });

  it('counts the broken dataset entries, never the report records, led by ✕ in the broken colour (state 31)', async () => {
    serveWorld({ broken: 2, records: STALE_UNRESOLVABLE });
    mount();
    await settleTo('ready');
    expect(face()).toEqual({ kind: 'problem', text: '2 problems', mark: 'broken' });
    const count = syncButton().querySelector<HTMLElement>('[data-problem-count]');
    expect(count?.style.color).toBe(rgb(MARK_COLORS.broken));
    expect(count?.style.fontWeight).toBe('600');
    expect(count?.querySelector('svg[data-mark="broken"]')).not.toBeNull();
    expect(syncButton().textContent).not.toContain(SYNCED_LABEL);
  });

  it('counts starved pins from the matching record, led by ◐ when nothing is broken', async () => {
    serveWorld({ pinned: 6, records: [starvation(5)] });
    mount();
    await settleTo('ready');
    expect(face()).toEqual({ kind: 'problem', text: '1 problem', mark: 'rough' });
    expect(syncButton().querySelector<HTMLElement>('[data-problem-count]')?.style.color).toBe(rgb(MARK_COLORS.rough));
  });

  it('counts a starvation that left out nothing as one, and prints its own line', async () => {
    serveWorld({ pinned: 6, records: [starvation(6)] });
    mount();
    await settleTo('ready');
    expect(face()).toEqual({ kind: 'problem', text: '1 problem', mark: 'rough' });
    toggleReport();
    expect(panelLines(PROBLEMS)).toEqual(['6 pinned entries take every search, so nothing else rotates']);
  });

  it('stays healthy for a stale record whose curation differs', async () => {
    serveWorld({ pinned: 5, records: [starvation(1)] });
    mount();
    await settleTo('ready');
    expect(face().kind).toBe('synced');
  });

  it('reads Not synced yet with sync-report.json absent and nothing broken', async () => {
    serveWorld({ report: 'absent' });
    mount();
    await settleTo('ready');
    expect(face()).toEqual({ kind: 'not-synced', text: NOT_SYNCED_YET, mark: undefined });
  });

  it('counts the broken dataset entries with sync-report.json absent, and the panel reads unknown', async () => {
    serveWorld({ report: 'absent', broken: 3 });
    mount();
    await settleTo('ready');
    expect(face()).toEqual({ kind: 'problem', text: '3 problems', mark: 'broken' });
    toggleReport();
    expect(panelLines(PANEL_HEADINGS.indexOf('Sync run'))).toEqual([`Requests ${UNKNOWN}`, `${UNKNOWN} entries not reached in the last sync pass`]);
    expect(panelLines(BUILT_FROM).at(-1)).toBe(absenceLine('syncReport'));
  });

  it('never counts an absent tolerable file', async () => {
    serveWorld({ answers: { weights: { kind: 'status', status: 404 } } });
    mount();
    await settleTo('ready');
    expect(face().kind).toBe('synced');
    toggleReport();
    expect(panelLines(BUILT_FROM).slice(2)).toEqual([absenceLine('weights')]);
  });
});

describe('the sync report (Interaction 5, state 32)', () => {
  it('is closed on load, opens under the header bar on a click, pushes the list down, and closes on the second', async () => {
    const requests = serveWorld({ broken: 1 });
    mount();
    await settleTo('ready');
    expect(reportPanel()).toBeNull();
    expect(syncButton().getAttribute('aria-expanded')).toBe('false');
    toggleReport();
    const panel = reportPanel();
    expect(panel?.previousElementSibling?.hasAttribute('data-header-bar')).toBe(true);
    expect(panel?.nextElementSibling?.hasAttribute('data-ranked-list')).toBe(true);
    expect(syncButton().dataset['open']).toBe('');
    expect(syncButton().getAttribute('aria-expanded')).toBe('true');
    expect(panelLines(PROBLEMS)).toEqual(['1 entry can no longer be priced']);
    toggleReport();
    expect(reportPanel()).toBeNull();
    expect(syncButton().dataset['open']).toBeUndefined();
    expect(requests).toHaveLength(ARTIFACT_ORDER.length);
  });

  it('scrolls the page to the top when it opens on a scrolled page', async () => {
    serveWorld();
    mount();
    await settleTo('ready');
    const scrollTo = vi.spyOn(globalThis, 'scrollTo').mockImplementation(() => {});
    vi.spyOn(globalThis, 'scrollY', 'get').mockReturnValue(600);
    toggleReport();
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
    scrollTo.mockClear();
    toggleReport();
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('prints Built from with a missing Tracked List date as unknown', async () => {
    const figures = { ...(VALID_BODIES.syncReport as { figures: object }).figures, trackedListEditedAt: undefined };
    serveWorld({ report: { figures } });
    mount();
    await settleTo('ready');
    toggleReport();
    expect(panelLines(BUILT_FROM)[1]).toMatch(new RegExp(`${TRACKED_LIST_EDITED_LABEL} ${UNKNOWN}$`));
  });

  it('stays open across a threshold change and a recipe switch, with no request', async () => {
    const requests = serveWorld({ answers: { recipes: { kind: 'json', body: { schemaVersion: '1.0.0', recipes: RECIPES } } } });
    mount();
    await settleTo('ready');
    toggleReport();
    typeInto(payoutField(), '1');
    await pastDebounce();
    expect(reportPanel()).not.toBeNull();
    act(() => {
      frame().querySelector<HTMLElement>('[data-recipe-option="perfect"]')?.click();
    });
    expect(frame().querySelector('[data-recipe-option="perfect"]')?.hasAttribute('data-active')).toBe(true);
    expect(reportPanel()).not.toBeNull();
    expect(requests).toHaveLength(ARTIFACT_ORDER.length);
  });

  it('starts closed again after a reload', async () => {
    serveWorld();
    mount();
    await settleTo('ready');
    toggleReport();
    unmount();
    serveWorld();
    mount();
    await settleTo('ready');
    expect(reportPanel()).toBeNull();
    expect(frame().querySelector('[data-sync-report-panel]')).toBeNull();
  });
});
