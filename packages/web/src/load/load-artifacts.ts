import { parseEnvelope } from '@poe/contracts';

import {
  ARTIFACT_ORDER,
  ARTIFACTS,
  type ArtifactKey,
  type ArtifactSet,
  type TolerableKey,
} from './artifacts';

/**
 * One load of the seven artifacts, resolved to exactly one outcome (AD-24,
 * FR-33). Each artifact is one plain `fetch` with `cache: 'no-cache'` and no
 * query token: the browser revalidates every load and reuses its copy only on
 * a `304`, so each load is as fresh as a full download. The Pages CDN's
 * `max-age=600` staleness, and a rare set that mixes files across a data
 * commit, are accepted costs (AD-24). The loader never rejects — every failure
 * is a typed outcome.
 */

/**
 * Why a file was refused, so the refusal screen blames the right thing:
 * - `version`: the file declares an unknown major, a malformed version, or no
 *   string `schemaVersion` at all.
 * - `content`: the body is not JSON, or it declares the expected major but its
 *   shape fails the schema.
 * - `missing`: a required file returned 404.
 */
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
      /**
       * The declared `schemaVersion`, or `null` where the file declares no
       * string one. A null, not a sentinel string: a file may declare any string.
       */
      readonly declared: string | null;
      readonly expected: string;
    }
  | { readonly kind: 'failed'; readonly path: string };

/** One artifact's result, before precedence across the seven is applied. */
type Fetched =
  | { readonly kind: 'valid'; readonly value: unknown }
  | { readonly kind: 'absent' }
  | { readonly kind: 'not-arrived' }
  | { readonly kind: 'invalid'; readonly cause: 'version' | 'content'; readonly declared: string | null };

export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export interface LoadOptions {
  readonly fetch?: FetchLike;
  /** The site base. Vite's `import.meta.env.BASE_URL` unless a test overrides it. */
  readonly baseUrl?: string;
  /** Aborts every in-flight fetch of a superseded load. */
  readonly signal?: AbortSignal;
}

/** The file's `schemaVersion` string, or `null` where it is missing or not a string. */
function declaredVersion(data: unknown): string | null {
  if (typeof data === 'object' && data !== null && 'schemaVersion' in data) {
    const version = data.schemaVersion;
    if (typeof version === 'string') {
      return version;
    }
  }
  return null;
}

/** `BASE_URL + path`, resolved against the document so Node's fetch accepts it in tests too. */
export function artifactUrl(baseUrl: string, path: string): string {
  return new URL(baseUrl + path, document.baseURI).href;
}

async function fetchOne(
  key: ArtifactKey,
  fetchImpl: FetchLike,
  baseUrl: string,
  signal: AbortSignal | undefined,
): Promise<Fetched> {
  const descriptor = ARTIFACTS[key];
  const init: RequestInit = signal === undefined ? { cache: 'no-cache' } : { cache: 'no-cache', signal };
  let body: string;
  try {
    const response = await fetchImpl(artifactUrl(baseUrl, descriptor.path), init);
    // 404 is absent. Any other non-OK status did not arrive.
    if (response.status === 404) {
      return { kind: 'absent' };
    }
    if (!response.ok) {
      return { kind: 'not-arrived' };
    }
    body = await response.text();
  } catch {
    return { kind: 'not-arrived' };
  }

  let data: unknown;
  try {
    data = JSON.parse(body);
  } catch {
    // Not JSON at all: nothing declared, and the fault is the content.
    return { kind: 'invalid', cause: 'content', declared: null };
  }

  const result = parseEnvelope(descriptor.schema, data, descriptor.expected);
  if (result.ok) {
    return { kind: 'valid', value: result.value };
  }
  const declared = declaredVersion(data);
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
      return { kind: 'invalid', cause: declared === null ? 'version' : 'content', declared };
    }
    default: {
      return result satisfies never;
    }
  }
}

/**
 * Precedence across the seven: any artifact that did not arrive gives the
 * fetch-failure screen; otherwise any invalid (or required-and-absent)
 * artifact gives the refusal screen; otherwise the set is ready. Each screen
 * names the first failing artifact in AD-24 order. A refusal carries its
 * cause: the invalid file's own cause, or `missing` for a required 404.
 */
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
        declared: null,
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
      set[key] = null;
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
