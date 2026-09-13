---
title: 'Adversarial Architecture Review — ARCHITECTURE-SPINE.md revision 3'
type: review
target: ARCHITECTURE-SPINE.md (revision 3, 2026-09-13)
companions_reviewed: [WEIGHTS-FILE-SCHEMA.md]
scope: 'Narrow amendment: AD-26 pinned cap + rotation precedence, AD-27 rankable denominator, AD-11/AD-18 required valueMax — and their seams with AD-5, AD-6, AD-7, AD-8, AD-9, AD-12, AD-16, AD-19, AD-20, AD-21, AD-23, AD-24'
method: 'divergence construction — two conforming units, one incompatible outcome'
created: '2026-09-13'
status: draft
---

# Adversarial Review — Revision 3

## Method

For each finding I construct **two units one level down** — two agents building two packages, or two epics — that each obey **every AD to the letter** and still produce artifacts or behaviour that cannot coexist. A pair that can be constructed is a hole in the spine, not a mistake by either builder. Severity is weighted heavily toward **silent** divergence: a pair that ends in a crash or a refused artifact costs a day; a pair that ends in a differently-ordered ranked list, or a differently-distributed staleness profile, that both units believe is correct costs the product's credibility.

Revision 3 is a narrow amendment and I have kept the attack narrow. Findings live in the amended text of AD-11, AD-18, AD-26 and AD-27, and in the seams where that text meets AD-5, AD-6, AD-7, AD-8, AD-9, AD-12, AD-16, AD-19, AD-20, AD-21, AD-23 and AD-24. I have not re-litigated revision 2's closed findings except where revision 3's new material leans on one that was closed *differently* than the rev-2 review proposed — which happens twice, and both times it matters.

**Verdict: not closed.** Revision 3's four amendments are each correct in their own terms and each an improvement. But three of them close an *authoring-time* hole with a load-time validator while leaving the *runtime* half of the same rule with two legal implementations, and the fourth closes the `valueMax` hole **syntactically** (a required field) rather than **semantically** (a ceiling that means something), which leaves BQ-1 reachable by a curator typing a large number. Sixteen divergences are constructible; four are critical and all four fail silently.

## Severity summary

| # | Finding | ADs implicated | Severity |
| --- | --- | --- | --- |
| 1 | A required `valueMax` still admits a **sentinel ceiling** — BQ-1 returns, unvalidated by anyone | AD-5, AD-11, AD-16, AD-18 | **Critical** |
| 2 | Zero-request offline retries and `lastAttemptedAt`: the retry bound defeats both of its own stated purposes, either way it is read | AD-26.3, AD-9, AD-6 | **Critical** |
| 3 | The runtime pinned check says what to **record**, not what to **do** — rev-2 finding 6a survives as a *reported* condition with two legal behaviours | AD-26, AD-7, AD-23 | **Critical** |
| 4 | AD-27's numerator is **vacuously true** for a base absent from the weights file; one pair of files yields 100% or 40% | AD-27, AD-18, companion | **Critical** |
| 5 | The load-time cap has no unit that can evaluate it — `web` never fetches `currencies.json` | AD-26, AD-24, AD-21, AD-3 | **High** |
| 6 | `count(currencies.json)` counts currencies; AD-12 says the cost is "small, fixed" — and the runtime half omits currencies entirely | AD-26, AD-12, AD-20 | **High** |
| 7 | The **open bottom** is wholly unconstrained — the mirror of finding 1, never discussed | AD-5, AD-16, AD-18 | **High** |
| 8 | `pinned` **and** `unresolvable`: the new precedence paragraph resolves only the `active` case | AD-26, AD-23, AD-6 | **High** |
| 9 | `minChunkSearches` is player-declared, unvalidated, search-only, and unrelated to the binding bucket | AD-26, AD-19, AD-8, AD-7 | **High** |
| 10 | The pinned-starvation line has no schema and no consumer obligation; AD-26 binds `web` and asks nothing of it | AD-26, AD-22, AD-3, AD-24 | **High** |
| 11 | `sync-progress.json` has no defined reset point, so "every pinned entry, each chunk" is undefined across a resumed run | AD-26, AD-7, AD-21 | **Medium-High** |
| 12 | AD-27 excludes `pruned` but not `unresolvable`, by a reason that applies identically to both | AD-27, AD-6, AD-23 | **Medium** |
| 13 | Row 3 vs row 4: a `pruned` + `unresolvable` entry, under the new "two different fields" framing | AD-26, AD-23 | **Medium** |
| 14 | Coverage is an unowned one-off with no re-measure trigger, and 80% falls in two bands | AD-27 | **Medium** |
| 15 | Load-time and runtime halves use two different definitions of "progress"; bucket and exit code undefined | AD-26, AD-7, AD-8 | **Medium** |
| 16 | AD-19's "`minChunkSearches` and nothing else" collides with the `schemaVersion` convention | AD-19, Conventions | **Low** |

---

## 1 — CRITICAL: a required `valueMax` closes the *syntax* of an open top, not its *semantics*

Revision 3 removed `valueMax?` from AD-5, AD-11 and AD-18 and says so in three places: *"required, everywhere, with no open-top form"*, *"every field required and none nullable"*, *"`contracts` rejects it at the schema"*. That closes a **missing field**. It does not close an **open-topped band**, because nothing in the system checks what the value means.

### The two units

- **Epic A — "Search construction" (`sync`).** Implements AD-16's stat-filter row: *"one per modifier reference, carrying **both `min` and `max`** from the band"*. The band has a `max`. A sends it.
- **Epic B — "Weight aggregation" (`core`).** Implements AD-18: the reference's weight is *"the sum of the weights of every weights-file band with that `statId` that lies wholly inside it"*. B sums.

### The AD each obeyed

Both to the letter, and so does the curator. AD-5 tells a curator wanting *"T1 and everything above"* to write *"the real ceiling, not a blank"* — but the real ceiling is a fact **only the weights file knows**, and the curator does not read it as a spreadsheet. So they write `valueMax: 9999`, or `99999`, or `1e6`. Every schema accepts it: `contracts` requires the field to be present and a number, and nothing bounds it.

Now walk every validator the spine owns:

- AD-18's **straddle** rule fires on a weights band that crosses a tracked band edge. With a ceiling of 9999, every band of that `statId` lies strictly below the top edge, so nothing straddles it.
- AD-18's **containment** rule is `band.valueMax <= ref.valueMax` — satisfied by every band.
- AD-18's **empty containment set** error needs an *empty* set; this set is maximal.
- AD-17's **partition** predicate rejects *intersecting* bands in the tracked list. If the curator tracks only this one band on that `statId`, nothing intersects.
- The companion's hard-error list rejects a missing or `null` `valueMax`. This one is neither.

### The incompatible outcome

`(stat_X, 80, 9999)` against a weights file holding `(80..89, ilvl 82, w 1200)` and `(90..99, ilvl 84, w 400)`:

- **Epic B** sums both bands: two tiers of probability mass.
- **Epic A** issues a stat filter of `min: 80, max: 9999`. A `max` above every real roll is **operationally identical to a min-only filter** — AD-16's own third trap: *"a min-only filter returns every higher tier too and prices the band at its floor."* Sorted **ascending**, the median of the cheapest ten is the ilvl-82 tier's price.

Two tiers' probability at one tier's price. That is **BQ-1 verbatim**, including its worst consequence: if the blended price falls below the payout threshold, the entry truncates out of AD-17's sum and takes the top tier's mass with it — the jackpot is not understated, it is deleted. Revision 3's stated purpose was to make this unreachable. It is reachable by typing a large number, and nothing anywhere reports it. The dataset is schema-valid, provenance is `measured`, and `sync-report.json` is clean.

The rev-2 review proposed making topmost-ness *checkable against the weights file* (rev-2 finding 3, tightening 1). Revision 3 took the other branch — delete the open form — which is cleaner in the schema and leaves the semantic check unbuilt. The check is still needed; only its trigger changed.

### The aggravating ordering problem

Even if the check is added, note **which unit can perform it**. `sync` builds the AD-16 search and does not read `weights.json` (AD-12 declares four sources, none of them the weights file; AD-21's reader column assigns it to "`core` via `web`"). So `sync` prices `min..9999` on Monday and `core` refuses the configuration in the browser on Tuesday — after the observation is written, committed, and ranked. The validator and the actor are in different processes on different days.

### The tightening

> **AD-5 amendment.** A tracked reference's edges must **align to band edges declared in the weights file**: there must exist a band of that `statId` in the base's slot with `band.valueMin == ref.valueMin`, and a band with `band.valueMax == ref.valueMax`. A ceiling above every declared band is an open top by another name and is a **validation error on `data/tracked.json`**, not a wide band. Alignment is a property of the two files read together, re-checked whenever either changes.
>
> **AD-6 / AD-12 amendment.** Give that check an owner that can run it *before a request is issued*: make the tracked↔weights cross-validation a single pure function in `core`, invoked by `sync` in its pre-request pass and by `web` on load, and add `data/weights.json` to `sync`'s read set (it costs no requests and is already committed). One function, two callers, one verdict.

Both halves are required. Without the first the check has no rule; without the second it has no owner that runs early enough to stop a wrong price being written.

---

## 2 — CRITICAL: `lastAttemptedAt` on a zero-request retry, and a bound that defeats itself either way

Revision 3 rewrote *why* the `unresolvable` retry bound exists: it is **not** budget protection, because AD-6 detects unresolvability **offline** against the committed catalogue before any request. Two purposes are retained: *"it paces re-validation so a large unresolvable set does not re-check and re-report every chunk"*, and *"it keeps row 3 beneath row 2 so entries recovering after a catalogue refresh rejoin the rotation without displacing it."*

Both purposes rest on one undefined fact.

### The two units

- **Epic A — "Chunk runner" (`sync`).** Implements AD-9: *"Every entry also carries `lastAttemptedAt`, in all four states … `lastAttemptedAt` records when `sync` last worked on the entry regardless of outcome."* A re-runs the offline catalogue check on a row-3 entry, finds it still unresolvable, and **stamps `lastAttemptedAt`** — `sync` worked on the entry; the outcome was negative; AD-9 says the field is exactly for that.
- **Epic B — "Rotation selector" (`core`, per AD-26's *"`sync` computes it through `core`"*).** Reads AD-9's sibling sentence — *"`observedAt` exists only where there is an observation"* — and its own rationale that `lastAttemptedAt` exists because AD-26's rotation and AD-6's retry need *attempt* state. B reasons that an offline check against a committed file is not an attempt on the trade API: no request left the process, no allowance was spent, AD-12 accounts for **requests consumed per source** and this consumed none. B **does not stamp** it.

### The AD each obeyed

AD-9 says "worked on the entry regardless of outcome" and AD-26 says the bound is "measured from that entry's `lastAttemptedAt`", and neither says whether a zero-request offline check is an attempt. Before revision 3 this was invisible, because the old rationale assumed a retry spent a search — and a spent search is unambiguously an attempt. **Revision 3's correction of the rationale is what creates the ambiguity**: once the retry is free, "attempt" stops having an obvious referent.

### The incompatible outcome — and it is a dilemma, not a preference

**Under Epic B (no stamp)** the entry's `lastAttemptedAt` never advances, so the 24h window is *always* elapsed, so row 3 selects the entry **every chunk**, re-checks it and re-reports it — which is precisely and exclusively the thing the bound's first stated purpose says it prevents. A 300-entry unresolvable set after a patch re-reports 300 lines in every chunk, every fifteen minutes, forever. The bound is a no-op.

**Under Epic A (stamp)** the first purpose is served and the **second is inverted**. When a human finally runs `catalogue:refresh` and 200 ids resolve again, those entries are now the *freshest* `lastAttemptedAt` values in the file. Row 2 is oldest-first. So they rejoin at the **back** of the rotation and wait a full cycle for a price — the recovered entries are the *last* to be refreshed, not the first. Read the other way, if a builder concludes that a recovered entry should not be penalised for its offline re-checks and resets it to `not-yet-synced` (which row 2 treats as *infinitely old*), 200 entries jump to the **front** and consume the next several chunks entirely, displacing the rotation — which the amendment explicitly claims not to do.

So: one reading makes purpose 1 fail, the other makes purpose 2 fail in one of two opposite directions, and all three produce schema-valid datasets with materially different staleness distributions from identical inputs and identical clocks.

### There is a third divergence hiding underneath

Which state does the selector classify on — the **stored** price state in `dataset.json`, or the **verdict of this run's offline catalogue check**? A newly curated entry with a mistyped `statId` is `not-yet-synced` in the dataset (row 2, infinitely old, front of the queue) and `unresolvable` in this run's check (row 3, 24h-bounded). Epic A classifies from the dataset and surfaces the typo in the very next chunk; Epic B classifies from the live check and may not surface it for 24h. The two also disagree on whether the entry consumed a row-2 slot.

### The tightening

> **AD-9 amendment.** `lastAttemptedAt` advances **whenever `sync` evaluates the entry**, including an offline catalogue check that issues no request. State it in the field's definition; the word "attempt" otherwise reads against the request, and revision 3 removed the request.
>
> **AD-26 amendment.** Row 3 orders and bounds on `lastAttemptedAt` as stamped above. A **recovering** entry — one whose ids resolve again after a catalogue refresh — re-enters row 2 with its `lastAttemptedAt` intact (it is neither reset nor privileged), so it rejoins at its true position rather than at either end. Say which of the three behaviours is intended; the rationale currently asserts an outcome that no stated mechanism produces.
>
> **AD-26 amendment.** Row assignment is computed from the **price state this run would write** — the offline check runs first and its verdict, not the stored state, drives selection — so a freshly-mistyped entry is reported in the chunk that first sees it.

---

## 3 — CRITICAL: the runtime pinned check says what to *record*, not what to *do*

This is the load-bearing half of revision 3's AD-26 amendment, and it is the half that specifies an artifact rather than a behaviour.

### The two units

- **Epic A — "Chunk runner" (`sync`).** Implements AD-26 row 1: *"then every `pinned` entry, each chunk, without exception — this is what `pinned` means, subject to the cap below"*, plus the preamble *"stops when any bound in AD-7 is reached"*, plus the runtime rule: *"`sync` completes the chunk and records a pinned-starvation line in `sync-report.json` naming the shortfall."*
- **Epic B — "Rotation selector" (`core`).** Implements the same three sentences, and additionally the amendment's own stated rationale: *"an oversized pinned set starves both its own tail **and the rotation below it**."*

### The AD each obeyed

The runtime rule is a **detection and reporting** rule. It defines a predicate (allowance < pinned + 1 active), an action on the report, and two words about the run — *"completes the chunk"*. It does not say **which entries the starved chunk selects.** So:

- **Epic A** reads "without exception" as still governing: spend the whole allowance on `pinned`, in canonical key order, record the line, exit. The `active` rotation advances **zero entries** this chunk — and every chunk, since the condition is a property of the tracked list and the allowance, not of the moment. The rotation is frozen permanently; every non-pinned row ages without bound while the report faithfully says so.
- **Epic B** reads the rationale as the requirement: truncate the pinned pass so at least one `active` entry is always funded, record the line, exit. The **tail of the pinned set is never refreshed** — and because canonical key order is the only stated intra-pinned ordering, it is the *same* tail every chunk, forever.

Both are schema-valid. Both record the mandated line. They produce opposite staleness distributions from one tracked list, one config and one clock, and AD-26's opening sentence names exactly this class of divergence as the thing it exists to prevent: *"two builders implementing 'which entries does this chunk refresh?' differently … which would silently change how stale any given row is while every artifact stayed schema-valid."*

### Why the load-time cap does not rescue it

The amendment argues, correctly, that *"a load-time cap alone cannot be sound, because a chunk's real allowance is discovered at runtime from live rate-limit headers … and no compiled-in or declared number governs it."* That argument concedes that a tracked list passing the load-time cap **can still starve at runtime** — AD-8's buckets are shared, penalised and recovering, so a chunk's real allowance is routinely a fraction of `minChunkSearches`. The starved case is therefore not an edge case, it is a Tuesday. And in that case AD-26 row 1's "without exception" and AD-7's stop condition still contradict each other exactly as they did in revision 2, with the report line now describing the contradiction instead of resolving it.

Revision 2's finding 6a is half-closed: the **authoring** error is now catchable; the **runtime** behaviour is not specified at all.

### Intra-pinned ordering is now load-bearing again

The rev-2 tightening for 6a ended: *"because the whole set fits in a chunk by construction, intra-pinned ordering is never load-bearing."* Revision 3 explicitly admits the set may not fit at runtime — which makes intra-pinned ordering load-bearing again, and AD-26 gives it only *"ties break on the canonical entry key"*. Is every `pinned` entry a tie (no sort key stated for row 1 → canonical key order → the same leading N forever), or does row 2's oldest-first principle apply within row 1 (→ pinned entries rotate, contradicting "each chunk")? Two builders, two answers, and the answer decides whether a curator's most important row is refreshed hourly or never.

### The tightening

> **AD-26 amendment — starved-chunk selection.** When the discovered allowance cannot fund the pinned set plus one `active` entry, the chunk selects, in order: step 0 (currencies), then `pinned` entries **by oldest `lastAttemptedAt` first** until one search of allowance remains, then one `active` entry. The rotation therefore always advances by at least one, and the pinned set rotates rather than truncating at a fixed prefix. Record the starvation line. `pinned` then means *"first in every chunk, and refreshed every chunk whenever the chunk can afford it"* — amend AD-23's one-line definition to match, because "without exception" is a promise the rate limiter can break and the spine should not repeat it.
>
> **AD-26 amendment — intra-pinned order.** State the row-1 sort key explicitly (oldest `lastAttemptedAt`, ties on canonical key). It is unobservable when the set fits and decisive when it does not.

---

## 4 — CRITICAL: AD-27's numerator is vacuously true for a base the weights file never mentions

Revision 3 narrowed the **denominator** (`rankable`) with care and left the **numerator** — *"both slots poolCoverage 'complete'"* — in the same one-line form it had before. The narrowing makes the numerator's ambiguity decisive, because the fraction now has a smaller denominator and the same 50%/80% cliffs.

### The two units

- **Epic A — "Coverage measurement"** (AD-27's pre-view build task).
- **Epic B — "View design"**, which AD-27 binds to one of three layout consequences by the number A reports.

### The AD each obeyed

Both obey AD-27. The predicate *"both slots `poolCoverage` 'complete'"* is a universal quantifier over a base's slots, and revision 3 did not say what it means for a base with **no slots in the file**.

- **Agent A** implements `∀ slot ∈ slots(base) : coverage == "complete"`, which is **vacuously true** for a base absent from `weights.json`. AD-18 says an absent base is unrankable; AD-27's numerator, written as a property of declared coverage, does not.
- **Agent A′** implements "the base is present **and** both named slots are `complete`."

A weights file covering 40 of 100 tracked crafted bases yields **100%** under A and **40%** under A′. AD-27 says ≥80% *"proceed as specified"* and <50% *"the ranking premise fails. Escalate rather than ship."* Same two committed files, opposite build decisions, and AD-27 is a **build-sequencing gate**, so the cost of the wrong reading is a committed layout — the exact cost AD-27 exists to avoid.

### The second instance: `complete` but empty

The companion's own worked example ships `"suffix": { "poolCoverage": "complete", "entries": [] }`. The companion separately lists *"a slot with an empty pool"* as **degraded but loadable — the base is excluded from the ranked ordering**. So a declared-complete-and-empty slot is simultaneously `complete` (AD-27's numerator counts it) and unrankable (AD-18 excludes the base). AD-27's numerator then counts a base that can never appear in the ordering it is measuring — which contradicts the amendment's own stated purpose: *"the question is how much of what the curator wants ranked can be ranked."*

Agent A measures **declared coverage**; Agent A″ measures **actual rankability under AD-18** by running the ranking and counting the unrankable group. These are different numbers by construction, and the second is the one the gate's prose describes.

### The tightening

> **AD-27 amendment.** Define the numerator as *rankability under AD-18*, not as a declaration:
>
> `coverage = |{ b ∈ rankable : core ranks b }| / |{ b ∈ rankable }|`
>
> where "core ranks b" is the actual predicate AD-18 applies — present in the weights file, both slots `poolCoverage: "complete"`, neither slot's scoped pool empty at the base's crafted `itemLevelMin`. A base absent from the weights file is **not** complete; a `complete` slot with no bands that can roll at the entry's floor is **not** complete. The measurement is then a call into the same `core` function the product uses, so the gate and the product cannot disagree — which is also the only version that survives a change of producer.

That last property matters: measuring *declared* coverage measures the producer's self-report, and AD-27 says the rule *"binds whatever produces the weights file."* A gate that a producer can pass by writing a string is not a gate.

---

## 5 — HIGH: the load-time cap has no unit that can evaluate it

### The two units

- **Epic A — "Sync workload validation" (`sync`).** Reads `tracked.json`, `currencies.json` and `config.json` (AD-21's first row, AD-12's declared sources). A can evaluate `count(pinned) + count(currencies.json) ≤ 0.5 × config.minChunkSearches` and does, before any request.
- **Epic B — "Web data loading" (`web`).** AD-3: *"`web` validates on load and refuses to render an invalid artifact rather than degrading."* AD-24 enumerates **exactly eight** fetched artifacts: `dataset.json`, `sync-report.json`, `weights.json`, `recipes.json`, `tracked.json`, `config.json`, `catalogue/stats.json`, `catalogue/static.json`. **`currencies.json` is not among them.**

### The AD each obeyed

Both to the letter, and they cannot both satisfy the new rule. The cap is declared *"a `tracked.json` validation error"* — and `tracked.json` is an artifact `web` fetches and validates. But the cap is a **cross-file** predicate over three hand-owned files, one of which `web` is forbidden to fetch. Meanwhile AD-21's reader column says `currencies.json` is read by *"`sync`, `web`"* — so AD-21 and AD-24 disagree about `currencies.json` exactly as the rev-2 review showed them disagreeing about `catalogue/items.json` (rev-2 finding 4), a disagreement revision 3 did not repair and has now made load-bearing for a second file.

### The incompatible outcome

A player pins 40 entries against `minChunkSearches: 30`.

- **Agent B**, taking AD-3 at its word, resolves the conflict one of two ways, both bad. Either it adds a **ninth fetch** — silently breaking AD-24's closed enumeration, passing review as a trivial loader change — and then *refuses to render*, so **the entire site goes blank because the player pinned one row too many**; or it drops the check, in which case the cap is enforced in `sync` only and the site renders a dataset whose rotation is frozen with nothing on screen saying why.
- **Agent A** fails the CLI loudly. The player's site is fine and their sync stops. Two units, two symptoms, one edit.

The blank-site branch is the serious one: it converts a *curation* mistake into a *total outage* of a product whose whole premise is a static page that always renders.

### The tightening

> **AD-26 amendment.** The pinned cap is validated **in `sync`, at load, before any request**, and is *not* a `web`-side render gate. Name the owner in the rule; "a `tracked.json` validation error" names a file, not a unit, and the two units that read that file have different powers and different failure modes.
>
> **AD-3 / AD-24 amendment.** State the general principle the rev-2 review asked for and revision 3 still does not carry: *"refuses to render" applies to a **schema-invalid** artifact. A schema-valid artifact failing a cross-file policy check is reported, never a file-level refusal.* Without this sentence every future cross-file rule is one agent's reading away from a blank site.
>
> **AD-21 / AD-24 amendment.** Reconcile the reader column with AD-24's fetch set file by file. Two tables describing one fact have now produced two findings in two consecutive reviews.

---

## 6 — HIGH: `count(currencies.json)` counts currencies, and the runtime half does not count them at all

### The two units

- **Epic A — "Workload validation" (`sync`).** Implements the cap literally: `count(pinned) + count(data/currencies.json)`. The second term is the number of entries in the currency file.
- **Epic B — "Chunk budgeting" (`sync`).** Implements AD-12's cost table, which prices the currency source as *"small, **fixed**"* — deliberately not per-entry, unlike the row above it which says *"one search + one fetch per entry."* B budgets the currency step at its real cost, which for an exchange-rate endpoint is plausibly one or two requests for the whole set.

### The AD each obeyed

The cap's own justification says *"the currency set is a summand because AD-20 spends it at step 0 of the same chunk."* That justifies including the currency step's **cost**; the formula includes its **cardinality**. With 25 currencies and `minChunkSearches: 30`, Agent A's cap allows **zero** pinned entries (25 + 0 ≤ 15 is already false — the file alone fails validation, with no pinned entries at all), while Agent B's allows fourteen. Agent A's build refuses a configuration Agent B's runs happily, and the refusal is attributed to `tracked.json`, a file the player did not touch.

This is not hypothetical arithmetic: AD-12 does not say how many requests the currency step costs, so the two readings are both live and the gap between them is the size of the currency file.

### The runtime half omits currencies entirely

The runtime rule is: *"If the discovered allowance cannot cover the pinned set **plus at least one `active` entry**"*. Currencies are absent from that predicate — yet step 0 spends from the same allowance **first**, by AD-20's requirement. So:

- Agent A tests `allowance ≥ pinned + 1`.
- Agent B tests `allowance ≥ currencyCost + pinned + 1`, on the grounds that a chunk which funds pinned and one active but not its currencies writes every one of those entries `not-yet-synced` under AD-20 — the outcome step 0 exists to prevent.

Different chunks emit starvation lines. `web` reads `sync-report.json` (AD-24), so the user sees a warning in one build and a clean report in the other for the identical run. And AD-19's per-run leagues request — one more request from the same chunk, declared in AD-12 — is in neither predicate.

### The tightening

> **AD-12 amendment.** State the currency step's request cost explicitly: how many requests, against which bucket, for N currencies. "Small, fixed" is a note, not a number, and two rules now do arithmetic on it.
>
> **AD-26 amendment.** Denominate both halves of the cap in the same quantity — **searches consumed by step 0**, not entries in a file — and include step 0 and the AD-19 leagues request in the runtime predicate: `allowance ≥ cost(step 0) + cost(leagues) + count(pinned) + 1`.

---

## 7 — HIGH: the open **bottom** is wholly unconstrained

Revision 3 closed the ceiling and never mentions the floor. Every argument in AD-5 is written about `valueMax`; `valueMin` is required by the same schema and bounded by nothing.

### The two units

The same pair as finding 1: `sync` building the AD-16 stat filter, `core` aggregating under AD-18.

### The incompatible outcome

A curator tracking "any decent roll" writes `(stat_X, 0, 89)`, or `(stat_X, 1, 89)`, against a weights file whose bands for `stat_X` are `(80..89, w 1200)`, `(70..79, w 1800)` and `(40..69, w 9000)`.

- **`core`** sums all three: `P` is dominated by the junk band, which is correct for the reference as written.
- **`sync`** filters `min: 0, max: 89`, sorted **ascending** — the cheapest ten listings are junk-tier items, and the median is a junk-tier price.

The pair is internally consistent, which is exactly why it is dangerous: a wide band is *arithmetically* fine and *strategically* meaningless, and the entry it produces is a high-probability, low-price row that displaces genuine jackpot rows in a threshold-truncated ranking. More importantly for this review, the **two units can still disagree**: `core` rejects the configuration if any band straddles the `0` edge (a band spanning 0 would), `sync` never checks, and a `valueMin` below every band's floor makes the straddle rule silent again. The alignment check proposed in finding 1 must therefore cover **both** edges.

### The tightening

Covered by finding 1's AD-5 amendment, which requires alignment on `valueMin` as well as `valueMax`. Stating it for one edge only would close half of a symmetric hole — which is how this one arrived.

---

## 8 — HIGH: `pinned` **and** `unresolvable` is unaddressed by the new precedence paragraph

Revision 3 added: *"Rows 1, 2 and 4 select on curation status; row 3 selects on price state, and an entry can be `active` *and* `unresolvable` at once. Such an entry is selected at row 3 only."*

It resolves exactly one of the three status values against row 3.

### The two units

- **Epic A — "Chunk runner" (`sync`).** Row 1: *"every `pinned` entry, each chunk, **without exception**"*. A pinned entry that is unresolvable is still pinned, so A selects it at row 1, every chunk, re-running the offline check and re-emitting an `unresolvable` report line every chunk — precisely the churn row 3's bound exists to pace (see finding 2).
- **Epic B — "Rotation selector" (`core`).** Applies the new paragraph's *principle* rather than its literal enumeration: row 3 is a different axis that **lifts** an entry out of the status rows, and the paragraph's stated reason — *"lifting it out of row 2 is what makes row 3's bound mean anything"* — applies with equal force to row 1, where the entry would otherwise be re-selected **more** often, not less. B routes pinned-unresolvable to row 3 under the 24h bound, violating "without exception".

### The incompatible outcome

The rows the curator marked as most important are the rows they most want to know about after a patch. Under A they re-report every chunk (noise that buries the signal); under B they re-check at most daily (a patch-out on a pinned row can go 24h unreported). Both cite AD-26. And the divergence propagates into the cap: does an unresolvable pinned entry count toward `count(pinned)`? Under A it occupies a row-1 slot but spends **no search** (AD-6 detects offline), so counting it in a search-denominated cap over-charges; under B it is not in row 1 at all.

### The tightening

> **AD-26 amendment.** State the precedence as a total function of `(status, priceState)` rather than a four-row list with one prose exception. The minimal version: *an entry whose price state is `unresolvable` is selected at row 3 regardless of status, except that `pruned` is never selected at all (row 4 dominates every row). `pinned` therefore means "first in every chunk **among resolvable entries**".* Then say whether a row-3 entry counts toward `count(pinned)` — it should not, since it spends no search.

---

## 9 — HIGH: `minChunkSearches` is player-declared, unvalidated, and about the wrong bucket

### The two units

- **Epic A — "Config + validation" (`sync`).** `minChunkSearches` is *"a declared field of `data/config.json` (AD-19, player-owned per AD-21), seeded from AD-8's measured `30:300` search bucket."* A reads it and applies the cap.
- **Epic B — "Rate governor" (`sync`).** Implements AD-8: *"**No rate is hardcoded**; the measured values below are the expected shape, not a constant to compile in"*, and *"It paces against the tightest unsatisfied bucket."*

### Three divergences in one field

**(a) It is enforced against a number written by the same hand it constrains.** The cap's purpose is to stop a player authoring a pinned set that cannot work. The player also authors `minChunkSearches`. Setting it to `10000` makes the cap vacuous, and nothing can object: AD-8 forbids hardcoding a rate, so no validator may bound the declared value against the real bucket, and `sync` has no committed history of observed allowances to check it against (`sync-report.json` is a run report, and AD-14 says git is the history). Agent A trusts it; Agent B clamps it to the last observed allowance from the previous run's report — a reasonable defensive reading — and the two reject different files.

**(b) It is search-only, and the chunk may be fetch-bound.** AD-7 bounds a chunk by the search allowance, the **fetch** allowance, or the workload remainder. AD-12 costs each tracked entry *one search + one fetch*. AD-8's measured buckets have different shapes (`5:10` search vs `12:4` fetch; 600/6h vs 1000/6h), so which binds depends on the window. There is no `minChunkFetches`, so a fetch-bound chunk starves the pinned set while passing a search-denominated cap, and the runtime predicate — is it evaluated against the search bucket, as its denomination implies, or against AD-8's *"tightest unsatisfied bucket"*, as the governor works? — has two answers and two sets of starvation lines.

**(c) When is the allowance "discovered"?** AD-8 learns allowances from **response headers**. At the start of a chunk — before step 0 issues anything — a cold process has **no headers at all**. Agent A evaluates the runtime predicate up front against persisted last-seen header state (which no AD requires anyone to persist; `sync-progress.json`'s contents are specified only as *"which entries a chunk has completed"*) and, on a cold start with no state, either skips the check or assumes the configured minimum. Agent B never evaluates a predicate up front; it discovers exhaustion when a bucket fills or a 429 arrives, and AD-8 then says **yield the chunk** — which sits awkwardly beside AD-26's *"`sync` completes the chunk"*. Whether pinned entries get partially refreshed, and whether the starvation line appears at all on a cold start, differs.

### The tightening

> **AD-26 / AD-19 amendment.** Define `minChunkSearches` as *"the smallest search allowance a chunk is expected to discover, declared by the player"*, and require `sync` to **report** the actual discovered allowance per chunk in `sync-report.json` next to the declared value, so a dishonest or stale declaration is visible as a number rather than as a silently vacuous cap.
> **AD-26 amendment.** State which bucket the runtime predicate is evaluated against (the tightest unsatisfied bucket, converted to whole entries at one search + one fetch each — which is the only conversion consistent with AD-8), and where the allowance comes from on a cold start (`sync-progress.json` carries last-seen bucket state; say so, since nothing currently permits it to).
> **AD-8 / AD-26 reconciliation.** Say whether a 429 mid-chunk is a "completed chunk" for the purpose of the starvation line.

---

## 10 — HIGH: the starvation line has no schema and no consumer obligation

### The two units

- **Epic A — "Sync reporting" (`sync`).** Emits *"a pinned-starvation line in `sync-report.json` naming the shortfall."*
- **Epic B — "Report view" (`web`).** Validates `sync-report.json` on load (AD-3, AD-24) against the `SyncRunReport` schema in `contracts` (AD-22) and renders it.

### The AD each obeyed

AD-22 requires every concept crossing a package boundary to have **exactly one Zod schema in `contracts`**. Revision 3 introduces a new record class into a schema-pinned artifact and specifies its contents as four words of prose. "The shortfall" is at least four different numbers: `pinned − allowance`; `pinned + 1 − allowance`; `pinned + currencies + 1 − allowance`; or the count of pinned entries not refreshed. Nothing says whether the line is emitted once per chunk or once per starved entry, nor whether it carries the entry keys, the declared `minChunkSearches`, the discovered allowance, or a timestamp.

Two builders produce two shapes. If `contracts` lands first (per AGENT-WORKFLOW) one shape wins and the other unit's writer is wrong; if the field is added optionally, `web` built against A's shape renders **nothing** for B's report — and AD-3's refusal semantics mean the less lucky version is a blank site (finding 5's mechanism again).

### And nothing requires `web` to show it

AD-26 **binds `web`** and then asks nothing of it. The amendment's justification is that *"the runtime half is what makes the failure AD-26 exists to prevent **visible**"* — but visibility is a property of the view, and the only rendering obligations in the spine are AD-10's provenance/age rules, AD-6's *"`web` must surface their existence"* for unresolvable entries, and AD-23's tracked-list age. A starvation line is none of those. Agent B renders the report's error list and not its warning list, or renders it in a collapsed panel, and the failure is recorded but never seen — leaving the symptom *"indistinguishable from a slow refresh"*, which is the exact sentence the amendment uses to justify its own existence.

### The tightening

> **AD-22 amendment.** Add the starvation record to `SyncRunReport`'s schema with named fields: `declaredMinChunkSearches`, `discoveredAllowance`, `pinnedCount`, `currencyCost`, `pinnedRefreshed`, `activeRefreshed`. "Naming the shortfall" becomes a computable field set rather than a sentence.
> **AD-26 amendment.** Require `web` to surface pinned starvation as a first-class condition alongside AD-6's unresolvable set and AD-23's tracked-list age — the three things that tell a player their list is not doing what they think it is.

---

## 11 — MEDIUM-HIGH: `sync-progress.json` has no defined reset point

Revision 3's cap rests on the sentence *"`sync-progress.json` records which entries a chunk has **completed**, not which it intended to visit."* Nothing in the spine says when that record is **cleared**.

**The two units.** **Epic A — "Resumability" (`sync`)** treats the completed set as scoped to an interrupted chunk: a fresh run whose previous run exited cleanly starts empty, so row 1 re-selects every pinned entry. **Epic B** treats it as a persistent pass ledger — the natural reading of AD-7's third bound, *"the unprocessed remainder of **the workload**"*, which presupposes a workload persisting across chunks — so a pinned entry completed in chunk *n* is skipped in chunk *n+1* until the ledger resets at some unstated point.

**The incompatible outcome.** Under B a pinned entry is refreshed **once per pass**, not once per chunk — flatly contradicting row 1 while obeying AD-7's wording, and quietly making the entire pinned cap pointless, since pinned entries no longer cost a search in *every* chunk. Under A, a kill-prone environment (Task Scheduler on a laptop that sleeps) re-spends the full pinned allowance on every restart and may never reach the `active` rotation at all — starvation caused by the progress semantics rather than by the cap.

The rev-2 review raised recompute-vs-frozen-plan (6c) and revision 2 answered it; revision 3 leans harder on the same file without closing its lifecycle.

**The tightening.**

> **AD-7 / AD-26 amendment.** `sync-progress.json` holds the completed set **for the current chunk only**, and is cleared at the start of every run that acquires the lock and finds no in-flight state. AD-7's "unprocessed remainder of the workload" means *the entries the recomputed order still selects in this chunk*, not a cross-chunk ledger. Say it in AD-7, where the bound is stated, as well as in AD-26.

---

## 12 — MEDIUM: `rankable` excludes `pruned` but not `unresolvable`, on a reason that covers both

AD-27's amendment excludes `pruned` entries because *"AD-23 removes them from the ranking sum, so a base whose only crafted entries are tombstones needs no pool."* AD-6 removes `unresolvable` entries from valuation by exactly the same mechanism: *"`core` excludes `unresolvable` entries from valuation."* A base whose only crafted entry is unresolvable can never be ranked and therefore needs no pool, by the amendment's own argument.

**The two units.** Agent A implements the literal text (pruned only). Agent A′ implements the stated reason (pruned, and unresolvable, and anything else AD-17's sum excludes). After a patch removes a stat id used by 20 tracked bases, A reports a coverage fraction 20 bases lower than A′ and may cross the 80% or 50% cliff on the strength of entries neither implementation would ever rank.

**And folding it in breaks decidability.** This is the answer to *"is `rankable` decidable from the committed files alone?"*: **as written, yes** — affix presence and `status` are both fields of `tracked.json`, so `rankable` needs one committed hand-owned file and nothing else, which is a genuine improvement and the right property for a gate that runs *before any view work and plausibly before any sync has ever run*. Folding `unresolvable` in would destroy that, because price state lives in `dataset.json`. The fix is therefore to **say so**, not to widen the predicate.

**The tightening.**

> **AD-27 amendment.** `rankable` is decidable from `data/tracked.json` alone, by design: the gate runs before any sync exists, so price state — including `unresolvable` — is deliberately **not** a term. Say this explicitly, because the `pruned` exclusion's stated reason invites a builder to generalise it.

---

## 13 — MEDIUM: a `pruned` **and** `unresolvable` entry, under the new "two different fields" framing

Revision 3's precedence paragraph frames row 3 as selecting on a **different axis** from the status rows. A builder applying that framing consistently asks: if an `active` + `unresolvable` entry is selected at row 3 *regardless of* its status, what about a `pruned` + `unresolvable` one?

**The two units.** Agent A: row 4 is a status row, row 3 is a price-state row, and the paragraph just said price state lifts an entry out of the status rows — so the tombstone is re-validated on the 24h schedule and keeps emitting `unresolvable` report lines. Agent B: AD-23 says `pruned` is *"excluded from `sync`'s workload (AD-12) **and** from `tracked(base)` in AD-17's sum"* — it is not in the workload, so no row selects it.

AD-23's text is strong enough that B is clearly right, but the new paragraph is what makes A's reading available, and A produces a report cluttered with tombstone lines that a player will read as live problems — degrading precisely the report surface findings 3 and 10 depend on for visibility.

**The tightening.** Covered by finding 8's amendment: state row 4 as dominating every other row, so "never `pruned`" is unconditional rather than one row in a list that a later paragraph re-frames.

---

## 14 — MEDIUM: coverage is an unowned one-off, and 80% falls in two bands

**(a) No owner, no artifact, no re-measure trigger.** AD-27 says *"measure"* and names no unit, no committed script and no output file. The rev-2 review asked for a committed script producing a committed report; revision 3 narrowed the denominator without adding one. So the number gating a layout decision is produced once, by whoever, unrecorded — and is never recomputed when `weights.json` regenerates at patch cadence, or when a curator adds ten tracked bases the producer does not cover. Both move the fraction, and both are routine. Epic A treats it as a build-time gate and never runs it again; Epic B treats it as a standing invariant and adds a CI check, which then **fails the build on a curation commit** — turning a curation edit into a red pipeline.

**(b) 80% is in two rows.** The consequence table reads `≥ 80%`, `50–80%`, `< 50%`. Exactly 80% matches the first and second rows; exactly 50% matches the second row and not the third, so the lower boundary is consistent and the upper is not. Two builders, two layouts, at the value most likely to be hit by a producer targeting the threshold. There is also no minimum denominator: three of four tracked bases complete is 75% and lands in the "first-class surface" band on a sample of four.

**The tightening.**

> **AD-27 amendment.** The measurement is a committed script in `core` (pure; it takes the two files as values) writing a committed `docs/coverage-report.md` or `data/coverage.json`, re-run on every weights regeneration and every tracked-list edit, so its result is a reviewable diff rather than a remembered number. Make the bands disjoint (`≥ 80`, `≥ 50 and < 80`, `< 50`) and state a minimum denominator below which the gate is not meaningful.

---

## 15 — MEDIUM: two definitions of "progress", and an undefined exit code

The cap's two halves encode **two different requirements**:

| Half | What it guarantees |
| --- | --- |
| Load time | at least **half** a minimum chunk is left for the `active` rotation |
| Runtime | at least **one** `active` entry is funded |

A builder who reads the load-time inequality as *the* definition of the binding requirement — the amendment does describe it as *"at least half of a minimum chunk is left for the `active` rotation"* — will implement the runtime check with the same 0.5 factor, and emit starvation lines on chunks that the other builder considers healthy. Since `web` reads `sync-report.json`, the user sees warnings under one build and silence under the other for identical runs. Say which criterion the runtime check applies, and why the two differ if they are meant to.

**Exit code.** AD-7 defines exit 0 for a busy lock, with a stated reason (*"a non-zero exit would make every scheduler treat routine overlap as a failure"*). Nothing defines the exit code for a starved chunk. Agent A exits 0 — the chunk "completed", per the rule's own word. Agent B exits non-zero — the run failed to make progress, and a scheduler should say so. The same reasoning AD-7 applies to the lock applies here and points at 0; state it, because a Task Scheduler task that turns red every fifteen minutes gets disabled by the player, which removes sync entirely.

---

## 16 — LOW: "`minChunkSearches` and nothing else" collides with the schemaVersion convention

AD-19 now reads: *"`data/config.json` — which also carries AD-26's `minChunkSearches` and nothing else; it is a player-owned file, not a settings bag"*. The intent — resisting a settings bag — is right. The wording is a **closed enumeration** of exactly two fields, and the Conventions table requires that *"every published artifact **and input file** carries `schemaVersion`"*, with consumers refusing an unknown major. So a builder obeying AD-19 literally omits `schemaVersion` and a builder obeying the convention adds a third field to a file whose AD says it has two; and adding `minChunkSearches` to an existing config is itself a schema change with no stated major-version story.

This is the same enumeration-as-closed-set shape the rev-2 review named as recurring, appearing in revision 3's own new sentence.

**The tightening.** *"…carries the active league, `minChunkSearches`, and `schemaVersion`, and nothing else. A new field is an amendment to this AD, not a config addition."* — which preserves the anti-settings-bag intent while making the enumeration honest and giving future fields a defined door.

---

## Cross-cutting observation: revision 3 closes authoring, not execution

Three of the four amendments share a shape. Each identifies a real hole, and each closes it with a rule that fires **when a file is read**:

- the pinned cap is a load-time validation error (plus a report line);
- the `valueMax` closure is a schema requirement;
- the coverage gate is a pre-build measurement.

Load-time rules are the right instinct — they are checkable, they fail early, and they cannot be argued with. But each of these three has a **runtime or semantic half that the amendment names and then does not specify**:

- AD-26 *states* that a load-time cap cannot be sound alone, then specifies the runtime half as a report line rather than a selection rule (finding 3);
- AD-5 *states* that a curator should write "the real ceiling", then provides no unit that can tell whether they did (finding 1);
- AD-27 *states* that the question is "how much of what the curator wants ranked can be ranked", then measures a producer's self-declared string (finding 4).

The pattern to watch in revision 4: **a rule that names its own runtime half in prose has not specified it.** The test is whether a builder holding only that AD can write the `if` statement. For each of the three above, two builders write different ones.

The second recurring shape is now in its third consecutive review: **a rule whose owner cannot read the file it must check.** Revision 2 had weights↔catalogue with no owner able to read `items.json`; revision 3 adds tracked↔currencies with no owner in `web` able to read `currencies.json`, and tracked↔weights edge alignment with no owner in `sync` able to read `weights.json`. All three are the same fix — one pure cross-validation function in `core` invoked by both shells, and a read set that lets each shell supply its inputs — and it is cheaper to make that a stated principle than to keep patching instances.

## What I would land first

1. **Finding 1** — it reopens BQ-1, the defect the `valueMax` amendment exists to close, through a path the amendment does not touch. One AD-5 sentence (edge alignment on both edges) plus an owner.
2. **Finding 3** — the runtime pinned rule needs a selection behaviour, not only a report line; without it AD-26's own opening sentence describes the divergence it permits.
3. **Finding 2** — one sentence in AD-9 about what "worked on the entry" means when no request is issued, and one in AD-26 about how a recovering entry rejoins. The amendment's new rationale is currently unachievable by any stated mechanism.
4. **Finding 4** — define AD-27's numerator as rankability under AD-18 rather than as a declared string; the vacuous-truth reading can report 100% on a file covering 40% of the list.

Findings 5 through 11 are a paragraph each. Findings 12 through 16 are sentences. The narrowed `rankable` denominator is a genuine improvement and is **decidable from `tracked.json` alone**, which is the right property for a pre-build gate — that part of the amendment lands cleanly and only needs the decidability property stated so a later builder does not generalise it away.
