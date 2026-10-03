import { canonicalKey } from '@poe/contracts';
import type { TrackedEntry } from '@poe/contracts';
import type { SetupServerApi } from 'msw/node';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { App } from './App';
import { absenceLine } from './frame/AbsenceLines';
import {
  FETCH_FAILURE_EYEBROW,
  FETCH_FAILURE_TITLE,
  REFUSAL_CONTENT,
  REFUSAL_EYEBROW,
  REFUSAL_MISSING,
  REFUSAL_NO_VERSION_DECLARED,
  REFUSAL_RECOVERY,
  REFUSAL_TITLE,
  REFUSAL_VERSION_DECLARES,
  REFUSAL_VERSION_EXPECTS,
  TRY_AGAIN,
} from './frame/FailureScreen';
import { CONTROL_GROUP_WIDTH, MASTHEAD_DEK, MASTHEAD_TITLE } from './frame/Masthead';
import { DENOMINATION } from './shared/product';
import { ROW_SLOT_COUNT } from './frame/RowSlots';
import { ASKING_PRICE_COPY } from './list/AskingPriceLine';
import { bodiesWith, craftedEntry, hoursBefore, priced, rawEntry, unpriced } from './test-support/list-fixtures';
import {
  gate,
  NEVER_FETCHED_PATH,
  serveArtifacts,
  sharedServer,
  TEST_LEAGUE,
  VALID_BODIES,
  type ArtifactAnswer,
} from './test-support/artifact-server';
import { ARTIFACT_ORDER, type ArtifactKey } from './load/artifacts';
import { rgb } from './test-support/dom';
import { blur, pastDebounce, typeInto } from './test-support/threshold-input';
import { PageProvider } from './theme/PageProvider';
import { colors } from './theme/tokens';
import { THRESHOLD_STORAGE_KEY } from './threshold/threshold-storage';

let server: SetupServerApi;
let container: HTMLDivElement | undefined;
let root: Root | undefined;

beforeAll(async () => {
  server = await sharedServer();
});

afterEach(() => {
  if (root !== undefined) {
    const mounted = root;
    act(() => {
      mounted.unmount();
    });
    root = undefined;
  }
  container?.remove();
  container = undefined;
});

function mount(): HTMLDivElement {
  container = document.createElement('div');
  document.body.append(container);
  const mounted = createRoot(container);
  root = mounted;
  act(() => {
    mounted.render(
      <PageProvider>
        <App />
      </PageProvider>,
    );
  });
  return container;
}

function frame(): HTMLElement {
  const found = container?.querySelector<HTMLElement>('[data-frame]');
  if (found === null || found === undefined) {
    throw new Error('no frame rendered');
  }
  return found;
}

/** Lets pending fetches and their continuations run, inside `act`. */
async function flush(): Promise<void> {
  await act(async () => {
    for (let turn = 0; turn < 5; turn += 1) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  });
}

async function settleTo(state: string): Promise<void> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (frame().dataset['state'] === state) {
      return;
    }
    await flush();
  }
  throw new Error(`frame never reached ${state}; it is ${String(frame().dataset['state'])}`);
}

/**
 * The refusal body sentence, after checking the parts every cause shares: the
 * eyebrow, the title, the named artifact beside `× unresolvable`, the recovery
 * sentence, and no retry.
 */
function refusalBody(path: string): string {
  const text = frame().textContent;
  expect(text).toContain(REFUSAL_EYEBROW);
  expect(text).toContain(REFUSAL_TITLE);
  expect(text).toContain(REFUSAL_RECOVERY);
  expect(text).not.toContain(TRY_AGAIN);
  expect(frame().querySelector('button')).toBeNull();
  expect(frame().querySelector('[data-artifact]')?.textContent).toBe(path);
  const body = frame().querySelector('section p')?.textContent ?? '';
  const lead = `${path} × unresolvable. `;
  expect(body.startsWith(lead)).toBe(true);
  return body.slice(lead.length);
}

describe('the pending state', () => {
  it('paints the masthead and twenty skeleton slots in the final layout', () => {
    const gates = ARTIFACT_ORDER.map(() => gate());
    serveArtifacts(
      server,
      Object.fromEntries(ARTIFACT_ORDER.map((key, i) => [key, { kind: 'gated', gate: gates[i]?.promise } as ArtifactAnswer])),
    );
    mount();
    expect(frame().dataset['state']).toBe('pending');
    expect(frame().getAttribute('aria-busy')).toBe('true');
    expect(frame().textContent).toContain(MASTHEAD_TITLE);
    const slots = frame().querySelectorAll('[data-row-slot]');
    expect(slots).toHaveLength(ROW_SLOT_COUNT);
    expect(slots[0]?.querySelectorAll('[data-cell]')).toHaveLength(6);
    // The strip's slot holds its place, blank, so the page never jumps.
    const stripSlot = frame().querySelector<HTMLElement>('[data-trust-strip-slot]');
    expect(stripSlot?.previousElementSibling?.hasAttribute('data-masthead')).toBe(true);
    expect(stripSlot?.nextElementSibling?.hasAttribute('data-asking-price-line')).toBe(true);
    expect(stripSlot?.textContent).toBe('');
    expect(frame().querySelector('[data-trust-strip]')).toBeNull();
    for (const g of gates) g.open();
  });

  it('changes nothing rendered while any artifact is still outstanding, then moves in one transition', async () => {
    const gates = new Map<ArtifactKey, ReturnType<typeof gate>>(ARTIFACT_ORDER.map((key) => [key, gate()]));
    serveArtifacts(
      server,
      Object.fromEntries(ARTIFACT_ORDER.map((key) => [key, { kind: 'gated', gate: gates.get(key)?.promise } as ArtifactAnswer])),
    );
    mount();
    const pending = frame().outerHTML;

    // Six of the seven arrive, one at a time; the page does not move.
    for (const key of ARTIFACT_ORDER.slice(0, 6)) {
      gates.get(key)?.open();
      await flush();
      expect(container?.innerHTML).toContain(pending);
      expect(frame().outerHTML).toBe(pending);
    }

    gates.get('catalogueStats')?.open();
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
    expect(frame().textContent).toContain(`League ${TEST_LEAGUE}`);
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
    serveArtifacts(server, { tracked: { kind: 'json', body: { schemaVersion: '1.0.0', entries: 42 } } });
    mount();
    await settleTo('refused');
    expect(frame().querySelector('section')?.getAttribute('role')).toBe('alert');
    expect(frame().hasAttribute('aria-busy')).toBe(false);
    const sentence = refusalBody('tracked.json');
    expect(sentence).toBe(`${REFUSAL_CONTENT} 1.0.0.`);
    expect(sentence).not.toContain('declares');
    expect(frame().querySelector('[data-declared]')).toBeNull();
    expect(frame().querySelector('[data-expected]')?.textContent).toBe('1.0.0');
    expect(frame().textContent).not.toContain(MASTHEAD_TITLE);
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
    expect(sentence).toBe(`${REFUSAL_CONTENT} 1.0.0.`);
    expect(sentence).not.toContain('declares');
  });

  // Matrix: unknown major.
  it('refuses dataset.json declaring 2.0.0, expecting 1.0.0', async () => {
    serveArtifacts(server, { dataset: { kind: 'json', body: { ...(VALID_BODIES.dataset as object), schemaVersion: '2.0.0' } } });
    mount();
    await settleTo('refused');
    const sentence = refusalBody('dataset.json');
    expect(sentence).toBe(`${REFUSAL_VERSION_DECLARES} 2.0.0; ${REFUSAL_VERSION_EXPECTS} 1.0.0.`);
    // The version sentence is unchanged by the per-cause split.
    expect(sentence).toBe('It declares schema version 2.0.0; the page expects 1.0.0.');
    expect(frame().querySelector('[data-declared]')?.textContent).toBe('2.0.0');
    expect(frame().querySelector('[data-expected]')?.textContent).toBe('1.0.0');
  });

  // Matrix: malformed version string.
  it('refuses dataset.json declaring a malformed version', async () => {
    serveArtifacts(server, { dataset: { kind: 'json', body: { ...(VALID_BODIES.dataset as object), schemaVersion: 'abc' } } });
    mount();
    await settleTo('refused');
    expect(refusalBody('dataset.json')).toBe(`${REFUSAL_VERSION_DECLARES} abc; ${REFUSAL_VERSION_EXPECTS} 1.0.0.`);
  });

  // Regression: a declared "none" is printed as declared, not read as no version.
  it('refuses dataset.json declaring "none" by naming it, not as declaring no version', async () => {
    serveArtifacts(server, { dataset: { kind: 'json', body: { ...(VALID_BODIES.dataset as object), schemaVersion: 'none' } } });
    mount();
    await settleTo('refused');
    const sentence = refusalBody('dataset.json');
    expect(sentence).toBe(`${REFUSAL_VERSION_DECLARES} none; ${REFUSAL_VERSION_EXPECTS} 1.0.0.`);
    expect(sentence).not.toContain(REFUSAL_NO_VERSION_DECLARED);
    expect(frame().querySelector('[data-declared]')?.textContent).toBe('none');
  });

  // Matrix: missing version.
  it('refuses config.json with no schemaVersion, declaring no schema version', async () => {
    serveArtifacts(server, { config: { kind: 'json', body: { league: TEST_LEAGUE, minChunkSearches: 1 } } });
    mount();
    await settleTo('refused');
    const sentence = refusalBody('config.json');
    expect(sentence).toBe(`${REFUSAL_NO_VERSION_DECLARED}; ${REFUSAL_VERSION_EXPECTS} 1.0.0.`);
    expect(sentence).toContain('declares no schema version');
    expect(frame().querySelector('[data-declared]')).toBeNull();
    expect(frame().querySelector('[data-expected]')?.textContent).toBe('1.0.0');
  });

  // Matrix: network error / 5xx, and the retry.
  it('shows the fetch-failure screen and re-fetches all seven on + Try again', async () => {
    const requests = serveArtifacts(server, { catalogueStats: { kind: 'status', status: 503 } });
    mount();
    await settleTo('failed');
    expect(frame().textContent).toContain(FETCH_FAILURE_EYEBROW);
    expect(frame().textContent).toContain(FETCH_FAILURE_TITLE);
    expect(FETCH_FAILURE_TITLE).toBe('One of the data files did not arrive.');
    expect(frame().querySelector('[data-artifact]')?.textContent).toBe('catalogue/stats.json');
    expect(requests).toHaveLength(ARTIFACT_ORDER.length);

    // The file is back; the retry fetches the whole set again.
    const retried = serveArtifacts(server);
    const button = frame().querySelector('button');
    expect(button?.textContent).toBe(TRY_AGAIN);
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
    expect(frame().querySelector('[data-artifact]')?.textContent).toBe('catalogue/stats.json');
  });

  // Matrix: required absent.
  it('refuses a missing tracked.json as not published', async () => {
    serveArtifacts(server, { tracked: { kind: 'status', status: 404 } });
    mount();
    await settleTo('refused');
    const sentence = refusalBody('tracked.json');
    expect(sentence).toBe(REFUSAL_MISSING);
    expect(sentence).not.toContain('schema version');
    expect(frame().querySelector('[data-declared]')).toBeNull();
    expect(frame().querySelector('[data-expected]')).toBeNull();
  });

  // Matrix: mixed failure.
  it('lets a fetch failure win over an invalid file', async () => {
    serveArtifacts(server, {
      tracked: { kind: 'json', body: {} },
      config: { kind: 'network-error' },
    });
    mount();
    await settleTo('failed');
    expect(frame().querySelector('[data-artifact]')?.textContent).toBe('config.json');
  });

  // Matrix: tolerable absent.
  it('renders ready and names an absent recipes.json in one line', async () => {
    serveArtifacts(server, { recipes: { kind: 'status', status: 404 } });
    mount();
    await settleTo('ready');
    const lines = frame().querySelectorAll('[data-trust-strip] [data-absence-lines] p');
    expect(Array.from(lines, (line) => line.textContent)).toEqual([absenceLine('recipes')]);
    expect(absenceLine('recipes')).toBe('Not published: recipes.json — no crafted rows can be ranked.');
    expect(absenceLine('weights')).toBe('Not published: weights.json — every crafted class is unrankable.');
    expect(absenceLine('syncReport')).toBe('Not published: sync-report.json — the sync report is unavailable.');
    expect(frame().querySelector('[data-masthead] p')?.textContent).toBe(MASTHEAD_DEK);
  });

  // Matrix: non-JSON body.
  it('refuses a 200 carrying HTML as a content fault', async () => {
    serveArtifacts(server, { dataset: { kind: 'text', body: '<!doctype html><title>x</title>' } });
    mount();
    await settleTo('refused');
    const sentence = refusalBody('dataset.json');
    expect(sentence).toBe(`${REFUSAL_CONTENT} 1.0.0.`);
    expect(sentence).not.toContain('declares');
  });
});

describe('the resting chrome', () => {
  function chrome(): Record<string, boolean> {
    return Object.fromEntries(
      ['data-asking-price-line', 'data-column-header', 'data-key-block', 'data-running-foot'].map((attr) => [
        attr,
        frame().querySelector(`[${attr}]`) !== null,
      ]),
    );
  }
  const ALL = {
    'data-asking-price-line': true,
    'data-column-header': true,
    'data-key-block': true,
    'data-running-foot': true,
  };
  const NONE = Object.fromEntries(Object.keys(ALL).map((key) => [key, false]));

  // Matrix: skeleton.
  it('paints the asking line, the labelled header, the slots, the key block and the foot while pending', () => {
    const gates = ARTIFACT_ORDER.map(() => gate());
    serveArtifacts(
      server,
      Object.fromEntries(ARTIFACT_ORDER.map((key, i) => [key, { kind: 'gated', gate: gates[i]?.promise } as ArtifactAnswer])),
    );
    mount();
    expect(frame().dataset['state']).toBe('pending');
    expect(chrome()).toEqual(ALL);
    expect(frame().querySelector('[data-column-header]')?.textContent).toContain('Item Class / Base Type');
    expect(frame().textContent).toContain(ASKING_PRICE_COPY);
    for (const g of gates) g.open();
  });

  it('renders the chrome in order around the ranked rows when ready', async () => {
    const now = Date.now();
    const belt = rawEntry('Wide Belt');
    const ring = rawEntry('Coral Ring');
    const lost = rawEntry('Lost Ring');
    const bodies = bodiesWith(
      [belt, ring, lost],
      [
        priced(belt, 0.5, hoursBefore(now, 3)),
        unpriced(ring, { state: 'no-listings' }, hoursBefore(now, 9 * 24 + 2)),
        unpriced(lost, { state: 'unresolvable' }, hoursBefore(now, 1)),
      ],
    );
    serveArtifacts(server, {
      tracked: { kind: 'json', body: bodies.tracked },
      dataset: { kind: 'json', body: bodies.dataset },
    });
    mount();
    await settleTo('ready');
    expect(chrome()).toEqual(ALL);
    const order = Array.from(
      frame().querySelectorAll(
        '[data-masthead], [data-trust-strip], [data-asking-price-line], [data-column-header], [data-ranked-row], [data-unrankable-appendix], [data-key-block], [data-running-foot]',
      ),
      (node) => Object.keys((node as HTMLElement).dataset)[0],
    );
    expect(order).toEqual([
      'masthead',
      'trustStrip',
      'askingPriceLine',
      'columnHeader',
      'rankedRow',
      'rankedRow',
      'rankedRow',
      'unrankableAppendix',
      'keyBlock',
      'runningFoot',
    ]);
    const rows = frame().querySelectorAll('[data-ranked-row]');
    expect(rows[0]?.textContent).toContain('0.50');
    expect(rows[1]?.textContent).toContain('an open question');
    expect(rows[1]?.textContent).toContain('tried 9d ago');
    // Matrix: unresolvable — a trailing row, not valued.
    expect(rows[2]?.textContent).toContain('Lost Ring');
    expect(rows[2]?.textContent).toContain('not valued');
  });

  it('paints none of it on the refusal screen', async () => {
    serveArtifacts(server, { tracked: { kind: 'status', status: 404 } });
    mount();
    await settleTo('refused');
    expect(chrome()).toEqual(NONE);
  });

  it('paints none of it on the fetch-failure screen', async () => {
    serveArtifacts(server, { config: { kind: 'network-error' } });
    mount();
    await settleTo('failed');
    expect(chrome()).toEqual(NONE);
  });

  it('ranks the committed data/ into rows, dropping the below-threshold bases', async () => {
    const committed = import.meta.glob<unknown>('../../../data/{dataset,tracked}.json', { eager: true, import: 'default' });
    const dataset = committed['../../../data/dataset.json'];
    const tracked = committed['../../../data/tracked.json'];
    serveArtifacts(server, { tracked: { kind: 'json', body: tracked }, dataset: { kind: 'json', body: dataset } });
    mount();
    await settleTo('ready');
    const rows = Array.from(frame().querySelectorAll('[data-ranked-row]'));
    expect(rows.map((row) => row.querySelector('[data-unit-name]')?.textContent)).toEqual(['Gold Amulet']);
    expect(frame().textContent).not.toContain('Solar Amulet');
    expect(frame().textContent).not.toContain('Utility Belt');
    for (const row of rows) {
      expect(row.querySelectorAll('[data-unit-glyph]')).toHaveLength(1);
    }
  });

  it('opens a panel on the committed data/, the priced row linking a Forbidden%20Rites search, with no request', async () => {
    const committed = import.meta.glob<unknown>('../../../data/{dataset,tracked}.json', { eager: true, import: 'default' });
    const requests = serveArtifacts(server, {
      tracked: { kind: 'json', body: committed['../../../data/tracked.json'] },
      dataset: { kind: 'json', body: committed['../../../data/dataset.json'] },
    });
    mount();
    await settleTo('ready');
    const fetched = requests.length;
    const rows = Array.from(frame().querySelectorAll<HTMLElement>('[data-ranked-row]'));
    act(() => {
      rows[0]?.click();
    });
    await flush();
    const panels = Array.from(frame().querySelectorAll<HTMLElement>('[data-expansion-panel]'));
    expect(panels).toHaveLength(1);
    expect(panels.map((panel) => panel.previousElementSibling)).toEqual(rows.slice(0, 1));
    const links = panels.map((panel) => panel.querySelector<HTMLAnchorElement>('[data-cell="trade-link"] a'));
    for (const link of links) {
      expect(link?.getAttribute('href')).toMatch(
        /^https:\/\/www\.pathofexile\.com\/trade2\/search\/poe2\/Forbidden%20Rites\/[^/\s]+$/,
      );
    }
    expect(panels.map((panel) => panel.querySelector('[data-panel-sub]')?.textContent)).toEqual([
      expect.stringContaining('Payout Threshold 0.25 Divine.'),
    ]);
    expect(requests).toHaveLength(fetched);
  });
});

describe('the copy', () => {
  it('never says sells for, worth or market value in web source, outside the masthead copy the UX docs own', () => {
    const sources = import.meta.glob<string>(['./**/*.{ts,tsx}', '!./**/*.test.{ts,tsx}'], {
      eager: true,
      query: '?raw',
      import: 'default',
    });
    expect(Object.keys(sources).length).toBeGreaterThan(10);
    for (const [path, text] of Object.entries(sources)) {
      // The dek is a template in source: strip its source spelling, with the `DENOMINATION` placeholder.
      const dekSource = MASTHEAD_DEK.replace(DENOMINATION, '${DENOMINATION}');
      const scanned = text.replaceAll(MASTHEAD_TITLE, '').replaceAll(dekSource, '');
      expect(scanned, path).not.toMatch(/sells for|worth|market value/i);
    }
  });
});

describe('the frame', () => {
  it('is 1060 wide, min-height 1920, border-box with 24px sides, an outline edge and no overflow clip', async () => {
    serveArtifacts(server);
    mount();
    await settleTo('ready');
    const style = frame().style;
    expect(style.width).toBe('1060px');
    expect(style.minHeight).toBe('1920px');
    expect(style.height).toBe('');
    expect(style.boxSizing).toBe('border-box');
    expect(style.padding).toBe('0px 24px');
    expect(style.outline).toContain('1px solid');
    expect(style.overflow).toBe('');
    expect(style.border).toBe('');
  });
});

describe('the payout threshold', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  function thresholdInput(): HTMLInputElement {
    const found = frame().querySelector<HTMLInputElement>('[data-payout-threshold] input');
    if (found === null) {
      throw new Error('no threshold input rendered');
    }
    return found;
  }

  function rankedNames(): (string | null)[] {
    return Array.from(frame().querySelectorAll('[data-ranked-row] [data-unit-name]'), (node) => node.textContent);
  }

  /** Remounts the page, as a reload does: every view state starts again from rest. */
  function reload(): void {
    const mounted = root;
    act(() => {
      mounted?.unmount();
    });
    root = undefined;
    container?.remove();
    mount();
  }

  /** Bases at 0.1268, 0.5 and 0.8, and twenty filler bases above 1 so the list can grow. */
  function serveLadder(held?: Promise<void>): ReturnType<typeof serveArtifacts> {
    const now = Date.now();
    const low = rawEntry('Low Belt');
    const mid = rawEntry('Mid Belt');
    const high = rawEntry('High Belt');
    const filler = Array.from({ length: 20 }, (_, i) => rawEntry(`Filler Ring ${String(i + 1).padStart(2, '0')}`));
    const bodies = bodiesWith(
      [low, mid, high, ...filler],
      [
        priced(low, 0.1268, hoursBefore(now, 1)),
        priced(mid, 0.5, hoursBefore(now, 1)),
        priced(high, 0.8, hoursBefore(now, 1)),
        ...filler.map((entry, i) => priced(entry, 2 + i, hoursBefore(now, 1))),
      ],
    );
    const answers: Partial<Record<ArtifactKey, ArtifactAnswer>> = {
      tracked: { kind: 'json', body: bodies.tracked },
      dataset: { kind: 'json', body: bodies.dataset },
    };
    if (held === undefined) {
      return serveArtifacts(server, answers);
    }
    // Every artifact waits on `held`, then answers with the ladder (or its valid body).
    return serveArtifacts(
      server,
      Object.fromEntries(
        ARTIFACT_ORDER.map((key) => [key, { kind: 'gated', gate: held, then: answers[key] } as ArtifactAnswer]),
      ),
    );
  }

  function growList(): void {
    const button = frame().querySelector<HTMLButtonElement>('[data-expand-affordance]');
    act(() => {
      button?.click();
    });
  }

  it('lays the control group out as 216 + 16 + 276 = 508, keeping the 480 dek cap', async () => {
    serveArtifacts(server);
    mount();
    await settleTo('ready');
    const group = frame().querySelector<HTMLElement>('[data-control-group]');
    expect(group?.style.width).toBe('508px');
    expect(group?.style.gap).toBe('16px');
    const [recipe, threshold] = Array.from(group?.children ?? []) as HTMLElement[];
    expect(recipe?.dataset['recipeSlot']).toBe('');
    expect(recipe?.style.width).toBe('216px');
    expect(threshold?.dataset['payoutThreshold']).toBe('');
    expect(threshold?.style.width).toBe('276px');
    expect(CONTROL_GROUP_WIDTH).toBe(216 + 16 + 276);
    const dek = frame().querySelector('[data-masthead] p')?.parentElement;
    expect(dek?.style.maxWidth).toBe('480px');
  });

  it('renders while pending and ready, and not on the two failure screens', async () => {
    const gates = ARTIFACT_ORDER.map(() => gate());
    serveArtifacts(
      server,
      Object.fromEntries(ARTIFACT_ORDER.map((key, i) => [key, { kind: 'gated', gate: gates[i]?.promise } as ArtifactAnswer])),
    );
    mount();
    expect(frame().dataset['state']).toBe('pending');
    expect(thresholdInput().value).toBe('0.25');
    for (const g of gates) g.open();
    await settleTo('ready');
    expect(thresholdInput().value).toBe('0.25');

    serveArtifacts(server, { tracked: { kind: 'status', status: 404 } });
    reload();
    await settleTo('refused');
    expect(frame().querySelector('[data-payout-threshold]')).toBeNull();

    serveArtifacts(server, { config: { kind: 'network-error' } });
    reload();
    await settleTo('failed');
    expect(frame().querySelector('[data-payout-threshold]')).toBeNull();
  });

  // Matrix: raise threshold.
  it('re-ranks a raised threshold after the debounce with no request, and the dropped base is absent from the grown list', async () => {
    const requests = serveLadder();
    mount();
    await settleTo('ready');
    expect(requests).toHaveLength(ARTIFACT_ORDER.length);
    growList();
    expect(rankedNames()).toContain('Mid Belt');
    expect(rankedNames()).toContain('High Belt');
    expect(rankedNames()).not.toContain('Low Belt');

    typeInto(thresholdInput(), '0.6');
    // Before the debounce the ranking has not moved.
    expect(rankedNames()).toContain('Mid Belt');
    await pastDebounce();
    expect(rankedNames()).not.toContain('Mid Belt');
    expect(rankedNames()).toContain('High Belt');
    // The list is still grown, every ranked row is on the page, and the 0.5 base is nowhere.
    expect(rankedNames()).toHaveLength(21);
    expect(frame().textContent).not.toContain('Mid Belt');
    expect(requests).toHaveLength(ARTIFACT_ORDER.length);
    expect(localStorage.getItem(THRESHOLD_STORAGE_KEY)).toBe('0.6');
    const marker = frame().querySelector<HTMLElement>('[data-threshold-marker]');
    expect(parseFloat(marker?.style.left ?? '')).toBeCloseTo(20, 5);
  });

  it('keeps a threshold typed while pending through the move to ready, and ranks at it', async () => {
    const held = gate();
    serveLadder(held.promise);
    mount();
    expect(frame().dataset['state']).toBe('pending');
    typeInto(thresholdInput(), '0.6');
    // The set arrives before the debounce elapses.
    held.open();
    await settleTo('ready');
    await pastDebounce();
    expect(thresholdInput().value).toBe('0.60');
    expect(localStorage.getItem(THRESHOLD_STORAGE_KEY)).toBe('0.6');
    growList();
    expect(rankedNames()).not.toContain('Mid Belt');
    expect(rankedNames()).toContain('High Belt');
  });

  // Matrix: lower threshold.
  it('gives a sub-0.25 base a row when the threshold is lowered below it', async () => {
    const requests = serveLadder();
    mount();
    await settleTo('ready');
    growList();
    expect(rankedNames()).not.toContain('Low Belt');
    typeInto(thresholdInput(), '0.1');
    await pastDebounce();
    expect(rankedNames().at(-1)).toBe('Low Belt');
    expect(requests).toHaveLength(ARTIFACT_ORDER.length);
  });

  // Matrix: emptied.
  it('does not re-rank on an emptied field, and blur restores the last valid value', async () => {
    serveLadder();
    mount();
    await settleTo('ready');
    growList();
    const before = rankedNames();
    typeInto(thresholdInput(), '');
    await pastDebounce();
    expect(rankedNames()).toEqual(before);
    blur(thresholdInput());
    expect(thresholdInput().value).toBe('0.25');
    expect(localStorage.getItem(THRESHOLD_STORAGE_KEY)).toBeNull();
  });

  // Matrix: reload.
  it('keeps the set threshold across a reload, and resets the grown list and the open rows', async () => {
    serveLadder();
    mount();
    await settleTo('ready');
    typeInto(thresholdInput(), '0.6');
    await pastDebounce();
    growList();
    const firstRow = frame().querySelector<HTMLElement>('[data-ranked-row]');
    act(() => {
      firstRow?.click();
    });
    expect(frame().querySelectorAll('[data-ranked-row][data-open]')).toHaveLength(1);
    const ordering = rankedNames();

    serveLadder();
    reload();
    await settleTo('ready');
    expect(thresholdInput().value).toBe('0.60');
    expect(frame().querySelectorAll('[data-ranked-row][data-open]')).toHaveLength(0);
    expect(frame().querySelector('[data-expand-affordance]')?.getAttribute('aria-expanded')).toBe('false');
    growList();
    expect(rankedNames()).toEqual(ordering);
  });

  it('ranks at a stored 0.6 from the first paint', async () => {
    localStorage.setItem(THRESHOLD_STORAGE_KEY, '0.6');
    serveLadder();
    mount();
    await settleTo('ready');
    expect(thresholdInput().value).toBe('0.60');
    growList();
    expect(rankedNames()).not.toContain('Mid Belt');
    expect(rankedNames()).toContain('High Belt');
  });

  // Matrix: bad stored value.
  it.each(['abc', '7', '-1'])('falls back to 0.25 for a stored %j', async (stored) => {
    localStorage.setItem(THRESHOLD_STORAGE_KEY, stored);
    serveLadder();
    mount();
    await settleTo('ready');
    expect(thresholdInput().value).toBe('0.25');
    growList();
    expect(rankedNames()).toContain('Mid Belt');
    expect(rankedNames()).not.toContain('Low Belt');
  });

  // Matrix: storage throws.
  it('falls back to 0.25 when storage throws, and typing still re-ranks', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    serveLadder();
    mount();
    await settleTo('ready');
    expect(thresholdInput().value).toBe('0.25');
    growList();
    typeInto(thresholdInput(), '0.6');
    await pastDebounce();
    expect(rankedNames()).not.toContain('Mid Belt');
    expect(rankedNames()).toContain('High Belt');
  });

  // Matrix: cleared storage.
  it('returns to 0.25 after storage is cleared, and the rest of the page is identical', async () => {
    serveLadder();
    mount();
    await settleTo('ready');
    const atRest = frame().outerHTML;
    typeInto(thresholdInput(), '0.6');
    await pastDebounce();
    blur(thresholdInput());
    expect(localStorage.getItem(THRESHOLD_STORAGE_KEY)).toBe('0.6');

    localStorage.clear();
    serveLadder();
    reload();
    await settleTo('ready');
    expect(thresholdInput().value).toBe('0.25');
    // React's generated ids differ per mount; everything else must match byte for byte.
    const strip = (html: string): string => html.replace(/\s(id|for|aria-describedby)="[^"]*"/g, '');
    expect(strip(frame().outerHTML)).toBe(strip(atRest));
  });
});

describe('the unresolvable hand-off (story 2.3 to story 2.6)', () => {
  const lost = rawEntry('Lost Ring');
  const bodies = bodiesWith([lost], [unpriced(lost, { state: 'unresolvable' }, hoursBefore(Date.now(), 1))]);

  function lostRow(): HTMLElement {
    const rows = Array.from(frame().querySelectorAll<HTMLElement>('[data-ranked-row]'));
    expect(rows).toHaveLength(1);
    const [row] = rows;
    if (row === undefined) {
      throw new Error('no row');
    }
    expect(row.querySelector('[data-unit-name]')?.textContent).toBe('Lost Ring');
    return row;
  }

  // Matrix: report absent.
  it('renders the unresolvable row with sync-report.json absent, and the strip raises no health line', async () => {
    serveArtifacts(server, {
      tracked: { kind: 'json', body: bodies.tracked },
      dataset: { kind: 'json', body: bodies.dataset },
      syncReport: { kind: 'status', status: 404 },
    });
    mount();
    await settleTo('ready');
    // A lone unresolvable row makes the list honest-empty, so its EV cell reads state 23's phrase.
    expect(lostRow().querySelector('[data-cell="ev"]')?.textContent).toBe('no figure yet');
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
    // A lone unresolvable row makes the list honest-empty, so its EV cell reads state 23's phrase.
    expect(lostRow().querySelector('[data-cell="ev"]')?.textContent).toBe('no figure yet');
    const health = frame().querySelector('[data-trust-strip] [data-health-line]');
    expect(health?.textContent?.replaceAll('\u00a0', ' ')).toBe('× 1 unresolvable');
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
    const statement = frame().querySelector<HTMLElement>('[data-list-statement]');
    expect(statement?.dataset['listStatement']).toBe('honest-empty');
    // EXPERIENCE.md revision 9: a list of only unresolvable rows drops "yet".
    expect(statement?.textContent).toBe(`In canonical order, not ranked: no tracked unit has a price from ${TEST_LEAGUE}.`);
    const phrase = lostRow().querySelector<HTMLElement>('[data-cell="ev"] [data-money-phrase]');
    expect(phrase?.textContent).toBe('no figure yet');
    expect(phrase?.style.color).toBe(rgb(colors.ink));
  });
});

describe('the trust strip', () => {
  it('sits between the masthead and the asking-price line, closed on load, and toggles with no request', async () => {
    const requests = serveArtifacts(server);
    mount();
    await settleTo('ready');
    const strip = frame().querySelector<HTMLElement>('[data-trust-strip]');
    expect(strip?.previousElementSibling?.hasAttribute('data-masthead')).toBe(true);
    expect(strip?.nextElementSibling?.hasAttribute('data-asking-price-line')).toBe(true);
    expect(frame().querySelector('[data-sync-report-panel]')).toBeNull();
    expect(strip?.textContent).toContain('producer poe-mod-weights-producer');
    // A healthy run: no third line, no count of nothing.
    expect(strip?.querySelector('[data-health-line]')).toBeNull();
    expect(strip?.textContent).not.toContain('0 unresolvable');
    const fetched = requests.length;

    act(() => {
      strip?.click();
    });
    await flush();
    const panel = frame().querySelector('[data-sync-report-panel]');
    expect(panel).not.toBeNull();
    expect(strip?.nextElementSibling).toBe(panel);
    expect(panel?.nextElementSibling?.hasAttribute('data-asking-price-line')).toBe(true);

    act(() => {
      strip?.click();
    });
    await flush();
    expect(frame().querySelector('[data-sync-report-panel]')).toBeNull();
    expect(requests).toHaveLength(fetched);
  });
});

/** The threshold field, for the statement and interaction-surface tests. */
function payoutField(): HTMLInputElement {
  const found = frame().querySelector<HTMLInputElement>('[data-payout-threshold] input');
  if (found === null) {
    throw new Error('no threshold input rendered');
  }
  return found;
}

function unitNames(): (string | null)[] {
  return Array.from(frame().querySelectorAll('[data-ranked-row] [data-unit-name]'), (node) => node.textContent);
}

function serveBodies(bodies: ReturnType<typeof bodiesWith>): ReturnType<typeof serveArtifacts> {
  return serveArtifacts(server, {
    tracked: { kind: 'json', body: bodies.tracked },
    dataset: { kind: 'json', body: bodies.dataset },
  });
}

describe('the list statement', () => {
  afterEach(() => {
    localStorage.clear();
  });

  function statement(): HTMLElement | null {
    return frame().querySelector<HTMLElement>('[data-list-statement]');
  }

  function numerals(): string[] {
    return Array.from(frame().querySelectorAll('[data-ranked-row] [data-cell="rank"]'), (node) => node.textContent ?? '');
  }

  function evCells(): string[] {
    return Array.from(frame().querySelectorAll('[data-ranked-row] [data-cell="ev"]'), (node) => node.textContent ?? '');
  }

  function expectChromeAround(): void {
    for (const attr of ['data-asking-price-line', 'data-unrankable-appendix', 'data-key-block', 'data-running-foot']) {
      expect(frame().querySelector(`[${attr}]`), attr).not.toBeNull();
    }
  }

  // Matrix: league reset.
  it('lists a league reset in canonical order, with no numerals, no figure yet in every EV cell and the canonical statement', async () => {
    const now = Date.now();
    const belt = rawEntry('Wide Belt');
    const ring = rawEntry('Coral Ring');
    const amulet = rawEntry('Gold Amulet');
    serveBodies(
      bodiesWith(
        [belt, ring, amulet],
        [
          priced(belt, 1.5, hoursBefore(now, 30 * 24), 'Standard'),
          priced(ring, 0.8, hoursBefore(now, 30 * 24), 'Standard'),
          priced(amulet, 2, hoursBefore(now, 30 * 24), 'Standard'),
        ],
      ),
    );
    mount();
    await settleTo('ready');
    expect(statement()?.dataset['listStatement']).toBe('honest-empty');
    expect(statement()?.textContent).toBe(
      `In canonical order, not ranked: no tracked unit has a price from ${TEST_LEAGUE} yet.`,
    );
    // Under the asking-price line, above the column header.
    expect(statement()?.previousElementSibling?.hasAttribute('data-asking-price-line')).toBe(true);
    expect(statement()?.nextElementSibling?.querySelector('[data-column-header]')).not.toBeNull();
    expect(statement()?.style.height).toBe('21px');
    // Canonical key order: for three iLvl-82 raw bases, the base type ids in order.
    expect(unitNames()).toEqual(['Coral Ring', 'Gold Amulet', 'Wide Belt']);
    expect(numerals()).toEqual(['', '', '']);
    expect(evCells()).toEqual(['no figure yet', 'no figure yet', 'no figure yet']);
    // None of last league's figures, anywhere on the list.
    expect(frame().querySelector('[data-ranked-list]')?.textContent).not.toMatch(/\d\.\d\d/);

    const first = frame().querySelector<HTMLElement>('[data-ranked-row]');
    act(() => {
      first?.click();
    });
    expect(frame().querySelector('[data-expansion-panel] [data-cell="state"]')?.textContent).toBe(
      '∆ not-yet-synced · league-mismatch',
    );
    expectChromeAround();
  });

  // Matrix: mixed reset. A league reset mid-refill, where one entry already reads no-listings.
  it('lists a mixed reset in canonical order across both unpriced groups, no figure yet in every EV cell', async () => {
    const now = Date.now();
    const belt = rawEntry('Wide Belt');
    const ring = rawEntry('Coral Ring');
    const amulet = rawEntry('Gold Amulet');
    serveBodies(
      bodiesWith(
        [belt, ring, amulet],
        [
          priced(belt, 1.5, hoursBefore(now, 30 * 24), 'Standard'),
          priced(ring, 0.8, hoursBefore(now, 30 * 24), 'Standard'),
          unpriced(amulet, { state: 'no-listings' }, hoursBefore(now, 2)),
        ],
      ),
    );
    mount();
    await settleTo('ready');
    expect(statement()?.dataset['listStatement']).toBe('honest-empty');
    expect(statement()?.textContent).toBe(
      `In canonical order, not ranked: no tracked unit has a price from ${TEST_LEAGUE} yet.`,
    );
    // Canonical key order across the groups, not no-listings first.
    expect(unitNames()).toEqual(['Coral Ring', 'Gold Amulet', 'Wide Belt']);
    expect(numerals()).toEqual(['', '', '']);
    expect(evCells()).toEqual(['no figure yet', 'no figure yet', 'no figure yet']);
    expect(frame().querySelector('[data-ranked-list]')?.textContent).not.toMatch(/\d\.\d\d/);

    // The no-listings row's expansion keeps its own state and phrase.
    const amuletRow = frame().querySelectorAll<HTMLElement>('[data-ranked-row]')[1];
    act(() => {
      amuletRow?.click();
    });
    const panel = frame().querySelector('[data-expansion-panel]');
    expect(panel?.querySelector('[data-cell="state"]')?.textContent).toContain('no-listings');
    expect(panel?.querySelector('[data-cell="figure"]')?.textContent).toBe('an open question');
  });

  // Matrix: partial refresh.
  it('ranks a partial refresh normally, with no statement', async () => {
    const now = Date.now();
    const belt = rawEntry('Wide Belt');
    const ring = rawEntry('Coral Ring');
    serveBodies(
      bodiesWith(
        [belt, ring],
        [priced(belt, 1.5, hoursBefore(now, 1)), priced(ring, 0.8, hoursBefore(now, 30 * 24), 'Standard')],
      ),
    );
    mount();
    await settleTo('ready');
    expect(statement()).toBeNull();
    expect(unitNames()).toEqual(['Wide Belt', 'Coral Ring']);
    expect(numerals()).toEqual(['1', '']);
    expect(evCells()).toEqual(['1.50', 'no figure yet']);
    expect(frame().textContent).not.toMatch(/stale/i);
    expectChromeAround();
  });

  // Matrix: nothing clears, then threshold lowered.
  it('states that nothing clears 3.00, keeps the trail rows, and drops the statement once a row clears', async () => {
    const now = Date.now();
    const belt = rawEntry('Wide Belt');
    const ring = rawEntry('Coral Ring');
    const never = rawEntry('Lost Belt');
    const requests = serveBodies(
      bodiesWith([belt, ring, never], [priced(belt, 1.5, hoursBefore(now, 1)), priced(ring, 0.8, hoursBefore(now, 1))]),
    );
    mount();
    await settleTo('ready');
    expect(statement()).toBeNull();

    typeInto(payoutField(), '3');
    await pastDebounce();
    expect(statement()?.dataset['listStatement']).toBe('nothing-clears');
    expect(statement()?.textContent).toBe('Nothing clears your Payout Threshold of 3.00 Divine.');
    expect(statement()?.previousElementSibling?.hasAttribute('data-asking-price-line')).toBe(true);
    // Not a money-slot phrase: the trail row keeps its own phrase, as it was.
    expect(unitNames()).toEqual(['Lost Belt']);
    expect(evCells()).toEqual(['no figure yet']);
    expectChromeAround();

    typeInto(payoutField(), '1');
    await pastDebounce();
    expect(statement()).toBeNull();
    expect(unitNames()).toEqual(['Wide Belt', 'Lost Belt']);
    expect(numerals()).toEqual(['1', '']);
    expect(requests).toHaveLength(ARTIFACT_ORDER.length);
  });

  it('prints no recipes.json absence line on the committed data/, and the control prints its two recipes', async () => {
    const committed = import.meta.glob<unknown>('../../../data/{dataset,tracked,recipes}.json', {
      eager: true,
      import: 'default',
    });
    const recipes = committed['../../../data/recipes.json'];
    serveArtifacts(server, {
      tracked: { kind: 'json', body: committed['../../../data/tracked.json'] },
      dataset: { kind: 'json', body: committed['../../../data/dataset.json'] },
      recipes: { kind: 'json', body: recipes },
    });
    mount();
    await settleTo('ready');
    expect((recipes as { readonly recipes: readonly unknown[] }).recipes).toHaveLength(2);
    expect(frame().querySelector('[data-recipe-options]')?.textContent).toBe('greater|perfect');
    // The committed dataset now carries an orb rate: the cost line is a figure, not the no-figure phrase.
    expect(frame().querySelector('[data-recipe-cost]')?.textContent).toBe('0.01Divine / craft');
    expect(frame().querySelector('[data-absence-lines]')).toBeNull();
    expect(frame().textContent).not.toContain('recipes.json');
    expect(statement()).toBeNull();
    const dek = frame().querySelector('[data-masthead] p')?.textContent;
    expect(dek).toBe(
      'Item Classes ranked by expected payout per craft, beside the Base Types worth selling raw. Every figure is in Divine.',
    );
    expect(dek).not.toContain('not ranked yet');
    expect(frame().textContent).not.toContain('not ranked yet');
  });
});

/**
 * Twenty-nine distinct crafted Item Classes, the absent-weights world's
 * fixture, served out of order (a stride-7 walk) so the page's order can only
 * come from `core`'s sort.
 */
function twentyNineClasses(): ReturnType<typeof craftedEntry>[] {
  return Array.from({ length: 29 }, (_, i) => {
    const n = String(((i * 7) % 29) + 1).padStart(2, '0');
    return craftedEntry(`Class ${n}`, `fixture.class${n}`);
  });
}

/** The fixture's class names in the order the page must show them. */
function sortedClassNames(): string[] {
  return Array.from({ length: 29 }, (_, i) => `Class ${String(i + 1).padStart(2, '0')}`);
}

const ABSENT_REASON = 'class absent from weights file';

describe('the Unrankable appendix', () => {
  afterEach(() => {
    localStorage.clear();
  });

  function appendix(): HTMLElement {
    const found = frame().querySelector<HTMLElement>('[data-unrankable-appendix]');
    if (found === null) {
      throw new Error('no appendix rendered');
    }
    return found;
  }

  function appendixRows(): HTMLElement[] {
    return Array.from(frame().querySelectorAll<HTMLElement>('[data-appendix-row]'));
  }

  /** The page tail's children, by their first data attribute. */
  function tailOrder(): string[] {
    const tail = frame().querySelector<HTMLElement>('[data-page-tail]');
    return Array.from(tail?.children ?? [], (node) => Object.keys((node as HTMLElement).dataset)[0] ?? '');
  }

  // Matrix: committed.
  it('renders the appendix on the committed data/, above the key block and the foot', async () => {
    const committed = import.meta.glob<unknown>('../../../data/{dataset,tracked,recipes,weights}.json', {
      eager: true,
      import: 'default',
    });
    serveArtifacts(server, {
      tracked: { kind: 'json', body: committed['../../../data/tracked.json'] },
      dataset: { kind: 'json', body: committed['../../../data/dataset.json'] },
      recipes: { kind: 'json', body: committed['../../../data/recipes.json'] },
      weights: { kind: 'json', body: committed['../../../data/weights.json'] },
    });
    mount();
    await settleTo('ready');
    // Producer 6.1.0 declares every pool `complete`, and the Emerald entry tracks the global Attack Speed
    // stat its tiers carry, so no Item Class is unrankable: the appendix renders with no rows.
    expect(appendixRows()).toHaveLength(0);
    expect(appendix().querySelector<HTMLElement>('[data-appendix-count]')?.textContent).toBe('0 Item Classes');
    expect(tailOrder()).toEqual(['unrankableAppendix', 'keyBlock', 'runningFoot']);
    expect(frame().querySelector<HTMLElement>('[data-page-tail]')?.style.marginTop).toBe('auto');
    // The pin needs the tail to be a direct child of the flex frame.
    expect(frame().querySelector('[data-page-tail]')?.parentElement).toBe(frame());
    expect(frame().style.display).toBe('flex');
    expect(frame().style.flexDirection).toBe('column');
  });

  // Matrix: absent weights.
  it('lists 29 crafted classes when weights.json is absent, every row whole, then the key block and the foot', async () => {
    const now = Date.now();
    const belt = rawEntry('Wide Belt');
    const classes = twentyNineClasses();
    const bodies = bodiesWith([...classes, belt], [priced(belt, 0.5, hoursBefore(now, 1))]);
    serveArtifacts(server, {
      tracked: { kind: 'json', body: bodies.tracked },
      dataset: { kind: 'json', body: bodies.dataset },
      weights: { kind: 'status', status: 404 },
    });
    mount();
    await settleTo('ready');
    const rows = appendixRows();
    expect(rows).toHaveLength(29);
    expect(classes.map((entry) => entry.className)).not.toEqual(sortedClassNames());
    expect(rows.map((row) => row.querySelector('[data-appendix-class]')?.textContent)).toEqual(sortedClassNames());
    for (const row of rows) {
      expect(row.querySelector('[data-cell="reason"]')?.textContent).toBe(ABSENT_REASON);
    }
    const count = appendix().querySelector<HTMLElement>('[data-appendix-count]');
    expect(count?.textContent).toBe('29 Item Classes');
    expect(count?.style.color).toBe(rgb(colors.rust));
    // Readable with nothing expanded.
    expect(frame().querySelectorAll('[data-expansion-panel]')).toHaveLength(0);
    expect(tailOrder()).toEqual(['unrankableAppendix', 'keyBlock', 'runningFoot']);
    const order = Array.from(
      frame().querySelectorAll('[data-ranked-row], [data-appendix-row], [data-key-block], [data-running-foot]'),
      (node) => Object.keys((node as HTMLElement).dataset)[0],
    );
    expect(order).toEqual(['rankedRow', ...rows.map(() => 'appendixRow'), 'keyBlock', 'runningFoot']);
    // No appendix row is a Base Type.
    expect(appendix().textContent).not.toContain('Wide Belt');
    expect(frame().querySelector('[data-masthead] p')?.textContent).toBe(MASTHEAD_DEK);
  });

  // Matrix: absent weights and absent recipes.
  it('lists the same classes when weights.json and recipes.json are both absent', async () => {
    const bodies = bodiesWith(twentyNineClasses(), []);
    serveArtifacts(server, {
      tracked: { kind: 'json', body: bodies.tracked },
      dataset: { kind: 'json', body: bodies.dataset },
      weights: { kind: 'status', status: 404 },
      recipes: { kind: 'status', status: 404 },
    });
    mount();
    await settleTo('ready');
    expect(appendixRows()).toHaveLength(29);
    expect(appendix().querySelector('[data-appendix-count]')?.textContent).toBe('29 Item Classes');
  });

  // Matrix: web, a cross-file failure on one class (AD-17).
  it('excludes only the class a cross-file check fails, prints the reason alone, and lists the diagnosis in the panel', async () => {
    const now = Date.now();
    const belt = rawEntry('Wide Belt');
    const amulets = craftedEntry('Amulets', 'accessory.amulet');
    const sentinel: TrackedEntry = {
      ...craftedEntry('Bows', 'weapon.bow'),
      prefix: { kind: 'banded', statId: 'explicit.stat_1', valueMin: 0, valueMax: 9999 },
    };
    const tierOf = (statId: string, ranges: number[][]) => ({
      sourceModifierId: statId,
      modGroup: statId,
      itemLevelMin: 1,
      weight: 100,
      weightSource: 'published',
      lines: [{ statId, ranges }],
    });
    const poolsOf = (statId: string, ranges: number[][]) => ({
      prefix: { poolCoverage: 'complete', entries: [tierOf(statId, ranges)] },
      suffix: { poolCoverage: 'complete', entries: [tierOf('explicit.stat_9', [[1, 2]])] },
    });
    const weights = {
      ...(VALID_BODIES.weights as object),
      bases: {
        'accessory.amulet': { Amulets: poolsOf('explicit.stat_3299347043', []) },
        'weapon.bow': { Bows: poolsOf('explicit.stat_1', [[43, 56.5]]) },
      },
    };
    const bodies = bodiesWith([amulets, sentinel, belt], [priced(belt, 0.5, hoursBefore(now, 1))]);
    serveArtifacts(server, {
      tracked: { kind: 'json', body: bodies.tracked },
      dataset: { kind: 'json', body: bodies.dataset },
      weights: { kind: 'json', body: weights },
    });
    mount();
    await settleTo('ready');

    const rows = appendixRows();
    expect(rows.map((row) => row.querySelector('[data-appendix-class]')?.textContent)).toEqual(['Amulets', 'Bows']);
    // Amulets is rankable but no recipe is served (retro item 29), so it takes the recipe-less reason.
    expect(rows[0]?.querySelector('[data-cell="reason"]')?.textContent).toBe('recipe cannot reach this class');
    expect(rows[1]?.querySelector('[data-cell="reason"]')?.textContent).toBe('class disagrees with weights file');
    expect(appendix().textContent).not.toContain('edge-alignment');
    expect(frame().querySelectorAll('[data-ranked-row]')).toHaveLength(1);

    const strip = frame().querySelector<HTMLElement>('[data-trust-strip]');
    expect(strip?.textContent).not.toContain('edge-alignment');
    expect(strip?.querySelector('[data-health-line]')).toBeNull();
    act(() => {
      strip?.click();
    });
    const broken = frame().querySelectorAll('[data-sync-report-panel] [data-panel-column]')[1];
    const lines = Array.from(broken?.querySelectorAll('[data-verbatim]') ?? [], (node) => node.textContent);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/^edge-alignment · \["crafted","weapon\.bow","Bows",82,/);
  });

  // Matrix: no crafted entries.
  it('is the empty treatment when weights.json is absent and every entry is raw', async () => {
    const now = Date.now();
    const belt = rawEntry('Wide Belt');
    const bodies = bodiesWith([belt], [priced(belt, 0.5, hoursBefore(now, 1))]);
    serveArtifacts(server, {
      tracked: { kind: 'json', body: bodies.tracked },
      dataset: { kind: 'json', body: bodies.dataset },
      weights: { kind: 'status', status: 404 },
    });
    mount();
    await settleTo('ready');
    expect(appendix().textContent).toBe('Appendix: Unrankable — 0 Item Classes');
    expect(appendixRows()).toHaveLength(0);
  });

  // Matrix: loading.
  it('is absent while pending, and the tail keeps the key block and the foot', async () => {
    const gates = ARTIFACT_ORDER.map(() => gate());
    serveArtifacts(
      server,
      Object.fromEntries(ARTIFACT_ORDER.map((key, i) => [key, { kind: 'gated', gate: gates[i]?.promise } as ArtifactAnswer])),
    );
    mount();
    expect(frame().dataset['state']).toBe('pending');
    expect(frame().querySelector('[data-unrankable-appendix]')).toBeNull();
    expect(tailOrder()).toEqual(['keyBlock', 'runningFoot']);
    expect(frame().querySelector('[data-page-tail]')?.parentElement).toBe(frame());
    for (const g of gates) g.open();
    await settleTo('ready');
  });

  it('is absent from the refusal screen', async () => {
    serveArtifacts(server, { tracked: { kind: 'status', status: 404 } });
    mount();
    await settleTo('refused');
    expect(frame().querySelector('[data-unrankable-appendix]')).toBeNull();
  });

  it('is absent from the fetch-failure screen', async () => {
    serveArtifacts(server, { config: { kind: 'network-error' } });
    mount();
    await settleTo('failed');
    expect(frame().querySelector('[data-unrankable-appendix]')).toBeNull();
  });
});

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
    const filler = Array.from({ length: 22 }, (_, i) => rawEntry(`Filler Ring ${String(i + 1).padStart(2, '0')}`));
    // weights.json absent, so the appendix holds rows the guard covers too.
    const bodies = bodiesWith(
      [...filler, craftedEntry('Bows', 'weapon.bow'), craftedEntry('Wands', 'weapon.wand')],
      filler.map((entry, i) =>
        priced(entry, 1 + i / 10, hoursBefore(now, 1), TEST_LEAGUE, { id: `search${String(i)}`, league: TEST_LEAGUE }),
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
    const appendixRows = Array.from(frame().querySelectorAll<HTMLElement>('[data-appendix-row]'));
    expect(appendixRows).toHaveLength(2);
    const beforeAppendix = frame().innerHTML;
    for (const row of appendixRows) {
      act(() => {
        row.click();
      });
    }
    await flush();
    expect(frame().innerHTML).toBe(beforeAppendix);
    const appendix = frame().querySelector<HTMLElement>('[data-unrankable-appendix]');
    expect(appendix?.querySelectorAll('button, a, input, [role], [tabindex], [title], [class]')).toHaveLength(0);
    for (const row of appendixRows) {
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
    for (const label of Array.from(header?.children ?? []) as HTMLElement[]) {
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

describe('the chase cells on the committed data/', () => {
  it('shows at most three cells on every crafted row of each recipe, each curated, with no numeral but its tier', async () => {
    const committed = import.meta.glob<unknown>('../../../data/{dataset,tracked,recipes,weights,catalogue/stats}.json', {
      eager: true,
      import: 'default',
    });
    serveArtifacts(server, {
      tracked: { kind: 'json', body: committed['../../../data/tracked.json'] },
      dataset: { kind: 'json', body: committed['../../../data/dataset.json'] },
      recipes: { kind: 'json', body: committed['../../../data/recipes.json'] },
      weights: { kind: 'json', body: committed['../../../data/weights.json'] },
      catalogueStats: { kind: 'json', body: committed['../../../data/catalogue/stats.json'] },
    });
    mount();
    await settleTo('ready');
    for (const recipeId of ['greater', 'perfect']) {
      if (recipeId === 'perfect') {
        act(() => {
          frame().querySelector<HTMLElement>('[data-recipe-option="perfect"]')?.click();
        });
      }
      const crafted = Array.from(frame().querySelectorAll<HTMLElement>('[data-ranked-row]:not([data-raw])'));
      expect(crafted.length, recipeId).toBeGreaterThan(0);
      let filled = 0;
      for (const row of crafted) {
        const slots = Array.from(row.querySelectorAll<HTMLElement>('[data-chase-cell]'));
        expect(slots, recipeId).toHaveLength(3);
        for (const cell of slots) {
          expect(cell.querySelector('[data-verbatim]'), cell.textContent).toBeNull();
          expect(cell.textContent.replaceAll(/T\d+/g, ''), cell.textContent).not.toMatch(/\d/);
          filled += cell.textContent === '' ? 0 : 1;
        }
      }
      expect(filled, recipeId).toBeGreaterThan(0);
    }
  });
});
