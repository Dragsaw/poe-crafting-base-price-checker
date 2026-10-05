import { canonicalKey, DatasetFileSchema, parseEnvelope } from '@poe/contracts';
import { chunkOrder, poolCoverage } from '@poe/core';
import type { ChunkOrder } from '@poe/core';

import type { CatalogueIds } from '../../catalogue/catalogue-ids.ts';
import { checkWeightsIds, readWeightsIds, weightsAbsentRecord } from '../../catalogue/weights-ids.ts';
import { explainTrackedVersion, parseTrackedFile } from '../../load-data-file.ts';
import { checkCatalogue } from '../catalogue-check.ts';
import { crossFileGate } from '../cross-file-gate.ts';
import type { ChunkSetup, GateResult } from '../run-chunk.ts';
import { DATASET_PATH, TRACKED_PATH } from './data-paths.ts';
import { loadEnvelope } from './load-envelope.ts';
import type { RunState } from './run-state.ts';

type CatalogueCheck = ReturnType<typeof checkCatalogue>;
type GateYield = Extract<GateResult, { kind: 'yield' }>;

/** The tracked list, dataset, shell `load` and committed catalogue, in AD-12's cost order. */
export async function loadRunInputs(state: RunState): Promise<{ ready: ChunkSetup; ids: CatalogueIds }> {
  const { fs } = state.ports;
  const tracked = await loadEnvelope(fs, TRACKED_PATH, parseTrackedFile, explainTrackedVersion);
  state.entries = tracked?.entries ?? [];
  // Absent means every entry is never attempted.
  state.dataset = await loadEnvelope(fs, DATASET_PATH, (data) => parseEnvelope(DatasetFileSchema, data));
  // The step and the gate need config values, so the shell builds them here, on the dataset loaded
  // under this lock.
  const ready = await state.ports.load({ entries: state.entries, dataset: state.dataset?.entries ?? [] });
  state.setup = ready;
  const catalogue = await state.ports.catalogue();
  if (!catalogue.ok) {
    throw catalogue.error;
  }
  return { ready, ids: catalogue.value };
}

/** The offline checks (AD-9, AD-25) and cross-file gate (AD-17): a failure throws pre-order. */
export async function checkRunStart(state: RunState, ids: CatalogueIds): Promise<CatalogueCheck> {
  const { entries } = state;
  // An absent file is recorded and the run goes on (AD-12); a present one has its ids checked,
  // report-only (AD-9).
  const weights = await readWeightsIds(state.ports.fs);
  state.coverageFigures = (weights.kind === 'present' ? poolCoverage(entries, weights.file) : undefined) ?? {};
  const check = checkCatalogue(entries, state.dataset?.entries ?? [], ids);
  state.marked = check.marked;
  state.checkRecords.push(
    ...check.records,
    ...(weights.kind === 'absent' ? [weightsAbsentRecord(entries)] : checkWeightsIds(weights, ids)),
  );
  crossFileGate(entries, weights.kind === 'present' ? weights.file : undefined);
  return check;
}

export function planOrder(state: RunState, check: CatalogueCheck): ChunkOrder {
  const { ports, entries } = state;
  const plan = chunkOrder({
    tracked: entries.filter((entry) => !check.excludedKeys.has(canonicalKey(entry))),
    dataset: check.orderDataset,
    completed: state.progress?.completed ?? [],
    now: ports.clock.now(),
    ...(ports.session?.pinnedMaxAgeMs !== undefined && { pinnedMaxAgeMs: ports.session.pinnedMaxAgeMs }),
  });
  state.order = plan;
  return plan;
}

/** The league gate, the one run-start check that costs a request (AD-12); a session may skip it. */
export async function runLeagueGate(
  state: RunState,
  ready: ChunkSetup,
  plan: ChunkOrder,
): Promise<GateYield | undefined> {
  const confirmed = state.ports.session?.confirmedLeague;
  const isAlreadyConfirmed = confirmed !== undefined && !plan.newPass && confirmed === ready.publication.league;
  const gated =
    isAlreadyConfirmed || ready.gate === undefined ? undefined : await ready.gate({ entries: state.entries });
  return gated?.kind === 'yield' ? gated : undefined;
}
