/**
 * The one chunk composition `pnpm sync`, `pnpm sync:batch` and `pnpm sync:dry`
 * share (AD-7, AD-8, AD-12).
 *
 * From the shell's ports it builds **one governor** of two sibling trade
 * clients (`createTradeGovernor`) over one `HttpPort` counted twice — as
 * `league-validation` for the gate and `tracked-list` for the step — the
 * committed catalogue loader, and the runner's `load` hook. The shells differ
 * only in the ports they pass: the live commands a real filesystem, clock and
 * `fetch`; the dry run in-memory fakes and the recorded fixture port. Only
 * the `pnpm sync` session passes `pacing`, `spread`, `requests` and
 * `session`, so the batch and dry chunks are unchanged.
 *
 * **Every file load runs under the lock**, inside `runChunk`, after AD-8's
 * `notBefore` check. `load` reads `data/config.json`, evaluates
 * IMPLEMENTATION-NOTES.md §6's pinned-cap inequality over the tracked list
 * the runner loaded, reads `data/currencies.json` and the committed item
 * types, and builds the publication, the starvation record, the league gate
 * and the pricing step on the dataset the runner loaded. A refusal names its
 * file and is thrown before any request; the runner turns it into a
 * `run-failure`.
 */

import type { ClockPort, FilesystemPort, GitPort, HttpPort, LeagueId } from '@poe/contracts';

import { loadCatalogueIds } from './catalogue/catalogue-ids.ts';
import { runChunk, writeStderr } from './chunk/run-chunk.ts';
import type { ChunkOutcome, ChunkPorts, ChunkSession, ChunkStep } from './chunk/run-chunk.ts';
import { createLeagueGate } from './league/league-gate.ts';
import { loadConfig } from './load-config.ts';
import type { DataFileResult } from './load-data-file.ts';
import { checkPinnedCap, PinnedCapExceededError, pinnedStarvationRecord } from './pinned-cap.ts';
import { loadCurrencies } from './pricing/load-currencies.ts';
import { loadItemTypes } from './pricing/load-item-types.ts';
import { outputRates } from './pricing/normalise.ts';
import { createPricingStep } from './pricing/price-entry.ts';
import type { ItemTypes } from './pricing/search-body.ts';
import { createRequestCounter } from './request-counter.ts';
import type { RequestCounter } from './request-counter.ts';
import { createTradeGovernor } from './trade/client.ts';
import type { PacingState } from './trade/client.ts';
import type { SessionAuth } from './trade/session-auth.ts';
import { INVALID_REQUEST_THRESHOLD } from './trade/invalid-requests.ts';

export interface ComposeChunkPorts {
  readonly fs: FilesystemPort;
  readonly clock: ClockPort;
  /** The one port every trade request goes out on. */
  readonly http: HttpPort;
  /** Read-only: the tracked list's last commit author date. */
  readonly git: GitPort;
  readonly wait: (ms: number) => Promise<void>;
  /** The whole `User-Agent` header (NFR-9). */
  readonly userAgent: string;
  /** The process id written into the lock. */
  readonly pid: number;
  /** One line of operator output. Defaults to stderr inside `runChunk`. */
  readonly log?: (line: string) => void;
  /**
   * Wraps the pricing step the load builds. Only the dry run passes one, to
   * skip an entry whose search has no recorded fixture (`dry-run.ts`).
   */
  readonly wrapStep?: (step: ChunkStep, context: StepContext) => ChunkStep;
  /**
   * The `pnpm sync` session only (`./sync.ts`). The pacing memory every chunk
   * of the session shares: this chunk's fresh governor starts from it rather
   * than cold (AD-8). Omitted, the governor starts cold, as the batch and dry
   * compositions do.
   */
  readonly pacing?: PacingState;
  /** The session only: pace with the even spread (`spreadBeforeNext`). */
  readonly spread?: boolean;
  /**
   * The session only: the request counter every chunk of the session counts
   * through, so the report's figure can cover the pass. Omitted, the chunk
   * builds its own.
   */
  readonly requests?: RequestCounter;
  /** The session only: the chunk's session options (`ChunkSession`). */
  readonly session?: ChunkSession;
  /**
   * The live shells only (`./sync.ts`, `./sync-batch.ts`): the process auth
   * holder (AD-30). Each chunk's governor gets it, as it gets `pacing`, and
   * redacts every error it passes on through it.
   */
  readonly auth?: SessionAuth;
}

/** The load-time values the pricing step was built on. */
export interface StepContext {
  readonly league: LeagueId;
  readonly itemTypes: ItemTypes;
}

export interface ComposedChunk {
  /** The runner's ports, as composed. */
  readonly ports: ChunkPorts;
  /** Runs the chunk once. Throws what the chunk throws. */
  readonly run: () => Promise<ChunkOutcome>;
}

function valueOf<T>(loaded: DataFileResult<T>): T {
  if (!loaded.ok) {
    throw loaded.error;
  }
  return loaded.value;
}

export function composeChunk(options: ComposeChunkPorts): ComposedChunk {
  const { fs, clock, http, git, wait, userAgent, pid, log, wrapStep, pacing, spread, session, auth } = options;

  const requests = options.requests ?? createRequestCounter();
  // A fresh governor per chunk: its invalid-request counts stay per chunk,
  // while a session's pacing memory carries across (AD-8).
  const { clients } = createTradeGovernor({
    http: {
      'league-validation': requests.counted(http, 'league-validation'),
      'tracked-list': requests.counted(http, 'tracked-list'),
    },
    clock,
    wait,
    userAgent,
    invalidRequestThreshold: INVALID_REQUEST_THRESHOLD,
    // A 429's diagnostic line goes where the chunk's own lines go.
    log: log ?? writeStderr,
    ...(pacing === undefined ? {} : { pacing }),
    ...(spread === undefined ? {} : { spread }),
    ...(auth === undefined ? {} : { auth }),
  });

  const ports: ChunkPorts = {
    fs,
    clock,
    pid,
    git,
    requests,
    load: async ({ entries, dataset }) => {
      const config = valueOf(await loadConfig(fs));
      // Straight after the config, so a later refusal cannot hide an excess.
      const cap = checkPinnedCap(entries, config);
      if (!cap.ok) {
        throw new PinnedCapExceededError(cap.error);
      }
      const rates = valueOf(await loadCurrencies(fs));
      const itemTypes = valueOf(await loadItemTypes(fs));
      const { league } = config;
      const step = createPricingStep({
        client: clients['tracked-list'],
        league,
        rates,
        itemTypes,
        dataset,
        clock,
      });
      return {
        publication: { league, currencyRates: outputRates(rates) },
        starvationRecord: (starvation) => pinnedStarvationRecord(starvation, config),
        gate: createLeagueGate({ client: clients['league-validation'], league }),
        step: wrapStep === undefined ? step : wrapStep(step, { league, itemTypes }),
      };
    },
    catalogue: () => loadCatalogueIds(fs),
    ...(log === undefined ? {} : { log }),
    ...(session === undefined ? {} : { session }),
  };

  return { ports, run: () => runChunk(ports) };
}
