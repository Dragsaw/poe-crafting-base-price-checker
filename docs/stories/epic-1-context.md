# Epic 1 Context: Foundations and the Background Sync

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Epic 1 builds the workspace and the whole background sync. It needs no page and no Weights File. The player schedules one command. That command keeps a git-tracked price dataset for the correct league up to date on its own. It paces itself so the tool keeps its trade-API access, and it continues from where a crash stopped it. It also publishes a Sync Report that says what the run did and what broke. The epic also delivers the four-package workspace on the pinned stack, the `contracts` schemas with their ports and fakes, CI enforcement of the one-way package graph, and a test path that cannot reach the network. The success condition: a developer produces a real dataset and a real Sync Report fully offline, against fixtures.

## Stories

- Story 1.1: The four-package workspace and the offline development loop
- Story 1.2: Contract schemas and ports for the curated workload and the published dataset
- Story 1.3: One governed trade client that paces itself from live headers
- Story 1.4: The committed Trade Catalogue and its explicit refresh command
- Story 1.5: One bounded, resumable, single-instance chunk
- Story 1.6: The deterministic Refresh Rotation
- Story 1.7: A Divine price estimate for one Tracked Entry
- Story 1.8: The published Dataset, written to a git-tracked working tree
- Story 1.9: The structured Sync Report, with requests accounted per source
- Story 1.10: Unresolvable ids, detected offline and reported
- Story 1.11: League validation as a run-start gate

## Requirements & Constraints

- This epic owns the acceptance of these requirements: declared request sources with per-source accounting (FR-14), Curation Status as schema behaviour (FR-15), a deterministic rotation (FR-17), a bounded, resumable chunk that only one instance runs at a time (FR-19), one trade client that adapts to the rate limit (FR-20), estimates from the cheapest instant-buyout listings (FR-21), conversion to Divine at the sync boundary (FR-23), ids that do not resolve reported and not skipped (FR-24), a structured Sync Report (FR-25), and league validation before the run spends budget (FR-32).
- It must also satisfy these cross-cutting requirements: no network in any test (NFR-1), real captured fixtures only (NFR-2), determinism with time passed in (NFR-3), disjoint packages (NFR-4), no component of the product writing a file that another component owns (NFR-5), refusal of an unknown schema major (NFR-8), and requests that identify the tool and pace from live headers (NFR-9).
- The no-network guard is the recording `onUnhandledRequest` callback in `test/setup.ts`, together with the global `afterEach`. Where a planning doc says `onUnhandledRequest: "error"`, that string fails no test. Do not use it (project AGENTS.md).

## Technical Decisions

- **Stack and graph.** Pin every version exactly to the spine's Stack table. Stay on TypeScript 6.0.3, because two peer ranges block version 7. The graph is `contracts` → `core` → `sync` / `web`, and it goes one way only. `dependency-cruiser` enforces it in `pnpm check` (AD-1). `contracts` changes land alone and first (`AGENT-WORKFLOW.md`).
- **Functional core and imperative shell.** Every effect has a `<Thing>Port` in `contracts` and a fake beside the real adapter. The effects are HTTP, the filesystem, a read-only git port and the clock. `core` is pure. It returns typed results and never throws for an expected condition (AD-1, Consistency Conventions).
- **Schemas.** Each schema exists once, in `contracts`. Every type is `z.infer`red from its schema, and every artifact carries `schemaVersion` (AD-3). The two discriminated unions, `ModifierRef` (`banded` or `valueless`) and `TrackedEntry` (`crafted` or `raw`), name their own kind. No component infers the kind. A canonical key carries its kind and compares by UTF-8 code unit (AD-5, `IMPLEMENTATION-NOTES.md` §4.1).
- **One governed client** sends every trade request. It learns the rules at runtime from the `X-Rate-Limit-*` headers and hardcodes no rate. It honours `Retry-After` and then yields the chunk (AD-8, `IMPLEMENTATION-NOTES.md` §5.3).
- **Three request sources and three run-start gates** (AD-12). An id that the committed catalogue does not carry is a per-entry `unresolvable` state, and the run continues (AD-9). A league mismatch aborts the run (AD-19). The cross-file gate is the third gate, and Epic 3 builds it. When `weights.json` is absent, `sync` skips that gate, records the absence and runs normally. An aborting run writes only `sync-report.json`. The derived-base-type check of the `jewel` arm runs per entry during the chunk. It is not a fourth gate (AD-25).
- **Chunk runner.** Each run does one bounded chunk under an atomic lock that can be recovered. Progress records only completed entries. The rotation is a pure function in `core` and is keyed on `lastAttemptedAt`. `minChunkSearches` is a yardstick and never a bound (AD-7, `IMPLEMENTATION-NOTES.md` §6, §7).
- **Pricing.** The search shape follows AD-16 and `IMPLEMENTATION-NOTES.md` §5.2. The crafted class discriminator follows §10. The estimate is the lower median (§4.3). Each listing converts to Divine once, from hand-maintained rates, and `sync` never fetches a rate (AD-20, §4.2). The four price states are separated by cause (AD-9).
- **Writers and git.** AD-3's table binds components. `sync` writes only the files it owns, by explicit path, and never runs a git write command. The player's push deploys. The dataset holds only the latest observation for each entry, stamped with its league, and a league change does not filter it (AD-19). Agents may edit the hand-edited inputs in `data/`, and must name each edit in their report. Agents never hand-edit or regenerate the files that a tool produces (`AGENT-WORKFLOW.md`, *Parallel worktrees*).
- **The report has two kinds of entry.** A figure is overwritten by the next chunk. A record stays until the player's edit clears it (Consistency Conventions, *Logging*).
- **File hygiene.** Files are UTF-8 without BOM, with LF line endings, stable key order and a trailing newline. Timestamps are ISO-8601 UTC. `sync` rounds divine values to 4 decimal places once (Consistency Conventions).

## Cross-Story Dependencies

- Stories 1.1 to 1.8 are done. Stories 1.9, 1.10 and 1.11 remain.
- Story 1.5 left three criteria to later stories, and each of those stories extends 1.5's criteria and does not rewrite them. Story 1.8 discharged the dataset assertion of `sync:dry`. Story 1.9 discharges the run-report assertion. Story 1.11 discharges the lock release on an abort by a run-start gate.
- Story 1.9's report receives the pinned-starvation record of Story 1.6, the `stale-lock-broken` record of Story 1.5, the failures of Story 1.10, and the abort record of Story 1.11. Story 1.9 should therefore land before 1.10 and 1.11.
- Story 1.10 validates against the four catalogue files that Story 1.4 committed, and feeds the `unresolvable` row of Story 1.6.
- `data/weights.json` is now committed (contract 6.0.0), but Story 1.10 covers only the case where the file is absent. Running the cross-file gate on a present file belongs to Story 3.3 (AD-17, AD-12).
- Downstream, Epic 2 reads `dataset.json` and `sync-report.json` as runtime artifacts (AD-24).
