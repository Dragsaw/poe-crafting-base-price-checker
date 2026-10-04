import { createFakeClockPort, createFakeHttpPort } from '@poe/contracts';
import type { HttpResponse } from '@poe/contracts';

import { FIXTURE_INTERACTIONS, recordFixtures } from '../fixtures-record.ts';

export const CONTACT = 'poe-crafting-base-price-checker/0.0.0 (contact: someone@example.test)';

export function respond(body: unknown, headers: HttpResponse['headers']): HttpResponse {
  return { status: 200, headers, body: JSON.stringify(body) };
}

export function fixturesFor(
  headers: HttpResponse['headers'],
  bodies: Readonly<Record<string, unknown>> = {},
): Record<string, HttpResponse> {
  const fixtures: Record<string, HttpResponse> = {};
  for (const interaction of FIXTURE_INTERACTIONS) {
    fixtures[`GET ${interaction.url}`] = respond(bodies[interaction.name] ?? { result: [] }, headers);
  }
  return fixtures;
}

export function recorderHarness(fixtures: Record<string, HttpResponse>): {
  readonly http: ReturnType<typeof createFakeHttpPort>;
  readonly writes: { path: string; contents: string }[];
  record: () => ReturnType<typeof recordFixtures>;
} {
  const http = createFakeHttpPort(fixtures);
  const writes: { path: string; contents: string }[] = [];
  return {
    http,
    writes,
    record: () =>
      recordFixtures({
        http,
        clock: createFakeClockPort('2026-09-20T12:00:00.000Z'),
        wait: () => Promise.resolve(),
        userAgent: CONTACT,
        writeFixture: (path, contents) => {
          writes.push({ path, contents });
          return Promise.resolve();
        },
      }),
  };
}
