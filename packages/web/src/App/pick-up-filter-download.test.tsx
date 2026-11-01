import { afterEach, describe, expect, it, vi } from 'vitest';

import { filterLead } from '../pick-up-filter/filter-copy';
import { GENERATED_FILE_NAME } from '../pick-up-filter/filter-name';
import { option } from '../recipe/craft-recipe/test-support';
import { flush, unmount } from '../test-support/dom';
import { hoursBefore, priced, rawEntry } from '../test-support/list-fixtures';
import { blur, pastDebounce, typeInto } from '../test-support/threshold-input';
import {
  captureDownloads,
  clickOn,
  downloadAction,
  enterName,
  expectedFilterText,
  filterButton,
  filterModal,
  inModal,
  openFilterModal,
  pickUpWorld,
  ready,
  stateLine,
} from './pick-up-filter-support';
import { frame, payoutField } from './test-support';

afterEach(() => {
  unmount();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('the download', () => {
  it('AC: hands the browser the filter of the ranking on screen as crafting-bases.filter, with no request, then closes with no confirmation', async () => {
    const capture = captureDownloads();
    await ready();
    const expected = await expectedFilterText(0.25, 'greater', 'My.filter');
    const fetches = vi.spyOn(globalThis, 'fetch');
    const page = frame().outerHTML;
    openFilterModal();
    enterName('My');
    clickOn(downloadAction());
    const [download] = capture.downloads;
    expect(capture.downloads).toHaveLength(1);
    expect(download?.download).toBe(GENERATED_FILE_NAME);
    const text = await download?.text;
    expect(text).toBe(expected);
    expect(text).toContain('BaseType == "Recurve Bow"');
    expect(text?.endsWith('Import "My.filter"\n')).toBe(true);
    expect(capture.revoked).toEqual([]);
    await flush();
    expect(capture.revoked).toEqual([download?.href]);
    expect(filterModal()).toBeNull();
    expect(frame().outerHTML).toBe(page);
    expect(fetches).not.toHaveBeenCalled();
  });

  it('AC: a threshold change after a download marks nothing out of date, and the next download uses the new ranking', async () => {
    const capture = captureDownloads();
    await ready();
    const before = await expectedFilterText(0.25, 'greater', 'My.filter');
    const after = await expectedFilterText(0.35, 'greater', 'My.filter');
    expect(after).not.toBe(before);
    openFilterModal();
    enterName('My.filter');
    clickOn(downloadAction());
    const button = filterButton().outerHTML;
    typeInto(payoutField(), '0.35');
    await pastDebounce();
    blur(payoutField());
    expect(filterButton().outerHTML).toBe(button);
    openFilterModal();
    expect(inModal('[data-filter-lead]').textContent).toBe(filterLead(0.35, 'greater'));
    clickOn(downloadAction());
    expect(await Promise.all(capture.downloads.map(async (download) => download.text))).toEqual([before, after]);
  });

  it('AC: a recipe change after a download marks nothing out of date, and the next download uses the new ranking', async () => {
    // greater: Staves EV 0.97 > 0.5, so craft; perfect (costable): Staves EV 0.20 < 0.5, so sell raw.
    const staff = rawEntry('Gnarled Quarterstaff', 82, { categoryId: 'weapon.staff', className: 'Staves' });
    const world = pickUpWorld();
    const capture = captureDownloads();
    await ready({ ...world, tracked: [...world.tracked, staff], dataset: [...world.dataset, priced(staff, 0.5, hoursBefore(Date.now(), 1))] });
    const greater = await expectedFilterText(0.25, 'greater', 'My.filter');
    const perfect = await expectedFilterText(0.25, 'perfect', 'My.filter');
    expect(perfect).not.toBe(greater);
    openFilterModal();
    enterName('My');
    clickOn(downloadAction());
    const button = filterButton().outerHTML;
    clickOn(option('perfect'));
    expect(filterButton().outerHTML).toBe(button);
    openFilterModal();
    expect(inModal('[data-filter-lead]').textContent).toBe(filterLead(0.25, 'perfect'));
    expect(stateLine()).toBeUndefined();
    clickOn(downloadAction());
    expect(await Promise.all(capture.downloads.map(async (download) => download.text))).toEqual([greater, perfect]);
  });
});
