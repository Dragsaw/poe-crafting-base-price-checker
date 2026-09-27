/**
 * Test scaffolding for the seven AD-24 artifacts. Never imported by the app.
 *
 * Every web fetch test registers all seven handlers, plus a trap for a path
 * the page never fetches: loopback URLs pass through the shared MSW guard
 * unhandled, so a missing handler would reach a real socket rather than fail
 * loudly.
 */

import { http, HttpResponse } from 'msw';
import type { SetupServerApi } from 'msw/node';

import { ARTIFACT_ORDER, ARTIFACTS, type ArtifactKey } from '../load/artifacts';
import { artifactUrl } from '../load/load-artifacts';

/**
 * The shared server lives in the root `test/setup.ts`, outside this package's
 * `rootDir`, so a static import would pull it into the `web` program. The
 * dynamic import resolves to the instance Vitest already loaded as a setup file.
 */
// `import.meta.dirname`, not `import.meta.url`: under jsdom the url is not `file:`.
const SHARED_SETUP = `${(import.meta as ImportMeta & { readonly dirname: string }).dirname}/../../../../test/setup.ts`;

export async function sharedServer(): Promise<SetupServerApi> {
  const setup = (await import(/* @vite-ignore */ SHARED_SETUP)) as { server: SetupServerApi };
  return setup.server;
}

export const TEST_LEAGUE = 'Forbidden Rites';

/**
 * A file the site publishes that `web` never fetches (AD-24). `serveArtifacts`
 * serves it as a trap, so a request to it lands in the log and a test fails on it.
 */
export const NEVER_FETCHED_PATH = 'catalogue/static.json';

/** A minimal valid body for each artifact. */
export const VALID_BODIES: Readonly<Record<ArtifactKey, unknown>> = {
  dataset: {
    schemaVersion: '1.0.0',
    league: TEST_LEAGUE,
    generatedAt: '2026-09-26T14:34:21.684Z',
    entries: [],
    currencyRates: [],
  },
  syncReport: {
    schemaVersion: '1.1.0',
    runStartedAt: '2026-09-26T14:34:18.729Z',
    figures: {
      requestsBySource: { 'tracked-list': 0, 'league-validation': 0 },
      notReachedCount: 0,
      trackedListEditedAt: { source: 'git-author-date', at: '2026-09-25T09:00:00.000Z' },
    },
    records: [],
  },
  weights: {
    schemaVersion: '6.0.0',
    gamePatch: '0.5.5',
    producer: { id: 'poe-mod-weights-producer', version: '6.0.0', generatedAt: '2026-09-26T10:52:22.504Z' },
    bases: {},
  },
  recipes: { schemaVersion: '1.0.0', recipes: [] },
  tracked: { schemaVersion: '1.0.0', entries: [] },
  config: { schemaVersion: '1.0.0', league: TEST_LEAGUE, minChunkSearches: 1 },
  catalogueStats: { schemaVersion: '1.0.0', result: [] },
};

/** How one artifact answers. Anything not overridden answers 200 with its valid body. */
export type ArtifactAnswer =
  | { readonly kind: 'json'; readonly body: unknown }
  | { readonly kind: 'text'; readonly body: string; readonly contentType?: string }
  | { readonly kind: 'status'; readonly status: number }
  | { readonly kind: 'network-error' }
  | { readonly kind: 'gated'; readonly gate: Promise<void>; readonly then?: ArtifactAnswer };

export interface RecordedRequest {
  readonly url: URL;
  readonly cache: RequestCache;
}

function respond(answer: ArtifactAnswer): Response | Promise<Response> {
  switch (answer.kind) {
    case 'json':
      return new HttpResponse(JSON.stringify(answer.body), {
        headers: { 'Content-Type': 'application/json' },
      });
    case 'text':
      return new HttpResponse(answer.body, {
        headers: { 'Content-Type': answer.contentType ?? 'text/html' },
      });
    case 'status':
      return new HttpResponse(null, { status: answer.status });
    case 'network-error':
      return HttpResponse.error();
    case 'gated':
      return answer.gate.then(() => respond(answer.then ?? { kind: 'json', body: null }));
  }
}

/**
 * Registers a handler for every artifact, and a trap for `NEVER_FETCHED_PATH`,
 * and returns the log of requests they received. `answers` overrides
 * individual artifacts.
 */
export function serveArtifacts(
  server: SetupServerApi,
  answers: Partial<Record<ArtifactKey, ArtifactAnswer>> = {},
): RecordedRequest[] {
  const requests: RecordedRequest[] = [];
  server.use(
    ...ARTIFACT_ORDER.map((key) =>
      http.get(artifactUrl('/', ARTIFACTS[key].path), ({ request }) => {
        requests.push({ url: new URL(request.url), cache: request.cache });
        const answer = answers[key] ?? { kind: 'json', body: VALID_BODIES[key] };
        const resolved =
          answer.kind === 'gated' && answer.then === undefined
            ? { ...answer, then: { kind: 'json', body: VALID_BODIES[key] } as const }
            : answer;
        return respond(resolved);
      }),
    ),
    http.get(artifactUrl('/', NEVER_FETCHED_PATH), ({ request }) => {
      requests.push({ url: new URL(request.url), cache: request.cache });
      return respond({ kind: 'json', body: { schemaVersion: '1.0.0', result: [] } });
    }),
  );
  return requests;
}

/** A promise and the function that settles it. */
export function gate(): { readonly promise: Promise<void>; readonly open: () => void } {
  let open: () => void = () => undefined;
  const promise = new Promise<void>((resolve) => {
    open = resolve;
  });
  return { promise, open };
}
