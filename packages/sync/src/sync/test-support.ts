import {
  createFakeClockPort,
  createFakeFilesystemPort,
  createFakeGitPort,
  createFakeHttpPort,
  SyncReportFileSchema,
} from '@poe/contracts';
import type { FakeClockPort, FakeFilesystemPort, HttpPort, HttpResponse, SyncReportFile, TrackedEntry } from '@poe/contracts';

import { REPORT_PATH } from '../chunk/run-chunk.ts';
import type { SyncSessionDependencies } from '../sync.ts';
import { TRADE_LEAGUES_URL, tradeSearchUrl } from '../trade/endpoints.ts';
import { shellDataInputs } from '../test-support/shell-data-inputs.ts';
import { USER_AGENT_ENV_VAR } from '../trade/user-agent.ts';

export const LEAGUE = 'Test League';
export const NOW = '2026-09-26T12:00:00.000Z';
export const CONTACT = 'poe-crafting-base-price-checker/0.0.0 (contact: someone@example.test)';

export const ENTRY: TrackedEntry = { kind: 'raw', baseTypeId: 'Solar Amulet', itemLevelMin: 82, status: 'active' };
export const SECOND: TrackedEntry = { ...ENTRY, itemLevelMin: 83 };

export const LEAGUES_BODY = JSON.stringify({
  result: [
    { id: 'Standard', realm: 'poe2', text: 'Standard' },
    { id: LEAGUE, realm: 'poe2', text: LEAGUE },
  ],
});
export const NO_RESULTS = JSON.stringify({ id: 'S0', complexity: 1, result: [], total: 0 });

export function inputs(
  tracked: readonly TrackedEntry[],
  minChunkSearches = 1,
): Parameters<typeof createFakeFilesystemPort>[0] {
  return shellDataInputs({ tracked, minChunkSearches, configModifiedAt: '2026-09-20T07:00:00.000Z' });
}

export interface SessionSetup {
  readonly tracked?: readonly TrackedEntry[];
  readonly minChunkSearches?: number;
  readonly seeded?: NonNullable<Parameters<typeof createFakeFilesystemPort>[0]>;
  readonly fixtures?: Readonly<Record<string, HttpResponse>>;
  /** Replaces the fake http port, e.g. to fail with a network error. */
  readonly http?: (fake: ReturnType<typeof createFakeHttpPort>) => HttpPort;
  readonly env?: Record<string, string | undefined>;
  readonly argv?: readonly string[];
  /** The session stops after this many chunk lines (stdout outcome or stderr error). */
  readonly stopAfter?: number;
}

const OUTCOME_LINE = /^pnpm sync: (completed|bounded|yielded|busy|deferred|dispossessed)/;
const AUTH_LINE = /^pnpm sync: (authenticated|unauthenticated \()/;

function advance(clock: FakeClockPort, ms: number): void {
  const resumed = Date.parse(clock.now()) + ms;
  clock.set(new Date(resumed).toISOString());
}

function fakeHttpFor(fixtures: SessionSetup['fixtures']) {
  return createFakeHttpPort({
    [`GET ${TRADE_LEAGUES_URL}`]: { status: 200, headers: {}, body: LEAGUES_BODY },
    [`POST ${tradeSearchUrl(LEAGUE)}`]: { status: 200, headers: {}, body: NO_RESULTS },
    ...fixtures,
  });
}

function chunkCounter(controller: AbortController, stopAfter: number): () => void {
  let chunks = 0;
  return () => {
    chunks += 1;
    if (chunks >= stopAfter) {
      controller.abort();
    }
  };
}

export function sessionFor(setup: SessionSetup = {}) {
  const fs = createFakeFilesystemPort({
    ...inputs(setup.tracked ?? [ENTRY], setup.minChunkSearches),
    ...setup.seeded,
  });
  const clock = createFakeClockPort(NOW);
  const fake = fakeHttpFor(setup.fixtures);
  const http = setup.http === undefined ? fake : setup.http(fake);
  const controller = new AbortController();
  const out: { readonly line: string; readonly at: string }[] = [];
  const error: string[] = [];
  const auth: { readonly line: string; readonly requestsBefore: number }[] = [];
  /** The session's waits, in order. Each advances the fake clock. */
  const sleeps: number[] = [];
  /** The in-chunk waits the governor asked for. */
  const waits: number[] = [];
  const countChunk = chunkCounter(controller, setup.stopAfter ?? 1);
  const dependencies: SyncSessionDependencies = {
    fs,
    clock,
    http,
    git: createFakeGitPort(),
    wait: (ms) => {
      waits.push(ms);
      advance(clock, ms);
      return Promise.resolve();
    },
    sleep: (ms) => {
      sleeps.push(ms);
      advance(clock, ms);
      // A guard against a test that never stops.
      if (sleeps.length > 200) {
        controller.abort();
      }
      return Promise.resolve();
    },
    pid: 4242,
    log: () => {},
    env: setup.env ?? { [USER_AGENT_ENV_VAR]: CONTACT },
    argv: setup.argv ?? [],
    signal: controller.signal,
    stdout: (line) => {
      out.push({ line, at: clock.now() });
      if (OUTCOME_LINE.test(line)) {
        countChunk();
      }
    },
    stderr: (line) => {
      // An auth line is not a chunk line: kept apart, with the requests sent before it.
      if (AUTH_LINE.test(line)) {
        auth.push({ line, requestsBefore: fake.requests.length });
        return;
      }
      error.push(line);
      countChunk();
    },
  };
  return { deps: dependencies, fs, clock, http: fake, out, err: error, auth, sleeps, waits, controller };
}

export async function reportOf(fs: FakeFilesystemPort): Promise<SyncReportFile | undefined> {
  const text = await fs.readTextFile(REPORT_PATH);
  return text === undefined ? undefined : SyncReportFileSchema.parse(JSON.parse(text));
}

export const lines = (out: readonly { readonly line: string }[]): string[] => out.map((entry) => entry.line);

/** The duration each matching wait line announced, from the instant it was printed. */
export function announced(out: readonly { readonly line: string; readonly at: string }[], reason: string): number[] {
  return out
    .filter((entry) => entry.line.includes(`(${reason}`))
    .map((entry) => {
      const until = /waiting until (\S+)/.exec(entry.line)?.[1] ?? '';
      return Date.parse(until) - Date.parse(entry.at);
    });
}
