import { describe, expect, it } from 'vitest';

import { parseEnvelope, SyncProgressFileSchema } from './envelopes';
import { INITIAL_SCHEMA_VERSION } from './schema-version';
import { SyncLockSchema, SyncProgressSchema } from './sync-progress';

describe('SyncLockSchema', () => {
  it('accepts exactly a pid and an ISO-8601 UTC start time', () => {
    const lock = { pid: 4242, startedAt: '2026-09-26T10:00:00.000Z' };
    expect(SyncLockSchema.parse(lock)).toEqual(lock);
  });

  it('refuses a third field, so no reader reasons about a run it cannot see', () => {
    expect(
      SyncLockSchema.safeParse({ pid: 1, startedAt: '2026-09-26T10:00:00Z', host: 'x' }).success,
    ).toBe(false);
  });

  it('refuses an offset timestamp and a fractional pid', () => {
    expect(SyncLockSchema.safeParse({ pid: 1, startedAt: '2026-09-26T10:00:00+02:00' }).success).toBe(
      false,
    );
    expect(SyncLockSchema.safeParse({ pid: 1.5, startedAt: '2026-09-26T10:00:00Z' }).success).toBe(
      false,
    );
  });
});

describe('SyncProgressFileSchema', () => {
  it('carries schemaVersion and the completed keys', () => {
    const file = { schemaVersion: INITIAL_SCHEMA_VERSION, completed: ['["raw","A",82]'] };
    expect(parseEnvelope(SyncProgressFileSchema, file)).toEqual({ ok: true, value: file });
  });

  it('refuses an unknown major rather than parsing on', () => {
    const result = parseEnvelope(SyncProgressFileSchema, { schemaVersion: '2.0.0', completed: [] });
    expect(result).toMatchObject({ ok: false, reason: 'unknown-major' });
  });

  it('refuses a duplicated key and an empty key', () => {
    expect(SyncProgressSchema.safeParse({ completed: ['a', 'a'] }).success).toBe(false);
    expect(SyncProgressSchema.safeParse({ completed: [''] }).success).toBe(false);
  });
});
