---
title: "PRD Addendum: PoE2 Crafting Base Price Checker"
status: final
revision: 7
created: 2026-09-12
updated: 2026-09-20
---

# PRD Addendum

> **Historical record, and the PRD's rationale store.** The analyses from *The Item Level Rule* through *Why the PRD Cites Architecture Decisions* describe weights contracts `2.0.0` to `4.1.0` and architecture spine revisions 2 to 5, as they stood when written. They are superseded by everything from contract `5.0.0` and spine revision 10 onward. Revision 10 withdrew value cells, cohorts and the straddle rule, and merged ten decisions into their neighbours; later revisions moved more of it, up to `prd.md` revision 18's move of the crafted branch to class altitude. A retired AD id inside them is annotated inline with its new home rather than rewritten, because the id names what a past revision decided. The *Closed questions register*, *Revision 13 rationale*, *Revision 17 rationale* and *Revision 18 rationale* sections at the end are current: they hold what `prd.md` stopped carrying at revision 13, when it became a governing document, and again at revisions 17 and 18. Revision 17's section is the one exception — it is the argument for an altitude revision 18 replaced within the day, kept because its losing half is still true.

This addendum captures the reasoning from the PRD run that belongs to a downstream reader — architecture, solution design, or the curation workflow — rather than to the PRD's main narrative. It does **not** repeat `docs/briefs/.../addendum.md`, which already holds the request-budget analysis, the rejected alternatives for combination discovery, the ranking-metric derivation and the data-source notes.

**Which section is for you.** The topics below are dependency-ordered, not ranked by importance:

- *The Item Level Rule* — for the **curator**, and a prerequisite for reading *BQ-2*.
- *Recipe Count* and *Curation Surface* — for whoever builds the view and `core`; both are options-considered records.
- *The Three Blocking Defects* — for the **architect**. Over half the document, and the highest-stakes content.
- *Why the PRD Cites Architecture Decisions* — for any reader wondering why a requirements document states arithmetic.
- *Closed questions register* — for anyone who meets a closed OQ or BQ id cited elsewhere.
- *Revision 13 rationale*, *Revision 17 rationale* and *Revision 18 rationale* — for a builder who arrived from an FR citation and wants the argument behind it. Revision 13 covers the mechanism the PRD stopped restating; revision 17 covers the move of the crafted branch off the Base Type; revision 18 covers its landing on the **Item Class**, which is where it is now.

Each analysis below is a **record of reasoning, not a live proposal**: read the body for the state as it stood when it was written, and the bold **What landed** note that closes it for the current state. Where a later spine or PRD revision moved an analysis again, a further bold note follows and names that revision — one for each such revision, oldest first. *Why the PRD Cites Architecture Decisions* is the exception — standing rationale rather than an analysis, so it carries no landing note.

## The Item Level Rule — Derivation

**The floor is a consequence, not a choice.** The minimum item level is set by the level at which the *tier worth chasing* becomes available for the modifiers being tracked. That varies per modifier and therefore per base.

**The rule, as stated by the user:**

1. Prefer tier 1 of a modifier.
2. **If tier 1 first appears at item level 81 or 82** — a modifier that rare is not worth building a search around — accept tier 2 instead.
3. A Tracked Entry's Item Level Floor is the **highest** accepted-tier item level among its affixes.

*What this replaced:* the brief said "ilvl ≥ ~78", and the architecture spine declined to settle it, recording it as an Open Question on the grounds that the figure changes result quality while costing nothing either way — cheap to get right, and expensive to get wrong quietly. The premise of a single global floor was the error, not the number.

**Worked example (bows):**

| Modifier | T1 available at | T2 available at | Accepted | Contributes floor |
| --- | --- | --- | --- | --- |
| Critical hit chance | item level (ilvl) 73 | — | T1 | 73 |
| Increased physical damage | ilvl 82 | ilvl 75 | **T2** (T1 rejected as extremely rare) | 75 |

A bow entry carrying both modifiers therefore filters at **ilvl ≥ 75** — the figure a player would quote for bows.

**Why this belongs in curation rather than in code.** AD-5 records that the trade API has no tier concept — a modifier reference is a bounded band `(statId, valueMin, valueMax)`. So "accept tier 2 for increased physical damage" is expressed by setting that entry's band to the tier 2 band's edges. Choosing the accepted tier and choosing the band are the *same* authoring decision, made once by hand, and the item level that decision implies is recorded next to it. Neither `core` nor `sync` performs any runtime derivation, so neither has any place to disagree with the curator. AD-5 records this directly, in those terms.

**What landed — the item level floor.** `TrackedEntry` needed an `itemLevelMin` field it did not have in AD-5's original shape. Spine revision 2 absorbed it: AD-5 now defines a tracked entry as `(baseTypeId, itemLevelMin, prefix?, suffix?)` and `AGENT-WORKFLOW.md` sequences the change as `contracts`-first, alone, with everything else rebasing onto it. The knock-on effect on the probability model — the one PRD §10 BQ-2 raised — landed alongside it in AD-18 (retired into AD-17 by spine rev 10) and Weights File schema 2.0.0.

**Consequence for the tier restriction.** The brief's addendum records "tiers 1 and 2" as a budget-motivated proxy for "expensive," and notes its cost: a tier 3 modifier that is valuable this league because of the build meta stays invisible. This rule sharpens that restriction into something checkable per modifier rather than a blanket band, but does not remove the cost — the restriction still governs the default, not the ceiling, and off-tier modifiers are added by exception when the player notices them.

**What landed — the tier restriction.** This follow-on question is closed for the curator and transferred to the producer. Per-tier item level availability is not in the trade API, but it **is** in the Weights File schema as of 2.0.0, where `itemLevelMin` is required on every band. The curator no longer assembles it by hand before seeding a list; it is a field the file carries and `core` consults, and PRD §10 OQ-4 is closed on that basis. What remains is the *producer's* sourcing problem: where the scraper project gets the numbers. The spine carries that as its own open question, and AD-27's coverage gate measures it. RePoE is a last resort there rather than the expected source: it carries modifier metadata but no spawn weights, so it was never the authority for the load-bearing field, and anything it fills is stamped `uniform-prior`, never `measured`.

## Recipe Count for v1 — Options Considered

The brief ranks "a base paired with a crafting recipe", and AD-18 (retired into AD-17 by spine rev 10) then establishes that in v1 a `CraftRecipe` contributes **only a cost offset**: the distribution transform is identity. The mechanics numbers for how perfect versus greater transmute/augment shift the tier distribution do not exist in any input. Three options:

1. **One recipe — perfect transmute + perfect augment. Adopted.** Matches the late-endgame playstyle the brief targets, and follows the brief's reasoning that late-endgame value transfers downward to early play while the reverse does not.
2. **Two recipes, perfect and greater.** Ships the `(base, recipe)` pairing the brief literally describes. Rejected for v1: with an identity distribution transform, a second recipe produces an identically ordered list with a different constant subtracted. That is a cost column presented as an analysis, and it doubles a request budget that AD-12 already holds tight.
3. **Recipes as open data.** `data/recipes.json` holds a list and the view handles N. This holds whichever option is chosen, and is not an alternative to (1) — it is why adopting (1) costs nothing later. v1 commits one entry to that list.

The distribution transform is the thing actually missing, and it is a data problem rather than a design one. When those numbers exist, recipe becomes a real ranking dimension and option (2) becomes worth shipping.

**What landed — option 2, at spine revision 14 (2026-09-19).** The premise under which option 1 was adopted has failed. The distribution transform is no longer missing: the player supplied the mechanic, and the quantity it needs was already in the weights file, so the transform needs no number the inputs lack (AD-17, `IMPLEMENTATION-NOTES.md` §9). Option 2's rejection rested entirely on the identity transform — "an identically ordered list with a different constant subtracted" — and that sentence is now false. Recipe is a real ranking dimension, so two recipes ship and the ranking is read under one at a time. Option 3 held, exactly as predicted: the recipes are data and the count cost nothing to change. The budget objection does not carry over, because ranking happens in the browser over one synced Dataset and a second recipe consumes no additional requests (AD-4, AD-12).

## Curation Surface — Options Considered

AD-15 forbids a write path from the browser and AD-21 (retired into AD-3 by spine rev 10) makes `data/tracked.json` hand-owned, so "prune junk, pin ones to watch" cannot be a UI action. What the view *does* about curation was still open:

1. **Read-only surfacing. Adopted.** The view shows Curation Status, tracked-list age, `no-listings` entries and `unresolvable` entries; editing happens in a text editor, followed by a commit. This is the minimum that makes FR-15's purpose work — the player cannot decide to prune without seeing what is dead.
2. **Copyable JSON snippets per row.** Same surfacing, plus a copy-to-clipboard fragment to paste into `tracked.json`. Rejected for v1 as an authoring convenience for an act performed a handful of times a league, and one that would need to stay in step with the schema to avoid producing invalid entries — a maintenance surface for a rare action.
3. **Minimal — no curation affordances at all.** Rejected: it would leave AD-23 (retired into AD-12 by spine rev 10)'s named risk ("a stale top five that the user trusts is worse than no tool") with nothing prompting review, which is the outcome AD-23 exists to prevent.

**What landed.** Option 1 stands. AD-15 and AD-23 (retired into AD-12 by spine rev 10) were not disturbed by spine revision 2, and AD-21 (retired into AD-3 by spine rev 10) was — but only in its writer table, which left this analysis's premise untouched. Spine revision 2 did add one thing to surface, though: AD-26 (retired into AD-7 by spine rev 10) makes the refresh rotation a defined order, so *how often a row gets re-priced* is now something the view can state rather than imply (PRD FR-17).

## The Three Blocking Defects — Analysis

> **All three were absorbed by spine revision 2; spine revision 4 later narrowed BQ-1's scope, and spine revision 5 moved BQ-1 and BQ-2 again.** This section is kept as a record of the reasoning that produced them, because the argument is not visible in the amended decisions themselves. Each subsection below ends with what landed.

PRD validation surfaced three defects in the **inherited** valuation model (§10 BQ-1, BQ-2, BQ-3). None was created by the PRD, and all three are invisible until the pricing rule (AD-16), the probability rule (AD-18 (retired into AD-17 by spine rev 10)) and the partition rule (AD-17) are read *together* — which a spine organised around one decision per AD does not force a reader to do.

### BQ-1 — The population mismatch

AD-16 and AD-18 (retired into AD-17 by spine rev 10) each define a set of items, and they are not the same set.

- **AD-18 (retired into AD-17 by spine rev 10)'s set:** every item whose modifier value is at or above the reference floor. Its weight is the sum of all bands at or above that floor, so for a reference at the T2 floor this is *T1 items and T2 items together*.
- **AD-16's set:** the cheapest ten instant-buyout listings matching that same filter, sorted ascending. Since lower tiers are more common and cheaper, this is, in practice, *T2 items*.

`EV` multiplies the first set's probability by the second set's price. Worked through on the bow example:

| Quantity | What the model computes | What is true |
| --- | --- | --- |
| `P` | `P(phys T1) + P(phys T2)` | — |
| `price` | ≈ `price(phys T2)` | — |
| Contribution | `[P(T1) + P(T2)] × price(T2)` | `P(T1) × price(T1) + P(T2) × price(T2)` |

Since `price(T1) >> price(T2)`, the model understates the contribution. That alone would be a tolerable approximation. What makes it blocking is the interaction with truncation: if `price(T2)` sits below the Payout Threshold, the **entire entry** — including all of its T1 probability mass — truncates to zero. The jackpot is not understated; it is deleted. And jackpot isolation is the reason threshold-truncated EV was chosen over plain EV in the first place (brief addendum, *Ranking Metric — Derivation*), so the defect destroys the product's founding distinction rather than merely degrading a number.

The workaround a builder would reach for first — track T1 and T2 as two entries — *was* forbidden: under a floor-based identity the two genuinely do overlap, so AD-17 rejected them, correctly. That prohibition made the defect blocking rather than merely annoying, and the amendment lifts it: with bands, adjacent disjoint tiers may both be tracked, which is now the point rather than the error.

**Why a band fixes it.** With `ModifierRef` as `(statId, valueMin, valueMax?)`, T1 and T2 become disjoint populations. AD-17's partition holds with them tracked separately, AD-18 (retired into AD-17 by spine rev 10)'s aggregation sums only the bands inside the tracked band, and AD-16 prices each band against listings that actually belong to it. The Weights File already models bands exactly this way (`valueMin` / `valueMax`, non-overlapping, straddling forbidden), so the schema needs no new concept — only `ModifierRef` needs to catch up to it. The trade API's stat filters accept a min and a max, so the search is expressible.

The cost is request budget: tracking two bands where one entry stood doubles that entry's search cost, against the ~1,500-search ceiling of AD-12. That is a curation trade-off — the player tracks a second band only where the jackpot tier is worth isolating — not an argument against the amendment.

**What landed.** AD-5 adopts the band, and goes further than proposed: `valueMax` is **required, with no open-top form**. The reasoning is that an omitted ceiling is a floor by another name and reintroduces the whole defect. There is a further point this analysis missed: the defect would then be *unvalidatable*, since `sync` validates `tracked.json` but the band edges it would need to check against live in `weights.json`. AD-12 also re-denominated the ceiling from entries to searches, precisely so the cost of a band split is visible to the curator at the moment he makes it — rather than surfacing months later as a refresh cycle that quietly stopped completing.

**Narrowed by spine revision 4.** The claim above that T1 and T2 become disjoint populations holds for a modifier whose text carries **one** `#`. For one carrying more — and modifiers with more than one `#` appear on 53 of 63 item classes — AD-28 (retired into AD-11 by spine rev 10) establishes that the value axis does not partition the tier axis at all, so a tier has no pair of value edges that isolates it, and a reference near a boundary necessarily includes the neighbouring tier's tail. That narrows what this amendment bought rather than reversing it: **the trade search cannot isolate that tier either**, so the priced and weighted populations remain the same population, which is the only property AD-16 and AD-18 (retired into AD-17 by spine rev 10) jointly require. What replaces tier isolation is cell isolation — the curator tracks an interior cell (PRD FR-22).

**Retracted by spine revision 5 — one factual claim above has since gone stale.** This analysis says the Weights File models bands "non-overlapping, straddling forbidden". Neither half still holds as stated. **Non-overlap** is now scoped — two entries may cover the same interval where their `itemLevelMin` differs (spine revision 4, two cohorts' mass in one interval) or where their `sourceModifierId` differs (spine revision 5, two distinct game modifiers publishing one stat over one range). **Straddling** is explicitly **not** a file error: it is a cross-file condition, since the same file straddles nothing against a differently-aligned tracked list, so `core` reports it against the tracked entry at load (PRD FR-27, FR-29). The argument above is unaffected — non-overlap was only ever a proxy for the straddle rule, and the straddle rule is what the band amendment actually needed.

### BQ-2 — The missing dimension

The Eligible Pool is the denominator of every probability, and which modifiers are *in* it depends on item level. FR-22's own worked example establishes this: bow physical-damage T1 cannot roll below ilvl 82. Yet AD-18 (retired into AD-17 by spine rev 10) and the Weights File model one pool per `(baseTypeId, slot)`, flat.

So for an entry searching at ilvl ≥ 75, the denominator includes bands that cannot roll in part of the searched range, and the numerator may include a band that cannot roll at the floor at all. Both are wrong, in the same direction for every entry on the base, which means the error does not cancel in the ranking — it reweights bases against each other according to how far each one's floor sits below the top of its pool.

Two amendments are possible, and they differ in cost, not in kind:

1. **Add `itemLevelMin` to each Weights File band.** `core` scopes the pool to the entry's floor before normalising. Correct, and it folds in PRD §10 OQ-4 — the per-tier availability data the *curator* currently needs by hand becomes data the file carries, consulted by code.
2. **Declare one canonical item level per Base Type** and require every entry on that base to share it. Cheaper, needs no schema change, and reduces the error to whatever variance remains inside a single base. It also aligns neatly with FR-16's prohibition on mixed floors within a base — a prohibition this PRD already imposes for an unrelated reason.

**What landed.** Both, because they fix different defects. This analysis framed them as cheaper-versus-correct and picked one; that framing was wrong. Option 1 fixes the **denominator**: schema 2.0.0 requires `itemLevelMin` on every band, and AD-18 (retired into AD-17 by spine rev 10) scopes the pool by it — scoping *both* halves of the ratio. That closes a reading this analysis did not notice was open, in which only the denominator is scoped and a single modifier's probability inflates without any other modifier's probability moving. Option 2 fixes the **partition**: AD-17 requires the crafted entries on one base to share an item level floor, because EV is an expectation over one crafting act on one item population, and entries at different floors are crafts on differently levelled bases whose `P` terms normalise against differently scoped pools. Neither substitutes for the other. AD-17 additionally exempts raw bases from the uniformity rule, since they are never summands — without that exemption the rule would reject the very configuration the brief asks for, white bases at 82 alongside magic ones well below it.

**Moved again by spine revision 5.** This analysis treats the scoped pool and the denominator as the same object — scope the pool, then sum it. AD-29 (retired into AD-11 by spine rev 10) separates them. A poe2db row may publish several distinct trade stats at once under a single spawn weight, and the producer splits such a row into one entry per stat line, each carrying the row's **full** weight. The scoped pool is therefore the **domain** the denominator is computed over, and the denominator is the sum of distinct **source-modifier** masses within it — each modifier counted once — rather than the sum of its cells (PRD FR-29). This does not disturb anything above: item-level scoping still fixes *which* mass is admitted, exactly as option 1 established. What it adds is a second way the denominator could be wrong that scoping alone never addressed, and it has the same signature as the first — it is uneven across bases, so it **reorders** the list rather than shifting it. It was invisible until a producer met a hybrid row, because for a pool of single-stat modifiers the two readings coincide exactly.

### BQ-3 — The unmeasured gate

Unlike the other two, this is not a modelling error but an unknown that determines whether v1 exists in a useful form. AD-18 (retired into AD-17 by spine rev 10) is deliberately harsh about partial pools — an incomplete denominator inflates every probability for that base by `1/coverage`, which **reorders the list**, and a provenance label does not change a sort, so the base leaves the ordering entirely. That is the right call. The ranked list's size is therefore a direct function of the weights file's pool coverage — and nobody has measured it.

The PRD attaches a decision rule (≥80% proceed / 50–80% proceed with the Unrankable group promoted / <50% the premise fails) so that the question cannot sit open indefinitely while the view is built around an assumption. The measurement is cheap — count the file — and it should be the first task of the build, before any view work commits to a layout that assumes a full list.

**What landed.** AD-27 adopts the thresholds verbatim and pins down two things this analysis left loose. The denominator is **the tracked list**, not the catalogue: the question is how much of what the curator wants ranked can be ranked, and a base nobody tracks cannot affect the product. And the rule is **source-agnostic** — it binds whatever produces the weights file. That matters more than it seemed to at the time, because spine revision 2 removed RePoE as the assumed source. This analysis was framed around a RePoE→stat-id mapping of unknown coverage; identity now comes from the trade catalogue (AD-25) and pools from the file (AD-11), and the gate reads the same either way. The 50–80% band is also no longer just advice: it binds a layout decision in `web`, which is why the PRD carries it in FR-4 rather than only here.

**What landed after the crafted branch moved off the Base Type (`prd.md` revision 17, refined at revision 18).** The bands are **withdrawn**. This analysis assumed a denominator of tracked Base Types — hundreds — against which 80% and 50% divide a large list into meaningfully different products. Once the crafted branch ranks Item Classes, the denominator is the tracked classes: dozens at most, and the game publishes 63 in total. Revision 18's move from the category to the class left the denominator in that same order of magnitude, so it changed nothing here. A fraction over a list that size describes the Weights File's progress rather than how much product exists. FR-4's own withdrawn *~20* note called precisely that condition advisory; the note, and its §11 index entry, went with the bands. The measurement survives unchanged: still sequenced first, still re-measured on every regeneration, because *when* it is taken was never the part that depended on the denominator. What is gone is the threshold and the layout it bound. Coverage is now reported with its denominator and read as a judgement, and the prominence of the Unrankable group is UX's call against the observed figure. The three arguments under *Revision 13 rationale* → *Why the coverage predicates were spelled out* survive too: reproducibility matters more, not less, once a single category moves the fraction by two points.

## Why the PRD Cites Architecture Decisions Instead of Restating Them

The usual PRD discipline is capabilities-not-implementation, with technical choices pushed to an addendum. This PRD deliberately breaks that in a narrow way: the pricing definition (FR-21), the ranking formula (FR-1), the four price states (FR-9), the weight aggregation rule (FR-29) and the currency denomination (FR-23) are stated as requirements with their arithmetic intact.

The justification is the brief's own framing — *"This section is the product; everything else is presentation."* These are not implementation details that happen to be decided; they are the behaviour the player is buying, and they are the places where two independently built components could satisfy a looser requirement in mutually incompatible ways. Each is cited to its AD so the rationale lives in one place and the PRD does not become a second, drifting source of truth for it.

Everything genuinely implementation-shaped — the package split, the port-and-adapter structure, the stack, the source tree, the deployment path — stays in the spine and is referenced by an NFR only where it is a hard requirement the brief itself imposed.

## Closed questions register

`prd.md` §10 carried these until revision 13. Each was raised against the spine, or by the spine against a companion, and each is closed: the cited decision is the copy to build to. Ids are never reused.

- **OQ-4** — Where Accepted Tier item levels come from. `itemLevelMin` became a required Weights File field owned by the producer. Transferred to the weights scraper project.
- **OQ-5** — Recipe distribution mechanics. The mechanic is a game-side floor the orb imposes on modifier level, and the weights file already carries the matching per-tier quantity, so the eligible pool truncates and renormalises with no new input. Closed by spine rev 14 and promoted into v1: ranking is no longer recipe-invariant and v1 ships two recipes (AD-17, `IMPLEMENTATION-NOTES.md` §9).
- **OQ-8** — The `pinned` cap re-denominated against a Chunk rather than a full refresh, and enforced at load and at runtime. Retired by spine rev 3/4 (AD-7, `IMPLEMENTATION-NOTES.md` §6).
- **OQ-9** — The `unresolvable` retry bound's rationale replaced: detection is offline and free, the bound only paces a residual pricing-only retry. Retired by spine rev 3/4 (AD-7).
- **OQ-10** — The coverage denominator narrowed to Base Types that need a pool; numerator predicate fixed. Retired by spine rev 3/4 (AD-27, `IMPLEMENTATION-NOTES.md` §3).
- **OQ-11** — Residual optional-ceiling spellings removed after AD-5 required a ceiling everywhere. Retired by spine rev 3/4.
- **OQ-13** — Persisted price precision stays at 4 decimal places, the spine's figure, because the cheapest persisted value pins the grid. Retired by spine rev 5, against this PRD (AD-20, `IMPLEMENTATION-NOTES.md` §4.2).
- **OQ-14** — An uncatalogued id is `sync`-side and report-only, never a `core` file refusal, because `core` has no catalogue. Retired by spine rev 5 (AD-9).
- **OQ-15** — The spine's own per-revision amendment lists corrected. Retired by spine rev 5. Overtaken by rev 10's id retirements.
- **OQ-16** — The source-modifier mass function's two spellings reconciled, backed by a one-cohort hard error. Retired by spine rev 6; the machinery it concerned was withdrawn by contract `5.0.0`.
- **OQ-17** — `sync` runs `core`'s cross-file validation as a run-start gate, not only `web` at load. Retired by spine rev 7 (AD-12, AD-17).
- **OQ-18** — `coOccur` and kind agreement joined the same run-start gate. Retired by spine rev 8 (AD-17).
- **BQ-1, BQ-2, BQ-3** — The three defects in the inherited valuation model that PRD revision 1's validation found: a floor-spanning probability priced at its cheapest tier, a pool with no item-level dimension, and unmeasured pool coverage. Absorbed by spine rev 2 into AD-5, AD-17 and AD-27. The analyses above under *The Three Blocking Defects* are their record.

## Revision 13 rationale

PRD revision 13 cut every mechanism sentence and cited the architecture instead. This section keeps the *why* behind requirements whose argument no longer fits a governing document. Each entry names the FR and the decision or companion section that now binds the mechanism.

**Read this section against revision 18.** It was written before the crafted branch moved off the Base Type, so where an entry states a crafted-branch rule in terms of a *Base Type* — pool completeness, the shared item-level floor, the Provenance badge's scope, the coverage denominator — the unit is now the **Item Class**. `prd.md` has already made that change, and the argument is unaffected by the noun. Two arguments below also speak of the coverage gate as live. It is not: revision 17 withdrew the bands, for the reasons recorded against *BQ-3* above. What survives is the case for spelling the predicates out, which the withdrawal strengthens rather than weakens.

### Valuation and ranking (FR-1, FR-4, FR-16, FR-29)

- **The partition premise.** The EV sum is only meaningful if the summands are mutually exclusive. The partition breaks two ways: intersecting bands, and two Modifier References on different stat ids that are two Stat Lines of one game modifier, so one item satisfies both. An enumerated list of overlap shapes missed a case twice, which is why overlap is a predicate (AD-17; `IMPLEMENTATION-NOTES.md` §2.1, §2.2). Double-counting inflates the sum by the overlap's measure even below `ΣP = 1`, enough to move a high-priced base several places.
- **Why the coverage predicates were spelled out.** Two people who have never spoken must reproduce a fraction that binds a layout decision. "Both slots complete" is vacuously true of a base absent from the file, and a complete declaration over an empty pool passes a naive reading; either gap lets one Tracked List score 100% or 40% across a gate that turns at 80% and 50%. The denominator counts only bases that need a pool, because a Raw-Base-only base can never resolve to complete and would give the Unrankable group prominence on the strength of bases that were never unrankable (`IMPLEMENTATION-NOTES.md` §3).
- **Why the measurement recurs and is sequenced first.** A patch introduces modifiers the producer's source publishes unnamed; the producer drops them and pools fall to `partial`. A product at 85% before launch can sit at 60% a week later with nothing reporting the drop. A layout committed before the number exists is a commitment to an assumption about how much product there is (AD-27).
- **Whole-tier containment, and the bound that was withdrawn.** Pro-rating a partly covered tier would re-site the producer's withdrawn decomposition inside the browser where nobody can diff it; whole-tier inclusion would over-count. Containment understates unevenly and therefore reorders. Revision 10 claimed the ascending sort and edge alignment bounded the damage; revision 11 withdrew that, and revision 12 added the floor-intrusion shape, where the sort prices the band on the intruding cheaper tier and the tracked mass truncates out below the threshold. Both shapes are now AD-11's and spine OQ-21's.
- **Why an empty containment set is an error and not zero.** A missing base is visible in the Unrankable group; an unrollable band is a silently empty summand in a list that looks healthy. The error names both possible causes because `core` cannot tell a curator's bad tier from a producer's dropped line (`IMPLEMENTATION-NOTES.md` §2.5).
- **Why `sync` gates at run start.** If the cross-file check were `web`'s alone, `sync` would price a bad band on Monday and `core` would refuse it on Tuesday with the budget spent and the observation committed. The gate prevents a wasted refresh, not a wrong number (AD-12, AD-17).
- **Why the straddle rule and band non-overlap withdrew.** With value cells gone, no closed band contains one tier without clipping its neighbour on 53 of 63 item classes; retaining them would reject every crafted configuration (AD-11, AD-17).

### The Weights File (FR-27, FR-28, FR-30)

- **Two halves of completeness.** A producer reading only the tier half could drop the second line of each multi-stat row and believe it declared complete honestly. A dropped line shrinks a numerator without touching the denominator, the one direction the plain-sum denominator does not protect (`WEIGHTS-FILE-SCHEMA.md`, completeness rule).
- **The trust surface after `5.0.0`.** The `4.x` contract had a declared line count behind a dropped line and declared totals behind a dropped row; `5.0.0` withdrew both. A dropped row inflates every probability on the base; a dropped line where a second publisher shares the stat id deflates one numerator silently. Nothing mechanical stands behind either, and FR-28 states that trust rather than implies it (AD-11).
- **No anonymous-weight field.** A per-slot scalar entering the denominator but never a numerator would let a producer hide any share of the pool behind an uncheckable number. Rejected; listed in the spine's *Deferred*.
- **`partial` is an upper bound.** A partial pool is a lower bound on the denominator, so every probability from it is an upper bound, hence Provenance `absent` and Unrankable rather than a number (AD-10, AD-17).
- **Why accept the external dependency.** A locally generated file cannot honestly source pool membership or item-level availability, the two fields nothing can fake. The former `producer.id: "uniform-prior"` naming convention was PRD-only and is dropped.
- **Why FR-28 states the producer's obligation at all.** `WEIGHTS-FILE-SCHEMA.md` is the external producer's contract, and FR-28 restates the completeness obligation as a product requirement so the external project has a requirement to build to rather than a footnote. The argument lives here rather than in the PRD: a sentence inside an FR that argues for restating a companion's contract reads as a standing licence to restate any of them, which is the re-inflation mechanism the altitude rule exists to close.

### Curation and the Tracked List (FR-14, FR-15, FR-17, FR-18, FR-22)

- **The budget arithmetic.** About 1,500 searches per full refresh at a sustained ~100 an hour is ~15 hours, roughly 62% of the ~2,400 searches a day the measured rate limit allows. Both figures follow from AD-12 and `IMPLEMENTATION-NOTES.md` §5.3 and change if either does.
- **Why oldest-first.** It is self-levelling and needs no scheduler. Naming the ordering key on the `pinned` row matters exactly when a Chunk cannot reach every pinned entry, because it makes the pinned tail rotate instead of starving behind a fixed order. The 24-hour bound on `unresolvable` retries keeps a patched-out modifier from either disappearing or monopolising (AD-7).
- **Why the tracked-list date comes from git.** A hand-maintained field becomes stale exactly when the date matters; it is the kind of memorised number the tool exists to abolish (AD-12).
- **The Accepted Tier rule, worked.** Bows: critical hit chance T1 at item level 73; increased physical damage T1 only at 82, rejected as too rare, so T2 at 75. The entry floors at 75; two entries on the base deriving 73 and 75 both declare 75, so FR-16's shared-floor rule is satisfiable by hand. The label costs one hand-written field per affix and buys a row that reads as the comparison the player makes (`T1 Cold Res · T1 Mana`, not value spreads). Raising a lower entry to the base floor widens its scoped pool; two floors per base is a spine deferral. The heuristic and derivation are curation-owned and a candidate for a curation guide.
- **Why the label is never derived, joined or keyed.** Derivation would be wrong the moment a curator accepts a run of tiers; a join against the file has no single tier identity for a run; and a key including the label would orphan an entry's price history on a relabel (AD-5).

### Pricing and sync (FR-21, FR-23, FR-24, FR-25, FR-31)

- **Why ascending and instant-buyout.** Ascending keeps stale overpriced listings out of the sample; instant-buyout removes below-market listings a buyer would already have bought. This half is the PRD's; AD-16 carries the estimate rule.
- **Stamping rule corrected.** Revision 12 said the attempt timestamp, search id and search league are stamped together or not at all. AD-9 stamps the attempt alone on a 429, 5xx or timeout, so the search id may be older, harmlessly, because the link test is league not age. The PRD copy had drifted and was cut.
- **Why the Sync Report carries starvation and not-reached separately.** Without both, a shortfall is at least four different numbers; the declared yardstick beside the observed allowance turns a symptom into a diagnosis. Starvation is a curation defect the player must correct; not-reached is a normal rotation outcome (AD-7, `IMPLEMENTATION-NOTES.md` §6).
- **Untested path.** The league change as config edit plus natural re-sync follows from AD-19 but has not been exercised against a real reset; the first reset is the test.

### The view (FR-6, FR-7, FR-9, FR-10, FR-11, FR-12, FR-13, FR-33)

- **Number input, not slider.** The continuous sweep in which the list visibly reorders was traded for exactness and masthead width (UX memlog 36/37). FR-6 keeps the rule, re-rank on valid parse.
- **"View preferences" narrowed.** UX read the phrase as the threshold alone, since every other view state is a reading position, not a setting. Accepted.
- **The reason enum.** One Price State covering three unrelated causes would defeat the point of distinguishing states. No architecture decision requires the enum; it is the PRD's.
- **Provenance display.** The file's per-tier source marker is never printed, because its word `absent` beside Provenance `absent` would read as one fact twice or as a contradiction. Revision 10 expected the badge to discriminate within a Base Type; because propagation covers every input of the figure, it discriminates between ranked rows, and a builder on the old reading would ship a badge varying row by row inside one expansion, which is why the restatement was explicit (AD-10).
- **The 48-hour cut-off.** Chosen against the ~15-hour partial refresh cycle so normal rotation never marks a row; a mark then means something is wrong, the same argument FR-11 makes. A never-synced row has no attempt timestamp because only an issued request stamps one, and a placeholder would both lie on screen and mis-sort the rotation (AD-9).
- **Artifact delivery.** The artifact set, the catalogue's role, the currency-as-text decision, the fetch-versus-navigation boundary and the stale-identifier analysis are all AD-24's and AD-25's. The "a shell that can only render should render" ruling for a cross-file policy failure is AD-17's as of spine rev 12.

## Revision 17 rationale — the crafted branch ranks Item Categories

> **Superseded within the day by revision 18**, which moved the ranked unit one level finer, from the Item Category to the Item Class. Read this section as the argument that was live at revision 17; where it says *category*, `prd.md` now says **Item Class**. The reasoning that survives the move is marked below, and *Revision 18 rationale* holds what replaced the rest.

`prd.md` revision 17 moved the crafted branch's ranked unit from the Base Type to the Item Category, following the architect's OQ-23 handover of 2026-09-20 and the player's confirmation that modifier combinations are curated and checked per category, never per named base. The noun changes are mechanical; the three judgements below are not, and each belongs here rather than in a governing document.

### Why the payout term is allowed to be a category average

FR-1 states the property; the mechanism behind it is that a category search prices the cheapest listings across every base in the category, so a Guardian Bow and a Shortbow carrying the same affixes land in one sample.

It was put to the player on 2026-09-20 and accepted deliberately: the player crafts on whatever the category gives them, so the category is the decision the number is for, and a per-base payout would answer a question the player cannot act on. The cost is recorded as a consequence of FR-1 rather than as a risk in §9, because §9 holds threats the product has not closed, and this is a property the product chose.

Two related facts are worth keeping beside that decision. It compounds with R-1 and pushes in the same direction: both make the displayed figure an artefact of what is listed rather than of what is achievable. Unlike R-1, it has an identified, deliberately unspent remedy — tracking a category's strong bases as separate raw entries already prices them honestly on the other branch.

### Why FR-4's coverage bands were withdrawn rather than re-fitted

Recorded in full against *BQ-3 — The unmeasured gate* above, which is the analysis that produced them. In short: the bands divided a denominator of hundreds, the denominator is now dozens, and a threshold over dozens measures the scraper rather than the product. Re-fitting them to a smaller denominator was considered and rejected: any number set now would be set against an unmeasured list, which is the defect BQ-3 was written to prevent. The honest version of that judgement is a published fraction with its denominator, plus a human reading it. What was given up is explicit — FR-4 no longer instructs anyone to escalate at any coverage figure, and no band now binds `web`'s layout.

### Why `"base absent from weights file"` became `"category absent from weights file"` rather than disappearing

The handover takes the absent-base lookup to stop happening once entries name categories. The enum kept two members anyway. *The producer declared a pool it could not guarantee* and *the producer published nothing for this category at all* are different failures. FR-9's whole argument is that one state covering unrelated causes defeats the point of having states. If the architecture genuinely cannot distinguish the two once pools are keyed per category, the string is dead and the enum collapses to one member — that is a question for the spine revision closing OQ-23, and it is raised in `reply-oq23-class-altitude.md` rather than settled here.

*The argument holds at revision 18 with the noun moved: the second string is now `"class absent from weights file"`, and the question put to the spine is unchanged.*

## Revision 18 rationale — the crafted branch ranks Item Classes

`prd.md` revision 18 moved the crafted branch's ranked unit one level finer, from the Item Category to the Item Class, on the player's call of 2026-09-20 — hours after revision 17 landed the category. The reversal does not correct revision 17's reasoning. It defeats it with a different argument, and the two arguments are worth keeping side by side, because the losing one is still true.

### Why the class beat the category

Revision 17 chose *Item Category* on a **vocabulary** argument: `className` is the weights producer's word and `categoryId` is the trade site's, so a PRD noun spelled *class* would name one half of a pair while meaning the other. The player overruled it on a **product** argument, which outranks vocabulary in a document that owns what the player gets: expected value varies sharply between the classes inside one category, so a blended category row lets a low-value class drag a high-value one down and conceals both. A row that averages two classes the player treats differently is not a ranking of anything he decides about.

The vocabulary problem is real and survives the reversal. It is a naming problem for two documents to settle between them — the PRD names the player-facing unit, the spine keys it — and not a reason to rank the wrong thing. It is handed to the spine in `reply-rev18-class-altitude.md`.

### Why per-class pricing turned out to cost nothing

The objection that defeated class altitude the first time was budget. Pricing a class *looked* as though it needed one search per Base Type in the class, because the trade site does not accept a class name as a filter — and that is OQ-25's third candidate, which spends exactly the budget that moving up to the category had just saved.

The player established on 2026-09-20 that the premise is wrong. A class **is** separable on the existing search, by its defence signature: the classes of one broad kind differ in which defences their bases carry, so a filter can admit one and exclude its siblings without naming any class. The crafted branch therefore still spends one search per tracked entry, and the change is free at the budget. This settles OQ-25 on its **second** candidate — a class-discriminating filter exists — rather than its third.

One objection to that filter was raised and struck down, and is recorded so it is not raised twice: that modifiers grant defences too, so a filter excluding a sibling class by its defence signature could also exclude the item a Combination is pricing. It cannot, because the defence type is what determines the rollable pool in the first place — the Weights File's inner rung is exactly the set of modifiers that class can roll — so the contradictory entry cannot be authored, and FR-29 rejects it at load if it is.

`jewel` is the one fan-out category the defence signature cannot reach, its 8 classes carrying no defences. It is not a residue: the player closed it two ways on 2026-09-20, both at one search per class — `query.type`, since the jewel class names are base names, and the pool acting as its own discriminator, since for jewels the modifiers *are* the identifying property.

The choice between them is the spine's, but it is constrained, and the constraint is worth recording because it is where a product guarantee selects a mechanism. The second option discriminates only usually: where two jewel classes share a tracked modifier it admits both. The player judged that overlap acceptable — the shared modifiers are the low-value ones a curator would not track. It is nonetheless **not** written into `prd.md`, because FR-1's consequence is absolute and the first option satisfies it for free. A deliberate choice of the second would make that guarantee false for `jewel` and is a PRD revision to be asked for, not absorbed.

### What the class average still costs, and what it no longer costs

Revision 17's accepted spread is **narrowed, not withdrawn**. Inside one class the Base Types still differ, so a strong base is still understated and a weak one still overstated, and FR-1 still states it as a property the product chose rather than a defect. What is gone is the larger spread stacked on top of it: no base outside the class now contributes to the price, so the figure can no longer be moved by a class the player would never craft on.

The reasoning that kept the within-class spread is revision 17's own and is unchanged — the player crafts on whatever the class gives him, so the class is the decision the number is for, and a per-base payout would answer a question he cannot act on. It still compounds with R-1 in the same direction, both making the displayed figure an artefact of what is listed rather than of what is achievable. Its remedy is still identified and still deliberately unspent: tracking a class's strong bases as separate raw entries already prices them honestly on the other branch.

### What did not move

FR-4's coverage bands stay withdrawn. Revision 17 removed them because a threshold over dozens of items measures the scraper's progress rather than how much product exists, and moving the denominator from tracked categories to tracked classes does not revive that argument — it lands the count in the same order of magnitude. Coverage remains a published fraction with its denominator, read by a human. The `[ASSUMPTION]` the move did add is §3's: that a class's own name is already the player's word for it. Where several classes of one broad kind differ only in defence type, that may not hold, and the fix is a label in `EXPERIENCE.md` rather than a coarser unit.

## Revision 19 rationale — what the ranking does with no Craft Cost

FR-26 has said since revision 13 that an uncostable recipe is reported and never costed at zero. It has never said what the *ranking* then shows, and the gap was carried as an open UX note rather than as a requirement. It is a requirement: every crafted row on the page loses its figure at once, so this is player-visible behaviour and not a view treatment. Revision 19 states it, on the player's rulings of 2026-09-20.

### Why the rows stay, and what survives with them

Craft Cost is subtracted once per Item Class and is the same figure for every crafted row under the active recipe (FR-1, FR-26). Losing it therefore costs the crafted branch **one constant, applied equally**, and costs it nothing else: gross payouts are intact, the Payout Threshold compares against a Combination's gross price (FR-1), so the chase sets and the within-branch order are exactly what they would have been. What is genuinely unavailable is the *distance* between a crafted row and a Raw Base row, because that distance is the missing constant. So the branches keep their orders and lose only the merge.

### Why the appendix was rejected

Moving the crafted rows to the Unrankable group was the tidiest-looking option and is the one the PRD now forbids by name. Such a class's Eligible Pool is complete, published and in agreement with the Weights File, so all three of FR-4's reason strings are false of it, and the page would print a reason that is not the reason. Extending the enum to make it true is a fourth string for a condition that is not unrankability at all — the class ranks perfectly well, it is the *page* that cannot price it. The class is unpriced, not unrankable.

### Why the merged order was rejected, and the condition on which it may return

The cheapest option was to keep the single interleaved list ordered on gross payout, print the money-slot phrase in the EV cells, and accept a provisional merge — defensible if Craft Cost is small against the payouts it is subtracted from. It was rejected because **the size of that error is anti-correlated with its own trigger**. A recipe becomes uncostable when one of its currencies has no rate for the active league, which is likeliest for the thinly traded currency — and of v1's two recipes (FR-26) the one built on the rarer orbs is also the one with the larger Craft Cost. The state therefore fires disproportionately on the recipe where the merge is most wrong, under a threshold whose default is a quarter of a Divine. The approximation is worst exactly when it is used.

No figure stands behind either side of that: nothing in this corpus states a Craft Cost in Divine for either recipe. **Revisit condition** — if a measurement shows Craft Cost is small against typical payouts at the default threshold, the merged order becomes defensible again and this bullet should be reopened on that evidence rather than on preference.

### Why FR-5's count did not change

Applying the bound per unit was chosen over halving it. 20 is a product-owned number (FR-5) and halving it in one state would make the top 20 sometimes a top 10, which is a capability change to buy back page height. The count is held and the thing it counts over is what varies. The consequence is that the default view can hold up to 40 rows in this state; where that lands on the page is `DESIGN.md`'s, and the player accepted it on 2026-09-20 on the ground that the page already scrolls.
