import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createFakeClockPort, createFakeHttpPort } from '@poe/contracts';
import type { HttpResponse } from '@poe/contracts';
import { expect } from 'vitest';

import { catalogueFilePathOf, refreshCatalogue } from '../catalogue-refresh.ts';
import { CATALOGUE_ENDPOINTS } from '../trade/endpoints.ts';

export const REPO_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
export const CONTACT = 'poe-crafting-base-price-checker/0.0.0 (contact: someone@example.test)';

export const byCodeUnit = (a: string, b: string): number => Number(a > b) - Number(a < b);

export const CAPTURED: Readonly<Record<string, unknown>> = Object.fromEntries(
  CATALOGUE_ENDPOINTS.map((endpoint) => [
    endpoint.artifact,
    JSON.parse(readFileSync(`${REPO_ROOT}fixtures/trade-data-${endpoint.artifact}.json`, 'utf8')),
  ]),
);

export function respond(body: unknown, headers: HttpResponse['headers']): HttpResponse {
  return { status: 200, headers, body: JSON.stringify(body) };
}

/** One fixtured 200 per catalogue endpoint, from the committed captures. */
export function capturedResponses(
  headers: HttpResponse['headers'],
  overrides: Readonly<Record<string, unknown>> = {},
): Record<string, HttpResponse> {
  const fixtures: Record<string, HttpResponse> = {};
  for (const endpoint of CATALOGUE_ENDPOINTS) {
    fixtures[`GET ${endpoint.url}`] = respond(
      overrides[endpoint.artifact] ?? CAPTURED[endpoint.artifact],
      headers,
    );
  }
  return fixtures;
}

interface Harness {
  readonly http: ReturnType<typeof createFakeHttpPort>;
  readonly writes: { path: string; contents: string }[];
  readonly waits: number[];
  refresh: () => ReturnType<typeof refreshCatalogue>;
}

export function harness(
  fixtures: Record<string, HttpResponse>,
  /** Lets one case refuse a write the way a full disk would. */
  shouldRefuseWriteAt?: (path: string) => boolean,
): Harness {
  const http = createFakeHttpPort(fixtures);
  const writes: { path: string; contents: string }[] = [];
  const waits: number[] = [];
  const clock = createFakeClockPort('2026-09-20T12:00:00.000Z');
  return {
    http,
    writes,
    waits,
    refresh: () =>
      refreshCatalogue({
        http,
        clock,
        wait: (ms) => {
          waits.push(ms);
          // The ledger ages each rule against the clock: a wait that does not
          // move time is invisible to the pacer.
          const resumedAt = Date.parse(clock.now()) + ms;
          clock.set(new Date(resumedAt).toISOString());
          return Promise.resolve();
        },
        userAgent: CONTACT,
        writeCatalogueFile: (path, contents) => {
          if (shouldRefuseWriteAt?.(path) === true) {
            return Promise.reject(new Error(`EACCES: permission denied, open '${path}'`));
          }
          writes.push({ path, contents });
          return Promise.resolve();
        },
      }),
  };
}

export function endpointFor(artifact: string): (typeof CATALOGUE_ENDPOINTS)[number] {
  const endpoint = CATALOGUE_ENDPOINTS.find((candidate) => candidate.artifact === artifact);
  if (endpoint === undefined) {
    throw new Error(`no endpoint declared for ${artifact}`);
  }
  return endpoint;
}

/** Narrows to the failure branch; `expect(outcome.ok).toBe(false)` does not narrow for tsc. */
export function failureOf(
  outcome: Awaited<ReturnType<typeof refreshCatalogue>>,
): { readonly failure: string; readonly written: readonly string[] } {
  if (outcome.ok) {
    throw new Error('expected a refused refresh, got a successful one');
  }
  return outcome;
}

export function writtenValue(
  writes: readonly { path: string; contents: string }[],
  artifact: string,
): Record<string, unknown> {
  const path = catalogueFilePathOf(endpointFor(artifact));
  const write = writes.find((candidate) => candidate.path === path);
  expect(write, `${artifact} was not written`).toBeDefined();
  return JSON.parse(write?.contents ?? '{}') as Record<string, unknown>;
}
