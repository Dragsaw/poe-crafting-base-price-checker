---
title: 'Adversarial Architecture Review — ARCHITECTURE-SPINE.md revision 2'
type: review
target: ARCHITECTURE-SPINE.md (revision 2, 2026-09-12)
companions_reviewed: [WEIGHTS-FILE-SCHEMA.md, AGENT-WORKFLOW.md]
method: 'divergence construction — two conforming units, one incompatible outcome'
created: '2026-09-12'
status: draft
---

# Adversarial Review — Revision 2

## Method

For each finding I construct **two units one level down** — two agents building two packages, or two epics — that each obey **every AD to the letter** and still produce artifacts or behaviour that cannot coexist. A pair that can be constructed is a hole in the spine, not a mistake by either builder. Findings are ranked by severity, and severity is weighted heavily toward **silent** divergence: a pair that ends in a crash or a refused artifact costs a day; a pair that ends in a differently-ordered ranked list that both units believe is correct costs the product's credibility, which is the one thing the brief says it cannot spend.

Revision 2 fixed three defects (BQ-1 band-vs-floor, BQ-2 unscoped pool, BQ-3 unmeasured coverage) that were each invisible until AD-5/AD-16/AD-17/AD-18 were read **together**. The brief for this review was to look for a fourth of the same kind. There are **three**, and the most severe of them is a straightforward recurrence of BQ-1 through a gap the band amendment opened rather than closed.

**Verdict: revision 2 is sound in its intent and materially better than revision 1, but the valuation chain is not yet closed. Four critical divergences remain constructible, three of them inside AD-5/AD-16/AD-17/AD-18 read together, and all four fail silently.**

## Severity summary

| # | Finding | ADs implicated | Severity |
| --- | --- | --- | --- |
| 1 | Partition rule misses cross-slot partial overlap (prefix-only × suffix-only) | AD-17, AD-18, AD-5 | **Critical** |
| 2 | Numerator is value-scoped while the denominator is item-level-scoped | AD-18, AD-5 | **Critical** |
| 3 | "Topmost band" is unvalidatable by the only unit that sees `tracked.json` — BQ-1 returns | AD-5, AD-16, AD-18, AD-12 | **Critical** |
| 4 | Weights↔catalogue validation has no owner that can read `items.json` | AD-6, AD-21, AD-24, AD-25 | **Critical** |
| 5 | `TrackedEntry` has no defined identity key, and internal ids are forbidden | AD-5, AD-14, AD-22, Conventions | **High** |
| 6 | AD-26 rotation: pinned starvation, currency ordering, recompute-vs-frozen plan | AD-26, AD-7, AD-20 | **High** |
| 7 | Raw bases and AD-17 rule 3: the white ilvl-82 base is legislated out or the file is rejected | AD-17, AD-5, AD-16 | **High** |
| 8 | Unknown stat id: per-entry `unresolvable` vs file-level refusal to render | AD-6, AD-3, AD-25 | **High** |
| 9 | AD-27's coverage denominator ("endgame base types") is undefined | AD-27, AD-18 | **Medium** |
| 10 | Catalogue refresh has no defined rate-limit bucket | AD-8, AD-12, AD-25 | **Medium** |
| 11 | `(base, recipe)` row enumeration and the raw-base branch's threshold behaviour | AD-17, AD-18, AD-4 | **Medium** |
| 12 | Median of an even sample, and where rounding lands | AD-16, AD-20, Conventions | **Medium** |
| 13 | Provenance weakness ordering is implied by list order, never stated | AD-10, AD-18 | **Low** |

---

## 1 — CRITICAL: the partition rule misses cross-slot partial overlap

### The two units

- **Epic A — "Tracked list validation" (`contracts` + `core`).** Implements AD-17's partition validation. AD-17 says: *"Each of the following is a validation error on `data/tracked.json`, rejected at load"* and then enumerates exactly three cases. The agent implements exactly three checks, because an architecture document that enumerates its cases and calls each one "a validation error" is read as normative and closed — that is the whole point of writing them out rather than saying "overlapping entries".
- **Epic B — "Ranking engine" (`core`).** Implements AD-17's sum, relying on the stated guarantee that *"the sum is over a partition, not a list"* and that *"summands must be mutually exclusive"*, and therefore performs no disjointness check of its own — AD-17 explicitly says these are *"rejected at load, not a case `core` reconciles."*

### The AD each obeyed

Both obey AD-17 to the letter. A obeys the enumerated list; B obeys the stated precondition. Neither is doing anything wrong.

### The incompatible outcome

A curator writes, for one `baseTypeId` at one `itemLevelMin`:

```
entry 1: prefix = (stat_X, 80, 89),  suffix = absent
entry 2: prefix = absent,            suffix = (stat_Y, 30, 39)
```

Walk AD-17's three rules:

1. **Overlapping value bands for the same `statId` in the same slot** — no. Different stat ids, different slots.
2. **A partial-affix entry subsuming a full one** — no. Neither entry is full; the rule is written as partial-subsumes-full and neither subsumes the other under that reading.
3. **Differing `itemLevelMin`** — no. They are identical.

The file loads. But entry 1's outcome set is `{prefix = X ∈ [80,89], any suffix}` and entry 2's is `{any prefix, suffix = Y ∈ [30,39]}`, and these **intersect** at `{prefix = X, suffix = Y}` — a real, reachable, and in fact *desirable* item. That item's probability mass is counted twice, and worse, it is counted at two different prices, because AD-16 builds two different searches (one filtered on X only, one on Y only) returning two different populations. `ΣP` for that base exceeds the true mass, its EV inflates, and because AD-17 ranks on EV the base rises — a double-counted base is systematically pushed *toward the top of the list*, which is the one place the product's entire value is concentrated.

Nothing errors. The dataset is schema-valid, the report is clean, provenance is `measured`, and the ranked list is wrong in exactly the direction that looks like a discovery.

This is the same class as BQ-1: a rule that reads as complete, an arithmetic consequence that only appears when AD-5's "affix or **absent**" is read against AD-17's partition and AD-18's `P = 1` for an absent affix.

### The tightening

Replace the three-case enumeration with a **general disjointness predicate plus the three cases as named instances**. Concretely, amend AD-17:

> Define an entry's **outcome set** as the cross product of its slots, where an absent slot denotes *every* value of *every* `statId` eligible in that slot for the base at its `itemLevelMin`. Two entries on one `baseTypeId` whose outcome sets intersect are a validation error. The cases below are named because they are the ones curators actually write; **the predicate, not the list, is the rule.**
>
> 4. **Complementary partial entries.** Two entries that leave *different* slots absent always intersect, since each covers every value of the slot the other names. At most one slot may be left absent across all crafted entries on one base.

Rule 4 stated alone would close this instance; stating the predicate closes the ones neither of us has thought of. Both belong in the amendment — the predicate is the invariant, the list is the curator-facing documentation of it.

---

## 2 — CRITICAL: the numerator is value-scoped, the denominator is item-level-scoped

### The two units

Two agents implementing `core`'s probability function from AD-18 — say **Epic A "weights aggregation"** and **Epic B "pool normalisation"**, or the same function written twice in two worktrees and reconciled later.

### The AD each obeyed

AD-18 gives the numerator and the denominator in two separate paragraphs with two different scoping rules, and never reconciles them.

**Numerator (paragraph 1):** *"its weight is the sum of the weights of every weights-file band with that `statId` that lies wholly inside it — `band.valueMin >= ref.valueMin` and `band.valueMax <= ref.valueMax`."* Two conditions. Both are on **value**. There is no item-level condition on the numerator anywhere in that paragraph.

**Denominator (paragraph 2):** *"The eligible pool for a tracked entry is `{ band ∈ pool(base, slot) : band.itemLevelMin <= entry.itemLevelMin }` … divided by the total weight of that scoped pool."*

- **Agent A** implements the numerator exactly as written: value containment only, whole bands, no ilvl filter — because the rule states its two conditions explicitly and exhaustively, and the ilvl clause is introduced two paragraphs later as a property of *the pool*, i.e. of the denominator.
- **Agent B** implements the numerator as `ref ∩ scopedPool`, reading "the eligible pool" as scoping everything downstream of it, including which bands a reference may aggregate.

### The incompatible outcome

The weights file for `Guardian Bow` prefix, `stat_X`, holds two bands — exactly the shape the companion document uses as its worked example:

```
(80..89, itemLevelMin 82, weight 1200)
(70..79, itemLevelMin 75, weight 1800)
```

A tracked entry at `itemLevelMin: 75` carries `prefix = (stat_X, 70, 89)` — a single reference spanning both bands. This is legal: AD-17 rule 1 rejects only *intersecting* bands within the tracked list, and this base has exactly one tracked band for `stat_X`. AD-5 does not forbid a reference spanning two weights bands; AD-18 explicitly contemplates it ("the **sum** of the weights of every weights-file band … that lies wholly inside it").

- **Agent A** computes `P = (1200 + 1800) / W₇₅`, where `W₇₅` excludes the ilvl-82 band from the denominator. The numerator contains a band the denominator does not. In a thin pool this drives `P` above 1; in a normal pool it simply inflates `P` for that base by an arbitrary per-base factor — which, as AD-18 itself argues about the BQ-2 case, *reorders the list rather than shifting it uniformly*.
- **Agent B** computes `P = 1800 / W₇₅`.

Both artifacts validate. Both rank. The orders differ. Nothing reports a disagreement.

### The dead cross-reference that hides it

AD-18 appears to guard this: *"A tracked band whose own `itemLevelMin` exceeds its entry's floor is a validation error: it cannot roll at the level being searched."*

**A tracked band has no `itemLevelMin`.** AD-5 defines a modifier reference as `(statId, valueMin, valueMax?)` — three fields, no item level — and `itemLevelMin` is a field of `TrackedEntry`, not of `ModifierRef`. The sentence has no referent in the contract it governs. A third agent, **Agent C**, will read it as "the weights bands this reference aggregates must all satisfy `itemLevelMin <= entry.itemLevelMin`, else validation error" and reject the file that A and B both accept. So the rule is satisfiable three ways: silently high, silently low, and loudly refused.

### The tightening

Amend AD-18's numerator sentence to carry the scoping in the same breath as the containment, and fix the dangling sentence:

> A modifier reference's weight is the sum of the weights of every band **in the scoped pool** (defined below) with that `statId` that lies wholly inside it. **Numerator and denominator are drawn from the same scoped pool; no band may contribute to one and not the other.** A reference that would aggregate a band scoped out by item level is a **validation error on `data/tracked.json`** — the curator has named a band that cannot roll at the entry's floor, and the fix is to split the entry or raise the floor, not to let `core` choose a reading.

And delete or repair *"a tracked band whose own `itemLevelMin`"* — either give `ModifierRef` an `itemLevelMin` in AD-5 (I do not recommend this; it duplicates state that AD-17 rule 3 already forces to be uniform) or restate the rule in terms of the weights bands the reference aggregates.

---

## 3 — CRITICAL: "topmost band" is unvalidatable by the unit that owns the check, and BQ-1 walks back in

This is the fourth defect of the BQ-1 kind, and it is the one that matters most, because it re-opens the exact hole revision 2 was written to close.

### The two units

- **Epic A — "Sync workload validation" (`sync`).** AD-6: *"Every `statId` and `baseTypeId` in `data/tracked.json` and `data/weights.json` is checked against the committed catalogue (AD-25) **before any request is issued**."* Validation of the tracked list at request time is `sync`'s job. AD-12 makes `tracked.json` `sync`'s declared workload.
- **Epic B — "Weights validation" (`core`, invoked from `web`).** AD-18 and the companion document put band-alignment validation in `core`: *"A weights-file band that straddles a tracked band edge is a validation error."*

### The AD each obeyed

AD-5: *"`valueMax` is omitted only for the topmost band of that `statId`."* Both units obey it. Neither can check it.

**`sync` cannot check it.** `sync` reads `tracked.json` (AD-12), `currencies.json`, `config.json` and `catalogue/*` (AD-21 table). It does **not** read `weights.json` — AD-21 assigns `weights.json` the reader "`core` via `web`", and AD-12 does not list it as a workload source. So `sync`, the unit that validates the tracked list before issuing requests, has no way to know what the *topmost band of that `statId`* is, because topmost-ness is a property of the weights file's enumeration of the slot, not of the tracked list.

**`core` can check it but is not told to, and by then it is too late.** `core` sees both files at read time in the browser. But AD-18's validation list, and the companion's hard-error list, never mention an unbounded tracked reference. And the artifact whose correctness depends on it — the `PriceObservation` — was already written by a `sync` run that could not check it.

### The incompatible outcome

The curator wants to isolate the T1 jackpot, so they track `prefix = (stat_X, 80)` with `valueMax` omitted, reasoning (correctly, under a natural reading) that 80+ is the topmost band and an omitted max is how AD-5 spells "no ceiling".

Now suppose the weights file — regenerated on a later GGG patch, by a producer who has never heard of this repository's tracked list, exactly as AD-11 intends — splits that band: `(80..89, ilvl 82)` and `(90.., ilvl 84)`. Or suppose the curator simply omitted `valueMax` on a band that was never topmost, and the only check in the system is AD-17 rule 1, which rejects *intersecting* bands and nothing else.

Then:

- **AD-18** sums *every* band from 80 upward — two tiers of probability mass.
- **AD-16** builds a stat filter with `min = 80` and **no `max`**, because there is no max to pass. AD-16 itself names this outcome: *"a min-only filter returns every higher tier too and prices the band at its floor."* Sorted **ascending**, the median of the cheapest ten is essentially the ilvl-82 tier's price.
- The reference therefore carries **two tiers' probability at one tier's price** — which is BQ-1, verbatim, including its worst consequence: if that blended price falls below the payout threshold, the whole entry truncates out of AD-17's sum and takes the top tier's mass with it. The jackpot is not understated; it is deleted.

AD-5's prose says bands were introduced precisely so *"each carries its own price and AD-17's partition holds"*. The amendment achieves that for bounded references and leaves an unbounded reference behaving exactly as a revision-1 floor did — with no validator anywhere in the system positioned to notice.

The two units diverge as well as both being wrong: **Agent A** (sync) issues the min-only search and records a price, because AD-16's table says to pass min and max "from the band" and there is no max. **Agent B** (core) may refuse the file under the companion's straddle rule if the producer's bands do not align — or may not, since an unbounded reference cannot straddle anything, it contains everything. So one unit prices it, the other ranks it, and neither flags it.

### The tightening

Three changes, all small, all in AD-5 and AD-18:

1. **Move topmost-ness from a curator's judgement to a checkable fact.** Amend AD-5: *"`valueMax` may be omitted only where the weights file declares no band of that `statId` in that `(base, slot)` above `valueMin`. Topmost-ness is a property of the weights file, not of the tracked list, and is re-checked whenever either file changes."*
2. **Give the check an owner that can perform it.** Either extend AD-12 to make `data/weights.json` a read-only input to `sync`'s pre-request validation (it costs no requests and is already committed), or amend AD-6 to say the tracked-list/weights cross-validation is a `core` pure function invoked by *both* `sync` and `web` from the same module — which is the better answer, since AD-1 already says validating a loaded value is a pure function in `core`, and it guarantees the two units cannot reach different verdicts.
3. **Make the min-only search impossible rather than merely discouraged.** Amend AD-16's stat-filter row: *"`min` and `max` are both always sent. For a reference with `valueMax` omitted, `max` is the weights file's ceiling for the topmost band of that `statId`, or is omitted only when that band is itself unbounded in the weights file. A search whose stat filter carries a `min` without a `max` where a higher band exists is a defect, not a degraded case."*

Add to AD-18's validation list: **an unbounded tracked reference with a weights band of the same `statId` above it is a validation error.**

---

## 4 — CRITICAL: weights↔catalogue validation has no owner that can read `items.json`

### The two units

- **Epic A — "Weights file validation" (`contracts` + `core`).** Implements the companion's hard-error list, which includes: *"a `statId` or `bases` key absent from the committed catalogue (AD-25)"*, and AD-6's *"Every `statId` and `baseTypeId` in `data/tracked.json` and `data/weights.json` is checked against the committed catalogue."*
- **Epic B — "Web data loading" (`web`).** Implements AD-24: *"`web` **fetches** exactly eight artifacts at runtime … `dataset.json`, `sync-report.json`, `weights.json`, `recipes.json`, `tracked.json`, `config.json`, `catalogue/stats.json` and `catalogue/static.json` — and never `sync-progress.json` … **nor `catalogue/items.json` and `catalogue/filters.json`, which only `sync` needs**."*

### The AD each obeyed

Both to the letter. And they cannot both be satisfied.

`weights.json` is read only by `core` via `web` (AD-21's table). `web` is forbidden by AD-24 from fetching `catalogue/items.json`. A `bases` key is a **base type `type` string** (AD-5, companion field rules), validated against `data/items` — which is precisely `catalogue/items.json`. So the unit that holds the weights file cannot obtain the authority it must validate against, and the unit that holds the authority (`sync`) never reads the weights file (Finding 3).

The spine contradicts itself here in the open: **AD-21's table says `data/catalogue/*.json` is read by "`sync`, `core` via `web`"** — all four files — while **AD-24 says `web` never fetches two of them.** Two builders reading the two tables build two different loaders.

### The incompatible outcome

A producer regenerates the weights file after a patch and emits `"Guardian Bow "` with a trailing space, or the pre-patch spelling of a renamed base.

- **Agent A**, implementing the hard error, needs `items.json`, cannot have it, and resolves the conflict one of two ways — both bad. Either it adds a ninth fetch (silently breaking AD-24's enumeration and AD-3's two-artifact channel discipline, and passing review because it looks like a trivial loader change), or it drops the base-type half of the check.
- **Agent B**, implementing AD-24 exactly, drops the check on the grounds that AD-6 assigns the validation to `sync`.

Under either drop, the mistyped base is simply **absent from the weights file** from `core`'s point of view, which the companion classifies as *"degraded but loadable — the base is excluded from the ranked ordering."* So a **typo silently removes a base from the product**, landing it in the unrankable group with the reason "absent from weights file" — indistinguishable from a base the producer genuinely has no data for. That is exactly the failure mode AD-6 exists to prevent (*"a tracked combination silently disappearing from the rankings … with no symptom the player would ever notice"*), reached through the one file AD-6's enforcement mechanism cannot see.

The same argument applies to `statId`: `web` does fetch `catalogue/stats.json`, so the stat half is checkable — meaning the two halves of one rule have different enforceability, which is itself a trap for a builder who tests the stat half, sees it work, and assumes the base half does too.

### The tightening

Pick one owner and give it the inputs. The cheapest coherent version:

> **AD-24 amendment.** `web` fetches nine artifacts, adding `catalogue/items.json`. It is a validation authority for `bases` keys and `baseTypeId`s, and is needed at read time for the same reason `stats.json` is.
>
> **AD-6 amendment.** Catalogue validation of every id in `tracked.json` and `weights.json` is a single pure function in `core`, invoked by `sync` before any request and by `web` on load. Both callers reach the same verdict by construction. A `bases` key absent from the catalogue is a **hard file error**, distinct from and never reported as "base absent from the weights file".
>
> **AD-21 amendment.** Correct the reader column so it agrees with AD-24 file by file. Two tables describing one fact is how this hole was opened.

Add a distinct unrankable reason — `invalid-base-key` vs `absent-from-weights` — so the silent case has a name on screen.

---

## 5 — HIGH: `TrackedEntry` has no defined identity key, and internal ids are forbidden

### The two units

- **Epic A — "Dataset writer" (`sync`).** AD-14: *"`dataset.json` contains only the latest observation **per tracked entry**."*
- **Epic B — "Dataset reader / ranking" (`core` + `web`).** Joins observations back onto tracked entries at read time.

### The AD each obeyed

AD-14 says "per tracked entry" and never says how an entry is named. The Consistency Conventions say **"Internal ids are forbidden (AD-5)"**, so neither unit may mint one. AD-5 defines the entry as the tuple `(baseTypeId, itemLevelMin, prefix?, suffix?)` where each affix is itself a tuple with an *optional* third field. AD-22 lists `TrackedEntry` as a `contracts` schema but says nothing about its key. The Encoding convention says "JSON with stable key order" — about serialisation of files, not about deriving a join key.

So both units must derive a key from a nested tuple containing optional fields and floating-point-capable numbers, and nothing tells them how.

### The incompatible outcome

`sync` writes `"Guardian Bow|82|explicit.stat_X:80:89|"` (absent suffix as empty). `core` computes `"Guardian Bow|82|explicit.stat_X:80-89|-"` (absent suffix as `-`). Or one unit renders `valueMax` omitted as the empty string and the other as `null`. Or one canonicalises `80` and the other `80.0`.

Every observation fails to join. Every entry resolves to `not-yet-synced` (AD-9), which `core` faithfully excludes from the EV sum, which yields an **empty ranking with a clean sync report** — and AD-19 already trains everyone to read an empty ranking as "a league change, wait for the re-sync", so the failure has a ready-made innocent explanation.

The partial version is worse: a curator edits one base's `itemLevelMin` (which AD-17 rule 3 *forces* to propagate to every entry on that base), rewriting all those keys at once and orphaning their observations while the rest of the file joins fine. Half the list silently goes cold.

And the tempting fix — "key by position in `tracked.json`" — is available to a builder who reads "internal ids are forbidden" as forbidding only *ids in the data*: an insertion then shifts every key and attaches prices to the **wrong entries**, which does not empty the list, it corrupts it.

### The tightening

> **AD-22 amendment.** `TrackedEntry` carries a derived `key`: a canonical string produced by one exported pure function in `core`, from the tuple alone. The function, not each caller, defines separator characters, the encoding of an absent affix, the encoding of an omitted `valueMax`, and numeric formatting (integers only; a non-integer band edge is a validation error). Positional or ordinal keys are forbidden — this is what "internal ids are forbidden" means operationally.
>
> **AD-14 amendment.** `dataset.json` is keyed by that derived key, and `sync-report.json` reports the count of dataset keys with no matching tracked entry and of tracked entries with no observation. A key mismatch is then **visible as a number in the report**, not as an innocent-looking empty list.

That last clause is the part that converts this from a silent failure to a loud one, and it costs one integer.

---

## 6 — HIGH: AD-26's rotation is under-specified at three seams

AD-26 is new and closes a real hole. It leaves three.

### 6a — A pinned set larger than one chunk starves everything else, forever

**The two units.** **Epic A — "Chunk runner" (`sync`)** and **Epic B — "Rotation selector" (`core`, per AD-26's "`sync` computes it through `core`")**.

**The AD each obeyed.** AD-26.1: *"every `pinned` entry, each chunk, without exception — this is what `pinned` means."* AD-26 preamble: *"stops when any bound in AD-7 is reached."* AD-7's bounds include the remaining search allowance. AD-23: `pinned` means *"refreshed every chunk, exempt from rotation."*

**The incompatible outcome.** If the pinned set exceeds a chunk's search allowance, rule 1 and the stop condition contradict: "without exception" cannot hold. Agent A truncates the pinned list at the allowance and, since AD-26 specifies no intra-pinned ordering beyond *"ties break on a stable key order"*, refreshes **the same leading N pinned entries every chunk forever** — the tail of the pinned set is never refreshed and, being pinned, is also never reached by rule 2's oldest-first rotation. Those rows go arbitrarily stale while being the rows the curator marked as most important. Agent B applies oldest-first *within* pinned, which rotates them fairly but means a pinned entry is refreshed once per several chunks — a direct contradiction of "each chunk" and of AD-23's definition of the word.

Both produce schema-valid datasets. AD-10's per-row freshness makes the staleness visible in principle, but nothing distinguishes "stale because pinned-set overflow" from "stale because the rotation has not come round".

**The tightening.** Make the contradiction impossible rather than resolvable:

> The pinned set is bounded: `count(pinned) ≤ ` a configured fraction (suggest one third) of the minimum chunk search allowance. Exceeding it is a **validation error on `data/tracked.json`**, because "refreshed every chunk" is a promise the budget must be able to keep. Within the pinned set, order is the stable key order; because the whole set fits in a chunk by construction, intra-pinned ordering is never load-bearing.

### 6b — Currency rates are outside the rotation order they must precede

**The two units.** **Epic A — "Rotation selector"**, implementing AD-26's four-step order as *the* chunk plan. **Epic B — "Normalisation" (`sync` + `core`)**, implementing AD-20: *"Currency rates are synced **before any priced entry in the same chunk**; if a listing's currency has no current rate, the entry is written `not-yet-synced`."*

**The incompatible outcome.** AD-26 says selection proceeds *"in exactly this order"* and currency refresh is not one of the four steps. Agent A therefore treats currency sync as outside AD-26 — and, having no rule about where it goes, places it after the pinned pass, or makes it conditional on rate staleness. If the pinned pass consumes the chunk's allowance (6a) or the exchange requests are simply the last thing attempted, then under AD-20 **every entry priced in that chunk is written `not-yet-synced`** rather than priced. The dataset silently empties out, one chunk at a time, with a clean report — AD-20's failure mode is "visibly empty", but only if someone connects an empty ranking to a missing rate, and AD-19 again supplies an innocent explanation.

Agent B hard-sequences currency first and reserves allowance for it, producing a materially different refresh profile from the same tracked list and the same clock.

**The tightening.** Put currency into AD-26 as step 0 and give it a reservation:

> 0. **Currency rates first, unconditionally**, for every currency in `data/currencies.json` whose rate is older than the configured rate horizon. This step's allowance is **reserved** — a chunk that cannot fund it performs no pricing at all and says so in `sync-report.json`, rather than pricing entries it will then have to write `not-yet-synced`.

A chunk that prices nothing and reports why is honest. A chunk that prices ten entries into `not-yet-synced` is indistinguishable from a league reset.

### 6c — Recompute-the-order vs resume-a-frozen-plan

**The two units.** **Epic A — "Resumability" (`sync`)**, implementing AD-7: progress is `sync-progress.json`, and a chunk is bounded partly by *"the unprocessed remainder of **the workload**"* — which presupposes a workload that persists across chunks. Agent A therefore freezes a selection plan at the start of a pass, stores it in `sync-progress.json`, and consumes it chunk by chunk. **Epic B — "Rotation selector"**, implementing AD-26: the order is *"a pure function of the tracked list, the dataset and a passed-in clock value"* — so Agent B recomputes it at every invocation and treats `sync-progress.json` as holding only in-flight state.

**The incompatible outcome.** Under A, a `pinned` entry is refreshed **once per pass**, not once per chunk — flatly contradicting AD-26.1 while obeying AD-7's wording. Under B, there is no meaningful "unprocessed remainder of the workload" for AD-7's third bound to bind against, so A and B also disagree about **when a chunk ends**. The two implementations produce different staleness distributions and different per-source request accounting in `sync-report.json` (AD-12), from identical inputs, with no artifact that disagrees.

**The tightening.** State the answer in AD-26 and make AD-7's third bound consistent with it:

> The rotation is **recomputed at every invocation** from the tracked list, the dataset and the clock. `sync-progress.json` carries only in-flight request state and the current chunk's consumed allowances — never a frozen plan. AD-7's "unprocessed remainder of the workload" therefore means *the entries the recomputed order still selects*, which shrinks naturally as observations are written.

---

## 7 — HIGH: raw bases and AD-17 rule 3 — the white ilvl-82 base is legislated out, or the file is rejected

### The two units

- **Epic A — "Tracked list validation" (`core`).** Implements AD-17 rule 3: *"**Differing `itemLevelMin` across entries on one `baseTypeId`.** … A base therefore has exactly one item level floor, and the tracked list is validated for it."* Rule 3 says *entries*, unqualified. Agent A validates all of them.
- **Epic B — "Raw base branch" (`core`).** Implements AD-17's closing paragraph: *"**Raw bases rank on a separate branch.** A `TrackedEntry` with both affixes absent (AD-5) is **never a summand** … Its `EV` is its observed price, with zero craft cost."* Agent B notes that both of rule 3's stated justifications — double-counting within the sum, and "`EV` is an expectation over one crafting act on one item population" — are arguments **about summands**, and that a raw base is by construction not a summand and not a crafting act. Agent B therefore excludes raw-base entries from rule 3.

### The AD each obeyed

Rule 3's *text* supports A. Rule 3's *stated reasons*, and the raw-base paragraph, support B. Both readings are defensible from AD-17 alone.

### The incompatible outcome

The brief's scope map lists **"White ilvl-82 bases"** as a first-class item, governed by *"AD-5 (both affixes absent), AD-17"*. Meanwhile a magic craft on the same base is very often worth tracking at a **lower** floor, because the interesting prefix rolls at ilvl 75 and lowering the floor widens the priced population. So the natural tracked list is:

```
entry 1 (raw):      Guardian Bow, itemLevelMin 82, no affixes
entry 2 (crafted):  Guardian Bow, itemLevelMin 75, prefix = (stat_X, 80, 89)
```

- **Agent A** rejects the file at load. Per AD-3, `web` *"refuses to render an invalid artifact rather than degrading"* — **the entire site goes blank** because of one curation choice the brief explicitly asked for. Loud, but catastrophic and baffling.
- **Agent B** loads it, prices the raw base at ilvl 82 and the craft at 75, and ranks both.

If the curator instead resolves A's rejection by forcing the raw entry to 75 — the obvious fix, since the crafted entry is the one earning money — then AD-16 builds the raw-base search with `type_filters.ilvl min = 75` and `rarity = normal`, and the product **prices ilvl-75+ white bases while the view calls them ilvl-82 bases**. Silent, and it destroys the single scope item most likely to be the product's simplest reliable signal: an ilvl-82 white base is a distinct, higher-priced good, and a 75-floor search floods the sample with cheap ones, dragging the median down and pushing the row *out* of the ranking at any meaningful threshold.

So the same tracked list yields: a blank site, a correct ranking, or a quietly mispriced flagship row, depending on which reading an agent picked.

### The tightening

Rule 3's reasoning is about the partition; scope it to the partition and give raw bases their own floor:

> **AD-17 rule 3 amendment.** Differing `itemLevelMin` across the **crafted** entries (those carrying at least one affix) on one `baseTypeId` is a validation error. A raw-base entry (both affixes absent, AD-5) is **not** a summand and is exempt: it carries its own `itemLevelMin`, is searched at that floor (AD-16), and is ranked on the separate raw branch. At most one raw-base entry per `(baseTypeId, itemLevelMin)`.
>
> **AD-18 amendment.** A raw-base entry has no probability term and no pool; it is therefore **not subject to the pool-coverage gate** — AD-27's coverage fraction must not suppress raw-base rows, which need no weights file at all.

That last clause is worth checking independently: as written, AD-18 says *"A base whose pool is not `complete` is not ranked"* — a base, not an entry. A raw ilvl-82 base whose *crafted* pool is `partial` would be pulled out of the ordering by one reading and left in by another, even though its own EV is a directly observed price with no weights dependency whatsoever. That is a second, independent instance of this finding.

---

## 8 — HIGH: an unknown stat id is a per-entry state to one unit and a file-level refusal to another

### The two units

- **Epic A — "Sync pre-request validation" (`sync`).** AD-6: *"Detection is by catalogue validation, not by inference. Every `statId` and `baseTypeId` … is checked against the committed catalogue (AD-25) before any request is issued"*, and an entry referencing a stat id the API no longer exposes gets price state `unresolvable` **and** a line in `sync-report.json`. Per-entry degradation.
- **Epic B — "Web load validation" (`web`).** AD-3 and AD-24: every artifact is validated on load and `web` *"refuses to render an invalid artifact rather than degrading."* The Conventions row says "Validate at every trust boundary". `tracked.json` is one of the eight fetched artifacts. Agent B validates its ids against `catalogue/stats.json` and finds one absent.

### The incompatible outcome

The curator adds an entry for a **newly introduced** modifier the same evening GGG ships a patch, before anyone runs `pnpm catalogue:refresh` (AD-25: explicit, human-invoked, patch cadence; AGENT-WORKFLOW repeats that it is never run unattended).

- **Agent A** marks the entry `unresolvable` without issuing a request, and `sync-report.json` reports a **patch-out** — the precise opposite of the truth. AD-6's own rationale warns against conflating states, addresses the `no-listings` conflation, and misses this one: a **stale catalogue** and a **removed modifier** are indistinguishable under a pure catalogue check. And AD-26.3 then puts the entry on a bounded retry schedule that can never succeed, because the retry re-runs the same catalogue check.
- **Agent B** refuses to render `tracked.json` at all. The whole view goes blank on a valid curation edit.

One unit degrades one row and mislabels it; the other blanks the product. Both cite the spine.

### The tightening

> **AD-6 amendment.** An id absent from the committed catalogue yields the per-entry state `unresolvable` with a reason field distinguishing **`catalogue-stale`** (the catalogue's `fetchedAt` predates the entry's last edit in `tracked.json`, or predates the configured game patch in `data/config.json`) from **`removed-upstream`**. `sync-report.json` reports the two separately, and the `catalogue-stale` count is surfaced by `web` as a prompt to run `catalogue:refresh` — which is the actual remedy.
>
> **AD-3 / AD-24 amendment.** "Refuses to render" applies to a **schema-invalid** artifact. A schema-valid artifact containing a reference the catalogue does not resolve is a **per-entry** condition (AD-6), never a file-level refusal. Name this distinction explicitly; it is currently the difference between a bad row and a blank site, decided by whichever agent writes the loader.

Also record the catalogue's `fetchedAt` in `catalogue/*.json` — nothing currently requires it, and the `catalogue-stale` test above needs it.

---

## 9 — MEDIUM: AD-27's coverage denominator is undefined

**The two units.** **Epic A — "Weights generation + coverage measurement"** (AD-27's *"first build task"*) and **Epic B — "View design"**, which AD-27 binds to a threshold band.

**The AD each obeyed.** AD-27: *"count the fraction of **endgame base types** resolving to `complete` pools."* "Endgame base types" appears nowhere else in the spine and is not a category in `catalogue/items.json` as described.

**The incompatible outcome.** Agent A measures over the base types **present in `data/tracked.json`** — a number that is near 100% by construction, since a curator tracks what they have weights for. Agent A reports 95%, and Epic B builds the unrankable group as a footer. Agent A' measures over **every base type in the catalogue's endgame categories** and reports 40% — under which AD-27 says *"the ranking premise fails. Escalate rather than ship."* Same weights file, same catalogue, opposite build decisions, and AD-27 is a **build-sequencing gate**, so the cost of the wrong reading is a committed layout — precisely the cost AD-27 was written to avoid.

**The tightening.**

> Define the denominator explicitly: the set of `baseTypeId`s appearing in `catalogue/items.json` whose category is listed in a committed `data/coverage-scope.json`, which names the endgame categories in scope. The measurement is a committed script producing a committed report, not a one-off count, so it is re-runnable on every weights regeneration and its result is a diff. The numerator is base types with **both** slots at `poolCoverage: "complete"` — a base complete in `prefix` and partial in `suffix` is not complete, since AD-18 excludes the base, not the slot.

That last sentence is itself a live ambiguity: `poolCoverage` is declared **per `(base, slot)`** in the companion, and AD-18 excludes **bases**. Two builders will resolve a prefix-complete/suffix-partial base differently, one ranking it and one not.

---

## 10 — MEDIUM: the catalogue refresh has no defined rate-limit bucket

**The two units.** **Epic A — "Governed client" (`sync`)**, implementing AD-8: *"Exactly one adapter issues requests … searches, fetches **and catalogue refreshes (AD-25) alike**. It reads `X-Rate-Limit-Rules` to learn the active rule names … It paces against the tightest unsatisfied bucket."* **Epic B — "Catalogue refresher" (`sync`)**, implementing AD-25's four requests and AD-12's per-source accounting *"against the live bucket"*.

**The incompatible outcome.** AD-8's measured table names two policies, `trade-search-request-limit` and `trade-fetch-request-limit` — both for search and fetch. The `/data/*` endpoints are a different family and may return a different rule name, or no rate-limit headers at all. Agent A, finding no known rule, either paces against the tightest *known* bucket (charging four catalogue requests against the search allowance, which AD-12 sized at ~1,500 of 2,400) or treats an absent header as unlimited. Agent B, implementing AD-12's per-source report, must attribute those four requests to *a* bucket and picks the other reading. The per-source accounting AD-12 requires so that *"budget drift is observable per cause"* then differs between a dry run and a real run, and the one artifact meant to make drift visible reports it two ways.

**The tightening.** AD-8 should state the behaviour for an **unknown or absent rule**: treat an absent `X-Rate-Limit-Rules` as a distinct `unmetered` bucket, record it in `sync-report.json` as such rather than folding it into `search`, and — since AD-8 forbids hardcoded rates — apply a conservative configured floor rather than assuming either extreme. AD-12's per-source table should name the catalogue's bucket explicitly.

---

## 11 — MEDIUM: `(base, recipe)` row enumeration, and whether the threshold applies to raw bases

**The two units.** **Epic A — "Ranking engine" (`core`)** and **Epic B — "List view" (`web`)**, where AD-4 forbids `web` from computing any ranking term, so every question below is `core`'s to answer and `core`'s alone.

**11a — row cardinality.** AD-17 ranks *"a `(baseTypeId, recipe)` pair"*, and AD-18 states that in v1 *"ordering is therefore recipe-invariant … and differs only by the subtracted cost."* Agent A emits one row per `(base, recipe)` for every recipe in `data/recipes.json` — so a base with three recipes occupies three adjacent rows differing only by a constant. Agent B emits one row per base under its cheapest recipe. Both obey AD-17 and AD-18. The lists have different lengths and different top fives, and since AD-4 forbids `web` from reducing them, Epic B's view cannot correct Epic A's choice.

**11b — the threshold on the raw branch.** AD-17's truncation lives inside the sum (`price(combo) ≥ threshold`), and raw bases are *"never a summand."* Agent A applies the threshold to raw rows too, for a coherent dial. Agent B does not, so raw bases persist at every threshold. Turning the dial — *"the product's central control"* — then behaves differently between two conforming implementations.

**The tightening.** AD-17 should state both: **one row per `(baseTypeId, recipe)`, all recipes emitted, `web` may filter by recipe but computes no term** (or the converse, but pick one); and **the threshold applies to the raw-base branch on its observed price**, so the dial means one thing everywhere.

---

## 12 — MEDIUM: median of an even sample, and where rounding lands

**The two units.** **Epic A — "Price observation writer" (`sync`)** and any second implementation of the same statistic (a `sync:dry` path, a `core` test oracle, a re-derivation during review).

**The AD each obeyed.** AD-16: *"the **median** of those listings' prices after normalisation to divine."* Conventions: *"Persisted divine prices are numbers rounded to 4 decimal places **at the point of normalisation**. Rounding happens once, in `sync`; `core` never re-rounds, so two readers of one artifact cannot disagree on a value."*

**The incompatible outcome.** AD-16 fetches up to ten listings — an **even** count in the common case. Agent A takes the lower median (an actual listing price, already rounded). Agent B takes the mean of the two middle values, which generically produces a fifth decimal place; the convention says rounding happened "at the point of normalisation", which is *before* the median, so it is genuinely unclear whether B may round again, and "core never re-rounds" forbids fixing it downstream.

The divergence is small in magnitude and **large in effect**, because AD-17's threshold is a step function: a combination at `price ≈ threshold` is either in the EV sum entirely or contributes nothing, and it drags its whole probability mass with it. Two implementations that differ in the fourth decimal produce different *sets* of summands and different orderings — the same discontinuity AD-5 identifies as the reason bands were introduced.

**The tightening.** AD-16: *"the **lower median** — for an even sample, the lower of the two central normalised values. The result is therefore always an observed, already-rounded listing price, and no second rounding arises."* And state the tie/step behaviour at the boundary: `price ≥ threshold` is inclusive (it already is; keep it explicit in `core`'s comparator so two builders cannot make it exclusive).

---

## 13 — LOW: provenance weakness ordering is implied by list order, never stated

AD-10 requires `core` to propagate *"the **weakest** provenance"* of every input, over the set `measured | uniform-prior | absent`, and never states the order. The list order implies `measured > uniform-prior > absent`, and AD-18 corroborates it by assigning `absent` to the strictly worse case (a `partial` pool, an upper bound rather than an estimate). But a builder can argue the reverse for `absent` — "no claim made" is arguably weaker *or* stronger than "a placeholder claim made". Two `core` implementations would then stamp a figure combining a `uniform-prior` weight with an `absent` pool differently, and AD-10 requires `web` to render the two visibly differently — so the same figure appears trustworthy in one build and not in the other.

**The tightening.** State the total order in AD-10 as a one-line ranking: `measured` (strongest) → `uniform-prior` → `absent` (weakest), and note that weakest-wins is a monoid `core` exposes as a single exported function, so no caller re-implements it.

---

## Cross-cutting observation: the three-case enumeration is a recurring shape

Findings 1, 2 and 4 share a form worth naming, because it will recur in revision 3.

Revision 2 improved the spine by making rules **enumerated and concrete** — AD-17's three partition cases, AD-24's eight artifacts, the companion's hard-error list. Enumeration is the right instinct: it is what makes an AD checkable rather than aspirational. But an enumeration is a **closed set**, and a builder obeying a closed set to the letter is doing exactly what the document asked. Every place where the spine enumerates instances of an unstated general rule, the instances not enumerated become legal.

The remedy is cheap and worth applying systematically: **state the predicate, then list the instances as named examples of it.** AD-17's partition is disjointness, and three of its instances are listed. AD-18's normalisation invariant is that numerator and denominator draw from one pool, and two of its scoping rules are listed. AD-6's invariant is that every id crossing into the system is resolved against one authority, and the halves that happen to be reachable are listed. In each case the predicate is one sentence, and it is the sentence that makes the enumeration safe to read as complete.

## What I would land first

1. **Finding 3** — it re-opens BQ-1, the defect revision 2 exists to fix, and it needs only an AD-5 sentence plus an owner for the check.
2. **Finding 1** — one additional partition case plus the predicate; a curator can write the offending pair today and it inflates the top of the ranking.
3. **Finding 2** — one sentence in AD-18 and the deletion of a dangling cross-reference.
4. **Finding 4** — a table correction (AD-21 vs AD-24 already disagree in the open) and one more fetched artifact.

Findings 5 through 8 are each a paragraph. Findings 9 through 13 are sentences. None of this is structural: the paradigm, the package graph, the port discipline and the four-state price model are all sound, and revision 2's amendments are well-reasoned. The remaining holes are all in the same place — the seam where a rule's *text* and a rule's *stated reason* have different extents, and a conforming builder may follow either.
