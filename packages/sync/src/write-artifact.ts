// The one write path for every artifact `sync` writes (AD-3). The parsed value is serialised, so
// keys follow the schema's order. An invalid artifact is refused and nothing is written.

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
