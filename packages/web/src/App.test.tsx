import type { SetupServerApi } from 'msw/node';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { App } from './App';
import { absenceLine } from './frame/AbsenceLines';
import {
  FETCH_FAILURE_EYEBROW,
  FETCH_FAILURE_TITLE,
  REFUSAL_EYEBROW,
  REFUSAL_TITLE,
  TRY_AGAIN,
} from './frame/FailureScreen';
import { MASTHEAD_TITLE } from './frame/Masthead';
import { ROW_SLOT_COUNT } from './frame/RowSlots';
import {
  gate,
  serveArtifacts,
  sharedServer,
  TEST_LEAGUE,
  VALID_BODIES,
  type ArtifactAnswer,
} from './test-support/artifact-server';
import { ARTIFACT_ORDER, type ArtifactKey } from './load/artifacts';
import { PageProvider } from './theme/PageProvider';

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

    // Seven of the eight arrive, one at a time; the page does not move.
    for (const key of ARTIFACT_ORDER.slice(0, 7)) {
      gates.get(key)?.open();
      await flush();
      expect(container?.innerHTML).toContain(pending);
      expect(frame().outerHTML).toBe(pending);
    }

    gates.get('catalogueStatic')?.open();
    await settleTo('ready');
    expect(frame().querySelectorAll('[data-row-slot]')).toHaveLength(0);
  });
});

describe('the outcomes', () => {
  // Matrix: all eight valid.
  it('shows ready with the league in the eyebrow when all eight are valid', async () => {
    const requests = serveArtifacts(server);
    mount();
    await settleTo('ready');
    expect(frame().textContent).toContain(`League ${TEST_LEAGUE}`);
    expect(frame().querySelector('[data-absence-lines]')).toBeNull();
    expect(requests).toHaveLength(8);
    for (const request of requests) {
      expect(request.cache).toBe('no-store');
      expect(request.url.search).toBe('');
    }
  });

  // Matrix: invalid shape.
  it('refuses an invalid tracked.json, naming it and both versions, with no retry', async () => {
    serveArtifacts(server, { tracked: { kind: 'json', body: { schemaVersion: '1.0.0', entries: 42 } } });
    mount();
    await settleTo('refused');
    const text = frame().textContent;
    expect(frame().querySelector('section')?.getAttribute('role')).toBe('alert');
    expect(frame().hasAttribute('aria-busy')).toBe(false);
    expect(text).toContain(REFUSAL_EYEBROW);
    expect(text).toContain(REFUSAL_TITLE);
    expect(frame().querySelector('[data-artifact]')?.textContent).toBe('tracked.json');
    expect(frame().querySelector('[data-declared]')?.textContent).toBe('1.0.0');
    expect(frame().querySelector('[data-expected]')?.textContent).toBe('1.0.0');
    expect(text).toContain('× unresolvable');
    expect(text).not.toContain(TRY_AGAIN);
    expect(text).not.toContain(MASTHEAD_TITLE);
  });

  // Matrix: unknown major.
  it('refuses dataset.json declaring 2.0.0, expecting 1.0.0', async () => {
    serveArtifacts(server, { dataset: { kind: 'json', body: { ...(VALID_BODIES.dataset as object), schemaVersion: '2.0.0' } } });
    mount();
    await settleTo('refused');
    expect(frame().querySelector('[data-artifact]')?.textContent).toBe('dataset.json');
    expect(frame().querySelector('[data-declared]')?.textContent).toBe('2.0.0');
    expect(frame().querySelector('[data-expected]')?.textContent).toBe('1.0.0');
  });

  // Matrix: missing version.
  it('refuses config.json with no schemaVersion, declaring none', async () => {
    serveArtifacts(server, { config: { kind: 'json', body: { league: TEST_LEAGUE, minChunkSearches: 1 } } });
    mount();
    await settleTo('refused');
    expect(frame().querySelector('[data-artifact]')?.textContent).toBe('config.json');
    expect(frame().querySelector('[data-declared]')?.textContent).toBe('none');
  });

  // Matrix: network error / 5xx, and the retry.
  it('shows the fetch-failure screen and re-fetches all eight on + Try again', async () => {
    const requests = serveArtifacts(server, { catalogueStats: { kind: 'status', status: 503 } });
    mount();
    await settleTo('failed');
    expect(frame().textContent).toContain(FETCH_FAILURE_EYEBROW);
    expect(frame().textContent).toContain(FETCH_FAILURE_TITLE);
    expect(frame().querySelector('[data-artifact]')?.textContent).toBe('catalogue/stats.json');
    expect(requests).toHaveLength(8);

    // The file is back; the retry fetches the whole set again.
    const retried = serveArtifacts(server);
    const button = frame().querySelector('button');
    expect(button?.textContent).toBe(TRY_AGAIN);
    act(() => {
      button?.click();
    });
    expect(frame().dataset['state']).toBe('pending');
    await settleTo('ready');
    expect(retried).toHaveLength(8);
  });

  it('shows the fetch-failure screen when a fetch rejects', async () => {
    serveArtifacts(server, { catalogueStats: { kind: 'network-error' } });
    mount();
    await settleTo('failed');
    expect(frame().querySelector('[data-artifact]')?.textContent).toBe('catalogue/stats.json');
  });

  // Matrix: required absent.
  it('refuses a missing tracked.json, declaring none', async () => {
    serveArtifacts(server, { tracked: { kind: 'status', status: 404 } });
    mount();
    await settleTo('refused');
    expect(frame().querySelector('[data-artifact]')?.textContent).toBe('tracked.json');
    expect(frame().querySelector('[data-declared]')?.textContent).toBe('none');
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
    const lines = frame().querySelectorAll('[data-absence-lines] p');
    expect(Array.from(lines, (line) => line.textContent)).toEqual([absenceLine('recipes')]);
    expect(absenceLine('recipes')).toBe('Not published: recipes.json — no crafted rows can be ranked.');
    expect(absenceLine('weights')).toBe('Not published: weights.json — every crafted class is unrankable.');
    expect(absenceLine('syncReport')).toBe('Not published: sync-report.json — the sync report is unavailable.');
  });

  // Matrix: non-JSON body.
  it('refuses a 200 carrying HTML, declaring none', async () => {
    serveArtifacts(server, { dataset: { kind: 'text', body: '<!doctype html><title>x</title>' } });
    mount();
    await settleTo('refused');
    expect(frame().querySelector('[data-artifact]')?.textContent).toBe('dataset.json');
    expect(frame().querySelector('[data-declared]')?.textContent).toBe('none');
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
