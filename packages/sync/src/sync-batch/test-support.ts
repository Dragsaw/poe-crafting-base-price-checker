import {
  createFakeClockPort,
  createFakeFilesystemPort,
  createFakeGitPort,
  createFakeHttpPort,
  SyncReportFileSchema,
} from '@poe/contracts';
import type { FakeFilesystemPort, FilesystemPort, HttpResponse, SyncReportFile, TrackedEntry } from '@poe/contracts';

import { REPORT_PATH } from '../chunk/run-chunk.ts';
import type { SyncCommandDependencies } from '../sync-batch.ts';
import { TRADE_LEAGUES_URL, tradeSearchUrl } from '../trade/endpoints.ts';
import { shellDataInputs } from '../test-support/shell-data-inputs.ts';
import { USER_AGENT_ENV_VAR } from '../trade/user-agent.ts';

export const LEAGUE = 'Test League';
export const NOW = '2026-09-26T12:00:00.000Z';
export const CONTACT = 'poe-crafting-base-price-checker/0.0.0 (contact: someone@example.test)';

export const ENTRY: TrackedEntry = { kind: 'raw', baseTypeId: 'Solar Amulet', categoryId: 'accessory.amulet', className: 'Amulets', itemLevelMin: 82, status: 'active' };

function inputs(
  league: string,
  tracked: readonly TrackedEntry[] = [ENTRY],
): Parameters<typeof createFakeFilesystemPort>[0] {
  return shellDataInputs({ tracked, league });
}

export const LEAGUES_BODY = JSON.stringify({
  result: [
    { id: 'Standard', realm: 'poe2', text: 'Standard' },
    { id: LEAGUE, realm: 'poe2', text: LEAGUE },
  ],
});

export interface Answers {
  readonly leagues?: HttpResponse;
  readonly search?: HttpResponse;
}

export const THROTTLED: HttpResponse = { status: 429, headers: { 'retry-after': '60' }, body: '' };

function httpFor(league: string, answers: Answers = {}) {
  return createFakeHttpPort({
    [`GET ${TRADE_LEAGUES_URL}`]: answers.leagues ?? { status: 200, headers: {}, body: LEAGUES_BODY },
    [`POST ${tradeSearchUrl(league)}`]: answers.search ?? {
      status: 200,
      headers: {},
      body: JSON.stringify({ id: 'S0', complexity: 1, result: [], total: 0 }),
    },
  });
}

/** A fake filesystem that records every path written through it. */
function recording(fs: FakeFilesystemPort): { readonly fs: FakeFilesystemPort; readonly writes: string[] } {
  const writes: string[] = [];
  return {
    writes,
    fs: {
      ...fs,
      writeTextFile: (path, contents) => {
        writes.push(path);
        return fs.writeTextFile(path, contents);
      },
    },
  };
}

export interface Setup {
  readonly env?: Record<string, string | undefined>;
  readonly answers?: Answers;
  /** Files seeded beside the inputs, e.g. a published dataset or a live lock. */
  readonly seeded?: NonNullable<Parameters<typeof createFakeFilesystemPort>[0]>;
  /** The tracked entries; one `ENTRY` by default. */
  readonly tracked?: readonly TrackedEntry[];
  readonly wait?: (ms: number) => Promise<void>;
}

const AUTH_LINE = /^pnpm sync:batch: (authenticated|unauthenticated \()/;

export function dependenciesFor(league: string, setup: Setup = {}) {
  const environment = setup.env ?? { [USER_AGENT_ENV_VAR]: CONTACT };
  const recorded = recording(createFakeFilesystemPort({ ...inputs(league, setup.tracked), ...setup.seeded }));
  const http = httpFor(league, setup.answers);
  const out: string[] = [];
  const error: string[] = [];
  /** The auth lines, kept apart from `err`, with the requests sent before each. */
  const auth: { readonly line: string; readonly requestsBefore: number }[] = [];
  const dependencies: SyncCommandDependencies = {
    fs: recorded.fs,
    clock: createFakeClockPort(NOW),
    http,
    git: createFakeGitPort(),
    wait: setup.wait ?? (() => Promise.resolve()),
    pid: 4242,
    log: () => {},
    env: environment,
    stdout: (line) => {
      out.push(line);
    },
    stderr: (line) => {
      if (AUTH_LINE.test(line)) {
        auth.push({ line, requestsBefore: http.requests.length });
        return;
      }
      error.push(line);
    },
  };
  return { deps: dependencies, fs: recorded.fs, writes: recorded.writes, http, out, err: error, auth };
}

export async function reportOf(fs: FilesystemPort): Promise<SyncReportFile | undefined> {
  const text = await fs.readTextFile(REPORT_PATH);
  return text === undefined ? undefined : SyncReportFileSchema.parse(JSON.parse(text));
}
