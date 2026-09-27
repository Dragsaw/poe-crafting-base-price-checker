import { parseEnvelope } from '@poe/contracts';

import {
  ARTIFACT_ORDER,
  ARTIFACTS,
  type ArtifactKey,
  type ArtifactSet,
  type TolerableKey,
} from './artifacts';

/**
 * One load of the eight artifacts, resolved to exactly one outcome (AD-24,
 * FR-33). Each artifact is one plain `fetch` with `cache: 'no-store'` and no
 * query token (decision 2026-09-26): the Pages CDN's `max-age=600` staleness is
 * accepted. The loader never rejects — every failure is a typed outcome.
 */

/** What a refusal prints for a file whose `schemaVersion` is missing or not a string. */
export const NO_DECLARED_VERSION = 'none';

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
      /** The declared `schemaVersion`, or `NO_DECLARED_VERSION`. */
      readonly declared: string;
      readonly expected: string;
    }
  | { readonly kind: 'failed'; readonly path: string };

/** One artifact's result, before precedence across the eight is applied. */
type Fetched =
  | { readonly kind: 'valid'; readonly value: unknown }
  | { readonly kind: 'absent' }
  | { readonly kind: 'not-arrived' }
  | { readonly kind: 'invalid'; readonly cause: 'version' | 'content'; readonly declared: string };

export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export interface LoadOptions {
  readonly fetch?: FetchLike;
  /** The site base. Vite's `import.meta.env.BASE_URL` unless a test overrides it. */
  readonly baseUrl?: string;
  /** Aborts every in-flight fetch of a superseded load. */
  readonly signal?: AbortSignal;
}

function declaredVersion(data: unknown): string {
  if (typeof data === 'object' && data !== null && 'schemaVersion' in data) {
    const version = (data as { schemaVersion: unknown }).schemaVersion;
    if (typeof version === 'string') {
      return version;
    }
  }
  return NO_DECLARED_VERSION;
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
  const init: RequestInit = signal === undefined ? { cache: 'no-store' } : { cache: 'no-store', signal };
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
    return { kind: 'invalid', cause: 'content', declared: NO_DECLARED_VERSION };
  }

  const result = parseEnvelope(descriptor.schema, data, descriptor.expected);
  if (result.ok) {
    return { kind: 'valid', value: result.value };
  }
  const declared = declaredVersion(data);
  if (result.reason !== 'invalid') {
    // An unknown major or a malformed version string.
    return { kind: 'invalid', cause: 'version', declared };
  }
  // `invalid` covers both a failed version probe (no string version declared)
  // and a failed shape parse at the expected major.
  return { kind: 'invalid', cause: declared === NO_DECLARED_VERSION ? 'version' : 'content', declared };
}

/**
 * Precedence across the eight: any artifact that did not arrive gives the
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
        declared: NO_DECLARED_VERSION,
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
