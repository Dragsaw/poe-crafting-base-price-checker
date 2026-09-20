/**
 * `pnpm fixtures:record` — the explicit, human-invoked recorder (NFR-2, AD-13).
 *
 * It issues live GET requests through the **same governed client** every other
 * story spends through, strips every personal identifier at record time, and
 * writes the payloads under `fixtures/`. Its output is a reviewable diff, which
 * is the mechanism that makes a change by GGG visible before it becomes a
 * production incident.
 *
 * **No test runs this.** It is referenced by no vitest config and by no setup
 * file, and the entry guard at the bottom means importing the module — which
 * `fixtures-record.test.ts` does, to drive `recordFixtures` against the fakes —
 * issues nothing.
 *
 * **It records only what it can construct by itself today**: the leagues
 * endpoint and the four `data/*` endpoints. Stories 1.4 and 1.7 add their own
 * interactions when they have a real request to record. No request body is
 * hand-written here; a hand-written body records what the team believes the API
 * takes rather than what it takes, which is the defect the fixture rules exist
 * to prevent.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { ClockPort, HttpPort } from '@poe/contracts';

import { createTradeClient } from './trade/client.ts';
import { resolveUserAgent } from './trade/user-agent.ts';

/** `IMPLEMENTATION-NOTES.md` §5.1: realm `poe2` on the `trade2` API. */
const TRADE_API_BASE = 'https://www.pathofexile.com/api/trade2';

/** The repository's `fixtures/` directory, three levels up from `src/`. */
const FIXTURES_DIR = fileURLToPath(new URL('../../../fixtures/', import.meta.url));

/** How long a single live request may take before it is abandoned. */
const REQUEST_TIMEOUT_MS = 30_000;

/**
 * One recordable interaction. All five share a lane because they are the same
 * kind of GET against the same endpoint family; which policy that lane spends
 * against is learned from `X-Rate-Limit-Policy` and never declared here.
 */
export interface FixtureInteraction {
  /** Names the interaction, never a test (AGENT-WORKFLOW, Fixture hygiene). */
  readonly name: string;
  readonly method: 'GET';
  readonly url: string;
}

const DATA_LANE = 'trade-data-get';

export const FIXTURE_INTERACTIONS: readonly FixtureInteraction[] = [
  { name: 'trade-data-leagues', method: 'GET', url: `${TRADE_API_BASE}/data/leagues` },
  { name: 'trade-data-items', method: 'GET', url: `${TRADE_API_BASE}/data/items` },
  { name: 'trade-data-stats', method: 'GET', url: `${TRADE_API_BASE}/data/stats` },
  { name: 'trade-data-filters', method: 'GET', url: `${TRADE_API_BASE}/data/filters` },
  { name: 'trade-data-static', method: 'GET', url: `${TRADE_API_BASE}/data/static` },
];

export const REDACTED = '[redacted]';

/**
 * Keys whose value is a personal identifier wherever it appears. Account names
 * and character names are personal identifiers (AGENT-WORKFLOW, Fixture
 * hygiene); a whisper template embeds the character name in its text, and the
 * token is the same string in another encoding.
 */
const IDENTIFIER_KEYS = new Set([
  'accountname',
  'charactername',
  'lastcharactername',
  'poesessid',
  'whisper',
  'whisper_token',
]);

/** Containers whose own `name` is the account's, rather than a catalogue label. */
const IDENTITY_CONTAINERS = new Set(['account']);
const IDENTITY_CONTAINER_KEYS = new Set(['name']);

function isIdentifierKey(key: string, parentKey: string | undefined): boolean {
  const lower = key.toLowerCase();
  if (IDENTIFIER_KEYS.has(lower)) {
    return true;
  }
  return (
    parentKey !== undefined &&
    IDENTITY_CONTAINERS.has(parentKey.toLowerCase()) &&
    IDENTITY_CONTAINER_KEYS.has(lower)
  );
}

/**
 * Replaces every personal identifier with `REDACTED`, **keeping the key**.
 *
 * Structure is never removed, only values: the hygiene rule keeps a field even
 * where no code uses it, because the loss of that field is itself a signal. The
 * redaction propagates **into** an identifier key's value, so a list of
 * character names is stripped element by element rather than passing through
 * because it happened not to be a bare string. A bare `name` is only an
 * identifier inside an identity container — elsewhere it is a catalogue label,
 * and blanking those would gut the very payloads being recorded.
 */
export function stripPersonalIdentifiers(
  value: unknown,
  parentKey?: string,
  redact = false,
): unknown {
  if (typeof value === 'string') {
    return redact ? REDACTED : value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => stripPersonalIdentifiers(item, parentKey, redact));
  }
  if (typeof value === 'object' && value !== null) {
    const stripped: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      stripped[key] = stripPersonalIdentifiers(
        nested,
        key,
        redact || isIdentifierKey(key, parentKey),
      );
    }
    return stripped;
  }
  return value;
}

/** The fixture file one interaction writes. */
export function fixturePathOf(interaction: FixtureInteraction): string {
  return join(FIXTURES_DIR, `${interaction.name}.json`);
}

/**
 * Consistency Conventions: UTF-8 without BOM, LF, two-space JSON, trailing
 * newline — so a re-record diffs as changed data rather than as
 * reserialisation noise.
 */
export function serialiseFixture(payload: unknown): string {
  return `${JSON.stringify(payload, null, 2)}\n`;
}

/** The seam the co-located test drives. Everything it needs is passed in. */
export interface RecorderPorts {
  readonly http: HttpPort;
  readonly clock: ClockPort;
  readonly wait: (ms: number) => Promise<void>;
  readonly userAgent: string;
  readonly writeFixture: (path: string, contents: string) => Promise<void>;
}

export interface RecordOutcome {
  readonly ok: boolean;
  /** Absent on success; the reason, naming the interaction, on failure. */
  readonly failure?: string;
  readonly written: readonly string[];
}

/**
 * Issues every interaction, **buffers every payload, and writes only once all
 * five succeeded.** A mid-loop failure would otherwise leave `fixtures/` half
 * re-recorded — a diff that mixes today's capture with last month's, which is
 * unreviewable and is exactly what the fixture set exists to make legible.
 */
export async function recordFixtures(ports: RecorderPorts): Promise<RecordOutcome> {
  const client = createTradeClient({
    http: ports.http,
    clock: ports.clock,
    wait: ports.wait,
    userAgent: ports.userAgent,
  });

  const captured: { path: string; contents: string }[] = [];

  for (const interaction of FIXTURE_INTERACTIONS) {
    const result = await client.send({
      method: interaction.method,
      url: interaction.url,
      lane: DATA_LANE,
    });

    if (result.kind === 'yield') {
      return {
        ok: false,
        failure: `rate limited on ${interaction.name}; yielded for ${String(result.retryAfterMs)} ms (${result.reason}). Nothing was written.`,
        written: [],
      };
    }

    if (result.response.status !== 200) {
      return {
        ok: false,
        failure: `${interaction.name} answered ${String(result.response.status)}. Nothing was written.`,
        written: [],
      };
    }

    let payload: unknown;
    try {
      payload = JSON.parse(result.response.body);
    } catch (error) {
      // A 200 carrying an HTML error page is the usual cause, and a bare
      // SyntaxError names neither the endpoint nor the fact that it answered.
      return {
        ok: false,
        failure: `${interaction.name} answered 200 but its body is not JSON (${String(error)}). Nothing was written.`,
        written: [],
      };
    }

    captured.push({
      path: fixturePathOf(interaction),
      contents: serialiseFixture(stripPersonalIdentifiers(payload)),
    });
  }

  const written: string[] = [];
  for (const { path, contents } of captured) {
    await ports.writeFixture(path, contents);
    written.push(path);
  }
  return { ok: true, written };
}

/**
 * The real `HttpPort`. It lives at the shell edge, in the one file no test
 * executes, so `fetch` never appears below the factory.
 */
function createFetchHttpPort(): HttpPort {
  return {
    async send(request) {
      // Without a signal a stalled connection hangs the command indefinitely,
      // with no output and no exit.
      const response = await fetch(request.url, {
        method: request.method,
        headers: { ...request.headers },
        body: request.body,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      const headers: Record<string, string> = {};
      response.headers.forEach((headerValue, headerName) => {
        headers[headerName.toLowerCase()] = headerValue;
      });
      return { status: response.status, headers, body: await response.text() };
    },
  };
}

const systemClock: ClockPort = {
  now: () => new Date().toISOString(),
};

const sleep = (ms: number): Promise<void> =>
  new Promise((done) => {
    setTimeout(done, ms);
  });

async function main(): Promise<void> {
  const contact = resolveUserAgent();
  if (!contact.ok) {
    process.stderr.write(`pnpm fixtures:record: ${contact.message}\n`);
    process.exitCode = 1;
    return;
  }

  const outcome = await recordFixtures({
    http: createFetchHttpPort(),
    clock: systemClock,
    wait: sleep,
    userAgent: contact.userAgent,
    writeFixture: async (path, contents) => {
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, contents, { encoding: 'utf8' });
    },
  });

  if (!outcome.ok) {
    process.stderr.write(`pnpm fixtures:record: ${outcome.failure ?? 'failed'}\n`);
    process.exitCode = 1;
    return;
  }

  for (const path of outcome.written) {
    process.stdout.write(`recorded ${path}\n`);
  }
}

/**
 * The entry guard. `node packages/sync/src/fixtures-record.ts` runs `main`;
 * importing the module — which the co-located test does — runs nothing.
 */
const entry = process.argv[1];
const invokedDirectly = entry !== undefined && resolve(entry) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  main().catch((error: unknown) => {
    process.stderr.write(`pnpm fixtures:record: ${String(error)}\n`);
    process.exitCode = 1;
  });
}
