# Verbatim extract — ARCHITECTURE-SPINE.md @ revision 4

Source: `docs/architecture/architecture-poe-crafting-base-price-checker-2026-09-12/ARCHITECTURE-SPINE.md`
Extracted: 2026-09-13. All AD text below is copied verbatim from the spine; nothing is paraphrased.

## Front matter (verbatim fields)

```yaml
name: 'PoE2 Crafting Base Price Checker'
type: architecture-spine
purpose: build-substrate
altitude: feature
paradigm: 'functional core / imperative shell with ports-and-adapters at the edges'
scope: 'Whole system: trade-API sync, price estimation, valuation and ranking, published dataset, web view, and the weights-file contract.'
status: final
revision: 4
created: '2026-09-12'
updated: '2026-09-13'
binds: []
sources:
  - docs/briefs/brief-poe-crafting-base-price-checker-2026-09-12/brief.md
  - docs/briefs/brief-poe-crafting-base-price-checker-2026-09-12/addendum.md
  - docs/prds/prd-poe-crafting-base-price-checker-2026-09-12/prd.md
  - docs/prds/prd-poe-crafting-base-price-checker-2026-09-12/addendum.md
companions:
  - WEIGHTS-FILE-SCHEMA.md
  - AGENT-WORKFLOW.md
```

- **Revision:** 4
- **Status:** final
- **Created:** 2026-09-12 — **Updated:** 2026-09-13

## What the spine says revisions 4 and 3 amended (verbatim revision notes)

> **Revision 4.** Absorbs a defect the weights-file **producer** raised against the contract: a modifier rolling two numbers cannot produce non-overlapping value bands, and 53 of 63 item classes carry one. The contract had conflated the value axis with the tier axis — true for single-number modifiers, false in general — and non-overlap turned out to be a proxy for AD-18's straddle rule rather than an invariant of its own. **AD-28** is new and decomposes such families over the value axis, with mass conservation as the invariant and the split estimator left to the producer. **AD-5** makes `ModifierRef` a discriminated union so a modifier that rolls no number has a home other than a sentinel band; **AD-10** gains a fourth provenance, `modelled-split`, for weight that is measured but distributed by a model. AD-11, AD-16 and AD-18 are amended to match. Weights contract raised to **3.0.0** (breaking). AD ids are stable; AD-5, AD-10, AD-11, AD-16 and AD-18 are amended in place and AD-28 is added.
>
> **Revision 3.** Absorbs the four items PRD revision 2 raised back against this spine — places where two decisions did not compose. **AD-26** re-denominates the `pinned` cap against a chunk rather than against AD-12's full-refresh ceiling (the two never composed into a writable inequality) and adds the runtime half no load-time validator can supply, and it corrects the `unresolvable` retry bound's rationale, which rested on a cost AD-6's offline detection had already removed (PRD OQ-8, OQ-9). **AD-27** narrows its coverage denominator to bases that actually need a pool, since a raw-base-only base can never be `complete` and was depressing a fraction that binds a layout decision (PRD OQ-10). **AD-11** and **AD-18** drop the residual `valueMax?` spellings that contradicted AD-5 (PRD OQ-11). AD ids are stable; AD-11, AD-18, AD-19, AD-26 and AD-27 are amended in place and no AD is added.
>
> **Revision 2.** Absorbs the three blocking questions PRD §10 raised against the inherited valuation model — BQ-1 (a floor-spanning probability priced at its lowest tier), BQ-2 (an eligible pool with no item-level dimension), BQ-3 (unmeasured pool coverage) — together with the `itemLevelMin` amendment PRD §9 OQ-1 routed here under AD-22. It also removes RePoE as a data dependency: the trade API's own catalogue endpoints (AD-25) supply identity and validation, and the weights file supplies everything else. AD ids are stable; AD-5, AD-6, AD-8, AD-11, AD-12, AD-16, AD-17, AD-18, AD-21 and AD-24 are amended in place, and AD-25 to AD-27 are new.

**Summary of amendment claims:**

| Revision | Amended in place | Added |
| --- | --- | --- |
| 4 | AD-5, AD-10, AD-11, AD-16, AD-18 | AD-28 |
| 3 | AD-11, AD-18, AD-19, AD-26, AD-27 | none |
| 2 (context) | AD-5, AD-6, AD-8, AD-11, AD-12, AD-16, AD-17, AD-18, AD-21, AD-24 | AD-25, AD-26, AD-27 |

Note: AD-9, AD-12, AD-17, AD-21, AD-24 and AD-25 are not named as amended by revision 3 or 4; their current text is reproduced below as requested.

---

## AD-5 — Canonical modifier identity is the trade stat id plus a bounded value band

- **Binds:** all
- **Prevents:** the tracked list, the weights file and the trade query each carrying a different notion of "a modifier", which silently mismatches instead of failing — and, since revision 2, a probability covering two tiers being multiplied by one tier's price (AD-17, AD-18).
- **Rule:** A modifier reference is one of exactly two kinds, discriminated in the schema:

  | Kind | Shape | For |
  | --- | --- | --- |
  | `banded` | `(statId, valueMin, valueMax)` — an **inclusive, closed band** over the value the trade filter compares (AD-28) | every modifier that rolls a number |
  | `valueless` | `(statId)`, no edges at all | a modifier that rolls no number — *"Loads an additional bolt"* |

  The trade API has no tier concept; a "tier" exists only as a band. **A valueless reference is not a degenerate band.** A sentinel pair such as `1/1` would pass every containment, straddle and edge-alignment check while making AD-16 emit a min/max filter for a stat that has no value — the same class of defect as the sentinel ceiling this AD's `valueMax` rule exists to close. It still carries `weight` and `itemLevelMin` and still counts toward pool completeness; AD-16 emits its filter with no edges.

  **A band is a value interval, not a tier.** For a modifier rolling more than one number the two are different axes, and one interval draws weight from several tiers — AD-28 governs the decomposition, and this AD's identity is unchanged by it.

  **`valueMax` is required, everywhere, with no open-top form.** An omitted ceiling is a floor by another name, and a floor is exactly what BQ-1 removed: it spans tiers again, so AD-18 sums two tiers' weight while AD-16's ascending sort prices the cheaper one. Worse, the defect would be *unvalidatable* — `sync` checks `tracked.json` but the band edges it would need to check against live in `weights.json`. Every game modifier has a maximum roll, so a closed band is always expressible; a curator wanting "T1 and everything above" writes the real ceiling, not a blank. A tracked entry is `(baseTypeId, itemLevelMin, prefix?, suffix?)` where each affix is a modifier reference or **absent** — an entry with both absent is a raw base (this is how white ilvl-82 bases are represented). `baseTypeId` is the trade API's base type `type` string exactly as `data/items` spells it. No component may introduce a second modifier identity.

  **Why a band, not a floor.** Under a floor, a reference at the T2 edge covers T1 and T2 together, so AD-18 summed both tiers' weight while AD-16 — sorting ascending — priced essentially T2. The jackpot was not understated but *deleted*: if the T2 price fell below the payout threshold, the whole entry truncated to zero and took its T1 probability mass with it, destroying the jackpot isolation that threshold-truncated EV exists to provide. Bands make **outcomes** disjoint, so each carries its own price and AD-17's partition holds with both tracked. Disjoint outcomes, not disjoint tiers: where a modifier rolls more than one number the two are different things, and AD-28 supplies the decomposition that keeps the outcomes disjoint anyway.

  **`itemLevelMin` is declared, never inferred.** It is authored by hand as part of curation; neither `sync` nor `core` derives or adjusts it. Choosing the accepted tier and choosing the band are one authoring act, and the item level that choice implies is recorded next to it.

## AD-6 — An unresolvable stat id is a loud failure with a dataset representation

- **Binds:** `sync`, `contracts`, `web`
- **Prevents:** a tracked combination silently disappearing from the rankings after a game patch, with no symptom the player would ever notice — and, equally, a patched-out modifier continuing to rank on its last-good price forever.
- **Rule:** If a tracked entry references a stat id or base type the trade API no longer exposes, `sync` writes that entry's price state as `unresolvable` (AD-9) **and** records it in `sync-report.json`. It is never skipped, never defaulted, never left at its previous value. `core` excludes `unresolvable` entries from valuation; `web` must surface their existence rather than only omitting them.

  **Detection is by catalogue validation, not by inference.** Two checks, with distinct owners, because the two files are read in different places:

  | Check | Owner | Surfaced as |
  | --- | --- | --- |
  | every `statId` / `baseTypeId` in `data/tracked.json` exists in the catalogue | `sync`, before issuing any request | the entry's `unresolvable` state + `sync-report.json` |
  | every `statId` / `baseTypeId` in `data/weights.json` exists in the catalogue | `sync`, reading the file (it is a **reader**, not its writer — AD-21 governs writers) | `sync-report.json` only; the file is never rewritten |

  `sync` owns both because it is the only component holding the full catalogue: AD-24 deliberately keeps `catalogue/items.json` out of `web`'s fetch set, so `core` cannot perform a base-type cross-check at load and must not pretend to. `core` still validates the weights file's **shape and pool rules** at load (AD-1: loading is an adapter's job, validating is pure). Splitting it this way is what stops a mistyped base key from silently vanishing from the product with nothing anywhere reporting it.

  An empty result set means `no-listings` (AD-9) and never `unresolvable`: conflating the two would report a patch-out every time a combination simply had no sellers.

## AD-9 — Price is four-state; absence is never zero or null

- **Binds:** `contracts`, `core`, `web`
- **Prevents:** "no listings" being conflated with "worthless" — which would drop exactly the plausible jackpots the addendum identifies as unresolved — and an unresolvable entry having nowhere to live.
- **Rule:** Every tracked entry's price is exactly one of `priced` (with a value and an `observedAt`), `no-listings`, `not-yet-synced`, or `unresolvable`. `core` excludes every non-`priced` state from the expected-value sum rather than contributing zero, and reports each separately so the view can show them outside the ranking. No component may represent absence as `0`, `null`, or a missing key.

  **Every entry also carries `lastAttemptedAt`, in all four states.** `observedAt` exists only where there is an observation; `lastAttemptedAt` records when `sync` last **issued a request** for the entry, regardless of the outcome. Offline work — AD-6's catalogue validation above all — never stamps it, because a check that ran over every entry on every run would flatten the timestamp across the whole list and destroy AD-26's ordering key. The two are distinct and neither substitutes for the other: without `lastAttemptedAt`, AD-26's rotation would re-select every `no-listings` entry forever — they never acquire an observation time — and AD-6's bounded retry would have no state to count against. `web` reports age from `observedAt` where one exists and from `lastAttemptedAt` otherwise, labelled as what it is.

## AD-10 — Provenance and freshness ride on every derived value and propagate upward

- **Binds:** `contracts`, `core`, `web`
- **Prevents:** a uniform-prior placeholder being quietly trusted months later with nothing on screen to reveal it — and a partially refreshed dataset reading as a current one.
- **Rule:** Every probability carries its source and every price carries its observation timestamp and league. Provenance is a **four-value total order**, weakest first:

  | Provenance | Means | Arises from |
  | --- | --- | --- |
  | `absent` | not an estimate at all — an upper bound | a `partial` pool (AD-18), and nowhere else |
  | `uniform-prior` | the weight was invented | the bootstrap file, or a field filled by hand |
  | `modelled-split` | the weight was **measured**, but a **model** distributed it across value cells | AD-28's decomposition, and nowhere else |
  | `measured` | measured by someone (never ground truth — AD-11) | a producer's real spawn weights |

  `core` propagates the **weakest provenance and the oldest timestamp** of every input into each derived figure, so a base's ranking states what it rests on. `web` must render a figure resting on anything below `measured` visibly differently from one resting on `measured`, and `modelled-split` distinctly from `uniform-prior` — collapsing the two would either overstate an invented weight or understate a measured one. It must also surface per-row age — not merely a single dataset-level timestamp, because AD-7 guarantees rows refresh at different times.

  **A modelled split does not weaken a denominator, and `modelled-split` therefore propagates from the numerator only.** AD-28 conserves mass exactly, so a scoped pool's total is identical whether or not a family within it was decomposed — the denominator rests on the same measured weights either way. Taking the weakest provenance across the *whole pool* would stamp `modelled-split` on nearly every weapon base, since 53 of 63 item classes carry a decomposed family somewhere in the pool, and a label that universal distinguishes nothing. `core` therefore draws this one provenance from a reference's **containment set** (AD-18) and not from the denominator. Every other provenance still propagates from every input: a `partial` pool weakens the denominator in fact, not merely in label, and `absent` still rides over everything.

## AD-11 — Weights are a consumed file; normalisation and recipe effects live in core

- **Binds:** `core`, `contracts`, weights producers
- **Prevents:** every weight producer having to understand crafting recipes, two consumers normalising raw weights into probabilities differently, and the app growing a scraper of its own.
- **Rule:** The app consumes a weights file conforming to `WEIGHTS-FILE-SCHEMA.md` and never produces one. The file carries **raw game spawn weights, banded by rolled value and by item level**, per base type and affix slot — `(statId, valueMin, valueMax, itemLevelMin, weight)` for a banded entry and `(statId, itemLevelMin, weight)` for a valueless one, every field of the chosen kind required and none nullable (AD-5). Bands are **value cells**, and for a multi-number modifier a cell's weight is a conserving split of several tiers' weight across the cells they reach (AD-28); the producer owns the split, `core` never performs one. Conversion to probabilities is AD-18 and happens only in `core`. Craft-recipe effects on the tier distribution are modelled in `core` and are never baked into the weights file. The producer of the file is irrelevant to the app.

  **`gamePatch` is asserted by the operator, not derived.** The file names the GGG patch its weights describe, and nothing can compute that field: the producer's sources do not state it and the trade API exposes no patch version either (AD-25). A producer takes it as a required run-time input and refuses to run without it rather than emitting a default, because a defaulted value propagates silently past the one person who could have caught it. `core` does not parse it and must not branch on it; `web` surfaces it beside `producer.id` and `producer.generatedAt` (AD-24) so a file left behind by a patch is visible as such.

  **The file is a prerequisite, not a convenience.** The trade API exposes no pool membership, no tier, no item-level availability and no spawn weight (AD-25), so nothing in this system can derive what the file carries. Until a conforming file exists, every base is unrankable by AD-18 — which is the honest outcome, not a degradation to engineer around.

  **v1 depends on the external scraper project for this file**, decided rather than assumed: it supplies pool membership, band edges, `itemLevelMin` and weights. A uniform-prior file remains a valid *weighting* shortcut (every `weight: 1`) but never a *sourcing* one, because the two fields it cannot fake are the two the trade API cannot supply. **RePoE is a last-resort fallback only**, since it carries modifier metadata but not spawn weights and was never the authority for the field that matters.

## AD-12 — The workload is declared, and the search budget is the ceiling

- **Binds:** `sync`, `contracts`, curation workflow
- **Prevents:** an unbounded, unreviewable request budget; curation becoming a mutable-store feature that forces a server into a static architecture; and an unenumerated second workload silently consuming the same bucket.
- **Rule:** Exactly **four** sources generate a request, and nothing else does. Two are the recurring workload, both schema-pinned committed files; two are fixed overheads:

  | Source | Cadence | Cost |
  | --- | --- | --- |
  | `data/tracked.json` — combinations to price | every chunk | one search + one fetch per entry |
  | `data/currencies.json` — currencies to price for AD-20 | every chunk, **first** (AD-26) | small, fixed |
  | League validation against the live leagues endpoint (AD-19) | once per run | one request |
  | Catalogue refresh (AD-25) | explicit command, patch cadence, never on the chunk path | four requests |

  Neither workload file is written at runtime; curation is an edit and a commit. `sync-report.json` must report requests consumed **per source** against the live bucket, so budget drift is observable per cause. A fifth source is an amendment to this AD, not an implementation detail.

  **The ceiling is denominated in searches, not entries.** Against the measured 2,400 searches/day, a full refresh is held to **~1,500 searches**, leaving headroom for retries, the currency set, the catalogue refresh, the per-run leagues check (AD-19) and a second recipe. **`pinned` entries (AD-26) spend from that headroom too, and they spend differently from everything else here**: a `pinned` entry costs a search in *every* chunk rather than once per refresh, so its daily cost scales with invocation cadence rather than with the size of the tracked list. A pinned set sized at AD-26's cap can consume a substantial share of the measured 2,400/day on its own — which is the real reason that cap exists, and the reason `pinned` is a scarce designation rather than a convenience. One tracked entry always costs one search; what changes under AD-5's bands is **how many entries a curator needs**. Isolating a jackpot band means tracking two entries where one stood, and that second band spends from the same ceiling. For a modifier rolling more than one number the curator splits at **cell** edges rather than tier edges (AD-28), and the finer partition means the isolation a curator reaches for may cost more entries than the tier count suggests. Stating the budget in searches is what keeps that trade-off visible at the moment a curator makes it, instead of surfacing months later as a refresh cycle that quietly stopped completing. This supersedes the addendum's ~2,000 figure, which rested on a throughput assumption ~7× too optimistic.

## AD-16 — The price estimate is the cheapest live instant-buyout listings

- **Binds:** `sync`, `core`, `contracts`
- **Prevents:** the single most load-bearing definition in the product being left to whichever agent writes the syncer — the brief calls this section "the product; everything else is presentation."
- **Rule:** For each tracked entry, `sync` issues one search and one fetch of the **cheapest 10 result ids**. The search is built from the entry alone, using these filter ids, verified present in `data/filters` on 2026-09-12:

  | Query field | Value |
  | --- | --- |
  | `query.type` (top level, **not** a filter) | the entry's `baseTypeId`, verbatim |
  | `type_filters.rarity` | `magic` for an entry carrying affixes, `normal` for a raw base (AD-5) |
  | `type_filters.ilvl` | `min` = the entry's `itemLevelMin` (AD-5) |
  | stat filters | one per modifier reference: a `banded` reference carries **both `min` and `max`** from the band; a `valueless` reference carries the stat id and **no edges at all** (AD-5) |
  | `trade_filters.sale_type` | the option labelled **"Buyout or Fixed Price"**, whose `id` is JSON `null` |
  | sort | price **ascending** |

  Four traps, the first three verified against the live payloads on 2026-09-12, each costly to discover in code:

  - **The base type is `query.type`, not `type_filters.category`.** `category` takes taxonomy ids (`weapon.bow`, `accessory.amulet`), not base type names, and no committed artifact maps a base type to its leaf category — `data/items` groups only ten coarse labels. `sync` must not attempt that mapping; the base type alone is sufficient and exact.
  - **`priced_with_info` is not instant buyout.** Its live label is *"Price with Note"*. The option this product needs is *"Buyout or Fixed Price"*, and its `id` is `null` — a value a serialiser will silently drop unless the field is emitted explicitly. Getting this wrong does not error; it silently widens the result set to unpriced listings and corrupts every estimate.
  - **Passing the band's `max` as well as its `min`** is what makes the priced population the same population AD-18 computes a probability for. A min-only filter returns every higher tier too and prices the band at its floor — the BQ-1 defect, reintroduced at the adapter.
  - **A multi-`#` stat filters on one derived value, and which one is a measurement, not a choice.** *"Adds # to # Lightning Damage"* rolls two numbers and the filter compares one. Band edges are expressed in **that quantity and no other**, because this adapter passes them into the filter and AD-18 counts the population it returns; a producer picking a different one produces a file that validates and prices the wrong population. Identifying it is an Open Question with a named owner, not an assumption to code around.

  The `PriceObservation` is the **median of those listings' prices after normalisation to divine** (AD-20), recorded with the sample size actually returned. The API's ascending sort is per listing currency, so when a result set spans currencies the median is taken over normalised values and the sample may not be the globally cheapest ten; that is accepted and recorded, not corrected by extra requests. Fewer than 10 results is valid and records the true count; zero results is `no-listings` (AD-9), never a price. Ascending sort is what keeps stale overpriced listings out of the estimate; instant-buyout-only is what removes listings priced below market, which would already have been bought.

  **The estimator prices the cheap end of whatever band it is given, so the band must be homogeneous.** That is harmless for a band whose population is one tier and dangerous for one spanning a tier boundary, where the cheapest listings are the neighbouring tier's tail while AD-18 carries the whole span's probability. AD-28 names the curation rule that keeps the two aligned — track interior cells — and the reason it is a rule rather than a preference.

## AD-17 — The ranking formula, its threshold, and its unit

- **Binds:** `core`, `web`, `contracts`
- **Prevents:** three mutually satisfying readings of "threshold-truncated expected value" producing three different orderings from identical data — and a view whose dial is denominated differently from the value it filters.
- **Rule:** For a `(baseTypeId, recipe)` pair where the base is **crafted** (its tracked entries carry affixes):

  ```
  EV = ( Σ  P(combo) × price(combo) )  −  craftCost(recipe)
        combo ∈ tracked(base), state = priced, price(combo) ≥ threshold
  ```

  The threshold compares against a combination's **gross price**, not its net of craft cost. Craft cost is subtracted **once** from the summed expected payout, not per combination — it is paid on every attempt including failures, which is already what dividing through by attempts expresses. **Threshold, all prices, and craft cost are denominated in divine** (AD-20); no other unit may cross a package boundary. `web` supplies the threshold as a value and renders the result; it computes no term.

  **Summands must be mutually exclusive.** The sum is over a partition, not a list. Two tracked entries for one base whose outcome sets overlap would double-count, inflating `ΣP` past 1 for that base alone and handing it the top of the ranking. Overlap is a **validation error on `data/tracked.json`**, rejected at load, not a case `core` reconciles.

  Overlap is defined by a predicate, not an enumeration — an enumerated list of shapes has twice been found to miss a case:

  ```
  overlap(a, b)  ⇔  slotOverlap(a.prefix, b.prefix) ∧ slotOverlap(a.suffix, b.suffix)

  slotOverlap(x, y) =  true              if x is absent or y is absent
                       false             if x.statId != y.statId
                       true              if both are valueless
                       bands intersect   otherwise
  ```

  One kind pairing is unreachable rather than handled: a `statId` either rolls a value or does not, so one banded and one valueless reference can never share a `statId`. `contracts` rejects that pairing at load rather than letting `core` pick a reading.

  An absent affix means *any roll in that slot*, so it overlaps everything — which is why the conjunction is over **both** slots. Three consequences worth naming, the third of which the earlier enumeration missed:

  - Adjacent tiers of one `statId` in one slot are disjoint and may both be tracked. That is the point of AD-5's bands. Bands that *intersect* still overlap and are still rejected.
  - A partial-affix entry subsumes a fuller one: leaving a slot absent covers every roll in it.
  - **A prefix-only entry and a suffix-only entry on one base overlap each other.** Neither subsumes the other, and no two bands intersect — yet an item carrying both named modifiers satisfies both entries, so it is counted twice. The predicate catches this; a list of shapes did not.

  Separately, **the crafted entries on one `baseTypeId` must share an `itemLevelMin`.** Two entries with identical affixes at floors 75 and 82 are *nested, not disjoint*, since every ilvl-82 item also matches the ilvl-75 search.

  Rule 3 has a second, independent reason to hold: `EV` is an expectation over **one crafting act on one item population**. Entries at different floors describe crafts on differently-levelled bases, and their `P` terms are normalised against differently-scoped pools (AD-18). Summing them is not an expectation over anything. A base therefore has exactly one crafted item level floor, and the tracked list is validated for it.

  **Rule 3 binds summands only, so a raw base is exempt.** A raw entry is never a summand — it ranks on the separate branch below — so its floor cannot break a partition it does not enter. A white base pinned at exactly ilvl 82 may therefore coexist with crafted entries on the same `baseTypeId` at a lower floor. Without this exemption the rule would reject the very configuration the brief asks for, since white bases are tracked at 82 and magic ones well below it.

  **Raw bases rank on a separate branch.** A `TrackedEntry` with both affixes absent (AD-5) is never a summand — at `P = 1` it would enter at certainty and swamp every crafted outcome. Its `EV` is its observed price, with zero craft cost, ranked in the same list and labelled as an uncrafted base.

## AD-18 — Weight aggregation and normalisation

- **Binds:** `core`
- **Prevents:** two builders deriving different probabilities from the same weights file — a divergence that silently reorders the entire ranked list rather than failing.
- **Rule:** A modifier reference's weight is the **sum of the weights of every weights-file entry it contains**, where containment depends on the reference's kind (AD-5):

  | Reference kind | Contains a weights entry when |
  | --- | --- |
  | `banded` | the entry is `banded`, shares the `statId`, and lies **wholly inside** the reference — `band.valueMin >= ref.valueMin` **and** `band.valueMax <= ref.valueMax` |
  | `valueless` | the entry is `valueless` and shares the `statId` |

  Whole bands only. There is no open-top form to handle: a reference without a ceiling is a floor, and a floor is the BQ-1 defect AD-5 exists to remove, so `core` never encounters one — `contracts` rejects it at the schema.

  **A reference's edges must be edge-aligned to the pool, which is what closes the sentinel loophole.** Requiring `valueMax` to be *present* only closes the syntax of an open top; a curator writing `valueMax: 9999` (or `valueMin: 0`) is schema-valid, passes every containment and straddle check, and makes AD-16's stat filter operationally min-only — so `core` sums two tiers' weight while `sync` prices the cheaper one. That is BQ-1 verbatim, re-entered through a sentinel. Therefore, for every tracked **`banded`** reference — a `valueless` one has no edges to align — over its containment set under the scope:

  ```
  ref.valueMin == min { band.valueMin : band ∈ contained }
  ref.valueMax == max { band.valueMax : band ∈ contained }
  ```

  A reference must begin exactly where its lowest contained band begins and end exactly where its highest contained band ends. A sentinel ceiling above the pool's top band fails this, as does a sentinel floor below its bottom. Combined with the empty-containment-set rule below, this is a validation error against **`data/tracked.json`**, checked in `core` at load.

  **Edge-alignment is evaluated under the scope, at the entry's own floor, and is floor-dependent by design.** The containment set shrinks as the floor drops, so a reference can align at one floor and fail at a lower one — and that failure is the rule working. It means the curator has written a ceiling the scoped pool cannot reach, which is the same defect as the empty-containment-set case and is caught the same way. AD-17 gives a base exactly one crafted floor, so the check is evaluated once per base and never ambiguously. A builder computing the containment set **unscoped** would silently accept exactly the references this catches; the scope is not optional. A weights-file band that straddles a tracked band edge is a **validation error**, not a pro-rata split: the producer must emit bands whose edges align to the ones in use, because a straddling band describes a population the trade filter does not match (AD-16 filters on rolled value) and no arithmetic in `core` can recover the difference.

  **The straddle rule is the invariant; non-overlap is only its proxy.** Two weights-file bands sharing a `statId` may cover the same value interval when their `itemLevelMin` differs (AD-28) — they are distinct item-level cohorts' contributions to one interval, and the scoping below admits each at most once, so nothing is double-counted. What must never happen is a band **straddling** a tracked reference's edge, and that is checked directly rather than inferred from disjointness.

  **A straddle is a cross-file error and is owned by `data/tracked.json`.** It is not a property of either file alone: the same weights file straddles nothing against a differently-aligned tracked list. So it is never grounds for refusing the weights file — `contracts` cannot even see it, since the weights schema has no view of the tracked list — and it is reported against the tracked entry whose edge was straddled, in `core`, at load. This follows AD-6's pattern of assigning a check to the component that holds both sides of it.

  **The pool is scoped by item level before anything is summed, and the same scope applies to both halves of the ratio.** Let `L = entry.itemLevelMin` and

  ```
  scoped(base, slot, L) = { band ∈ pool(base, slot) : band.itemLevelMin <= L }

                       Σ { band.weight : band ∈ scoped(base, slot, L) ∧ band ⊆ ref }
  P(ref | base, slot, L) = ─────────────────────────────────────────────────────────
                          Σ { band.weight : band ∈ scoped(base, slot, L) }
  ```

  **Numerator and denominator are drawn from the same scoped set.** Scoping only the denominator — the reading the earlier wording permitted — leaves a numerator counting bands that cannot roll at `L`, which inflates that modifier's probability without touching any other, and so reorders the list. `ModifierRef` itself carries no item level; the scope comes from the *entry's* floor and the *weights band's* `itemLevelMin`, and no third source.

  A tracked reference whose containment set is empty under the scope — every band it covers requires a higher item level than the entry's floor — is a **validation error**, not a `P = 0`. It means the curator is tracking a tier that cannot roll on the item they are crafting, and silently contributing zero would hide that.

  Without this scoping the denominator includes bands that cannot roll on the items the search returns, so every probability on that base is wrong by a factor that varies per base — which *reorders the ranked list* rather than shifting it uniformly. That is why the item-level dimension is required in the weights file (AD-11) and not approximated.

  *Stated assumption:* the crafting act is modelled as occurring on a base at **exactly** the entry's item level floor. The `ilvl >= floor` search returns a superset, so the priced population skews slightly higher-level than the modelled one. This is accepted and recorded rather than corrected — correcting it would need an exact-item-level filter the trade API does not offer.

  `P(combination)` treats prefix and suffix as **independent draws**: `P(prefix) × P(suffix)`, with `P = 1` for an absent affix.

  **A base whose pool is not `complete` is not ranked — and its probabilities are stamped.** Partial coverage shrinks the denominator and inflates every probability for that base by `1/coverage` — it *reorders the list*, and a provenance label does not change a sort. `core` therefore excludes such bases from the ordering entirely and returns them in a separate unrankable group with the reason. **Both halves apply:** the base leaves the ordering, *and* every probability derived from a `partial` pool carries provenance `absent` (AD-10), because it is an upper bound rather than an estimate — so the unrankable group renders those figures as unknowns instead of as numbers that merely failed to sort. `absent` arises here and nowhere else. A base absent from the weights file is likewise unrankable; `core` has no other pool source and must not invent one.

  *Stated assumption:* independence holds because a transmute rolls one affix and an augment adds the other, so under an even slot choice the ordering term cancels exactly. Mod-group exclusion makes the second draw weakly conditional on the first; that refinement is deferred, not overlooked.

  **Recipe has no distribution term in v1.** AD-17 ranks per `(base, recipe)`, but the mechanics numbers do not exist (see Open Questions), so `CraftRecipe` contributes **only a cost offset** and the distribution transform is identity. Ordering is therefore recipe-invariant in v1 and differs only by the subtracted cost. This is a stated limitation, not a formula with an empty slot for `core` to fill by invention.

## AD-19 — League is part of every observation's identity

- **Binds:** all
- **Prevents:** the brief's "central threat to the one-year horizon" — a league reset wiping prices while AD-14's "latest observation per entry" silently serves last league's numbers as current.
- **Rule:** The active league id is configuration (`data/config.json` — which also carries AD-26's `minChunkSearches` and nothing else; it is a player-owned file, not a settings bag), and every `PriceObservation` records the league it was observed in. `core` refuses to value any observation whose league differs from the active one, treating it as `not-yet-synced` rather than stale-but-usable. A league change is therefore a config edit plus a natural re-sync, with the ranking honestly empty until data arrives — never quietly wrong. `sync` validates the configured league against the live leagues endpoint at the start of each run and fails loudly on a mismatch.

## AD-21 — One writer, one entity, one commit path

- **Binds:** `sync`, curation workflow
- **Prevents:** two owners for one artifact, and a sync run sweeping an in-progress curation edit into an automated commit.
- **Rule:** Every shared file has exactly one writer:

  | File | Written by | Read by |
  | --- | --- | --- |
  | `data/tracked.json`, `data/config.json` | the player, by hand | `sync`, `web` |
  | `data/currencies.json` | the player, by hand | `sync` **only** — it is deliberately absent from AD-24's fetch set, which is why AD-26's cap is a `sync`-side check |
  | `data/weights.json` | an external producer (the scraper project) | `core` via `web` |
  | `data/catalogue/*.json` | `sync`, on an explicit refresh command only (AD-25) | `sync`, `core` via `web` |
  | `data/dataset.json`, `data/sync-report.json` | `sync` only | `web` |
  | `data/sync-progress.json` | `sync` only | `sync` only — internal |

  `sync` commits **only the files it owns**, by explicit path — never `git add -A`. A dirty working tree elsewhere does not block a sync and is never included in its commit.

## AD-24 — Dataset delivery and the read-time budget

- **Binds:** `web`, `core`
- **Prevents:** two builders choosing differently between bundling and fetching the dataset — which changes cache behaviour, staleness and deploy semantics — and a read-time ranking that AD-4 mandates but nobody sized.
- **Rule:** `web` **fetches** exactly eight artifacts at runtime as separate cache-busted requests — `dataset.json`, `sync-report.json`, `weights.json`, `recipes.json`, `tracked.json`, `config.json`, `catalogue/stats.json` and `catalogue/static.json` — and never `sync-progress.json`, which is internal to `sync`, nor `catalogue/items.json` and `catalogue/filters.json`, which only `sync` needs, nor `data/currencies.json`, which is a sync-side workload declaration (AD-12) that `web` has no use for — its absence is what makes AD-26's cap a `sync`-side check. The eight are the complete set; a ninth requires amending this AD. The two catalogue files are what let `web` render a stat id as its human text and a currency as its icon **without a runtime call to pathofexile.com**, which AD-15 forbids. They are never bundled into the JS, so a sync commit updates data without rebuilding the app. Each carries `schemaVersion` and is validated on load (AD-3); `web` renders from a single consistent set and does not mix artifacts across a refresh. Ranking the full tracked list must complete **under 100 ms** on a mid-range machine and re-run synchronously on a threshold change; if it cannot, the fix is memoising the pure function, not precomputing in `sync` (AD-4). Distinctions AD-10 requires must not be carried by colour alone.

## AD-25 — The trade catalogue is a committed artifact, refreshed on command

- **Binds:** `sync`, `contracts`, `web`, `core`
- **Prevents:** a GGG catalogue change landing as a silent behaviour change instead of a reviewable diff — and an agent reaching for an external modifier catalogue because the app has no authority of its own for what a stat id means.
- **Rule:** The four trade data endpoints are fetched through the governed client (AD-8), validated, and committed as sync-owned artifacts under `data/catalogue/`:

  | Artifact | Endpoint | Carries | Consumed for |
  | --- | --- | --- | --- |
  | `items.json` | `/api/trade2/data/items` | base types by category | `baseTypeId` validation (AD-6), curation |
  | `stats.json` | `/api/trade2/data/stats` | stat ids + display text | `statId` validation (AD-6), modifier text in `web` |
  | `static.json` | `/api/trade2/data/static` | currency ids + icons | `data/currencies.json` ids, icons in `web` |
  | `filters.json` | `/api/trade2/data/filters` | filter ids + options | search construction (AD-16) |

  The refresh is an **explicit command at GGG patch cadence**, never part of a chunk (AD-7) and never on a view path. Its four requests are a declared source under AD-12. The resulting diff is how a renamed stat id or a new base type becomes visible — the same mechanism AD-13 uses for fixtures.

  **The catalogue is an identity and validation authority, never a pool authority.** Verified 2026-09-12: `/data/stats` is a flat global list of 3,108 explicit stat ids, each `{id, text, type}` and nothing more. It carries no per-base association, no tier, no item-level availability and no spawn weight. Every one of those lives in the weights file (AD-11), and no component may attempt to derive them from the catalogue or from search results.

## AD-26 — Refresh rotation is a defined, deterministic order

- **Binds:** `sync`, `contracts`, `web`
- **Prevents:** two builders implementing "which entries does this chunk refresh?" differently — one round-robin, one oldest-first — which would silently change how stale any given row is while every artifact stayed schema-valid. AD-23 already depends on the word *rotation*; before this AD, nothing defined it.
- **Rule:** Within a chunk (AD-7), `sync` selects entries in exactly this order, and stops when any bound in AD-7 is reached:

  0. **currency rates first**, always, before any priced entry in the same chunk — AD-20 requires it, and a rotation that omitted it would produce a chunk of `not-yet-synced` entries by construction;
  1. then every `pinned` entry, each chunk — this is what `pinned` means, subject to the cap below. **Within the pinned set, order by oldest `lastAttemptedAt` first**, the same key row 2 uses. Under the cap a chunk normally reaches all of them and the order is immaterial; it becomes load-bearing exactly when a chunk cannot, and then it is what makes the pinned tail rotate instead of starving permanently behind a fixed key order. A builder ordering pinned entries by the canonical key would diverge here without violating anything else in this AD, which is why the key is named rather than left to the tie-break;
  2. then `active` entries by **oldest `lastAttemptedAt` first** (AD-9), with `not-yet-synced` treated as infinitely old so a new entry is picked up before any refresh. Ordering on `lastAttemptedAt` rather than on the observation time is what keeps a permanently `no-listings` entry in the rotation without letting it monopolise it;
  3. then `unresolvable` entries (AD-6) on a **bounded retry schedule** — at most one attempt per entry per 24h, measured from that entry's `lastAttemptedAt`;
  4. never `pruned` entries, which are excluded from the workload entirely (AD-23).

  **Rows 1–4 are a precedence order over two different fields.** Rows 1, 2 and 4 select on curation status; row 3 selects on price state, and an entry can be `active` *and* `unresolvable` at once. Such an entry is selected at row 3 only — lifting it out of row 2 is what makes row 3's bound mean anything, since the oldest-first ordering would otherwise re-select it every chunk regardless.

  **What the `unresolvable` retry bound actually buys, and what an "attempt" is.** It is *not* budget protection. AD-6's catalogue check is **offline and free**, and it runs over every tracked id on every run regardless of this rotation — so the bound paces no re-validation and suppresses no reporting.

  Two definitions make row 3 coherent, and without them two builders diverge:

  - **`lastAttemptedAt` is stamped only by an attempt that issues a request.** The free offline catalogue check never stamps it. Otherwise every run would stamp every entry, row 2's oldest-first ordering would flatten to a single timestamp across the whole list, and the rotation would lose its ordering key entirely — a far larger failure than the one row 3 addresses.
  - **An id that resolves again stops being `unresolvable` at that moment** and rejoins row 2 as an ordinary `active` entry. It does not wait for a retry slot.

  What row 3 therefore covers is the narrow residue: an entry whose id *does* resolve but whose pricing attempt keeps failing. The 24h bound paces **that** retry, and it guarantees row 3 terminates rather than re-selecting a permanently failing entry every chunk. That is a smaller claim than revision 2 made, and it is the one that survives AD-6.

  **The `pinned` cap is denominated against a chunk, not against a full refresh.** AD-12's ~1,500 searches is a ceiling across a full refresh of many chunks, while a `pinned` entry costs a search in **every** chunk — the two quantities never composed into an inequality anyone could write. The binding requirement is that *a chunk must be able to refresh every `pinned` entry and still make progress on the `active` rotation below it*, and it is enforced at both ends because neither end is sufficient alone:

  | Where | Owner | Rule |
  | --- | --- | --- |
  | Load time, a `tracked.json` validation error | **`sync` only** | `count(pinned) + currencyStepSearches ≤ 0.5 × config.minChunkSearches` — at least half of a minimum chunk is left for the `active` rotation. The currency step is a summand because AD-20 spends it at step 0 of the same chunk; `currencyStepSearches` is **what that step actually costs in searches**, not the row count of `data/currencies.json`, since a bulk exchange query may price many currencies in one request. `sync` reports the figure it used (AD-12's per-source accounting), so the two cannot drift. |
  | Runtime, every chunk | **`sync`**, surfaced by `web` | If the discovered allowance cannot cover the pinned set **plus at least one `active` entry**, `sync` **truncates the pinned set for that chunk** — taking them in row 1's oldest-`lastAttemptedAt` order and reserving at least one search for the `active` rotation — then completes the chunk normally and records a distinct **pinned-starvation** record in `sync-report.json`, carrying the allowance it saw, the pinned count, and how many `active` entries it managed. It is not an error and does not change the exit code (AD-7). `web` surfaces its presence alongside the tracked-list age (AD-23) — a report field nothing renders is a field nobody reads. |

  **The load-time check is `sync`'s alone, and `web` is explicitly not obliged to perform it.** `web` also validates `tracked.json` on load (AD-3), so without an owner column two builders would read this as a shared rule — but `web` *cannot* evaluate it: `data/currencies.json` is not in AD-24's eight-artifact fetch set, and the currency step's search cost is a sync-side fact. `web` refusing to render over a cap it cannot compute would take the product down for a curation error that only ever affects a sync run. This mirrors AD-6, which assigns its two catalogue checks by which component holds the file.

  **`minChunkSearches` is a validation yardstick and never a chunk bound.** It is a declared field of `data/config.json` (AD-19, player-owned per AD-21), read at exactly one place: the load-time inequality above. A chunk's actual size stays what AD-7 and AD-8 say it is — the live remaining allowance in the tightest unsatisfied bucket, discovered at runtime, with no rate compiled in. An implementation that lets this field cap, pace, or shorten a chunk has violated AD-8, and one that reads it anywhere but `tracked.json` validation has violated this AD. The field answers *"could this tracked list ever work?"*, not *"how much work is there right now?"*.

  **It is a declaration about the player's own cadence, not a constant read off a bucket.** A chunk's allowance is governed by whichever of AD-8's search buckets is tightest, and in steady state that is the long one: `600:21600` is **100 searches/hour sustained**, while `30:300` is a burst allowance a chunk only receives in full at an invocation interval around 18 minutes or longer. A syncer invoked every 5 minutes therefore sees roughly **8** searches per chunk once the 6-hour bucket saturates, not 30. Seeding `minChunkSearches` from the burst figure at a short cadence would certify a pinned set that starves every chunk forever — the precise failure this cap exists to prevent, re-entering through the yardstick. The player declares the smallest allowance a chunk will actually receive **at the cadence they schedule**, bounded above by `sustainedRate × interval`; AD-7 is untouched, because the syncer still assumes nothing about its invoker — the player declares it and the runtime check audits it.

  **The runtime half audits the declaration.** `sync` records the allowance it actually observed in every chunk, so a `minChunkSearches` set too high shows up as a starvation record within one run rather than being inferred months later from a refresh that never completes. A declared number nobody checks would be worse than no cap at all, because it would carry the authority of having passed validation. A load-time cap alone cannot be sound, because a chunk's real allowance is discovered at runtime from live rate-limit headers (AD-7, AD-8) and no compiled-in or declared number governs it; a runtime check alone would let a list be authored that can never work. The runtime half is what makes the failure AD-26 exists to prevent **visible** — an oversized pinned set starves both its own tail and the rotation below it, and without the report line the symptom is indistinguishable from a slow refresh.

  Ties break on the canonical entry key (Consistency Conventions) so a run is reproducible and a resumed run is explainable. The order is a pure function of the tracked list, the dataset and a passed-in clock value — `sync` computes it through `core`, so it is testable with literal inputs and identical between a dry run and a real one.

  **A resumed chunk recomputes the order rather than replaying a frozen plan.** `sync-progress.json` records which entries a chunk has *completed*, not which it intended to visit. Freezing a plan would make a resumed run act on a stale view of the dataset — re-pricing entries a concurrent-but-earlier run already refreshed — and would add a second, divergent notion of what the rotation is.

## AD-27 — Pool coverage is measured before the view is built

- **Binds:** build sequence, `web`, `core`
- **Prevents:** the view being designed around a full ranked list that the weights file cannot populate — discovered after the layout is committed rather than before, when it is still free to change.
- **Rule:** AD-18 excludes any base whose pool is not `complete` from the ordering, so the size of the ranked list is a direct function of the weights file's coverage, and that fraction is **unmeasured until someone measures it**. Before any view work, measure:

  ```
  rankable(base) = base carries at least one tracked entry that is
                   crafted (AD-5: at least one affix present)
                   and not pruned (AD-23)

  covered(base) = base is PRESENT in weights.json
                  ∧ both slots declare poolCoverage "complete"
                  ∧ neither slot's pool is empty

  coverage = |{ baseTypeId ∈ tracked.json : rankable ∧ covered }|
             ──────────────────────────────────────────────────
             |{ baseTypeId ∈ tracked.json : rankable }|
  ```

  **The numerator's three conditions are each load-bearing, and stating only the middle one makes the fraction ambiguous.** "Both slots are `complete`" is **vacuously true** of a base absent from `weights.json` entirely — there are no slots to fail — and a base declaring `complete` over an *empty* pool passes a naive reading while AD-18 excludes it from the ordering anyway. Either gap lets the same tracked list and the same weights file score 100% or 40% depending on who runs the measurement, across a gate whose consequences turn at 80% and 50%. A measurement that binds a layout decision must be reproducible by two people who have never spoken.

  The denominator is **the tracked list**, not the catalogue — the question is how much of what the curator wants ranked can be ranked, and a base nobody tracks cannot affect the product. Both slots must be `complete`, since one `partial` slot is enough to make the base unrankable under AD-18.

  **The denominator counts only bases that need a pool.** A base tracked solely as a raw base has no probability term at all — it ranks on AD-17's separate branch — so it can never resolve to `complete` and counting it would depress a fraction that **binds a layout decision**, promoting the unrankable group on the strength of bases that were never unrankable. `pruned` entries are excluded for the same reason: AD-23 removes them from the ranking sum, so a base whose only crafted entries are tombstones needs no pool either. A base carrying **both** raw and crafted entries does count — its crafted branch needs a pool like any other. The result binds:

  | Coverage | Consequence |
  | --- | --- |
  | **≥ 80%** | Proceed as specified. |
  | **50–80%** | Proceed, but the unrankable group is a **first-class surface** in `web`, not a footer — at this coverage it is a large share of the catalogue and hiding it misrepresents the product. |
  | **< 50%** | The ranking premise fails. Escalate rather than ship: either the producer improves coverage, or the spine is amended to rank `partial` pools under explicit upper-bound semantics. Do not resolve this inside `core`. |

  **Coverage is re-measured on every weights-file regeneration, not once before the view.** It was written as a pre-view gate, but the fraction moves: a patch introduces modifiers the source publishes unnamed, a producer must drop those rows, and the affected pools fall back to `partial` (the weights contract's placeholder-row rule) — so a product that measured 85% before launch can be at 60% the week after a patch with nothing reporting it. The measurement is therefore part of accepting a regenerated file, and `sync-report.json` carries the figure it computed so a drop across a patch boundary is visible where the rest of the run's health already is. The thresholds below bind a layout decision, and a layout decision made against a stale number is the failure this AD exists to prevent.

  The rule is **source-agnostic** — it binds whatever produces the weights file, and survives a change of producer untouched.

## AD-28 — Multi-number modifiers decompose over the value axis, not the tier axis

- **Binds:** `contracts`, `core`, weights producers
- **Prevents:** a contract no producer can satisfy — a modifier rolling two numbers has no tier-to-value mapping, so tier bands overlap in value space and every rule for collapsing them yields a file AD-18's straddle rule must refuse — and, were the rule merely relaxed, a numerator summing tier weight the trade filter never selected.
- **Rule:** For a modifier whose text carries more than one `#` — *"Adds # to # Lightning Damage"* — the game rolls two numbers and the trade filter compares one derived value. **The value axis therefore does not partition the tier axis:** one value interval genuinely draws spawn weight from several tiers, and no collapsing rule separates them.

  *Measured by the producer 2026-09-13:* 53 of 63 item classes carry such modifiers, up to 36% of a weapon class's pool; every candidate rule (average, first number, second number, sum, span) leaves 170–1,250 overlapping tier pairs, most of them strict rather than edge-touching. Bows, *"Adds # to # Lightning Damage"*, by average: T7 (ilvl 60) runs 43.0–56.5 while T8 (ilvl 65) opens at 56.0.

  **The band's unit is measured, never chosen.** A band is expressed in whatever quantity the trade stat filter compares and in no other, because AD-16 passes its edges into that filter and this rule counts the population that comes back. Which quantity that is, is one empirical fact about the trade API — not a modelling decision with five defensible answers.

  **A band is a value cell, and a cell may hold mass from several tiers.** Per `(baseTypeId, slot, statId)` family the producer:

  1. cuts the value axis at **every** tier endpoint in the family, giving one partition into cells — computed **once over all tiers, never per item level**. Two adjacent tiers that merely touch at one lattice point still share it, so that point is its own one-point cell; cut uniformly rather than merging the narrow overlaps. This is what makes **straddling** floor-invariant: a reference whose edges sit on this partition's boundaries straddles no cell at any item level, so AD-18's straddle check cannot pass for one tracked entry and fail for the next, and a per-cohort partition would lose that. It does **not** make AD-18's *edge-alignment* check floor-invariant, and is not meant to — that check is floor-dependent by design (AD-18);
  2. groups the family's tiers into cohorts by `itemLevelMin`;
  3. emits, for each (cohort `ℓ`, cell `c`) carrying weight, one entry with `c`'s edges, `itemLevelMin: ℓ`, and

     ```
     weight(ℓ, c) = Σ { w(t) × P(value ∈ c | t) : t ∈ tiers(ℓ) }
     ```

     where **`tiers(ℓ)` is the tiers whose `itemLevelMin` *equals* `ℓ`** — never `≤ ℓ`. Every tier belongs to exactly one cohort, and the cohorts partition the family. Read as `≤`, the same tier is redistributed into every cohort above it, which triangular-double-counts the whole family *and still satisfies a per-cohort conservation check*, so nothing downstream catches it. This is why the equality is written rather than left to the reader.

     A cell no tier in `ℓ` can reach is **not emitted**. That is a different thing from `weight: 0`, which means *this modifier cannot roll on this base* and is required for a `complete` pool — a missing cell says nothing about pool membership, because the family is present in the cohorts that do reach it.

  **Mass conservation is the invariant; the split estimator is not.** For every tier, `Σ over cells of its split == w(t)` exactly. Any conserving split leaves the base's denominator and every reference's total exact and errs only in how mass distributes *within* a family. The recommended estimator is the two numbers as independent uniform integers over their per-tier ranges, counted over the value lattice; a producer unable to defend that for a family may split otherwise, and carries `provenance: "modelled-split"` (AD-10). A producer that **measures** the cell masses directly rather than modelling them carries `measured` — the provenance names how the mass was distributed, not that a decomposition happened.

  **Conservation is checkable, and therefore checked.** A rule `core` cannot verify is an aspiration, and this one guards the denominator of every affected base. The file therefore carries, per decomposed family, the **pre-split cohort total** — the plain sum of that cohort's tier weights, which the producer holds before it splits anything — and `core` validates that the cohort's emitted cells sum to it. Derived by an independent path from the cells themselves, it catches the failure that actually happens (a dropped, duplicated or misattributed cell) even though it cannot catch a subtly wrong conditional distribution. What remains unverifiable is the *shape* of the split, and `modelled-split` is precisely the label for that residue.

  **Non-overlap is restated, not dropped.** Bands sharing a `statId` **and** an `itemLevelMin` within a `(base, slot)` must not overlap. Bands sharing a `statId` at **different** `itemLevelMin` may cover the same interval. Under this decomposition AD-18's straddle rule holds by construction for any cell-aligned reference, which is what non-overlap was only ever a proxy for.

  **A tier can no longer be isolated, and that is correct.** A reference spanning a tier boundary necessarily includes the neighbouring tier's tail. The trade search cannot isolate it either, so the priced population and the weighted population remain the same population — the only property AD-16 and AD-18 jointly require. `tierLabel` on such a cell names a mixture and stays display-only (AD-5).

  **But a curator should track the interior cell, not the span — and this is what the boundary cells are for.** AD-16 prices a reference from the **cheapest 10** listings it matches, so a reference spanning a boundary cell is priced at the cheap tail of the neighbouring tier while carrying the whole span's probability mass. Below AD-17's threshold that summand does not merely understate, it **truncates to zero and takes the good tier's mass with it** — BQ-1's failure mode, re-entered through a heterogeneous band rather than a floor. The partition already supplies the remedy: the interior cell (`[57,78.5]` rather than `[56,80]`, in the worked example) is a reference whose population is one tier and whose price is that tier's. The boundary mass is then untracked, which costs nothing — AD-17 sums over a partition of tracked outcomes and has never required the tracked set to be exhaustive. Curate to interiors by default; span a boundary only where the two tiers' prices are known to be close.

  **Two producer obligations here are unverifiable, and are named rather than implied.** `core` holds no tier data, so it cannot check that the partition was cut at the *real* tier endpoints, nor that a split's conditional distribution is right. A producer emitting one coarse cell per cohort satisfies every mechanical check while forcing every curator into a full-span reference — BQ-1 through a coarse cell instead of a sentinel value. Two things blunt it: the cohort-carriage bound below, which refuses the degenerate case outright; and the fact that the failure is **loud at curation time**, since edge-alignment rejects the band the curator wanted and leaves only the full span. What remains is trust in the producer, of the same kind and no more than the trust already placed in every weight in the file.

  **A cell may be carried by at most two cohorts.** Only adjacent tiers overlap, so a correct partition yields cells belonging to one tier or to exactly two. A third is a hard file error. This is what makes the coarse-partition case detectable: a producer emitting one wide cell per cohort has that interval carried by every cohort in the family. *Stated assumption:* no three tiers of one family overlap at a value. If real game data ever does, that is an amendment to this AD, not a workaround in a producer.

  **The value lattice may be finer than the integers.** Under an averaged unit it is half-integers. Closed cells tile such a lattice without gaps, and producers emit edges **on** it; a curator's reference does the same.

---

## Supporting conventions referenced by the ADs above (verbatim rows from "Consistency Conventions")

| Concern | Convention |
| --- | --- |
| Ids | `statId` and `baseTypeId` are the trade API's own identifiers, never re-encoded — `baseTypeId` is the `type` string exactly as `data/items` spells it (e.g. `"Guardian Bow"`). Internal ids are forbidden (AD-5), and every id is validated against the committed catalogue (AD-25). |
| Bands | A modifier reference is `banded` — `(statId, valueMin, valueMax)` with **inclusive, always-present** edges — or `valueless` — `(statId)` with no edges (AD-5). Bands sharing a `statId` **and** an `itemLevelMin` never intersect; sharing a `statId` at different `itemLevelMin` they may cover the same interval (AD-28). Edges sit on the value lattice the trade filter compares against, which may be finer than the integers. |
| Entity keys | A `TrackedEntry`'s canonical key is `(baseTypeId, itemLevelMin, prefixBand, suffixBand)`, serialised in that field order. Each affix encodes as the literal `null` when **absent**, as `[statId, valueMin, valueMax]` when **banded**, and as `[statId, null, null]` when **valueless** (AD-5) — three distinguishable forms, so an absent affix and a valueless one can never collide. Every artifact keying entries uses this one encoding — internal surrogate ids are forbidden (AD-5), so the key is the identity and two components must not spell it differently. |
| Item level | `itemLevelMin` is a declared floor, uniform across a base's tracked entries (AD-17) and present on every weights band (AD-11). Never inferred, never adjusted by code. |
| Units | Divine for all currency (AD-20). Band edges and item levels are raw game numbers. No unit is implied by a field name alone — schemas name the unit. |
| Numeric precision | **Band edges are `number`, never `integer`** — the lattice the trade filter compares on may be finer than the integers (half-integers under an averaged unit, AD-28), and which it is, is a producer-side fact the schema must not pre-empt. Fixing this now is what lets `contracts` land ahead of the Open Question on the filter's unit. Edges are compared for **exact equality** by AD-18's alignment and containment rules, so a producer emits values that are exact on the lattice and never a rounded approximation of one. Persisted divine prices are numbers rounded to 4 decimal places at the point of normalisation; weights are non-negative numbers used only in ratios. Rounding happens once, in `sync`; `core` never re-rounds, so two readers of one artifact cannot disagree on a value. |
