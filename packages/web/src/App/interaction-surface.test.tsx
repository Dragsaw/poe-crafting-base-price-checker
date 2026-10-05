import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { bodiesWith, craftedEntry, hoursBefore, priced, rawEntry } from '../test-support/list-fixtures';
import { serveArtifacts, TEST_LEAGUE } from '../test-support/artifact-server';
import { ARTIFACT_ORDER } from '../load/artifacts';
import { flush, settleTo, unmount } from '../test-support/dom';
import { blur, pastDebounce, typeInto } from '../test-support/threshold-input';
import { THRESHOLD_STORAGE_KEY } from '../threshold/threshold-storage';
import { server, mount, frame, payoutField, unitNames } from './test-support';

afterEach(unmount);

describe('the interaction surface', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('has no tooltip, dialog, sort or clickable header, and writes nothing to storage but the threshold', async () => {
    const writes: string[] = [];
    const setItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key: string, value: string) {
      writes.push(key);
      setItem.call(this, key, value);
    });
    const now = Date.now();
    const filler = Array.from({ length: 22 }, (_, index) => rawEntry(`Filler Ring ${String(index + 1).padStart(2, '0')}`));
    // weights.json absent, so the appendix holds rows the guard covers too.
    const bodies = bodiesWith(
      [...filler, craftedEntry('Bows', 'weapon.bow'), craftedEntry('Wands', 'weapon.wand')],
      filler.map((entry, index) =>
        priced(entry, 1 + index / 10, hoursBefore(now, 1), { search: { id: `search${String(index)}`, league: TEST_LEAGUE } }),
      ),
    );
    const requests = serveArtifacts(server, {
      tracked: { kind: 'json', body: bodies.tracked },
      dataset: { kind: 'json', body: bodies.dataset },
      weights: { kind: 'status', status: 404 },
    });
    mount();
    await settleTo('ready');

    // An appendix row does nothing on a click: no expansion, no change to the page.
    const clickedRows = [...frame().querySelectorAll<HTMLElement>('[data-appendix-row]')];
    expect(clickedRows).toHaveLength(2);
    const beforeAppendix = frame().outerHTML;
    for (const row of clickedRows) {
      act(() => {
        row.click();
      });
    }
    await flush();
    expect(frame().outerHTML).toBe(beforeAppendix);
    const appendixNode = frame().querySelector<HTMLElement>('[data-unrankable-appendix]');
    expect(appendixNode?.querySelectorAll('button, a, input, [role], [tabindex], [title], [class]')).toHaveLength(0);
    for (const row of clickedRows) {
      expect(row.style.cursor).toBe('');
    }

    // Every interaction Epic 2 builds: the strip, a row, the list growth and the threshold.
    act(() => {
      frame().querySelector<HTMLElement>('[data-trust-strip]')?.click();
    });
    act(() => {
      frame().querySelector<HTMLElement>('[data-ranked-row]')?.click();
    });
    act(() => {
      frame().querySelector<HTMLElement>('[data-expand-affordance]')?.click();
    });
    typeInto(payoutField(), '2');
    await pastDebounce();
    blur(payoutField());
    await flush();

    // A header click sorts nothing, and the header holds nothing clickable.
    const header = frame().querySelector<HTMLElement>('[data-column-header]');
    const before = unitNames();
    for (const label of [...header?.children ?? []] as HTMLElement[]) {
      act(() => {
        label.click();
      });
    }
    await flush();
    expect(unitNames()).toEqual(before);
    expect(header?.querySelectorAll('button, a, input, [role="button"], [tabindex]')).toHaveLength(0);

    expect(document.querySelectorAll('[title]')).toHaveLength(0);
    expect(document.querySelectorAll('[role="dialog"], [role="tooltip"], [aria-sort]')).toHaveLength(0);
    expect(new Set(writes)).toEqual(new Set([THRESHOLD_STORAGE_KEY]));
    expect(Object.keys(localStorage)).toEqual([THRESHOLD_STORAGE_KEY]);
    expect(sessionStorage).toHaveLength(0);
    expect(requests).toHaveLength(ARTIFACT_ORDER.length);
  });
});
