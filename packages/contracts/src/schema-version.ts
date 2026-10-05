import { z } from 'zod';

/** Every envelope carries `schemaVersion`; a consumer compares the major only (NFR-8). */

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

/** A refusal names both versions, so the reader knows which side moved. */
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
  return match === null ? undefined : Number(match[1]);
}

/** A refusal is a value, never a throw (Consistency Conventions, *Error shape*). */
export function checkSchemaVersion(found: string, expected: string): SchemaVersionCheck {
  const foundMajor = majorOf(found);
  const expectedMajor = majorOf(expected);
  if (foundMajor === undefined || expectedMajor === undefined) {
    return { ok: false, reason: 'malformed', expected, found };
  }
  return foundMajor === expectedMajor ? { ok: true, expected, found } : { ok: false, reason: 'unknown-major', expected, found };
}

/** Versioned apart from `SUPPORTED_SCHEMA_VERSION` (IMPLEMENTATION-NOTES §4.1, §12.1). */
export const TRACKED_SCHEMA_VERSION = '2.0.0';

/** The curator must re-author a 1.x file, not retry (IMPLEMENTATION-NOTES §4.1). */
export function trackedEarlierMajorMessage(found: string): string | undefined {
  // The explanation names the 1 → 2 change, so it fits a 1.x file only.
  return majorOf(found) === 1 ? (
    `schemaVersion ${found} refused (unknown-major; this build reads ${TRACKED_SCHEMA_VERSION}): ` +
    `the tracked schema's major version changed to ${TRACKED_SCHEMA_VERSION}: crafted entries now require ` +
    'both a prefix and a suffix, and an affix accepts the "hybrid" kind. Re-author the file against ' +
    `schemaVersion ${TRACKED_SCHEMA_VERSION}; retrying will not help.`
  ) : undefined;
}
