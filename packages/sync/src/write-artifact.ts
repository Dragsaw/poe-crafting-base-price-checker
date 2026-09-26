/**
 * The one write path for every artifact `sync` writes (AD-3, Consistency
 * Conventions): `data/dataset.json` and `data/sync-progress.json` today, the
 * Sync Report next.
 *
 * The value is parsed with its schema first, and the **parsed** value is what
 * gets serialised. The keys therefore follow the schema's declared order, not
 * the order a caller happened to build its object in, and the bytes are
 * `serialiseJsonArtifact`'s: UTF-8 without BOM, LF, two-space JSON and one
 * trailing newline. An artifact that fails its schema is refused with a typed
 * `InvalidArtifactError` and nothing is written.
 *
 * Fixtures and the catalogue are not artifacts of the chunk and keep their own
 * callers of `serialiseJsonArtifact`.
 */

import type { EnvelopeIssues, FilesystemPort } from '@poe/contracts';

import { serialiseJsonArtifact } from './shell.ts';

/** The part of a schema this module needs: a Zod schema satisfies it. */
export interface ArtifactSchema<T> {
  safeParse(
    value: unknown,
  ):
    | { readonly success: true; readonly data: T }
    | { readonly success: false; readonly error: { readonly issues: EnvelopeIssues } };
}

export class InvalidArtifactError extends Error {
  readonly path: string;
  readonly issues: EnvelopeIssues;

  constructor(path: string, issues: EnvelopeIssues) {
    super(
      `${path}: refusing to write an invalid artifact: ${issues
        .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
        .join('; ')}`,
    );
    this.name = 'InvalidArtifactError';
    this.path = path;
    this.issues = issues;
  }
}

/** Validates `value` against `schema`, then writes the parsed value to `path`. */
export async function writeArtifact<T>(
  fs: FilesystemPort,
  path: string,
  schema: ArtifactSchema<T>,
  value: T,
): Promise<void> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new InvalidArtifactError(path, parsed.error.issues);
  }
  await fs.writeTextFile(path, serialiseJsonArtifact(parsed.data));
}
