import { readFileSync } from 'node:fs';
import nodePath from 'node:path';
import { SUPPORTED_SCHEMA_VERSION } from '@poe/contracts';
import type { HttpResponse } from '@poe/contracts';
import { expect, it } from 'vitest';

import { catalogueFilePathOf, serialiseCatalogue } from '../catalogue-refresh.ts';
import { CATALOGUE_ENDPOINTS } from '../trade/endpoints.ts';
import {
  byCodeUnit,
  CAPTURED,
  capturedResponses,
  harness,
  REPO_ROOT,
  respond,
  writtenValue,
} from './test-support.ts';

/** Room left in the bucket: nothing has to wait. */
const RATE_LIMIT_HEADERS = {
  'x-rate-limit-policy': 'trade-data-request-limit',
  'x-rate-limit-rules': 'Ip',
  'x-rate-limit-ip': '5:10:60',
  'x-rate-limit-ip-state': '1:10:0',
};

it('writes four artifacts, each the captured payload plus schemaVersion', async () => {
  const instance = harness(capturedResponses(RATE_LIMIT_HEADERS));

  const outcome = await instance.refresh();

  expect(outcome.ok).toBe(true);
  expect(instance.writes).toHaveLength(4);
  expect(outcome.written).toEqual(
    CATALOGUE_ENDPOINTS.map((endpoint) => catalogueFilePathOf(endpoint)),
  );

  for (const endpoint of CATALOGUE_ENDPOINTS) {
    const path = catalogueFilePathOf(endpoint);
    expect(path.endsWith(`${endpoint.artifact}.json`)).toBe(true);
    const write = instance.writes.find((candidate) => candidate.path === path);
    expect(write?.contents).toBe(
      serialiseCatalogue({
        ...(CAPTURED[endpoint.artifact] as Record<string, unknown>),
        schemaVersion: SUPPORTED_SCHEMA_VERSION,
      }),
    );
    // Two-space JSON with a trailing newline, so a second refresh against an
    // unchanged API diffs as nothing at all.
    expect(write?.contents.endsWith('\n')).toBe(true);
    expect(write?.contents.includes('\n  "')).toBe(true);
    expect(writtenValue(instance.writes, endpoint.artifact).schemaVersion).toBe(
      SUPPORTED_SCHEMA_VERSION,
    );
  }
});

it('writes the committed catalogue back byte for byte on a second refresh against an unchanged API', async () => {
  // Checked against the committed artifacts, not one serialisation compared with
  // itself. The envelope appends `schemaVersion` last, so key order is preserved.
  const committed: Record<string, string> = {};
  const fixtures: Record<string, HttpResponse> = {};
  for (const endpoint of CATALOGUE_ENDPOINTS) {
    const bytes = readFileSync(catalogueFilePathOf(endpoint), 'utf8');
    committed[endpoint.artifact] = bytes;
    const payload = JSON.parse(bytes) as Record<string, unknown>;
    expect(payload.schemaVersion, `${endpoint.artifact}.json carries no schemaVersion`).toBe(
      SUPPORTED_SCHEMA_VERSION,
    );
    delete payload.schemaVersion;
    fixtures[`GET ${endpoint.url}`] = respond(payload, RATE_LIMIT_HEADERS);
  }

  const rounds = ['first', 'second'] as const;
  await Promise.all(
    rounds.map(async (round) => {
      const instance = harness(fixtures);

      const outcome = await instance.refresh();

      expect(outcome, `${round} refresh failed`).toMatchObject({ ok: true });
      expect(instance.writes, `${round} refresh did not write four artifacts`).toHaveLength(4);
      for (const endpoint of CATALOGUE_ENDPOINTS) {
        const path = catalogueFilePathOf(endpoint);
        const write = instance.writes.find((candidate) => candidate.path === path);
        expect(write, `${round} refresh did not write ${endpoint.artifact}`).toBeDefined();
        expect(
          write?.contents === committed[endpoint.artifact],
          `${round} refresh wrote ${endpoint.artifact}.json with bytes that differ from the committed file`,
        ).toBe(true);
      }
    }),
  );
});

it('writes every artifact under the repository root, in data/catalogue', async () => {
  const instance = harness(capturedResponses(RATE_LIMIT_HEADERS));

  await instance.refresh();

  expect(instance.writes).toHaveLength(4);
  for (const { path } of instance.writes) {
    expect(nodePath.isAbsolute(path)).toBe(true);
    // Resolved against the repository root the test computes for itself, not
    // against `catalogueFilePathOf` — which is the thing under test. A root
    // one level too shallow would land these in `packages/data/catalogue/`.
    const within = nodePath.relative(REPO_ROOT, path);
    expect(within.startsWith('..')).toBe(false);
    expect(within.split(nodePath.sep)).not.toContain('packages');
    expect(within.split(nodePath.sep).slice(0, 2)).toEqual(['data', 'catalogue']);
  }
  expect(instance.writes.map(({ path }) => nodePath.relative(REPO_ROOT, path).split(nodePath.sep).join('/')).toSorted(byCodeUnit)).toEqual(
    CATALOGUE_ENDPOINTS.map((endpoint) => endpoint.outputPath).toSorted(byCodeUnit),
  );
});

it('keeps an unknown field GGG sends', async () => {
  const items = CAPTURED['items'] as { result: Record<string, unknown>[] };
  const patched = {
    ...items,
    result: [
      { ...items.result[0], entries: [{ type: 'Crimson Amulet', anUndeclaredKey: 'kept' }] },
      ...items.result.slice(1),
    ],
  };
  const instance = harness(capturedResponses(RATE_LIMIT_HEADERS, { items: patched }));

  const outcome = await instance.refresh();

  expect(outcome.ok).toBe(true);
  expect(writtenValue(instance.writes, 'items')).toEqual({
    ...patched,
    schemaVersion: SUPPORTED_SCHEMA_VERSION,
  });
});

it('keeps the stats category groups exactly as they arrived', async () => {
  const instance = harness(capturedResponses(RATE_LIMIT_HEADERS));

  await instance.refresh();

  const stats = writtenValue(instance.writes, 'stats');
  const captured = CAPTURED['stats'] as { result: unknown[] };
  expect(stats['result']).toEqual(captured.result);

  const groups = stats['result'] as { id: string; label: string; entries: unknown[] }[];
  expect(groups.length).toBeGreaterThan(0);
  for (const group of groups) {
    expect(typeof group.id).toBe('string');
    expect(typeof group.label).toBe('string');
    expect(Array.isArray(group.entries)).toBe(true);
  }
});
