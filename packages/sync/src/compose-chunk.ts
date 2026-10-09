/** The one chunk composition of the `pnpm sync*` commands; loads run under the lock (AD-7). */

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
import type { PacingState, TradeGovernor } from './trade/client.ts';
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
  /** Only the dry run passes one, to skip an entry with no recorded fixture (`dry-run.ts`). */
  readonly wrapStep?: (step: ChunkStep, context: StepContext) => ChunkStep;
  /** Session only (`./sync.ts`): the pacing memory a chunk's governor starts from (AD-8). */
  readonly pacing?: PacingState;
  /** The session only: pace with the even spread (`spreadBeforeNext`). */
  readonly spread?: boolean;
  /** Session only: the counter shared across chunks, so the report covers the pass. */
  readonly requests?: RequestCounter;
  /** The session only: the chunk's session options (`ChunkSession`). */
  readonly session?: ChunkSession;
  /** Live shells only: the process auth holder (AD-30), given to each governor. */
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

type ChunkGovernor = TradeGovernor<'league-validation' | 'tracked-list'>;

function createChunkGovernor(options: ComposeChunkPorts, requests: RequestCounter): ChunkGovernor {
  const { clock, http, wait, userAgent, log, pacing, spread, auth } = options;
  // A fresh governor per chunk: its invalid-request counts stay per chunk,
  // while a session's pacing memory carries across (AD-8).
  return createTradeGovernor({
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
    ...(pacing !== undefined && { pacing }),
    ...(spread !== undefined && { spread }),
    // The probe goes out on its own counted port, so the report's
    // `session-probe` figure is its one trace (AD-12, AD-30).
    ...(auth !== undefined && { auth: { holder: auth, probe: requests.counted(http, 'session-probe') } }),
  });
}

function createChunkLoad(options: ComposeChunkPorts, clients: ChunkGovernor['clients']): ChunkPorts['load'] {
  const { fs, clock, wrapStep } = options;
  return async ({ entries, dataset }) => {
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
  };
}

export function composeChunk(options: ComposeChunkPorts): ComposedChunk {
  const { fs, clock, git, pid, log, session, auth } = options;

  const requests = options.requests ?? createRequestCounter();
  const governor = createChunkGovernor(options, requests);

  const ports: ChunkPorts = {
    fs,
    clock,
    pid,
    git,
    requests,
    load: createChunkLoad(options, governor.clients),
    catalogue: () => loadCatalogueIds(fs),
    latchedRetryAfterMs: () => governor.latchedRetryAfterMs(),
    // The runner sees two narrow ports, never the holder: the run-start
    // hold-off settle and the pending hold-off action.
    ...(auth !== undefined && {
      auth: {
        settleHeldOffIfDue: (holdOffUntil, now) => {
          auth.settleHeldOffIfDue(holdOffUntil, now);
        },
        pendingHoldOff: () => auth.pendingHoldOff(),
        holdOffApplied: (action) => {
          auth.holdOffApplied(action);
        },
      },
    }),
    ...(log !== undefined && { log }),
    ...(session !== undefined && { session }),
  };

  return { ports, run: () => runChunk(ports) };
}
