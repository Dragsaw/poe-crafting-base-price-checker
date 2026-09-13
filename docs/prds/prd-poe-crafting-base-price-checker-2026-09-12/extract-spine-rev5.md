# EXTRACT — ARCHITECTURE-SPINE.md revision 5

Source: `docs/architecture/architecture-poe-crafting-base-price-checker-2026-09-12/ARCHITECTURE-SPINE.md`
(front matter: `status: final`, `revision: 5`, `updated: '2026-09-13'`).

Everything below is quoted verbatim from the spine unless marked *[extract note]*.
Line numbers are as of the read on 2026-09-13.

---

## 0. Scope caveats found while extracting

*[extract note]* Three places where the spine does **not** say what the brief for this extract assumed:

1. **AD-11 carries no contract version number.** The "Weights contract raised to **4.0.0** (breaking) and to `status: final`" sentence lives **only** in the revision-5 banner (line 25); `4.0.0` appears nowhere else in the spine, and AD-11 names no version at all (it points at `WEIGHTS-FILE-SCHEMA.md`). Likewise `3.0.0` appears only in the revision-4 banner.
2. **AD-11 makes no "pool-completeness" statement in those words.** Its nearest text is the *prerequisite* paragraph ("Until a conforming file exists, every base is unrankable by AD-18"). Pool completeness as a rule lives in AD-18 ("A base whose pool is not `complete` is not ranked") and AD-27 (`poolCoverage "complete"`), not AD-11. AD-5 contains the only "counts toward pool completeness" phrase.
3. **AD-26 was amended only in its row-2 key** (absent `lastAttemptedAt` rather than the `not-yet-synced` price state) and in row 1's pinned ordering; the starvation material (load-time cap, runtime truncation, `minChunkSearches`) reads as revision 3 left it. The extract reproduces all of it anyway, as asked.

---

## 1. The new AD and the nine amended ADs — full current text

### AD-29 — One game modifier may publish several stat lines, and the draw is over modifiers *(new in revision 5)*

- **Binds:** `contracts`, `core`, weights producers
- **Prevents:** a pool denominator that double-counts every multi-stat modifier — understating every probability on the base, unevenly, which reorders the ranked list — and the permanent loss of the fact that two stats always roll together, which cannot be reconstructed once the source row is split.
- **Rule:** A single game modifier may carry **several distinct trade stats**, rolled as one unit under one spawn weight. This is a different thing from AD-28's case: there, one stat rolls two numbers and the filter compares one derived value; here, two or more `statId`s each with their own value range arrive together because the game draws the modifier, not the line.

  *Measured by the producer 2026-09-13:* 560 of 8,437 in-scope rows — 534 carrying two stats, 18 carrying three, 8 carrying one number plus a flat line. Exploding them takes 8,437 source rows to 9,015 stat-line units. Real case, Body Armours, one row at weight 1000: *"+# to Evasion Rating"* over 4–6 together with *"#% increased Evasion Rating"* over 6–13.

  **The producer emits one entry per stat line, each carrying the source row's full weight, and every entry names its source.** Every entry — hybrid or not — carries a required **`sourceModifierId`**, a producer-assigned string stable within one `(baseTypeId, slot)`. A single-stat row is a group of one. The field is required rather than hybrid-only so that `core` has **one** identity notion instead of two code paths, and so that a producer forgetting it on a hybrid cannot emit a file that still validates.

  **A `sourceModifierId` names one source row — one *tier* of one modifier — and not a modifier family.** This granularity is fixed, not left to the producer, because both readings conform to everything else here and they disagree about which items satisfy two references at once: under the family reading, tracking one stat at T1 and another at T3 would read as co-occurring, when no single item carries both. The row is also the right unit on its own terms — spawn weight and `itemLevelMin` are published **per row**, so a row is precisely the thing the game draws with a weight, which is what the denominator is a sum over. Two consequences follow and are stated because a builder will otherwise derive one or the other wrongly: a family's several tiers carry **different** `sourceModifierId`s, and a group therefore sits in **exactly one** item-level cohort.

  Full weight on every line is what keeps each `statId`'s **marginal** probability right — the chance of an item carrying *that* stat line is the chance of drawing a modifier that publishes it, which is the source row's weight, not a share of it. The alternatives were rejected on that ground: attributing the mass to one designated line zeroes every other line's marginal, and the zeroed one may be exactly the stat a curator tracks; dividing the mass leaves no single stat's marginal correct, and the error is unrecoverable downstream.

  **The denominator is where the duplication is paid for, not the entries.** AD-18's denominator sums over distinct `sourceModifierId` rather than over entries, counting each modifier's mass once. `mass(g, L)` is the common per-`statId` sum of `g`'s scoped entry weights.

  **That commonality is an invariant, and therefore checked.** Within one `sourceModifierId` — which is one cohort by construction — the emitted weights grouped by `statId` must sum to the **same** value — each line's cells conserve the same underlying mass (AD-28), so they can only disagree if a cell was dropped, duplicated or misattributed. Disagreement is a **hard file error**, the same shape and for the same reason as AD-28's `cohortTotals`: a rule `core` cannot verify is an aspiration, and this one guards the denominator of every base carrying a hybrid.

  **Co-occurrence is preserved by the same field, at no extra cost.** Two stats sharing a `sourceModifierId` always roll together, and that fact is destroyed by the split unless the producer marks it — a consumer pricing *"I want both"* from two independent entries would multiply two probabilities and get a number far too small, when the answer is the one weight. `core` uses it today for AD-17's `coOccur` branch, which is not optional: two tracked entries in one slot naming two lines of one modifier are **both satisfied by a single item**, so without it that base's `ΣP` exceeds 1 and it takes the top of the ranking. Pricing a deliberate conjunction is Deferred; recording the fact is not, because it is cheap now and impossible later.

  **One `statId` may be published by more than one source modifier, and AD-28's family is unchanged by it.** The two keys sit at different levels and a builder meeting both will ask which wins: AD-28's cell partition is cut per `(base, slot, statId)` over **every** tier of **every** modifier publishing that stat, because edge-alignment is a property of what the trade filter can ask for; AD-29's group is per modifier, because that is what the game draws. So non-overlap is scoped by `sourceModifierId` as well as by `itemLevelMin` (AD-28) — two modifiers may legitimately publish the same stat over the same cell — while the numerator sums both and the denominator counts each modifier once. Scoping non-overlap by `statId` alone would refuse that file, and merging the two modifiers into one entry to satisfy it would destroy the co-occurrence marker on both.

  **A source modifier's lines may span kinds and need not share a shape.** Eight of the measured rows pair a banded line with a flat one, so a group may hold `banded` and `valueless` entries together. That is legal and says nothing about AD-5's per-`statId` kind rule, which constrains one `statId` across a file and not one modifier across its lines.

*[extract note] `mass` arity discrepancy:* AD-29 writes `mass(g, L)`; AD-18 writes `mass(g)` and states explicitly "**`mass(g)` carries no `L`.**" Both texts are quoted verbatim in this extract; the spine does not reconcile the two spellings.

---

### AD-5 — Canonical modifier identity is the trade stat id plus a bounded value band

- **Binds:** all
- **Prevents:** the tracked list, the weights file and the trade query each carrying a different notion of "a modifier", which silently mismatches instead of failing — and, since revision 2, a probability covering two tiers being multiplied by one tier's price (AD-17, AD-18).
- **Rule:** A modifier reference is one of exactly two kinds, discriminated in the schema:

  | Kind | Shape | For |
  | --- | --- | --- |
  | `banded` | `(statId, valueMin, valueMax)` — an **inclusive, closed band** over the value the trade filter compares (AD-28) | every modifier that rolls a number |
  | `valueless` | `(statId)`, no edges at all | a modifier that rolls no number — *"Loads an additional bolt"* |

  The trade API has no tier concept; a "tier" exists only as a band. **A valueless reference is not a degenerate band.** A sentinel pair such as `1/1` would pass every containment, straddle and edge-alignment check while making AD-16 emit a min/max filter for a stat that has no value — the same class of defect as the sentinel ceiling this AD's `valueMax` rule exists to close. It still carries `weight` and `itemLevelMin` and still counts toward pool completeness; AD-16 emits its filter with no edges.

  **A band is a value interval, not a tier.** For a modifier rolling more than one number the two are different axes, and one interval draws weight from several tiers — AD-28 governs the decomposition, and this AD's identity is unchanged by it.

  **A reference names a stat line, not a game modifier.** One modifier may publish several `statId`s that always roll together (AD-29), so a `statId` identifies what the trade filter can ask for, which is the only thing this identity has to do. It does **not** identify the thing the game draws — that is `sourceModifierId`, which lives on the weights file and never on a reference, because a curator can only ever filter on what trade exposes. AD-18's denominator and AD-17's overlap predicate are where the difference between the two is paid for; this AD's identity is unchanged by it.

  **`valueMax` is required, everywhere, with no open-top form.** An omitted ceiling is a floor by another name, and a floor is exactly what BQ-1 removed: it spans tiers again, so AD-18 sums two tiers' weight while AD-16's ascending sort prices the cheaper one. Worse, the defect would be *unvalidatable* — `sync` checks `tracked.json` but the band edges it would need to check against live in `weights.json`. Every game modifier has a maximum roll, so a closed band is always expressible; a curator wanting "T1 and everything above" writes the real ceiling, not a blank. A tracked entry is `(baseTypeId, itemLevelMin, prefix?, suffix?)` where each affix is a modifier reference or **absent** — an entry with both absent is a raw base (this is how white ilvl-82 bases are represented). `baseTypeId` is the trade API's base type `type` string exactly as `data/items` spells it. No component may introduce a second modifier identity.

  **Why a band, not a floor.** Under a floor, a reference at the T2 edge covers T1 and T2 together, so AD-18 summed both tiers' weight while AD-16 — sorting ascending — priced essentially T2. The jackpot was not understated but *deleted*: if the T2 price fell below the payout threshold, the whole entry truncated to zero and took its T1 probability mass with it, destroying the jackpot isolation that threshold-truncated EV exists to provide. Bands make **outcomes** disjoint, so each carries its own price and AD-17's partition holds with both tracked. Disjoint outcomes, not disjoint tiers: where a modifier rolls more than one number the two are different things, and AD-28 supplies the decomposition that keeps the outcomes disjoint anyway.

  **`itemLevelMin` is declared, never inferred.** It is authored by hand as part of curation; neither `sync` nor `core` derives or adjusts it. Choosing the accepted tier and choosing the band are one authoring act, and the item level that choice implies is recorded next to it.

*[extract note]* The identity tuple asked for appears in two forms above and both are verbatim: the reference tuples `(statId, valueMin, valueMax)` / `(statId)`, and the tracked-entry tuple `(baseTypeId, itemLevelMin, prefix?, suffix?)`.

---

### AD-6 — An unresolvable stat id is a loud failure with a dataset representation

- **Binds:** `sync`, `contracts`, `web`
- **Prevents:** a tracked combination silently disappearing from the rankings after a game patch, with no symptom the player would ever notice — and, equally, a patched-out modifier continuing to rank on its last-good price forever.
- **Rule:** If a tracked entry references a stat id or base type the trade API no longer exposes, `sync` writes that entry's price state as `unresolvable` (AD-9) **and** records it in `sync-report.json`. It is never skipped, never defaulted, never left at its previous value. `core` excludes `unresolvable` entries from valuation; `web` must surface their existence rather than only omitting them.

  **Detection is by catalogue validation, not by inference.** Two checks, with distinct owners, because the two files are read in different places:

  | Check | Owner | Surfaced as |
  | --- | --- | --- |
  | every `statId` / `baseTypeId` in `data/tracked.json` exists in the catalogue | `sync`, before issuing any request | the entry's `unresolvable` state + `sync-report.json` |
  | every `statId` / `baseTypeId` in `data/weights.json` exists in the catalogue | `sync`, reading the file (it is a **reader**, not its writer — AD-21 governs writers) | `sync-report.json` only; the file is never rewritten |

  `sync` owns both because it is the only component holding the full catalogue: AD-24 deliberately keeps `catalogue/items.json` out of `web`'s fetch set, so `core` cannot perform a base-type cross-check at load and must not pretend to. `core` still validates the weights file's **shape and pool rules** at load (AD-1: loading is an adapter's job, validating is pure). Splitting it this way is what stops a mistyped base key from silently vanishing from the product with nothing anywhere reporting it.

  **An uncatalogued id is therefore never a weights-file refusal, and the contract must not list it as one.** A hard file error is `core`'s refusal at load, and `core` cannot evaluate this check at all — the base-type half needs `catalogue/items.json`, which AD-24 withholds from `web`. Making it a refusal would require amending AD-24 to fetch a ninth artifact, and would then take the whole product down over a condition this AD already reports through the one component that can see it. `WEIGHTS-FILE-SCHEMA.md` is corrected to match rather than the reverse: the check is `sync`'s, report-only, and the file loads.

  An empty result set means `no-listings` (AD-9) and never `unresolvable`: conflating the two would report a patch-out every time a combination simply had no sellers.

---

### AD-9 — Price is four-state; absence is never zero or null

- **Binds:** `contracts`, `core`, `web`
- **Prevents:** "no listings" being conflated with "worthless" — which would drop exactly the plausible jackpots the addendum identifies as unresolved — and an unresolvable entry having nowhere to live.
- **Rule:** Every tracked entry's price is exactly one of `priced` (with a value and an `observedAt`), `no-listings`, `not-yet-synced`, or `unresolvable`. `core` excludes every non-`priced` state from the expected-value sum rather than contributing zero, and reports each separately so the view can show them outside the ranking. No component may represent absence as `0`, `null`, or a missing key.

  **`lastAttemptedAt` is declared on every entry in all four states, and present wherever a request has been issued.** `observedAt` exists only where there is an observation; `lastAttemptedAt` records when `sync` last **issued a request** for the entry, regardless of the outcome. Offline work — AD-6's catalogue validation above all — never stamps it, because a check that ran over every entry on every run would flatten the timestamp across the whole list and destroy AD-26's ordering key. The two are distinct and neither substitutes for the other: without `lastAttemptedAt`, AD-26's rotation would re-select every `no-listings` entry forever — they never acquire an observation time — and AD-6's bounded retry would have no state to count against. `web` reports age from `observedAt` where one exists and from `lastAttemptedAt` otherwise, labelled as what it is.

  **The one entry with neither is a never-synced entry, and it must not be given a placeholder.** *Declared in all four states* is a statement about the schema, not about the data: an entry for which no request has ever been issued has no attempt to record, so the field is genuinely **absent** on it. Stamping a placeholder to satisfy a non-null field would fail twice over — it would render as an age on screen where there is none, and it would hand AD-26 a rotation key that sorts wrongly, since row 2 treats a never-synced entry as **infinitely old** precisely so a new entry is picked up before any refresh, while a placeholder would sort it as freshly attempted and park it at the back of the queue it should lead. Such a row carries no age at all and `web` renders it as *never attempted*, which is a different fact from an old attempt and is shown as one. This is the only state with no age; a `no-listings` or `unresolvable` entry that has been attempted has one.

---

### AD-11 — Weights are a consumed file; normalisation and recipe effects live in core

- **Binds:** `core`, `contracts`, weights producers
- **Prevents:** every weight producer having to understand crafting recipes, two consumers normalising raw weights into probabilities differently, and the app growing a scraper of its own.
- **Rule:** The app consumes a weights file conforming to `WEIGHTS-FILE-SCHEMA.md` and never produces one. The file carries **raw game spawn weights, banded by rolled value and by item level**, per base type and affix slot — `(sourceModifierId, statId, valueMin, valueMax, itemLevelMin, weight)` for a banded entry and `(sourceModifierId, statId, itemLevelMin, weight)` for a valueless one, every field of the chosen kind required and none nullable (AD-5, AD-29). Bands are **value cells**, and for a multi-number modifier a cell's weight is a conserving split of several tiers' weight across the cells they reach (AD-28); the producer owns the split, `core` never performs one. Conversion to probabilities is AD-18 and happens only in `core`. Craft-recipe effects on the tier distribution are modelled in `core` and are never baked into the weights file. The producer of the file is irrelevant to the app.

  **`gamePatch` is asserted by the operator, not derived.** The file names the GGG patch its weights describe, and nothing can compute that field: the producer's sources do not state it and the trade API exposes no patch version either (AD-25). A producer takes it as a required run-time input and refuses to run without it rather than emitting a default, because a defaulted value propagates silently past the one person who could have caught it. `core` does not parse it and must not branch on it; `web` surfaces it beside `producer.id` and `producer.generatedAt` (AD-24) so a file left behind by a patch is visible as such.

  **The file is a prerequisite, not a convenience.** The trade API exposes no pool membership, no tier, no item-level availability and no spawn weight (AD-25), so nothing in this system can derive what the file carries. Until a conforming file exists, every base is unrankable by AD-18 — which is the honest outcome, not a degradation to engineer around.

  **v1 depends on the external scraper project for this file**, decided rather than assumed: it supplies pool membership, band edges, `itemLevelMin` and weights. A uniform-prior file remains a valid *weighting* shortcut (every `weight: 1`) but never a *sourcing* one, because the two fields it cannot fake are the two the trade API cannot supply. **RePoE is a last-resort fallback only**, since it carries modifier metadata but not spawn weights and was never the authority for the field that matters.

*[extract note]* AD-11 states **no contract version** (no `4.0.0`) and no explicit pool-completeness clause; see §0.

---

### AD-16 — The price estimate is the cheapest live instant-buyout listings

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

  The `PriceObservation` is the **median of those listings' prices after normalisation to divine** (AD-20), recorded with the sample size actually returned.

  **On an even sample the median is the lower of the two middle values, never their mean.** Ten results is the common case, so this is the normal path and not an edge case, and it sits inside the one definition the brief calls *"the product; everything else is presentation"* — left unstated, two implementations return different prices from identical data and every downstream figure diverges with them. Taking the lower value keeps **every persisted price a price someone actually asked**, rather than a synthetic midpoint no listing carries; it needs **no second rounding step**, because each listing is normalised and rounded once on the way in (Consistency Conventions), so choosing one of them cannot leave the grid — where a mean of two adjacent values would, and would then need a rounding rule of its own that two builders could write differently; and it leans very slightly cheap, in the same conservative direction as the ascending sort.

  The API's ascending sort is per listing currency, so when a result set spans currencies the median is taken over normalised values and the sample may not be the globally cheapest ten; that is accepted and recorded, not corrected by extra requests. Fewer than 10 results is valid and records the true count; zero results is `no-listings` (AD-9), never a price. Ascending sort is what keeps stale overpriced listings out of the estimate; instant-buyout-only is what removes listings priced below market, which would already have been bought.

  **The estimator prices the cheap end of whatever band it is given, so the band must be homogeneous.** That is harmless for a band whose population is one tier and dangerous for one spanning a tier boundary, where the cheapest listings are the neighbouring tier's tail while AD-18 carries the whole span's probability. AD-28 names the curation rule that keeps the two aligned — track interior cells — and the reason it is a rule rather than a preference.

---

### AD-17 — The ranking formula, its threshold, and its unit

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
                       true              if x.statId != y.statId ∧ coOccur(x, y)
                       false             if x.statId != y.statId
                       true              if both are valueless
                       bands intersect   otherwise
  ```

  **`coOccur` is what stops one game modifier being counted as two outcomes (AD-29).** A source modifier may publish several stat lines that always roll together, and two references naming two of them are both satisfied by a single item — so `x.statId != y.statId` is not on its own evidence of disjointness. `coOccur(x, y)` holds when some `sourceModifierId` in the pool scoped to **this base's own crafted floor `L`** (AD-18 — the same `L` that scopes every probability on the base, and AD-17 gives a base exactly one) emits an entry contained by `x` **and** an entry contained by `y` in the same item-level cohort: one modifier that can satisfy both references at once.

  **Where the pool cannot answer, `coOccur` is `false` and the tracked list still loads.** A base absent from `weights.json`, or one whose pool is `partial`, has no reading of this branch — and the safe behaviour is *not* to refuse. AD-18 has already excluded such a base from the ordering entirely, so the partition `coOccur` protects is never summed for it and a missed double-count cannot reorder anything. Refusing instead would take the whole site down over a base that was never going to rank, which is the failure AD-6 and AD-26 both decline elsewhere. Two builders would otherwise split here — one short-circuiting to `false` and rendering, one treating the check as unevaluable and rejecting `tracked.json` site-wide — so the reading is named rather than left to judgement. The base's unrankability is reported as it already would be; nothing new is surfaced. Without this branch the predicate short-circuits to `false`, the partition check passes, and that base's `ΣP` exceeds 1 — the same failure the prefix-only/suffix-only case below produces, reached from the other direction. It is a **cross-file** test: co-occurrence is a fact of `weights.json` and the references are in `tracked.json`, so like the straddle rule it is evaluated in `core` at load and reported against the tracked entry, never against either file alone.

  One kind pairing is unreachable rather than handled: a `statId` either rolls a value or does not, so one banded and one valueless reference can never share a `statId`. That rejection is **split by what each component can see.** `contracts` owns the **within-file** case — two tracked entries in `data/tracked.json` naming one `statId` under different kinds, which a per-file schema sees on its own. **Kind agreement *between* files is `core`'s, at load**: a `valueless` tracked reference against `banded` cells in `weights.json` (or the reverse) is a cross-file disagreement `contracts` cannot see, since the weights schema has no view of the tracked list. It goes where every other cross-file rule goes — AD-18's straddle and edge-alignment checks, and `coOccur` above — for the same reason AD-6 gives: a check belongs to the component that holds both sides of it.

  An absent affix means *any roll in that slot*, so it overlaps everything — which is why the conjunction is over **both** slots. Three consequences worth naming, the third of which the earlier enumeration missed:

  - Adjacent tiers of one `statId` in one slot are disjoint and may both be tracked. That is the point of AD-5's bands. Bands that *intersect* still overlap and are still rejected.
  - A partial-affix entry subsumes a fuller one: leaving a slot absent covers every roll in it.
  - **A prefix-only entry and a suffix-only entry on one base overlap each other.** Neither subsumes the other, and no two bands intersect — yet an item carrying both named modifiers satisfies both entries, so it is counted twice. The predicate catches this; a list of shapes did not.

  Separately, **the crafted entries on one `baseTypeId` must share an `itemLevelMin`.** Two entries with identical affixes at floors 75 and 82 are *nested, not disjoint*, since every ilvl-82 item also matches the ilvl-75 search.

  Rule 3 has a second, independent reason to hold: `EV` is an expectation over **one crafting act on one item population**. Entries at different floors describe crafts on differently-levelled bases, and their `P` terms are normalised against differently-scoped pools (AD-18). Summing them is not an expectation over anything. A base therefore has exactly one crafted item level floor, and the tracked list is validated for it.

  **Rule 3 binds summands only, so a raw base is exempt.** A raw entry is never a summand — it ranks on the separate branch below — so its floor cannot break a partition it does not enter. A white base pinned at exactly ilvl 82 may therefore coexist with crafted entries on the same `baseTypeId` at a lower floor. Without this exemption the rule would reject the very configuration the brief asks for, since white bases are tracked at 82 and magic ones well below it.

  **Raw bases rank on a separate branch.** A `TrackedEntry` with both affixes absent (AD-5) is never a summand — at `P = 1` it would enter at certainty and swamp every crafted outcome. Its `EV` is its observed price, with zero craft cost, ranked in the same list and labelled as an uncrafted base.

*[extract note]* The `slotOverlap` branches are quoted in the spine's own order; the `coOccur` branch sits **second**, ahead of the `false if x.statId != y.statId` branch, so order is load-bearing.

---

### AD-18 — Weight aggregation and normalisation

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
                            Σ { mass(g) : g ∈ sources(scoped(base, slot, L)) }
  ```

  **The denominator sums over source modifiers; the numerator sums over entries (AD-29).** `sources(S)` is the distinct `sourceModifierId` values in `S`, and `mass(g)` is the weight of that one source row: the common value of `Σ { e.weight : e ∈ g, e.statId == s }` taken over each `statId s` the group publishes. **`mass(g)` carries no `L`.** A source row is one tier and therefore sits in exactly one item-level cohort (AD-29), so a group is admitted by the scope whole or not at all, and the sums have nothing to disagree across — the quantifier is unambiguous and the value exists. Where it does not, `core` never has to choose a reading: a group whose per-`statId` sums disagree is a hard file error and the file was refused before this ratio was evaluated. The two halves count different things because they answer different questions: the denominator is the total weight of the **draw**, and an affix draw selects one *modifier*, so a modifier publishing several stat lines must contribute its weight **once**. The numerator asks how much of that mass carries the stat line the reference names, and every entry carrying it counts. Summing the denominator over entries instead inflates it by each multi-stat modifier's surplus lines, which understates every probability on the base — unevenly, since a base whose pool holds more such modifiers is distorted more, so it **reorders the ranked list** rather than shifting it. For a pool of single-stat modifiers the two readings coincide exactly, which is why the defect survived until a producer met a hybrid row.

  **Numerator and denominator are still drawn from the same scoped set.** Scoping only the denominator — the reading the earlier wording permitted — leaves a numerator counting bands that cannot roll at `L`, which inflates that modifier's probability without touching any other, and so reorders the list. `ModifierRef` itself carries no item level; the scope comes from the *entry's* floor and the *weights band's* `itemLevelMin`, and no third source.

  A tracked reference whose containment set is empty under the scope — every band it covers requires a higher item level than the entry's floor — is a **validation error**, not a `P = 0`. It means the curator is tracking a tier that cannot roll on the item they are crafting, and silently contributing zero would hide that.

  Without this scoping the denominator includes bands that cannot roll on the items the search returns, so every probability on that base is wrong by a factor that varies per base — which *reorders the ranked list* rather than shifting it uniformly. That is why the item-level dimension is required in the weights file (AD-11) and not approximated.

  *Stated assumption:* the crafting act is modelled as occurring on a base at **exactly** the entry's item level floor. The `ilvl >= floor` search returns a superset, so the priced population skews slightly higher-level than the modelled one. This is accepted and recorded rather than corrected — correcting it would need an exact-item-level filter the trade API does not offer.

  `P(combination)` treats prefix and suffix as **independent draws**: `P(prefix) × P(suffix)`, with `P = 1` for an absent affix.

  **A base whose pool is not `complete` is not ranked — and its probabilities are stamped.** Partial coverage shrinks the denominator and inflates every probability for that base by `1/coverage` — it *reorders the list*, and a provenance label does not change a sort. `core` therefore excludes such bases from the ordering entirely and returns them in a separate unrankable group with the reason. **Both halves apply:** the base leaves the ordering, *and* every probability derived from a `partial` pool carries provenance `absent` (AD-10), because it is an upper bound rather than an estimate — so the unrankable group renders those figures as unknowns instead of as numbers that merely failed to sort. `absent` arises here and nowhere else. A base absent from the weights file is likewise unrankable; `core` has no other pool source and must not invent one.

  *Stated assumption:* independence holds because a transmute rolls one affix and an augment adds the other, so under an even slot choice the ordering term cancels exactly. Mod-group exclusion makes the second draw weakly conditional on the first; that refinement is deferred, not overlooked.

  **Recipe has no distribution term in v1.** AD-17 ranks per `(base, recipe)`, but the mechanics numbers do not exist (see Open Questions), so `CraftRecipe` contributes **only a cost offset** and the distribution transform is identity. Ordering is therefore recipe-invariant in v1 and differs only by the subtracted cost. This is a stated limitation, not a formula with an empty slot for `core` to fill by invention.

---

### AD-26 — Refresh rotation is a defined, deterministic order

- **Binds:** `sync`, `contracts`, `web`
- **Prevents:** two builders implementing "which entries does this chunk refresh?" differently — one round-robin, one oldest-first — which would silently change how stale any given row is while every artifact stayed schema-valid. AD-23 already depends on the word *rotation*; before this AD, nothing defined it.
- **Rule:** Within a chunk (AD-7), `sync` selects entries in exactly this order, and stops when any bound in AD-7 is reached:

  0. **currency rates first**, always, before any priced entry in the same chunk — AD-20 requires it, and a rotation that omitted it would produce a chunk of `not-yet-synced` entries by construction;
  1. then every `pinned` entry, each chunk — this is what `pinned` means, subject to the cap below. **Within the pinned set, order by oldest `lastAttemptedAt` first**, the same key row 2 uses. Under the cap a chunk normally reaches all of them and the order is immaterial; it becomes load-bearing exactly when a chunk cannot, and then it is what makes the pinned tail rotate instead of starving permanently behind a fixed key order. A builder ordering pinned entries by the canonical key would diverge here without violating anything else in this AD, which is why the key is named rather than left to the tie-break;
  2. then `active` entries by **oldest `lastAttemptedAt` first** (AD-9), with an entry **carrying no `lastAttemptedAt` at all** treated as infinitely old so a new entry is picked up before any refresh. **The key is the field's absence, not the `not-yet-synced` price state**, which AD-9 has decoupled from it: AD-20 writes `not-yet-synced` for an entry whose currency had no rate, and that entry *was* attempted and carries a fresh timestamp. Sorting it as infinitely old would re-select it every chunk and let it monopolise the rotation permanently — the same starvation this row's ordering exists to prevent, reached through the price state instead of through the observation time. Ordering on `lastAttemptedAt` rather than on the observation time is what keeps a permanently `no-listings` entry in the rotation without letting it monopolise it;
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

---

### AD-28 — Multi-number modifiers decompose over the value axis, not the tier axis

- **Binds:** `contracts`, `core`, `sync`, weights producers
- **Prevents:** a contract no producer can satisfy — a modifier rolling two numbers has no tier-to-value mapping, so tier bands overlap in value space and every rule for collapsing them yields a file AD-18's straddle rule must refuse — and, were the rule merely relaxed, a numerator summing tier weight the trade filter never selected.
- **Rule:** For a modifier whose text carries more than one `#` — *"Adds # to # Lightning Damage"* — the game rolls two numbers and the trade filter compares one derived value. **The value axis therefore does not partition the tier axis:** one value interval genuinely draws spawn weight from several tiers, and no collapsing rule separates them.

  *Measured by the producer 2026-09-13:* 53 of 63 item classes carry such modifiers, up to 36% of a weapon class's pool; every candidate rule (average, first number, second number, sum, span) leaves 170–1,250 overlapping tier pairs, most of them strict rather than edge-touching. Bows, *"Adds # to # Lightning Damage"*, by average: T7 (ilvl 60) runs 43.0–56.5 while T8 (ilvl 65) opens at 56.0.

  **The band's unit is measured, never chosen.** A band is expressed in whatever quantity the trade stat filter compares and in no other, because AD-16 passes its edges into that filter and this rule counts the population that comes back. Which quantity that is, is one empirical fact about the trade API — not a modelling decision with five defensible answers. **This clause binds `sync`**, not only the producer: `sync` is what puts a cell edge into a stat filter, so it emits the edge as the file declares it — it may not round a half-integer to reach an integer filter, which would silently price a different population than the one AD-18 weighed. If the filter turns out to reject non-integer edges (Open Questions), that is a failure to surface, not one to paper over at the adapter.

  **A band is a value cell, and a cell may hold mass from several tiers.** Per `(baseTypeId, slot, statId)` family the producer:

  1. cuts the value axis at **every** tier endpoint in the family, giving one partition into cells — computed **once over all tiers, never per item level**. Two adjacent tiers that merely touch at one lattice point still share it, so that point is its own one-point cell; cut uniformly rather than merging the narrow overlaps. This is what makes **straddling** floor-invariant: a reference whose edges sit on this partition's boundaries straddles no cell at any item level, so AD-18's straddle check cannot pass for one tracked entry and fail for the next, and a per-cohort partition would lose that. It does **not** make AD-18's *edge-alignment* check floor-invariant, and is not meant to — that check is floor-dependent by design (AD-18);
  2. groups the family's tiers into cohorts by `itemLevelMin`;
  3. emits, for each **(tier `t`, cell `c`)** carrying weight, one entry with `c`'s edges, `t`'s own `itemLevelMin`, `t`'s own `sourceModifierId`, and

     ```
     weight(t, c) = w(t) × P(value ∈ c | t)
     ```

     **Emission is per tier, not per cohort, because a tier is a source row and an entry names exactly one (AD-29).** Two tiers of one family may share a cohort, and a per-cohort entry would then have to name two source rows or discard one — the first is unrepresentable and the second destroys a co-occurrence marker AD-29 requires. Per-tier emission also makes conservation directly checkable at the level the split happens.

     A cohort's total is then `Σ { w(t) : t ∈ tiers(ℓ) }`, where **`tiers(ℓ)` is the tiers whose `itemLevelMin` *equals* `ℓ`** — never `≤ ℓ`. Every tier belongs to exactly one cohort, and the cohorts partition the family. Read as `≤`, the same tier is counted into every cohort above it, which triangular-double-counts the whole family *and still satisfies a per-cohort conservation check*, so nothing downstream catches it. This is why the equality is written rather than left to the reader.

     A cell tier `t` cannot reach is **not emitted**. That is a different thing from `weight: 0`, which means *this modifier cannot roll on this base* and is required for a `complete` pool — a missing cell says nothing about pool membership, because the family is present in the cohorts that do reach it.

  **Mass conservation is the invariant; the split estimator is not.** For every tier, `Σ over cells of its split == w(t)` exactly. Any conserving split leaves the base's denominator and every reference's total exact and errs only in how mass distributes *within* a family. The recommended estimator is the two numbers as independent uniform integers over their per-tier ranges, counted over the value lattice; a producer unable to defend that for a family may split otherwise, and carries `provenance: "modelled-split"` (AD-10). A producer that **measures** the cell masses directly rather than modelling them carries `measured` — the provenance names how the mass was distributed, not that a decomposition happened.

  **Conservation is checkable, and therefore checked.** A rule `core` cannot verify is an aspiration, and this one guards the denominator of every affected base. The file therefore carries, per decomposed family, the **pre-split cohort total** — the plain sum of that cohort's tier weights, which the producer holds before it splits anything — and `core` validates that the cohort's emitted cells sum to it. Derived by an independent path from the cells themselves, it catches the failure that actually happens (a dropped, duplicated or misattributed cell) even though it cannot catch a subtly wrong conditional distribution. What remains unverifiable is the *shape* of the split, and `modelled-split` is precisely the label for that residue.

  **Non-overlap is restated, not dropped.** Bands sharing a `statId`, an `itemLevelMin` **and** a `sourceModifierId` within a `(base, slot)` must not overlap. Bands sharing a `statId` at **different** `itemLevelMin` may cover the same interval, and so may bands under **different** `sourceModifierId`s at the same one — two distinct game modifiers can publish the same stat over the same values, and AD-29 keeps their mass separable. The partition itself is still cut once per `(base, slot, statId)` across every tier of every modifier publishing it, because edge-alignment is a property of the stat the trade filter asks for, not of the modifier behind it. Under this decomposition AD-18's straddle rule holds by construction for any cell-aligned reference, which is what non-overlap was only ever a proxy for.

  **A tier can no longer be isolated, and that is correct.** A reference spanning a tier boundary necessarily includes the neighbouring tier's tail. The trade search cannot isolate it either, so the priced population and the weighted population remain the same population — the only property AD-16 and AD-18 jointly require. `tierLabel` on such a cell names a mixture and stays display-only (AD-5).

  **But a curator should track the interior cell, not the span — and this is what the boundary cells are for.** AD-16 prices a reference from the **cheapest 10** listings it matches, so a reference spanning a boundary cell is priced at the cheap tail of the neighbouring tier while carrying the whole span's probability mass. Below AD-17's threshold that summand does not merely understate, it **truncates to zero and takes the good tier's mass with it** — BQ-1's failure mode, re-entered through a heterogeneous band rather than a floor. The partition already supplies the remedy: the interior cell (`[57,78.5]` rather than `[56,80]`, in the worked example) is a reference whose population is one tier and whose price is that tier's. The boundary mass is then untracked, which costs nothing — AD-17 sums over a partition of tracked outcomes and has never required the tracked set to be exhaustive. Curate to interiors by default; span a boundary only where the two tiers' prices are known to be close.

  **Two producer obligations here are unverifiable, and are named rather than implied.** `core` holds no tier data, so it cannot check that the partition was cut at the *real* tier endpoints, nor that a split's conditional distribution is right. A producer emitting one coarse cell per cohort satisfies every mechanical check while forcing every curator into a full-span reference — BQ-1 through a coarse cell instead of a sentinel value. Two things blunt it: the cohort-carriage bound below, which refuses the degenerate case outright; and the fact that the failure is **loud at curation time**, since edge-alignment rejects the band the curator wanted and leaves only the full span. What remains is trust in the producer, of the same kind and no more than the trust already placed in every weight in the file.

  **A cell may be carried by at most two cohorts, counted per `(base, slot, statId)`.** Only adjacent tiers overlap, so a correct partition yields cells belonging to one tier or to exactly two. A third is a hard file error. The key is the **`statId` family across every source modifier publishing it**, and deliberately *not* narrowed by `sourceModifierId` the way non-overlap is: a source row is one tier and so has exactly one cohort, so a per-row count is `1` by construction and the check could never fire. The two keys differ because the two rules do different work — non-overlap keeps two modifiers' mass separable, this bound detects a partition cut too coarsely, and only the family-wide count can see that. This is what makes the coarse-partition case detectable: a producer emitting one wide cell per cohort has that interval carried by every cohort in the family. *Stated assumption:* no three tiers of one family overlap at a value. If real game data ever does, that is an amendment to this AD, not a workaround in a producer.

  **The value lattice may be finer than the integers.** Under an averaged unit it is half-integers. Closed cells tile such a lattice without gaps, and producers emit edges **on** it; a curator's reference does the same.

*[extract note] on the brief's "`Binds` list and the cohort/tier emission rule":* AD-28's `Binds` is `contracts`, `core`, `sync`, weights producers — `sync` is the revision-5 addition, and the clause that constrains it is the band-unit clause ("**This clause binds `sync`**…"). The cohort/tier emission rule is step 3 plus the `tiers(ℓ)` equality clause, both quoted above.

---

## 2. The three changed Consistency Conventions rows (verbatim)

| Concern | Convention |
| --- | --- |
| Ids | `statId` and `baseTypeId` are the trade API's own identifiers, never re-encoded — `baseTypeId` is the `type` string exactly as `data/items` spells it (e.g. `"Guardian Bow"`). Internal ids are forbidden (AD-5), and every id is validated against the committed catalogue (AD-25). **`sourceModifierId` is the one exception and is not a counter-example**: it is producer-owned, opaque to the app, scoped to one `(baseTypeId, slot)`, and never validated against the catalogue — the trade API has no concept of the thing it names (AD-29). It appears only on weights-file entries. It never appears on a `ModifierRef`, a `TrackedEntry` or its canonical key, and no component may treat it as a modifier identity. |
| Bands | A modifier reference is `banded` — `(statId, valueMin, valueMax)` with **inclusive, always-present** edges — or `valueless` — `(statId)` with no edges (AD-5). Bands sharing a `statId`, an `itemLevelMin` **and** a `sourceModifierId` never intersect; sharing a `statId` at a different `itemLevelMin` (AD-28) or under a different `sourceModifierId` (AD-29) they may cover the same interval. Edges sit on the value lattice the trade filter compares against, which may be finer than the integers. |
| Numeric precision | **Band edges are `number`, never `integer`** — the lattice the trade filter compares on may be finer than the integers (half-integers under an averaged unit, AD-28), and which it is, is a producer-side fact the schema must not pre-empt. Fixing this now is what lets `contracts` land ahead of the Open Question on the filter's unit. Edges are compared for **exact equality** by AD-18's alignment and containment rules, so a producer emits values that are exact on the lattice and never a rounded approximation of one. Every persisted divine value — a `PriceObservation` and a `CurrencyRate` alike — is a number rounded to **4 decimal places** at the point of normalisation; weights are non-negative numbers used only in ratios. Rounding happens once, in `sync`; `core` never re-rounds, so two readers of one artifact cannot disagree on a value.<br><br>**Four decimals are what let this one rule bind the cost side as well as the payout side.** 0.0001 divine is far finer than any payout threshold, so no item price rounds to zero — but the binding constraint is the other end: a crafting currency is worth a small fraction of a divine, which is the whole reason AD-20 normalises rather than compares raw. On a coarser grid a cheap orb rounds toward `0.0000`, AD-17's `craftCost` term collapses, and its subtraction becomes a silent no-op that inflates every `EV` in the product. A single precision for both sides is only safe because it is fine enough for the cheaper one; a coarsening would have to exempt `CurrencyRate` explicitly rather than inherit the rule. |

*[extract note] on the brief's "`CurrencyRate` exemption":* the spine does **not** exempt `CurrencyRate` from the 4-decimal rule. It does the opposite — `CurrencyRate` is explicitly **bound by** the same rule ("a `PriceObservation` and a `CurrencyRate` alike"), and the word *exempt* appears only in the counterfactual: "a coarsening **would have to** exempt `CurrencyRate` explicitly rather than inherit the rule."

*[extract note] on the "non-overlap key":* the Bands row's key is `(statId, itemLevelMin, sourceModifierId)` — stated in prose above and matched by AD-28's "Non-overlap is restated, not dropped" clause.

---

## 3. The new Deferred item (verbatim)

- **Pricing a deliberate conjunction of co-occurring stats.** AD-29 records which stat lines share a source modifier, but a `TrackedEntry` still carries at most one `ModifierRef` per slot, so a curator cannot express *"I want both lines of this modifier"* as one outcome — AD-17 rejects the two-entry spelling as an overlap, which is correct, since one item satisfies both. The data to support it exists from day one: the conjunction's probability is the one source modifier's weight, not a product, and its price is one search on both stat filters. Deferred because it widens `ModifierRef` from a field to a set and touches AD-5, AD-16, AD-17 and AD-18 at once, for a gain nothing has yet asked for. **Revisit if** a curator finds a hybrid whose two lines are individually unremarkable and jointly a chase.

---

## 4. The revision notes / banners as they now read

*[extract note]* The spine carries four banners (revisions 5, 4, 3, 2), all in one blockquote at the top. Revisions 5, 4 and 3 are reproduced verbatim below; revision 2's is included for completeness of the block.

> **Revision 5.** Absorbs the five items PRD revision 4 raised back against this spine, three smaller drifts alongside them, and a second defect the weights-file **producer** raised against the contract. **AD-9** stops contradicting itself: `lastAttemptedAt` is *declared* in all four states but *present* only where a request was issued, and a never-synced entry carries none rather than a placeholder that would both lie on screen and sort wrongly in AD-26's rotation. **AD-6** settles the uncatalogued-id disagreement in its own favour — the check stays `sync`'s and report-only, and the contract's hard-error row goes, because `core` cannot evaluate a check whose catalogue AD-24 withholds from `web` (PRD OQ-14). **AD-16** fixes the even-sample median as the **lower** of the two middle values (PRD FR-21). Persisted price precision **stays at 4 decimal places** and PRD FR-23 moves to match: the player reconsidered the 2-decimal call on being shown that one precision has to serve the cost side too, where a crafting currency worth a fraction of a divine would round toward zero and silently collapse AD-17's `craftCost` term (PRD OQ-13). **AD-17** splits the cross-kind `statId` rejection by what each component can see — `contracts` within a file, `core` between files — and **AD-28**'s `Binds` gains `sync`, which its band-unit clause was already constraining. **AD-29** is new: a poe2db row may publish several trade stats under one spawn weight, so every weights entry carries a `sourceModifierId`, each exploded line keeps the full weight, and **AD-18**'s denominator sums over source modifiers rather than entries — with a co-occurrence branch added to **AD-17**'s overlap predicate, since two references naming two lines of one modifier are satisfied by a single item. **AD-5** records that a reference names a stat line, not a game modifier, and **AD-26** re-keys its "infinitely old" rotation slot on an absent `lastAttemptedAt` rather than on the `not-yet-synced` price state, which AD-9 had just decoupled from it. Weights contract raised to **4.0.0** (breaking) and to `status: final`. Both earlier revision notes are corrected below; they under-reported what they amended (PRD OQ-15).
>
> Outside the AD set, revision 5 also changes three **Consistency Conventions** rows — the *Bands* non-overlap key, the *Ids* row's carve-out for `sourceModifierId`, and *Numeric precision*, which keeps its 4 decimal places but now says plainly that the figure binds `CurrencyRate` as well as `PriceObservation`, and why that is only safe at this precision — and adds one **Deferred** item, *pricing a deliberate conjunction of co-occurring stats*.
>
> AD ids are stable; **AD-5, AD-6, AD-9, AD-11, AD-16, AD-17, AD-18, AD-26 and AD-28 are amended in place, and AD-29 is added.**
>
> **Revision 4.** Absorbs a defect the weights-file **producer** raised against the contract: a modifier rolling two numbers cannot produce non-overlapping value bands, and 53 of 63 item classes carry one. The contract had conflated the value axis with the tier axis — true for single-number modifiers, false in general — and non-overlap turned out to be a proxy for AD-18's straddle rule rather than an invariant of its own. **AD-28** is new and decomposes such families over the value axis, with mass conservation as the invariant and the split estimator left to the producer. **AD-5** makes `ModifierRef` a discriminated union so a modifier that rolls no number has a home other than a sentinel band; **AD-10** gains a fourth provenance, `modelled-split`, for weight that is measured but distributed by a model. AD-11, AD-16 and AD-18 are amended to match; **AD-17** gains `slotOverlap`'s `valueless` branch and **AD-27** its coverage re-measurement clause. Weights contract raised to **3.0.0** (breaking). AD ids are stable; AD-5, AD-10, AD-11, AD-16, AD-17, AD-18 and AD-27 are amended in place and AD-28 is added. *(Corrected in revision 5: this note originally omitted AD-17 and AD-27, both of which carry amended text — PRD OQ-15.)*
>
> **Revision 3.** Absorbs the four items PRD revision 2 raised back against this spine — places where two decisions did not compose. **AD-26** re-denominates the `pinned` cap against a chunk rather than against AD-12's full-refresh ceiling (the two never composed into a writable inequality) and adds the runtime half no load-time validator can supply, and it corrects the `unresolvable` retry bound's rationale, which rested on a cost AD-6's offline detection had already removed (PRD OQ-8, OQ-9). **AD-27** narrows its coverage denominator to bases that actually need a pool, since a raw-base-only base can never be `complete` and was depressing a fraction that binds a layout decision (PRD OQ-10). **AD-11** and **AD-18** drop the residual `valueMax?` spellings that contradicted AD-5 (PRD OQ-11). Four more were amended by the revision's own reviewer gate: **AD-9** gains `lastAttemptedAt`'s stamping rule, **AD-12** states that `pinned` spends per chunk rather than per refresh, **AD-21** stops listing `web` as a reader of `currencies.json`, and **AD-24** names that file among those `web` does not fetch and closes the set at eight. AD ids are stable; AD-9, AD-11, AD-12, AD-18, AD-19, AD-21, AD-24, AD-26 and AD-27 are amended in place and no AD is added. *(Corrected in revision 5: this note originally named only AD-11, AD-18, AD-19, AD-26 and AD-27 — PRD OQ-15.)*
>
> **Revision 2.** Absorbs the three blocking questions PRD §10 raised against the inherited valuation model — BQ-1 (a floor-spanning probability priced at its lowest tier), BQ-2 (an eligible pool with no item-level dimension), BQ-3 (unmeasured pool coverage) — together with the `itemLevelMin` amendment PRD §9 OQ-1 routed here under AD-22. It also removes RePoE as a data dependency: the trade API's own catalogue endpoints (AD-25) supply identity and validation, and the weights file supplies everything else. AD ids are stable; AD-5, AD-6, AD-8, AD-11, AD-12, AD-16, AD-17, AD-18, AD-21 and AD-24 are amended in place, and AD-25 to AD-27 are new.

---

## 5. Every `sourceModifierId` site in the spine

*[extract note]* Complete list from a grep of the whole file. Sites already quoted in full above are cross-referenced rather than re-quoted; sites outside §§1–4 are quoted with their sentence.

| Line | Where | Text |
| --- | --- | --- |
| 25 | Revision 5 banner | "…so every weights entry carries a `sourceModifierId`, each exploded line keeps the full weight, and **AD-18**'s denominator sums over source modifiers rather than entries…" — full banner in §4 |
| 27 | Revision 5 banner, 2nd para | "…the *Ids* row's carve-out for `sourceModifierId`…" — §4 |
| 116 | AD-5 | "It does **not** identify the thing the game draws — that is `sourceModifierId`, which lives on the weights file and never on a reference, because a curator can only ever filter on what trade exposes." — §1 AD-5 |
| 195 | AD-11 | the two entry tuples `(sourceModifierId, statId, valueMin, valueMax, itemLevelMin, weight)` / `(sourceModifierId, statId, itemLevelMin, weight)` — §1 AD-11 |
| 297 | AD-17 (`coOccur`) | "`coOccur(x, y)` holds when some `sourceModifierId` in the pool scoped to **this base's own crafted floor `L`**…" — §1 AD-17 |
| 355 | AD-18 | "`sources(S)` is the distinct `sourceModifierId` values in `S`, and `mass(g)` is the weight of that one source row…" — §1 AD-18 |
| 529 | AD-28 step 3 | "emits, for each **(tier `t`, cell `c`)** carrying weight, one entry with `c`'s edges, `t`'s own `itemLevelMin`, `t`'s own `sourceModifierId`" — §1 AD-28 |
| 545 | AD-28 non-overlap | "Bands sharing a `statId`, an `itemLevelMin` **and** a `sourceModifierId` within a `(base, slot)` must not overlap… and so may bands under **different** `sourceModifierId`s at the same one" — §1 AD-28 |
| 553 | AD-28 cohort-carriage bound | "The key is the **`statId` family across every source modifier publishing it**, and deliberately *not* narrowed by `sourceModifierId` the way non-overlap is…" — §1 AD-28 |
| 565 | AD-29 | "Every entry — hybrid or not — carries a required **`sourceModifierId`**, a producer-assigned string stable within one `(baseTypeId, slot)`." — §1 AD-29 |
| 567 | AD-29 | "**A `sourceModifierId` names one source row — one *tier* of one modifier — and not a modifier family.** … a family's several tiers carry **different** `sourceModifierId`s" — §1 AD-29 |
| 571 | AD-29 | "AD-18's denominator sums over distinct `sourceModifierId` rather than over entries, counting each modifier's mass once. `mass(g, L)` is the common per-`statId` sum of `g`'s scoped entry weights." — §1 AD-29 |
| 573 | AD-29 | "Within one `sourceModifierId` — which is one cohort by construction — the emitted weights grouped by `statId` must sum to the **same** value…" — §1 AD-29 |
| 575 | AD-29 | "Two stats sharing a `sourceModifierId` always roll together…" — §1 AD-29 |
| 577 | AD-29 | "So non-overlap is scoped by `sourceModifierId` as well as by `itemLevelMin` (AD-28)…" — §1 AD-29 |
| 588 | Consistency Conventions — *Ids* | full row quoted in §2 |
| 589 | Consistency Conventions — *Bands* | full row quoted in §2 |

Two further sites use the phrase **"source modifier"** without the field name, and are the only mentions outside the ADs and the conventions table:

- **Structural Seed → Core entities** (line 702, prose under the ER diagram): "A `ModifierWeight` is a value **cell** within an item-level cohort, not a tier (AD-28), and names the source modifier it was exploded from — several cells on different `statId`s may share one (AD-29)."
- **Deferred → Pricing a deliberate conjunction** (line 764): "AD-29 records which stat lines share a source modifier… the conjunction's probability is the one source modifier's weight, not a product" — full item in §3.
- AD-29 line 579 also uses it: "**A source modifier's lines may span kinds and need not share a shape.**" — §1 AD-29.

**Where the spine is silent:** `sourceModifierId` appears **nowhere** in AD-1–AD-4, AD-6–AD-10, AD-12–AD-16, AD-19–AD-27, the *Entity keys* convention row, the Stack, the Brief Scope → Architecture Map, or the Open Questions. In particular the *Entity keys* row's canonical key `(baseTypeId, itemLevelMin, prefixBand, suffixBand)` does not mention it — the exclusion is stated instead in the *Ids* row ("It never appears on a `ModifierRef`, a `TrackedEntry` or its canonical key").

---

## 6. Every `coOccur` site in the spine, verbatim

`coOccur` occurs on five lines, all inside AD-17 except the last, which is inside AD-29. All are reproduced in §1 in context; collected here in full:

**AD-17, line 291 — inside the predicate block:**

```
slotOverlap(x, y) =  true              if x is absent or y is absent
                     true              if x.statId != y.statId ∧ coOccur(x, y)
                     false             if x.statId != y.statId
                     true              if both are valueless
                     bands intersect   otherwise
```

**AD-17, line 297 (definition paragraph, two occurrences):**

> **`coOccur` is what stops one game modifier being counted as two outcomes (AD-29).** A source modifier may publish several stat lines that always roll together, and two references naming two of them are both satisfied by a single item — so `x.statId != y.statId` is not on its own evidence of disjointness. `coOccur(x, y)` holds when some `sourceModifierId` in the pool scoped to **this base's own crafted floor `L`** (AD-18 — the same `L` that scopes every probability on the base, and AD-17 gives a base exactly one) emits an entry contained by `x` **and** an entry contained by `y` in the same item-level cohort: one modifier that can satisfy both references at once.

**AD-17, line 299 (unevaluable-pool paragraph, two occurrences):**

> **Where the pool cannot answer, `coOccur` is `false` and the tracked list still loads.** A base absent from `weights.json`, or one whose pool is `partial`, has no reading of this branch — and the safe behaviour is *not* to refuse. AD-18 has already excluded such a base from the ordering entirely, so the partition `coOccur` protects is never summed for it and a missed double-count cannot reorder anything. Refusing instead would take the whole site down over a base that was never going to rank, which is the failure AD-6 and AD-26 both decline elsewhere. Two builders would otherwise split here — one short-circuiting to `false` and rendering, one treating the check as unevaluable and rejecting `tracked.json` site-wide — so the reading is named rather than left to judgement. The base's unrankability is reported as it already would be; nothing new is surfaced. Without this branch the predicate short-circuits to `false`, the partition check passes, and that base's `ΣP` exceeds 1 — the same failure the prefix-only/suffix-only case below produces, reached from the other direction. It is a **cross-file** test: co-occurrence is a fact of `weights.json` and the references are in `tracked.json`, so like the straddle rule it is evaluated in `core` at load and reported against the tracked entry, never against either file alone.

**AD-17, line 301 (cross-kind rejection paragraph):**

> It goes where every other cross-file rule goes — AD-18's straddle and edge-alignment checks, and `coOccur` above — for the same reason AD-6 gives: a check belongs to the component that holds both sides of it.

**AD-29, line 575:**

> `core` uses it today for AD-17's `coOccur` branch, which is not optional: two tracked entries in one slot naming two lines of one modifier are **both satisfied by a single item**, so without it that base's `ΣP` exceeds 1 and it takes the top of the ranking. Pricing a deliberate conjunction is Deferred; recording the fact is not, because it is cheap now and impossible later.

**Where the spine is silent:** `coOccur` appears in **no other AD**, in no Consistency Conventions row, and in no Open Question. The related phrases "co-occurrence" / "co-occurring" appear additionally in the revision-5 banner (lines 25, 27), in AD-28's per-tier-emission clause ("destroys a co-occurrence marker AD-29 requires", line 535), in AD-29 lines 575/577, and in the Deferred item (line 764). The spine gives **no** definition of `coOccur` for the `valueless` case beyond the predicate's branch order, and states no complexity, memoisation or caching requirement for evaluating it.
