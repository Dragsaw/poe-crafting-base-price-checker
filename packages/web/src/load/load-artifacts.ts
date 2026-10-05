import { parseEnvelope } from '@poe/contracts';

import {
  ARTIFACT_ORDER,
  ARTIFACTS,
  type ArtifactKey,
  type ArtifactSet,
  type TolerableKey,
} from './artifacts';

/** One load resolves to one outcome and never rejects; each fetch is `cache: 'no-cache'` with no query token, so CDN staleness and a mixed-commit set are accepted costs (AD-24, FR-33). */

/** `version`: unknown major or malformed or non-string `schemaVersion`; `content`: not JSON, or fails the schema at the expected major; `missing`: a required 404. */
export type RefusalCause = 'version' | 'content' | 'missing';

export type LoadOutcome =
  | {
      readonly kind: 'ready';
      readonly set: ArtifactSet;
      /** The tolerable artifacts that were absent, in AD-24 order. */
      readonly absent: readonly TolerableKey[];
    }
  | {
      readonly kind: 'refused';
      readonly path: string;
      readonly cause: RefusalCause;
      /** The declared `schemaVersion`, or `undefined` for a non-string one: not a sentinel, since a file may declare any string. */
      readonly declared: string | undefined;
      readonly expected: string;
    }
  | { readonly kind: 'failed'; readonly path: string };

/** One artifact's result, before precedence across the seven is applied. */
type Fetched =
  | { readonly kind: 'valid'; readonly value: unknown }
  | { readonly kind: 'absent' }
  | { readonly kind: 'not-arrived' }
  | { readonly kind: 'invalid'; readonly cause: 'version' | 'content'; readonly declared: string | undefined };

type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export interface LoadOptions {
  readonly fetch?: FetchLike;
  /** The site base. Vite's `import.meta.env.BASE_URL` unless a test overrides it. */
  readonly baseUrl?: string;
  /** Aborts every in-flight fetch of a superseded load. */
  readonly signal?: AbortSignal;
}

/** The file's `schemaVersion` string, or `undefined` where it is missing or not a string. */
function declaredVersion(data: unknown): string | undefined {
  if (typeof data === 'object' && data !== null && 'schemaVersion' in data) {
    const version = data.schemaVersion;
    if (typeof version === 'string') {
      return version;
    }
  }
  return undefined;
}

/** `BASE_URL + path`, resolved against the document so Node's fetch accepts it in tests too. */
export function artifactUrl(baseUrl: string, path: string): string {
  return new URL(baseUrl + path, document.baseURI).href;
}

/** The response body, or the terminal `Fetched` where the artifact is absent or did not arrive. */
async function readBody(baseUrl: string, path: string, fetchImpl: FetchLike, init: RequestInit): Promise<string | Fetched> {
  try {
    const response = await fetchImpl(artifactUrl(baseUrl, path), init);
    // 404 is absent. Any other non-OK status did not arrive.
    if (response.status === 404) {
      return { kind: 'absent' };
    }
    return response.ok ? await response.text() : { kind: 'not-arrived' };
  } catch {
    return { kind: 'not-arrived' };
  }
}

function parseBody(descriptor: (typeof ARTIFACTS)[ArtifactKey], body: string): Fetched {
  let data: unknown;
  try {
    data = JSON.parse(body);
  } catch {
    // Not JSON at all: nothing declared, and the fault is the content.
    return { kind: 'invalid', cause: 'content', declared: undefined };
  }
  const result = parseEnvelope(descriptor.schema, data, descriptor.expected);
  return result.ok ? { kind: 'valid', value: result.value } : refusedFetch(result, declaredVersion(data));
}

function refusedFetch(result: Extract<ReturnType<typeof parseEnvelope>, { readonly ok: false }>, declared: string | undefined): Fetched {
  // Exhaustive by construction: a new `parseEnvelope` reason fails the
  // `never` default at compile time rather than becoming a silent `version`.
  switch (result.reason) {
    case 'unknown-major':
    case 'malformed-version': {
      return { kind: 'invalid', cause: 'version', declared };
    }
    case 'invalid': {
      // Covers both a failed version probe (no string version declared) and a
      // failed shape parse at the expected major. A non-object body or a
      // non-string version reads as `version` on purpose (item 22 review).
      return { kind: 'invalid', cause: declared === undefined ? 'version' : 'content', declared };
    }
    default: {
      return result satisfies never;
    }
  }
}

async function fetchOne(
  key: ArtifactKey,
  fetchImpl: FetchLike,
  baseUrl: string,
  signal: AbortSignal | undefined,
): Promise<Fetched> {
  const descriptor = ARTIFACTS[key];
  const init: RequestInit = signal === undefined ? { cache: 'no-cache' } : { cache: 'no-cache', signal };
  const body = await readBody(baseUrl, descriptor.path, fetchImpl, init);
  return typeof body === 'string' ? parseBody(descriptor, body) : body;
}

/** Any not-arrived gives the failure screen, then any invalid or required-absent the refusal screen; each names the first failing artifact in AD-24 order. */
function classify(results: Readonly<Record<ArtifactKey, Fetched>>): LoadOutcome {
  for (const key of ARTIFACT_ORDER) {
    if (results[key].kind === 'not-arrived') {
      return { kind: 'failed', path: ARTIFACTS[key].path };
    }
  }

  for (const key of ARTIFACT_ORDER) {
    const result = results[key];
    const descriptor = ARTIFACTS[key];
    if (result.kind === 'invalid') {
      return {
        kind: 'refused',
        path: descriptor.path,
        cause: result.cause,
        declared: result.declared,
        expected: descriptor.expected,
      };
    }
    if (result.kind === 'absent' && descriptor.class === 'required') {
      return {
        kind: 'refused',
        path: descriptor.path,
        cause: 'missing',
        declared: undefined,
        expected: descriptor.expected,
      };
    }
  }

  const set: Record<string, unknown> = {};
  const absent: TolerableKey[] = [];
  for (const key of ARTIFACT_ORDER) {
    const result = results[key];
    if (result.kind === 'valid') {
      set[key] = result.value;
    } else {
      // Only a tolerable artifact can reach here absent: the loop above refused the rest.
      set[key] = undefined;
      absent.push(key as TolerableKey);
    }
  }
  return { kind: 'ready', set: set as ArtifactSet, absent };
}

export async function loadArtifacts(options: LoadOptions = {}): Promise<LoadOutcome> {
  const fetchImpl = options.fetch ?? ((input, init) => fetch(input, init));
  const baseUrl = options.baseUrl ?? import.meta.env.BASE_URL;
  const settled = await Promise.all(ARTIFACT_ORDER.map((key) => fetchOne(key, fetchImpl, baseUrl, options.signal)));
  const results = Object.fromEntries(
    ARTIFACT_ORDER.map((key, index) => [key, settled[index]]),
  ) as Record<ArtifactKey, Fetched>;
  return classify(results);
}
