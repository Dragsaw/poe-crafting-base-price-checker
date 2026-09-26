---
title: 'Story 1.7: A Divine price estimate for one Tracked Entry'
type: 'feature'
created: '2026-09-26'
status: 'done'
baseline_revision: '3b3021dc7db518e33dadb43f2e3c9972d68ae0a3'
route: 'dispatch'
review_loop_iteration: 0
followup_review_recommended: false
deferred:
  - summary: >-
      A step that throws (MalformedRequestError, UnknownClassBaseTypeError, UnexpectedTradeResponseError) loses the progress of every entry the chunk completed before it, so those entries are searched again on the next run.
    evidence: |-
      runChunk writes data/sync-progress.json once, after the loop; a throw skips that write. The behaviour predates this story (Story 1.5 runner). The Design Notes sentence "The completed keys are already in progress" does not hold. Story 1.8/1.9 should decide whether progress is written per entry or on the abort path.
    location: >-
      packages/sync/src/chunk/run-chunk.ts:317
    severity: low
context:
  - '{project-root}/docs/stories/epic-1-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The chunk runner has no real step. `offlineStep` completes every entry without a request, so no tracked entry gets a price, and nothing turns a trade answer into a `DatasetEntry`.

**Approach:** Add a `sync` pricing step that builds the AD-16 search from the entry alone, sends one search and one fetch of the cheapest 10 ids through the governed client, takes the lower median of the listings normalised to Divine (AD-20, IN §4.2–§4.3), and returns the updated `DatasetEntry` to the runner. The runner collects those entries on its outcome for Story 1.8 to publish.

**Decisions (2026-09-26):**
- **Fixtures: live capture.** `fixtures:record` gains one search and one fetch per non-pruned entry in `data/tracked.json`. The human runs `pnpm fixtures:record` once, live, during implementation. The parser tests and `sync:dry` use those captures.
- **4xx abort: typed error now, record later.** No new contracts record kind in this story. Story 1.9 adds the record and writes it.
- **`data/currencies.json` absent or invalid is a load error.** It is refused before any request, with a typed error that names the file. The player has created the file.
- **Spec length kept** at about 2,000 tokens. The jewel entry in `data/tracked.json` keeps the jewel arm in scope.

## Boundaries & Constraints

**Always:**
- Search body per AD-16 and IN §5.1/§5.2, with the crafted class discriminator per IN §10.2 (three arms, tried in order; the jewel arm validates against `catalogue/items.json`). `disabled: false` is written on every stat filter. Band edges go out exactly. Prefix and suffix share one `and` group.
- Normalise every listing to Divine once with `n × rate`, round to 4dp once. The median is the lower middle on an even sample. `sampleSize` is the count of listings actually fetched and priced.
- A rate is current when its `league` equals the active league. Divine's rate is always exactly `1`. `CurrencyRate` output copies `league` and `asOf` through unchanged.
- One listing with no current rate makes the entry `not-yet-synced`/`no-exchange-rate`. No listing is stored unnormalised.
- Any answered search sets `lastSearchId` (response top-level `id`), `lastSearchLeague` and `lastAttemptedAt`. These three fields never go on a `PriceObservation`.
- A 429, 5xx or timeout stamps `lastAttemptedAt` alone and yields the chunk. The entry is not completed.
- A 4xx other than 429 stamps `lastAttemptedAt`, keeps the price state, and throws a typed `MalformedRequestError {entryKey, requestKind: search|fetch, status, entry}`. The runner's existing path releases the lock and rethrows.
- The active league, the rates and the item types are passed into the step. `chunk/` still never names `config.json` or `minChunkSearches`.

**Never:**
- No request for a rate. No write under `data/` (the dataset write is Story 1.8, the report write is 1.9). No catalogue id check (1.10). No league validation (1.11). No live command wiring.
- No hand-written fixture file (NFR-2). No `trade_filters.sale_type`. No rounding of a band edge. `acceptedTier` is never read.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior |
|---|---|---|
| Raw search | raw entry | `query.type` = `baseTypeId`, no category, rarity `normal`, `ilvl.min` |
| Crafted, defence arm | `className` `boots_str_int` | category, rarity `magic`, `ar`/`es` `{min:1}`, `ev` `{max:0}` |
| Crafted, jewel arm | jewel class, type in items.json / not in items.json | `query.type` + category / typed error, no request |
| Valueless stat | valueless prefix | `{id, value:{}, disabled:false}`, no edges |
| Even median | 10 listings | lower of the 5th and 6th normalised values |
| Short sample | 3 listings | priced, `sampleSize` 3 |
| Zero results | search `result: []` | `no-listings`, no fetch, search fields set |
| Missing rate | a listing in a currency with no current rate | `not-yet-synced`/`no-exchange-rate` |
| Stale-league rate | rate `league` ≠ active | treated as missing |
| 429 / 5xx / timeout | on search / on fetch after an answered search | `lastAttemptedAt` stamped and the price state kept; search fields unchanged / set from the answered search (AD-9 rev 21); chunk yields |
| Other 4xx | 400 on search / 404 on fetch | `MalformedRequestError` carrying the entry with `lastAttemptedAt` stamped and the state unchanged; search fields unchanged / set from the answered search (AD-9 rev 21); lock released |
| Currencies file | absent / fails `CurrenciesFileSchema` | typed load error, no request |
| Rates out | currencies file | divine `1`, rates at 4dp, `league`/`asOf` verbatim |

</frozen-after-approval>

## Code Map

- `packages/sync/src/chunk/run-chunk.ts`:
  - `StepResult` (L63): add `entry?: DatasetEntry` on `completed` and `yielded`.
  - `ChunkStep` (L71): unchanged.
  - The call at L243: collect the entries. Add `entries: DatasetEntry[]` to `ChunkOutcomeBase`. Keep the lock release path.
  - A thrown step error, including `MalformedRequestError`, still releases the lock and rethrows.
- `packages/sync/src/trade/client.ts`:
  - `TradeClient.send`: a 429 returns `kind:'yield'`, while a 5xx or a 4xx returns `kind:'response'` with its status.
  - A timeout arrives as a rejection (`shell.ts`, `REQUEST_TIMEOUT_MS`).
  - `remaining` is per lane: the search lane maps to `searchRemaining` and the fetch lane to `fetchRemaining`.
  - Do not change the client.
- `packages/sync/src/trade/endpoints.ts`: `TRADE_API_BASE`. Add builders for the search URL (`/search/poe2/{encodeURIComponent(league)}`) and the fetch URL.
- `packages/contracts/src/`:
  - `dataset.ts`: `DatasetEntry` and `PriceState`, with `NotYetSyncedReason` `no-exchange-rate`.
  - `price-observation.ts`: `exchangeObservation`, `sampleSize ≥ 1`.
  - `currency-rate.ts`, and in `envelopes.ts` `CurrenciesFileSchema`.
  - `canonical-key.ts`: `canonicalKey`.
  - No contracts change.
- `packages/sync/src/dry-run.ts`: `offlineStep` is swapped for the pricing step on a fake HTTP port loaded from the recorded fixtures, with rates from `data/currencies.json` (read-only) and item types from `data/catalogue/items.json`.
- `packages/sync/src/fixtures-record.ts`: `FIXTURE_INTERACTIONS` and `recordFixtures`. Add the POST search and the fetch leg per tracked entry, built with `buildSearchBody`. The fixture files are keyed so that the fake HTTP port can serve them back.
- Guards that stay green:
  - `run-chunk.test.ts` L654 (source scan of `chunk/`)
  - `test/no-hardcoded-rate-limits.test.ts`
  - `depcruise.rules.mjs`
- `data/tracked.json`: 1 crafted amulet (the none arm, banded prefix and suffix), 1 crafted `jewel`/`Emerald` (the type arm, banded prefix and suffix) and 3 active raw entries.

## Tasks & Acceptance

**Execution:**
- [x] `packages/sync/src/pricing/search-body.ts` + test: `buildSearchBody(entry, itemTypes)`, covering the raw and crafted shapes, the three discriminator arms and the valueless shape.
- [x] `packages/sync/src/pricing/normalise.ts` + test: `currentRates`, `toDivine`, `lowerMedian`, `roundDivine`, and `outputRates` (divine `1`, league and `asOf` verbatim).
- [x] `packages/sync/src/pricing/load-currencies.ts` + test: `loadCurrencies(fs)` returns the rates or a typed error for an absent file or a file that fails the schema. It lives outside `chunk/`.
- [x] `packages/sync/src/pricing/price-entry.ts` + test: `createPricingStep({client, league, rates, itemTypes, dataset, clock})`, covering the state matrix rows.
- [x] `packages/sync/src/trade/endpoints.ts`: the search and fetch URL builders.
- [x] `packages/sync/src/chunk/run-chunk.ts` + test: step entries on the outcome. A `MalformedRequestError` releases the lock.
- [x] `packages/sync/src/fixtures-record.ts` + test: the search and fetch interactions. **HALT for the human's live `pnpm fixtures:record` run** before the fixture-backed tests.
- [x] `packages/sync/src/dry-run.ts` + test: the fixture-backed pricing step. Two runs print identical stdout.
- [x] The active league: `fixtures-record.ts` and `dry-run.ts` read it from `data/config.json` (`ConfigFileSchema`, read-only). Both are outside `chunk/`. An absent or invalid file is a typed refusal.
- [x] `packages/sync/src/index.ts`: export the pricing step.

**Acceptance Criteria:**
- Given `pnpm check`, when it runs, then it passes.
- Given `pnpm test`, when it runs, then every suite passes, no request escapes, and nothing is written under `data/`.
- Given a fake HTTP port, when one entry is priced, then exactly one search and at most one fetch are sent, and the fetch asks for at most 10 ids.

## Design Notes

A valueless stat is sent as `"value": {}`, because OQ-12 says to try `{}` first. If that shape is wrong, the live API answers 4xx, and the abort is the guard. A thrown `MalformedRequestError` loses the chunk's in-memory entries. The completed keys are already in progress, and Story 1.8 decides how to publish them. 5xx and timeout yield, as a 429 does: server trouble means the chunk stops, and the entry, now stamped, moves back in its row.

## Verification

**Commands:**
- `pnpm check`: expected to pass.
- `pnpm test`: expected all green.
- `pnpm sync:dry`: expected exit 0 and JSON on stdout.
- `git status -- data/`: expected clean.

## Review Triage Log

### 2026-09-26 — Review pass
- verdicts: 39 findings — high 0, medium 4, low 23, false 11, maybe-false 1
- findings:
  - `[low]` `[defer]` Blind: after a step throws, progress for the entries completed earlier is lost (the Design Notes claim otherwise) — real, but the progress write-once is the Story 1.5 runner's behaviour; deferred to frontmatter `deferred`.
  - `[low]` `[reject]` Blind: a misspelt jewel-arm class (`UnknownClassBaseTypeError`) aborts every chunk — the failure is loud and names the class; tracked classes come from `weights.json`, whose only group-matching category (`jewel`) lists exactly the `items.json` types; a pre-validation pass adds a new branch in every caller.
  - `[medium]` `[patch]` Blind: `sendLeg` swallows every rejection as a yield, so a fixture miss or a bug gives a quiet exit 0 — fixed: `isTransportFailure` yields only on `TimeoutError` or `TypeError('fetch failed')` and rethrows otherwise; the dry-run fixture-miss test now expects a rejection naming the fixture; the docs are updated.
  - `[low]` `[reject]` Blind: 4dp rounding can produce a zero `DivineAmount` — cannot arise with current rates (the smallest product is 0.002012 per exalted); a guard adds a branch. The 4dp precision itself is mandated by IN §4.2.
  - `[false]` `[reject]` Blind: `roundDivine` fails half-up at ≥2 — checked: `roundDivine(110.00005)` = 110.0001 and `roundDivine(2.00005)` = 2.0001.
  - `[low]` `[reject]` Blind: on an exact cross-currency tie at the median, fetch order picks the recorded `exchangeObservation` — needs an exact 4dp tie between currencies, and the fetch order is deterministic; a tie-break rule adds complexity.
  - `[low]` `[reject]` Blind: the fixture port serves status 200 with no headers, so the dry run never exercises lane bounding — the offline dry run is not required to bound; changing the recorded format is more than a direct fix.
  - `[low]` `[patch]` Blind: stale digest-named fixtures pile up after a tracked, builder or league change — fixed: `fixtures-record.ts` `main` deletes each unwritten `trade-(search|fetch)-*.json` after a successful record.
  - `[medium]` `[patch]` Blind: the fixture tests read the player's live `data/currencies.json` and hard-code the medians, so a rate edit turns the suite red — fixed: rates are pinned as a constant in `price-entry.fixtures.test.ts`; config and tracked are still read because the digests depend on them.
  - `[low]` `[patch]` Blind: "has a recorded search for every non-pruned tracked entry" asserts only `length > 0` — fixed: it asserts that each entry's search fixture name is in the map.
  - `[low]` `[patch]` Blind: untested paths (`UnexpectedTradeResponseError`, null or unpriceable listings) — fixed with the VG rows below. The jewel end-to-end and AC-3 sub-claims are already covered by `price-entry.fixtures.test.ts` (POST,GET per entry, ≤10 ids, Emerald priced).
  - `[low]` `[patch]` Blind: a fetch 4xx carries the entry with the search fields set, while a fetch yield does not — fixed: `MalformedRequestError` on the fetch carries `stamped`, which the matrix's "state unchanged" requires; the test pins the entry.
  - `[false]` `[reject]` Blind: the status markers disagree — the spec status is transitional during a run and is set to `done` at finalize; the `sprint-status.yaml` edit predates the baseline and is updated at finalize.
  - `[low]` `[reject]` Blind: duplicate current rates are accepted silently — a hand-maintained file with duplicate rows is unlikely; validation adds a new rule and a new error.
  - `[low]` `[patch]` VG: the dry-run test "starts from the published entry" cannot fail — deleted: with 200-only fixtures a completed search overwrites every field, so the dataset wiring cannot be observed through `dryRun`; the unit yield tests cover the behaviour.
  - `[low]` `[patch]` VG: `UnexpectedTradeResponseError` is untested — added: a search `{}` (one request only) and a fetch `{}`, each asserting its `requestKind`.
  - `[low]` `[patch]` VG: an unpriceable or null-listing fetch is untested — added: `[null, amount 0]` gives `no-listings` with the search fields set; a mixed null fetch gives `sampleSize` 2.
  - `[medium]` `[patch]` VG other: `sendLeg` drops the fixture-miss error — the same root cause and fix as the Blind sendLeg row.
  - `[low]` `[patch]` VG other: the fetch-4xx entry payload is not pinned — the same fix as the Blind fetch-4xx row.
  - `[false]` `[reject]` IA: the "no request" check on a currencies failure is only unit-level — `dryRun` loads config, currencies and items before it creates the client; there is no live command (the intent excludes one).
  - `[low]` `[reject]` IA: the jewel refusal happens at visit time, not at load — grouped with the Blind jewel-arm row; the same reasoning.
  - `[maybe-false]` `[reject]` IA: the arm-2 condition is an `items.json` group-id proxy, not IN §10.2's composition predicate — among `weights.json` categories only `jewel` equals a group id, and all 8 of its classes are plain and in `items.json`; it would diverge only for a future category equal to a group id, and even then only at `low`.
  - `[low]` `[patch]` IA: fetch-yield and fetch-4xx disagree on the carried entry — the same fix as the Blind fetch-4xx row.
  - `[low]` `[patch]` IA: the real timeout path is not exercised — the timeout tests now reject with a `TimeoutError`-named error, the shape `AbortSignal.timeout` produces in `shell.ts`.
  - `[false]` `[reject]` IA: the fixture captures are absent from the diff, so their provenance cannot be shown — they were left out of the diff file deliberately; the parent session recorded them with a live `pnpm fixtures:record` (exit 0, 5 searches and 5 fetches).
  - `[false]` `[reject]` IA: the diff edits `data/`, including amulet ilvl 54→75 — those are the player's edits, present before the baseline (session-start git status); this change writes nothing under `data/`.
  - `[false]` `[reject]` IA: "Rates out" is exercised only through `outputRates` in a unit test — the spec task names `outputRates`; the runtime rate write is Story 1.8.
  - `[false]` `[reject]` IA: `sprint-status` shows `ready-for-dev` — a pre-baseline edit; updated at finalize.
  - `[medium]` `[patch]` EC: `sendLeg` catches non-timeout rejections — the same root cause and fix as the Blind sendLeg row.
  - `[false]` `[reject]` EC: a 1xx or 3xx becomes `MalformedRequestError` — Node `fetch` follows redirects by default and never surfaces 1xx, so the port cannot return one.
  - `[low]` `[reject]` EC: with no divine row, divine listings get `no-exchange-rate` — the player's file carries divine; synthesising a row means inventing `source` and `asOf`.
  - `[low]` `[reject]` EC: a price that rounds to zero — grouped with the Blind rounding row.
  - `[low]` `[reject]` EC: the median-tie currency — grouped with the Blind tie row.
  - `[low]` `[reject]` EC: `UnknownClassBaseTypeError` aborts the chunk — grouped with the Blind jewel-arm row.
  - `[false]` `[reject]` EC: the recorder accepts an empty search id — never observed live, and the pricing step fails loudly on one.
  - `[low]` `[patch]` EC: stale fixtures are never removed — the same fix as the Blind stale-fixture row.
  - `[low]` `[reject]` EC: `fixtures:record` refuses when `data/tracked.json` is absent — the repository carries the file, and the refusal is typed and names it; making the file optional adds a branch.
  - `[false]` `[reject]` EC: a missing `fixtures/` directory gives a raw ENOENT — the directory is committed, and the failure is loud anyway.
  - `[false]` `[reject]` EC: a fetch-leg yield drops the spent search id — the matrix row "429/5xx/timeout on search or fetch → search fields unchanged" settles it.
  - Superseded 2026-09-26 by AD-9 rev 21 (retro item 17, `spec-epic-1-retro-item-17-answered-search-keeps-its-fields.md`): after an answered search, a fetch-leg yield or 4xx now carries the search fields. The two matrix rows are updated, and the `stamped` reasoning in the fetch-4xx patch row and the fetch-yield reject row above no longer holds.

## Auto Run Result

Status: done

**Summary.** `sync` has a real pricing step. `createPricingStep` builds the AD-16 search body with the §10.2 three-arm discriminator. It sends one search and at most one fetch of 10 ids through the governed client, normalises each listing to divine once at 4dp, and takes the lower median. It returns the `DatasetEntry` by cause: priced, no-listings, no-exchange-rate, or yielded-and-stamped. A malformed request throws `MalformedRequestError`. `runChunk` collects the step entries on its outcome. `fixtures:record` captured one search and one fetch per tracked entry, live. `sync:dry` prices all five tracked entries offline from those captures (110, 1, 2, 1, 0.1207 div).

**Files changed.**
- `packages/sync/src/pricing/search-body.ts` (+test): the AD-16 body builder and the three arms.
- `packages/sync/src/pricing/normalise.ts` (+test): current rates, toDivine, roundDivine, lowerMedian, outputRate(s).
- `packages/sync/src/pricing/price-entry.ts` (+test, +fixtures test): the pricing step, `MalformedRequestError`, `UnexpectedTradeResponseError`, and the transport-failure yield.
- `packages/sync/src/pricing/load-currencies.ts`, `load-item-types.ts`, `packages/sync/src/load-config.ts`, `load-data-file.ts` (+test): typed read-only loaders.
- `packages/sync/src/pricing/fixture-names.ts`, `fixture-port.ts`: digest-named fixtures and the offline HTTP port.
- `packages/sync/src/trade/endpoints.ts`: the search and fetch URL builders and the lane labels.
- `packages/sync/src/chunk/run-chunk.ts` (+test): `StepResult.entry` and `outcome.entries`.
- `packages/sync/src/fixtures-record.ts` (+test): the search and fetch legs per entry, and stale-fixture pruning.
- `packages/sync/src/dry-run.ts` (+test): runs on the pricing step against the recorded fixtures.
- `packages/sync/src/index.ts`: exports.
- `fixtures/README.md`, and `fixtures/trade-{search,fetch}-*.json` (live capture); `fixtures/trade-data-*.json` re-recorded.
- `data/config.json`, `data/currencies.json`, `data/tracked.json`: the player's inputs, created before this run.

**Review.** 39 findings. 16 rows were patched: 6 fix groups (sendLeg transport classification; fetch-4xx entry; UnexpectedTradeResponseError and unpriceable-listing tests; the vacuous dry-run test deleted; fixture-test rates pinned and a real presence assertion; stale fixtures pruned). 1 was deferred (progress lost on a step throw, which predates this story). 22 were rejected, with reasons in the triage log. During step-03 verification I also fixed the fetch-leg yield to carry `stamped`, following the matrix.

**Follow-up review: not recommended (false).** Two `medium` entries (sendLeg classification; pinned fixture-test rates) and four `low` entries were patched on this first pass. The one risk named for a follow-up was `isTransportFailure` against real transport errors, and it was checked directly on Node 24: a real `fetch` timeout via `AbortSignal.timeout` rejects with `name` `TimeoutError` (an `Error`), and a refused connection rejects with `TypeError('fetch failed')`. Both match the predicate, so no unverified risk remains.

**Verification.**
- `pnpm check`: pass (tsc, eslint with 0 warnings, depcruise with 0 violations).
- `pnpm test`: 43 files and 404 tests pass.
- `pnpm sync:dry`: exits 0 on two runs, with byte-identical stdout; 5 of 5 entries priced.
- `git status -- data/`: shows only the player's pre-baseline edits; this change writes nothing under `data/`.
- `pnpm fixtures:record`: exit 0, run live by the parent session.
- Matrix audit: all 13 rows are covered by passing tests.

**Residual risks.**
- The real transport-error shapes are verified locally (above), but not yet on a live 5xx or a live timeout from the trade site.
- The arm-2 group-id stand-in for IN §10.2's composition predicate.
- 4dp values that round to zero are unguarded.
- The fixture tests depend on `data/tracked.json` and `data/config.json`, because the digests do. Editing a tracked entry needs a re-record.
