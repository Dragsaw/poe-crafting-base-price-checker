// Test scaffolding for the seven AD-24 artifacts, never imported by the app. Loopback URLs pass the
// shared MSW guard unhandled, so every fetch test registers all seven handlers and a trap for a
// path the page never fetches: a missing handler would otherwise reach a real socket.

import { http, HttpResponse } from 'msw';
import type { SetupServer } from 'msw/node';

import { ARTIFACT_ORDER, ARTIFACTS, type ArtifactKey } from '../load/artifacts';
import { artifactUrl } from '../load/load-artifacts';

// Root `test/setup.ts` is outside `rootDir`; the dynamic import reuses the instance Vitest loaded.
// `import.meta.dirname`, not `import.meta.url`: under jsdom the url is not `file:`.
const SHARED_SETUP = `${(import.meta as ImportMeta & { readonly dirname: string }).dirname}/../../../../test/setup.ts`;

export async function sharedServer(): Promise<SetupServer> {
  const setup = (await import(/* @vite-ignore */ SHARED_SETUP)) as { server: SetupServer };
  return setup.server;
}

export const TEST_LEAGUE = 'Forbidden Rites';

/** A published file `web` never fetches (AD-24), served as a trap so a request fails the test. */
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
  tracked: { schemaVersion: '3.0.0', entries: [] },
  config: { schemaVersion: '1.0.0', league: TEST_LEAGUE, minChunkSearches: 1 },
  catalogueStats: { schemaVersion: '1.0.0', result: [] },
};

/** How one artifact answers. Anything not overridden answers 200 with its valid body. */
export type ArtifactAnswer =
  | { readonly kind: 'json'; readonly body: unknown }
  | { readonly kind: 'text'; readonly body: string; readonly contentType?: string }
  | { readonly kind: 'status'; readonly status: number }
  | { readonly kind: 'network-error' }
  | { readonly kind: 'gated'; readonly gate: Promise<void>; readonly afterGate?: ArtifactAnswer };

export interface RecordedRequest {
  readonly url: URL;
  readonly cache: RequestCache;
}

async function respondWhenOpen(answer: Extract<ArtifactAnswer, { kind: 'gated' }>): Promise<Response> {
  await answer.gate;
  return respond(answer.afterGate ?? { kind: 'text', body: 'null', contentType: 'application/json' });
}

function respond(answer: ArtifactAnswer): Response | Promise<Response> {
  switch (answer.kind) {
    case 'json': {
      return new HttpResponse(JSON.stringify(answer.body), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    case 'text': {
      return new HttpResponse(answer.body, {
        headers: { 'Content-Type': answer.contentType ?? 'text/html' },
      });
    }
    case 'status': {
      return new HttpResponse(undefined, { status: answer.status });
    }
    case 'network-error': {
      return HttpResponse.error();
    }
    case 'gated': {
      return respondWhenOpen(answer);
    }
  }
}

/** Registers a handler per artifact and a trap for `NEVER_FETCHED_PATH`; returns the log. */
export function serveArtifacts(
  server: SetupServer,
  answers: Partial<Record<ArtifactKey, ArtifactAnswer>> = {},
): RecordedRequest[] {
  const requests: RecordedRequest[] = [];
  server.use(
    ...ARTIFACT_ORDER.map((key) =>
      http.get(artifactUrl('/', ARTIFACTS[key].path), ({ request }) => {
        requests.push({ url: new URL(request.url), cache: request.cache });
        const answer = answers[key] ?? { kind: 'json', body: VALID_BODIES[key] };
        const resolved =
          answer.kind === 'gated' && answer.afterGate === undefined
            ? { ...answer, afterGate: { kind: 'json', body: VALID_BODIES[key] } as const }
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
  const { promise, resolve: open } = Promise.withResolvers<void>();
  return { promise, open };
}

/** Every artifact answers only after its gate opens, one key at a time or all at once. */
export function gatedArtifacts(): {
  readonly answers: Partial<Record<ArtifactKey, ArtifactAnswer>>;
  readonly open: (key: ArtifactKey) => void;
  readonly openAll: () => void;
} {
  const held = ARTIFACT_ORDER.map((key) => ({ key, ...gate() }));
  const opens = new Map(held.map(({ key, open }) => [key, open]));
  return {
    answers: Object.fromEntries(held.map(({ key, promise }) => [key, { kind: 'gated', gate: promise } satisfies ArtifactAnswer])),
    open: (key) => {
      opens.get(key)?.();
    },
    openAll: () => {
      for (const open of opens.values()) {
        open();
      }
    },
  };
}
