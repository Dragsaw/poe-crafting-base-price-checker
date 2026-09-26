---
title: 'Epic 1 retro items 6, 7, 1, 2, 3: one shared composition, and the AD-12 run-start and failure sequence'
type: 'refactor'
created: '2026-09-26'
status: 'done'
baseline_revision: '5e8285abf9ed076b87361b1f5aec5f38d127b117'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '{project-root}/docs/architecture/architecture-poe-crafting-base-price-checker-2026-09-12/ARCHITECTURE-SPINE.md'
  - '{project-root}/docs/architecture/architecture-poe-crafting-base-price-checker-2026-09-12/IMPLEMENTATION-NOTES.md'
warnings: [multiple-goals, oversized]
deferred:
  - summary: >-
      A league-gate throw that is not a mismatch (a 4xx such as a 404 on the leagues GET) now publishes the catalogue marks and progress; AD-12 may instead mean every gate abort writes the report alone.
    evidence: |-
      AD-12 says an aborting run writes sync-report.json alone and "The league gate does the same", but it names only the league mismatch and the cross-file failure as gate aborts, and rev 21 names only the mismatch as report-alone. The user's intent says "publish on every throw path", which selects publishing. Settled by a spine ruling on whether a gate 4xx is a gate abort (report alone, check records discarded) or an ordinary mid-run throw. The dataset label on that path is already the previously published league (gatePassed guard).
    location: >-
      packages/sync/src/chunk/run-chunk.ts (catch block, non-mismatch publish)
    severity: medium (unverified)
---

<intent-contract>

## Intent

**Problem:** `sync.ts` and `dry-run.ts` each hand-build the chunk composition and load config, rates, item types and the dataset before the lock, so the pricing step prices against a pre-lock dataset copy and `checkPinnedCap` is never called (D-1, L-A4, R-1). `runChunk` sends the league request before the offline catalogue check, a gate yield reports `notReachedCount: 0` with no marks published, and any throw other than `MalformedRequestError` drops the chunk's completions and marks (R-7, L-A3, R-3, L-A5).

**Approach:** In the user's order 6 → 7 → 1 → 2 → 3: one `composeChunk(ports)` used by both shells, whose loads run under the lock through a `load` hook and include the pinned-cap inequality; `runChunk` follows AD-12 rev 21's cost order exactly; a gate yield is an ordinary yielded chunk; every throw after the order exists publishes what the chunk has.

## Boundaries & Constraints

**Always:**
- The run-start sequence is AD-12's (`ARCHITECTURE-SPINE.md`, "The gates run in cost order"): lock → `notBefore` check → loads with their load-time validation (previous report, progress, tracked, dataset, the shell's `load` = config, rates, item types and IN §6's pinned-cap inequality, then the catalogue and weights files) → weights records and catalogue check → order → league gate → rotation.
- A gate yield publishes like a yielded chunk: dataset (marks only), progress (`notBefore` set after a 429, cleared otherwise), report with `runFinishedAt`; `notReachedCount` is the eligible count (AD-7).
- A league mismatch publishes nothing and its report carries this chunk's lock record and the `league-mismatch` record only; catalogue-check and weights records are discarded (AD-12).
- Any other throw once the order exists publishes the step entries so far and the marks (the malformed case also its failing entry and IN §5.3's abort `notBefore`; every other throw clears `notBefore`), then writes the report with a `run-failure`. A throw before the order exists writes the report only. A publish that was already attempted is never retried on the failure path.
- A pinned-cap excess is a load refusal: `run-failure` naming `data/tracked.json`, no request, no dataset or progress write.
- `pnpm sync:dry` on the committed inputs prints the same bytes as before this change.

**Never:**
- No `contracts` schema change and no new record kind or reason literal (the PRD owns reason strings).
- No change to lock, `notBefore` formulas, rotation, `pinnedToKeep`, record identity, the pricing step's behaviour, or the dry-run clock.
- No edit to planning documents; do not close the retro item 17 fetch-parse ledger entry (it needs an entry payload on `UnexpectedTradeResponseError`, out of scope).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Catalogue refusal | catalogue loader refuses | no league request, report `run-failure`, no dataset/progress | rethrown, lock released |
| Gate 429 | 1 id missing, 3 eligible | `yielded`; dataset has the mark; progress `notBefore` set; `notReachedCount: 3`; `unresolvable` record | exit 0 |
| Gate 5xx/timeout yield | as above | as above, progress without `notBefore` | exit 0 |
| League mismatch | 1 id missing | no dataset/progress write; report: `league-mismatch`, no `unresolvable` | rethrown, exit 1 |
| Step throws plain `Error` | 2 completed, 3rd throws, 1 mark | dataset has the 2 entries and the mark; progress has rotation keys, no `notBefore`; report `unresolvable-error` for the 3rd | rethrown |
| Normal-path dataset write fails | `writeArtifact` fault on dataset | exactly one dataset write attempt; report `run-failure` | rethrown |
| Pinned cap exceeded | pinned > 0.5 × `minChunkSearches` | no request; report `run-failure` whose message names `data/tracked.json` | exit 1 |
| Absent/invalid config or dataset | live shell | no request; report `run-failure` naming the file; dataset/progress untouched | exit 1 |

</intent-contract>

## Code Map

- `packages/sync/src/chunk/run-chunk.ts` -- `runChunk` (:392–754). Today: notBefore :411–450, report :455, tracked :578, gate :583–605, dataset :611, catalogue :617, weights :625, check :626–633, order :635, rotation :654, catch :720–750 (publishes only `MalformedRequestError && order`). `ChunkPorts` :195–233 holds `publication`, `starvationRecord`, `gate`; `failureRecord` :360; `writeReport` computes `eligible − attempted` :555–566. Header comment :1–74 describes the old order.
- `packages/sync/src/sync.ts` -- `runSync` :76–126, pre-lock loads :79–89, `valueOf` :68.
- `packages/sync/src/dry-run.ts` -- `dryRun` :204–289; its own config/rates/items loads :222–225 go; its dataset parse :226–231 stays (the clock only).
- `packages/sync/src/pinned-cap.ts` -- `checkPinnedCap` :32, message already names `data/tracked.json`; add a typed error carrying `PinnedCapExceeded`.
- `packages/sync/src/pricing/price-entry.ts` -- `createPricingStep` :261 takes `dataset` at creation; build it inside `load` from the under-lock dataset. Read-only otherwise.
- `packages/sync/src/index.ts` -- :97–98 exports pinned-cap; check its `run-chunk` type exports after the `ChunkPorts` change.
- `packages/sync/src/chunk/run-chunk.test.ts` -- 121 `runChunk(ports, step)` calls; `shellPorts` :106, `harness` :124. Gate tests (grep `gate:`, 8 sites) and failure-path tests assert the old order.
- `packages/sync/src/sync.test.ts` -- :232 absent-config test expects no writes; :242 gate-429 test pins the old yield shape; :365 invalid-dataset test expects no `run-failure`.
- `packages/sync/src/dry-run.test.ts` -- byte-for-byte reference test must pass unchanged.
- `docs/stories/deferred-work.md` -- story 1.11 pinned-cap entry (~:86) is closed here; story 1.7's step-throw deferral (`spec-1-7…md:10,135`) was never appended.

## Tasks & Acceptance

**Execution:**
- `packages/sync/src/chunk/run-chunk.ts` -- replace `publication`/`starvationRecord`/`gate` on `ChunkPorts` with a required `load: (context: { entries; dataset }) => Promise<ChunkSetup>` where `ChunkSetup = { publication; starvationRecord; gate?; step }`; `runChunk(ports)` takes the step from the setup. Reorder to the Always sequence; gate yield via `publish([], until)`; catch per Always (mismatch excluded, `publishAttempted` guard); rewrite the header comment. -- items 1, 2, 3.
- `packages/sync/src/pinned-cap.ts` -- add `PinnedCapExceededError` (message = the result's message, payload kept). -- item 7.
- `packages/sync/src/compose-chunk.ts` (new) -- `composeChunk({ fs, clock, http, git, wait, userAgent, pid, log? })`: request counter counting `http` twice, `createTradeClients` with `INVALID_REQUEST_THRESHOLD`, catalogue loader, and a `load` that loads config, rates, item types, throws `PinnedCapExceededError` on excess, and builds publication, starvation record, league gate and pricing step on the passed dataset. -- items 6, 7.
- `packages/sync/src/sync.ts`, `packages/sync/src/dry-run.ts` -- call `composeChunk`; drop the duplicated composition and pre-lock loads; dry run passes its fixture port, a no-op `wait`, its user agent and pid; update header comments. -- item 6.
- `packages/sync/src/index.ts` -- export `composeChunk` and its ports type; keep exports compiling. -- item 6.
- `packages/sync/src/chunk/run-chunk.test.ts` -- add a local `run(ports, step)` adapter building `load` from `publication`/`starvationRecord`/`gate` overrides and swap call sites mechanically; update the tests that assert the old order; add one test per matrix row that is runner-level, plus a recorded event-order test (dataset read → load → catalogue → gate → step). -- risk is concentrated here; change assertions only where the ruled behaviour changed.
- `packages/sync/src/sync.test.ts`, `packages/sync/src/pinned-cap.test.ts` -- update :232, :242, :365; add the pinned-cap and the gate-yield-marks cases through `syncCommand`; unit-test the error class. -- shell-level ACs.
- `docs/stories/deferred-work.md` -- append the story 1.7 step-throw deferral and a "Resolved by epic 1 retro items 1, 2, 3, 6, 7" note naming it and the 1.11 pinned-cap entry as closed, without removing either. -- item 3, ledger rule.

**Acceptance Criteria:**
- Given `pnpm sync` over a tracked list with one uncatalogued id and a leagues GET answering 429, when it runs, then it exits 0, `data/dataset.json` carries that entry marked `unresolvable`, and the report's `notReachedCount` equals the entries the order made eligible.
- Given `pnpm sync` with more pinned entries than `0.5 × minChunkSearches`, when it runs, then it exits 1 having sent no request, and the report's `run-failure` message names `data/tracked.json`.
- Given `sync.ts` and `dry-run.ts`, when searched, then neither calls `createTradeClients`, `createPricingStep`, `createLeagueGate` or `runChunk` directly; both call `composeChunk`.
- Given a catalogue refusal, when the chunk runs, then the league gate is never called.

## Spec Change Log

## Review Triage Log

### 2026-09-26 — Review pass
- verdicts: 24 findings — high 0, medium 5, low 9, false 9, maybe-false 1
- findings:
  - `[medium]` `[patch]` (blind) A gate yield or non-mismatch gate throw publishes the dataset under the configured league the gate never confirmed — fixed: `gatePassed` flag; until the gate passes, `publish` keeps `dataset?.league ?? publication.league`; new runner test "gate 429 over a previous dataset labelled Old League keeps Old League".
  - `[low]` `[reject]` (blind) The dry-run test's shared CONFIG moved `minChunkSearches` 1 → 2 without a spec record — the change is forced by the ruled cap (one pinned entry > 0.5 × 1); the byte check on the committed inputs is unchanged; the fix is a spec edit. The committed `data/config.json` has no pinned entries today (residual risk below).
  - `[low]` `[patch]` (blind) The appended story 1.7 ledger entry named `MalformedRequestError`, which the baseline already published on — fixed: removed from the summary.
  - `[low]` `[reject]` (blind) The runner pinned-cap test builds its message by hand — the real `checkPinnedCap` message is asserted through `syncCommand` in `sync.test.ts`; the runner test checks propagation only.
  - `[false]` `[reject]` (blind) No test shows the step is built on the under-lock dataset — `sync.test.ts` "a priced entry whose search answers 429 keeps its price in the written dataset" needs the step to hold the published entry, and the only dataset read is now the one under the lock.
  - `[medium]` `[patch]` (blind) The cost-order test omits the progress, tracked and weights reads — grouped with the verification-gap finding below; fixed: the test records progress, tracked, dataset, load, catalogue, weights, gate, step.
  - `[low]` `[reject]` (blind) No mismatch test with a `weights-absent` record — the mismatch report is built as `[...records, failure]`, which drops every check record on one line the `unresolvable` mismatch test already covers.
  - `[low]` `[reject]` (blind) AC "neither shell calls the composition primitives" has no mechanical check — verified by reading both files; a source-scan test adds infrastructure for a condition no everyday change meets.
  - `[low]` `[reject]` (blind) `ChunkSetup.gate` is optional — only `composeChunk` builds a setup and it always supplies the gate; tightening it changes the test adapter for no user-facing effect.
  - `[false]` `[reject]` (blind) `ComposedChunk.ports` is unnecessary — no harm named; an exposed, correct port record causes no divergence.
  - `[low]` `[patch]` (blind) Two edited header-comment lines overrun the block width — fixed: rewrapped in `sync.ts`, `league-gate.ts` (and two in `compose-chunk.ts`).
  - `[low]` `[reject]` (blind) The spec's change log is empty and its Verification wording is confusing — the fix edits this build's spec.
  - `[low]` `[patch]` (blind) A pinned-cap excess is hidden by a later currencies or item-types refusal — fixed: `checkPinnedCap` runs right after `loadConfig`.
  - `[false]` `[reject]` (blind) A gate yield may wipe the stored pass — `chunkOrder` returns `completed: []` exactly when a new pass starts (`core/chunk-order.ts:122`), so the next run computes the same empty pass from the old file; the step-yield path already writes it this way.
  - `[medium]` `[patch]` (edge) Gate yield publishes an unverified league label — same root as the first row; same fix.
  - `[medium]` `[patch]` (edge) A non-mismatch gate throw republishes under the unconfirmed league — same root as the first row; same fix.
  - `[false]` `[reject]` (intent) No cross-file gate step in the sequence — no cross-file gate exists in `sync` yet (`catalogue/weights-ids.ts` header), so there is no step to order.
  - `[maybe-false]` `[defer]` (intent) A gate 4xx publishes marks, where AD-12's "The league gate does the same" may mean report alone — the spine names only mismatch and cross-file failure as gate aborts; settled by a spine ruling; recorded in `deferred`.
  - `[false]` `[reject]` (intent) Loads under the lock now write a failure report on an absent config or bad dataset — this is AD-12 rev 21's order and runChunk's throw rule, and it closes retro L-A4's "the only load fault the report never shows".
  - `[false]` `[reject]` (intent) Item 6's under-lock dataset has no shell-level evidence — see the fifth row.
  - `[false]` `[reject]` (intent) Item 7 reuses `run-failure` — the Never list forbids a new record kind or reason literal (the PRD owns reason strings); IN §6 calls it a `tracked.json` validation error, reported like any other.
  - `[false]` `[reject]` (intent) A mismatch report's `notReachedCount` is the eligible count — AD-7's definition; AD-12 discards marks and records, not figures.
  - `[false]` `[reject]` (intent) The `publishAttempted` guard is unstated in the intent — it is in the spec's Always list and covered by the "attempted once" test.
  - `[medium]` `[patch]` (verification-gap) Nothing asserts `load` is never called on a busy or deferred run — fixed: both tests pass a counting `load` and assert 0 calls; grouped with the cost-order row.

## Design Notes

- **Why a `load` hook, not a pre-lock shell load.** AD-12 puts every file load after the `notBefore` check, and IN §5.3 says the check comes "before it loads anything else". The step and gate need config values, so they are built in `load` and returned; the runner never reads config.
- **Record order stays** `unresolvable`, then weights records. Both checks are offline and neither aborts, so AD-12's steps 3 and 4 differ observably only in record order, and the report keeps the order it already prints.
- **A mismatch's `notReachedCount`** is the eligible count by the same AD-7 definition; the ruling discards marks and records, not figures.
- **Test adapter:**
  ```ts
  function run(ports: TestPorts, step: ChunkStep): Promise<ChunkOutcome> {
    const { publication = PUBLICATION, starvationRecord = DEFAULT_STARVATION, gate, ...base } = ports;
    return runChunk({ ...base, load: () => Promise.resolve({ publication, starvationRecord, step, ...(gate ? { gate } : {}) }) });
  }
  ```

## Verification

**Commands:**
- `pnpm check` -- expected: tsc, eslint (0 warnings) and depcruise pass.
- `pnpm test` -- expected: all files pass.
- `node packages/sync/src/dry-run.ts` -- expected: exit 0; stdout byte-identical to the baseline captured on `3add4e6`'s successor `5e8285a` before any change, saved as `dry-before.json` in the session scratchpad.

## Auto Run Result

Status: done

**Summary.** Retro items 6 → 7 → 1 → 2 → 3 as one change. `pnpm sync` and `pnpm sync:dry` share one `composeChunk`; every file load runs under the lock after the `notBefore` check through a required `ChunkPorts.load` hook, which loads config, rates and item types, evaluates the pinned-cap inequality and builds the publication, starvation record, league gate and pricing step on the dataset read under the lock. `runChunk` follows AD-12 rev 21's cost order with the league gate last. A gate yield publishes the catalogue marks and reports the eligible count as `notReachedCount`. Every throw once the order exists publishes the step entries and marks, except a league mismatch, which writes the report alone with only the lock record and the mismatch.

**Files changed.**
- `packages/sync/src/compose-chunk.ts` (new) — the shared composition and its under-lock `load`.
- `packages/sync/src/chunk/run-chunk.ts` — `load` hook replaces `publication`/`starvationRecord`/`gate` and the step argument; AD-12 order; gate-yield publish; failure-path publish with `publishAttempted` guard; league label kept until the gate passes; header rewritten.
- `packages/sync/src/pinned-cap.ts` — `PinnedCapExceededError`.
- `packages/sync/src/sync.ts`, `packages/sync/src/dry-run.ts` — call `composeChunk`; duplicated composition and pre-lock loads removed.
- `packages/sync/src/index.ts`, `packages/sync/src/league/league-gate.ts` — exports; comment.
- `packages/sync/src/chunk/run-chunk.test.ts` — `run(ports, step)` adapter over 121 call sites; ruled-behaviour assertions updated; sequence, failure-path and league-label tests added.
- `packages/sync/src/sync.test.ts`, `packages/sync/src/dry-run.test.ts`, `packages/sync/src/pinned-cap.test.ts` — shell-level cases; fixture yardstick 2.
- `docs/stories/deferred-work.md` — story 1.7 step-throw entry appended; a note closing it and the 1.11 pinned-cap entry.

**Review.** 24 findings. Patched: 5 medium rows in 2 entries (league label on unconfirmed publishes; load never called on busy/deferred plus full cost-order recording), 3 low (pinned cap checked right after config, ledger wording, comment wrap). Deferred: 1 (gate 4xx publish vs report-alone, maybe-false, medium if true). Rejected: 6 low and 9 false, each with its reason in the triage log.

**Follow-up review recommended: true.** Two medium entries were patched on this first pass. The named unverified risk: the `gatePassed` league-label rule and the gate-4xx publish both rest on a reading of AD-12 the spine does not state, so a reviewer with the spine owner should confirm the dataset label and write set on every gate ending.

**Verification.** `pnpm check` pass (tsc, eslint 0 warnings, depcruise 137 modules clean). `pnpm test` 57 files, 671 tests passed. `node packages/sync/src/dry-run.ts` exit 0, stdout byte-identical to the pre-change baseline.

**Residual risks.**
- The committed `data/config.json` has `minChunkSearches: 1`, so the load-time cap (`count(pinned) ≤ 0.5 × minChunkSearches`) refuses the first pinned entry the player adds: exit 1 with a `run-failure` naming `data/tracked.json`. Correct per IN §6; the player should raise the yardstick before pinning.
- An absent config or an unreadable dataset now writes `sync-report.json` with a `run-failure` (previously nothing was written).
- The retro item 17 ledger entry (`UnexpectedTradeResponseError` carries no entry payload) stays open.
