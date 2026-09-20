# Epic 1 Context: Foundations and the Background Sync

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Epic 1 delivers the workspace substrate and the whole background sync, with no page and no weights file involved. The player installs one scheduled command; that command keeps a git-tracked, league-correct price dataset up to date on its own, paces itself so the tool never loses trade-API access, resumes where a crash left it, and publishes a Sync Report saying what the run did and what broke. It ships the four-package pnpm workspace on the pinned stack, the `contracts` Zod schemas with their ports and fakes, CI enforcement of the one-way dependency graph, and a zero-network test path — so the entire loop runs offline against fixtures before any UI exists. Because nothing here reads the Weights File, the epic completes in full ahead of that external dependency.

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

Owned functional requirements (acceptance lives with this epic): declared request sources with per-source accounting (FR-14); Curation Status as schema-level behaviour in the workload (FR-15); the deterministic Refresh Rotation (FR-17); the bounded, resumable, single-instance chunk runner (FR-19); the one rate-limit-adaptive trade client (FR-20); price estimation from the cheapest live instant-buyout listings (FR-21); Divine normalisation at the sync boundary (FR-23); unresolvable ids detected and reported (FR-24); the structured Sync Report (FR-25); league validation before the run spends budget (FR-32).

Cross-cutting requirements this epic must satisfy: zero network in the test path, where an unfixtured request fails loudly (NFR-1); fixtures are real captured responses, re-recorded only by an explicit human command (NFR-2); determinism — valuation is pure, and time, randomness and configuration enter only as passed-in values (NFR-3); packages own disjoint directories with a one-way graph CI enforces (NFR-4); one writer per file, so an agent needing different data uses a fixture rather than an edit (NFR-5); schema versioning at every trust boundary, with a consumer refusing an unknown major rather than guessing (NFR-8); third-party citizenship — requests identify the tool and a contact address, pace from live rate-limit headers, and honour `Retry-After` (NFR-9).

Success condition: a developer produces a real dataset and a real Sync Report entirely offline, against fixtures, before any page exists.

## Technical Decisions

- **Greenfield, no generator.** Scaffold directly from the declared stack: Node 24.21.0, TypeScript 6.0.3, pnpm 12.5.1, React 19.3.0 (with matching `@types/react`/`@types/react-dom`), Vite 8.3.0, Mantine 9.6.1, Zod 4.6.5, Vitest 5.0.1, MSW 2.15.0, jsdom 30.1.0, ESLint 10.11.0 with typescript-eslint 8.70.0, dependency-cruiser 18.4.0. Two peer ranges block TypeScript 7 — do not upgrade, and do not use the `@typescript/typescript6` shim to appear upgraded.
- **Four packages, one-way graph.** `contracts` (imports nothing) → `core` → `sync` / `web`. `core` never imports `sync` or `web`, and `sync` and `web` never import each other. `dependency-cruiser` fails `pnpm check` on a violation and names the offending edge; review does not carry that job. `contracts` lands alone and first, and dependent work rebases onto it.
- **Functional core, imperative shell, ports and adapters.** `contracts` declares every external effect — HTTP, filesystem, git and the clock — as a `<Thing>Port` interface. Only `sync` or `web` implements one as an adapter, and every port ships a fake beside the real adapter.
- **Schemas live once in `contracts`**, every static type `z.infer`red from its schema, every artifact and input carrying `schemaVersion`. Epic 1 needs `BaseType`, `ItemClass`, `ModifierRef`, `TrackedEntry`, `PriceObservation`, `CurrencyRate`, `TradeCatalogue` and `SyncRunReport`.
- **Two discriminated unions are the likeliest to be built wrong.** `ModifierRef` is `banded` (always both edges, no open-top form) or `valueless` (no edges at all, never sentinels). `TrackedEntry` is `crafted` (keys on categoryId, className, itemLevelMin, prefix?, suffix?) or `raw` (keys on baseTypeId, itemLevelMin, no affix members). The entry names its own kind; no component infers a kind from what an entry omits.
- **Canonical keys** serialise in declared field order, carry the kind so the two key spaces cannot collide, distinguish an absent affix from a valueless one, and compare by UTF-8 code unit — never by locale collation.
- **Exactly one governed HTTP client** issues every trade request — searches, fetches and catalogue refreshes alike. It learns rule names at runtime from live `X-Rate-Limit-*` headers, hardcodes no rate and names no rule in code, distinguishes search from fetch buckets by policy, and paces against the tightest unsatisfied bucket. It honours `Retry-After` on a 429 and yields the chunk rather than retrying tightly.
- **Three request sources only:** `data/tracked.json`, the per-run league validation, and the explicit catalogue refresh. `sync` reads `data/currencies.json` and never fetches against it. A fourth source needs an architecture amendment.
- **The chunk runner** performs one bounded chunk and exits, bounded by whichever runs out first of the search allowance, the fetch allowance or the unprocessed workload. It runs under an exclusive, recoverable, atomically-taken on-disk lock carrying a pid and an ISO-8601 start time, records *completed* entries (never intended ones) in a schema-pinned `sync-progress.json`, and computes its selection order through `core`. A resumed chunk recomputes its order rather than replaying a frozen plan. `minChunkSearches` is a validation yardstick, never a chunk bound.
- **Pricing method.** One search plus one fetch of the cheapest 10 result ids per entry, built from the entry alone; status `securable`, price option `exalted_divine`, no `sale_type` emitted, sort price ascending. The estimate is the median, and on an even sample it is the lower of the two middle values so every persisted price is one someone actually asked. Band edges go out exactly, never rounded to reach an integer filter. Conversion to Divine happens once, at the sync boundary, and the observation records which exchange observation it used.
- **Price states are distinguished by cause, not by convenience.** Zero listings is `no-listings` and never `unresolvable`; an id absent from the committed catalogue is `unresolvable`, detected offline before any request and therefore never stamping `lastAttemptedAt`; a missing exchange rate is `not-yet-synced` with reason `no-exchange-rate`, and a listing is never stored unnormalised. `lastSearchId`, `lastSearchLeague` and `lastAttemptedAt` live on the entry, never on an observation.
- **One writer per file.** The player owns `tracked.json`, `config.json`, `currencies.json` and `recipes.json`; the external producer owns `weights.json`; `sync` owns `catalogue/*.json`, `dataset.json`, `sync-report.json` and `sync-progress.json`.
- **No git write path.** `sync` writes its own files by explicit path and performs no `add`, `commit`, `push` or `pull`. Those files are git-tracked and updated in place; the player commits and pushes, and that push deploys. The git port is read-only and carries one operation: the author date of the last commit touching a path.
- **The trade catalogue is four committed artifacts** under `data/catalogue/`, refreshed only by an explicit human command at GGG patch cadence and never on the chunk path or a schedule. It is an identity and validation authority only and contributes nothing to any Eligible Pool — no tier, item-level availability or spawn weight is derived from it. One refresh costs exactly four requests.
- **Currency rates are hand-maintained committed data.** `sync` copies each rate's own `league` and `asOf` through unchanged rather than stamping them with the active league, and always writes divine's own rate as exactly `1`.
- **Dataset shape.** `dataset.json` carries only the latest observation per tracked entry with no history, each observation stamped with its league, and the current `CurrencyRate` set beside them. A league change does not filter the dataset on write, so the site is never blanked while a re-sync runs.
- **Sync report structure:** `SyncRunReport` types apart a *figure* (describes the latest chunk; the next chunk overwrites it) from a *record* (survives the chunk that wrote it; only the player's edit clears it). Outcomes are structured records, not free-text console output. The not-reached count is a single figure and never a list.
- **Consistency conventions that bind:** all persisted data carries ISO-8601 UTC; band edges are `number`, compared for exact equality; `sync` rounds every persisted divine value to 4dp once and `core` never re-rounds; files are UTF-8 without BOM, LF line endings, stable JSON key order and a trailing newline, so a data diff shows changed data rather than reserialisation noise; `core` returns a typed result and never throws for an expected condition.
- **Source tree:** `packages/{contracts,core,sync,web}`, player- and sync-owned data under `data/` (with `data/catalogue/`), recorded responses under `fixtures/`, and the deploy workflow under `.github/workflows/`.
- **Agent loop / definition of done:** `pnpm install`, `pnpm check`, `pnpm test`, `pnpm dev`, `pnpm sync:dry`. `pnpm check` enforces package boundaries; `pnpm sync:dry` runs the full pipeline deterministically against fixtures, emits to stdout and writes nothing to disk. `fixtures:record` and `catalogue:refresh` are explicit, human-invoked, strip personal identifiers at record time, and are never part of a test run.

## Cross-Story Dependencies

- Story 1.2 (`contracts`) gates everything else; it lands alone and first, and the rest rebases onto it. Story 1.1's workspace is the precondition for 1.2.
- Story 1.3's governed client is the sole request path, so Stories 1.4, 1.7 and 1.11 all issue their requests through it.
- Story 1.4's committed catalogue is the authority Story 1.10 validates ids against, offline, before any request is issued.
- Story 1.5 establishes the chunk command and the lock-release path. Three of its criteria are deliberately asserted against a partial pipeline and are discharged later — the dataset by Story 1.8, the run report by Story 1.9, and the run-start-gate abort by Story 1.11. Those stories extend 1.5's criteria rather than rewriting them.
- Story 1.6's rotation is a pure `core` function the chunk runner calls; its pinned-starvation outcome surfaces as a record in Story 1.9's report, and its `unresolvable` row depends on Story 1.10's detection.
- Story 1.7's observations are what Story 1.8 publishes into `dataset.json`.
- Downstream: Epic 2 consumes the published `dataset.json` and `sync-report.json` as runtime artifacts. Nothing in Epic 1 reads `weights.json` — that dependency belongs to Epic 3, and Story 1.10 requires a run to proceed normally, recording the absence, with the file missing.
