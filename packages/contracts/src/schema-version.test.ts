import { describe, expect, it } from 'vitest';

import {
  checkSchemaVersion,
  INITIAL_SCHEMA_VERSION,
  majorOf,
  SchemaVersionSchema,
  TRACKED_SCHEMA_VERSION,
  trackedEarlierMajorMessage,
} from './schema-version';

describe('SchemaVersionSchema', () => {
  it('accepts a three-part semver and starts every envelope at 1.0.0', () => {
    expect(SchemaVersionSchema.safeParse('1.0.0').success).toBe(true);
    expect(SchemaVersionSchema.safeParse('1.4.0').success).toBe(true);
    expect(INITIAL_SCHEMA_VERSION).toBe('1.0.0');
  });

  it('refuses a version that is not a three-part semver', () => {
    expect(SchemaVersionSchema.safeParse('1').success).toBe(false);
    expect(SchemaVersionSchema.safeParse('1.0').success).toBe(false);
    expect(SchemaVersionSchema.safeParse('v1.0.0').success).toBe(false);
    expect(SchemaVersionSchema.safeParse('01.0.0').success).toBe(false);
  });
});

describe('majorOf', () => {
  it('reads the major, and answers undefined for a non-semver', () => {
    expect(majorOf('2.0.0')).toBe(2);
    expect(majorOf('10.3.1')).toBe(10);
    expect(majorOf('not-a-version')).toBeUndefined();
  });
});

describe('checkSchemaVersion', () => {
  // I/O matrix: "Unknown major".
  it('refuses an unknown major with a typed result naming both versions', () => {
    const result = checkSchemaVersion('2.0.0', '1.0.0');
    expect(result).toEqual({
      ok: false,
      reason: 'unknown-major',
      expected: '1.0.0',
      found: '2.0.0',
    });
  });

  // I/O matrix: "Known major, newer minor".
  it('accepts a newer minor under a known major', () => {
    const result = checkSchemaVersion('1.4.0', '1.0.0');
    expect(result.ok).toBe(true);
    expect(result.expected).toBe('1.0.0');
    expect(result.found).toBe('1.4.0');
  });

  it('accepts an older minor under a known major', () => {
    expect(checkSchemaVersion('1.0.0', '1.4.0').ok).toBe(true);
  });

  it('reports a malformed version apart from an unknown major', () => {
    const result = checkSchemaVersion('one.oh', '1.0.0');
    expect(result).toEqual({
      ok: false,
      reason: 'malformed',
      expected: '1.0.0',
      found: 'one.oh',
    });
  });
});

describe('trackedEarlierMajorMessage', () => {
  it('explains an earlier tracked major: the major changed, both affixes, hybrid, re-author', () => {
    const message = trackedEarlierMajorMessage('1.0.0');
    expect(message).toBeDefined();
    expect(message).toContain('1.0.0');
    expect(message).toContain(TRACKED_SCHEMA_VERSION);
    expect(message).toContain('major version changed');
    expect(message).toContain('both a prefix and a suffix');
    expect(message).toContain('"hybrid"');
    expect(message).toContain('Re-author');
  });

  it('leaves the current, a later and a malformed major to the generic refusal', () => {
    expect(trackedEarlierMajorMessage(TRACKED_SCHEMA_VERSION)).toBeUndefined();
    expect(trackedEarlierMajorMessage('4.0.0')).toBeUndefined();
    expect(trackedEarlierMajorMessage('abc')).toBeUndefined();
  });

  it('explains a 2.x file: the raw class requirement, not the 1 → 2 change', () => {
    const message = trackedEarlierMajorMessage('2.0.0') ?? '';
    expect(message).toContain('refused (unknown-major');
    expect(message).toContain('raw entries require a categoryId and a className');
    expect(message).toContain('Re-author');
    expect(message).not.toContain('both a prefix and a suffix');
  });

  it('names the raw class requirement for a 1.x file too', () => {
    expect(trackedEarlierMajorMessage('1.0.0')).toContain('raw entries require a categoryId and a className');
  });

  it('explains only the 1.x and 2.x majors, not another earlier major', () => {
    expect(trackedEarlierMajorMessage('0.9.0')).toBeUndefined();
  });

  it('opens with the generic refusal lead-in and names no file', () => {
    const message = trackedEarlierMajorMessage('1.2.0') ?? '';
    expect(message.startsWith(`schemaVersion 1.2.0 refused (unknown-major; this build reads ${TRACKED_SCHEMA_VERSION}): `)).toBe(
      true,
    );
    expect(message).not.toContain('tracked.json');
  });

  it('versions tracked.json apart from every other file', () => {
    expect(TRACKED_SCHEMA_VERSION).toBe('3.0.0');
    expect(INITIAL_SCHEMA_VERSION).toBe('1.0.0');
  });
});
