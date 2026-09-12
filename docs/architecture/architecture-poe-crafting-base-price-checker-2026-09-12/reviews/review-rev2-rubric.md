---
title: 'Rubric Review — ARCHITECTURE-SPINE.md Revision 2'
reviewer: rubric walker
target: ARCHITECTURE-SPINE.md (revision 2, 27 ADs)
date: '2026-09-12'
verdict: revise
---

# Rubric Review — Architecture Spine, Revision 2

**Verdict: REVISE.** The revision does what it set out to do: BQ-1 (band identity), BQ-2 (item-level-scoped pool), BQ-3 (coverage gate) are each genuinely closed, and the RePoE removal leaves a clean source partition. The three new ADs are all real divergence points that were previously undefined, and AD-26 in particular closes a hole the word "rotation" had been papering over since revision 1.

But the amendment sweep was not complete. AD-3's two-artifact channel rule was amended for hand-owned files and **not** for the sync-owned catalogue that AD-25 introduced in the same revision — a direct contradiction between two ADs written in the same pass. AD-6 now requires `sync` to validate a file that AD-21, AD-12 and the system diagram all say `sync` never reads. And three of the newest rules (AD-26's retry bound, AD-27's coverage metric, AD-18's straddle error) name a check whose inputs or scope do not exist anywhere in the spine, so two builders will implement them differently while both believing they complied.

None of these are deep — they are all closeable inside the existing AD ids. Hence *revise*, not *not-ready*.

---

## 1. Does it fix the real divergence points for epics/stories?

**Mostly yes.** The spine's coverage of the genuinely divergence-prone feature-altitude decisions is strong: the valuation formula and its unit (AD-17, AD-20), the price estimator's exact search shape (AD-16), weight aggregation arithmetic (AD-18), the four-state price (AD-9), one writer per file (AD-21), the chunk contract (AD-7), and now rotation order (AD-26). These are the decisions that would have produced silently divergent implementations, and they are decided at the right level of specificity — an epic author can write stories against them.

Two divergence points remain **undecided**, both introduced or aggravated by revision 2:

### F-1 (HIGH) — How the eight fetched artifacts reach the deployed site is undecided

AD-24 decides *that* `web` fetches eight artifacts "at runtime as separate cache-busted requests" and that they are "never bundled into the JS, so a sync commit updates data without rebuilding the app."

But the artifacts live in `data/` at the repo root (Source tree), outside `packages/web`, and Deployment & environments says:

> "That push triggers a **GitHub Actions workflow** that builds the Vite bundle and deploys to Pages"

Two builders will resolve this differently and both will be consistent with the spine:

- copy `data/*.json` into the Pages artifact at build time and fetch them from a site-relative path — in which case **a sync commit does require a rebuild**, and AD-24's stated benefit is false;
- fetch them from `raw.githubusercontent.com` — which is a live cross-origin dependency on a third party at view time, rate-limited and uncacheable in the way AD-24 assumes, and arguably against the spirit of AD-15.

Nothing in the spine says which. The fetch *base path* is exactly the kind of cross-unit constant that AD-3 exists to pin, and it is unpinned. Decide it in AD-24.

### F-2 (MEDIUM-HIGH) — No payload budget for the fetched artifacts; `weights.json` is unsized

AD-24 sizes the *compute*: "Ranking the full tracked list must complete **under 100 ms**". It sizes nothing about the *payload*, even though revision 2 grew the fetch list from six artifacts to eight and made `weights.json` substantially larger (an `itemLevelMin`-bearing band per rollable modifier, and `poolCoverage: "complete"` requires enumerating **every** modifier including worthless ones — WEIGHTS-FILE-SCHEMA, pool-completeness rule).

The memlog itself measured the comparable trade artifacts: `/data/stats` at 853KB for 3,108 ids, `/data/items` at 186KB for 3,900 base types. A complete per-base, per-slot, per-band pool over the endgame base types is plausibly the largest single thing the browser loads, and AD-27's ≥80% success case is the case where it is *largest*. Whether `weights.json` is one monolithic fetch or sharded per base type is a structural decision that changes `web`'s loading model, its caching, and its first-paint behaviour — and it is silent. Two builders will diverge here on the first story that touches loading.

---

## 2. Is every Rule enforceable, and does it prevent its stated divergence?

Most Rules are genuinely mechanical: AD-2 names `dependency-cruiser` and says "fails CI via `dependency-cruiser`, not review"; AD-13 names `onUnhandledRequest: "error"`; AD-17's three summand-disjointness conditions are stated as "a **validation error on `data/tracked.json`**, rejected at load"; AD-18's whole-band containment test is written as literal predicates (`band.valueMin >= ref.valueMin` and `band.valueMax <= ref.valueMax`). This is the right standard and most of the spine meets it.

The following do not.

### F-3 (HIGH) — AD-26's retry bound has no state to check against, because AD-9 gives non-`priced` states no timestamp

AD-26 rule 3:

> "then `unresolvable` entries (AD-6) on a **bounded retry schedule** — at most one retry per entry per day"

To enforce "one retry per entry per day" the runner needs a *last-attempted* time per `unresolvable` entry. AD-9 says:

> "Every tracked entry's price is exactly one of `priced` (with a value and observation time), `no-listings`, `not-yet-synced`, or `unresolvable`."

Only `priced` is stated to carry a time. There is no field in any declared artifact that holds "when did we last retry this unresolvable entry". One builder will put it in `dataset.json`, another in `sync-progress.json` (AD-21 says that file is "internal to `sync`" — a plausible home), another will derive it from the git log. All three satisfy the text. The rule is not checkable as written.

### F-4 (HIGH) — AD-26 rule 2 and AD-9/AD-10 disagree on whether `no-listings` carries a timestamp, and the disagreement changes the rotation

AD-26 rule 2:

> "then `active` entries by **oldest `PriceObservation` first**, with `not-yet-synced` treated as infinitely old so a new entry is picked up before any refresh"

It names exactly one special case. AD-9 gives an observation time only to `priced`. So a `no-listings` entry has no `PriceObservation` to sort on either — and under the same "treat missing as infinitely old" logic AD-26 applies to `not-yet-synced`, every `no-listings` entry sorts to the front of every chunk, forever, re-issuing the same search that returned nothing and never acquiring a timestamp that would move it down the queue. That is a starvation loop that consumes the AD-12 search ceiling indefinitely, and it is fully consistent with the text.

AD-10 asserts the opposite of AD-9 on this point:

> "every price carries its observation timestamp and league"

Both cannot be right. The fix is small — say in AD-9 that *every* state carries an observation time, and drop AD-26's special case to a note — but as written the spine contains a contradiction whose resolution determines the sync's actual behaviour.

### F-5 (HIGH) — AD-27's coverage metric has an undefined denominator

AD-27:

> "The first build task is to generate the weights file and count the fraction of **endgame base types** resolving to `complete` pools."

"Endgame base types" is defined nowhere — not in AD-27, not in AD-5, not in the Consistency Conventions, not in WEIGHTS-FILE-SCHEMA, not in the catalogue AD-25 describes. The memlog records `/data/items` as carrying "3,900 base types across 10 category groups" with no endgame marker of any kind, and AD-25 is explicit that the catalogue carries "no per-base association, no tier, no item-level availability and no spawn weight."

So the denominator is a judgement call, and the *entire* consequence table hangs on it: the same weights file yields 90% against a curated denominator of the fifty bases anyone crafts, and 15% against all 3,900. Those land in different rows of AD-27's table — "Proceed as specified" versus "**The ranking premise fails. Escalate rather than ship**". An AD whose gate can be passed or failed by choosing the denominator is not a gate. Pin the denominator (the simplest honest choice: base types appearing in `data/tracked.json`, or an explicit named list committed alongside it).

### F-6 (MEDIUM-HIGH) — AD-18's straddle "validation error" has no stated scope, and the two documents that define it disagree on the blast radius

AD-18:

> "A weights-file band that straddles a tracked band edge is a **validation error**, not a pro-rata split"

Scope unstated. WEIGHTS-FILE-SCHEMA.md places the identical condition under **"Hard errors — refuse the file"**:

> "- **a band whose value edges straddle a band edge in use by `data/tracked.json`** — AD-18 aggregates whole bands only"

So one document implies a per-base condition and the companion says refuse the *whole* weights file. Under AD-3 (`web` "refuses to render an invalid artifact rather than degrading") refusing the file blanks the entire site. That means **a curator editing one band edge in `tracked.json` can blank the deployed site**, via a validation failure in a file the curator does not own (AD-21: `data/weights.json` is written by "an external producer"). That is a serious operational property to arrive at by implication.

It also sits badly beside AD-17, which enumerates three tracked-list validation errors and does not include the straddle — even though the straddle is a property of the *pair* and is at least as naturally a tracked-list error. Decide: whole-file refusal, or the affected base joins AD-18's unrankable group. Say it in one place and cite it from the other.

### F-7 (MEDIUM) — AD-24's performance rule is still unmeasurable, unchanged from revision 1

> "Ranking the full tracked list must complete **under 100 ms** on a mid-range machine"

"A mid-range machine" is not a check. The memlog's own stopping-point entry already conceded this — *"read-time perf budget is unmeasurable as stated"* — and revision 2 amended AD-24 for the artifact count without touching it. Either name the harness (a Vitest benchmark over a synthetic 1,500-entry list, run in CI, failing over a fixed ms budget on the CI runner) or move it to Deferred as an aspiration. As written it prevents nothing.

### F-8 (LOW-MEDIUM) — AD-1's clock/randomness ban is reviewable only

AD-1 forbids `core` to "perform I/O, read the clock, generate randomness, or read environment/config directly." The import-graph half is caught by AD-2's `dependency-cruiser`. `Date.now()`, `Math.random()` and `process.env` are globals, not imports, and no enforcement is named for them anywhere in the spine; AGENT-WORKFLOW asserts "nothing calls `Date.now()` below the shell" without saying what stops it. One ESLint `no-restricted-globals` / `no-restricted-properties` block scoped to `packages/core` makes this mechanical, and AD-1 is the single most load-bearing invariant in the paradigm — it should not be the one on the honour system.

---

## 3. Could anything under Deferred let two units diverge?

**Largely clean.** Each Deferred item names the AD that decides the v1 behaviour in its absence, which is the correct discipline: `itemLevelMin`-as-ranking-key defers to AD-17's uniformity rule; mod-group conditionality defers to AD-18's stated independence assumption; coarser fallback pricing defers to AD-9's segregation; price history defers to AD-14. None leaves a hole a builder must fill by invention.

One soft spot:

### F-9 (LOW) — The RePoE deferral stamps the wrong field's provenance

> "RePoE fills gaps in `itemLevelMin` or pool membership only where nothing better exists, and what it fills is stamped `uniform-prior`, never `measured`."

`provenance` in WEIGHTS-FILE-SCHEMA is a per-entry field documented against the *weight* ("raw spawn weight... `provenance`"). A band whose weight is genuinely measured but whose `itemLevelMin` was guessed has one field for two independent provenances, and this deferral instructs the producer to downgrade the weight's label to record an item-level uncertainty. That is lossy in the direction that matters to AD-10's propagation. Not a v1 blocker — the producer is outside the app — but worth one sentence saying which reading governs, since AD-11 makes this file a contract.

---

## 4. Is named technology verified-current?

**Clean.** The memlog records a full registry sweep dated 2026-09-12. Two independent spot-checks against the live npm registry today confirm it:

- `typescript-eslint@8.70.0`, `peerDependencies.typescript: ">=4.8.4 <6.1.0"` — exactly as the spine's upgrade-trigger note states, and it does confirm that no published line accepts TS 7. Pinning TS 6.0.3 with a documented trigger is the right call and the stated reason is factually correct.
- `vite@8.3.0` — matches.

The upgrade-trigger note is the right shape: it names the blocker, the observable condition that clears it, and the fact that nothing else in the stack is coupled ("`dependency-cruiser` does not depend on the TypeScript compiler API at all"). No finding.

---

## 5. Is every dimension the altitude owns decided, deferred, or open?

The operational/environmental envelope is **present and specific**, which is the common failure mode and is avoided here: Deployment & environments names one environment, the invoker (Task Scheduler), why the Actions workflow is mandatory rather than optional ("branch-published Pages runs Jekyll and cannot build this app"), the absence of secret material as a *measured* fact, the local dev story, and — new in revision 2 — the two recurring maintenance dependencies with their cadence and their failure mode. Observability is decided-by-exclusion (AD-24 report + "Observability beyond the run report" under Deferred). Testing, config, error shape, encoding, precision and schema versioning all have Consistency Convention rows.

Two thin spots, neither a full silence:

### F-10 (MEDIUM) — The currency sync has no place in AD-26's ordering, though AD-20 orders it first

AD-26 claims completeness — "`sync` selects entries in exactly this order" — and lists four categories, all of them tracked entries. AD-20 requires:

> "**Currency rates are synced before any priced entry in the same chunk**"

and AD-12 declares `data/currencies.json` a co-equal recurring workload. So the currency step is mandatory, budget-consuming, and ordered *ahead of* everything AD-26 enumerates, yet AD-26 — the AD whose whole job is "which requests does this chunk issue, in what order" — does not mention it. A builder reading AD-26 as authoritative writes a chunk runner that never syncs rates. Add it as step 0.

Related and unresolved: AD-20 mandates rates be synced "in the same chunk" as any priced entry, and the memlog records ~40 currency ids. At the chunk frequency AD-7 implies, that is a recurring per-chunk cost against AD-12's ceiling that nobody has arithmetic for. AD-12 reserves "headroom for retries, the currency set, the catalogue refresh and a second recipe" as one undifferentiated ~900-search block. Consider whether rates need a staleness window rather than a per-chunk refresh.

### F-11 (LOW) — Schema migration is versioned but has no procedure

The Schema versioning convention says "A consumer refuses an unknown major rather than guessing." Correct, but it describes the failure, not the transition: when `contracts` bumps `dataset.json`'s major, the deployed `web` refuses the committed dataset and the site goes blank until a sync run rewrites it — and AD-7 makes sync *chunked*, so the rewrite is not atomic. Whether a schema bump forces a full-dataset rewrite in one run (violating the chunk bound) or leaves a mixed-version dataset (which the single file-level `schemaVersion` cannot express) is undecided. Low, because it is a once-in-a-while event, but it is a foreseeable outage with no stated procedure.

---

## 6. Internal consistency

### F-12 (CRITICAL) — AD-3 and AD-24/AD-25 contradict each other on the sync→web channel

This is the most serious finding in the review, and it is a pure revision-2 artefact: AD-3 was amended to carve out hand-owned files, and the sync-owned catalogue introduced in the *same* revision was not accounted for.

AD-3:

> "`sync` communicates to `web` through exactly two **sync-produced** artifacts, `dataset.json` and `sync-report.json`, and nothing else — `sync-progress.json` is internal to `sync` and is read by nothing else. (`web` additionally reads **hand-owned input files** directly, per AD-24; those are not a sync→web channel and carry no sync state.)"

AD-24:

> "`web` **fetches** exactly eight artifacts at runtime ... `catalogue/stats.json` and `catalogue/static.json`"

AD-21's writer table:

> "| `data/catalogue/*.json` | `sync`, on an explicit refresh command only (AD-25) | `sync`, `core` via `web` |"

The catalogue files are **sync-written and web-read**. They are not hand-owned, so AD-3's parenthetical does not cover them, and AD-3's "exactly two sync-produced artifacts ... and nothing else" is therefore false on its face. AD-3 closes with "Adding a third artifact requires amending this AD" — and revision 2 added two without amending it.

This matters beyond bookkeeping. AD-3's whole purpose is that "a second, unversioned side channel appearing without anyone deciding to create one" is the top divergence risk. A rule that is already violated by the spine that contains it will not stop the fourth channel. Amend AD-3 to state the channel as *sync-produced artifacts `web` may read*: `dataset.json`, `sync-report.json`, `catalogue/stats.json`, `catalogue/static.json` — with `sync-progress.json`, `catalogue/items.json` and `catalogue/filters.json` explicitly sync-only.

### F-13 (HIGH) — AD-6 requires `sync` to validate `data/weights.json`, which AD-21, AD-12 and the system diagram all say `sync` never reads

AD-6:

> "Every `statId` and `baseTypeId` in `data/tracked.json` **and `data/weights.json`** is checked against the committed catalogue (AD-25) **before any request is issued**."

"Before any request is issued" places this in `sync`'s startup path. But:

- AD-21's table gives `data/weights.json` the readers "`core` via `web`" — `sync` is not among them;
- AD-12 defines sync's inputs as "the union of exactly two schema-pinned, committed files: `data/tracked.json` and `data/currencies.json`", plus the catalogue as a third declared source — weights is not one;
- the system-view diagram draws `weights --> web` and has no `weights --> sync` edge;
- WEIGHTS-FILE-SCHEMA places the same check in `web`/`core`: "Reading the file is an adapter's job in `web`; validating the already-loaded value is a pure function in `core`."

Four places say weights is a read-side input; AD-6 says sync validates it pre-flight. Either `sync` gains weights as a declared input (with AD-12 and AD-21 amended and the diagram redrawn) or AD-6 drops `data/weights.json` from its clause and leaves that validation to the load-time path the companion already specifies. As it stands, one builder wires weights into the syncer and another does not, and neither is contradicting the spine.

### F-14 (MEDIUM) — `TradeCatalogue` was added to AD-22 and not to the Naming convention

AD-22 enumerates the boundary-crossing concepts and includes the new one:

> "`BaseType`, `TrackedEntry`, `ModifierRef`, `PriceObservation`, `ModifierWeight`, `CraftRecipe`, `CurrencyRate`, `SyncRunReport`, `RankedBase`, **`TradeCatalogue`**"

The Consistency Conventions "Naming — entities" row repeats the same list and stops one short:

> "`BaseType`, `TrackedEntry`, `ModifierRef`, `PriceObservation`, `ModifierWeight`, `CraftRecipe`, `CurrencyRate`, `RankedBase`, `SyncRunReport`. Singular, PascalCase, defined once in `contracts` (AD-22)."

A duplicated list that drifted in exactly the revision that changed it. The ER diagram *does* carry `TradeCatalogue`, so the convention row is the sole straggler. Either add it or — better, since the duplication is what rotted — replace the row's list with a pointer to AD-22.

---

## 7. Revision coherence — stale text from before the band / `itemLevelMin` change

This is where the revision is weakest, and the findings below are in addition to F-12, F-13 and F-14 above, all of which are also rev-2 amendment leftovers.

### F-15 (MEDIUM) — AD-17 cites "AD-5's fourth field"; AD-5 now spells it second

AD-17, summand rule 3:

> "**Differing `itemLevelMin` across entries on one `baseTypeId`.** This is the case **AD-5's fourth field** introduced and the first two rules do not catch"

AD-5 as amended reads:

> "A tracked entry is `(baseTypeId, itemLevelMin, prefix?, suffix?)`"

`itemLevelMin` is the **second** element, not the fourth. "Fourth field" is the pre-amendment ordering, where it was appended to `(baseTypeId, prefix?, suffix?)`. A cross-reference that points at a position the cited AD no longer has — a small thing, but it is literally the class the checklist asks about, and it will confuse whoever implements the tuple.

### F-16 (MEDIUM) — AD-12's search-accounting sentence is self-contradicting band-era residue

> "One tracked entry costs one search — so entry count equals search count **only while no modifier is split across bands**. Since AD-5 makes bands the unit of identity, isolating a jackpot tier means tracking two entries where one stood, and **that second band spends from the same ceiling**."

The first clause defeats itself. If one entry costs one search, then entry count equals search count *always* — including after a split, which produces two entries and two searches. The conditional "only while no modifier is split across bands" is false under its own premise.

The point the AD is reaching for is correct and important — splitting a band means the *tracked-list size* no longer tracks the *number of distinct modifiers being watched*, so a curator's mental model of "I watch N modifiers" diverges from the budget. But the sentence as written states something arithmetically wrong, and a budgeting rule that is wrong on its own arithmetic will not survive contact with the first curator who checks it. Rewrite as: one entry costs one search always; what changed is that one *modifier* may now cost two entries.

### F-17 (LOW-MEDIUM) — The Units convention still says "value floors", pre-band vocabulary

> "| Units | Divine for all currency (AD-20). **Value floors are raw game numbers.** No unit is implied by a field name alone — schemas name the unit. |"

Under AD-5 a modifier reference has *band edges*, inclusive on both sides, not a floor. "Value floor" is the exact term the band amendment abolished — AD-5's own heading is "**Why a band, not a floor**". The adjacent "Item level" row uses `itemLevelMin` correctly (item level genuinely is a floor), which makes the surviving "value floors" more confusing, not less: a reader now has two different things called floors, one of which no longer exists. Should read "band edges (`valueMin`/`valueMax`) are raw game numbers."

### F-18 (LOW) — The system-view diagram is missing two of AD-24's eight fetched artifacts

AD-24 has `web` fetching `tracked.json` and `config.json` among the eight, and AD-21's table gives both the reader "`sync`, `web`". The system-view diagram draws `tracked --> sync` and `config --> sync` but no edge from either to `web`; only `weights`, `recipes`, `report`, `dataset` and `catalogue` reach `web`. The diagram was updated for the catalogue in this revision and not reconciled against the rest of AD-24's list. Two missing edges.

---

## What would close this

In rough order of value:

1. **Amend AD-3** to name the four sync-produced artifacts `web` may read (F-12). This is the one that must not ship as-is, because the violated rule is the spine's primary anti-divergence device.
2. **Settle where `weights.json` is validated** — read side only, most likely — and align AD-6 with AD-12, AD-21, the diagram and the companion (F-13).
3. **Give AD-9 a timestamp on every state**, which simultaneously closes F-4's contradiction with AD-10 and F-3's missing retry state, and lets AD-26 lose its special case.
4. **Pin AD-27's denominator** (F-5) — one sentence, and the gate becomes a gate.
5. **Decide the straddle blast radius** in one place (F-6), and **decide the artifact fetch path** in AD-24 (F-1).
6. Sweep the residue: AD-12's arithmetic sentence (F-16), AD-17's "fourth field" (F-15), the Units row (F-17), the entity list (F-14), the two diagram edges (F-18).
7. Either measure or defer AD-24's 100 ms (F-7); add step 0 to AD-26 for the currency sync (F-10).

Items 1–4 are the ones that change what gets built. The rest are hygiene, but the hygiene items are all in text that revision 2 touched, which is the reason to fix them now rather than to carry them into revision 3.

## What is genuinely good, and should not be lost in a rewrite

- **AD-5's "Why a band, not a floor" paragraph.** It states the defect in terms of its *consequence* ("the jackpot was not understated but *deleted*") rather than as a shape change. That is the kind of rationale that stops a future editor from "simplifying" the rule back.
- **AD-18's refusal to pro-rata a straddling band.** Declining to invent arithmetic that cannot recover lost information, and pushing the constraint onto the producer, is exactly right.
- **AD-27 as a gate with consequences rather than an open question**, and stated source-agnostically so it survived the RePoE removal without an edit. Promoting an unknown to a measured gate with pre-committed responses is the single best move in this revision.
- **AD-25's closing paragraph** — "The catalogue is an identity and validation authority, never a pool authority" — pre-empts the exact wrong turn an agent would take.
- **AD-18's "Recipe has no distribution term in v1"** naming itself "a stated limitation, not a formula with an empty slot for `core` to fill by invention." That sentence is doing real work.
