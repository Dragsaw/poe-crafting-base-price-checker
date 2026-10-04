/**
 * `pnpm catalogue:refresh`: four GETs, validated, then written all-or-nothing (AD-25, AGENT-WORKFLOW §Fixtures).
 */

import nodePath from 'node:path';
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
import { createRequestCounter } from './request-counter.ts';
import { createTradeClient } from './trade/client.ts';
import type { TradeClient, TradeResult } from './trade/client.ts';
import { INVALID_REQUEST_THRESHOLD } from './trade/invalid-requests.ts';
import {
  CATALOGUE_ENDPOINTS,
  type CatalogueArtifact,
  type CatalogueEndpoint,
  DATA_LANE,
} from './trade/endpoints.ts';
import { resolveUserAgent } from './trade/user-agent.ts';

/** The repository root, three levels up from `src/`. */
const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

/** Structural, so `zod` stays out of `sync`'s imports: the schemas arrive through `contracts` as values. */
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

/** The payload is checked first, so a shape failure names what arrived, not an envelope error. */
const SCHEMAS: Readonly<Record<CatalogueArtifact, ArtifactSchemas>> = {
  items: { payload: ItemCatalogueSchema, file: CatalogueItemsFileSchema },
  stats: { payload: StatCatalogueSchema, file: CatalogueStatsFileSchema },
  filters: { payload: FilterCatalogueSchema, file: CatalogueFiltersFileSchema },
  static: { payload: StaticCatalogueSchema, file: CatalogueStaticFileSchema },
};

/** Where one artifact is committed. */
export function catalogueFilePathOf(endpoint: CatalogueEndpoint): string {
  return nodePath.join(REPO_ROOT, endpoint.outputPath);
}

/** The same function `serialiseFixture` calls, not a copy: the empty-second-diff check rests on byte identity. */
export const serialiseCatalogue = serialiseJsonArtifact;

/** The first issue, pointed at by its path, so a failure names a field. */
function describeIssues(issues: EnvelopeIssues): string {
  const first = issues[0];
  if (first === undefined) {
    return 'the schema refused it without naming an issue';
  }
  const path = first.path.map(String).join('.');
  return path === '' ? first.message : `${path}: ${first.message}`;
}

/** The seam the co-located test drives. Everything it needs is passed in. */
export interface CatalogueRefreshPorts {
  readonly http: HttpPort;
  readonly clock: ClockPort;
  readonly wait: (ms: number) => Promise<void>;
  readonly userAgent: string;
  /** Injected, as `RecorderPorts.writeFixture` is, so a test run never touches `data/`. */
  readonly writeCatalogueFile: (path: string, contents: string) => Promise<void>;
}

export type CatalogueRefreshOutcome =
  | {
      readonly ok: true;
      readonly written: readonly string[];
      /** Counted as `catalogue-refresh` (AD-12); the command prints it, no chunk report carries it. */
      readonly requests: number;
    }
  | {
      readonly ok: false;
      /** The reason, naming the artifact. */
      readonly failure: string;
      /** What had already landed — empty unless a write failed part way. */
      readonly written: readonly string[];
      /** The requests sent before the refresh stopped, as on the success arm. */
      readonly requests: number;
    };

function refused(failure: string, requests: number): CatalogueRefreshOutcome {
  return { ok: false, failure, written: [], requests };
}

type Step<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly failure: string };

function failed(failure: string): { readonly ok: false; readonly failure: string } {
  return { ok: false, failure };
}

async function fetchBody(client: TradeClient, endpoint: CatalogueEndpoint): Promise<Step<string>> {
  let result: TradeResult;
  try {
    result = await client.send({
      method: 'GET',
      url: endpoint.url,
      // One lane over all four: they pace against one ledger entry, not four cold lanes.
      lane: DATA_LANE,
    });
  } catch (error) {
    // A rejection (timeout, DNS, reset) must also come back as a sentence, never a throw.
    return failed(`${endpoint.artifact} could not be reached (${String(error)}). Nothing was written.`);
  }

  if (result.kind === 'yield') {
    return failed(
      `rate limited on ${endpoint.artifact}; yielded for ${String(result.retryAfterMs)} ms (${result.reason}). Nothing was written.`,
    );
  }

  return result.response.status === 200
    ? { ok: true, value: result.response.body }
    : failed(`${endpoint.artifact} answered ${String(result.response.status)}. Nothing was written.`);
}

function validateBody(endpoint: CatalogueEndpoint, body: string): Step<Record<string, unknown>> {
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch (error) {
    // A 200 with an HTML interstitial is the usual cause; a bare SyntaxError names no endpoint.
    return failed(
      `${endpoint.artifact} answered 200 but its body is not JSON (${String(error)}). Nothing was written.`,
    );
  }

  const schemas = SCHEMAS[endpoint.artifact];

  const parsedPayload = schemas.payload.safeParse(payload);
  if (!parsedPayload.success) {
    return failed(
      `${endpoint.artifact} does not match its catalogue schema — ${describeIssues(parsedPayload.error.issues)}. Nothing was written.`,
    );
  }

  // The raw parsed JSON, not the schema output: ids reach disk verbatim and unknown fields survive.
  const envelope = {
    ...(payload as Record<string, unknown>),
    schemaVersion: SUPPORTED_SCHEMA_VERSION,
  };

  // Unreachable today (the envelope is `payload.extend({schemaVersion})`); a gate for a future constraint.
  const parsedFile = schemas.file.safeParse(envelope);
  return parsedFile.success
    ? { ok: true, value: envelope }
    : failed(
        `${endpoint.artifact} does not match its file envelope — ${describeIssues(parsedFile.error.issues)}. Nothing was written.`,
      );
}

async function writeCaptured(
  ports: CatalogueRefreshPorts,
  captured: readonly { path: string; contents: string }[],
  requests: () => number,
): Promise<CatalogueRefreshOutcome> {
  const written: string[] = [];
  for (const { path, contents } of captured) {
    try {
      // eslint-disable-next-line no-await-in-loop -- sequential on purpose: the failure message reports how many writes had landed
      await ports.writeCatalogueFile(path, contents);
    } catch (error) {
      // The one place all-or-nothing can break: the failure says how many landed and which path refused.
      return {
        ok: false,
        failure: `writing ${path} failed (${String(error)}). ${String(written.length)} of ${String(captured.length)} artifacts had already been written; the catalogue is now mixed, so re-run pnpm catalogue:refresh or revert data/catalogue/.`,
        written,
        requests: requests(),
      };
    }
    written.push(path);
  }
  return { ok: true, written, requests: requests() };
}

/** Buffers all four artifacts and writes only after every one is fetched and validated, so a mid-run failure cannot mix new and stale files. */
export async function refreshCatalogue(
  ports: CatalogueRefreshPorts,
): Promise<CatalogueRefreshOutcome> {
  const counter = createRequestCounter();
  const requests = (): number => counter.snapshot()['catalogue-refresh'];
  const client = createTradeClient({
    http: counter.counted(ports.http, 'catalogue-refresh'),
    clock: ports.clock,
    wait: ports.wait,
    userAgent: ports.userAgent,
    invalidRequestThreshold: INVALID_REQUEST_THRESHOLD,
  });

  const captured: { path: string; contents: string }[] = [];

  for (const endpoint of CATALOGUE_ENDPOINTS) {
    // eslint-disable-next-line no-await-in-loop -- sequential on purpose: one lane, requests pace against one ledger entry
    const body = await fetchBody(client, endpoint);
    if (!body.ok) {
      return refused(body.failure, requests());
    }
    const envelope = validateBody(endpoint, body.value);
    if (!envelope.ok) {
      return refused(envelope.failure, requests());
    }
    captured.push({
      path: catalogueFilePathOf(endpoint),
      contents: serialiseCatalogue(envelope.value),
    });
  }

  return writeCaptured(ports, captured, requests);
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

  process.exitCode = printRefreshOutcome(outcome, {
    stdout: (line) => process.stdout.write(`${line}\n`),
    stderr: (line) => process.stderr.write(`${line}\n`),
  });
}

/** Prints an outcome and answers the exit code; the request count shows on both arms (AD-12). */
export function printRefreshOutcome(
  outcome: CatalogueRefreshOutcome,
  out: { readonly stdout: (line: string) => void; readonly stderr: (line: string) => void },
): number {
  out.stdout(`requests: ${String(outcome.requests)}`);
  if (!outcome.ok) {
    out.stderr(`pnpm catalogue:refresh: ${outcome.failure}`);
    // The failure counts what landed; only this names which files.
    for (const path of outcome.written) {
      out.stderr(`  already written: ${path}`);
    }
    return 1;
  }

  for (const path of outcome.written) {
    out.stdout(`refreshed ${path}`);
  }
  return 0;
}

/** Entry guard: running this file runs `main`; importing it, as the test does, runs nothing. */
const entry = process.argv[1];
const isInvokedDirectly = entry !== undefined && nodePath.resolve(entry) === fileURLToPath(import.meta.url);

if (isInvokedDirectly) {
  try {
    await main();
  } catch (error) {
    process.stderr.write(`pnpm catalogue:refresh: ${String(error)}\n`);
    process.exitCode = 1;
  }
}
