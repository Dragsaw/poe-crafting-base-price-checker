// One load path for the files `sync` reads but never writes; a refusal is a typed `DataFileError`
// naming the file, raised before any request. `runChunk` raises it too, so the `pnpm sync` session
// can tell a refusal only an edit clears from a transient fault (`../sync.ts`).

import { parseEnvelope, TRACKED_SCHEMA_VERSION, TrackedFileSchema, trackedEarlierMajorMessage } from '@poe/contracts';
import type { EnvelopeResult, EnvelopeVersionRefused, FilesystemPort, TrackedFile } from '@poe/contracts';

export type DataFileRefusal =
  | 'absent'
  | 'not-json'
  | 'unknown-major'
  | 'malformed-version'
  | 'invalid';

export class DataFileError extends Error {
  readonly path: string;
  readonly reason: DataFileRefusal;

  constructor(path: string, reason: DataFileRefusal, detail: string, options?: ErrorOptions) {
    super(`${path}: ${detail}`, options);
    this.name = 'DataFileError';
    this.path = path;
    this.reason = reason;
  }
}

export type DataFileResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: DataFileError };

/** Explains a refusal the generic text cannot; `undefined` keeps it (IMPLEMENTATION-NOTES §4.1). */
export type VersionRefusalExplainer = (found: string) => string | undefined;

/** The detail of a version refusal: the explainer's text, or the generic sentence naming both versions. */
export function describeVersionRefusal(
  result: EnvelopeVersionRefused,
  explain?: VersionRefusalExplainer,
): string {
  return (
    explain?.(result.found) ??
    `schemaVersion ${result.found} refused (${result.reason}; this build reads ${result.expected})`
  );
}

/** Parses `tracked.json` against `TRACKED_SCHEMA_VERSION`; an earlier major gets §4.1's message. */
export function parseTrackedFile(data: unknown): EnvelopeResult<TrackedFile> {
  return parseEnvelope(TrackedFileSchema, data, TRACKED_SCHEMA_VERSION);
}

export const explainTrackedVersion: VersionRefusalExplainer = trackedEarlierMajorMessage;

/** Reads and validates one versioned file through `parse`; an absent file is a refusal. */
export async function loadDataFile<T>(
  fs: FilesystemPort,
  path: string,
  parse: (data: unknown) => EnvelopeResult<T>,
  explainVersion?: VersionRefusalExplainer,
): Promise<DataFileResult<T>> {
  const text = await fs.readTextFile(path);
  if (text === undefined) {
    return { ok: false, error: new DataFileError(path, 'absent', 'the file is absent') };
  }
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (error) {
    return { ok: false, error: new DataFileError(path, 'not-json', `not valid JSON: ${String(error)}`) };
  }
  const result = parse(data);
  if (result.ok) {
    return { ok: true, value: result.value };
  }
  switch (result.reason) {
    case 'unknown-major':
    case 'malformed-version': {
      return {
        ok: false,
        error: new DataFileError(path, result.reason, describeVersionRefusal(result, explainVersion)),
      };
    }
    case 'invalid': {
      return {
        ok: false,
        error: new DataFileError(
          path,
          'invalid',
          `invalid: ${result.issues
            .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
            .join('; ')}`,
        ),
      };
    }
  }
}
