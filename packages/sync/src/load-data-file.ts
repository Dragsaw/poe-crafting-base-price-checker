/**
 * One load path for the player-owned and catalogue files `sync` reads but
 * never writes (`data/config.json`, `data/currencies.json`,
 * `data/catalogue/items.json`). Every refusal is a typed `DataFileError` that
 * names the file, and it is raised before any request is issued.
 */

import type { EnvelopeResult, FilesystemPort } from '@poe/contracts';

export type DataFileRefusal =
  | 'absent'
  | 'not-json'
  | 'unknown-major'
  | 'malformed-version'
  | 'invalid';

export class DataFileError extends Error {
  readonly path: string;
  readonly reason: DataFileRefusal;

  constructor(path: string, reason: DataFileRefusal, detail: string) {
    super(`${path}: ${detail}`);
    this.name = 'DataFileError';
    this.path = path;
    this.reason = reason;
  }
}

export type DataFileResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: DataFileError };

/**
 * Reads and validates one versioned file through `parse` (normally
 * `parseEnvelope` over the file's schema). An absent file is a refusal.
 */
export async function loadDataFile<T>(
  fs: FilesystemPort,
  path: string,
  parse: (data: unknown) => EnvelopeResult<T>,
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
    case 'malformed-version':
      return {
        ok: false,
        error: new DataFileError(
          path,
          result.reason,
          `schemaVersion ${result.found} refused (${result.reason}; this build reads ${result.expected})`,
        ),
      };
    case 'invalid':
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
