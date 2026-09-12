---
title: 'PRD Edit Proposals — after Architecture Spine revision 2'
status: proposed
created: '2026-09-12'
target: docs/prds/prd-poe-crafting-base-price-checker-2026-09-12/prd.md
also_targets:
  - docs/prds/prd-poe-crafting-base-price-checker-2026-09-12/addendum.md
source: docs/architecture/architecture-poe-crafting-base-price-checker-2026-09-12/ARCHITECTURE-SPINE.md (rev 2)
---

# PRD Edit Proposals

The PRD raised three blocking questions against the inherited valuation model. **All three are now absorbed** (spine rev 2), which unblocks the PRD — and makes parts of it stale, because it was written against rev 1.

Nothing here is applied. These are proposals against a document this skill does not own.

**Headline:** 21 contradictions plus 7 mis-citations carried over from the earlier reconciliation. One item — C-1 — needed an architecture decision rather than a PRD edit, and that decision has been made in the spine, so **no PRD change is required for it**. Two items change requirement *content*, not wording, and are called out as such.

## 0. Start here — the unblocking edit

**The ⚠ banner in §0 is now false and is the single most consequential stale line in the document.** It says the PRD *"is not yet buildable for `sync` and `core`"*. All three blocking questions have landed. Leaving it would stall a build that is now unblocked.

| Location | Current | Proposed |
| --- | --- | --- |
| §0 callout | *"⚠ This PRD is not yet buildable for `sync` and `core`… each needing an architecture amendment"* | Replace with a pointer: *"The three blocking questions of §10 were absorbed by Architecture Spine revision 2 (AD-5, AD-16, AD-17, AD-18, AD-25, AD-26, AD-27). This PRD is buildable."* |
| §0 | *"its decisions AD-1 through AD-24 are inherited"* | *"AD-1 through AD-27"* — AD-25 (catalogue), AD-26 (rotation) and AD-27 (coverage gate) are new and all three bear on requirements below. |
| FR-1, FR-21, FR-22, FR-29 | *"Depends on BQ-1"* / *"Depends on BQ-2"* bullets | Delete. Replace with the resolved rule (see §1). |
| §10 "Blocking" | BQ-1, BQ-2, BQ-3 with *"Blocks FR-…"* annotations | Move to a **"Resolved by spine rev 2"** subsection, keeping the analysis — it is the record of why the model is shaped this way — and dropping the block annotations. |

## 1. High — the PRD currently specifies the defects it raised

These would be built as written. Each is a content change.

### C-2 — FR-29 still specifies floor-spanning, item-level-blind aggregation

FR-29 is titled *"Aggregate weights by floor within a scoped pool"* but its body performs no scoping and aggregates by floor.

> *Current:* "A Modifier Reference is a **floor spanning tiers**: its weight is the sum of every Weights File band … whose `valueMin >=` the reference's floor" and "`P(modifier | base, slot)` is that summed weight over the **total weight of the complete Eligible Pool**."

> *Proposed:* "A Modifier Reference is a **bounded band**: its weight is the sum of every Weights File band lying **wholly inside** it — `valueMin >=` the reference's floor **and** `valueMax <=` its ceiling. Both numerator and denominator are drawn from the **item-level-scoped** pool for the entry's Item Level Floor: `{ band : band.itemLevelMin <= entry.itemLevelMin }`. Write the conditional as `P(modifier | base, slot, itemLevel)`. A reference whose containment set is empty under that scope is a validation error, not a zero (AD-18)."

Retitle to *"Aggregate weights by band within an item-level-scoped pool."*

### C-3 — FR-21's stat filters carry only value floors

> *Current:* "the entry's Modifier References as stat filters **at their value floors**"

> *Proposed:* "the entry's Modifier References as stat filters carrying **both `min` and `max`** from the band (AD-16). A min-only filter returns every higher tier and prices the band at its floor — the defect BQ-1 identified, reintroduced at the adapter."

**Also in FR-21, two corrections the spine found by reading the live API** — these are new since the earlier reconciliation and are not stale-wording issues but factual errors:

- The base type belongs in **`query.type`**, not `type_filters.category`. `category` takes taxonomy ids (`weapon.bow`), and no committed artifact maps a base type to its leaf category.
- **`sale_type: priced_with_info` is not instant buyout** — its live label is *"Price with Note"*. The correct option is *"Buyout or Fixed Price"*, whose `id` is JSON `null`. Getting this wrong does not error; it silently admits unpriced listings.

### C-4 — FR-16's overlap rule forbids what the amendment exists to enable

> *Current:* "The same `statId` in the same slot at **nested value floors** is a validation error"

> *Proposed:* adopt AD-17's predicate rather than an enumeration — an enumerated list has now missed a case twice.
>
> "Two entries on one Base Type overlap when, **for both slots**, either slot is absent in one of them or their bands intersect. Overlap is a validation error rejected at load. Consequences: adjacent disjoint tiers **may** both be tracked (this is the point of bands); a partial-affix entry subsumes a fuller one; **and a prefix-only entry overlaps a suffix-only entry on the same base** — neither subsumes the other and no bands intersect, yet an item carrying both is counted twice."

FR-16's second and third consequences are already correct and need no change.

### C-5 — FR-14 asserts "no third" request source; AD-12 declares four

> *Current:* "Two non-workload requests are permitted and enumerated… **No third exists.**"

> *Proposed:* mirror AD-12's four-source table: tracked entries and currencies (the recurring workload), the per-run leagues validation, and the catalogue refresh (four requests, explicit command, patch cadence). Note also that FR-14 classes exchange-rate acquisition as *non*-workload while AD-12/AD-20 make `currencies.json` one of the two workload files.

### C-6 — FR-24 routes the catalogue through the sync run

> *Current:* detection validates against a stats catalogue *"refreshed as part of the non-workload requests of FR-14"*

> *Proposed:* "validated against the **committed** catalogue (`data/catalogue/stats.json`), refreshed by an explicit human-invoked command at patch cadence (AD-25), never as part of a run."

Also: the matching §11 assumption (*"AD-6 specifies the outcome but names no detection mechanism"*) is now false — **delete it from the Assumptions Index**, since AD-6 names one.

### C-1 — Raw Bases at ilvl 82 — **no PRD edit needed**

The reconciliation correctly flagged that AD-17's one-floor-per-base rule would reject a Base Type carrying both a Raw Base at 82 and crafted entries at a lower floor — the configuration FR-3 and FR-22 require. **This was resolved in the spine, not the PRD:** raw bases are never summands (they rank on a separate branch), so the partition argument does not reach them, and AD-17 rule 3 now exempts them explicitly. FR-3, FR-22 and the Glossary's *Raw Base* stand as written.

## 2. Moderate — stale identity, status and denomination

| # | Location | Change |
| --- | --- | --- |
| C-7 | Glossary *Modifier Reference* | Band, not floor — and not "BQ-1 proposes"; it is decided. |
| C-8 | Glossary *Accepted Tier*, *Eligible Pool* | *Accepted Tier* is expressed as the band, not a floor. *Eligible Pool* is enumerated per `(Base Type, slot)` at **any** item level and then **scoped** to the entry's floor before normalising. Drop "BQ-2 concerns this definition". |
| C-11 | FR-14, §7.2, SM-C1, §4.6 | Re-denominate the budget in **searches**, not entries. The arithmetic (≈15h, ≈62%) survives as searches; the noun does not. SM-C1 currently counts the wrong quantity — a band split adds a search without adding what it measures. |
| C-12 | FR-22 sixth consequence | *"the maximum across that Base Type's entries"* is vacuous once entries must share a floor. Collapse to *"a Base Type has one Item Level Floor."* |
| C-13 | FR-27 hard-error list | Replace with the 2.0.0 list: duplicate `(statId, valueMin, valueMax, itemLevelMin)`; **missing or `null` `valueMax` on any band**; missing `itemLevelMin`; a `statId` or base key absent from the committed catalogue; a band straddling a band **edge** in use (not a floor). |
| C-14 | FR-27, FR-29, FR-30, Glossary *Modifier Weight* | **Require `itemLevelMin` on every band.** As written, a producer building to the PRD emits a 1.x file that `core` refuses. |

### C-15 — FR-30's uniform-prior file *(content change — **decided**)*

FR-30 describes a file *"generated by a one-off script and committed as data"*. Under AD-11 and schema 2.0.0 that is no longer possible: a script can supply the `weight: 1` column, but **not** pool membership and **not** `itemLevelMin` — and the trade API cannot supply either (AD-25). A uniform-prior file is a *weighting* shortcut, never a *sourcing* one.

**Decision (user, 2026-09-12): v1 depends on the scraper project.** It is nearly complete, so the dependency is accepted rather than worked around. Edit accordingly:

| Location | Change |
| --- | --- |
| FR-30 | The Weights File is produced by the external scraper project and is a **v1 prerequisite**. It supplies pool membership, band edges, `itemLevelMin` and weights. Drop *"generated by a one-off script and committed as data"*. A uniform-prior variant (`weight: 1`) stays legal as a weighting placeholder but must still carry genuinely sourced pools and item levels. |
| FR-11 | *"Because v1 ships only the uniform-prior Weights File"* no longer holds — v1 ships whatever the scraper produces, so a probability's Provenance may be `measured`. Restate as conditional on the file's own per-entry `provenance`, which is what AD-10 already propagates. |
| §7.1 In scope | *"a uniform-prior file satisfying it"* → the schema is in scope; the **file** is an external deliverable. |
| §7.2 | *"v1 ranks on the uniform prior"* → v1 ranks on whatever the scraper delivers, gated by AD-27's coverage measurement. |

This makes the scraper a **release dependency**, which is worth stating plainly in §7 rather than leaving implicit in an FR.

## 3. The RePoE premise is gone

Spine rev 2 removes RePoE as a data dependency. Identity comes from the trade catalogue (AD-25); pool membership, band edges and item level come from the weights file (AD-11). RePoE survives only as a last-resort fallback whose output is stamped `uniform-prior`, never `measured`.

| # | Location | Change |
| --- | --- | --- |
| C-16 | §10 BQ-3; addendum *BQ-3 — The unmeasured gate* | Drop the *"RePoE→stat-id mapping"* premise. AD-27's gate is source-agnostic and binds whatever produces the file. Keep the thresholds — they were adopted verbatim. |
| C-17 | §10 OQ-4 | **Close it.** OQ-4 asked where per-tier item levels come from and answered "the curator, by hand, from RePoE". They are now a required file field (`itemLevelMin`), owned by the producer. OQ-4's own closing note anticipated exactly this. |
| C-18 | addendum *Open follow-on* | *"…is not in the Weights File schema"* is now false; schema 2.0.0 requires it. |

## 4. Addendum passages superseded

The addendum records the state of play *before* the amendment and now reads as current.

| # | Passage | Status |
| --- | --- | --- |
| C-19 | *"a modifier reference is `(statId, valueMin)`, a floor"* | Mechanism sentence is wrong; the **curation argument around it survives intact** and AD-5 restates it ("choosing the accepted tier and choosing the band are one authoring act"). Edit the mechanism, keep the reasoning. |
| C-20 | *"`TrackedEntry` needs an `itemLevelMin` field it does not have"* | Landed. Mark as resolved rather than pending. |
| C-21 | *"tracking T1 and T2 as two entries is forbidden"*; *"option 2 is the pragmatic v1 move"* | Both superseded. Disjoint adjacent bands may now both be tracked — that is the amendment's purpose. And the spine adopted **option 1** (per-band `itemLevelMin`) *while also* imposing option 2's per-base uniformity, because the two fix different defects: option 1 fixes the denominator, option 2 fixes the partition. |

## 5. Carried over from the earlier reconciliation

Still open from `reconcile-architecture.md`; unaffected by rev 2 except where noted.

| # | Item |
| --- | --- |
| A-5 | AD-24's delivery clause unreflected — data is fetched, not bundled, and the view renders from one consistent artifact set. Now **eight** artifacts, not six. |
| A-6 | AD-24's colour rule over-extended to Price State and raw-vs-crafted at three sites (M-1…M-3). Either mark `[ASSUMPTION]` or raise as an AD-24 amendment. |
| A-7 | "item level exactly 82" cited to AD-16, which does not supply it. |
| A-8 | "must not pre-aggregate bands" cited to AD-11; it is the schema's clause. |
| A-9 | "entries skipped and why" cited to AD-12/AD-23 and reads against AD-6. **Rev 2 supplies the missing definition**: AD-26 makes "not reached in this chunk" precise. |
| A-10 | Threshold denomination cited to AD-20; it is AD-17's decision. |
| A-11 | `contracts`-serialisation and `pnpm sync:dry` / no-live-sync-from-a-worktree missing from NFR-4. **Add `pnpm catalogue:refresh` to the same prohibition.** |
| A-3 | Weights-file producer enumeration obligation absent. **More load-bearing now** — the producer is an external project whose only contract is this document. |

## 6. New requirements rev 2 creates

Not contradictions — capabilities the PRD has no requirement for, because the spine decisions are new.

- **AD-26, refresh rotation.** The PRD uses "rotation" (FR-13/FR-18) and never defines it; §11 carried it as an assumption. It is now decided: currencies first, then `pinned` every chunk (capped at 25% of the search ceiling), then `active` by oldest `lastAttemptedAt`, then bounded `unresolvable` retries, never `pruned`. *"How often does a row get re-priced?"* is player-visible and belongs in an FR. **Promote the §11 assumption to a requirement.**
- **AD-9's `lastAttemptedAt`.** Distinct from `observedAt` and present in all four Price States. Player-visible: a `no-listings` row has an age even though it has no observation. FR-10's per-row freshness should say which it is showing.
- **AD-27, the coverage gate.** Thresholds adopted verbatim from BQ-3, but the ≥80 / 50–80 / <50 bands now bind a **product decision** — at 50–80% the Unrankable group becomes a first-class surface rather than a footer. That is a layout requirement conditional on a measurement, and FR-4 should carry it.
- **AD-25, the catalogue.** `data/catalogue/*.json` is a new committed artifact set with a human-invoked refresh. FR-24's detection mechanism depends on it (C-6), and `web` now reads two of the four for display text and currency icons.

## 7. Suggested order

Nothing here is blocked; every decision is made.

1. §0 banner and the four dependency bullets — **unblocks the build** (§0 above).
2. The six high items — FR-29, FR-21, FR-16, FR-14, FR-24 (§1). C-1 needs nothing.
3. Glossary and denomination sweep (§2).
4. RePoE removal (§3) and the addendum (§4).
5. C-15 — FR-30, FR-11, §7.1, §7.2, plus the scraper as a stated release dependency.
6. New requirements (§6) and the carried-over reconciliation items (§5).

Items 1–5 are edits faithful to decisions already made. Item 6 is new requirement authoring and is the largest piece — it is where an FR for refresh rotation (AD-26), `lastAttemptedAt` freshness (AD-9) and the conditional Unrankable surface (AD-27) get written.

## 8. How to run this

In a new session, from the project root:

```
/bmad-prd
```

Then give it this intent:

> Update `docs/prds/prd-poe-crafting-base-price-checker-2026-09-12/prd.md` against
> `docs/architecture/architecture-poe-crafting-base-price-checker-2026-09-12/PRD-EDIT-PROPOSALS.md`.
> The architecture spine was revised (rev 2) and absorbed the three blocking questions,
> so the PRD is unblocked and partly stale. Work the proposals in the order given in §7.
> All decisions are settled — C-15 is decided (v1 depends on the external scraper project).

It will resume from the PRD's own `.memlog.md`, so the FR numbering and the assumptions index stay consistent.
