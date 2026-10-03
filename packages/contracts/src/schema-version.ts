import { z } from 'zod';

/**
 * Schema versioning at every trust boundary (NFR-8, Consistency Conventions,
 * *Schema versioning*). Every file envelope carries `schemaVersion`; a consumer
 * compares the **major only** and refuses an unknown one rather than guessing.
 *
 * One mechanism, spelled once. Entity schemas that are members of a versioned
 * file do not repeat the field — the envelope carries it for them.
 */

const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

export const SchemaVersionSchema = z
  .string()
  .regex(SEMVER, 'schemaVersion must be a three-part semver string, e.g. "1.0.0"')
  .describe('The file contract version. A consumer refuses an unknown major (NFR-8).');

export type SchemaVersion = z.infer<typeof SchemaVersionSchema>;

/** Every envelope in this package starts here. */
export const INITIAL_SCHEMA_VERSION = '1.0.0';

/** The major a consumer built against this revision of `contracts` knows. */
export const SUPPORTED_SCHEMA_VERSION = INITIAL_SCHEMA_VERSION;

/** The version was accepted: the majors agree. The minor may be newer. */
export interface SchemaVersionAccepted {
  readonly ok: true;
  readonly expected: string;
  readonly found: string;
}

/**
 * The version was refused, and the refusal **names both versions** — the one
 * the consumer knows and the one the file declared. A refusal that names only
 * one leaves the reader guessing which side moved.
 */
export interface SchemaVersionRefused {
  readonly ok: false;
  readonly reason: 'unknown-major' | 'malformed';
  readonly expected: string;
  readonly found: string;
}

export type SchemaVersionCheck = SchemaVersionAccepted | SchemaVersionRefused;

/** The major component, or `undefined` where the string is not a semver. */
export function majorOf(version: string): number | undefined {
  const match = SEMVER.exec(version);
  if (match === null) {
    return undefined;
  }
  return Number(match[1]);
}

/**
 * The one compatibility rule. `core` returns a typed result and never throws
 * for an expected condition (Consistency Conventions, *Error shape*), so a
 * refusal is a value a caller must handle rather than an exception it may
 * ignore.
 */
export function checkSchemaVersion(found: string, expected: string): SchemaVersionCheck {
  const foundMajor = majorOf(found);
  const expectedMajor = majorOf(expected);
  if (foundMajor === undefined || expectedMajor === undefined) {
    return { ok: false, reason: 'malformed', expected, found };
  }
  if (foundMajor !== expectedMajor) {
    return { ok: false, reason: 'unknown-major', expected, found };
  }
  return { ok: true, expected, found };
}

/**
 * `tracked.json` carries its own contract version, apart from
 * `SUPPORTED_SCHEMA_VERSION`, so that its major bump leaves every other
 * artifact's version untouched (IMPLEMENTATION-NOTES §4.1, §12.1). The pattern
 * is `WEIGHTS_SCHEMA_VERSION`'s.
 */
export const TRACKED_SCHEMA_VERSION = '2.0.0';

/**
 * The refusal for a tracked file at the 1.x major (IMPLEMENTATION-NOTES
 * §4.1), or `undefined` for any other major. A generic
 * unknown-major message is not enough here: the curator must re-author the
 * file, not retry. One spelling for sync and `tracked:check`.
 */
export function trackedEarlierMajorMessage(found: string): string | undefined {
  // The explanation names the 1 → 2 change, so it fits a 1.x file only.
  if (majorOf(found) !== 1) {
    return undefined;
  }
  return (
    `schemaVersion ${found} refused (unknown-major; this build reads ${TRACKED_SCHEMA_VERSION}): ` +
    `the tracked schema's major version changed to ${TRACKED_SCHEMA_VERSION}: crafted entries now require ` +
    'both a prefix and a suffix, and an affix accepts the "hybrid" kind. Re-author the file against ' +
    `schemaVersion ${TRACKED_SCHEMA_VERSION}; retrying will not help.`
  );
}
