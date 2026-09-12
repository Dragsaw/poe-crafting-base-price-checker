---
title: "Adversarial Review: PRD — PoE2 Crafting Base Price Checker"
status: review
created: 2026-09-12
target: docs/prds/prd-poe-crafting-base-price-checker-2026-09-12/prd.md
inputs_checked:
  - docs/prds/prd-poe-crafting-base-price-checker-2026-09-12/addendum.md
  - docs/briefs/brief-poe-crafting-base-price-checker-2026-09-12/brief.md
  - docs/briefs/brief-poe-crafting-base-price-checker-2026-09-12/addendum.md
  - docs/architecture/architecture-poe-crafting-base-price-checker-2026-09-12/ARCHITECTURE-SPINE.md
  - docs/architecture/architecture-poe-crafting-base-price-checker-2026-09-12/WEIGHTS-FILE-SCHEMA.md
---

# Adversarial Review

## Verdict

The PRD is well-organised, disciplined about vocabulary, and unusually careful about citation hygiene. None of that is the problem. The problem is that its central arithmetic does not close.

Three of the document's load-bearing rules — FR-18 (price is the median of the cheapest listings above a value floor), FR-26 (probability is the summed weight of every band above that same floor), and FR-19 (the item level floor is derived from the accepted tier) — are individually well-stated and **mutually inconsistent**. Each was inherited or decided in isolation; nobody multiplied them together. The result is that `EV` as specified is biased in a known direction, computed over a probability space the search filter does not sample, and in v1 is dominated by a term that is constant across every row. The PRD presents `EV` as "that one number being right" (§1) and never once sanity-checks its magnitude, its sign, or its comparability across the two branches it defines.

A second class of failure is structural self-deception: the document's honesty apparatus (Provenance labelling, counter-metrics, "honest failure" framing at league reset) is presented as a managed risk when, in the only version the PRD specifies, it provably cannot discriminate anything.

A third class is ordinary but expensive: an agent starting `sync` on Monday morning cannot begin. The chunk scheduling policy ("rotation") is named three times and defined nowhere; the mechanism for detecting an unresolvable stat id does not exist; the source of exchange rates does not exist; the mechanism for "date of the last tracked-list edit" does not exist.

Citation hygiene is genuinely good — I spot-checked roughly twenty `(AD-n)` references and found no outright fabrications. But two of the most load-bearing restatements are *lossy* in ways that matter (FR-26 drops a scoping qualifier; FR-3 attributes "exactly 82" to an AD that says "endgame item level"), which is worse than it sounds in a document whose stated method is "cite, don't re-argue."

**Counts:** Critical 5 · High 14 · Medium 12 · Low 5.

---

## Critical

### C-1. FR-19's item level floor invalidates every probability FR-26 computes

**Location:** FR-19 (all bullets) × FR-26 bullets 1–2 × `WEIGHTS-FILE-SCHEMA.md` "Shape".

FR-19 makes each Tracked Entry carry an `itemLevelMin`, and FR-18 puts that floor into the trade search. FR-26 then computes `P(modifier | base, slot)` as "summed weight over the **total weight of the complete Eligible Pool**."

**The Weights File has no item level dimension.** Its shape is `bases.<baseTypeId>.<slot>.entries[]` — weights per `(base, slot)`, full stop. Its `poolCoverage: "complete"` is defined (schema, "The pool-completeness rule") as "every modifier that can roll in that slot on that base" *with no item level qualifier*.

But which modifiers can roll is a function of item level. That is the entire premise FR-19 rests on — the addendum's own bow table says increased physical damage T1 "available at ilvl 82." So:

- The **denominator** is the pool at all item levels, while the search population is items at `itemLevelMin` and above, whose true pool is strictly smaller. Every `P` is therefore deflated by an unknown factor.
- The **numerator** is worse. FR-26 sums "every Weights File band with that `statId` whose `valueMin >= ` the reference's floor." For the bow example, an entry filtering at ilvl 75 with `valueMin` at the T2 floor sums the T2 band **and the T1 band** — but T1 cannot roll on an ilvl-75 item at all. The numerator includes probability mass that is unattainable in the population being priced.

These errors run in opposite directions and do not cancel; neither is estimable from anything in the inputs.

Worse for the spine's own goals: the bow example gives two entries on one base with floors of 73 and 75 (per FR-19, one entry takes max(73,75)=75, but a *different* entry on bows tracking only crit chance would legitimately carry 73). FR-1 then sums those terms into one `EV` — **terms computed against different item-level populations, sharing one denominator.** That is not a rounding issue; the summands are not commensurable.

The PRD flags Open Question 1 as "`TrackedEntry` gains `itemLevelMin`" and calls it a `contracts` amendment. It is not only that. FR-19 makes `P` item-level-conditional, which is a **`WEIGHTS-FILE-SCHEMA.md` amendment** — a new dimension on the pool, or an explicit, argued statement that the error is accepted and bounded. The PRD does neither and does not notice the question exists.

### C-2. FR-18, FR-19 and FR-26 together multiply multi-tier probability mass by a lowest-tier price

**Location:** FR-18 bullets 1–2 × FR-26 bullet 1 × FR-19 bullets 1–3.

AD-5 makes a Modifier Reference a floor. FR-26 makes it "a **floor spanning tiers**," summing every band at or above it. FR-18 prices that same entry by searching `valueMin = floor`, **sorted by price ascending**, taking the **median of the cheapest 10**.

So for any reference whose floor spans more than one band — which FR-26 *designs for* and which FR-19 makes routine ("accept tier 2" = set `valueMin` to the T2 floor):

- `P(combo)` carries the mass of T1 **and** T2.
- `price(combo)` is the median of the *cheapest* matching listings, which by construction are the T2 rolls — T1 items are more expensive and sorted to the back.

`EV` therefore multiplies a T1+T2 probability by a T2 price. It systematically **understates exactly the jackpot outcomes the truncated-EV metric exists to isolate** (brief addendum, "Ranking Metric — Derivation": the whole reason for truncation is that the jackpot is what the player wants).

Note the second-order effect: FR-14 forbids tracking the same `statId` in the same slot at nested floors ("nested value floors is a validation error"). So the player **cannot** fix this by tracking T1 and T2 separately. The identity model makes tier-differentiated pricing structurally impossible, and the PRD nowhere states this.

The PRD addendum ("Why the PRD Cites Architecture Decisions Instead of Restating Them") claims the arithmetic is stated intact precisely because these are "the places where two independently-built components could satisfy a looser requirement in mutually incompatible ways." This is exactly such an incompatibility. Both components satisfy their requirements. The product is still wrong.

### C-3. The Provenance mechanism cannot discriminate anything in v1

**Location:** FR-9 × FR-25 × UJ-4 (§2.3) × SM-C4 (§8) × §2.1 JTBD 3.

FR-25 ships a Weights File where "**Every** entry carries `weight: 1` and `provenance: "uniform-prior"`." FR-9 propagates "the **weakest** Provenance ... of every input into each derived figure." Therefore, in v1, **every derived figure in the product carries `uniform-prior`, without exception.**

A label with no contrast set carries zero information. It cannot support:

- **UJ-4** ("sees it is labelled as resting on the uniform prior ... and discounts it rather than acting on it") — the journey describes distinguishing a suspect row from trustworthy neighbours. There are no trustworthy neighbours. The player either discounts every row, which is the same as having no tool, or habituates to a badge that is always on, which is the same as having no badge.
- **FR-9 consequence 2** ("A figure resting on `uniform-prior` ... renders visibly differently from one resting on `measured`") — untestable against v1 data, because no `measured` figure exists. It can be tested only against a synthetic fixture that v1 never ships.
- **SM-C4** ("Rendering `uniform-prior` figures as cleanly as measured ones would make the tool feel more authoritative and be more dangerous ... is the reason FR-9 exists").

§2.1 states the risk correctly — "without being told, he will trust the placeholder six months later" — and then the PRD congratulates itself for a mechanism that, on its own specification, changes nothing about the six-months-later case. The honest v1 design is a **product-level** statement ("nothing in this ranking rests on measured weights"), not a per-figure badge. The per-figure badge becomes useful the day mixed provenance arrives, which §6.2 defers indefinitely.

### C-4. "Rotation" — the entire chunk scheduling policy — is undefined

**Location:** FR-13 bullet 1 ("exempt from rotation"), FR-16, §3 Glossary (Chunk), §4.6 description.

FR-16 says a Chunk "ends at whichever comes first: the remaining search allowance, the remaining fetch allowance, or the workload remainder" and that "Processing order is deterministic given a tracked list." FR-13 says pinned entries are "exempt from **rotation**."

Rotation is never defined, is not in the Glossary (which §3 declares exhaustive: "§3 defines every domain noun"), is not an Open Question, and is not in the spine either — AD-23 uses the word once with the same absence. Yet it is the policy that decides:

- Which of 1,500 entries this chunk touches.
- How the ~15-hour full refresh distributes over chunks.
- What a resumed run resumes to (FR-16: "a resumed run is explainable" — explainable by what rule?).
- Whether a newly added entry is priced today or in fifteen hours.
- What happens to an entry whose search failed — retried this chunk, next chunk, or next full cycle.

This is the single largest decision the PRD silently hands to whoever writes `sync`, and two agents will implement it differently with no test able to catch it. "Processing order is deterministic" is not a policy; a round-robin, a least-recently-synced priority queue, and a fixed file-order scan are all deterministic and produce wildly different freshness distributions — which FR-10 then renders per row as though the distribution were a fact of life rather than a choice nobody made.

### C-5. Raw Bases and crafted Base Types are ranked in one ordering with incommensurable units, and the PRD's fix is cosmetic

**Location:** FR-3 × FR-1 × §3 Glossary (Combination, Raw Base) × AD-17.

FR-3: "A Raw Base's EV is its observed price with zero Craft Cost." FR-1: a crafted Base Type's EV is `Σ P(combo) × price(combo) − Craft Cost`.

With the v1 uniform prior over a *complete* eligible pool — which the schema requires to include "worthless ones" — a pool of ~40 prefixes and ~40 suffixes gives `P(combo) ≈ 1/1600 ≈ 6e-4`. A crafted base with five tracked combinations above threshold at 3 Div each contributes `5 × 6e-4 × 3 ≈ 0.009 Div`, then subtracts a full Craft Cost. A Raw Base contributes its whole observed price, typically 0.1–1 Div, at certainty.

**Every Raw Base outranks every crafted Base Type, by two or three orders of magnitude, always.** UJ-1's "top five bases" is, in v1, the five most expensive white bases — which is the "most expensive base" ranking §1 explicitly names as the thing this product is *not*.

AD-17 saw this coming: "at `P = 1` it would enter at certainty and swamp every crafted outcome." Its remedy was to make raw bases "never a summand" and rank them "in the same list and labelled as an uncrafted base." That prevents *double-counting*; it does not prevent *swamping*, which is a property of the ordering, not of the sum. FR-3 inherits the remedy without re-testing whether it addresses the problem AD-17 named, and adds only a rendering requirement ("rendered distinguishably ... not carried by colour alone").

Two further holes fall out of the same place:

- **Does the Payout Threshold apply to a Raw Base?** §3 defines Combination as "the outcome a **crafted** Tracked Entry describes," and FR-1's truncation ranges over "Combinations." A Raw Base is therefore, by the PRD's own Glossary, outside the truncation. So a 0.05 Div white base survives a 1 Div threshold and ranks above every crafted base with negative EV. FR-5's promise that the list reorders meaningfully as the threshold moves is broken at the top of the list, permanently. The PRD does not answer this; an implementer will guess.
- **Craft Cost does no ordering work in v1.** §6.2 correctly notes that a second recipe "adds a cost column and no ordering information." Nobody noticed that the *first* recipe has the same property: with one recipe and an identity distribution transform (FR-23, AD-18), `Craft Cost` is the **same constant** subtracted from every crafted base, so it cannot change any crafted-vs-crafted ordering. It affects only the sign of the displayed number and the crafted-vs-raw comparison — the one comparison the PRD does not specify. FR-1 devotes two of its seven testable consequences to Craft Cost ("subtracted once, never per Combination"; "gross, never net") while the consequential question goes unasked.

---

## High

### H-1. FR-12 and FR-28 directly contradict each other

FR-12: "**Nothing outside `data/tracked.json` and `data/currencies.json` generates a trade API request.**"
FR-28: "`sync` validates `data/config.json`'s league against the **live leagues endpoint** at the start of each run."

`config.json` is outside both files and generates a trade API request on every single run. FR-12's second consequence — "The Sync Report records requests consumed **per set**, so budget drift is attributable to a cause" — has no set to attribute it to. With frequent invocation this is not negligible: the leagues call fires once per chunk, not once per refresh. Both FRs cite ADs (AD-12, AD-19) that carry the same tension, but the PRD restates FR-12 as an absolute testable consequence rather than flagging the exception.

### H-2. FR-22's "rates before any priced entry in the same Chunk" contradicts the budget and can livelock the syncer

FR-22: "Exchange rates are synced **before any priced entry in the same Chunk**."
FR-16: a Chunk ends when "the remaining search allowance" runs out.
FR-12: 1,500 entries against ~2,400 searches/day, "leaving headroom for retries, currency rates and a second recipe."

The headroom figure (38%, i.e. ~900 searches/day) is asserted, never computed against the PRD's own mandated consumers. FR-22 makes rate syncing a **per-chunk** cost, not a per-day cost. If the scheduler invokes hourly, that is 24 rate syncs per day; against, say, a dozen declared currencies that is ~288 requests/day — 12% of the total budget, unmentioned. FR-13's pinned entries ("refreshed **every Chunk**") and FR-28's leagues call are two more per-chunk consumers the 62% figure excludes.

Worse, the ordering is a livelock hazard. A chunk that begins with a nearly-exhausted search bucket spends its entire remaining allowance on currency rates and prices **zero** entries. Nothing in the PRD establishes a minimum chunk size, a rate-freshness reuse window ("skip if rates are under N hours old"), or a rule that rates come from a different bucket. Under an aggressive invocation schedule the syncer can burn its whole daily budget re-syncing rates and never advance the workload — and FR-16's "exits 0" lock behaviour means no scheduler will ever report a problem.

### H-3. `not-yet-synced` is overloaded across three causes, which breaks FR-8

FR-8 requires the four Price States be "four different things on screen" and "never collapsed into one another," and FR-7 requires each row show "its Price State."

But `not-yet-synced` is written for three unrelated conditions:

1. Never attempted (Glossary; the literal meaning).
2. **Priced but un-normalisable** — FR-22: "If a listing's currency has no current rate, the entry is written `not-yet-synced` rather than stored unnormalised."
3. **Priced in the wrong league** — FR-27: "`core` refuses to value an observation whose league differs from the active one, **treating it as `not-yet-synced`**."

(2) is a sync *failure* rendered as "not yet attempted." (3) is a successful observation rendered the same way. The player cannot tell "we have not looked" from "we looked and something is broken" — which is the exact failure mode AD-9 exists to prevent, reintroduced by two FRs that each cite AD-9's family approvingly. FR-10's per-row freshness does not disambiguate them either, since a never-attempted row has no timestamp at all.

### H-4. Price State is simultaneously a persisted value and a recomputed one; the PRD never says which the view renders

FR-20: "`sync` **writes** that entry's Price State as `unresolvable`." FR-22: sync writes `not-yet-synced`. So state is persisted in the Dataset.

FR-27: "`core` refuses to value an observation whose league differs from the active one, **treating it as `not-yet-synced`**." So state is also derived at read time, and the derived value can disagree with the persisted one — a row can be `priced` in `dataset.json` and `not-yet-synced` according to `core`, simultaneously.

AD-9's "Every tracked entry's price is **exactly one** of ..." is therefore false as specified. FR-8 tells `web` to render the four states distinctly but never says whether it renders the Dataset's state or `core`'s. AD-4 says `web` "may not compute any ranking term itself" — so presumably `core`'s — but then the Dataset's persisted `priced` is dead data, and FR-7's "the number of listings the estimate rested on" belongs to an observation the view is being told to ignore. Two implementers will diverge here and no test will catch it.

### H-5. FR-4 and FR-26 make Raw Bases Unrankable for a reason that does not apply to them

FR-4: "A Base Type whose Eligible Pool for either slot is not `complete`, or which is absent from the Weights File entirely, is Unrankable and excluded from the ordering."

A Raw Base's valuation (FR-3) uses **no weights at all** — `EV` is its observed price. The stated rationale for unrankability (FR-26, AD-18) is that "an inflated denominator must remove the Base Type from the ordering" — there is no denominator in a Raw Base's EV. Yet Unrankable is scoped to the **Base Type**, so a white ilvl-82 base whose weights are missing drops out of a ranking that never needed them.

This is not hypothetical: Open Question 4 says the uniform-prior file's coverage "is unknown" and warns "if coverage is poor, v1 ranks a small fraction of the catalogue." Under poor coverage this rule removes most of the Raw Base branch — the one branch that is mathematically sound in v1 — for no reason.

### H-6. FR-19's "item level exactly 82" is unimplementable with the field FR-19 adds

FR-3: "A Raw Base's search uses `normal` rarity and item level **exactly 82**."
FR-19: "`itemLevelMin` is a declared field on the Tracked Entry" and "Raw Bases are pinned to item level **exactly 82**."

`itemLevelMin` is a floor (`≥`). There is no `itemLevelMax` anywhere in the PRD, the spine, or Open Question 1's contract amendment. "Exactly 82" requires either a second field or an argued statement that ≥82 and =82 coincide because 82 is the game's ceiling for these drops — a game fact asserted nowhere in any of the four source documents. Additionally, FR-19's "Neither `sync` nor `core` infers or adjusts it" contradicts "Raw Bases are **pinned** to 82": something must enforce the pin, and every candidate (schema validation, sync, core) is excluded by that sentence. Open Question 1 therefore **under-states the contract change it exists to flag** — it names one field and misses the constraint, the validator change (H-7), and the weights-schema implication (C-1).

### H-7. FR-19 opens an overlap-validation hole that FR-14 cannot see

FR-14 defines overlap purely in affix terms: "The same `statId` in the same slot at nested value floors is a validation error, as is a partial-affix entry subsuming a full one."

After FR-19, two entries can be identical in `(baseTypeId, prefix, suffix)` and differ only in `itemLevelMin`. Their outcome sets overlap completely — the ilvl-82 entry's population is a subset of the ilvl-75 entry's — and FR-14's rule, stated entirely in terms of stat ids and value floors, **passes them**. They then double-count in FR-1's sum, which is precisely the condition FR-14 exists to prevent. The one thing the PRD decides breaks the one validation it specifies in most detail, and neither §8 nor §9 mentions it.

### H-8. FR-19's player-facing item level is the wrong aggregation for the decision it serves

FR-19: "The tracked list's per-Base-Type floor **visible to the player** is the **maximum** across that Base Type's entries."

The player's job (UJ-1, §1) is "is this base worth picking up?" A base at ilvl 76 satisfies a 75-floor entry and fails an 82-floor one. Displaying the **maximum** tells him to leave on the ground every item that would have satisfied any entry below the max. The correct number for a pickup decision is the **minimum** across entries (pick up anything that can satisfy something), possibly with the per-entry floors shown on expansion.

Note also that the addendum's derivation does not support the FR. The bow example takes a max across **two affixes of one entry** — where max is correct, since both affixes must be present on one item. FR-19 then silently generalises to a max across **all entries on a base**, where the affixes are alternatives, not conjuncts, and max is therefore wrong. The worked example is used to license an aggregation it does not demonstrate.

### H-9. FR-19's 81/82 cliff is an unargued user utterance with no `[ASSUMPTION]` tag

FR-19: "tier 1, **except** where tier 1 first becomes available at item level 81 or 82 — such modifiers are too rare to chase."

This is the PRD's one original decision (§0: "One thing this PRD changes rather than inherits"), and it is the only substantive rule in the document carrying **neither** a rationale **nor** an `[ASSUMPTION]` tag **nor** an entry in §10. Three problems:

1. **The boundary is arbitrary.** A modifier whose T1 opens at 80 is accepted; at 81 it is not. Nothing distinguishes them. §10 exists to surface exactly this kind of unexamined number and does not.
2. **The proxy is undefended.** Required level is being used as a proxy for spawn rarity. Rarity is governed by spawn weight, not by required level — a high-weight modifier whose T1 opens at 82 is common on ilvl-82 items. The brief's addendum defends its tier-1–2 restriction honestly ("Tier is being used as a proxy for 'expensive', which it is only roughly — but ... the restriction is doing real budget work"). FR-19 does no such accounting for a proxy that is weaker.
3. **The rationale and the mechanism act on different things.** The stated reason is *modifier* rarity; the mechanical effect is a *search population* restriction (accepting a T1@80 modifier pushes the whole entry's floor to 80, shrinking the listing population and thinning the price sample). The PRD never connects them.

### H-10. FR-18's multi-currency median cannot record "the exchange observation" FR-22 requires

FR-18: "Where a result set spans listing currencies the median is taken over **normalised values**."
FR-22: "**Every normalised price records the exchange observation used — rate, source, timestamp** — and that observation participates in Provenance and freshness propagation."
FR-9: "`core` propagates the **weakest** Provenance and the **oldest** timestamp of every input."

A single Price Observation can rest on up to ten listings in up to ten currencies, and therefore on up to ten exchange observations. FR-22's singular "the exchange observation used" has no referent. An implementer must invent one of: the observation for the median listing's currency; the oldest of all of them; a set. Only the second and third satisfy FR-9's "oldest timestamp of every input," and only the third is honest. The PRD specifies none, in the FR it introduces with "the most under-detectable class of error in the system."

### H-11. Where exchange rates come from is unspecified — endpoint, bucket, and budget all missing

FR-22 and FR-23 both depend on "synced exchange rates." `currencies.json` declares *which* currencies (FR-12). Nothing anywhere says **how** a rate is obtained.

The trade API's currency exchange is a different surface from `trade2/search` + `trade2/fetch`. AD-8's measured rate-limit table covers `trade-search-request-limit` and `trade-fetch-request-limit` only; if the exchange surface carries a third policy, FR-17's "paces against the tightest unsatisfied bucket" is operating on an unmeasured rule, and FR-12's per-set accounting has no bucket to account against. The brief's addendum names poe2scout as carrying "currency exchange rates and volume" but the PRD neither adopts it nor rejects it — and adopting it would be a second external dependency that NFR-9, NFR-2 and AD-13 all have opinions about.

This blocks `sync` on day one for a value that appears in every single price in the system.

### H-12. FR-20 specifies the response to an unresolvable stat id and not the detection of one

FR-20: "A Tracked Entry referencing a `statId` the trade API **no longer exposes** is never silently skipped."

How does `sync` learn this? The candidates each have consequences the PRD does not address:

- Read `trade2/data/stats` and diff against the tracked list — a **third request source**, violating FR-12 exactly as FR-28 does (H-1), and requiring its own budget line and cache.
- Infer from a search error response — requires a specified error shape, a distinction between "unknown stat" and "malformed query" and "transient 5xx," and a fixture (NFR-2) that proves the distinction. None exists.
- Infer from zero results — **explicitly forbidden**: FR-18 says "Zero results is `no-listings`, never a price," and conflating the two is the precise failure AD-6 and FR-8 exist to prevent.

FR-20 is unimplementable as written. Since FR-8 calls `unresolvable` "the symptom of a game patch" and §4.9 calls patch churn a central threat, this is not a corner.

### H-13. FR-15 requires a "date of the last tracked-list edit" with no mechanism and no owner

FR-15 and FR-21 both require the Sync Report to record it. Candidate mechanisms all fail or carry unstated requirements:

- **Filesystem mtime** — meaningless after a clone or a CI checkout, and the spine's deployment story runs sync on the player's machine but builds in Actions.
- **`git log -1 -- data/tracked.json`** — requires `sync` to hold a git *read* port over a specific path's history. AD-21 defines `sync`'s git relationship entirely in terms of *committing files it owns*; a history-read port is a new port in `contracts` that nobody has declared.
- **A hand-authored field in `tracked.json`** — the honest option, and it makes the whole mechanism advisory, since a player who forgets to bump it produces exactly the "stale list running unattended" state FR-15 exists to detect.

The third possibility is the one an implementer will pick, and it silently converts FR-15 from a safeguard into a convention — which AD-23 explicitly refuses elsewhere ("these are schema members, not conventions").

### H-14. Most Success Metrics are unobservable in principle, and SM-1 and SM-4 are mutually exclusive

§8 opens by framing the absence of instrumentation as a considered trade-off: "Behavioural, not numeric — this is a tool with one user, and instrumenting it would be more work than the signal is worth." That framing misdescribes the problem. The metrics are not merely un-instrumented; several cannot be observed by anyone, with or without instrumentation:

- **SM-1 vs SM-4 are in direct contradiction.** SM-1 is "the player stops opening the trade site to price-check while mapping." SM-4 is "Chase decisions made from the list match what actually sells." Verifying SM-4 requires observing realised sales against list predictions — but the brief states flatly that "No sale is ever observed" by the system, so the only source is the player manually price-checking and tracking outcomes, which is the behaviour SM-1 declares a failure. **Achieving SM-1 makes SM-4 unmeasurable.** These are the two primary metrics validating FR-1.
- **SM-2** ("The mental top-five goes away") is an internal cognitive state. There is no observation, by the user or anyone, that distinguishes "stopped keeping the list in his head" from "keeps it and also reads the tool."
- **SM-5** ("The tool is still running in a year") cannot inform any decision inside the project's horizon. It is a retrospective, not a metric.
- **SM-6** ("Agents ship without a human unblocking them") measures the development process, not the product, and is falsified by this review's own existence — a human is in the loop continuously. It also has no threshold: one unblock? ten?
- **SM-C1** ("Held at ~1,500") is a counter-metric with **no enforcement mechanism**. FR-12 says the list is "held to **approximately** 1,500 entries"; no FR makes 1,600 or 5,000 a validation error, so the counter-metric is a wish. The failure it guards against ("at ~10,000 entries it fails by a factor of four" — arithmetically correct, 10,000/2,400 = 4.2) arrives silently as a slowly-lengthening refresh cycle that FR-10's per-row freshness will render as a normal-looking spread of timestamps.
- **SM-C4** ("Apparent confidence") is a design principle stated as a metric; there is no observation of it at all. See C-3 for why the mechanism it names does not work in v1 regardless.

Of six primary/secondary metrics, arguably one (SM-3, "the list is useful within days of a reset") is observable by the single user in a form he could actually report.

### H-15. FR-14's stated rationale is arithmetically false, and it is written as a testable consequence

FR-14: "Overlap is rejected at load with the offending entries named — it is never reconciled at ranking time, **because double-counting would inflate `ΣP` past 1 for that Base Type and hand it the top of the list.**"

`ΣP` for a Base Type ranges over its **tracked entries**, which are a tiny curated subset of a complete eligible pool — FR-26 insists the denominator is "the **complete Eligible Pool**, never the tracked subset." With a handful of tracked combinations out of hundreds or thousands of pool combinations, `ΣP` is on the order of 1e-3 to 1e-2. Double-counting two entries roughly doubles two summands. **It does not approach 1, let alone exceed it**, and it will not "hand it the top of the list" — it will move the base by a few percent.

The harm of overlap is real (an inflated summand), but the mechanism stated is wrong by two to three orders of magnitude. This matters because it is written under "**Consequences (testable)**": a test author reading it literally would try to assert `ΣP > 1` as the detection signal and find it never fires. Overlap must be caught structurally at load, which the first bullet says correctly — the second bullet's rationale actively misleads. (The claim is inherited verbatim from AD-17, which is equally wrong; the PRD's job when restating an inherited number is to check it.)

### H-16. FR-26 drops the `(base, slot)` scoping in the one FR that claims implementers cannot diverge

FR-26 is titled "Probability derivation is specified **precisely enough that two implementers cannot diverge**."

Its first bullet: "its weight is the sum of **every Weights File band with that `statId`** whose `valueMin >= ` the reference's floor."

AD-18 says: "the sum of the weights of **every weights-file entry with that `statId`** whose band lies at or above `valueMin`" — also loosely worded, but in a document whose schema makes the nesting (`bases.<id>.<slot>.entries[]`) unambiguous. The PRD restates the rule standalone, in a Glossary-anchored document, with no scoping qualifier. Read literally, it sums that `statId`'s bands **across every base type and both slots** in the file. That is an enormous error — every probability inflated by the number of bases the modifier appears on — and it is plausible enough that an implementer building from the PRD alone would do it.

An FR whose stated purpose is to eliminate divergence introduces a new one by paraphrase. The fix is one clause: `within that (Base Type, slot)`.

### H-17. FR-13's pinned entries have no budget bound

FR-13: "`pinned` entries are refreshed **every Chunk** and are exempt from rotation."

No FR bounds the number of pinned entries. No FR bounds the number of chunks per day (FR-16 explicitly refuses to: "The syncer assumes nothing about ... how often"). The product of two unbounded quantities is the pinned entries' share of a hard 2,400/day budget.

UJ-5 describes the player pinning entries as a routine curation act, and nothing discourages accumulation — pinning is the affordance the tool offers for "a combination he wants watched closely," and there is no counterpart to pruning for pins, no pin expiry, and no warning surface. A hundred pinned entries at hourly invocation is 2,400 searches/day: **the entire budget, consumed by pins, with the rotating body of the list never advancing.** The Sync Report's per-set accounting (FR-12) tracks tracked-vs-currencies, not pinned-vs-rotating, so this is invisible in the one artifact meant to make budget drift "attributable to a cause."

### H-18. UJ-5 requires price history, which §5 forbids

UJ-5: "sees three combinations that have returned **no listings all league**."

§5 Non-Goals: "**Price history features.** Git carries the history via sync commits; **no v1 feature reads it** (AD-14)." AD-14: "`dataset.json` contains **only the latest observation** per tracked entry."

"Returned no listings all league" is a statement over a time series. From the latest-observation-only Dataset, the view can say "this row is `no-listings` **right now**" and nothing more. A combination that was priced yesterday and empty today is indistinguishable from one empty since league start. The journey the PRD claims FR-7 and FR-15 realise is not supported by any specified artifact.

Compounding it: there is **no cross-base curation view in any FR**. FR-7 expands one Base Type at a time. The addendum ("Curation Surface — Options Considered") adopts "read-only surfacing" and lists "`no-listings` entries and `unresolvable` entries" as things the view shows — but no FR requires them to be reachable as a *set*. Finding the dead entries across ~1,500 rows by expanding 250 base types one at a time is not a workflow; it is the scanning burden SM-C3 says the product exists to remove. UJ-5 is listed as realized by §4.3 and §4.5, and it is not realized by either.

---

## Medium

### M-1. FR-21 requires reporting "entries skipped and why"; FR-20 says entries are never skipped

FR-21: "The report records ... unresolvable entries, **entries skipped and why**."
FR-20: "It is **never skipped**, never defaulted, and never left at its previous value."

If unresolvable entries are reported separately (they are, in the same sentence), what populates "skipped"? Chunk exhaustion? A transient 429? A malformed entry? The category is required in a schema-pinned artifact and is undefined, so `contracts` cannot type it and no test can assert on it.

### M-2. FR-2 never bounds the chase Combination list

FR-2 requires the collapsed row to name "the Combinations most worth chasing" with no count, no cutoff, and no tie rule. SM-C3 ("Number of ranked Base Types shown ... A longer list is not a better one") guards the outer list and not this one. A base with forty tracked combinations above threshold renders forty chase badges on a collapsed row, restoring the scanning burden inside the row.

### M-3. The PRD violates its own Glossary discipline

§3: "Downstream readers and workflows use these terms exactly. **Introducing a synonym anywhere is a discipline violation.**"

- FR-1 and FR-13 both say "A **Combination** with Curation Status `pruned`." Curation Status is a property of a **Tracked Entry** (§3); a Combination is "the outcome a crafted Tracked Entry describes." Statuses do not attach to outcomes.
- FR-7's title is "Expand a Base Type to its full tracked **Combination** list" while its consequence says "Every non-`pruned` **Tracked Entry**." These are different sets — Raw Bases are Tracked Entries and not Combinations.
- "Rotation" (FR-13) is an undefined domain noun. See C-4.
- **Price State's owner is undefined.** §3 defines the value set but not what carries it. FR-20's "`sync` writes that **entry's** Price State" reads as a write to `tracked.json`, which NFR-5 and AD-21 forbid absolutely ("hand-owned inputs belong to the player"). The intended reading is surely "the Dataset row for that entry," but as written it instructs an agent to violate the one-writer rule.

### M-4. The refresh cadence is asserted as an outcome and refused as a requirement

§4.6 states "A full refresh of the tracked list takes roughly fifteen hours and consumes about 62% of the daily search budget" (arithmetic checks: 1,500/2,400 = 62.5%; 1,500 at ~100/hr = 15h). The brief promises "Refreshed daily."

FR-16 then says "The syncer assumes nothing about what invokes it, **how often**, or where it runs." No FR requires the scheduler to be configured, documented, or verified; no NFR covers it; §9 does not list it. The product's headline freshness property therefore depends on an input the PRD explicitly declines to specify, and its only safeguard (FR-10 per-row freshness) reports the failure rather than preventing it. "Host-agnostic" and "cadence-unspecified" are not the same claim, and the PRD conflates them.

### M-5. The 100ms budget covers the wrong operation, and memoisation does not address the stated trigger

§4.1 NFR and NFR-6: "Ranking the full tracked list completes in **under 100 ms** ... If it cannot, the fix is memoising the pure function — never precomputing in sync."

Two problems. First, ranking 1,500 entries is trivial; the actual cost is **loading and Zod-validating six artifacts** (AD-24), of which `weights.json` must enumerate *every* modifier including worthless ones, for ~250 base types × 2 slots — plausibly tens of thousands of entries and multiple megabytes. Nothing budgets that, and it is what the player waits on.

Second, the stated remedy does not fit the stated trigger. The performance trigger is "re-runs synchronously on a **threshold change**" — and a threshold change alters the truncation set, so every term's *inclusion* changes. Memoising "the pure function" keyed on its inputs gives a miss on every threshold change by construction. What is memoised (the per-combination `P × price` products, which are threshold-invariant) is a real answer, and is not the one written down.

### M-6. Every chunk triggers a full CI build and deploy, which "zero upkeep" does not account for

NFR-7: "Static delivery, zero upkeep ... no server to patch, no secret material, and no credential to rot."

The spine's deployment section: each sync run "commits the files it owns ... That push triggers a **GitHub Actions workflow** that builds the Vite bundle and deploys to Pages." At hourly invocation that is ~24 full builds and Pages deploys per day, indefinitely, on a repo whose committed data grows monotonically (AD-14 makes git the price history).

This also nullifies AD-24's stated benefit — "They are never bundled into the JS, **so a sync commit updates data without rebuilding the app**" — since the commit rebuilds the app anyway. And no FR or NFR requires a deploy failure, a concurrency-cancelled deploy, or an Actions minutes exhaustion to be surfaced anywhere. The one artifact the view reads for operational truth is the Sync Report, which is written by `sync` and knows nothing about what happened after the push. A silently-failing deploy presents as a site whose per-row freshness ages uniformly — indistinguishable from a syncer that stopped, which is indistinguishable from a scheduler that was disabled.

### M-7. The cold-start threshold default is the early-endgame figure for a product that targets late endgame

FR-6: "`[ASSUMPTION: 0.25 Divine, the brief's early-endgame figure, as the least-surprising cold start.]`"

§4.2, §6 and the brief's addendum all state the product targets **late** endgame ("The user chose to target late endgame, on the judgment that its value transfers downward"), where §4.2 gives the threshold as "a Divine or more." The default is set to the figure for the playstyle the product does not target, and the assumption's justification ("least-surprising") is asserted against the wrong user. Minor in isolation; it is also the only place the PRD's targeting slips, which makes it cheap to fix.

### M-8. The variance dismissal is imported without checking it against v1's own probability magnitudes

§5 Non-Goals: "Ranking on variance, median outcome, or an exposed risk preference. At ~144 crafting decisions an hour, attempt volume makes mean-based math sound."

The brief's addendum derives this from "a 1-in-500 jackpot lands every few hours of mapping" — true at P = 2e-3. But the PRD's own probability model produces far smaller numbers: a specific prefix **and** a specific suffix, each a floor over a complete pool, lands at `P ≈ 6e-4 × 6e-4`-ish for a narrow reference, or ~1e-3–1e-4 for a broad one. At 1e-4 and 144 attempts/hour that is one realisation per ~70 hours of mapping — roughly once per league for a given combination. In that regime the mean is dominated by events the player experiences a handful of times, which is exactly where mean-based ranking is least defensible.

The addendum's reasoning is sound for the numbers it used. The PRD inherits the conclusion without re-deriving it against the numbers *it* specifies, and states it as settled in a Non-Goal.

### M-9. One-affix Tracked Entries are permitted, presupposed, and never specified

§3 defines a Tracked Entry with "an **optional** prefix Modifier Reference, an **optional** suffix Modifier Reference," and FR-14 explicitly contemplates "a **partial-affix** entry subsuming a full one." So entries with exactly one affix exist.

Nothing specifies their behaviour. FR-1 handles "a **crafted** Base Type"; FR-3 handles "both affixes absent." A one-affix entry:

- Takes `P(prefix) × 1` per FR-26 — i.e. "this prefix with **any** suffix."
- Is priced (FR-18) by a search filtering on the prefix alone, sorted ascending, median of the cheapest 10 — so its price is dominated by items with **junk** suffixes.

So `P` describes a population including the jackpots and `price` describes the bottom of it: the same numerator/denominator mismatch as C-2, arriving by a second route. Whether such entries bear Craft Cost, whether they are "Combinations" for FR-2's chase list, and whether they are what the player should be tracking at all are all unanswered.

### M-10. A league change leaves `sync-progress.json` in an unspecified state

FR-16 commits progress; FR-28 validates the configured league at the start of each run; UJ-6 describes the league edit as "a config edit plus a natural re-sync." Nothing says what happens to in-flight progress recorded under the previous league. The two behaviours an implementer might pick — resume mid-list, or discard and restart — differ by up to fifteen hours of refresh at the single moment (§4.9: "the tool is least useful at league start") the PRD identifies as the central threat. §10's UJ-6 assumption ("no Dataset rewrite and no manual purge ... has not been exercised against a real reset") notices the Dataset and misses the progress file.

### M-11. FR-12's "approximately 1,500" is not a testable consequence

FR-12, under "Consequences (testable)": "The tracked list is held to **approximately** 1,500 entries against a measured ceiling of ~2,400 searches per day." No assertion can be written against "approximately." Given that SM-C1 names list growth as the product's primary self-inflicted failure mode, the absence of a hard validation ceiling in `tracked.json`'s schema — where every other invariant in this product lives (FR-13: "schema members, not conventions") — is a deliberate-looking gap.

### M-12. FR-17 discards a recorded API gotcha in the act of restating AD-8

FR-17: "It reads `X-Rate-Limit-Rules` to learn the active rule names, then parses the policy and `-State` headers for each named rule."

AD-8 says the same and adds a correction someone paid to learn: "unauthenticated the rule is `Ip`, giving `X-Rate-Limit-Ip` and `X-Rate-Limit-Ip-State`. **There is no `X-Rate-Limit-Client` header.**" The PRD drops both the concrete example and the negative finding. §0 justifies citation-over-restatement on the grounds that "the rationale ... is not re-argued" — but a factual correction is not rationale, and an agent building `sync` from the PRD will reach for `X-Rate-Limit-Client` because it is the name every PoE1 tutorial uses. Restating an AD lossily is worse than citing it bare.

---

## Low

### L-1. FR-3 attributes "item level exactly 82" to AD-16, which says "endgame item level"

AD-16's text: "one search — that base, **endgame item level**, `magic` rarity for an entry carrying affixes and `normal` for a raw base." The rarity split is AD-16's; "exactly 82" is the brief's and AD-5's parenthetical. Minor over-attribution, but it matters here because the spine's Open Question explicitly declines to settle the item level, and citing AD-16 for it implies a settlement that does not exist.

### L-2. FR-11 cites AD-23 for a rule that belongs to AD-16

FR-11's asking-price requirement is cited "(AD-23)" — *Curation is a deliberate, reviewed act*. AD-23 does contain the sentence, tacked onto its final line as a non-sequitur. The citation is technically findable and substantively misplaced; a reader following it lands in a decision about pruning and pinning. The rule belongs to AD-16 (the price estimator) or to AD-10 (provenance).

### L-3. Several "Consequences (testable)" are untestable negatives or editorial

Beyond the ones argued above (FR-1's "not zero, not a default"; FR-14's `ΣP`; FR-26's divergence claim), the following cannot be written as assertions:

- FR-4: "`core` **never** substitutes an invented pool" — an unbounded negative over all code paths.
- FR-8: "`no-listings` is presented as an open question, not an answer: the view must not **imply** the Combination is junk" — "imply" has no operational definition.
- FR-9: "renders **visibly differently**" — no criterion; and see C-3 for why it has no v1 contrast case.
- FR-11: "any phrasing **implying** an observed sale" — the enumerated list ("sells for", "worth") is greppable; the open clause is not.
- FR-15: "a list running unattended for months is **visible as such** without the player going looking."
- FR-16: "The syncer **assumes nothing** about what invokes it, how often, or where it runs."
- FR-17: "**No rate is hardcoded.**" — inspectable, not testable; no behavioural assertion distinguishes a hardcoded-but-correct rate from a header-derived one on a single fixture.
- FR-5: "this is the behaviour, not a bug" and FR-23: "This is a stated limitation, not an empty slot for an implementer to fill by invention" — instructions to the reader, filed as consequences.

These are not fatal individually, but §0 sells the Consequences blocks as the PRD's contribution to testability, and roughly a fifth of them are prose.

### L-4. FR-1's "contributes nothing — not zero, not a default" is vacuous as an arithmetic claim

Omitting a term from a sum and adding zero to it produce the same number. The distinction the PRD wants is about **reporting and rendering** — a non-`priced` combination must be separately visible (FR-8) rather than silently absorbed. Stated as a consequence of the EV formula, it is untestable; stated as a consequence about the Dataset and the view, it is both testable and already covered by FR-8. Inherited from AD-9, which has the same issue, but the PRD promotes it to a testable bullet under the ranking formula where it does no work.

### L-5. §2.2's "no per-user persistence" contradicts FR-6

§2.2 Non-Users: "**Anyone needing their own settings.** There is no account, **no per-user persistence**, and no sharing (AD-15)." §5 repeats it: "Accounts, sharing, **per-user preferences**, anything multi-user."

FR-6 is titled "Remember the threshold between visits" and requires persistence of per-user preferences in browser storage. The intended reading is obviously "no *server-side* per-user persistence" (AD-15 is explicit: "no write path to anything but the viewer's own browser storage"), but the PRD states the Non-Goal flatly twice and never reconciles it. In a document whose §5 is titled "Non-Goals (**Explicit**)," a Non-Goal that a shipped FR contradicts is a defect in the Non-Goal.

---

## What I would fix first

In order, and only these until they are done:

1. **Reconcile FR-18, FR-19 and FR-26 as one arithmetic** (C-1, C-2, M-9). Either the Weights File gains an item level dimension and the price filter gains a value *ceiling* so numerator and denominator sample the same population, or the PRD states the bias explicitly, names its direction and magnitude, and adds it to §9. Both are acceptable; silence is not. This is the product.
2. **Specify the crafted-vs-raw ordering and the threshold's applicability to Raw Bases** (C-5). A number is needed, not a rendering rule.
3. **Define rotation** (C-4) and, with it, the invocation cadence contract (M-4), the pinned-entry bound (H-17) and the currency-rate reuse window (H-2). These are one decision wearing four hats.
4. **Close the three missing mechanisms** — exchange rate acquisition (H-11), unresolvable detection (H-12), tracked-list edit date (H-13). Each is a day-one `sync` blocker.
5. **Re-state Provenance honestly for v1** (C-3): a single product-level statement that nothing rests on measured weights, with the per-figure badge specified as the mechanism that activates when mixed provenance arrives.
6. **Rewrite §8** (H-14). Keep SM-3. Replace the rest with things one person can actually notice, and drop the framing that treats unobservability as a deliberate economy.
