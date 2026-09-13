---
title: "PRD Addendum: PoE2 Crafting Base Price Checker"
status: final
revision: 5
created: 2026-09-12
updated: 2026-09-13
---

# PRD Addendum

This addendum captures depth from the PRD run that belongs to a downstream reader — architecture, solution design, or the curation workflow — rather than to the PRD's main narrative. It does **not** repeat `docs/briefs/.../addendum.md`, which already holds the request-budget analysis, the rejected alternatives for combination discovery, the ranking-metric derivation and the data-source notes.

**Which section is for you.** The topics below are dependency-ordered, not ranked by importance:

- *The Item Level Rule* — for the **curator**, and a prerequisite for reading *BQ-2*.
- *Recipe Count* and *Curation Surface* — for whoever builds the view and `core`; both are options-considered records.
- *The Three Blocking Defects* — for the **architect**. Over half the document, and the highest-stakes content.
- *Why the PRD Cites Architecture Decisions* — for any reader wondering why a requirements document states arithmetic.

Each analysis below is a **record of reasoning, not a live proposal**: read the body as it stood when it was written, and the bold **What landed** note that closes it for the current state. Where a later spine revision moved an analysis again, a further bold note follows and names that revision — one for each such revision, oldest first. *Why the PRD Cites Architecture Decisions* is the exception — standing rationale rather than an analysis, so it carries no landing note.

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

**What landed — the item level floor.** `TrackedEntry` needed an `itemLevelMin` field it did not have in AD-5's original shape. Spine revision 2 absorbed it: AD-5 now defines a tracked entry as `(baseTypeId, itemLevelMin, prefix?, suffix?)` and `AGENT-WORKFLOW.md` sequences the change as `contracts`-first, alone, with everything else rebasing onto it. The knock-on effect on the probability model — the one PRD §10 BQ-2 raised — landed alongside it in AD-18 and Weights File schema 2.0.0.

**Consequence for the tier restriction.** The brief's addendum records "tiers 1 and 2" as a budget-motivated proxy for "expensive," and notes its cost: a tier 3 modifier that is valuable this league because of the build meta stays invisible. This rule sharpens that restriction into something checkable per modifier rather than a blanket band, but does not remove the cost — the restriction still governs the default, not the ceiling, and off-tier modifiers are added by exception when the player notices them.

**What landed — the tier restriction.** This follow-on question is closed for the curator and transferred to the producer. Per-tier item level availability is not in the trade API, but it **is** in the Weights File schema as of 2.0.0, where `itemLevelMin` is required on every band. The curator no longer assembles it by hand before seeding a list; it is a field the file carries and `core` consults, and PRD §10 OQ-4 is closed on that basis. What remains is the *producer's* sourcing problem: where the scraper project gets the numbers. The spine carries that as its own open question, and AD-27's coverage gate measures it. RePoE is a last resort there rather than the expected source: it carries modifier metadata but no spawn weights, so it was never the authority for the load-bearing field, and anything it fills is stamped `uniform-prior`, never `measured`.

## Recipe Count for v1 — Options Considered

The brief ranks "a base paired with a crafting recipe", and AD-18 then establishes that in v1 a `CraftRecipe` contributes **only a cost offset**: the distribution transform is identity. The mechanics numbers for how perfect versus greater transmute/augment shift the tier distribution do not exist in any input. Three options:

1. **One recipe — perfect transmute + perfect augment. Adopted.** Matches the late-endgame playstyle the brief targets, and follows the brief's reasoning that late-endgame value transfers downward to early play while the reverse does not.
2. **Two recipes, perfect and greater.** Ships the `(base, recipe)` pairing the brief literally describes. Rejected for v1: with an identity distribution transform, a second recipe produces an identically ordered list with a different constant subtracted. That is a cost column presented as an analysis, and it doubles a request budget that AD-12 already holds tight.
3. **Recipes as open data.** `data/recipes.json` holds a list and the view handles N. This holds whichever option is chosen, and is not an alternative to (1) — it is why adopting (1) costs nothing later. v1 commits one entry to that list.

The distribution transform is the thing actually missing, and it is a data problem rather than a design one. When those numbers exist, recipe becomes a real ranking dimension and option (2) becomes worth shipping.

**What landed.** Nothing changed here. Spine revision 2 left AD-18's recipe clause untouched — ordering is still recipe-invariant in v1 — so option 1 stands and the open question is still the mechanics numbers (PRD §10 OQ-5).

## Curation Surface — Options Considered

AD-15 forbids a write path from the browser and AD-21 makes `data/tracked.json` hand-owned, so "prune junk, pin ones to watch" cannot be a UI action. What the view *does* about curation was still open:

1. **Read-only surfacing. Adopted.** The view shows Curation Status, tracked-list age, `no-listings` entries and `unresolvable` entries; editing happens in a text editor, followed by a commit. This is the minimum that makes FR-15's purpose work — the player cannot decide to prune without seeing what is dead.
2. **Copyable JSON snippets per row.** Same surfacing, plus a copy-to-clipboard fragment to paste into `tracked.json`. Rejected for v1 as an authoring convenience for an act performed a handful of times a league, and one that would need to stay in step with the schema to avoid producing invalid entries — a maintenance surface for a rare action.
3. **Minimal — no curation affordances at all.** Rejected: it would leave AD-23's named risk ("a stale top five that the user trusts is worse than no tool") with nothing prompting review, which is the outcome AD-23 exists to prevent.

**What landed.** Option 1 stands. AD-15 and AD-23 were not disturbed by spine revision 2, and AD-21 was — but only in its writer table, which left this analysis's premise untouched. Spine revision 2 did add one thing to surface, though: AD-26 makes the refresh rotation a defined order, so *how often a row gets re-priced* is now something the view can state rather than imply (PRD FR-17).

## The Three Blocking Defects — Analysis

> **All three were absorbed by spine revision 2; spine revision 4 later narrowed BQ-1's scope, and spine revision 5 moved BQ-1 and BQ-2 again.** This section is kept as a record of the reasoning that produced them, because the argument is not visible in the amended decisions themselves. Each subsection below ends with what landed.

PRD validation surfaced three defects in the **inherited** valuation model (§10 BQ-1, BQ-2, BQ-3). None was created by the PRD, and all three are invisible until the pricing rule (AD-16), the probability rule (AD-18) and the partition rule (AD-17) are read *together* — which a spine organised around one decision per AD does not force a reader to do.

### BQ-1 — The population mismatch

AD-16 and AD-18 each define a set of items, and they are not the same set.

- **AD-18's set:** every item whose modifier value is at or above the reference floor. Its weight is the sum of all bands at or above that floor, so for a reference at the T2 floor this is *T1 items and T2 items together*.
- **AD-16's set:** the cheapest ten instant-buyout listings matching that same filter, sorted ascending. Since lower tiers are more common and cheaper, this is, in practice, *T2 items*.

`EV` multiplies the first set's probability by the second set's price. Worked through on the bow example:

| Quantity | What the model computes | What is true |
| --- | --- | --- |
| `P` | `P(phys T1) + P(phys T2)` | — |
| `price` | ≈ `price(phys T2)` | — |
| Contribution | `[P(T1) + P(T2)] × price(T2)` | `P(T1) × price(T1) + P(T2) × price(T2)` |

Since `price(T1) >> price(T2)`, the model understates the contribution. That alone would be a tolerable approximation. What makes it blocking is the interaction with truncation: if `price(T2)` sits below the Payout Threshold, the **entire entry** — including all of its T1 probability mass — truncates to zero. The jackpot is not understated; it is deleted. And jackpot isolation is the reason threshold-truncated EV was chosen over plain EV in the first place (brief addendum, *Ranking Metric — Derivation*), so the defect destroys the product's founding distinction rather than merely degrading a number.

The workaround a builder would reach for first — track T1 and T2 as two entries — *was* forbidden: under a floor-based identity the two genuinely do overlap, so AD-17 rejected them, correctly. That prohibition made the defect blocking rather than merely annoying, and the amendment lifts it: with bands, adjacent disjoint tiers may both be tracked, which is now the point rather than the error.

**Why a band fixes it.** With `ModifierRef` as `(statId, valueMin, valueMax?)`, T1 and T2 become disjoint populations. AD-17's partition holds with them tracked separately, AD-18's aggregation sums only the bands inside the tracked band, and AD-16 prices each band against listings that actually belong to it. The Weights File already models bands exactly this way (`valueMin` / `valueMax`, non-overlapping, straddling forbidden), so the schema needs no new concept — only `ModifierRef` needs to catch up to it. The trade API's stat filters accept a min and a max, so the search is expressible.

The cost is request budget: tracking two bands where one entry stood doubles that entry's search cost, against the ~1,500-search ceiling of AD-12. That is a curation trade-off — the player tracks a second band only where the jackpot tier is worth isolating — not an argument against the amendment.

**What landed.** AD-5 adopts the band, and goes further than proposed: `valueMax` is **required, with no open-top form**. The reasoning is that an omitted ceiling is a floor by another name and reintroduces the whole defect. There is a further point this analysis missed: the defect would then be *unvalidatable*, since `sync` validates `tracked.json` but the band edges it would need to check against live in `weights.json`. AD-12 also re-denominated the ceiling from entries to searches, precisely so the cost of a band split is visible to the curator at the moment he makes it — rather than surfacing months later as a refresh cycle that quietly stopped completing.

**Narrowed by spine revision 4.** The claim above that T1 and T2 become disjoint populations holds for a modifier whose text carries **one** `#`. For one carrying more — and modifiers with more than one `#` appear on 53 of 63 item classes — AD-28 establishes that the value axis does not partition the tier axis at all, so a tier has no pair of value edges that isolates it, and a reference near a boundary necessarily includes the neighbouring tier's tail. That narrows what this amendment bought rather than reversing it: **the trade search cannot isolate that tier either**, so the priced and weighted populations remain the same population, which is the only property AD-16 and AD-18 jointly require. What replaces tier isolation is cell isolation — the curator tracks an interior cell (PRD FR-22).

**Retracted by spine revision 5 — one factual claim above has since gone stale.** This analysis says the Weights File models bands "non-overlapping, straddling forbidden". Neither half still holds as stated. **Non-overlap** is now scoped — two entries may cover the same interval where their `itemLevelMin` differs (spine revision 4, two cohorts' mass in one interval) or where their `sourceModifierId` differs (spine revision 5, two distinct game modifiers publishing one stat over one range). **Straddling** is explicitly **not** a file error: it is a cross-file condition, since the same file straddles nothing against a differently-aligned tracked list, so `core` reports it against the tracked entry at load (PRD FR-27, FR-29). The argument above is unaffected — non-overlap was only ever a proxy for the straddle rule, and the straddle rule is what the band amendment actually needed.

### BQ-2 — The missing dimension

The Eligible Pool is the denominator of every probability, and which modifiers are *in* it depends on item level. FR-22's own worked example establishes this: bow physical-damage T1 cannot roll below ilvl 82. Yet AD-18 and the Weights File model one pool per `(baseTypeId, slot)`, flat.

So for an entry searching at ilvl ≥ 75, the denominator includes bands that cannot roll in part of the searched range, and the numerator may include a band that cannot roll at the floor at all. Both are wrong, in the same direction for every entry on the base, which means the error does not cancel in the ranking — it reweights bases against each other according to how far each one's floor sits below the top of its pool.

Two amendments are possible, and they differ in cost, not in kind:

1. **Add `itemLevelMin` to each Weights File band.** `core` scopes the pool to the entry's floor before normalising. Correct, and it folds in PRD §10 OQ-4 — the per-tier availability data the *curator* currently needs by hand becomes data the file carries, consulted by code.
2. **Declare one canonical item level per Base Type** and require every entry on that base to share it. Cheaper, needs no schema change, and reduces the error to whatever variance remains inside a single base. It also aligns neatly with FR-16's prohibition on mixed floors within a base — a prohibition this PRD already imposes for an unrelated reason.

**What landed.** Both, because they fix different defects. This analysis framed them as cheaper-versus-correct and picked one; that framing was wrong. Option 1 fixes the **denominator**: schema 2.0.0 requires `itemLevelMin` on every band, and AD-18 scopes the pool by it — scoping *both* halves of the ratio. That closes a reading this analysis did not notice was open, in which only the denominator is scoped and a single modifier's probability inflates without any other modifier's probability moving. Option 2 fixes the **partition**: AD-17 requires the crafted entries on one base to share an item level floor, because EV is an expectation over one crafting act on one item population, and entries at different floors are crafts on differently levelled bases whose `P` terms normalise against differently scoped pools. Neither substitutes for the other. AD-17 additionally exempts raw bases from the uniformity rule, since they are never summands — without that exemption the rule would reject the very configuration the brief asks for, white bases at 82 alongside magic ones well below it.

**Moved again by spine revision 5.** This analysis treats the scoped pool and the denominator as the same object — scope the pool, then sum it. AD-29 separates them. A poe2db row may publish several distinct trade stats at once under a single spawn weight, and the producer splits such a row into one entry per stat line, each carrying the row's **full** weight. The scoped pool is therefore the **domain** the denominator is computed over, and the denominator is the sum of distinct **source-modifier** masses within it — each modifier counted once — rather than the sum of its cells (PRD FR-29). This does not disturb anything above: item-level scoping still fixes *which* mass is admitted, exactly as option 1 established. What it adds is a second way the denominator could be wrong that scoping alone never addressed, and it has the same signature as the first — it is uneven across bases, so it **reorders** the list rather than shifting it. It was invisible until a producer met a hybrid row, because for a pool of single-stat modifiers the two readings coincide exactly.

### BQ-3 — The unmeasured gate

Unlike the other two, this is not a modelling error but an unknown that determines whether v1 exists in a useful form. AD-18 is deliberately harsh about partial pools — an incomplete denominator inflates every probability for that base by `1/coverage`, which **reorders the list**, and a provenance label does not change a sort, so the base leaves the ordering entirely. That is the right call. The ranked list's size is therefore a direct function of the weights file's pool coverage — and nobody has measured it.

The PRD attaches a decision rule (≥80% proceed / 50–80% proceed with the Unrankable group promoted / <50% the premise fails) so that the question cannot sit open indefinitely while the view is built around an assumption. The measurement is cheap — count the file — and it should be the first task of the build, before any view work commits to a layout that assumes a full list.

**What landed.** AD-27 adopts the thresholds verbatim and pins down two things this analysis left loose. The denominator is **the tracked list**, not the catalogue: the question is how much of what the curator wants ranked can be ranked, and a base nobody tracks cannot affect the product. And the rule is **source-agnostic** — it binds whatever produces the weights file. That matters more than it seemed to at the time, because spine revision 2 removed RePoE as the assumed source. This analysis was framed around a RePoE→stat-id mapping of unknown coverage; identity now comes from the trade catalogue (AD-25) and pools from the file (AD-11), and the gate reads the same either way. The 50–80% band is also no longer just advice: it binds a layout decision in `web`, which is why the PRD carries it in FR-4 rather than only here.

## Why the PRD Cites Architecture Decisions Instead of Restating Them

The usual PRD discipline is capabilities-not-implementation, with technical choices pushed to an addendum. This PRD deliberately breaks that in a narrow way: the pricing definition (FR-21), the ranking formula (FR-1), the four price states (FR-9), the weight aggregation rule (FR-29) and the currency denomination (FR-23) are stated as requirements with their arithmetic intact.

The justification is the brief's own framing — *"This section is the product; everything else is presentation."* These are not implementation details that happen to be decided; they are the behaviour the player is buying, and they are the places where two independently built components could satisfy a looser requirement in mutually incompatible ways. Each is cited to its AD so the rationale lives in one place and the PRD does not become a second, drifting source of truth for it.

Everything genuinely implementation-shaped — the package split, the port-and-adapter structure, the stack, the source tree, the deployment path — stays in the spine and is referenced by an NFR only where it is a hard requirement the brief itself imposed.
