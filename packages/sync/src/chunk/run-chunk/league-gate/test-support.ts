import {
  createFakeClockPort,
  createFakeFilesystemPort,
  createFakeHttpPort,
  SUPPORTED_SCHEMA_VERSION,
} from '@poe/contracts';
import type { FakeFilesystemPort, HttpResponse } from '@poe/contracts';

import { createLeagueGate } from '../../../league/league-gate.ts';
import { createRequestCounter } from '../../../request-counter.ts';
import { createTradeClient } from '../../../trade/client.ts';
import { TRADE_LEAGUES_URL } from '../../../trade/endpoints.ts';
import type { ChunkStep } from '../../run-chunk.ts';
import {
  A,
  B,
  harness,
  key,
  NOW,
  progressText,
  scriptedStep,
  SEVEN_HOURS_AGO,
} from '../test-support.ts';
import type { TestPorts } from '../test-support.ts';

export const ZERO = { 'tracked-list': 0, 'league-validation': 0, 'session-probe': 0 };
export const LEAGUES = {
  result: [
    { id: 'Forbidden Rites', realm: 'poe2', text: 'Forbidden Rites' },
    { id: 'Standard', realm: 'poe2', text: 'Standard' },
  ],
};
const SEARCH_URL = 'https://example.test/search';

/** A valid dataset: it is loaded, before the gate, under the lock. */
export const PREVIOUS_DATASET = `${JSON.stringify(
  {
    schemaVersion: SUPPORTED_SCHEMA_VERSION,
    league: 'Old League',
    generatedAt: SEVEN_HOURS_AGO,
    entries: [{ entryKey: key(A), price: { state: 'no-listings' }, lastAttemptedAt: SEVEN_HOURS_AGO }],
    currencyRates: [],
  },
  undefined,
  2,
)}\n`;
export const PREVIOUS_PROGRESS = progressText([key(A)]);

/** The composition every shell builds: the gate is `league-validation`, the step `tracked-list`. */
export function gated(
  league: string,
  answer: HttpResponse,
  extra: Parameters<typeof createFakeFilesystemPort>[0] = {},
  reuse?: FakeFilesystemPort,
): {
  readonly fs: FakeFilesystemPort;
  readonly ports: TestPorts;
  readonly leaguesHttp: ReturnType<typeof createFakeHttpPort>;
  readonly visited: string[];
  readonly step: ChunkStep;
  readonly logs: readonly string[];
} {
  const requests = createRequestCounter();
  const leaguesHttp = createFakeHttpPort({ [`GET ${TRADE_LEAGUES_URL}`]: answer });
  const stepHttp = requests.counted(
    createFakeHttpPort({ [`POST ${SEARCH_URL}`]: { status: 200, headers: {}, body: '{}' } }),
    'tracked-list',
  );
  const client = createTradeClient({
    http: requests.counted(leaguesHttp, 'league-validation'),
    clock: createFakeClockPort(NOW),
    wait: () => Promise.resolve(),
    userAgent: 'poe-crafting-base-price-checker/0.0.0 (contact: someone@example.test)',
  });
  const built = harness([A, B], extra, { requests, gate: createLeagueGate({ client, league }) });
  const fs = reuse ?? built.fs;
  const { visited, step } = scriptedStep();
  const pricing: ChunkStep = async (entry) => {
    await stepHttp.send({ method: 'POST', url: SEARCH_URL, headers: {} });
    return step(entry);
  };
  return { fs, ports: { ...built.ports, fs }, leaguesHttp, visited, step: pricing, logs: built.logs };
}

export const ok = (body: unknown): HttpResponse => ({ status: 200, headers: {}, body: JSON.stringify(body) });
