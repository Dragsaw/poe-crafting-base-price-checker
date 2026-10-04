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
 * **What it records**: the leagues endpoint and the four `data/*` endpoints,
 * whose URLs it takes from `trade/endpoints.ts` — the same declaration
 * `catalogue:refresh` reads — and, for every non-pruned entry of the fixture
 * workload `fixtures/tracked.json` (`FIXTURE_WORKLOAD_PATH`), the POST search
 * and its fetch leg (Story 1.7). The workload is a small fixed list, not
 * `data/tracked.json`, so the player's list can grow with no new recording. The
 * search body is built by `buildSearchBody`, the same builder the pricing
 * step sends, in the league `data/config.json` names. No request body is
 * hand-written here; a hand-written body records what the team believes the
 * API takes rather than what it takes, which is the defect the fixture rules
 * exist to prevent. `data/` is read and never written.
 */

import { readdir, rm } from 'node:fs/promises';
import nodePath from 'node:path';
import { fileURLToPath } from 'node:url';

import { canonicalKey } from '@poe/contracts';
import type { ClockPort, HttpPort, LeagueId, TrackedEntry } from '@poe/contracts';

import { loadActiveLeague } from './load-config.ts';
import { explainTrackedVersion, loadDataFile, parseTrackedFile } from './load-data-file.ts';
import { FIXTURE_WORKLOAD_PATH, pricingFixtureName } from './pricing/fixture-names.ts';
import { loadItemTypes } from './pricing/load-item-types.ts';
import { FETCH_LIMIT } from './pricing/price-entry.ts';
import { buildSearchBody } from './pricing/search-body.ts';
import type { ItemTypes } from './pricing/search-body.ts';
import {
  createFetchHttpPort,
  createNodeFilesystemPort,
  serialiseJsonArtifact,
  sleep,
  systemClock,
  writeTextFile,
} from './shell.ts';
import { createTradeClient } from './trade/client.ts';
import type { TradeRequest } from './trade/client.ts';
import { INVALID_REQUEST_THRESHOLD } from './trade/invalid-requests.ts';
import {
  CATALOGUE_ENDPOINTS,
  DATA_LANE,
  FETCH_LANE,
  SEARCH_LANE,
  TRADE_LEAGUES_URL,
  tradeFetchUrl,
  tradeSearchUrl,
} from './trade/endpoints.ts';
import { resolveUserAgent } from './trade/user-agent.ts';

/** The repository's `fixtures/` directory, three levels up from `src/`. */
const FIXTURES_DIR = fileURLToPath(new URL('../../../fixtures/', import.meta.url));

/** The recorded pricing fixtures, as `pricing/fixture-names.ts` names them. */
const PRICING_FIXTURE_FILE = /^trade-(search|fetch)-[0-9a-f]+\.json$/;

/** The repository root, whose `data/` files the recorder reads and never writes. */
const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));


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

/**
 * The five interactions: the leagues endpoint plus the four the catalogue is
 * made of. **Both spellings come from `endpoints.ts`**, so a recorded fixture
 * and the artifact `catalogue:refresh` commits can never describe two different
 * URLs.
 */
export const FIXTURE_INTERACTIONS: readonly FixtureInteraction[] = [
  { name: 'trade-data-leagues', method: 'GET', url: TRADE_LEAGUES_URL },
  ...CATALOGUE_ENDPOINTS.map((endpoint) => ({
    name: `trade-data-${endpoint.artifact}`,
    method: 'GET' as const,
    url: endpoint.url,
  })),
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
  return IDENTIFIER_KEYS.has(lower) || (
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
  shouldRedact = false,
): unknown {
  if (typeof value === 'string') {
    return shouldRedact ? REDACTED : value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => stripPersonalIdentifiers(item, parentKey, shouldRedact));
  }
  if (typeof value === 'object' && value !== null) {
    const stripped: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      stripped[key] = stripPersonalIdentifiers(
        nested,
        key,
        shouldRedact || isIdentifierKey(key, parentKey),
      );
    }
    return stripped;
  }
  return value;
}

/** The fixture file one interaction writes. */
export function fixturePathOf(interaction: Pick<FixtureInteraction, 'name'>): string {
  return nodePath.join(FIXTURES_DIR, `${interaction.name}.json`);
}

/**
 * Consistency Conventions: UTF-8 without BOM, LF, two-space JSON, trailing
 * newline — so a re-record diffs as changed data rather than as
 * reserialisation noise.
 */
export function serialiseFixture(payload: unknown): string {
  return serialiseJsonArtifact(payload);
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
 * What the pricing interactions are built from: the active league (from
 * `data/config.json`), the tracked entries and the committed item catalogue.
 */
export interface PricingWorkload {
  readonly league: LeagueId;
  readonly entries: readonly TrackedEntry[];
  readonly itemTypes: ItemTypes;
}

type Capture = (
  name: string,
  request: TradeRequest,
) => Promise<string | { readonly payload: unknown }>;

/** The search id and result ids of a captured search payload, if it has them. */
function searchAnswerOf(payload: unknown): { id: string; result: string[] } | undefined {
  if (typeof payload !== 'object' || payload === null) {
    return undefined;
  }
  const { id, result } = payload as { id?: unknown; result?: unknown };
  return typeof id !== 'string' || !Array.isArray(result) ? undefined : { id, result: result.filter((item): item is string => typeof item === 'string') };
}

/**
 * One tracked entry's two interactions: the POST search, built by
 * `buildSearchBody` exactly as the pricing step builds it, and — where the
 * search found anything — the fetch of its cheapest ten ids. Each is named
 * for its own request (`pricing/fixture-names.ts`), which is what lets the
 * dry run serve it back. Returns the failure, or `undefined`.
 */
async function recordPricing(
  entry: TrackedEntry,
  workload: PricingWorkload,
  capture: Capture,
): Promise<string | undefined> {
  let body: string;
  try {
    body = JSON.stringify(buildSearchBody(entry, workload.itemTypes));
  } catch (error) {
    return `${canonicalKey(entry)}: ${String(error)}. Nothing was written.`;
  }

  const search = { method: 'POST' as const, url: tradeSearchUrl(workload.league), body };
  const searched = await capture(pricingFixtureName(search), { ...search, lane: SEARCH_LANE });
  if (typeof searched === 'string') {
    return searched;
  }
  const answer = searchAnswerOf(searched.payload);
  if (answer === undefined) {
    return `${canonicalKey(entry)}: the search answer carries no \`id\` and \`result\`. Nothing was written.`;
  }
  if (answer.result.length === 0) {
    return undefined;
  }

  const fetch = {
    method: 'GET' as const,
    url: tradeFetchUrl(answer.result.slice(0, FETCH_LIMIT), answer.id),
  };
  const fetched = await capture(pricingFixtureName(fetch), { ...fetch, lane: FETCH_LANE });
  return typeof fetched === 'string' ? fetched : undefined;
}

/**
 * Issues every interaction, **buffers every payload, and writes only once all
 * of them succeeded.** A mid-loop failure would otherwise leave `fixtures/` half
 * re-recorded — a diff that mixes today's capture with last month's, which is
 * unreviewable and is exactly what the fixture set exists to make legible.
 */
export async function recordFixtures(
  ports: RecorderPorts,
  workload?: PricingWorkload,
): Promise<RecordOutcome> {
  const client = createTradeClient({
    http: ports.http,
    clock: ports.clock,
    wait: ports.wait,
    userAgent: ports.userAgent,
    invalidRequestThreshold: INVALID_REQUEST_THRESHOLD,
  });

  const captured: { path: string; contents: string }[] = [];

  /** One live request, parsed and stripped; a string is the failure. */
  async function capture(
    name: string,
    request: TradeRequest,
  ): Promise<string | { readonly payload: unknown }> {
    const result = await client.send(request);

    if (result.kind === 'yield') {
      return `rate limited on ${name}; yielded for ${String(result.retryAfterMs)} ms (${result.reason}). Nothing was written.`;
    }

    if (result.response.status !== 200) {
      return `${name} answered ${String(result.response.status)}. Nothing was written.`;
    }

    let payload: unknown;
    try {
      payload = JSON.parse(result.response.body);
    } catch (error) {
      // A 200 carrying an HTML error page is the usual cause, and a bare
      // SyntaxError names neither the endpoint nor the fact that it answered.
      return `${name} answered 200 but its body is not JSON (${String(error)}). Nothing was written.`;
    }

    const stripped = stripPersonalIdentifiers(payload);
    captured.push({ path: fixturePathOf({ name }), contents: serialiseFixture(stripped) });
    return { payload: stripped };
  }

  /* eslint-disable no-await-in-loop -- sequential on purpose: recorded requests share one rate-limit ledger and stop at the first failure */
  for (const interaction of FIXTURE_INTERACTIONS) {
    const outcome = await capture(interaction.name, {
      method: interaction.method,
      url: interaction.url,
      lane: DATA_LANE,
    });
    if (typeof outcome === 'string') {
      return { ok: false, failure: outcome, written: [] };
    }
  }

  if (workload !== undefined) {
    for (const entry of workload.entries) {
      if (entry.status === 'pruned') {
        continue;
      }
      const failure = await recordPricing(entry, workload, capture);
      if (failure !== undefined) {
        return { ok: false, failure, written: [] };
      }
    }
  }
  /* eslint-enable no-await-in-loop -- end of the sequential block above */

  const written: string[] = [];
  for (const { path, contents } of captured) {
    // eslint-disable-next-line no-await-in-loop -- sequential on purpose: `written` lists exactly the files written before a failure
    await ports.writeFixture(path, contents);
    written.push(path);
  }
  return { ok: true, written };
}

async function main(): Promise<void> {
  const contact = resolveUserAgent();
  if (!contact.ok) {
    process.stderr.write(`pnpm fixtures:record: ${contact.message}\n`);
    process.exitCode = 1;
    return;
  }

  // Read-only: the recorder writes under `fixtures/` and nowhere under `data/`.
  const data = createNodeFilesystemPort(REPO_ROOT);
  const league = await loadActiveLeague(data);
  const tracked = await loadDataFile(data, FIXTURE_WORKLOAD_PATH, parseTrackedFile, explainTrackedVersion);
  const itemTypes = await loadItemTypes(data);
  if (!league.ok || !tracked.ok || !itemTypes.ok) {
    const refused = [league, tracked, itemTypes].flatMap((loaded) => (loaded.ok ? [] : [loaded.error]));
    for (const error of refused) {
      process.stderr.write(`pnpm fixtures:record: ${error.message}\n`);
    }
    process.exitCode = 1;
    return;
  }

  const outcome = await recordFixtures(
    {
      http: createFetchHttpPort(),
      clock: systemClock,
      wait: sleep,
      userAgent: contact.userAgent,
      writeFixture: writeTextFile,
    },
    { league: league.value, entries: tracked.value.entries, itemTypes: itemTypes.value },
  );

  if (!outcome.ok) {
    process.stderr.write(`pnpm fixtures:record: ${outcome.failure ?? 'failed'}\n`);
    process.exitCode = 1;
    return;
  }

  for (const path of outcome.written) {
    process.stdout.write(`recorded ${path}\n`);
  }

  // Pricing fixtures are named by request digest, so a changed tracked list,
  // builder or league leaves the old names behind. Only after a successful
  // record, remove every pricing fixture this run did not write.
  const written = new Set(outcome.written.map((path) => nodePath.resolve(path)));
  const names = await readdir(FIXTURES_DIR);
  for (const name of names) {
    const path = nodePath.resolve(nodePath.join(FIXTURES_DIR, name));
    if (!PRICING_FIXTURE_FILE.test(name) || written.has(path)) {
      continue;
    }

    // eslint-disable-next-line no-await-in-loop -- sequential on purpose: the "removed" lines print in directory order
    await rm(path);
    process.stdout.write(`removed ${path}\n`);
  }
}

/**
 * The entry guard. `node packages/sync/src/fixtures-record.ts` runs `main`;
 * importing the module — which the co-located test does — runs nothing.
 */
const entry = process.argv[1];
const isInvokedDirectly = entry !== undefined && nodePath.resolve(entry) === fileURLToPath(import.meta.url);

if (isInvokedDirectly) {
  try {
    await main();
  } catch (error) {
    process.stderr.write(`pnpm fixtures:record: ${String(error)}\n`);
    process.exitCode = 1;
  }
}
