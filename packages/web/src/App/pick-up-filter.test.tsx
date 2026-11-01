import { act } from 'react';
import { afterEach, describe, expect, it, onTestFinished, vi } from 'vitest';

import {
  COPIED_LABEL,
  COPIED_MS,
  COPY_LABEL,
  DOWNLOAD_LABEL,
  FIELD_ERRORS,
  FIELD_PLACEHOLDER,
  FILTER_BUTTON_LABEL,
  FILTER_MODAL_TITLE,
  FILTER_STEPS,
  filterLead,
  FOLDER_PATH,
  NO_RECIPE_LINE,
  NOTHING_QUALIFIES_LINE,
  uncostableLine,
} from '../pick-up-filter/filter-copy';
import { FILTER_NAME_STORAGE_KEY } from '../pick-up-filter/filter-name';
import { option, RATES, standardWorld, bows, belt } from '../recipe/craft-recipe/test-support';
import { flush, rgb, unmount } from '../test-support/dom';
import { hoursBefore, priced } from '../test-support/list-fixtures';
import { blur, typeInto } from '../test-support/threshold-input';
import { colors, floatingShadows, rounded, typeRoles } from '../theme/tokens';
import {
  captureDownloads,
  clickClose,
  clickOn,
  clickOverlay,
  downloadAction,
  enterName,
  filterButton,
  filterModal,
  inModal,
  nameField,
  openFilterModal,
  pickUpWorld,
  pressEscape,
  ready,
  stateLine,
} from './pick-up-filter-support';
import { frame } from './test-support';

afterEach(() => {
  unmount();
  vi.useRealTimers();
  vi.restoreAllMocks();
  localStorage.clear();
});

/** Nothing clears 0.25: every unit's price sits under it (state 25), so no base qualifies. */
function nothingQualifies(): Parameters<typeof standardWorld>[0] {
  const now = Date.now();
  return { dataset: [priced(bows, 0.1, hoursBefore(now, 1)), priced(belt, 0.1, hoursBefore(now, 1))] };
}

describe('the filter button', () => {
  it('AC: sits before the sync button in the sync-button look, and the header bar keeps one line', async () => {
    await ready();
    const button = filterButton();
    expect(button.textContent).toBe(FILTER_BUTTON_LABEL);
    expect(button.querySelector('[data-mark="open-sign"]')).not.toBeNull();
    expect(button.className).toBe('fg-filter-button');
    expect(button.style.fontSize).toBe(typeRoles.label.fontSize);
    expect(button.style.padding).toBe('4px 8px');
    expect(button.style.borderRadius).toBe(rounded.control);
    expect(button.querySelector('[data-problem-count]')).toBeNull();
    const slot = button.parentElement;
    expect(slot?.nextElementSibling?.querySelector('[data-sync-button]')).not.toBeNull();
    expect(slot?.closest<HTMLElement>('[data-header-bar]')?.style.flexWrap).toBe('nowrap');
  });
});

describe('the filter modal', () => {
  it('AC: opens and closes instantly on Esc, the overlay and ×, and the page under it does not re-rank', async () => {
    await ready();
    const page = frame().outerHTML;
    expect(filterModal()).toBeNull();
    for (const close of [pressEscape, clickOverlay, clickClose]) {
      openFilterModal();
      // No flush: the modal is there in the same commit as the click.
      expect(filterModal()).not.toBeNull();
      expect(frame().outerHTML).toBe(page);
      close();
      expect(filterModal()).toBeNull();
    }
    await flush();
    expect(filterModal()).toBeNull();
    expect(frame().outerHTML).toBe(page);
  });

  it('AC: holds the lead and the four steps in Copy Deck order, in the filter-modal look', async () => {
    await ready();
    openFilterModal();
    const modal = filterModal();
    expect(modal?.querySelector('h2')?.textContent).toBe(FILTER_MODAL_TITLE);
    expect(inModal('[data-filter-lead]').textContent).toBe(filterLead(0.25, 'greater'));
    const steps = [...(modal?.querySelectorAll('ol > li[data-filter-step]') ?? [])];
    expect(steps).toHaveLength(4);
    for (const [index, step] of steps.entries()) {
      expect(step.textContent.startsWith(FILTER_STEPS[index] ?? '')).toBe(true);
    }
    expect(steps[0]?.querySelector('[data-filter-path]')?.textContent).toBe(FOLDER_PATH);
    expect(steps[0]?.querySelector('[data-filter-copy]')?.textContent).toBe(COPY_LABEL);
    expect(steps[1]?.querySelector('label')?.htmlFor).toBe(nameField().id);
    expect(nameField().placeholder).toBe(FIELD_PLACEHOLDER);
    expect(steps[2]?.querySelector('[data-filter-download]')?.textContent).toBe(DOWNLOAD_LABEL);
    expect(steps[3]?.textContent).toBe(FILTER_STEPS[3]);
    expect(stateLine()).toBeUndefined();
    expect(modal?.style.background).toBe(rgb(colors.surface));
    expect(modal?.style.border).toBe(`1px solid ${rgb(colors['line-strong'])}`);
    expect(modal?.style.borderRadius).toBe(rounded.tooltip);
    expect(modal?.style.boxShadow).toBe(floatingShadows['mark-tooltip']);
    expect(modal?.style.padding).toBe('16px');
  });

  it('AC: the copy action writes the folder path verbatim and reads Copied for about 2 s', async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    onTestFinished(() => {
      Reflect.deleteProperty(navigator, 'clipboard');
    });
    await ready();
    openFilterModal();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const copy = inModal('[data-filter-copy]');
    clickOn(copy);
    await act(async () => {
      await Promise.resolve();
    });
    expect(writeText).toHaveBeenCalledWith(String.raw`%UserProfile%\Documents\My Games\Path of Exile 2`);
    expect(copy.textContent).toBe(COPIED_LABEL);
    act(() => {
      vi.advanceTimersByTime(COPIED_MS - 1);
    });
    expect(copy.textContent).toBe(COPIED_LABEL);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(copy.textContent).toBe(COPY_LABEL);
  });

  it('AC: state 43 drops the recipe from the lead, shows the state 43 line, and the download stays enabled', async () => {
    await ready(pickUpWorld({ recipes: [] }));
    openFilterModal();
    expect(inModal('[data-filter-lead]').textContent).toBe(filterLead(0.25, undefined));
    expect(stateLine()).toBe(NO_RECIPE_LINE);
    enterName('My');
    expect(downloadAction().disabled).toBe(false);
  });

  it('AC: state 35 shows the state 46 line above the download, and the download stays enabled', async () => {
    await ready(pickUpWorld({ rates: RATES.slice(0, 2) }));
    clickOn(option('perfect'));
    openFilterModal();
    expect(inModal('[data-filter-lead]').textContent).toBe(filterLead(0.25, 'perfect'));
    expect(stateLine()).toBe(uncostableLine('perfect'));
    const line = inModal('[data-filter-state-line]');
    expect(line.compareDocumentPosition(downloadAction()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    enterName('My');
    expect(downloadAction().disabled).toBe(false);
  });

  it.each([
    ['alone', {}, 'greater'],
    ['in place of the state 46 line under state 35', { rates: RATES.slice(0, 2) }, 'perfect'],
  ] as const)('AC: a ranking that names no base shows the state 47 line %s, and the download stays enabled', async (_case, overrides, recipe) => {
    await ready(pickUpWorld({ ...nothingQualifies(), ...overrides }));
    if (recipe === 'perfect') {
      clickOn(option('perfect'));
    }
    openFilterModal();
    expect(stateLine()).toBe(NOTHING_QUALIFIES_LINE);
    expect(filterModal()?.querySelectorAll('[data-filter-state-line]')).toHaveLength(1);
    enterName('My');
    expect(downloadAction().disabled).toBe(false);
  });
});

describe('the file-name field', () => {
  it('AC: empty (state 44) disables the download with no error', async () => {
    await ready();
    openFilterModal();
    expect(nameField().value).toBe('');
    expect(downloadAction().disabled).toBe(true);
    expect(downloadAction().style.color).toBe(rgb(colors['text-tertiary']));
    blur(nameField());
    expect(filterModal()?.querySelector('[data-filter-name-error]')).toBeNull();
  });

  it('AC: a name it cannot use (state 45) disables the download, and its error shows on blur, never on a keystroke', async () => {
    await ready();
    openFilterModal();
    typeInto(nameField(), '"x');
    expect(downloadAction().disabled).toBe(true);
    expect(filterModal()?.querySelector('[data-filter-name-error]')).toBeNull();
    blur(nameField());
    expect(inModal('[data-filter-name-error]').textContent).toBe(FIELD_ERRORS['quote-or-folder']);
    expect(nameField().style.borderColor).toBe(rgb(colors['trust-broken']));
    typeInto(nameField(), '"xy');
    expect(filterModal()?.querySelector('[data-filter-name-error]')).toBeNull();
    typeInto(nameField(), '');
    blur(nameField());
    expect(filterModal()?.querySelector('[data-filter-name-error]')).toBeNull();
    expect(downloadAction().disabled).toBe(true);
    enterName('Crafting-Bases');
    expect(inModal('[data-filter-name-error]').textContent).toBe(FIELD_ERRORS['own-name']);
    expect(downloadAction().disabled).toBe(true);
  });

  it('AC: a name without .filter is not an error, and the field shows what the player typed', async () => {
    await ready();
    openFilterModal();
    enterName('My');
    expect(filterModal()?.querySelector('[data-filter-name-error]')).toBeNull();
    expect(nameField().value).toBe('My');
    expect(downloadAction().disabled).toBe(false);
    expect(downloadAction().style.color).toBe(rgb(colors.accent));
  });
});

describe('what survives a reload', () => {
  it('AC: the field opens with the last usable name and the modal starts closed', async () => {
    await ready();
    openFilterModal();
    enterName('My filter');
    typeInto(nameField(), 'a/b');
    expect(localStorage.getItem(FILTER_NAME_STORAGE_KEY)).toBe('My filter');
    unmount();
    await ready();
    expect(filterModal()).toBeNull();
    openFilterModal();
    expect(nameField().value).toBe('My filter');
  });

  // Matrix: storage throws.
  it('AC: a storage that throws leaves the page working with an empty field', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const capture = captureDownloads();
    await ready();
    openFilterModal();
    expect(nameField().value).toBe('');
    enterName('My');
    expect(downloadAction().disabled).toBe(false);
    clickOn(downloadAction());
    expect(capture.downloads).toHaveLength(1);
  });
});
