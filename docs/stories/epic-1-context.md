# Epic 1 Context: Foundations and the Background Sync

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Epic 1 delivers the workspace substrate and the whole background sync, with no page and no weights file involved. The player installs one scheduled command; that command keeps a committed, league-correct price dataset up to date on its own, paces itself so the tool never loses trade-API access, resumes where a crash left it, and publishes a Sync Report saying what the run did and what broke. It ships the four-package pnpm workspace on the spine's pinned stack, all eleven `contracts` Zod schemas with their ports and fakes, CI enforcement of the one-way dependency graph, and a zero-network test path — so the entire loop runs offline against fixtures before any UI exists. Because nothing here reads the Weights File, the epic completes in full ahead of that external dependency.

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

Owned FRs (acceptance lives with these): FR-14 declared request sources and per-source accounting; FR-15 Curation Status as schema-level behaviour; FR-17 deterministic Refresh Rotation; FR-19 bounded, resumable, single-instance chunk runner; FR-20 the one rate-limit-adaptive trade client; FR-21 price estimation from the cheapest instant-buyout listings; FR-23 Divine normalisation at the sync boundary; FR-24 unresolvable ids detected and reported; FR-25 the structured Sync Report; FR-32 league validation before the run spends budget.

Cross-cutting requirements this epic must satisfy: NFR-1 zero network in the test path (an unfixtured request fails loudly); NFR-2 fixtures are real captured responses, re-recorded only by an explicit human command; NFR-3 determinism — valuation is pure and time, randomness and configuration enter only as passed-in values; NFR-4 packages own disjoint directories with a one-way graph CI enforces; NFR-5 one writer per file; NFR-8 schema versioning at every trust boundary, with a consumer refusing an unknown major; NFR-9 third-party citizenship — requests identify the tool and a contact address, pace from live rate-limit headers and honour `Retry-After`.

Success condition: a developer can produce a real dataset and a real Sync Report entirely offline, before any page exists.

## Technical Decisions

- **Greenfield, no generator.** Scaffold directly from the spine's declared stack: Node 24.21.0, TypeScript 6.0.3, pnpm 12.5.1, React 19.3.0, Vite 8.3.0, Mantine 9.6.1, Zod 4.6.5, Vitest 5.0.1, MSW 2.15.0, ESLint 10.11.0 with typescript-eslint 8.70.0, dependency-cruiser 18.4.0. Two peer ranges block TypeScript 7 — do not upgrade, and do not use a shim to appear upgraded.
- **Four packages, one-way graph.** `contracts` (imports nothing) → `core` → `sync` / `web`. `sync` and `web` never import each other. `dependency-cruiser` fails `pnpm check` on a violation; review does not carry that job. `contracts` lands alone and first; dependent work rebases onto it.
- **Functional core, imperative shell, ports and adapters.** `contracts` declares every external effect (HTTP, filesystem, git, clock) as a `<Thing>Port` interface. Only `sync` or `web` implements one as an adapter, and every port ships a fake beside the real adapter.
- **Eleven Zod schemas live once in `contracts`**, every type `z.infer`red, every artifact carrying `schemaVersion`. Epic 1 needs `BaseType`, `ItemClass`, `ModifierRef`, `TrackedEntry`, `PriceObservation`, `CurrencyRate`, `TradeCatalogue`, `SyncRunReport`.
- **Two discriminated unions are the likeliest to be built wrong.** `ModifierRef` is `banded` (always both edges) or `valueless` (no edges, never sentinels). `TrackedEntry` is `crafted` (keys on categoryId, className, itemLevelMin, prefix?, suffix?) or `raw` (keys on baseTypeId, itemLevelMin). The entry names its own kind; no component infers a kind from what an entry omits.
- **Exactly one governed HTTP client** issues every trade request — searches, fetches and catalogue refreshes alike. It learns rule names from live `X-Rate-Limit-*` headers, hardcodes no rate, names no rule in code, and paces against the tightest unsatisfied bucket.
- **Three request sources only:** `data/tracked.json`, the per-run league validation, and the explicit catalogue refresh. `sync` reads `data/currencies.json` and never fetches against it. A fourth source needs an amendment.
- **The chunk runner** performs one bounded chunk and exits, under an exclusive recoverable on-disk lock carrying pid and ISO-8601 start time, writing progress to a schema-pinned `sync-progress.json` and computing its selection order through `core`.
- **One writer per file.** The player owns `tracked.json`, `config.json`, `currencies.json`, `recipes.json`; the external producer owns `weights.json`; `sync` owns `catalogue/*.json`, `dataset.json`, `sync-report.json`, `sync-progress.json`.
- **No git write path.** `sync` writes its own files by explicit path and performs no `add`, `commit`, `push` or `pull`. The files are git-tracked; the player commits and pushes them, and that push deploys. The git port is read-only: one operation, the author date of the last commit touching a path (AD-3, AD-12).
- **The trade catalogue is four committed artifacts** under `data/catalogue/`, refreshed only by an explicit command at GGG patch cadence, never on the chunk path. It is an identity and validation authority only and contributes nothing to any Eligible Pool.
- **Currency rates are hand-maintained committed data.** `sync` copies each rate's own `league` and `asOf` through unchanged and always writes divine's rate as exactly `1`.
- **Sync report structure:** `SyncRunReport` types apart a *figure* (describes the latest chunk, overwritten next chunk) from a *record* (survives the chunk that wrote it; only the player's edit clears it).
- **Consistency conventions that bind:** entity keys serialise in field order and compare by UTF-8 code unit, never locale collation; all persisted data carries ISO-8601 UTC; band edges are `number`, compared for exact equality; `sync` rounds every persisted divine value to 4dp once and `core` never re-rounds; files are UTF-8 without BOM, LF, stable JSON key order, trailing newline; `core` returns a typed result and never throws for an expected condition.
- **Source tree:** `packages/{contracts,core,sync,web}`, player and sync data under `data/`, recorded responses under `fixtures/`, deploy workflow under `.github/workflows/`.
- **Agent loop / definition of done:** `pnpm install`, `pnpm check`, `pnpm test`, `pnpm dev`, `pnpm sync:dry`. `pnpm check` enforces package boundaries; `pnpm sync:dry` runs the full pipeline against fixtures and writes nowhere. `fixtures:record` and `catalogue:refresh` are explicit, human-invoked, and never part of a test run.

## Cross-Story Dependencies

- Story 1.2 (`contracts`) gates everything else; it lands alone and first, and the rest rebases onto it. Story 1.1's workspace is the precondition for 1.2.
- Story 1.3's governed client is the sole request path, so Stories 1.4, 1.7 and 1.11 all issue their requests through it.
- Story 1.4's committed catalogue is the authority Story 1.10 validates ids against, offline, before any request.
- Story 1.5 establishes the chunk command and lock-release path; three of its criteria are deliberately asserted against a partial pipeline and are discharged later — the dataset by Story 1.8, the run report by Story 1.9, and the run-start-gate abort by Story 1.11. Those stories extend 1.5's criteria rather than rewriting them.
- Story 1.6's rotation is a pure `core` function the chunk runner calls; its pinned-starvation outcome surfaces as a record in Story 1.9's report.
- Story 1.7's observations are what Story 1.8 publishes into `dataset.json`.
- Downstream: Epic 2 consumes the published `dataset.json` and `sync-report.json` as runtime artifacts. Nothing in Epic 1 reads `weights.json` — that dependency belongs to Epic 3, and Story 1.10 requires a run to proceed normally with the file absent.
