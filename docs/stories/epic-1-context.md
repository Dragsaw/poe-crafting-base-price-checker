# Epic 1 Context: Foundations and the Background Sync

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Epic 1 builds the workspace and the whole background sync. It needs no page and it does not depend on a Weights File. The player schedules one command. That command keeps a git-tracked price dataset for the correct league up to date on its own. It paces itself so the tool keeps its trade-API access, and it continues from where a crash stopped it. It also publishes a Sync Report that says what the run did and what broke. The epic also delivers the four-package workspace on the pinned stack, the `contracts` schemas with their ports and fakes, CI enforcement of the one-way package graph, and a test path that cannot reach the network. The success condition: a developer produces a real dataset and a real Sync Report fully offline, against fixtures.

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
- It must also satisfy these cross-cutting requirements: no network in any test (NFR-1), real captured fixtures only (NFR-2), determinism with time passed in (NFR-3), disjoint packages (NFR-4), no component writing a file that another component owns (NFR-5), refusal of an unknown schema major (NFR-8), and requests that identify the tool and pace from live headers (NFR-9).
- A patched-out modifier must never keep ranking on its last-good price. An entry with an id that does not resolve is marked, reported and shown. It is never skipped, defaulted or left at its old value (FR-24).
- The no-network guard is the recording `onUnhandledRequest` callback in `test/setup.ts`, together with the global `afterEach`. Where a planning doc says `onUnhandledRequest: "error"`, that string fails no test. Do not use it (project AGENTS.md).

## Technical Decisions

- **Stack and graph.** Pin every version exactly to the Stack table of the spine. Stay on TypeScript 6.0.3. The graph is `contracts` → `core` → `sync` / `web`, and it goes one way only. `dependency-cruiser` enforces it in `pnpm check` (AD-1). A `contracts` change lands alone and first, in its own commit (`AGENT-WORKFLOW.md`).
- **Functional core and imperative shell.** Every effect has a `<Thing>Port` in `contracts` and a fake beside the real adapter. The effects are HTTP, the filesystem, a read-only git port and the clock. `core` is pure. It returns typed results and never throws for an expected condition, such as an unresolvable stat (AD-1, Consistency Conventions *Error shape*).
- **Schemas.** Each schema exists once, in `contracts`. Every type is `z.infer`red from its schema, and every artifact carries `schemaVersion` (AD-3). `ModifierRef` and `TrackedEntry` are discriminated unions that name their own kind. A canonical key carries its kind and compares by UTF-8 code unit (AD-5, `IMPLEMENTATION-NOTES.md` §4.1).
- **One governed client** sends every trade request. It learns the rules from the `X-Rate-Limit-*` headers and hardcodes no rate. It honours `Retry-After` and then yields the chunk (AD-8, §5.3).
- **Three request sources and three run-start gates** (AD-12). The gates differ in consequence:
  - *Catalogue check (AD-9, AD-25).* Every `statId`, `baseTypeId` and `categoryId` in `data/tracked.json` is looked up in the committed `data/catalogue/` files before any request. `stats.json` is grouped by category, so flatten it before the lookup. A miss is a per-entry `unresolvable` state plus a report record, and the run continues. The check is offline and costs no request, so it never stamps `lastAttemptedAt`. It is validation, never inference from results. An empty search result is `no-listings`, never `unresolvable`.
  - *`className` is not checked by the catalogue.* No endpoint carries a class axis. While `weights.json` is absent, `className` is uncheckable, and `sync` reports it as uncheckable, not as clean (AD-25).
  - *Cross-file gate.* Epic 3 builds it (Story 3.3, AD-17). When `weights.json` is absent, `sync` skips the gate, records the absence and runs normally. A present file that fails aborts the run. Pricing never needs the weights file.
  - *League gate (AD-19).* A mismatch aborts the run. An aborting run writes only `sync-report.json` and leaves `dataset.json` and `sync-progress.json` untouched.
  - The `jewel` arm derives a base type from `className` (§10). `sync` checks that base type against `items.json` per entry, during the chunk, just before it builds the search. This is not a fourth gate. A miss marks that entry `unresolvable`, records its canonical key, and issues no search, and the chunk continues (AD-25).
- **Weights ids against the catalogue (AD-9).** `sync` also checks the `statId` and `categoryId` values in a present `weights.json` against the catalogue. A miss goes into the report only. The file is never rewritten or refused. A weights line with `statId: null` is skipped, not failed.
- **Rotation and recovery (AD-7).** The rotation is a pure `core` function keyed on `lastAttemptedAt`. An `unresolvable` entry is retried only in row 3, at most once per 24 h. An id that resolves again leaves `unresolvable` at once and rejoins row 2 without waiting for a retry slot. The run-start catalogue check is what observes the recovery. Each chunk is bounded and runs under an atomic, recoverable lock. Progress records only completed entries (§6, §7).
- **Pricing.** The search shape follows AD-16 and §5.2, and the class discriminator follows §10. The estimate is the lower median (§4.3). Each listing converts to Divine once, from hand-maintained rates, and `sync` never fetches a rate (AD-20, §4.2). The four price states are separated by cause. A non-429 4xx aborts the run and writes a record (AD-9).
- **The report has two kinds of entry.** A figure describes the latest chunk, and the next chunk overwrites it. A record, such as an `unresolvable` entry, stays until the player's edit clears it. The next run never clears it (Consistency Conventions *Logging*).
- **Writers and git.** AD-3's table binds components. `sync` writes only the files it owns, by explicit path, and never runs a git write command. The dataset holds only the latest observation for each entry, stamped with its league (AD-19). Agents never hand-edit or regenerate files that a tool produces, and must name in their report any edit they make to the hand-edited inputs in `data/` (`AGENT-WORKFLOW.md`).
- **File hygiene.** Files are UTF-8 without BOM, with LF line endings, stable key order and a trailing newline. Timestamps are ISO-8601 UTC. `sync` rounds Divine values to 4 decimal places once (Consistency Conventions).

## Cross-Story Dependencies

- Story 1.5 left three criteria to later stories. Each later story extends 1.5's criteria and does not rewrite them. Story 1.8 covers the dataset assertion of `sync:dry`. Story 1.9 covers the run-report assertion. Story 1.11 covers the lock release when a run-start gate aborts the run.
- Story 1.10 reads the four catalogue files that Story 1.4's command produced. They are now committed under `data/catalogue/`. It writes into the `unresolvable` price state, which Story 1.6's row 3 consumes. It adds its records to the Sync Report that Story 1.9 built. Story 1.9 left the weights-absence record and the uncatalogued-weights record to Story 1.10.
- `data/weights.json` is now committed (contract 6.0.0). Story 1.10 still handles the absent case. The five cross-file checks on a present file belong to Story 3.3.
- Story 1.11 adds the league gate and the live `pnpm sync` with the real git adapter.
- Downstream, Epic 2 reads `dataset.json` and `sync-report.json` as runtime artifacts, and it must show `unresolvable` entries and their count, not only omit them (AD-24, FR-9, FR-25).
