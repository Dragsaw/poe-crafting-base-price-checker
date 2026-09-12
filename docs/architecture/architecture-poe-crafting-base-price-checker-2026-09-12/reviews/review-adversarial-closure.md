---
title: 'Adversarial Closure Audit — Architecture Spine (rewrite)'
target: ARCHITECTURE-SPINE.md
companions: [WEIGHTS-FILE-SCHEMA.md, AGENT-WORKFLOW.md]
prior_review: reviews/review-adversarial.md
reviewer: adversarial lens
created: 2026-09-12
verdict: closer-to-buildable-but-not-ready
---

# Adversarial Closure Audit

## Scope and method

Two jobs, in order.

**Part 1 — closure.** Every finding F-1…F-21 from `review-adversarial.md` is re-tested against the rewritten spine (15 ADs → 24 ADs) and the two new companion documents. A finding is **CLOSED** only if a named AD or companion clause makes the divergent pair *impossible*, not merely *discouraged*. An AD that says the right thing in prose but leaves the operative number, ordering, or membership rule unstated is **PARTIALLY CLOSED**. An assertion that the problem is handled, with nothing mechanically binding behind it, is **OPEN**.

**Part 2 — new divergence.** AD-16 through AD-24 are new and have not been adversarially tested. The same test applies: two units one level down, in separate worktrees, each obeying every AD to the letter, building incompatibly.

---

## Part 1 — Closure table

| # | Prior finding | Status | Closed by | Residual |
| --- | --- | --- | --- | --- |
| F-1 | Threshold has no comparand/unit | **CLOSED** | AD-17 | precision of the `≥` comparison still unpinned (see F-12) |
| F-2 | Tier band vs per-modifier weights | **CLOSED** | AD-18 + WEIGHTS-FILE-SCHEMA | band-straddle ambiguity is a *new* defect (N-1) |
| F-3 | Normalisation denominator (2 axes) | **CLOSED** | AD-18 | partial-coverage denominator is a *new* defect (N-5) |
| F-4 | AD-6 error state vs AD-9 tri-state | **PARTIALLY CLOSED** | AD-9 (four-state), AD-6 | no lifecycle: retry, clearing, or persistence of `unresolvable` across runs |
| F-5 | `absent` weights behaviour undefined | **PARTIALLY CLOSED** | AD-18 + WEIGHTS pool-completeness rule | picks behaviour (3) — the inflating renormalisation the prior review asked to *forbid*; provenance order still not declared total |
| F-6 | AD-3 contradicted by `report --> web` | **CLOSED** | AD-3 (two artifacts, both schema-pinned) | AD-21 and AD-24 now disagree about the artifact set (N-6) |
| F-7 | `contracts` has no owner | **PARTIALLY CLOSED** | AD-22 + AGENT-WORKFLOW *Parallel worktrees* | process rule only; no named owner, no one-schema-per-file rule, no barrel rule, no mechanical check for duplicate symbols |
| F-8 | Two owners of craft cost; `CraftRecipe` homeless | **CLOSED** | AD-22, AD-20, AD-17, `data/recipes.json` | AD-18 has no slot for the recipe's distribution effect that AD-11/AD-22 mandate (N-4) |
| F-9 | Concurrent sync runs uncoordinated | **CLOSED** | AD-7 (exclusive lock), AD-21 (explicit commit paths, dirty tree) | exit-code semantics self-contradictory (N-12) |
| F-10 | Resumption state has no location/shape | **PARTIALLY CLOSED** | AD-7 (`sync-progress.json`, schema-pinned) | no invalidation rule when `tracked.json` changes; **"sweep" is still not a defined concept** |
| F-11 | "Dataset age" is three numbers | **PARTIALLY CLOSED** | AD-10 (per-row age mandatory), AD-14 | still unstated whether non-`priced` entries contribute a timestamp to a base's freshness; AD-9 grants an observation time only to `priced` |
| F-12 | Tri-state encoding, precision, timestamps | **OPEN** | — | no discriminated-union mandate, no `strictObject`, no decimal precision or rounding mode for `priceDivine`, no millisecond/`Z` timestamp pin. AD-9's "never a missing key" is the only mitigation |
| F-13 | Core/web ranking seam | **PARTIALLY CLOSED** | AD-4 ("ranking function lives in `core`; `web` may not compute any ranking term"), AD-17, AD-22 (`RankedBase`) | **tie-break chain, negative-score rule, chase-modifier selection, and combination-list ordering all still unspecified** — and the v1 uniform-prior file makes ties the normal case |
| F-14 | White bases unrepresentable | **PARTIALLY CLOSED** | AD-5 (both affixes absent), ER diagram now optional | representation works; the *semantics* are now actively wrong (N-3) and AD-16 has no query branch for them |
| F-15 | "Yields the chunk" two meanings | **PARTIALLY CLOSED** | AD-7 ("loses at most the requests in flight") | implies per-request persistence but never says so; commit cadence (per chunk vs per entry) unstated, which is what makes the claim true or false |
| F-16 | Budget report meaningless / denominator | **PARTIALLY CLOSED** | AD-12 (per-set requests against the live bucket) | request *classes* now separated per cause; per-sweep totals still impossible because a sweep is undefined (F-10) |
| F-17 | No canonical composite key encoding | **OPEN** | — | nothing names a `combinationKey()`; the dataset's keying of a `(baseTypeId, prefix?, suffix?)` entry is still each unit's choice |
| F-18 | Companion documents do not exist | **CLOSED** | both authored; WEIGHTS-FILE-SCHEMA is substantive and binding | — |
| F-19 | No epic/unit map | **PARTIALLY CLOSED** | AGENT-WORKFLOW *Parallel worktrees* | partitioning *rules* exist; the **map does not** — no unit list, no owned paths, no sequencing. And `sync` still splits into client + runner inside one package, where the "two agents in two packages touch no common file" guarantee does not hold |
| F-20 | Threshold persistence vs sharing | **OPEN** | — | AD-15 unchanged; no URL-param decision, no stated default threshold |
| F-21 | `core` must be browser-safe | **OPEN** | — | no `dependency-cruiser` rule, no zero-runtime-dependency constraint |

**Count: 7 CLOSED · 10 PARTIALLY CLOSED · 4 OPEN.**

### Notes on the partial closures that matter most

**F-5.** AD-18 says the denominator is "the total weight of the complete eligible pool… never the tracked subset," and the WEIGHTS contract's pool-completeness rule is genuinely the best clause in either document. But `poolCoverage: "partial"` is explicitly permitted and the stated consequence is only that "probabilities are upper bounds and carry provenance `absent`." An upper bound is a *number that still ranks*. Coverage differs per `(base, slot)`, so the inflation factor `1/coverage` differs per base, and it therefore **reorders the list**. The prior review's closure asked for "forbidding renormalisation that inflates covered probabilities"; the rewrite instead labels the inflation and ships it. Labelling is not a fix when the label does not change the sort order, and AD-10's only obligation on `web` is to render it "visibly differently."

**F-13.** Ownership is genuinely closed — `core` returns `RankedBase`, `web` renders. All four *downstream* divergences the finding named remain untouched. Tie-breaking is the sharpest: with `weight: 1` everywhere in the v1 file, two combinations on the same base with equal prices produce byte-identical scores, and the resulting order is whatever the dataset's array order happens to be — which AD-7's chunked writer reshuffles between runs. **The ranked list reorders between syncs with no data change**, still.

**F-7.** AD-22 is a good statement of intent and AGENT-WORKFLOW's "land contract changes alone, first" is the right instruction. Neither is enforceable. The concrete pair from the prior review survives unchanged: four units in four worktrees all need a schema in `contracts` on day one, all add a file, all edit the barrel, and `dependency-cruiser` reports nothing because no *edge* was violated. The Conventions table says "one exported concept per file in `core`" — conspicuously not in `contracts`, the package where it matters.

---

## Part 2 — New divergence introduced by the rewrite

Findings are numbered N-*. Severity as before.

### N-1 — CRITICAL — AD-18's "band lies at or above `valueMin`" has three readings, and none matches AD-16's trade query

**AD-18:** a modifier reference's weight is "the sum of the weights of every weights-file entry with that `statId` whose band lies at or above `valueMin`."

The WEIGHTS contract defines a band as `(valueMin, valueMax)`, requires only that bands within a slot not overlap, and places **no requirement that band edges coincide with tracked floors**. So a tracked floor of 80 against bands `[70,79]`, `[75,85]`, `[86,null]` is a live case, not a contrived one. Three readings, each defensible:

- **(a)** `band.valueMin >= floor` — "lies at or above" read as the whole band sitting above the floor. Excludes `[75,85]` entirely.
- **(b)** `band.valueMax >= floor` (or `null`) — any band that *can* roll at or above the floor. Includes `[75,85]` at full weight.
- **(c)** pro-rata: include `[75,85]` at `6/11` of its weight, the fraction of its range that satisfies the floor.

**The pair.** U-CORE implements (a) — the literal reading of "lies at or above". U-WEIGHTS' uniform-prior generator emits bands straight from the RePoE catalogue with no floor alignment, because nothing tells it to align. Every tracked floor that lands mid-band now silently drops that band's whole weight from the numerator while it remains in the denominator. Probabilities are wrong downward by an amount that varies per stat and per base — it reorders.

**And the reading that is arithmetically correct is (c), which no AD permits.** AD-16 issues the trade search with "the entry's modifier references as stat filters with their value floors" — the trade API matches on the item's *rolled value*, so a listing whose mod rolled 82 out of band `[75,85]` **is** in the priced population. The price side is (c) by construction; the probability side is (a) or (b) by choice. `P × price` is then a product of two populations that are not the same population. This is exactly the class of error the prior F-2 was about, re-entering through the band definition rather than the tier definition.

**Close with:** state the rule as pro-rata over the band's value range under an assumed-uniform within-band distribution, *or* require the weights file to declare that every band edge is a legal tracked floor and that `core` rejects a floor that does not coincide with a band's `valueMin`. The second is cheaper and mechanically checkable at load.

---

### N-2 — CRITICAL — AD-17 sums over a set nothing requires to be disjoint

**AD-17:** `EV = Σ P(combo) × price(combo)` over `combo ∈ tracked(base)`.

A sum of `P × price` over outcomes is only an expected value if the outcomes are **mutually exclusive and the probabilities are of disjoint events**. Nothing in AD-5, AD-12, AD-18, AD-22 or AD-23 requires the tracked list to be disjoint, and two ordinary curation actions violate it:

- **Nested floors.** `(statId X, valueMin 40)` and `(statId X, valueMin 80)` are both legal tracked entries on the same base — indeed the natural way to track "good" and "great" separately. Under AD-18 the second's matching bands are a **subset** of the first's. Both are summed. The T1 outcome is counted twice, once at the T1 price and once at the T4+ price. `Σ P` for that slot can exceed 1.
- **Partial affixes.** AD-5 permits `(prefix p, suffix absent)`, and AD-18 gives it `P = P(p) × 1`. That entry's event *contains* every `(p, s)` entry on the same base. Both are summed. This is the "coarser fallback pricing" escape hatch the Deferred list keeps alive — and AD-5's representation makes it expressible *today*, with no AD stopping a curator from adding one alongside the specific entries it subsumes.

**The pair.** U-CURATION builds a tracked list with a coarse `(p, any suffix)` row plus three specific `(p, s)` rows for the jackpots — a sensible, budget-aware curation. U-CORE implements AD-17 verbatim and sums all four. The base's EV is roughly double its true value, and only *that* base is doubled, so it wins the ranking. Both units obeyed every AD. No schema rejects it, no test catches it, and the result looks exactly like a discovery.

**Close with:** an AD stating that the tracked entries for a `(base, slot)` must partition the outcome space — no nested floors, and a coarse entry excludes the specific entries it subsumes — enforced as a hard `tracked.json` validation error in `contracts`, not a curation guideline.

---

### N-3 — CRITICAL — A raw base scores `P = 1` inside the same sum as the magic combinations

AD-5 represents a white ilvl-82 base as a `TrackedEntry` with both affixes absent. AD-18 gives `P = 1` for an absent affix, so a raw base's `P(combination) = 1 × 1 = 1`. AD-17 sums over `combo ∈ tracked(base), state = priced`. Therefore the raw base's full market price enters the expected-value sum **at certainty**, alongside the magic combinations whose probabilities sum to well under 1.

On any base where the white ilvl-82 price is the dominant figure — which is the entire reason white bases are in v1 scope — the term swamps every crafted outcome, and the ranked list becomes a ranking of white base prices with crafting noise on top. It also breaks the sum's meaning: the EV of *a crafting recipe applied to a base* now includes a payout obtainable without crafting at all, minus `craftCost(recipe)`.

**The pair.** U-CORE-A implements AD-17 and AD-18 literally and includes it. U-CORE-B reads AD-17's `craftCost(recipe)` and the Scope map's "White ilvl-82 bases | AD-5 (both affixes absent), AD-17" as meaning white bases are their own degenerate recipe and excludes them from the magic sum. Two completely different ranked lists from one dataset.

**A second, independent defect on the same entry.** AD-16 issues, for *every* tracked entry, a search for "that base, **magic rarity**, endgame item level". There is no branch for a both-affixes-absent entry. Obeyed literally, the syncer prices a white base as a magic item — the wrong population entirely. The Open Questions flag the item-level floor but not the rarity filter, and the prior review's F-14 question "do white bases share the ranked list and the threshold" was dropped from Open Questions without being answered.

**Close with:** a `kind` discriminant (`magic-combination` | `raw-base`) on the tracked entry after all, an explicit statement of whether raw bases are summed or ranked separately, and a rarity/ilvl branch in AD-16 keyed on that discriminant.

---

### N-4 — CRITICAL — The recipe has no term in the formula that is ranked per recipe

AD-17 ranks `(baseTypeId, recipe)` pairs. AD-11: "Craft-recipe effects on the tier distribution are modelled in `core` and are never baked into the weights file." AD-22: `CraftRecipe` is "currency composition **and its distribution effect**".

**AD-18 — the only AD that defines how a probability is computed — takes no recipe input.** `P(modifier | base, slot)` is summed weight over pool weight, full stop.

**The pair.** U-CORE-A implements AD-18 exactly: recipe enters only through `craftCost(recipe)` in AD-17. Consequence: for a fixed threshold, the *ordering* of bases is identical under every recipe, differing by a constant offset — the brief's "base × recipe" ranking axis is decorative. U-CORE-B honours AD-11 and AD-22 and applies the recipe's distribution effect as a transform on the weights before normalisation — a transform whose shape, whose place in the pipeline (before or after floor-aggregation — these do not commute), and whose numbers are all invented locally, because the Open Question concedes "nothing in the inputs supplies the actual numbers."

The Open Question acknowledges the missing *numbers*. It does not acknowledge that the formula has no **slot** for them: AD-18 would have to be rewritten, not parameterised. That is a rewrite of the one AD two units are supposed to build against in parallel.

**Close with:** either state for v1 that the recipe affects cost only and AD-18's distribution is recipe-independent (and strike "distribution effect" from AD-22 and the AD-11 clause), or write the recipe transform into AD-18 as an explicit named function with its position in the pipeline fixed. The first is honest and shippable; the second cannot be built until the Open Question closes.

---

### N-5 — CRITICAL — `poolCoverage: "partial"` yields an inflated, per-base-varying denominator that still ranks; and the documented fallback is circular

Two defects in one clause.

**(i) The inflation is per-base and therefore reorders.** AD-18 requires the denominator to be "the total weight of the complete eligible pool." When `poolCoverage` is `"partial"` that number **does not exist in the file** — the only available denominator is the sum of the listed entries. So every probability on that pool is scaled by `1/coverage`, coverage varies per `(base, slot)`, and the scaling does not cancel across bases. A base at 20% coverage gets probabilities 5× a fully-covered peer's and takes the top of the list. AD-18's "upper bounds" and AD-10's provenance rendering make this *visible* without making it *not happen*; the list is still sorted by the inflated number, and the Open Question "Uniform-prior pool completeness" concedes coverage is unknown and possibly widespread. The prior review named this as F-5 behaviour (3) and asked explicitly that it be forbidden.

**The pair.** U-CORE divides by the listed-entry total (there is nothing else to divide by). U-WEB builds the AD-10 provenance affordance as a coverage chip and expects a partial base's probabilities to sum to its coverage fraction, presenting the residual as the unmeasured band. They are describing different distributions, and the disagreement is invisible because both render plausible numbers.

**(ii) The absent-base fallback is circular.** The WEIGHTS contract says: "A base absent from the file has no weights at all — `core` falls back to a uniform prior over whatever eligible pool it knows and marks the result `absent`." **`core` does not know any eligible pool.** AD-1 forbids `core` from reading anything; AD-11 makes the weights file the sole source of pool membership; the RePoE mapping is explicitly a *producer-side* concern ("mapped into trade stat ids at the adapter boundary"). For an absent base the pool `core` knows is the empty set, and the fallback is `0/0`. The only pool `core` could construct is the tracked subset — which AD-18 forbids in the same breath.

**The pair.** U-CORE-A treats an absent base as un-scoreable and drops it from the ranking. U-CORE-B normalises over the tracked entries for that base (the only set it has), producing `P` summing to 1 across a curated subset — precisely F-3(i), resurrected via the fallback clause. Both cite a document.

**Close with:** delete the circular fallback and state that a base absent from the weights file is un-scoreable and reported as such; and for `partial` pools either require the file to carry a declared residual weight for the unenumerated remainder (so the denominator is honest) or rank partial-coverage bases in a separate, explicitly-labelled section rather than interleaved.

---

### N-6 — HIGH — AD-3, AD-21 and AD-24 disagree about what `web` reads

Three statements, all binding, mutually inconsistent:

- **AD-3:** "`sync` communicates to `web` through exactly two artifacts, `dataset.json` and `sync-report.json`, and nothing else. Adding a third artifact requires amending this AD."
- **AD-21's table:** `data/dataset.json`, `data/sync-report.json`, `data/sync-progress.json` — written by `sync` only, **"Read by: `web`"**. That is the third artifact, added without amending AD-3.
- **AD-24:** "`web` fetches `dataset.json`, `sync-report.json` and `weights.json`." No `sync-progress.json` — and no `recipes.json`, which AD-22 requires `CraftRecipe` to be populated from, which the System diagram draws as `recipes --> web`, and which the ranking cannot run without.

**The pair.** U-WEB-A implements AD-24's fetch list exactly and has no recipes — `RankedBase }o--|| CraftRecipe` cannot be constructed, so it invents a hardcoded recipe constant. U-WEB-B follows the System diagram and AD-22 and fetches four files, one of which (`sync-progress.json`, per AD-21) is a sync-owned artifact AD-3 says it may not read. U-SYNC-RUNNER, reading AD-3, treats `sync-progress.json` as private and schema-pins it only loosely; U-WEB parses it anyway to render sweep progress. Every symptom AD-3 exists to prevent, on the one file whose schema nobody thinks is a contract.

**Close with:** one authoritative list of `web`'s runtime inputs, stated once, with `recipes.json` in it and `sync-progress.json` either in it (and schema-pinned as a published artifact) or explicitly out of it in AD-21's table.

---

### N-7 — HIGH — AD-20 normalises against a rate that AD-12 makes chunked, and no state exists for "priced but not yet normalisable"

AD-20 requires prices normalised to divine **at the adapter boundary in `sync`**, with raw currency never entering `core`. AD-12 makes the currency set part of the same chunked, rate-limited workload as the tracked list. So a chunk can price a listing denominated in a currency whose exchange rate has not been observed yet.

AD-9's four states are `priced`, `no-listings`, `not-yet-synced`, `unresolvable`. **None of them is "we have listings but cannot denominate them."** This is F-4's exact shape, reintroduced by a new AD: the agent must either drop the listing (silently narrowing the median's population — AD-16 says "records the sample size actually returned", so the count will look legitimate), write the entry as `not-yet-synced` (losing a real observation and, on a rate that is slow to sync, permanently), or stall the chunk.

**The pair.** U-SYNC-CLIENT-A drops un-normalisable listings from the sample and reports a sample size of 6 of 10, which validates. U-SYNC-RUNNER-B holds the entry at `not-yet-synced` until the rate lands. Different datasets, different medians, both schema-valid.

**Second axis — which rate.** "Records the exchange observation used" does not say *which* observation is used: the rate as of the listing's fetch, the latest rate in the dataset at write time, or (since AD-20 puts the rate in the dataset and AD-10 propagates it) a rate `core` re-applies at read time. The three produce different divine prices from identical listings, and because AD-17's threshold compares against that price, they produce different *membership* in the sum, not just different magnitudes.

**Third axis — AD-16's ascending sort is not a divine sort.** AD-16 takes "the cheapest 10 result ids" from a search "sorted by price ascending". The trade API sorts by each listing's own quoted price in its own currency; it does not sort across currencies in divine. So "the cheapest 10" is not the cheapest 10 after AD-20's normalisation, and the median of them is not the median of the 10 cheapest. AD-16's own stated justification — "ascending sort is what keeps stale overpriced listings out of the estimate" — does not hold across a mixed-currency result set.

**Close with:** a fifth price state or an explicit ordering rule making currency rates a prerequisite chunk that must complete before any tracked-entry chunk runs; a named rate-selection rule (observation-time, pinned into the `PriceObservation`); and an explicit statement of what AD-16 does when the ascending result set is multi-currency.

---

### N-8 — HIGH — AD-23 mandates tracked-list state that no schema carries, and tombstones re-enter the valuation

AD-23 requires `tracked.json` to carry, per entry: a `pin` flag ("exempt from rotation and always refreshed this cycle") and, for pruned entries, **retention in the file as a tombstone with a reason**.

AD-22's enumeration of shared concepts lists `TrackedEntry` but says nothing of either field, and AD-12 describes `tracked.json` only as "combinations to price."

**The pair.** U-CONTRACTS authors `TrackedEntrySchema` from AD-5 — `(baseTypeId, prefix?, suffix?)` — and `strict` validation rejects U-CURATION's tombstone rows outright, taking the whole file down under AD-3's fail-closed rule. Or, worse, it does not: U-CORE implements AD-17's `combo ∈ tracked(base)` over the parsed file and **a pruned tombstone is still a member of `tracked(base)`**. It carries its last-good `priced` value (AD-6 clears only `unresolvable`; nothing says a prune clears a price), so a combination the player deliberately removed as worthless continues to contribute `P × price` forever. Pruning becomes a no-op on the ranking while appearing to work, which inverts AD-23's stated purpose.

Also: **"cycle"** is a fourth undefined temporal unit alongside *run*, *chunk*, and the still-undefined *sweep* (F-10, F-16). "Always refreshed this cycle" is unimplementable until one of them is defined.

**Close with:** put `pinned` and `prunedAt`/`prunedReason` in the `TrackedEntry` schema; state that a tombstoned entry is excluded from both the workload *and* `tracked(base)`, and that pruning clears its price state; define "cycle" as the sweep.

---

### N-9 — HIGH — AD-19's league filter is applied in `core` but the dataset is written by `sync`, and nobody deletes last league's rows

AD-19: "`core` refuses to value any observation whose league differs from the active one, **treating it as `not-yet-synced`**." AD-14: "`dataset.json` contains only the latest observation per tracked entry **for the current league**."

These assign the same job to two packages. AD-14 makes the dataset already league-clean; AD-19 makes `core` re-filter it. If AD-14 holds, AD-19's rule is dead code; if AD-19 is needed, AD-14 is false.

**The pair.** U-SYNC-RUNNER honours AD-14 and, on detecting a league change (AD-19 has it validating the configured league at run start), purges every row from the old league — which, under AD-7's chunked writer and AD-12's ~1,500-entry list, empties the dataset in one commit and leaves the site blank for the ~15 hours a full re-sync takes at 600 searches/6h. U-SYNC-RUNNER-B leaves old rows in place and relies on AD-19's `core` filter, so the dataset carries two leagues and AD-14 is violated. Neither is wrong per the spine; one of them blanks the product.

Secondary: `core` "treating it as `not-yet-synced`" means the state `web` renders is a *derived* state, not the dataset's state. AD-9 requires `web` to report each state "separately so the view can show them outside the ranking" — U-WEB counting from the dataset and U-CORE counting after the league filter produce different unknown-bucket counts on the same screen.

**Close with:** name one owner for the league filter (`sync`, at write, with AD-19 reduced to a validation assertion in `core`), and state the transition behaviour on a league change — retain-and-mark, or purge — including what `web` shows during the gap.

---

### N-10 — MEDIUM — AD-7's chunk bound names one of two binding buckets

AD-7 sizes a chunk as "at most the **search** budget remaining in the live 6-hour bucket." AD-16 requires **one search and one fetch** per tracked entry, and AD-8's measured table gives two separate policies: 600 searches/6h and 1000 fetches/6h.

A chunk sized to the search bucket is fine at a 1:1 ratio, but AD-16's "one fetch of the cheapest 10 result ids" is one fetch *per entry* only if the fetch endpoint accepts all 10 ids in one call — and if a future entry needs pagination, or a retry consumes a fetch without a search, the fetch bucket binds first and the chunk runs past a limit it never measured. AD-8 says the client "paces against the tightest unsatisfied bucket," so the *client* is correct and the *runner's* chunk bound is wrong; the runner will plan a chunk the client then cannot execute, and the two units disagree about whether that is a yield (AD-8) or a completed chunk (AD-7).

Also arithmetic worth stating in the spine rather than leaving to inference: 1,500 entries at 600 searches/6h is **~15 hours for one full pass**, before the currency set. AD-12's sizing paragraph gives the daily figure but never states the resulting refresh latency, which is the number that determines whether AD-23's staleness risk is tolerable.

**Close with:** define the chunk bound as the minimum of remaining search and fetch budgets, and state the expected full-pass latency in AD-12 as a derived figure.

---

### N-11 — MEDIUM — AD-7's "exits immediately (non-zero, non-error)" is self-contradictory to every invoker

A non-zero exit code **is** the error signal for Task Scheduler, cron mail, and a CI runner — the three invokers AD-7 explicitly requires to work with no code change. Under AD-7 as written, the normal case (the previous run is still going) produces a failed scheduled task on every 15-minute tick.

**The pair.** U-SYNC-RUNNER exits `1` per the letter of AD-7; the deployment section's Task Scheduler configuration reports a permanently failing job, and a real failure is indistinguishable from a held lock. A second builder reads "non-error" as the operative half and exits `0`, at which point a CI invoker cannot distinguish "did work" from "did nothing" and a wrapper script that chains a deploy fires on every no-op.

**Close with:** exit `0` for a held lock with the fact recorded in `sync-report.json`, or a documented distinct code (e.g. `75`) with the invoker configuration that treats it as success.

---

### N-12 — MEDIUM — AD-24's performance budget is unmeasurable and unowned; and three independently cache-busted fetches have no consistency rule

AD-24: ranking "must complete **under 100 ms** on a mid-range machine and re-run synchronously on a threshold change." No definition of the workload it is measured against (1,500 entries? how many bases?), no machine, no measurement harness, and no CI gate — so it is a number that cannot fail. AD-2's own register ("fails CI via `dependency-cruiser`, not review") is the standard the rest of the spine sets; this AD does not meet it.

Separately: `dataset.json`, `sync-report.json` and `weights.json` are fetched as "separate cache-busted requests." Nothing requires them to be mutually consistent. A sync commit lands mid-load and `web` renders a new dataset against an old report; a weights file regenerated for a new `gamePatch` is served against a dataset synced under the old one, and `WEIGHTS-FILE-SCHEMA` explicitly surfaces `gamePatch` for exactly this reason without any AD saying what `web` does about a mismatch. `schemaVersion` is per-artifact and catches shape drift, not content epoch.

**Close with:** a stated benchmark input and a `pnpm check` gate; and a cross-artifact consistency rule (a shared epoch or commit id in all three, with a stated behaviour on mismatch).

---

### N-13 — MEDIUM — `core` "validates the file on load" contradicts AD-1

`WEIGHTS-FILE-SCHEMA`: "`core` validates the file on load and refuses to rank from an invalid one." AD-21's table: `data/weights.json` is "Read by: `core` via `web`." AD-1: no module in `core` may perform I/O.

The intent is clear — `web` fetches, `core` validates the parsed object — but "on load" and "read by `core`" are enough for an agent to put a `loadWeights(path)` in `core`, which `dependency-cruiser` will not catch because it checks package edges, not `node:fs` imports. This is F-21's mechanism (nothing constrains `core`'s runtime environment) with a document now actively inviting the violation.

**Close with:** reword to "`core` validates the parsed object it is handed"; add the F-21 `dependency-cruiser` rule restricting `core` to an explicit dependency allowlist, which closes both.

---

## Verdict

The rewrite closed the arithmetic. AD-17 and AD-18 are real ADs in the register of AD-1 and AD-2 — they state a formula, a unit, a comparison operator and a denominator, and the three-readings problem that dominated the prior review is gone. AD-21's one-writer table, AD-7's lock, AD-22's `CraftRecipe` home, AD-19's league filter and the two companion documents are all genuine closures of genuine holes, and `WEIGHTS-FILE-SCHEMA`'s pool-completeness clause is the strongest single paragraph in the set.

What the rewrite did not do is test its own new arithmetic against the representations it simultaneously introduced. The four CRITICALs above are all the same shape: **AD-18's probability model and AD-17's sum were specified for the magic prefix+suffix case, and every other case AD-5 now makes representable — a raw base, a partial affix, a nested floor, a mid-band floor, a recipe — enters that sum with a probability that is wrong, not missing.** A wrong probability ranks. A missing one does not. That is the same failure class the prior review named as the largest hole, relocated from the weights-to-identity seam to the identity-to-formula seam.

Four items from the prior closure list remain untouched (F-12, F-17, F-20, F-21) and two partial closures — the tie-break chain (F-13) and the undefined *sweep* (F-10, F-16) — are still sufficient on their own to produce two different ranked lists and two different budget reports from identical inputs.

**Not ready to build in parallel.** Prerequisites before a line of `core`: N-1, N-2, N-3, N-4, N-5, and the F-13 tie-break chain. Prerequisites before `sync` and `web` start concurrently: N-6, N-7, N-9, F-10's sweep definition, F-12 and F-17.
