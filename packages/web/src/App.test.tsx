import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { absenceLine, PANEL_HEADINGS } from './frame/trust-copy';
import {
  FETCH_FAILURE_EYEBROW,
  FETCH_FAILURE_RECOVERY,
  FETCH_FAILURE_TITLE,
  fetchFailureSentence,
  REFUSAL_EYEBROW,
  REFUSAL_RECOVERY,
  REFUSAL_TITLE,
  REFUSAL_FRAGMENTS,
  sentenceText,
  TRY_AGAIN,
} from './frame/FailureScreen';
import { colors, failureScreen, px, typeRoles } from './theme/tokens';
import { HEADER_TITLE } from './frame/HeaderBar';
import { ROW_SLOT_COUNT } from './frame/RowSlots';
import { ROW_COLUMNS } from './list/row/grid';
import { EXPECTED_VALUE_TOOLTIP_COPY } from './list/row/ExpectedValueTooltip';
import {
  gatedArtifacts,
  NEVER_FETCHED_PATH,
  serveArtifacts,
  TEST_LEAGUE,
  VALID_BODIES,
} from './test-support/artifact-server';
import { ARTIFACT_ORDER } from './load/artifacts';
import { flush, mountedContainer, rgb, settleTo, unmount } from './test-support/dom';
import { server, mount, frame, panelLines, toggleReport } from './App/test-support';
import { THRESHOLD_WORD } from './threshold/PayoutThreshold';

afterEach(unmount);

const F = REFUSAL_FRAGMENTS;

/** No header bar, no list and no legend: the failure screen replaces the whole page (FR-33, NFR-8). */
function expectWholePageReplaced(): void {
  expect(frame().querySelector('[data-header-bar], [data-ranked-list], [data-row-slots], [data-footer-legend], [data-unrankable-appendix]')).toBeNull();
}

/** The shared failure-screen shape: eyebrow led by the drawn ✕, title, body width (DESIGN.md `failure-screen`). */
function expectFailureShape(eyebrow: string, title: string): void {
  const section = frame().querySelector<HTMLElement>('section[data-failure]');
  expect(section?.style.paddingTop).toBe(px(failureScreen.paddingTop));
  const lead = frame().querySelector<HTMLElement>('[data-failure-eyebrow]');
  expect(lead?.textContent).toBe(eyebrow);
  expect(lead?.style.textTransform).toBe('uppercase');
  expect(lead?.style.color).toBe(rgb(colors['trust-broken']));
  expect((lead?.firstElementChild as HTMLElement | SVGElement | null | undefined)?.dataset['mark']).toBe('broken');
  const heading = frame().querySelector<HTMLElement>('h1');
  expect(heading?.textContent).toBe(title);
  expect(heading?.style.fontSize).toBe(typeRoles.title.fontSize);
  for (const paragraph of frame().querySelectorAll<HTMLElement>('section > p')) {
    expect(paragraph.style.maxWidth).toBe(px(failureScreen.bodyMaxWidth));
    expect(paragraph.style.color).toBe(rgb(colors['text-secondary']));
    expect(paragraph.style.fontSize).toBe(typeRoles['line-text'].fontSize);
  }
  expect(frame().querySelector('[style*="italic"], [style*="700"]')).toBeNull();
  expectWholePageReplaced();
}

/** The refusal's per-cause sentence, after the parts every cause shares. */
function refusalBody(path: string): string {
  expectFailureShape(REFUSAL_EYEBROW, REFUSAL_TITLE);
  expect(frame().textContent).toContain(REFUSAL_RECOVERY);
  expect(frame().textContent).not.toContain(TRY_AGAIN);
  expect(frame().querySelector('button')).toBeNull();
  expect(frame().querySelector('[data-part="artifact"]')?.textContent).toBe(path);
  return frame().querySelector('[data-failure-sentence]')?.textContent ?? '';
}

describe('the pending state', () => {
  it('paints the header bar and twenty skeleton slots in the final layout', () => {
    const held = gatedArtifacts();
    serveArtifacts(server, held.answers);
    mount();
    expect(frame().dataset['state']).toBe('pending');
    expect(frame().getAttribute('aria-busy')).toBe('true');
    expect(frame().textContent).toContain(HEADER_TITLE);
    const slots = frame().querySelectorAll('[data-row-slot]');
    expect(slots).toHaveLength(ROW_SLOT_COUNT);
    expect(slots[0]?.querySelectorAll('[data-cell]')).toHaveLength(ROW_COLUMNS.length);
    // No tooltip opens before the data arrives, so the EV label has no hover look yet.
    const skeletonLabel = frame().querySelector<HTMLElement>('[data-row-slots] [data-ev-label]');
    expect(skeletonLabel).not.toBeNull();
    expect(skeletonLabel?.style.borderBottom).toBe('');
    expect(skeletonLabel?.style.cursor).toBe('');
    // The threshold control is live in its slot; the recipe and sync slots hold their widths, empty.
    const header = frame().querySelector<HTMLElement>(':scope > [data-header-bar]');
    expect(header?.querySelector('[data-slot="threshold"] [data-payout-threshold]')).not.toBeNull();
    expect(header?.querySelector('[data-slot="recipe"]')?.childElementCount).toBe(0);
    expect(header?.querySelector('[data-slot="sync"]')?.childElementCount).toBe(0);
    expect(header?.nextElementSibling?.hasAttribute('data-row-slots')).toBe(true);
    expect(frame().querySelector('[data-page-tail] [data-footer-legend]')).not.toBeNull();
    expect(frame().querySelector('[data-unrankable-appendix]')).toBeNull();
    held.openAll();
  });

  it('changes nothing rendered while any artifact is still outstanding, then moves in one transition', async () => {
    const held = gatedArtifacts();
    serveArtifacts(server, held.answers);
    mount();
    const pending = frame().outerHTML;

    // Six of the seven arrive, one at a time; the page does not move.
    for (const key of ARTIFACT_ORDER.slice(0, 6)) {
      held.open(key);
      // eslint-disable-next-line no-await-in-loop -- sequential on purpose: the page is asserted unmoved after each single arrival
      await flush();
      expect(mountedContainer()?.outerHTML).toContain(pending);
      expect(frame().outerHTML).toBe(pending);
    }

    held.open('catalogueStats');
    await settleTo('ready');
    expect(frame().querySelectorAll('[data-row-slot]')).toHaveLength(0);
  });
});

describe('the outcomes', () => {
  // Matrix: all seven valid.
  it('shows ready with the league in the eyebrow when all seven are valid', async () => {
    const requests = serveArtifacts(server);
    mount();
    await settleTo('ready');
    expect(frame().querySelector('[data-eyebrow]')?.textContent).toBe(TEST_LEAGUE);
    expect(frame().querySelector('[data-absence-lines]')).toBeNull();
    expect(requests).toHaveLength(ARTIFACT_ORDER.length);
    // The server publishes `catalogue/static.json` as a trap; the page never fetches it.
    expect(requests.map((request) => request.url.pathname)).not.toContain(`/${NEVER_FETCHED_PATH}`);
    for (const request of requests) {
      expect(request.cache).toBe('no-cache');
      expect(request.url.search).toBe('');
    }
  });

  // Matrix: invalid shape.
  it('refuses an invalid tracked.json as a content fault, with no retry', async () => {
    serveArtifacts(server, { tracked: { kind: 'json', body: { schemaVersion: '3.0.0', entries: 42 } } });
    mount();
    await settleTo('refused');
    expect(frame().querySelector('section')?.getAttribute('role')).toBe('alert');
    expect(frame().hasAttribute('aria-busy')).toBe(false);
    const sentence = refusalBody('tracked.json');
    expect(sentence).toBe(`tracked.json${F.content}3.0.0${F.end}`);
    expect(sentence).not.toContain('declares');
    expect(frame().querySelector('[data-part="declared"]')).toBeNull();
    expect(frame().querySelector('[data-part="expected"]')?.textContent).toBe('3.0.0');
    expect(frame().textContent).not.toContain(HEADER_TITLE);
  });

  it('refuses a dataset with a repeated entryKey as a content fault', async () => {
    const twin = {
      entryKey: '["raw","Advanced Dualstring Bow",82]',
      price: { state: 'not-yet-synced', reason: 'never-synced' },
    };
    serveArtifacts(server, {
      dataset: { kind: 'json', body: { ...(VALID_BODIES.dataset as object), entries: [twin, twin] } },
    });
    mount();
    await settleTo('refused');
    const sentence = refusalBody('dataset.json');
    expect(sentence).toBe(`dataset.json${F.content}1.0.0${F.end}`);
    expect(sentence).not.toContain('declares');
  });

  // Matrix: unknown major.
  it('refuses dataset.json declaring 2.0.0, expecting 1.0.0', async () => {
    serveArtifacts(server, { dataset: { kind: 'json', body: { ...(VALID_BODIES.dataset as object), schemaVersion: '2.0.0' } } });
    mount();
    await settleTo('refused');
    const sentence = refusalBody('dataset.json');
    expect(sentence).toBe(`dataset.json${F.declares}2.0.0${F.expects}1.0.0${F.end}`);
    expect(frame().querySelector('[data-part="declared"]')?.textContent).toBe('2.0.0');
    expect(frame().querySelector('[data-part="expected"]')?.textContent).toBe('1.0.0');
  });

  // Matrix: malformed version string.
  it('refuses dataset.json declaring a malformed version', async () => {
    serveArtifacts(server, { dataset: { kind: 'json', body: { ...(VALID_BODIES.dataset as object), schemaVersion: 'abc' } } });
    mount();
    await settleTo('refused');
    expect(refusalBody('dataset.json')).toBe(`dataset.json${F.declares}abc${F.expects}1.0.0${F.end}`);
  });

  // Regression: a declared "none" is printed as declared, not read as no version.
  it('refuses dataset.json declaring "none" by naming it, not as declaring no version', async () => {
    serveArtifacts(server, { dataset: { kind: 'json', body: { ...(VALID_BODIES.dataset as object), schemaVersion: 'none' } } });
    mount();
    await settleTo('refused');
    const sentence = refusalBody('dataset.json');
    expect(sentence).toBe(`dataset.json${F.declares}none${F.expects}1.0.0${F.end}`);
    expect(sentence).not.toBe(`dataset.json${F.noVersion}1.0.0${F.end}`);
    expect(frame().querySelector('[data-part="declared"]')?.textContent).toBe('none');
  });

  // Matrix: missing version.
  it('refuses config.json with no schemaVersion, declaring no schema version', async () => {
    serveArtifacts(server, { config: { kind: 'json', body: { league: TEST_LEAGUE, minChunkSearches: 1 } } });
    mount();
    await settleTo('refused');
    const sentence = refusalBody('config.json');
    expect(sentence).toBe(`config.json${F.noVersion}1.0.0${F.end}`);
    expect(frame().querySelector('[data-part="declared"]')).toBeNull();
    expect(frame().querySelector('[data-part="expected"]')?.textContent).toBe('1.0.0');
  });

  // Matrix: network error / 5xx, and the retry.
  it('shows the fetch-failure screen and re-fetches all seven on + Try again', async () => {
    const requests = serveArtifacts(server, { catalogueStats: { kind: 'status', status: 503 } });
    mount();
    await settleTo('failed');
    expectFailureShape(FETCH_FAILURE_EYEBROW, FETCH_FAILURE_TITLE);
    expect(frame().querySelector('[data-failure-sentence]')?.textContent).toBe(
      sentenceText(fetchFailureSentence('catalogue/stats.json')),
    );
    expect(frame().textContent).toContain(FETCH_FAILURE_RECOVERY);
    expect(frame().querySelector('[data-part="artifact"]')?.textContent).toBe('catalogue/stats.json');
    expect(requests).toHaveLength(ARTIFACT_ORDER.length);

    // The file is back; the retry fetches the whole set again.
    const retried = serveArtifacts(server);
    const button = frame().querySelector<HTMLElement>('button[data-show-more="retry"]');
    expect(button?.textContent).toBe(TRY_AGAIN);
    // `{components.show-more}`: accent text, no chrome.
    expect(button?.style.color).toBe(rgb(colors.accent));
    expect(button?.style.background).toBe('none');
    expect(button?.className).toBe('');
    act(() => {
      button?.click();
    });
    expect(frame().dataset['state']).toBe('pending');
    await settleTo('ready');
    expect(retried).toHaveLength(ARTIFACT_ORDER.length);
  });

  it('shows the fetch-failure screen when a fetch rejects', async () => {
    serveArtifacts(server, { catalogueStats: { kind: 'network-error' } });
    mount();
    await settleTo('failed');
    expect(frame().querySelector('[data-part="artifact"]')?.textContent).toBe('catalogue/stats.json');
  });

  // Matrix: required absent.
  it('refuses a missing tracked.json as not published', async () => {
    serveArtifacts(server, { tracked: { kind: 'status', status: 404 } });
    mount();
    await settleTo('refused');
    const sentence = refusalBody('tracked.json');
    expect(sentence).toBe(`tracked.json${F.missing}`);
    expect(sentence).not.toContain('schema version');
    expect(frame().querySelector('[data-part="declared"]')).toBeNull();
    expect(frame().querySelector('[data-part="expected"]')).toBeNull();
  });

  // Matrix: mixed failure.
  it('lets a fetch failure win over an invalid file', async () => {
    serveArtifacts(server, {
      tracked: { kind: 'json', body: {} },
      config: { kind: 'network-error' },
    });
    mount();
    await settleTo('failed');
    expect(frame().querySelector('[data-part="artifact"]')?.textContent).toBe('config.json');
  });

  // Matrix: tolerable absent.
  it('renders ready and names an absent recipes.json in one line', async () => {
    serveArtifacts(server, { recipes: { kind: 'status', status: 404 } });
    mount();
    await settleTo('ready');
    expect(frame().textContent).not.toContain(absenceLine('recipes'));
    toggleReport();
    expect(panelLines(PANEL_HEADINGS.indexOf('Built from')).slice(2)).toEqual([absenceLine('recipes')]);
    expect(absenceLine('recipes')).toBe('Not published recipes.json — no crafted rows can be ranked.');
    expect(absenceLine('weights')).toBe('Not published weights.json — every crafted class is unrankable.');
    expect(absenceLine('syncReport')).toBe('Not published sync-report.json — the sync report is unavailable.');
    expect(frame().querySelector('[data-header-bar] p')).toBeNull();
  });

  // Matrix: non-JSON body.
  it('refuses a 200 carrying HTML as a content fault', async () => {
    serveArtifacts(server, { dataset: { kind: 'text', body: '<!doctype html><title>x</title>' } });
    mount();
    await settleTo('refused');
    const sentence = refusalBody('dataset.json');
    expect(sentence).toBe(`dataset.json${F.content}1.0.0${F.end}`);
    expect(sentence).not.toContain('declares');
  });
});

describe('the copy', () => {
  it('never says sells for, worth or market value in web source, outside the header title the UX docs own', () => {
    const sources = import.meta.glob<string>(['./**/*.{ts,tsx}', '!./**/*.test.{ts,tsx}'], {
      eager: true,
      query: '?raw',
      import: 'default',
    });
    expect(Object.keys(sources).length).toBeGreaterThan(10);
    for (const [path, text] of Object.entries(sources)) {
      // The EV tooltip's count of outcomes worth at least the threshold is the other owned use (EXPERIENCE.md, Voice and Tone).
      // The threshold label is the third (Copy Deck, *Threshold*), in its control's source only.
      const owned = text.replaceAll(HEADER_TITLE, '').replaceAll(EXPECTED_VALUE_TOOLTIP_COPY.what, '');
      const scanned = path === './threshold/PayoutThreshold.tsx' ? owned.replaceAll(`'${THRESHOLD_WORD}'`, '') : owned;
      expect(scanned, path).not.toMatch(/sells for|worth|market value/i);
    }
  });
});
