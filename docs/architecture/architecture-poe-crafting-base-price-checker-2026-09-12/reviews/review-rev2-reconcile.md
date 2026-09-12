---
title: 'Fidelity Reconciliation — Architecture Spine Revision 2'
status: final
type: coverage-check
created: 2026-09-12
target:
  - docs/architecture/architecture-poe-crafting-base-price-checker-2026-09-12/ARCHITECTURE-SPINE.md (revision 2)
  - docs/architecture/architecture-poe-crafting-base-price-checker-2026-09-12/WEIGHTS-FILE-SCHEMA.md (schemaVersion 2.0.0)
  - docs/architecture/architecture-poe-crafting-base-price-checker-2026-09-12/AGENT-WORKFLOW.md
inputs:
  - docs/prds/prd-poe-crafting-base-price-checker-2026-09-12/prd.md (§10 BQ-1/2/3, itemLevelMin amendment)
  - docs/prds/prd-poe-crafting-base-price-checker-2026-09-12/addendum.md
  - docs/prds/prd-poe-crafting-base-price-checker-2026-09-12/reconcile-architecture.md (§7 A-1, A-2, A-4, A-12)
---

# Fidelity Reconciliation — Spine Revision 2

This is a **coverage check**, not a quality review. Part 1 asks whether the revised spine absorbed what it was asked to absorb. Part 2 asks what the spine now contradicts in the PRD and its addendum — the spine was revised after the PRD was written, so the PRD is stale in places, and that list is the input to a follow-up PRD edit.

**Headline verdict: full absorption. All eight items are ABSORBED, none partial, none missing.** The spine did not merely accept the PRD's proposed amendments — in two places (BQ-2, BQ-3) it adopted the *more expensive and more correct* of the options the PRD offered, and in one place (A-1/A-2) it added a validation rule the PRD only asked to have specified. The cost of that thoroughness is that the PRD is now materially stale: **21 contradictions** are recorded in Part 2, two of them high severity.

A numbering note before the detail: the task references "PRD §9 / OQ-1" and `reconcile-architecture.md` cites FR-14/FR-19/FR-24/FR-26 and §9 Open Questions. The current `prd.md` has been renumbered — Open Questions are §10 (BQ-1…BQ-3, OQ-4…OQ-7), §9 is Risks, and the item-level FR is FR-22. Mappings below use the **current** PRD numbering, with the reconcile doc's old numbers noted where it matters.

---

## Part 1 — Absorption

### BQ-1 — A floor-spanning probability multiplied by a lowest-tier price → **ABSORBED**

The PRD proposed making `ModifierRef` a bounded band `(statId, valueMin, valueMax?)`. The spine took that and propagated it through all four affected ADs plus the budget AD.

**AD-5** carries the identity change and the rationale verbatim in substance:

> "A modifier reference is `(statId, valueMin, valueMax?)` — a stat id plus an **inclusive, bounded band** over the rolled value. `valueMax` is omitted only for the topmost band of that `statId`. The trade API has no tier concept; a 'tier' exists only as a band."

and, under *Why a band, not a floor*:

> "Under a floor, a reference at the T2 edge covers T1 and T2 together, so AD-18 summed both tiers' weight while AD-16 — sorting ascending — priced essentially T2. The jackpot was not understated but *deleted*: if the T2 price fell below the payout threshold, the whole entry truncated to zero and took its T1 probability mass with it, destroying the jackpot isolation that threshold-truncated EV exists to provide."

That is the addendum's *BQ-1 — The population mismatch* argument, including its "deleted, not understated" framing and its link back to why threshold-truncated EV was chosen.

The three knock-on halves all landed:

- **AD-16** (search): the stat-filter row now reads "one per modifier reference, carrying **both `min` and `max`** from the band (AD-5)", with the reason stated — *"Passing the band's `max` as well as its `min` is what makes the priced population the same population AD-18 computes a probability for; a min-only filter returns every higher tier too and prices the band at its floor."*
- **AD-18** (aggregation): *"its weight is the **sum of the weights of every weights-file band with that `statId` that lies wholly inside it** — `band.valueMin >= ref.valueMin` and `band.valueMax <= ref.valueMax`"*. Both edges, where the PRD's FR-29 still has only the lower one.
- **AD-17** (partition): rule 1 explicitly unblocks the workaround the addendum said AD-17 forbade — *"Under AD-5's bands, adjacent tiers are disjoint and may both be tracked — which is the point of the band amendment. Bands that *intersect* still overlap and are still rejected."*

The addendum's stated cost was also absorbed rather than dropped. **AD-12**: *"Since AD-5 makes bands the unit of identity, isolating a jackpot tier means tracking two entries where one stood, and **that second band spends from the same ceiling**."* That is the addendum's closing paragraph on BQ-1 turned into a budget rule.

`WEIGHTS-FILE-SCHEMA.md` records the same change in its 2.0.0 table: *"Bands are the **unit of identity**, not floors … The file already modelled bands this way; `ModifierRef` has now caught up to it."*

### BQ-2 — The Eligible Pool has no item-level dimension → **ABSORBED** (and the harder of the two options was taken)

The PRD offered two amendments and said *"The first is correct; the second is cheaper"*; the addendum recommended *"Option 2 is the pragmatic v1 move and option 1 is the right end state."* **The spine implemented option 1 as the v1 rule, and also imposed option 2's uniformity constraint** — both, not either.

Option 1, **AD-18**:

> "**The pool is scoped by item level before it is summed.** The eligible pool for a tracked entry is `{ band ∈ pool(base, slot) : band.itemLevelMin <= entry.itemLevelMin }`. `P(modifier | base, slot, itemLevel)` is the reference's summed weight divided by the **total weight of that scoped pool** — the denominator is the whole scoped pool, never the tracked subset. A tracked band whose own `itemLevelMin` exceeds its entry's floor is a validation error: it cannot roll at the level being searched."

with the PRD's own reason for why approximation is not acceptable: *"every probability on that base is wrong by a factor that varies per base — which *reorders the ranked list* rather than shifting it uniformly."*

Option 2, **AD-17 rule 3**: differing `itemLevelMin` across entries on one `baseTypeId` is a validation error; *"A base therefore has exactly one item level floor, and the tracked list is validated for it."*

The file-side half landed too. **AD-11**: *"raw game spawn weights, banded by rolled value and by item level … `(statId, valueMin, valueMax?, itemLevelMin, weight)`."* `WEIGHTS-FILE-SCHEMA.md` bumps to **2.0.0, breaking**, makes `itemLevelMin` **required** on every band, adds it to the duplicate key and the hard-error list, and resolves the ambiguity `reconcile-architecture.md` §4.5 consequence 3 raised (*complete at what item level?*):

> "**Completeness does not depend on item level.** Enumerate the whole slot once. A band that only rolls at ilvl 82 belongs in a `complete` pool with `itemLevelMin: 82`; `core` scopes it out for an entry floored below that."

The residual approximation is stated rather than hidden — AD-18's *"the crafting act is modelled as occurring on a base at **exactly** the entry's item level floor … the priced population skews slightly higher-level than the modelled one"* — and carried into Deferred as *Per-band conditional item level*.

### BQ-3 — Unmeasured pool coverage → **ABSORBED** (promoted to a binding gate)

**AD-27** is new and carries the PRD's decision rule with its thresholds intact:

| Coverage | Spine consequence | PRD BQ-3 |
| --- | --- | --- |
| ≥ 80% | "Proceed as specified." | "proceed as specified" |
| 50–80% | "the unrankable group is a **first-class surface** in `web`, not a footer" | "make FR-4's Unrankable group a first-class surface rather than a footer" |
| < 50% | "The ranking premise fails. Escalate rather than ship… Do not resolve this inside `core`." | "v1's ranking premise fails and the uniform-prior approach must be replaced" |

Ownership and sequencing landed as well: AD-27's *"The first build task is to generate the weights file and count the fraction of endgame base types resolving to `complete` pools"*, `AGENT-WORKFLOW.md` Build order item 2 (*"Measure pool coverage before any view work (AD-27) … Committing a layout before this number exists is committing to an assumption about how much of the product there is"*), and the schema's *"Coverage is measured, not assumed."*

The spine also closes it as a spine Open Question: *"~~Uniform-prior pool completeness~~ — promoted from an open question to a binding gate with thresholds and consequences (AD-27), and made source-agnostic so it survives the removal of RePoE."*

One deliberate deviation, flagged here because it drives Part 2: BQ-3 framed the measurement as being about *"a RePoE→stat-id mapping of unknown coverage."* AD-27 is explicitly **source-agnostic** — *"it binds whatever produces the weights file, and survives a change of producer untouched"* — because revision 2 removed RePoE as a data dependency. The gate is absorbed; its stated *subject* is not, and the PRD's RePoE framing is now stale (contradictions C-9, C-10, C-11).

### The `itemLevelMin` contracts amendment (PRD §10 OQ-1 as posed / FR-22 as it now stands) → **ABSORBED**

Four separate obligations, all met:

1. **The field exists on the entity.** AD-5: *"A tracked entry is `(baseTypeId, itemLevelMin, prefix?, suffix?)`."*
2. **Declared, never inferred.** AD-5: *"**`itemLevelMin` is declared, never inferred.** It is authored by hand as part of curation; neither `sync` nor `core` derives or adjusts it. Choosing the accepted tier and choosing the band are one authoring act, and the item level that choice implies is recorded next to it."* That is the addendum's *"Why this belongs in curation rather than in code"* paragraph, transposed from floors to bands.
3. **It lands as a `contracts` change, alone and first.** AD-22 lists `TrackedEntry`; `AGENT-WORKFLOW.md` Build order item 1: *"Revision 2 changes `ModifierRef` to a band and adds `itemLevelMin` to `TrackedEntry` (AD-5). That is a contract change, so it lands on its own and everything else rebases onto it."* This is the AD-22 + serialisation route the reconcile doc §4.1 asked for.
4. **It reaches the search.** AD-16's filter table: `type_filters.ilvl` → *"`min` = the entry's `itemLevelMin` (AD-5)"*, replacing AD-16 rev-1's undefined "endgame item level".

The spine also closed the originating Open Question the way the PRD argued it should be closed: *"~~Endgame item-level floor~~ — the premise of a single global floor was the error. Resolved into a per-entry declared `itemLevelMin` (AD-5), uniform per base (AD-17), scoping the eligible pool (AD-18)."* That is the addendum's opening sentence — *"It turns out the premise of a single global floor was the error, not the number"* — adopted verbatim in substance.

A Consistency Conventions row backs it: *"`itemLevelMin` is a declared floor, uniform across a base's tracked entries (AD-17) and present on every weights band (AD-11). Never inferred, never adjusted by code."*

### A-1 — `itemLevelMin` vs AD-18's item-level-blind pool; partition breaks across mixed floors → **ABSORBED**

Both halves of A-1 landed, in the two places they belong.

The denominator half is AD-18's scoping rule quoted under BQ-2 above. The partition half is **AD-17 rule 3**, which carries the reconcile doc's §4.5 consequence 2 argument as an independent second reason:

> "Rule 3 has a second, independent reason to hold: `EV` is an expectation over **one crafting act on one item population**. Entries at different floors describe crafts on differently-levelled bases, and their `P` terms are normalised against differently-scoped pools (AD-18). Summing them is not an expectation over anything."

A-1's recommendation was *"raise this against the spine as an AD-18 amendment alongside the AD-5/AD-22 one, not as a schema field addition alone."* That is exactly what happened: AD-18 amended, AD-17 amended, AD-11 amended, schema majored to 2.0.0.

### A-2 — FR-14's (now FR-16's) overlap enumeration no longer exhaustive → **ABSORBED**

The reconcile doc required the spine/PRD to say whether `itemLevelMin` participates in overlap detection, offering options (a) identity axis, (b) uniform per `(base, prefix, suffix)`, (c) uniform per Base Type, and argued for (c). **The spine chose (c)**, as AD-17's third numbered validation rule:

> "3. **Differing `itemLevelMin` across entries on one `baseTypeId`.** This is the case AD-5's fourth field introduced and the first two rules do not catch: two entries with identical affixes at floors 75 and 82 are *nested, not disjoint*, since every ilvl-82 item also matches the ilvl-75 search."

The worked counterexample is the reconcile doc's own (75 vs 82, same affixes, nested not disjoint). Option (a) — `itemLevelMin` as a ranking key — is not silently dropped: it is recorded under **Deferred**, *"`itemLevelMin` as a ranking key"*, with the reason it was rejected for v1 (row multiplication, AD-12 search ceiling) and a stated revisit trigger. That is a stronger disposition than A-2 asked for.

### A-4 — `partial` pool → provenance `absent`, upper-bound framing → **ABSORBED**

A-4 was that the PRD carried AD-18's exclusion half and dropped the schema's provenance half, leaving `absent` unreachable. **AD-18** now states both halves in one paragraph and names the unreachability problem explicitly:

> "**Both halves apply:** the base leaves the ordering, *and* every probability derived from a `partial` pool carries provenance `absent` (AD-10), because it is an upper bound rather than an estimate — so the unrankable group renders those figures as unknowns instead of as numbers that merely failed to sort. **`absent` arises here and nowhere else.**"

The schema says the same from the producer side (*"a lower bound on the denominator, so the probabilities are upper bounds … excludes the base from the ranked ordering (AD-18), returning it in the unrankable group where the view renders it as an unknown (AD-10)"*), and its Validation section splits hard errors from *"Degraded but loadable"* accordingly.

Note the PRD independently closed its side of A-4 in the current revision: FR-28's consumer-side bullet now reads *"`core` assigns such probabilities Provenance `absent` and the Base Type is Unrankable (FR-4) — this is the only path by which `absent` arises."* A-3 (the producer enumeration obligation) also landed in the PRD as FR-28's producer-side bullet, though A-3 was not in scope for this check.

### A-12 — "Rotation" used but never defined → **ABSORBED**

**AD-26** is new and defines the selection policy end to end — pinned every chunk; `active` by oldest `PriceObservation` first with `not-yet-synced` treated as infinitely old; `unresolvable` on a bounded retry schedule of at most one retry per entry per day; never `pruned`. It closes the loop the reconcile doc identified (AD-23 depended on the word *rotation* with nothing defining it) and adds the determinism property:

> "The order is a pure function of the tracked list, the dataset and a passed-in clock value — `sync` computes it through `core`, so it is testable with literal inputs and identical between a dry run and a real one."

`AGENT-WORKFLOW.md` carries it in two places: the Determinism bullet (*"AD-26 fixes the rotation order … so a dry run and a real run select identically"*) and the `sync` row of the package table (*"rotation order comes from `core`, not from `sync` (AD-26)"*). AD-26 is bound into AD-7's chunk bounds and AD-23's `pinned`/`pruned` semantics rather than sitting beside them.

### Absorption summary

| Item | Verdict | Primary landing site |
| --- | --- | --- |
| BQ-1 | **ABSORBED** | AD-5 (identity + rationale), AD-16 (min+max filter), AD-17 rule 1, AD-18 (both-edge containment), AD-12 (budget cost) |
| BQ-2 | **ABSORBED** | AD-18 (scoped pool), AD-17 rule 3, AD-11, `WEIGHTS-FILE-SCHEMA.md` 2.0.0 |
| BQ-3 | **ABSORBED** | AD-27 (new), AGENT-WORKFLOW build order 2, schema *Coverage is measured* |
| `itemLevelMin` amendment | **ABSORBED** | AD-5 (4th field, declared-never-inferred), AD-16 (`type_filters.ilvl`), AD-22, AGENT-WORKFLOW build order 1 |
| A-1 | **ABSORBED** | AD-18 scoping + AD-17 rule 3's second reason |
| A-2 | **ABSORBED** | AD-17 rule 3 (option (c)); option (a) preserved under Deferred |
| A-4 | **ABSORBED** | AD-18 *"Both halves apply"*; schema *Degraded but loadable* |
| A-12 | **ABSORBED** | AD-26 (new) + AGENT-WORKFLOW determinism |

---

## Part 2 — What the revised spine now contradicts in the PRD

Exhaustive. Ordered by severity within four groups. Each row names the PRD location and the spine location so the follow-up edit can work straight down the list.

### Group 1 — High: the PRD would produce a load-rejected artifact or a wrong search

**C-1 — Raw Bases pinned to ilvl 82 collide with AD-17's uniform-floor rule.**
*PRD:* FR-3 fourth consequence (*"A Raw Base's search uses `normal` rarity (AD-16) and item level 82"*) and FR-22 fifth consequence (*"Raw Bases are pinned to item level 82 (FR-3)"*); §7.1 *"Raw Bases at item level 82"*; Glossary *Raw Base* (*"an uncrafted white base at item level 82"*).
*Spine:* AD-17 validation rule 3 — *"**Differing `itemLevelMin` across entries on one `baseTypeId`.**… A base therefore has exactly one item level floor, and the tracked list is validated for it."*
*Conflict:* a Base Type carrying both a Raw Base entry at 82 and crafted entries at a lower Accepted-Tier floor (the addendum's bow at 75 is the canonical case) is now **rejected at load**. The PRD requires precisely that configuration. This is not merely stale wording — as written, the two documents cannot both be satisfied for any base where the two branches disagree. It needs a decision, not an edit: either AD-17 rule 3 gains a raw-base exemption (raw bases are never summands per AD-17's *Raw bases rank on a separate branch*, so the partition argument does not apply to them), or FR-3/FR-22 must drop the fixed 82.

**C-2 — FR-29 still specifies floor-spanning, item-level-blind aggregation.**
*PRD:* FR-29 title (*"Aggregate weights by floor within a scoped pool"*) and first two consequences — *"A Modifier Reference is a **floor spanning tiers**: its weight is the sum of every Weights File band … whose `valueMin >=` the reference's floor"*; *"`P(modifier | base, slot)` is that summed weight over the **total weight of the complete Eligible Pool** for that same `(Base Type, slot)`."*
*Spine:* AD-18 — bands must lie *wholly inside* the reference (`valueMin >=` **and** `valueMax <=`), and the denominator is the **item-level-scoped** pool, not the whole `(base, slot)` pool. `P` is now written `P(modifier | base, slot, itemLevel)`.
*Conflict:* an implementer following FR-29 builds exactly the defect BQ-1 and BQ-2 described. The FR title's "within a scoped pool" gestures at scoping the body never performs. Both consequences must be rewritten.

**C-3 — FR-21's stat filters carry only value floors.**
*PRD:* FR-21 first consequence — *"the entry's Modifier References as stat filters at their value floors"*.
*Spine:* AD-16 filter table — *"one per modifier reference, carrying **both `min` and `max`** from the band (AD-5)"*, with the explicit warning that *"a min-only filter returns every higher tier too and prices the band at its floor."*
*Conflict:* the PRD specifies the min-only search the spine names as the bug.

**C-4 — FR-16's overlap rule forbids what AD-17 now requires to be legal.**
*PRD:* FR-16 first consequence — *"The same `statId` in the same slot at nested value floors is a validation error"*.
*Spine:* AD-17 rule 1 — *"Under AD-5's bands, adjacent tiers are disjoint and may both be tracked — which is the point of the band amendment. Bands that *intersect* still overlap and are still rejected."*
*Conflict:* under bands, "nested value floors" is not the test; intersection is. FR-16 as written would reject the T1/T2 pair that BQ-1's whole amendment exists to enable. (FR-16's second and third consequences — mixed item-level floors, named offending entries — are now correct and match AD-17 rules 3 and the rejected-at-load clause.)

**C-5 — FR-14 asserts "no third" request source; AD-12 declares three.**
*PRD:* FR-14 second consequence — *"**Two non-workload requests are permitted and enumerated**: the leagues-endpoint validation of FR-32, and exchange-rate acquisition for `data/currencies.json` (FR-23). **No third exists.**"*
*Spine:* AD-12 — *"The **catalogue refresh (AD-25) is a third declared source** — four requests, on an explicit command at patch cadence, never on the chunk path."* AD-8 routes catalogue refreshes through the same governed client; AD-25 makes the four data endpoints a standing cost.
*Conflict:* direct. Also note FR-14 counts exchange-rate acquisition as *non*-workload while AD-12/AD-20 make `data/currencies.json` one of the two workload files — a second, smaller mismatch in the same bullet.

**C-6 — FR-24's detection mechanism routes the catalogue through the sync run.**
*PRD:* FR-24 third consequence — *"Detection is by validating the entry's `statId` against the trade API's stats catalogue, **refreshed as part of the non-workload requests of FR-14**"*, plus the matching §11 assumption.
*Spine:* AD-6 — *"Every `statId` and `baseTypeId` … is checked against the **committed catalogue** (AD-25) before any request is issued."* AD-25 — *"The refresh is an **explicit command at GGG patch cadence**, never part of a chunk (AD-7) and never on a view path."* `AGENT-WORKFLOW.md` — `pnpm catalogue:refresh` is human-invoked.
*Conflict:* the PRD makes the catalogue a per-run fetch; the spine makes it a committed artifact refreshed by hand. Also, the §11 assumption *"AD-6 specifies the outcome but names no detection mechanism"* is now false — AD-6 names one.

### Group 2 — Moderate: stale identity, stale status, stale budget denomination

**C-7 — Glossary *Modifier Reference* is still a floor.**
*PRD:* §3 — *"a trade API `statId` paired with an inclusive numeric **value floor** … *BQ-1 proposes extending this to a bounded band.*"*
*Spine:* AD-5 and the Consistency Conventions *Bands* row — the band is the identity, not a proposal.

**C-8 — Glossary *Accepted Tier* and *Eligible Pool* carry rev-1 definitions.**
*PRD:* §3 *Accepted Tier* — *"Expressed mechanically as the Modifier Reference's value floor."* §3 *Eligible Pool* — *"the complete set of modifiers that can roll in one `(Base Type, slot)`… *BQ-2 concerns this definition's missing item-level dimension.*"*
*Spine:* AD-5 (band, not floor); AD-18 (the pool is enumerated per `(base, slot)` at any item level and then **scoped** to the entry's floor before normalising); schema *"Completeness does not depend on item level."*

**C-9 — The PRD's blocking banner and the "not yet buildable" status.**
*PRD:* §0 callout — *"**⚠ This PRD is not yet buildable for `sync` and `core`.**… each needing an architecture amendment before the affected FRs are implementable"*; plus the four *"Depends on BQ-1/BQ-2"* bullets at FR-1, FR-21, FR-22 and FR-29; plus §10's *"Blocks FR-1, FR-21, FR-29"* / *"Blocks FR-1, FR-22, FR-29"* annotations.
*Spine:* revision 2 header — *"Absorbs the three blocking questions PRD §10 raised"*; status `final`, revision 2; spine Open Questions *Closed by revision 2*.
*Conflict:* all three amendments have landed. The banner, the dependency bullets and the block annotations are stale and would stop a build that is now unblocked.

**C-10 — §0 inherits "AD-1 through AD-24".**
*PRD:* §0 — *"its decisions AD-1 through AD-24 are **inherited, not re-decided**"*.
*Spine:* AD-1…**AD-27**; AD-25, AD-26 and AD-27 are new in revision 2 and all three bear on PRD requirements (catalogue, rotation, coverage gate).

**C-11 — The budget is denominated in entries, not searches.**
*PRD:* FR-14 third consequence (*"The tracked list is held to approximately **1,500 entries** against a measured ceiling of ~2,400 searches per day"*); §7.2 (*"Revisit only if the tracked list must exceed ~1,500 **entries**"*); SM-C1 (*"Held at ~1,500"*); §4.6 description (*"roughly fifteen hours … about 62% of the daily search budget"*).
*Spine:* AD-12 — *"**The ceiling is denominated in searches, not entries.**… One tracked entry costs one search — so entry count equals search count only while no modifier is split across bands. Since AD-5 makes bands the unit of identity, isolating a jackpot tier means tracking two entries where one stood, and **that second band spends from the same ceiling**."*
*Conflict:* the equivalence the PRD relies on is exactly what BQ-1's amendment broke. The arithmetic (15h, 62%) survives if read as 1,500 *searches*; the noun does not. SM-C1's counter-metric is measuring the wrong quantity as written.

**C-12 — FR-22's per-Base-Type floor "maximum across that Base Type's entries".**
*PRD:* FR-22 sixth consequence — *"The per-Base-Type floor shown to the player is the maximum across that Base Type's entries — a display aggregate only, not licence for mixed floors (FR-16)."*
*Spine:* AD-17 rule 3 — one floor per base, validated. A maximum over a set whose members are required to be identical is vacuous, and the sentence's existence still implies entries on one base may differ. FR-16's own second consequence already says the opposite. This should collapse to "a Base Type has one Item Level Floor."

**C-13 — FR-27's hard-error list is the 1.x list.**
*PRD:* FR-27 fourth consequence — *"duplicate `(statId, valueMin)` within a slot, overlapping value bands, negative weight, missing `poolCoverage`, or a band straddling a floor in use by the tracked list."*
*Spine/schema:* 2.0.0 hard errors are *duplicate `(statId, valueMin, valueMax, itemLevelMin)`*; *`valueMax: null` on any band that is not the topmost for its `statId`*; *missing `itemLevelMin`*; *a `statId` or `bases` key absent from the committed catalogue (AD-25)*; and a band straddling *a band **edge*** in use, not a floor. Three of the new errors are absent from the PRD and one listed key is wrong.

**C-14 — The PRD never requires `itemLevelMin` in the Weights File.**
*PRD:* FR-27 first consequence (*"raw spawn weights per Base Type and affix slot, keyed by Modifier Reference"*), FR-29, FR-30 (uniform-prior file contents), Glossary *Modifier Weight*.
*Spine:* AD-11 — *"`(statId, valueMin, valueMax?, itemLevelMin, weight)`"*; schema 2.0.0 makes it **required** on every band and breaking against 1.x.
*Conflict:* a producer building to the PRD emits a file `core` refuses. FR-30's uniform-prior file in particular would be a 1.x file.

**C-15 — FR-30 treats the uniform-prior file as a script-generated in-repo v1 deliverable.**
*PRD:* FR-30 — *"Generated by a one-off script and committed as data"*, *"Every entry carries `weight: 1`"*, *"Where the underlying catalogue mapping is incomplete, the affected `(Base Type, slot)` is emitted `poolCoverage: "partial"`"*; §7.1 lists *"a uniform-prior file satisfying it"* as in scope; §7.2 *"v1 ranks on the uniform prior"*; FR-11 (*"Because v1 ships only the uniform-prior Weights File (FR-30), **every** probability … carries Provenance `uniform-prior` or `absent`"*).
*Spine:* AD-11 — *"**The file is a prerequisite, not a convenience.**… Until a conforming file exists, every base is unrankable by AD-18 — which is the honest outcome, not a degradation to engineer around. The intended producer is a separate scraper project."* Schema — *"A uniform-prior file is therefore a **weighting shortcut, never a sourcing one**"*; it *"still needs genuine pool membership and `itemLevelMin` per band, which is exactly the part the trade API cannot supply."* Spine Deferred — *"A uniform-prior file remains a valid bootstrap for the weighting, but not for pool membership or item level, which it must still source honestly."*
*Conflict:* the PRD's uniform-prior file is a scriptable artifact; the spine's is a genuinely sourced file with a placeholder weight column. A one-off script cannot produce pool membership or `itemLevelMin`. *(Recorded as a contradiction of degree rather than of kind: the spine's own Brief Scope map still lists "Weights schema + uniform-prior file" under `contracts` + `core`, so the spine is not perfectly self-consistent here either — see S-2.)*

### Group 3 — RePoE: the PRD's data-source premise is gone

**C-16 — BQ-3's RePoE→stat-id mapping premise.**
*PRD:* §10 BQ-3 — *"The v1 file's Eligible Pools come from a RePoE→stat-id mapping of unknown coverage"*; addendum *BQ-3 — The unmeasured gate* — *"the ranked list's size is a direct function of how well the RePoE→stat-id mapping covers the catalogue."*
*Spine:* AD-27 is *"**source-agnostic** — it binds whatever produces the weights file, and survives a change of producer untouched."* AD-11 and Deferred demote RePoE to *"a last-resort fallback only"*; AD-25 makes the trade catalogue the identity authority. The spine header states outright that revision 2 *"removes RePoE as a data dependency."*

**C-17 — OQ-4's "consulted by the curator, not by the app" resolution.**
*PRD:* §10 OQ-4 — *"RePoE's PoE2 export carries modifier `required_level` and is the likely source — consulted by the *curator* while authoring the tracked list, not by the app at runtime."* Addendum *Open follow-on* repeats it.
*Spine:* the data is now a **file field** the app consumes (`itemLevelMin` per band, AD-11 + schema), and the spine's surviving Open Question reassigns it: *"Per-tier item level availability at the producer… Where the scraper project sources it is the producer's problem by AD-11… **Owner: the weights scraper project.**"* OQ-4's own closing note anticipated this (*"BQ-2's first proposed amendment would pull this data into the Weights File, making the two questions one"*) — and that is what happened, so OQ-4 as posed is closed, not open.

**C-18 — The addendum's RePoE-as-reference framing in the item-level derivation.**
*Addendum:* *The Item Level Rule — Derivation*, "Open follow-on" — *"Per-tier item level availability is not in the trade API and is not in the Weights File schema. RePoE's PoE2 export… Confirm before the first list is seeded."*
*Spine:* schema 2.0.0 puts it in the Weights File schema; producer expectations say RePoE is *"a last resort only… the affected entries carry `provenance: "uniform-prior"` rather than `"measured"`."*

### Group 4 — Addendum passages superseded by the spine's chosen resolution

**C-19 — Addendum: a modifier reference is `(statId, valueMin)`, a floor.**
*Addendum:* *The Item Level Rule — Derivation*, "Why this belongs in curation rather than in code" — *"AD-5 gives the trade API no tier concept — a modifier reference is `(statId, valueMin)`, a floor. So 'accept tier 2' … is expressed by setting that entry's `valueMin` to the tier 2 band's floor."*
*Spine:* AD-5 (band). The curation argument survives intact — AD-5 restates it as *"Choosing the accepted tier and choosing the band are one authoring act"* — but the mechanism sentence is wrong.

**C-20 — Addendum: "`TrackedEntry` needs an `itemLevelMin` field it does not have in AD-5's shape."**
*Addendum:* *Consequence for `contracts`*.
*Spine:* AD-5 now has it; the amendment is landed, not pending. The same paragraph's forward-pointer *"its knock-on effect on the probability model is PRD §10 BQ-2"* is likewise closed.

**C-21 — Addendum: tracking T1 and T2 as two entries is "forbidden", and option 2 is the v1 move.**
*Addendum:* BQ-1 analysis — *"The workaround a builder would reach for first — track T1 and T2 as two entries — is forbidden: AD-17 makes nested floors a validation error"*; BQ-2 analysis — *"Option 2 is the pragmatic v1 move and option 1 is the right end state."*
*Spine:* AD-17 rule 1 now permits disjoint adjacent bands as separate entries (that is the amendment's purpose); and the spine adopted **option 1 for v1** — AD-18's scoped pool with `itemLevelMin` on every band — *while also* imposing option 2's per-base uniformity (AD-17 rule 3). Both addendum statements described the state of play before the amendment and read as current.

### Contradiction count: **21** (C-1 … C-21)

Distribution: 6 high (C-1…C-6), 9 moderate (C-7…C-15), 3 RePoE-premise (C-16…C-18), 3 addendum-superseded (C-19…C-21).

---

## Appendix — two spine-side gaps noticed while reconciling

Out of scope for the verdicts above, but the follow-up PRD edit will trip over them, so they are recorded rather than silently reconciled.

**S-1 — AD-12 does not enumerate the leagues-endpoint request.** AD-19 requires that *"`sync` validates the configured league against the live leagues endpoint at the start of each run"*, and PRD FR-32 correctly makes that a per-run request. But AD-12 says its three declared sources are tracked entries, currencies and the catalogue refresh, and that *"Nothing else generates a request."* The leagues call is a fourth. When C-5 is fixed in the PRD, the fix should not be to delete FR-32's request from the enumeration — AD-12 needs the fourth source, or an explicit carve-out.

**S-2 — The spine is ambivalent about who produces the uniform-prior file.** AD-11 and the schema treat every weights file, uniform-prior included, as the external producer's output and a prerequisite; the Brief Scope → Architecture Map still assigns *"Weights schema + uniform-prior file"* to `contracts` + `core`, and AD-27 makes generating it *"the first build task"* of this repo. C-15 cannot be edited cleanly in the PRD until the spine picks one.

**One editorial note carried forward:** `reconcile-architecture.md` cites PRD sections and FR numbers from a superseded revision (§9 Open Questions, FR-14/FR-19/FR-24/FR-26). Anyone re-running that document against the current PRD should remap first.
