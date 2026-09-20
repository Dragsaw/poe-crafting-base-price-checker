import { describe, expect, it } from 'vitest';

import {
  checkSchemaVersion,
  INITIAL_SCHEMA_VERSION,
  majorOf,
  SchemaVersionSchema,
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
