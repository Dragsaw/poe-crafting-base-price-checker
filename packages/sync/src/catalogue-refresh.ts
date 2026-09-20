/**
 * `pnpm catalogue:refresh` — the explicit, human-invoked catalogue refresh
 * (AD-25, AGENT-WORKFLOW §Fixtures).
 *
 * The four trade data endpoints are the only authority for what a `statId`, a
 * `baseTypeId` or a `categoryId` means. This command issues **exactly four
 * GETs** through the one governed client, validates each response against its
 * `contracts` schema, stamps `schemaVersion`, and writes
 * `data/catalogue/{items,stats,filters,static}.json` **all-or-nothing**. Its
 * output is a git diff: a GGG patch that renames a stat id arrives as one
 * reviewable line rather than as a silent behaviour change.
 *
 * **No test runs this against the network.** It is referenced by no vitest
 * config and by no setup file; the entry guard at the bottom means importing
 * the module — which `catalogue-refresh.test.ts` does, to drive
 * `refreshCatalogue` against the fakes — issues nothing and writes nothing.
 *
 * What it is not: no chunk, no lock, no progress file, no `sync-report.json`
 * entry, no league gate, no schedule, and no id validation. This story writes
 * the authority; Story 1.10 reads it.
 */

import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CatalogueFiltersFileSchema,
  CatalogueItemsFileSchema,
  CatalogueStaticFileSchema,
  CatalogueStatsFileSchema,
  FilterCatalogueSchema,
  ItemCatalogueSchema,
  StatCatalogueSchema,
  StaticCatalogueSchema,
  SUPPORTED_SCHEMA_VERSION,
} from '@poe/contracts';
import type { ClockPort, EnvelopeIssues, HttpPort } from '@poe/contracts';

import {
  createFetchHttpPort,
  serialiseJsonArtifact,
  sleep,
  systemClock,
  writeTextFile,
} from './shell.ts';
import { createTradeClient } from './trade/client.ts';
import {
  CATALOGUE_ENDPOINTS,
  type CatalogueArtifact,
  type CatalogueEndpoint,
  DATA_LANE,
} from './trade/endpoints.ts';
import { resolveUserAgent } from './trade/user-agent.ts';

/** The repository root, three levels up from `src/`. */
const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

/**
 * The narrowest thing this module needs of a schema: parse an unknown value and
 * report issues. Typing it structurally keeps `zod` out of `sync`'s imports —
 * `sync` declares `@poe/contracts` and `@poe/core` and nothing else, and the
 * schemas arrive through `contracts` as values.
 */
interface CatalogueParser {
  safeParse(
    value: unknown,
  ): { success: true; data: unknown } | { success: false; error: { issues: EnvelopeIssues } };
}

interface ArtifactSchemas {
  /** The payload as the API sends it. */
  readonly payload: CatalogueParser;
  /** The payload plus `schemaVersion` — what actually lands on disk. */
  readonly file: CatalogueParser;
}

/**
 * Both schemas per artifact. The payload is checked first so a shape failure is
 * reported against what arrived, rather than as a puzzling envelope error; the
 * envelope is then checked as the last gate before any byte is written.
 */
const SCHEMAS: Readonly<Record<CatalogueArtifact, ArtifactSchemas>> = {
  items: { payload: ItemCatalogueSchema, file: CatalogueItemsFileSchema },
  stats: { payload: StatCatalogueSchema, file: CatalogueStatsFileSchema },
  filters: { payload: FilterCatalogueSchema, file: CatalogueFiltersFileSchema },
  static: { payload: StaticCatalogueSchema, file: CatalogueStaticFileSchema },
};

/** Where one artifact is committed. */
export function catalogueFilePathOf(endpoint: CatalogueEndpoint): string {
  return join(REPO_ROOT, endpoint.outputPath);
}

/**
 * The shell's one serialisation, re-exported under this command's name.
 *
 * It is **the same function** `serialiseFixture` calls, not a second copy with
 * the same body: the "empty second diff" criterion rests on byte identity, and
 * two copies are only identical until one of them is edited.
 */
export const serialiseCatalogue = serialiseJsonArtifact;

/** The first issue, pointed at by its path, so a failure names a field. */
function describeIssues(issues: EnvelopeIssues): string {
  const first = issues[0];
  if (first === undefined) {
    return 'the schema refused it without naming an issue';
  }
  const path = first.path.map((segment) => String(segment)).join('.');
  return path === '' ? first.message : `${path}: ${first.message}`;
}

/** The seam the co-located test drives. Everything it needs is passed in. */
export interface CatalogueRefreshPorts {
  readonly http: HttpPort;
  readonly clock: ClockPort;
  readonly wait: (ms: number) => Promise<void>;
  readonly userAgent: string;
  /**
   * Injected exactly as `RecorderPorts.writeFixture` is, so the whole
   * four-endpoint path is exercised with no filesystem — which is also what
   * keeps a test run from ever touching `data/`.
   */
  readonly writeCatalogueFile: (path: string, contents: string) => Promise<void>;
}

export interface CatalogueRefreshOutcome {
  readonly ok: boolean;
  /** Absent on success; the reason, naming the artifact, on failure. */
  readonly failure?: string;
  readonly written: readonly string[];
}

function refused(failure: string): CatalogueRefreshOutcome {
  return { ok: false, failure, written: [] };
}

/**
 * Issues the four GETs, **buffers every artifact, and writes only once all four
 * have been fetched and validated.**
 *
 * A mid-run failure would otherwise leave a commit mixing a new `stats.json`
 * with a stale `items.json` — a catalogue that no single response ever
 * described, and the one state a validation authority must never be in.
 */
export async function refreshCatalogue(
  ports: CatalogueRefreshPorts,
): Promise<CatalogueRefreshOutcome> {
  const client = createTradeClient({
    http: ports.http,
    clock: ports.clock,
    wait: ports.wait,
    userAgent: ports.userAgent,
  });

  const captured: { path: string; contents: string }[] = [];

  for (const endpoint of CATALOGUE_ENDPOINTS) {
    let result: Awaited<ReturnType<typeof client.send>>;
    try {
      result = await client.send({
        method: 'GET',
        url: endpoint.url,
        // One lane over all four, so they pace against one ledger entry rather
        // than seeding four cold lanes.
        lane: DATA_LANE,
      });
    } catch (error) {
      // A rejection, not a status: the 30 s `AbortSignal.timeout`, a DNS
      // failure, a socket reset. "A returned failure, never a throw" has to
      // hold for these too, or the human gets a stack trace instead of a
      // sentence naming which endpoint went quiet.
      return refused(
        `${endpoint.artifact} could not be reached (${String(error)}). Nothing was written.`,
      );
    }

    if (result.kind === 'yield') {
      // A yield is a value, never a throw: the client has already decided not
      // to spend, and the human needs the delay it named to know when to
      // return.
      return refused(
        `rate limited on ${endpoint.artifact}; yielded for ${String(result.retryAfterMs)} ms (${result.reason}). Nothing was written.`,
      );
    }

    if (result.response.status !== 200) {
      return refused(
        `${endpoint.artifact} answered ${String(result.response.status)}. Nothing was written.`,
      );
    }

    let payload: unknown;
    try {
      payload = JSON.parse(result.response.body);
    } catch (error) {
      // A 200 carrying an HTML interstitial is the usual cause, and a bare
      // SyntaxError names neither the endpoint nor the fact that it answered.
      return refused(
        `${endpoint.artifact} answered 200 but its body is not JSON (${String(error)}). Nothing was written.`,
      );
    }

    const schemas = SCHEMAS[endpoint.artifact];

    const parsedPayload = schemas.payload.safeParse(payload);
    if (!parsedPayload.success) {
      return refused(
        `${endpoint.artifact} does not match its catalogue schema — ${describeIssues(parsedPayload.error.issues)}. Nothing was written.`,
      );
    }

    /**
     * The payload **as it arrived**, plus `schemaVersion`. The raw parsed JSON
     * is spread rather than the schema's output value: ids go to disk verbatim,
     * never trimmed, re-encoded, case-folded, sorted or flattened, and an
     * unknown field GGG sends survives the round trip.
     */
    const envelope = {
      ...(payload as Record<string, unknown>),
      schemaVersion: SUPPORTED_SCHEMA_VERSION,
    };

    // Unreachable today: the envelope is exactly `payload.extend({schemaVersion})`
    // and the version is a constant, so a payload that parsed cannot fail here.
    // It is a gate against a future envelope that adds a constraint, not a path
    // this story can exercise.
    const parsedFile = schemas.file.safeParse(envelope);
    if (!parsedFile.success) {
      return refused(
        `${endpoint.artifact} does not match its file envelope — ${describeIssues(parsedFile.error.issues)}. Nothing was written.`,
      );
    }

    captured.push({
      path: catalogueFilePathOf(endpoint),
      contents: serialiseCatalogue(envelope),
    });
  }

  const written: string[] = [];
  for (const { path, contents } of captured) {
    try {
      await ports.writeCatalogueFile(path, contents);
    } catch (error) {
      // The one place all-or-nothing can still be broken: a permission or disk
      // failure part way down leaves new files beside stale ones. Nothing here
      // can undo the writes that landed, so the failure **says how many did**
      // and names the path that refused — the human needs both to know what
      // their working tree now holds.
      return {
        ok: false,
        failure: `writing ${path} failed (${String(error)}). ${String(written.length)} of ${String(captured.length)} artifacts had already been written; the catalogue is now mixed, so re-run pnpm catalogue:refresh or revert data/catalogue/.`,
        written,
      };
    }
    written.push(path);
  }
  return { ok: true, written };
}

async function main(): Promise<void> {
  const contact = resolveUserAgent();
  if (!contact.ok) {
    // Refused before anything is issued: a request with no descriptive contact
    // is precisely what NFR-9 forbids.
    process.stderr.write(`pnpm catalogue:refresh: ${contact.message}\n`);
    process.exitCode = 1;
    return;
  }

  const outcome = await refreshCatalogue({
    http: createFetchHttpPort(),
    clock: systemClock,
    wait: sleep,
    userAgent: contact.userAgent,
    writeCatalogueFile: writeTextFile,
  });

  if (!outcome.ok) {
    process.stderr.write(`pnpm catalogue:refresh: ${outcome.failure ?? 'failed'}\n`);
    process.exitCode = 1;
    return;
  }

  for (const path of outcome.written) {
    process.stdout.write(`refreshed ${path}\n`);
  }
}

/**
 * The entry guard. `node packages/sync/src/catalogue-refresh.ts` runs `main`;
 * importing the module — which the co-located test does — runs nothing.
 */
const entry = process.argv[1];
const invokedDirectly = entry !== undefined && resolve(entry) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  main().catch((error: unknown) => {
    process.stderr.write(`pnpm catalogue:refresh: ${String(error)}\n`);
    process.exitCode = 1;
  });
}
