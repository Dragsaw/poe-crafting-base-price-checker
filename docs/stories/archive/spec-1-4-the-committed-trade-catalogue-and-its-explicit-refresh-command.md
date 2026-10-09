---
title: 'Story 1.4: The committed Trade Catalogue and its explicit refresh command'
type: 'feature'
created: '2026-09-20'
status: 'done'
route: 'full'
review_loop_iteration: 1
followup_review_recommended: false
context:
  - '{project-root}/docs/stories/epic-1-context.md'
  - '{project-root}/docs/architecture/architecture-poe-crafting-base-price-checker-2026-09-12/AGENT-WORKFLOW.md'
warnings: ['oversized']
deferred:
  - summary: >-
      The emitted `packages/contracts/dist/index.d.ts` carries `.ts` relative
      specifiers, and the prescribed fix is inert.
    evidence: |-
      Verified by reading the built declaration: `export { … } from './schema-version.ts'`.
      `rewriteRelativeImportExtensions` was tried and reverted — it does not affect
      declaration emit under `emitDeclarationOnly`, reproduced in a minimal project.
      A consumer probe did resolve the `.ts` specifier through to `schema-version.d.ts`,
      so TypeScript itself follows it; the risk is a non-TypeScript consumer of `dist`.
      Settling it needs a different mechanism — dropping `emitDeclarationOnly` or a
      post-emit rewrite — which is more than this story's correction.
    location: >-
      packages/contracts/tsconfig.json
    severity: medium
  - summary: >-
      A `contracts` change landed inside a `sync` story, against AGENT-WORKFLOW's
      rule that a `contracts` change lands alone and first.
    evidence: |-
      15 files: 13 rewritten to `.ts` relative specifiers plus `allowImportingTsExtensions`
      (a module-resolution change every consumer sees), and two schema loosenings in
      `trade-catalogue.ts` (`FilterOptionSchema.id` nullable, `StaticCatalogueGroupSchema.label`
      nullable) that change the type Stories 1.7 and 1.10 will consume. Both loosenings are
      evidence-backed: the recorded fixtures contain `{"id": null, "text": "Any"}` and
      `{"id": "Misc", "label": null, "entries": []}`, so the schemas as written refused the
      real responses. Not reverted, because re-derivation hits the same two walls. Wants a
      human decision on whether to split it out before other work rebases.
    location: >-
      packages/contracts/src
    severity: medium
  - summary: >-
      The "a second refresh leaves no diff" criterion is exercised in memory only.
    evidence: |-
      The test compares one `serialiseCatalogue(...)` result against itself; no second run
      and no committed artifact exist to diff. It becomes checkable once a human has run
      `pnpm catalogue:refresh` and committed the four files (see `deferred-work.md`).
    location: >-
      packages/sync/src/catalogue-refresh.test.ts
    severity: low
  - summary: >-
      The real `createFetchHttpPort` is executed by no test.
    evidence: |-
      By design — it is the shell edge, and the offline test path drives `createFakeHttpPort`
      instead. Recorded so the limit is visible: the four-request behaviour is proven against
      fixtures, never against the endpoints the acceptance criterion names.
    location: >-
      packages/sync/src/shell.ts
    severity: low
baseline_commit: '79ece1af4371a1312ea20943b4f47309de763a28'
baseline_revision: '79ece1af4371a1312ea20943b4f47309de763a28'
---

<intent-contract>

## Intent

**Problem:** The four trade data endpoints are the only authority for what a `statId`, `baseTypeId` or `categoryId` means, and nothing in the repository fetches or commits them. Story 1.10 validates the tracked list against that authority offline, and Story 1.7 builds searches from it; without committed artifacts each would have to reach the live API or infer ids from results. A GGG patch that renames a stat id must arrive as a reviewable diff, not as a silent behaviour change.

**Approach:** One human-invoked `pnpm catalogue:refresh` command in `sync`. It issues exactly four GETs through the governed trade client from Story 1.3, validates each response against the `contracts` catalogue schemas, stamps the envelope's `schemaVersion`, and writes `data/catalogue/{items,stats,static,filters}.json` all-or-nothing. The real `fetch` port, system clock and sleep that `fixtures-record.ts` already owns move to a shared shell module so both commands issue through one path.

## Boundaries & Constraints

**Always:**
- Exactly four requests per invocation, one per data endpoint, all issued through `createTradeClient` — no second HTTP path, no leagues request, no retry (AD-12, AD-25).
- Every response is validated before it is written: the payload against its `contracts` schema, then the envelope (payload plus `schemaVersion`) against its `Catalogue*FileSchema`. A response that fails either is a named failure, never a written file (Consistency Conventions → Validation).
- **All-or-nothing.** Nothing is written until all four have been fetched and validated, so a commit never mixes a new `stats.json` with a stale `items.json`. The recorder's buffer-then-write shape (`fixtures-record.ts:220-225`) is the precedent.
- The committed file is the API payload **as it arrived**, plus `schemaVersion`. Ids are stored verbatim — never trimmed, re-encoded, case-folded, sorted or flattened. `stats.json` keeps its `{id, label, entries[]}` category groups; a consumer flattens at read time (AD-25).
- Unknown fields GGG sends survive the round trip. The catalogue schemas are `z.looseObject` for exactly this reason; a refresh must not strip what it did not expect.
- Serialisation is `JSON.stringify(value, null, 2)` plus one trailing `\n`, UTF-8, LF — byte-identical to `serialiseFixture`, so a second refresh against unchanged data produces an empty diff.
- The `User-Agent` comes from `POE_SYNC_USER_AGENT` through `resolveUserAgent`; unset or blank refuses before anything is issued and exits non-zero (NFR-9).
- All four requests share one lane label, so they pace against one ledger entry rather than seeding four cold lanes.
- The command is reachable only when invoked directly. It carries the same `process.argv[1]` entry guard as `fixtures-record.ts:295-298`, is referenced by no vitest config, and no test executes it against the network.

**Never:**
- No chunk runner, no lock, no progress file, no `sync-report.json` entry, no league gate — the refresh reports through its own stdout and the git diff (AGENT-WORKFLOW §Fixtures).
- No scheduled or automatic invocation, and no call from a view path or from `sync:dry`.
- No id validation *consumer* here: this story writes the authority, Story 1.10 reads it. No flatten-and-index helper, no `unresolvable` state.
- No pool meaning derived from the catalogue — no tier, item-level availability, spawn weight, or use of a group `label` as anything but a heading.
- No change to `packages/contracts`: the catalogue schemas, the envelopes and `SUPPORTED_SCHEMA_VERSION` are used exactly as they stand. No change to `dry-run.ts`.
- No agent invocation of the command, and no agent-authored file under `data/catalogue/` — those land when a human runs it (AGENT-WORKFLOW §Parallel worktrees).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Happy path | Four fixtured 200 responses | Four files written under `data/catalogue/`, each the payload plus `schemaVersion`, 2-space JSON, trailing newline | No error expected |
| Request count | One invocation | Exactly four requests are issued, and no leagues URL is among them | No error expected |
| One lane | Four interactions | All four carry the same lane label and the standing headers (`user-agent`, `x-requested-with`) | No error expected |
| Unknown GGG field | A payload entry carrying an undeclared key | The key is present in the written file | No error expected |
| Stats grouping kept | `stats.json` response of category groups | The written file keeps `{id, label, entries[]}`; nothing is flattened or re-sorted | No error expected |
| Mid-run non-200 | Third endpoint returns `503` | **No file is written at all**; the outcome names the artifact and the status | Returned failure, non-zero exit |
| Rate limited | The client returns a yield | Nothing written; the outcome names the yield reason and its delay | Returned failure, never a throw |
| Not JSON | A `200` carrying an HTML interstitial | Nothing written; the outcome names the artifact | Returned failure |
| Schema-invalid payload | `stats` response with an entry missing `id` | Nothing written; the outcome names the artifact and the first issue path | Returned failure |
| Contact overlay unset | `POE_SYNC_USER_AGENT` unset or blank | Nothing issued, nothing written; stderr names the variable | Typed refusal, exit code 1 |
| Imported, not invoked | The module is imported by a test run | Nothing runs, no request, no write | No error expected |

</intent-contract>

## Code Map

- `packages/sync/src/fixtures-record.ts` — the precedent to mirror and the source of the extraction. `TRADE_API_BASE` (:33), `REQUEST_TIMEOUT_MS` (:39), `DATA_LANE` (:53), `FIXTURE_INTERACTIONS` (:55), `serialiseFixture` (:142), `RecorderPorts` with injected `writeFixture` (:147), `recordFixtures` buffer-then-write (:168-225), module-private `createFetchHttpPort` (:232), `systemClock` (:252), `sleep` (:256), `main` (:261), entry guard (:295-298). Its five interactions include the four data endpoints — after extraction it must still record all five, unchanged.
- `packages/sync/src/trade/client.ts` — `createTradeClient({http, clock, wait, userAgent, invalidRequestThreshold?})` (:251). `send(TradeRequest): Promise<TradeResult>`; `TradeRequest` carries `method`, `url`, optional `lane` (:88). Result discriminates on `kind`: `'response'` with `response: HttpResponse`, or `'yield'` with `retryAfterMs` and `reason` (:123-153). Throws `MissingUserAgentError` on a blank agent.
- `packages/sync/src/trade/user-agent.ts` — `resolveUserAgent(env?)` → `{ok:true,userAgent}` | `{ok:false,variable,message}`; `USER_AGENT_ENV_VAR`.
- `packages/contracts/src/trade-catalogue.ts` — `ItemCatalogueSchema` (:54), `StatCatalogueSchema` (:37), `StaticCatalogueSchema` (:71), `FilterCatalogueSchema` (:96). All `z.looseObject`; each is `{result: [...]}`. Note `filters` groups use `title`/`filters`, not `label`/`entries`, and `static` group `label` is optional.
- `packages/contracts/src/envelopes.ts` — `CatalogueItemsFileSchema` (:86), `CatalogueStatsFileSchema` (:87), `CatalogueStaticFileSchema` (:88), `CatalogueFiltersFileSchema` (:89), built by `catalogueFileEnvelope` (:79) as `payload.extend({schemaVersion})`. **This is the envelope decision, already made in Story 1.2: payload plus `schemaVersion`, and no `asOf`.** `parseEnvelope` is the read path and is not needed here.
- `packages/contracts/src/schema-version.ts` — `SUPPORTED_SCHEMA_VERSION` is the value to stamp.
- `packages/contracts/src/ports/fakes/http.ts` — `createFakeHttpPort(fixtures)` keyed `"GET <url>"`, with `requests` and `respondTo`; an unfixtured request rejects. Clock fake takes a positional instant: `createFakeClockPort('2026-09-20T00:00:00Z')`.
- `fixtures/trade-data-{items,stats,static,filters}.json` — real captured payloads recorded in Story 1.3. These are the test inputs; no new fixture needs recording.
- `packages/sync/src/fixtures-record.test.ts` — the test techniques to copy: a local fixtures-keyed harness, `execFile(process.execPath, …)` for the entry guard and the refusal path, and the "referenced by no vitest config" source scan.
- Root `package.json` — `"fixtures:record": "node --env-file-if-exists=.env packages/sync/src/fixtures-record.ts"` is the exact precedent for the new script.
- `packages/sync/tsconfig.json` — `allowImportingTsExtensions`. A module on the bare-`node` entry path must import relatives **with** an explicit `.ts`; `src/index.ts` stays extensionless.
- `docs/architecture/.../ARCHITECTURE-SPINE.md` AD-25 and AD-12 — read, never edit. `data/catalogue/` does not exist yet.

## Tasks & Acceptance

**Execution:**
- [x] `packages/sync/src/trade/endpoints.ts` — new. Move `TRADE_API_BASE` here and declare the four catalogue endpoints once (artifact name, URL, output path) plus the leagues URL, so the recorder and the refresher cannot drift to two spellings.
- [x] `packages/sync/src/shell.ts` — new. Move `createFetchHttpPort`, `systemClock`, `sleep` and the `mkdir`-then-`writeFile` helper out of `fixtures-record.ts` and export them for both commands. Behaviour unchanged, including the request timeout.
- [x] `packages/sync/src/fixtures-record.ts` — edit to consume `endpoints.ts` and `shell.ts`. Its five interactions, its stripping and its outcome shape stay exactly as they are; its existing suite must pass untouched.
- [x] `packages/sync/src/catalogue-refresh.ts` — new. `refreshCatalogue(ports)` issuing the four GETs through one client on one lane, validating payload then envelope, buffering, and writing only on four successes; a typed `{ok, failure?, written}` outcome; plus the shell `main()` and the `process.argv[1]` entry guard, mirroring `fixtures-record.ts`.
- [x] `package.json` (root) — add `"catalogue:refresh": "node --env-file-if-exists=.env packages/sync/src/catalogue-refresh.ts"`.
- [x] `packages/sync/src/catalogue-refresh.test.ts` — one suite covering every I/O matrix row, driven by `createFakeHttpPort` seeded from the committed `fixtures/trade-data-*.json` payloads, with the entry-guard and overlay-refusal cases spawned via `execFile`.
- [x] `docs/stories/deferred-work.md` — append the one human step this story cannot perform: running `pnpm catalogue:refresh` once against the live API and committing the four files, which Story 1.10 needs on disk.

**Acceptance Criteria:**
- Given the repository, when `catalogue:refresh` is searched for, then the only HTTP path it reaches is the trade client factory, and no endpoint URL is spelled in more than one module.
- Given `pnpm check`, when it runs, then typecheck, lint and dependency-cruiser pass and `sync` still declares only `@poe/contracts` and `@poe/core`.
- Given `pnpm test`, when it runs, then the new suite and the untouched `fixtures-record` suite both pass, `assertNoEscapedRequests` reports nothing, and no test writes under `data/`.
- Given a human running `pnpm catalogue:refresh` twice against an unchanged API, when they inspect `git status`, then the second run leaves no diff — byte-stable serialisation.
- Given a GGG patch that renames a stat id, when a human refreshes and commits, then the rename is one reviewable line in `data/catalogue/stats.json`.

## Implementation Notes

**Three changes landed in `packages/contracts` that the Boundaries section forbids.** Each was forced by reality rather than chosen, and none alters a contract's meaning for a value the live API actually sends. All three are reported for review.

1. **Relative specifiers inside `contracts/src` now carry `.ts`** (13 non-test files, plus `allowImportingTsExtensions` in `packages/contracts/tsconfig.json`). `catalogue:refresh` is the first bare-`node` entry point that needs `contracts` **at runtime** — it imports the four payload schemas, the four file envelopes and `SUPPORTED_SCHEMA_VERSION` as values, where `fixtures-record.ts` imported only types. `@poe/contracts` resolves through `exports.default` to `./src/index.ts`, and Node's type stripping performs no extension resolution, so loading it failed with `ERR_MODULE_NOT_FOUND` on `./schema-version`. This is the same rule `packages/sync/tsconfig.json` already records for the sync entry path, extended to the package that entry path loads. Behaviour-preserving; `pnpm check` and the whole suite pass.

2. **`FilterOptionSchema.id` is now `z.string().min(1).nullable()`.** Every option list in the recorded `fixtures/trade-data-filters.json` opens with `{"id": null, "text": "Any"}` — the "this filter is not applied" sentinel. The schema as it stood refused the real response, so a live refresh could never have written `filters.json`. `filterOptionIds` drops the null, so the `categoryId` authority is unchanged.

3. **`StaticCatalogueGroupSchema.label` is now `z.string().nullable().optional()`.** The recorded `fixtures/trade-data-static.json` ends with `{"id": "Misc", "label": null, "entries": []}`. Same class of defect as 2: the schema refused the real response.

Points 2 and 3 were found by validating the committed fixtures against the schemas, which is exactly the check this story's happy-path row performs. They are a finding *for* the story's premise — the schemas had never met a real payload — not a redesign of the catalogue contract.

**One deliberate reading of the endpoint order.** `CATALOGUE_ENDPOINTS` is declared `items, stats, filters, static`, which keeps `FIXTURE_INTERACTIONS` in the exact order the recorder already used, so a re-record diffs as changed data rather than as a reordered capture. The refresh is all-or-nothing, so no consumer can observe the order.

**`zod` is not imported by `sync`.** `catalogue-refresh.ts` types the schemas structurally (`CatalogueParser`) and takes the issue type from `contracts`' own exported `EnvelopeIssues`, so `sync` still declares only `@poe/contracts` and `@poe/core`.

## Spec Change Log

## Review Triage Log

### 2026-09-20 — Review pass

Layers: blind-hunter, edge-case-hunter, verification-gap, intent-alignment.

- verdicts: 33 findings — high 0, medium 8, low 13, false 0, maybe-false 0, rejected-on-rule 12
- findings:
  - `[medium]` `[patch]` Write loop is not atomic and throws past the typed outcome — verified: the `for (const {path, contents} of captured)` loop had no catch, so an fs rejection escaped and left two new files beside two stale ones. Fixed: the loop now returns `{ok:false, written:[…landed]}` naming the refused path and `N of 4`, with a covering test.
  - `[medium]` `[patch]` No test for a failing write port — verified: every failure row stopped before the write loop. Fixed: a test whose write port rejects on the third path. (The half of this finding asking for a new I/O matrix row is rejected — that edits this build's spec.)
  - `[medium]` `[patch]` A transport rejection escapes as a throw — verified: `client.send` can reject on the 30 s abort, DNS or socket reset, and nothing caught it. Fixed: wrapped, returning a failure naming the artifact, with a covering test.
  - `[low]` `[patch]` The envelope `safeParse` branch is unreachable — verified: the envelope is `payload.extend({schemaVersion})` over a `looseObject` with a constant version, so it cannot fail after the payload parse. Fixed with a one-line comment naming it a gate against a future constraint; the gate is kept rather than deleted.
  - `[medium]` `[patch]` The `.ts` specifiers in `contracts` are load-bearing at runtime with nothing enforcing them — verified: the package mixes both conventions and the next extensionless import breaks `catalogue:refresh` only when a human runs it. Fixed: a spawn test that imports `@poe/contracts` under bare `node` and asserts exit 0.
  - `[medium]` `[defer]` Emitted `dist/index.d.ts` carries `from './schema-version.ts'` — verified by reading the built declaration. The prescribed fix was tried and refuted: `rewriteRelativeImportExtensions` does not affect declaration emit under `emitDeclarationOnly`, and a consumer probe resolved the `.ts` specifier through to `schema-version.d.ts`. Reverted rather than left as dead config; deferred with the evidence.
  - `[low]` `[reject]` The spec's "No change to `packages/contracts`" contradicts the Implementation Notes — rejected on the rule that a finding whose fix is to edit this build's spec is not actioned. The deviation itself is real, documented in Implementation Notes, and deferred below for human review.
  - `[low]` `[patch]` `?? ''` fallbacks make two assertions vacuous — verified: `toContain('')` is always true. Fixed by routing the lookups through `endpointFor(...)`.
  - `[medium]` `[patch]` `it('writes each artifact under data/catalogue, and writes nowhere else')` asserted nothing about writes — verified: `async` with no `await`, no refresh, only a constant restated. Fixed: it now drives a refresh and checks every recorded path is absolute, relative-to-root under `data/catalogue`, and carries no `packages` segment.
  - `[low]` `[patch]` `serialiseCatalogue` duplicated `serialiseFixture` — verified: two copies, byte-identity asserted nowhere, in the module created to stop exactly that. Fixed: one implementation in `shell.ts`, both call it.
  - `[low]` `[patch]` The pacing test ran on a frozen clock — verified: `wait` recorded milliseconds without advancing time. Fixed: the recording `wait` now advances the fake clock; the assertion still holds.
  - `[low]` `[reject]` The direct spawn relies only on an env deletion to stay offline — rejected: `main()` refuses before any request is constructed (asserted by that same test's non-zero exit and stderr), and the suggested extra guards add machinery for a path never shown reachable.
  - `[low]` `[patch]` The two schema loosenings had positive cases only — verified. Fixed: negatives added for `FilterOptionSchema` rejecting `""` and `StaticCatalogueGroupSchema` rejecting a non-string label. The same finding's note that the stats test asserts `typeof label === 'string'` is rejected — it records today's payload, and a null stats label is undemonstrated state. Its spelling-order note on the spec is rejected as a spec edit. Its stray trailing blank line in `deferred-work.md` is patched.
  - `[medium]` `[patch]` Write rollback (edge-case layer) — same root cause as row 1; shares that fix.
  - `[medium]` `[patch]` Transport rejection (edge-case layer) — same root cause as row 3; shares that fix.
  - `[low]` `[reject]` Make `items`/`stats` group `label` nullable like `static`'s — rejected: no evidence GGG sends a null label on those two endpoints. A loud refusal on a situation never shown reachable is correct behaviour, and the guard would admit state the recorded fixtures do not contain.
  - `[low]` `[reject]` Refuse a payload that carries its own `schemaVersion` — rejected: undemonstrated state, and the fix adds a branch guarding it.
  - `[low]` `[reject]` The entry guard could miss on a symlinked or case-differing `argv[1]` — rejected: the direct-spawn test proves the guard matches on this platform and command form, and the fix adds a branch.
  - `[medium]` `[defer]` `dist` declaration specifiers (edge-case layer) — same root cause as the deferred row above.
  - `[low]` `[patch]` `shell.ts` moved the real `fetch` into an importable module without its containment — verified. Fixed: the source scan now asserts no test imports `./shell.ts`.
  - `[medium]` `[patch]` The "all-or-nothing" claim overstated what the code guaranteed — same root cause as row 1; the fix makes the claim and the code agree.
  - `[medium]` `[patch]` The "covers every I/O matrix row" claim omitted the transport-throw path — same root cause as row 3; covered by its new test.
  - `[medium]` `[patch]` The four endpoint URLs are asserted nowhere (verification-gap, pre-verified; a `/data/stat` mutation left 213 tests green) — fixed: each URL is now pinned to its literal, and `TRADE_LEAGUES_URL` to `/data/leagues`.
  - `[medium]` `[patch]` `catalogueFilePathOf`'s anchoring is asserted nowhere (verification-gap, pre-verified; a `'../../'` mutation left the suite green while the real command would write `packages/data/catalogue/`) — fixed by the repo-root assertion above.
  - `[low]` `[patch]` The mis-titled write test (verification-gap, other findings) — same root cause as row 9; shares that fix.
  - `[low]` `[reject]` The source-scan test cannot fail on an inverted entry guard — rejected: true but not a defect; the two `execFile` spawns beside it are what pin that behaviour, as the finding itself notes.
  - `[low]` `[patch]` The envelope gate is pinned by the payload gate alone (verification-gap, other findings) — same root cause as row 4; the comment records it.
  - `[low]` `[reject]` Reading R2 — the story is not done until four files sit under `data/catalogue/` — rejected as an action: AGENT-WORKFLOW forbids an agent to run the command against the live API or author a file under `data/`. Recorded as deferred work instead, which is where the constraint puts it.
  - `[low]` `[reject]` Reading R4 — implement the stats-flattening consumer here — rejected: `flattenStatCatalogue` already exists in `contracts`, and the epic's lookup behaviour belongs to Story 1.10, which the spec assigns it to.
  - `[medium]` `[defer]` The `contracts` change lands inside a `sync` story, against AGENT-WORKFLOW's "land a `contracts` change alone and first" — verified: 15 files, one of them a module-resolution change affecting every consumer. Deferred for human review rather than reverted, because re-derivation hits the same two walls (`ERR_MODULE_NOT_FOUND`, and schemas that refuse the real payloads).
  - `[low]` `[defer]` The two-run idempotence AC is exercised as one in-memory string equality — verified: no second run and no committed file exist to compare against. Deferred with the human refresh step it depends on.
  - `[low]` `[defer]` The real `createFetchHttpPort` is executed by no test — verified, and by design: it is the shell edge. Deferred as a known limit of the offline path.
  - `[low]` `[patch]` `sprint-status.yaml` still reads `backlog` for 1-4 while the spec moved on — verified. Handled at finalization: the tracker is updated alongside the spec's terminal status, as stories 1.1–1.3 were.

## Design Notes

**Why the envelope question is not reopened.** The architecture documents require `schemaVersion` on every artifact but never define a catalogue wrapper, which reads as a gap. It is not one: Story 1.2 already shipped `catalogueFileEnvelope` as `payload.extend({schemaVersion})`, so the shape is decided in code — payload keys at the top level, one extra key, no `asOf`. An `asOf` stamp would also defeat the story's whole purpose, since it would make every refresh a non-empty diff whether or not GGG changed anything.

**Why the shell pieces move rather than being re-declared.** `createFetchHttpPort` carries the `AbortSignal.timeout` that keeps a hung connection from blocking a human's terminal, and a second hand-written copy is where that detail gets dropped. The extraction is behaviour-preserving; the recorder's suite is the regression test for it.

**Why writes are injected.** The refresher takes a `writeFile`-shaped function exactly as `RecorderPorts.writeFixture` does, so the whole four-endpoint path is exercised in a unit test with no filesystem and no network — which is also what keeps a test run from ever touching `data/`.

## Verification

**Commands:**
- `pnpm check` — expected: typecheck, lint and depcruise pass, zero violations
- `pnpm test` — expected: the new suite passes, `fixtures-record` still passes, no escaped request
- `git status` — expected: clean apart from the intended new files; **nothing under `data/`**

**Manual checks (if no CLI):**
- `pnpm catalogue:refresh` is **not** run during verification. Confirm by inspection that no vitest config, setup file or test imports `catalogue-refresh.ts` for execution.

## Auto Run Result

Status: done

**What shipped.** `pnpm catalogue:refresh`: a human-invoked command that issues exactly four GETs through the Story 1.3 governed client on one shared lane, validates each response against its `contracts` payload schema and then its file envelope, stamps `schemaVersion`, and writes `data/catalogue/{items,stats,filters,static}.json` all-or-nothing. The real `fetch` port, system clock, sleep and write moved out of the recorder into a shared shell module, and the four endpoint URLs are now declared once for both commands.

**Files changed**
- `packages/sync/src/catalogue-refresh.ts` — new: `refreshCatalogue(ports)`, the typed outcome, `main()` and the entry guard.
- `packages/sync/src/catalogue-refresh.test.ts` — new: 18 tests covering every I/O matrix row plus the transport and write-failure paths.
- `packages/sync/src/trade/endpoints.ts` — new: the four endpoints, the leagues URL and the shared lane, spelled once.
- `packages/sync/src/shell.ts` — new: `createFetchHttpPort`, `systemClock`, `sleep`, `writeTextFile`, `serialiseJsonArtifact`.
- `packages/sync/src/fixtures-record.ts` — consumes the two new modules; its five interactions and behaviour are unchanged.
- `package.json` — the `catalogue:refresh` script.
- `packages/contracts/src/**` (15 files) — `.ts` relative specifiers plus `allowImportingTsExtensions`, and two schema loosenings the recorded fixtures forced. **Outside this story's declared boundary; see the deferred entry.**
- `docs/stories/deferred-work.md` — the human refresh step and the committed-catalogue parse check.
- `docs/stories/sprint-status.yaml` — 1-4 moved to `done`.

**Review findings.** 33 findings over four layers: 13 patched (6 medium, 7 low), 4 deferred, 12 rejected on rule, 4 shared a fix with another row. Rejections, with reasons, are in the Review Triage Log above — the substantive ones were: nullable `label` on `items`/`stats` (undemonstrated state), a `schemaVersion` collision guard (undemonstrated state), an entry-guard path-normalisation branch (the spawn test disproves the concern here), extra offline guards on the direct spawn (the refusal precedes any request), and three findings whose only fix was to edit this build's spec.

**Verification.** `pnpm check` — typecheck, lint and dependency-cruiser clean, 76 modules, zero violations; `sync` still declares only `@poe/contracts` and `@poe/core`. `pnpm test` — 32 files, 219 tests, all passing, no escaped request. `git status` — nothing under `data/`. `pnpm catalogue:refresh` was not run against the live API; spawning it with no contact overlay refuses, naming `POE_SYNC_USER_AGENT`, and exits non-zero.

**Follow-up review recommended: true.** Two medium entries were patched on a first pass, and one specific risk is unverified: the `contracts` change (a module-resolution change plus two schema loosenings) landed inside a `sync` story against the "alone and first" rule, and its emitted `dist` declarations carry `.ts` specifiers whose only demonstrated consumer is TypeScript itself. Patched counts by verdict: medium 6, low 7; high 0.

**Residual risks.** `data/catalogue/*.json` does not exist until a human runs the command once — until then Story 1.10 has nothing to validate against, and the "second run leaves no diff" criterion is unprovable. The four-request behaviour is proven against recorded fixtures, not against the live endpoints.

### Review Findings

#### 2026-09-26 — Follow-up review pass

Layers: blind-hunter, edge-case-hunter, verification-gap, intent-alignment (acceptance auditor). 2 decision-needed, 9 patch, 2 deferred, 10 rejected.

- [x] [Review][Decision] **Resolved 2026-09-26: a human ran the command; the four files are committed as `edd2c97`.** This retires the `deferred-work.md` step that carved out the live run, and gives Story 1.10 the authority it validates against. The second 1.4 deferral — a test parsing the four committed files against their `Catalogue*FileSchema` — was deferred only because the files did not exist, and is now actionable. Four untracked artifacts now sit under `data/catalogue/` — `git status` reports `?? data/catalogue/` with `items.json`, `stats.json`, `filters.json` and `static.json` present, contradicting the Verification section's "nothing under `data/`", the Auto Run Result, and the `deferred-work.md` entry that says they "are not on disk yet". Independently checked: all four are LF, end in one newline, carry `"schemaVersion": "1.0.0"` as their last key, are non-empty (`result` lengths 10/10/7/15), and re-serialise byte-identically at two-space JSON — consistent with a real `pnpm catalogue:refresh` run, and the first evidence the idempotence criterion has ever had. Needs a human to confirm they came from a human-invoked run (not an agent and not a test — a test-authored file under `data/` would violate the "no test writes under `data/`" AC and AGENT-WORKFLOW §Parallel worktrees), then decide whether to commit them, which retires one deferred entry and unblocks Story 1.10.
- [x] [Review][Decision] **Resolved 2026-09-26: accepted in place; the exception is recorded here.** The `contracts` change stays in commit `224aab7` rather than being split out ahead of Story 1.5. The accepted exception to AGENT-WORKFLOW §Parallel worktrees "Land a `contracts` change alone and first" is this one landing, on these grounds: both schema loosenings are forced by recorded fixtures that the schemas as written refused, the `.ts` specifier rewrite is what makes `contracts` loadable under bare `node` at all, and re-derivation hits the same two walls. The rule is not amended and this sets no precedent — the next `contracts` change lands alone and first. Story 1.5 rebases onto `224aab7` as it stands. Original finding: the `packages/contracts` change landed inside a `sync` story and the story was marked `done` anyway — 15 files: `allowImportingTsExtensions` plus 13 relative-specifier rewrites (a module-resolution change every consumer sees) and two schema loosenings in `trade-catalogue.ts` that change the type Stories 1.7 and 1.10 consume. Violates the spec's own "No change to `packages/contracts`", AGENT-WORKFLOW §Parallel worktrees "Land a `contracts` change alone and first", and epic-1-context's "`contracts` lands alone and first". Both loosenings are evidence-backed and re-derivation hits the same walls, so the decision is whether to split the `contracts` change into its own commit ahead of 1.5, or accept it in place and record the exception.
- [x] [Review][Patch] The human-invoked path — `package.json` script → `main()` → `writeTextFile` — is exercised by no test, and the containment scan makes closing that unclosable in-package [packages/sync/src/shell.ts:72; packages/sync/src/catalogue-refresh.test.ts:224]
- [x] [Review][Patch] The write phase's non-atomicity is under-reported: the module docblock still claims plain "all-or-nothing", and `main` drops `outcome.written` on a partial-write failure [packages/sync/src/catalogue-refresh.ts:9, :280]
- [x] [Review][Patch] `CatalogueRefreshOutcome` is not a discriminated union, so `main` carries an unreachable `?? 'failed'` and a caller may read `failure` on success [packages/sync/src/catalogue-refresh.ts:127]
- [x] [Review][Patch] The shipped `FilterOptionSchema` doc comment's universal claim is false — 19 option lists in `fixtures/trade-data-filters.json`, 17 open with `{"id": null}`; `status` opens with `{"id": "available"}` and `sale_type` with `{"id": "any"}` [packages/contracts/src/trade-catalogue.ts:88]
- [x] [Review][Patch] `endpoints.ts` says "Nothing depends on it" of the endpoint order, but the write-failure test hardcodes `[items, stats]` and `'2 of 4'` [packages/sync/src/trade/endpoints.ts:47; packages/sync/src/catalogue-refresh.test.ts:496]
- [x] [Review][Patch] The `/data/filters` endpoint doc comment is stranded between `StaticCatalogueSchema` and `FilterOptionSchema`, leaving two consecutive block comments on one declaration and detaching it from `FilterCatalogueSchema` [packages/contracts/src/trade-catalogue.ts:82]
- [x] [Review][Patch] The loop variable `relative` shadows the imported `node:path` `relative` inside the config-scan test [packages/sync/src/catalogue-refresh.test.ts:189]
- [x] [Review][Patch] The config scan's `catch { continue }` lets a renamed or moved vitest config pass vacuously [packages/sync/src/catalogue-refresh.test.ts:193]
- [x] [Review][Patch] Two of the four frontmatter deferrals never reached `deferred-work.md` — the `dist` declaration specifiers and the `contracts`-inside-`sync` landing exist only in this spec's frontmatter, while the Auto Run Result points the reader at "the deferred entry" [docs/stories/deferred-work.md]
- [x] [Review][Defer] The idempotence AC and the real `createFetchHttpPort` are exercised by nothing [packages/sync/src/shell.ts:38] — deferred: pre-existing, already recorded in this spec's `deferred` block. Note for whoever picks it up: the four artifacts now on disk make the two-run check runnable for the first time.
- [x] [Review][Defer] Emitted `packages/contracts/dist/index.d.ts` carries `.ts` relative specifiers [packages/contracts/tsconfig.json] — deferred: pre-existing, already recorded in this spec's `deferred` block with the prescribed fix refuted.

#### Applied 2026-09-26

All nine patches are in. `pnpm check` — typecheck, lint and dependency-cruiser clean, 79 modules, zero violations, `sync` still declaring only `@poe/contracts` and `@poe/core`. `pnpm test` — 33 files, 227 tests, no escaped request. `git status` — nothing under `data/`.

- `packages/sync/src/shell.test.ts` is new: seven tests over the shell's safe exports, writing under the OS temp directory. The `mkdir` case was mutation-checked — deleting `await mkdir(dirname(path), …)` fails it with the same `ENOENT` the human's first refresh on a fresh checkout would have hit.
- The containment scan changed subject. It forbade the `shell.ts` module specifier, which both missed the evasions (`from './shell'`, a dynamic import, a re-export) and forbade testing `writeTextFile` at all. It now forbids naming the real fetch port, which is the property actually worth holding, and `shell.test.ts` exists because of it.
- `CatalogueRefreshOutcome` is now a discriminated union. This surfaced real slack in the suite: fourteen assertions read `outcome.failure` off an un-narrowed outcome and typechecked only because the field was optional. They now narrow through `failureOf(...)`.

**Still uncovered, deliberately.** `main()`'s success and failure output formatting is exercised by nothing. Covering it needs either exporting `main` — public surface this review will not add on its own initiative — or a spawn that reaches the live API, which AGENT-WORKFLOW forbids. The refusal branch remains covered by the existing spawn. Raised here rather than patched.

#### Rejected

- `[false]` No `.gitattributes` rule pins LF for the committed catalogue — refuted: `.gitattributes` is `* text=auto eol=lf`, and `git check-attr text eol -- data/catalogue/items.json` reports `eol: lf`.
- `[false]` The AC "no endpoint URL is spelled in more than one module" is broken by `catalogue-refresh.test.ts` — refuted: the AC's subject is the production path, where `endpoints.ts` is the only spelling. The test's literal is the anti-mutation pin a previous review pass added deliberately; removing it reopens the hole where a `/data/stat` mutation left 213 tests green.
- `[low]` An empty `{"result": []}` passes every gate and overwrites the authority — the command's output is a human-reviewed git diff, where an emptied catalogue is the most conspicuous diff possible; the fix guards a state never shown reachable.
- `[low]` The `.ts` convention rests on one spawn test, and `contracts` test files remain extensionless — the spawn test covers everything reachable from `index.ts`, which is the whole public graph; the fix adds a lint rule for a narrow residual.
- `[low]` `REPO_ROOT` is spelled three times — one of the three is the test's deliberate independent recomputation, leaving two spellings of a one-line constant.
- `[low]` Frontmatter inconsistency and the Approach paragraph's `{items,stats,static,filters}` ordering — rejected on the rule that a finding whose fix is to edit this build's spec is not actioned.
- `[low]` Refuse a payload that carries its own `schemaVersion` — undemonstrated state, and the fix adds a branch. Same rejection as the first pass.
- `[low]` Write to a `.tmp` and rename, so an interrupt cannot commit truncated JSON — the file is git-tracked and the human reviews the diff before committing; a truncated artifact fails to parse loudly. The fix adds machinery for a path never shown reached.
- `[low]` Make `items`/`stats` group `label` nullable like `static`'s — undemonstrated state. Same rejection as the first pass.
- `[low]` The direct spawn stays offline by env deletion rather than by the entry guard — accurate as a reading, but the harm needs a user-agent fallback that does not exist. Same rejection as the first pass.
