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

---

# Revision 3

Everything above is the rev-2 pass and still stands — the PRD absorbed it as revision 2. What follows is **new**, and is scoped to the spine's revision 3.

Revision 3 amended **AD-9, AD-11, AD-12, AD-18, AD-19, AD-21, AD-26 and AD-27 in place, and added no new AD.** That matters more than the amendment list: the `AD-1 … AD-27` range is unchanged, so **every existing `(AD-n)` citation in the PRD remains valid** and no FR's references went stale. Only the eight ADs' *contents* moved.

Nothing here is applied. These are proposals against a document this skill does not own.

**Headline:** 11 edits — 2 severe, 4 high, 2 medium, 3 low. Two of the severe items are places where the current PRD text does not merely lag the spine but **tells a builder to do the wrong thing**: FR-17's two `[NOTE FOR PM]` callouts now point at wording the spine no longer contains, and FR-29 carries no defence against a sentinel band ceiling, which re-opens BQ-1 through a path revision 2 never closed. Four of the eleven were found after the reconcile review was written and are marked **[post-review]**.

Continuing the `C-` series; the items are ordered by how badly the current text would mislead a builder who reads only the PRD.

## 9. Severe — the PRD actively misdirects

### C-22 — FR-17 is stale in its notes, incomplete in its cap, and silent on the behaviour that matters

Four distinct problems, one location. This is the largest single edit in the set.

**(a) Both `[NOTE FOR PM]` callouts are false.** FR-17 carries:

> *Current:* "`[NOTE FOR PM]` Build to that requirement rather than to AD-26's literal *25% of AD-12's search ceiling*, which does not compose into a writable inequality — see §10 OQ-8."

> *Current:* "`[NOTE FOR PM]` Build the bound as stated; its rationale in AD-26 is the part that does not hold — see §10 OQ-9."

The 25% figure is gone from the spine entirely. The first note tells the builder to *ignore* AD-26's cap, which is now the only place the writable inequality lives; the second tells him AD-26's retry rationale "does not hold", when AD-26 now carries the corrected rationale this PRD itself argued for. A builder obeying these notes skips the two paragraphs written specifically to serve him. **Delete both.**

**(b) The cap bullet states only half the rule.**

> *Current:* "**The `pinned` set is capped**, enforced as a `data/tracked.json` validation error at load rather than left as a convention."

> *Proposed:* two bullets mirroring AD-26's table, including its **owner** column:
>
> - *Load time, `sync` only:* a `data/tracked.json` validation error when `count(pinned) + currencyStepSearches > 0.5 × config.minChunkSearches`. `currencyStepSearches` is **what step 0 actually costs in searches**, not the row count of `data/currencies.json` — a bulk exchange query may price many currencies in one request. `sync` reports the figure it used, so the two cannot drift.
> - *Runtime, every Chunk:* if the discovered allowance cannot cover the pinned set plus at least one `active` entry, `sync` **truncates the pinned set for that Chunk** — taking entries in row 1's order and reserving at least one search for the `active` rotation — completes the Chunk normally, and records a pinned-starvation record in the Sync Report. It is **not an error and does not change the exit code**.
> - Retain AD-26's "why neither half alone" sentence. It is the part a builder will otherwise optimise away.

**[post-review]** The truncate-and-reserve behaviour is new since the reconcile review, which proposed only the report line. It is the load-bearing half: without it FR-17 specifies *what to record*, not *what to do*, and two builders write opposite selection rules — one spends the whole allowance on `pinned` and freezes the `active` rotation permanently, the other truncates. Both would satisfy the review's proposed text.

**(c) Row 1 now has a sort key.** **[post-review]** FR-17's table gives row 1 no ordering, and the "ties break on the canonical entry key" bullet then supplies one by default — which means the *same* pinned tail is dropped every Chunk, forever, once (b)'s truncation is live. AD-26 now says: *"Within the pinned set, order by oldest `lastAttemptedAt` first"* — the same key row 2 uses — precisely because the order "becomes load-bearing exactly when a chunk cannot [reach all of them], and then it is what makes the pinned tail rotate instead of starving permanently behind a fixed key order." Add the key to row 1's table cell.

**(d) The `unresolvable` bullet's mechanism is superseded.** **[post-review]**

> *Current:* "a retry spends a search only if the id now resolves, which it can only do after a human has run the catalogue refresh. The 24h bound therefore paces re-checking rather than protecting the request budget."

> *Proposed:* adopt AD-26's rewritten account, which is narrower and is the one that survives AD-6. Two definitions, then the residue:
>
> - **`lastAttemptedAt` is stamped only by an attempt that issues a request** — the free offline catalogue check never stamps it (see C-24).
> - **An id that resolves again stops being `unresolvable` at that moment** and rejoins row 2 as an ordinary `active` entry; it does not wait for a retry slot.
> - What row 3 therefore covers is the narrow residue: **an entry whose id does resolve but whose pricing attempt keeps failing.** The 24h bound paces that retry and guarantees row 3 terminates.
>
> Drop "paces re-checking" as the bound's purpose — AD-6's pre-flight re-checks every entry every run regardless, so the bound paces no re-validation.

Governing AD: **AD-26** throughout, with AD-9 for (d)'s first definition.

### C-23 — FR-29 and §3 carry no edge-alignment rule, so BQ-1 is reachable by typing `9999` — **[post-review]**

This is the one item in the set that re-opens a *resolved* defect, and neither the reconcile review nor the PRD's own OQ-11 saw it: OQ-11 closed the **syntax** of an open top (a required `valueMax`) and left its **semantics** open.

> *Current (§3 Modifier Reference):* "**`valueMax` is required, always** — an omitted ceiling is a floor by another name, and a floor spans tiers, which is the defect §10 BQ-1 removed."

> *Current (FR-29):* the containment rule (`band.valueMin >=` … `band.valueMax <=` …), the empty-containment-set error, and the straddle error. Nothing constrains what the reference's own edges *mean*.

A curator wanting "T1 and everything above" does not read the weights file as a spreadsheet, so they write `valueMax: 9999`. That is schema-valid, passes containment (every band is inside it), passes the empty-set check (the set is maximal), passes the straddle check (nothing crosses an edge nothing reaches), and passes FR-16's overlap predicate if it is the only band tracked on that `statId`. `core` then sums two tiers' weight while FR-21's stat filter — `min: 80, max: 9999` — is **operationally min-only** and prices the cheaper tier. Two tiers' probability at one tier's price: BQ-1 verbatim, with its worst consequence intact (if the blended price falls below the threshold the entry truncates out of the sum and takes the jackpot mass with it). The same hole exists at the **bottom**, unconstrained and never discussed: `valueMin: 0` against a pool whose lowest band starts at 40.

> *Proposed (FR-29, a new consequence):* adopt AD-18's edge-alignment rule verbatim. For every tracked reference, over its containment set under the item-level scope:
>
> ```
> ref.valueMin == min { band.valueMin : band ∈ contained }
> ref.valueMax == max { band.valueMax : band ∈ contained }
> ```
>
> A reference must begin exactly where its lowest contained band begins and end exactly where its highest contained band ends. A sentinel ceiling above the pool's top band fails this, as does a sentinel floor below its bottom. Like the empty-containment-set rule beside it, this is a **validation error against `data/tracked.json`**, checked in `core` at load — not a wide band, and not a file error.

> *Proposed (§3 Modifier Reference):* extend the existing sentence — requiring `valueMax` to be *present* closes only the syntax of an open top; a sentinel ceiling reproduces the defect while satisfying every schema. The band's edges must align to edges the Weights File actually declares (FR-29).

Worth stating in FR-29 that the check is **cross-file** — it reads `tracked.json` and `weights.json` together — and so belongs to the component that holds both, which is `core` at load, not `sync` at request time. Governing AD: **AD-18**.

## 10. High — silent divergence a builder cannot resolve from the PRD

### C-24 — §3's `lastAttemptedAt` definition would flatten the rotation's ordering key — **[post-review]**

> *Current (§3):* "**`lastAttemptedAt`** — when `sync` last **worked on** a Tracked Entry, whatever the outcome."

"Worked on" was written before revision 3 made the `unresolvable` retry free. Now that AD-6's offline catalogue check costs nothing, "worked on" reads naturally as *including* it — and AD-6's pre-flight runs over **every** tracked id on **every** run. On that reading every entry's timestamp is stamped every run, FR-17 row 2's oldest-first ordering flattens to a tie across the entire tracked list, and the rotation silently degrades to canonical key order. That is a larger failure than anything row 3 addresses, and the PRD's current wording is the one that produces it.

> *Proposed:* adopt AD-9's amended wording — `lastAttemptedAt` records when `sync` last **issued a request** for the entry, regardless of the outcome. **Offline work never stamps it**, AD-6's catalogue validation above all, "because a check that ran over every entry on every run would flatten the timestamp across the whole list and destroy AD-26's ordering key."

Keep the rest of the entry as written — present in all four Price States, distinct from `observedAt`, a `no-listings` row has an age. Those are unaffected and correct. FR-10's per-row freshness bullet (line: "taken from its `observedAt` where there is an observation and from its `lastAttemptedAt` otherwise") also stands. Governing AD: **AD-9**.

### C-25 — FR-19's "no number is compiled in" reads as a contradiction of `config.minChunkSearches`

> *Current:* "**Neither allowance is a configured constant.** Both are whatever the governed client's live rate-limit state says is still available in the tightest unsatisfied bucket (FR-20), so a Chunk's size is discovered at runtime and no number is compiled in."

Revision 3 puts a **declared number about chunk size** into player-owned config. The two are reconcilable — AD-26 is explicit that `minChunkSearches` "is a validation yardstick and never a chunk bound" and is "read at exactly one place: the load-time inequality" — but a builder reading FR-19 alone faces two bad readings with no text steering him. Either he treats `minChunkSearches` as the per-Chunk budget and stops the Chunk there, compiling the Chunk size to a constant and defeating FR-20's adaptive pacing; or he rejects the config field as contradicting a requirement and drops the load-time cap with it, re-opening OQ-8. This is the one place the PRD is not merely silent but points the wrong way.

> *Proposed:* add a consequence. `data/config.json`'s `minChunkSearches` is a **declared floor assumption read only by FR-17's load-time pinned-cap validation**. It is never a Chunk bound, never read by the rate governor, and does not qualify "neither allowance is a configured constant", which continues to hold of the actual allowances. An implementation that lets it cap, pace or shorten a Chunk has violated FR-19; one that reads it anywhere but tracked-list validation has violated FR-17.

**[post-review]** Add AD-26's second paragraph too, because it changes what a player is being asked to write. `minChunkSearches` is **a declaration about the player's own invocation cadence, not a constant read off a bucket.** In steady state the binding bucket is the long one — `600:21600` is **100 searches/hour sustained** — while `30:300` is a burst allowance a Chunk receives in full only at an invocation interval around 18 minutes or longer. A syncer invoked every 5 minutes sees roughly **8** searches per Chunk once the 6-hour bucket saturates, **not 30**. The player declares the smallest allowance a Chunk will actually receive *at the cadence they schedule*, bounded above by `sustainedRate × interval`. Seeding it from the burst figure at a short cadence certifies a pinned set that starves every Chunk forever — the precise failure the cap exists to prevent, re-entering through the yardstick. FR-19's closing "the syncer assumes nothing about what invokes it" is untouched: the player declares the cadence, and FR-17's runtime half audits the declaration. Governing ADs: **AD-26, AD-19**.

### C-26 — FR-25 and §3 *Sync Report* enumerate four record types; AD-26 now requires a fifth

> *Current (FR-25):* "The report records requests consumed **per declared source** (AD-12, FR-14), unresolvable entries (AD-6), and the date of the last tracked-list edit (AD-23)." Plus *entries not reached in this Chunk*, flagged as the PRD's own addition.

> *Current (§3 Sync Report):* the same four, enumerated.

The framing is closed, so the pinned-starvation record is not merely unlisted — it is excluded. NFR-8's validate-on-load rule then means a `SyncRunReport` schema built to FR-25 would make `web` **refuse a report `sync` correctly wrote**.

> *Proposed:* add a fifth item to FR-25's list and to the §3 definition — a **pinned-starvation** record, present only on Chunks where the discovered allowance could not cover the pinned set plus at least one `active` entry, carrying the allowance `sync` saw, the pinned count, and how many `active` entries it managed (FR-17, AD-26).

Two things to state explicitly, because both are load-bearing:

- It is **distinct from *entries not reached***. *Not reached* is a normal rotation outcome; starvation is a curation defect the player must act on. AD-26's whole argument for the runtime half is that without the named shortfall "the symptom is indistinguishable from a slow refresh" — folding starvation into *not reached* reproduces exactly that indistinguishability. Note the provenance difference too: *not reached* is this PRD's own addition, starvation is required by AD-26.
- **[post-review]** `web` must **surface** it. AD-26 now says so in the rule itself — "`web` surfaces its presence alongside the tracked-list age (AD-23) — a report field nothing renders is a field nobody reads." That is a render obligation, and it belongs beside FR-18's tracked-list age and FR-24's unresolvable count: the three things that tell a player their list is not doing what they think it is.

Governing AD: **AD-26**.

### C-27 — FR-4's coverage fraction is wrong on both halves

> *Current:* "Pool coverage across the tracked list — Base Types resolving to `complete` in **both** slots — is measured first, and the result binds the layout (AD-27, §10 BQ-3)", with a band table identical to AD-27's.

The bands still agree. Neither half of the fraction does any more.

**Denominator.** AD-27 rev 3 divides only by bases that need a pool; FR-4 still says "across the tracked list", which is what OQ-10 identified. FR-4 is directionally consistent — its second consequence already establishes that a Raw Base needs no Eligible Pool — so this is a gap rather than a contradiction, but FR-4 is explicitly "the copy to build to" per BQ-3 and the measurement is the **first build task before any view work**. A builder computing it from FR-4's wording gets a depressed fraction and may promote the Unrankable group to a first-class surface on the strength of raw-only bases — the exact outcome OQ-10 was raised to prevent.

**Numerator.** **[post-review]** AD-27 now states three conditions, and says why stating only the middle one makes the fraction ambiguous: "both slots are `complete`" is **vacuously true** of a base absent from `weights.json` entirely — there are no slots to fail — and a base declaring `complete` over an **empty** pool passes a naive reading while AD-18 excludes it from the ordering anyway. Either gap lets the same tracked list and the same weights file score 100% or 40%, across a gate whose consequences turn at 80% and 50%.

> *Proposed:* insert AD-27's predicates into FR-4 verbatim and restate both halves against them:
>
> ```
> rankable(base) = base carries at least one tracked entry that is
>                  crafted (at least one affix present)
>                  and not pruned
>
> covered(base)  = base is PRESENT in weights.json
>                  ∧ both slots declare poolCoverage "complete"
>                  ∧ neither slot's pool is empty
> ```
>
> Include the three cases AD-27 settles: raw-only bases excluded; bases whose only crafted entries are `pruned` excluded; bases carrying **both** raw and crafted entries included, since the crafted branch needs a pool like any other.

Worth adding one sentence AD-27 implies but does not say: **`rankable` is decidable from `data/tracked.json` alone** — affix presence and Curation Status are both fields of that file — which is the right property for a gate that runs before any view work and plausibly before any sync has ever run. Say it, because the `pruned` exclusion's stated reason invites a builder to generalise it to `unresolvable`, whose price state lives in the Dataset and would destroy that property. Governing AD: **AD-27**.

## 11. Medium — artifacts and ownership the PRD does not declare

### C-28 — FR-33's non-fetched list is short by one, and its refusal semantics now need a limit — **[post-review]**

Two things, one location, both created by AD-21's and AD-26's new owner columns.

> *Current:* "Three files are deliberately **not** fetched: `sync-progress.json`, internal to `sync`; and `catalogue/items.json` and `catalogue/filters.json`, which only `sync` needs (AD-3, AD-24)."

`data/currencies.json` is a **fourth**. AD-21's reader column now reads: "`data/currencies.json` … `sync` **only** — it is deliberately absent from AD-24's fetch set, which is why AD-26's cap is a `sync`-side check." The PRD's eight-artifact fetch set already omits it, so nothing is false — but the enumeration reads as exhaustive, and the omission is now *load-bearing* rather than incidental.

> *Current:* "Each artifact carries `schemaVersion` and is validated on load; `web` refuses to render an invalid artifact rather than degrading (AD-3)."

FR-17's pinned cap is declared a "`data/tracked.json` validation error", and `tracked.json` is one of the eight artifacts `web` fetches and validates. Read together with this bullet, a builder can land on **refusing to render the entire site because the player pinned one row too many** — a total outage of a product whose premise is a static page that always renders, caused by a sync-budget concern the browser cannot even evaluate (one summand of the inequality is a sync-side fact about search cost, and the other file is not fetched).

> *Proposed:* add `data/currencies.json` to the non-fetched list with AD-21's reason, making it four. And qualify the refusal rule: **"refuses to render" applies to a schema-invalid artifact. A schema-valid artifact failing a cross-file policy check is reported, never a file-level refusal** — and FR-17's pinned cap is named as such a check, owned by `sync` alone. This mirrors FR-24/FR-33's existing treatment of the Base Type cross-check, which the PRD already assigns to `sync` on exactly the grounds that `web` cannot read the file.

Governing ADs: **AD-21, AD-24, AD-26, AD-3**.

### C-29 — FR-31 and §3 describe `data/config.json` as holding only the active league

> *Current (FR-31):* "The active league is configuration in `data/config.json`". UJ-6 describes a league reset as "edits the active league in `data/config.json`"; §3 says nothing about a second field; FR-33 lists `config.json` among the eight fetched artifacts validated on load.

No PRD sentence is false — FR-31 never claimed exclusivity — but none declares the second field either, and the PRD is where the builder of `contracts` looks for what a player-owned file contains. AD-19 now reads: "The active league id is configuration (`data/config.json` — which also carries AD-26's `minChunkSearches` and nothing else; it is a player-owned file, not a settings bag)."

> *Proposed:* add a consequence to FR-31 (or a bullet under FR-17, whichever the PM prefers as the home): `data/config.json` carries exactly the active league and `minChunkSearches` (FR-17, FR-19, AD-19, AD-26), plus `schemaVersion` per NFR-8, and is player-owned per NFR-5. **It is not a settings bag — a further field is an architecture amendment.** Add `minChunkSearches` to §3, either as its own entry or under *Chunk*. Note the two knock-ons: the `config.json` Zod schema gains a required numeric field, and FR-33's validate-on-load rule applies to it in `web` even though only `sync` reads it.

Governing ADs: **AD-19, AD-26**.

## 12. Low — bookkeeping, but visible

### C-30 — FR-14 should foreclose `minChunkSearches`, and now also owes `pinned`'s per-Chunk cost

FR-14's four-source table is **unaffected and needs no correction**: `minChunkSearches` generates no request. But FR-14 also carries "**A fifth source is an architecture amendment, not an implementation detail**", and a builder meeting a new search-denominated number in config could reasonably wonder whether budget machinery moved. One clause forecloses it.

> *Proposed:* `minChunkSearches` (FR-17, FR-19) is a validation yardstick, not a request source; it does not alter the four-source enumeration or the ~1,500-search full-refresh ceiling.

**[post-review]** AD-12's ceiling paragraph gained a second point FR-14's matching bullet does not carry, and it is the reason FR-17's cap exists at all:

> *Proposed (FR-14, ceiling bullet):* "**`pinned` entries spend from the headroom too, and they spend differently from everything else here**: a `pinned` entry costs a search in *every* Chunk rather than once per refresh, so its daily cost scales with **invocation cadence** rather than with the size of the tracked list. A pinned set at FR-17's cap can consume a substantial share of the measured ~2,400/day on its own — which is why `pinned` is a scarce designation rather than a convenience."

Governing ADs: **AD-12, AD-26**.

### C-31 — §10's OQ-8 … OQ-11 are closed and two of them now misdescribe the spine

§10's heading *"Raised against the spine by this revision"* introduces four items as open, each with "**Owner: architecture**". **All four are now closed by spine rev 3**, and two carry bodies that are actively wrong about the current spine:

| # | Resolved by | Hazard in the retained body |
| --- | --- | --- |
| OQ-8 | AD-26's two-ended cap — load-time inequality against `0.5 × config.minChunkSearches`, runtime truncation + starvation record | Still asserts "AD-26 caps the pinned set at *25% of AD-12's search ceiling*". A reader checking the spine against that sentence will not find the text and may conclude the **spine** is the stale document. |
| OQ-9 | AD-26's "What the `unresolvable` retry bound actually buys" paragraph — rationale replaced, not patched | — |
| OQ-10 | AD-27's `rankable(base)` predicate, applied to both halves of the fraction | Still asserts "The gate divides by every distinct `baseTypeId` in `data/tracked.json`" — no longer true of AD-27. |
| OQ-11 | AD-11 respelled ("every field required and none nullable"); AD-18 given an affirmative closure naming `contracts` as the enforcement point | — |

> *Proposed:* mirror the treatment §10 already gives BQ-1…BQ-3 — retitle to *"Raised against the spine by this revision — resolved by spine rev 3"*, **retain each item's analysis** as the record of why the decision is shaped as it is, and append a **Resolved:** clause to each naming the amended AD and the resolving text. Drop the **Owner: architecture** annotations. The analysis in OQ-8 and OQ-10 is particularly worth keeping, since neither argument survives in the amended ADs.

One caveat when retiring OQ-11: it was closed **syntactically**, not semantically — C-23 above is the residue, and the Resolved clause should say so rather than implying the ceiling question is finished.

### C-32 — §0 and the front matter are pinned to "final at revision 2"

> *Current (§0):* "`ARCHITECTURE-SPINE.md` is final at revision **2**, and its decisions AD-1 through AD-27 are **inherited, not re-decided**. AD-25 …, AD-26 … and AD-27 … are **new in revision 2**."

> *Current (front matter):* `revision: 2`; `inherits:` names the spine without a revision, so **it needs no change**.

The §0 banner's "all three were absorbed by **Architecture Spine revision 2**" framing is correct as history and can stay, with the rev-3 absorption added alongside it.

> *Proposed:* update §0 to revision **3**, and state plainly that revision 3 **amended AD-9, AD-11, AD-12, AD-18, AD-19, AD-21, AD-26 and AD-27 in place and added no new AD** — so the AD-1…AD-27 range and every existing `(AD-n)` citation in the PRD remain valid. That last clause is the reassurance that no other FR's citations went stale, and it is worth the sentence. Bump the PRD's own `revision` and `updated` front matter per the PM skill's convention.

## 13. Suggested order

Nothing here is blocked; every decision is made in the spine.

1. **C-23** — FR-29 and §3 edge alignment. It re-opens a *resolved* defect and is the only item on this list that can silently corrupt a price. Do it first even though C-22 is larger.
2. **C-22** — FR-17, all four parts. Delete the two notes before anything else in it, since they instruct a builder to ignore the spine.
3. **C-24, C-25** — the two definitional items (`lastAttemptedAt`; `minChunkSearches` vs FR-19) that silently change runtime behaviour.
4. **C-26, C-27** — the Sync Report's fifth record and FR-4's fraction. Both gate work that happens early: the report schema lands in `contracts` first, and the coverage measurement is the first build task.
5. **C-28, C-29** — artifact ownership and the config's second field.
6. **C-30, C-31, C-32** — FR-14's two clauses, the §10 retirement, and §0.

Items 1–3 are the ones where the current text misleads rather than lags. Items 4–5 are additive. Item 6 is bookkeeping and can ride along with any of them.

## 14. Observations outside this file's scope

Two drifts in the **inherited** set, neither a PRD edit, both worth a sweep on the next spine touch:

- `AGENT-WORKFLOW.md` still describes AD-26's rotation as "*pinned, then oldest-observation-first among `active`*". AD-26 and AD-9 have both said `lastAttemptedAt` since revision 2, and AD-9 exists precisely because observation-ordering starves permanently `no-listings` entries. An agent building `sync` from the workflow document builds the defect AD-9 was amended to prevent.
- `AGENT-WORKFLOW.md` and `WEIGHTS-FILE-SCHEMA.md` both restate AD-27's coverage measurement on the **pre-amendment denominator** ("the distinct `baseTypeId`s in `data/tracked.json`"). The workflow document is the instruction an agent executing the build actually reads, so the gate that selects between "footer" and "first-class surface" will be computed on the un-narrowed denominator by anyone following it. C-27 fixes the PRD; these two need the same predicate or a pointer at AD-27.

## 15. How to run this

Same as §8 — a new session, from the project root:

```
/bmad-prd
```

Then give it this intent:

> Update `docs/prds/prd-poe-crafting-base-price-checker-2026-09-12/prd.md` against the
> **Revision 3** section of
> `docs/architecture/architecture-poe-crafting-base-price-checker-2026-09-12/PRD-EDIT-PROPOSALS.md`.
> The sections above it were already absorbed as PRD revision 2 — do not re-apply them.
> Architecture Spine revision 3 amended AD-9, AD-11, AD-12, AD-18, AD-19, AD-21, AD-26 and
> AD-27 in place and added no new AD, so every existing `(AD-n)` citation stays valid.
> Work the eleven proposals in the order given in §13. All decisions are settled.

---

# Revision 4 — after the producer's two-number-modifier defect

**Trigger.** The weights-file producer reported that contract 2.0.0 was unsatisfiable: a modifier rolling two numbers ("Adds 13 to 20 Physical Damage") has no tier-to-value mapping, so tier bands overlap in value space and every collapsing rule leaves 170–1,250 overlapping pairs. 53 of 63 item classes carry such modifiers. Spine revision 4 answers it with **AD-28** (decompose over the value axis into cells × item-level cohorts, mass conservation as the invariant), plus amendments to **AD-5** (`ModifierRef` becomes a discriminated union `banded | valueless`), **AD-10** (fourth provenance `modelled-split`), **AD-11**, **AD-16**, **AD-17**, **AD-18** and **AD-27**. The weights contract is reissued at **3.0.0**.

**Headline: 20 proposals — C-33…C-52.** Four are severe: the PRD as written would refuse a conforming file, or instruct the curator to build the defect AD-28 removes. The full analysis for C-33…C-49 is in `reviews/review-rev4-reconcile.md`; C-50…C-52 arise from the reviewer-gate fixes applied after it ran.

## 16. Severe — the PRD refuses conforming files or misdirects the curator

| Id | Location | The problem |
| --- | --- | --- |
| **C-33** | §3 *Provenance* | Fixes a **three-value** enum. Read as the `contracts` Zod source it rejects every `modelled-split` entry — most weapon classes — and `core` refuses an invalid file outright, turning a correct file into a total outage. |
| **C-35** | FR-27 | The hard-error list's unscoped *"overlapping value bands for one `statId` within a slot"* **refuses a conforming 3.0.0 file**: the contract's own worked example emits `[56,56.5]` twice by construction. Scope it to *"at the same `itemLevelMin`"*. Also still pinned to schema 2.0.0. |
| **C-36** | FR-22, §3 *Accepted Tier* | Instructs the curator that "accept tier 2" means writing that tier's value edges. For a multi-`#` modifier those edges land mid-cell and fail AD-18's edge-alignment at load. |
| **C-34** | §3 *Modifier Reference* | Admits only the banded kind, and its *"always"* makes the `valueless` case unrepresentable. |

## 17. High — silent divergence a builder cannot resolve from the PRD

| Id | Location | The problem |
| --- | --- | --- |
| **C-37** | §3 *Modifier Weight* | Describes a tier row, not a cell within a cohort. |
| **C-38** | FR-29 | Containment rule has no `valueless` branch. |
| **C-39** | FR-16 | Overlap predicate is missing two of `slotOverlap`'s four branches. |
| **C-40** | FR-21 | Stat filter has no valueless form and assumes integer edges. |
| **C-41** | FR-10, FR-11 | Collapse `modelled-split` into the placeholder bucket, losing the distinction AD-10 created it for. |
| **C-42** | FR-28 | Silent on TBD placeholder rows, so a producer reading the PRD drops them and still claims `complete`. |

## 18. Medium and low

| Id | Location | The problem |
| --- | --- | --- |
| **C-43** | FR-27 | *"Must not pre-aggregate bands"* now reads against AD-28's decomposition. |
| **C-44** | §3 *Eligible Pool* | Describes one band per interval. |
| **C-45** | FR-10 | `gamePatch` has a render requirement but no definition anywhere. |
| **C-46** | §10 | No open question for the filter unit, which is blocking for correctness. |
| **C-47** | §0, front matter | Pinned to *"final at revision 2"*. |
| **C-48** | §10 OQ-11 | Retained body is now doubly wrong about the spine. |
| **C-49** | addendum | *"Adjacent disjoint tiers may both be tracked, which is now the point"* is true of only one modifier class. |

## 19. New requirements revision 4 creates

| Id | Requirement |
| --- | --- |
| **C-50** | The weights file carries **`cohortTotals`** — the pre-split sum of a cohort's tier weights — and `core` refuses a file whose emitted cells do not sum to it. This is the only mechanical check on mass conservation and belongs in FR-27's hard-error list, alongside the new *"a cell carried by more than two cohorts"* error. |
| **C-51** | **Curation targets interior cells.** AD-16 prices a reference from its cheapest 10 listings, so a reference spanning a boundary cell is priced at the neighbouring tier's tail while carrying the whole span's mass — and below the threshold it truncates to zero. FR-22's curation guidance must say so; this is the BQ-1 failure mode re-entering through a heterogeneous band. |
| **C-52** | **Coverage is re-measured on every weights-file regeneration**, not once before view work (AD-27), and `sync-report.json` carries the figure. Declining the `unidentifiedWeight` escape hatch makes `partial` a recurring patch-cadence state, so a product measuring 85% at launch can sit at 60% the week after a patch with nothing reporting it. |

## 20. Suggested order

C-33 and C-35 first — until both land, the PRD describes a system that rejects the file the producer is about to ship. Then C-36 and C-51 together, since both concern what a curator writes. Then C-34, C-37…C-40 as one `contracts`-shaped pass. C-41, C-42, C-50, C-52 next. Bookkeeping (C-43…C-49) last.

## 21. How to run this

A new session, from the project root:

```
/bmad-prd
```

> Update `docs/prds/prd-poe-crafting-base-price-checker-2026-09-12/prd.md` against the
> **Revision 4** section of
> `docs/architecture/architecture-poe-crafting-base-price-checker-2026-09-12/PRD-EDIT-PROPOSALS.md`.
> The sections above it were already absorbed — do not re-apply them.
> Architecture Spine revision 4 amended AD-5, AD-10, AD-11, AD-16, AD-17, AD-18 and AD-27
> in place and added **AD-28**, so every existing `(AD-n)` citation stays valid.
> Full analysis for C-33…C-49 is in `reviews/review-rev4-reconcile.md`.
> Work the twenty proposals in the order given in §20. All decisions are settled except
> the filter-unit Open Question, which is owned by the weights scraper project.

---

# Revision 5 — absorbing PRD rev 4's eight items, and a second producer defect

**Two triggers, worked in one revision.**

The first is the PRD itself. PRD revision 4 is **final** and absorbed spine revisions 3 and 4 in full, but it raised five items plus three smaller drifts back against the spine — each a place where two documents disagreed, or one decision did not compose with another. None blocked the PRD; each had a safe reading the PRD already stated. **All eight are now absorbed, seven in the PRD's own direction.**

The second is the weights-file producer, again: **a poe2db row may publish several distinct trade stats at once**, sharing one spawn weight, because the game rolls that modifier as a unit. Measured 2026-09-13 — 560 of 8,437 in-scope rows, 534 with two stats, 18 with three, 8 pairing a banded line with a flat one; exploding them takes 8,437 rows to 9,015 stat-line units. This is **not** revision 4's case of one stat rolling two numbers, which AD-28 already handles. Spine revision 5 answers it with **AD-29**.

## 22. What revision 5 amends and what it adds

The field PRD OQ-15 was about, so it is stated plainly and checked against `.memlog.md` rather than against any prior banner.

| | ADs |
| --- | --- |
| **Added** | **AD-29** — one game modifier may publish several stat lines, and the draw is over modifiers |
| **Amended in place** | **AD-5, AD-6, AD-9, AD-11, AD-16, AD-17, AD-18, AD-26, AD-28** |
| **Renumbered or retired** | none — the range is now `AD-1 … AD-29` |

**Every existing `(AD-n)` citation in the PRD therefore remains valid**; only the nine ADs' contents moved, and one id is new.

Revision 5 also changes material **outside** the AD set, which is exactly what the two earlier banners under-reported and what OQ-15 asked to be fixed:

- three **Consistency Conventions** rows — *Numeric precision* (now 2 dp, scoped to `PriceObservation`, with `CurrencyRate` exempt), *Bands* (non-overlap key), and *Ids* (the `sourceModifierId` carve-out);
- one new **Deferred** item — *pricing a deliberate conjunction of co-occurring stats*;
- both earlier **revision notes**, corrected in place.

The weights contract is reissued at **4.0.0** (breaking) and moves from `status: draft` to `final`.

## 23. The eight items PRD rev 4 raised — how each was settled

Recorded here because the PRD's §10 entries for three of them must move from *open* to *resolved*, and the resolution direction is what the retained record should say.

| PRD item | Direction | Settled as |
| --- | --- | --- |
| **AD-9's self-contradiction** | the PRD's | `lastAttemptedAt` is **declared** in all four states but **present** only where a request was issued. A never-synced entry carries none, renders *never attempted*, and **must not** be given a placeholder — which would both lie on screen and sort as freshly-attempted in a rotation that treats it as infinitely old. |
| **OQ-14** — uncatalogued ids | AD-6's | The check stays `sync`'s and **report-only**; the file loads. The contract's hard-error row is removed, and AD-6 now says why the file-refusal reading cannot stand: `core` never holds `catalogue/items.json` (AD-24), so the only component that could refuse the file cannot evaluate the check. |
| **OQ-13** — price precision | **the spine's, by the player's own reversal** | Precision **stays at 4 decimal places** and **FR-23 moves to match** — the one item here where the PRD changes rather than the spine. The player reverted their 2-decimal call on being shown that a single precision has to serve the **cost** side too: a crafting currency is worth a fraction of a divine, and on a 2-decimal grid a cheap orb rounds toward `0.00`, FR-26's Craft Cost collapses, and FR-1's subtraction becomes a silent no-op that inflates every EV. See **C-77**. |
| **AD-16's even-sample median** | the PRD's | **Lower of the two middle values**, absorbed with all three of FR-21's reasons. |
| **OQ-15** — revision notes | corrected | Both banners rewritten. **The PRD's own rev-3 list is also wrong** — see C-63. |
| **AD-17 cross-kind rejection** | confirms the PRD | Split by what each component can see: `contracts` within-file, `core` between-files. |
| **AD-28's `Binds`** | fixed | `sync` added, with a sentence saying what binds it — `sync` may not round a cell edge to reach an integer filter. |
| **The contract's drift** | fixed | `status: final`; the identity tuple corrected to AD-5's **three**, with `itemLevelMin` and `sourceModifierId` named as *locators* rather than identity. |

## 24. AD-29 in one paragraph, for the PM

A producer splits a multi-stat row at its line breaks and emits **one entry per stat line, each carrying the source row's full weight** — which is the only reading that gives each `statId` the right marginal probability. Every entry carries a required **`sourceModifierId`** naming the source row it came from. The duplication is then paid for in the **denominator**: AD-18 sums over distinct source modifiers rather than over entries, so a modifier publishing three stat lines contributes its weight once. The same marker preserves co-occurrence, which `core` needs immediately — two tracked entries in one slot naming two lines of one modifier are **both satisfied by a single item**, so AD-17's overlap predicate gains a `coOccur` branch or that base's `ΣP` exceeds 1 and it takes the top of the ranking.

**`sourceModifierId` names one source row — one *tier* of one modifier — never a modifier family.** The granularity is fixed by the spine rather than left to the producer, because both readings conform to everything else and they disagree about which items satisfy two references at once. A group therefore sits in exactly one item-level cohort, which is what makes the denominator's per-group mass well-defined.

## 25. Severe — the PRD implements what the spine now forbids

Continuing the `C-` series. **25 proposals, C-53…C-77** — 7 severe, 7 high, 6 medium, 3 low, plus 2 new requirements. The full analysis for C-53…C-74 is in `reviews/review-rev5-reconcile.md`; C-75 through C-77 arise from the reviewer-gate fixes applied after it ran, and two of its items are **corrected below** where a gate fix moved the answer after the review was written.

### C-53 — FR-16's overlap predicate states the negation of AD-17's new branch

> *Current (FR-16):* `slotOverlap` reads `false if x.statId != y.statId`, unconditionally.

This is the highest-consequence item in the set. A builder implementing FR-16 as written lets a base whose two tracked entries name two lines of one hybrid modifier reach `ΣP > 1` and take the top of the ranking — precisely the class of defect FR-16 exists to prevent, and which its own prose twice boasts of having caught.

> *Proposed:* adopt AD-17's amended predicate, with the co-occurrence branch **above** the inequality case:
>
> ```
> slotOverlap(x, y) =  true              if x is absent or y is absent
>                      true              if x.statId != y.statId ∧ coOccur(x, y)
>                      false             if x.statId != y.statId
>                      true              if both are valueless
>                      bands intersect   otherwise
> ```

Carry three things with it, the last two of which are **corrections to the reconcile review**, which was written before the gate pass:

- `coOccur(x, y)` holds when some `sourceModifierId` in the scoped pool emits an entry contained by `x` **and** one contained by `y`, in the same item-level cohort. It is a **cross-file** check owned by `core` at load, like FR-29's straddle and edge-alignment rules.
- Its scope `L` is **the base's own crafted Item Level Floor** — the same `L` that scopes every probability on the base, and FR-16/AD-17 give a base exactly one.
- **Where the pool cannot answer** — a Base Type absent from the Weights File, or one whose pool is `partial`: **two cases, not three** — `coOccur` is **`false` and the Tracked List still loads.** FR-28/AD-18 have already made such a base Unrankable, so the partition `coOccur` protects is never summed for it. Refusing instead would take the whole site down over a Base Type that was never going to rank. Say this explicitly: without it one builder short-circuits and renders while another rejects `tracked.json` site-wide, and both readings satisfy the predicate as stated.

  > **Correction, applied in spine revision 6 — do not re-introduce the third case.** This proposal originally listed *the uniform-prior bootstrap* alongside the two above. That is wrong, and the PRD deviated from it deliberately and correctly when applying C-53. **AD-17 names only the two.** Contract `4.0.0` requires `sourceModifierId` on **every** entry regardless of the file's provenance, and the bootstrap is a *weighting* shortcut only — it still carries genuine pool membership, cell edges and `itemLevelMin` — so a uniform-prior file declaring `complete` answers `coOccur` exactly like any other and its Base Types **rank**. That is what makes the third case unsafe rather than merely redundant: C-53's own safety argument is that such a base is already Unrankable and never summed, and for a ranking uniform-prior file that argument does not hold. Returning `false` there would suppress a real co-occurrence and let `ΣP` exceed 1 — the very defect the branch exists to prevent. FR-16 states two cases and adds an explicit sentence that a uniform-prior file is not one of them.

Governing ADs: **AD-17, AD-29**.

### C-54 — FR-29's denominator sums over entries, not over source modifiers

> *Current (FR-29):* "Both numerator and denominator are drawn from the same item-level-scoped pool, scoped to the entry's Item Level Floor `L`", with no distinction between the two halves beyond scope.

> *Proposed:* AD-18's amended ratio. The numerator still sums over **entries** in the containment set; the denominator sums over distinct **`sourceModifierId`**:
>
> ```
> Σ { mass(g) : g ∈ sources(scoped(base, slot, L)) }
> ```

**Correction to the reconcile review:** it gives this as `mass(g, L)`. After the gate pass **`mass(g)` carries no `L`** — a source row is one tier and so sits in exactly one cohort, so a group is admitted by the scope whole or not at all and there is nothing to reconcile across cohorts. `mass(g)` is the common value of `Σ { e.weight : e ∈ g, e.statId == s }` over each `statId s` the group publishes. Use the un-subscripted form.

State the reason, because the defect is invisible to any single-stat test: an affix draw selects a **modifier**, so one publishing several stat lines contributes its weight once. Summing over entries inflates the denominator by each hybrid's surplus lines and understates every probability on the base — **unevenly**, so it *reorders* the ranked list rather than shifting it. For a pool of single-stat modifiers the two readings coincide exactly, which is why a builder can implement FR-29 as written, pass every test built from a single-stat fixture, and be silently wrong on 560 of 8,437 real rows.

Governing ADs: **AD-18, AD-29**.

### C-55 — §3 *Modifier Weight* and FR-27 omit the required `sourceModifierId`

> *Current (both):* `(statId, kind, valueMin, valueMax, itemLevelMin, weight, provenance)` banded, `(statId, kind, itemLevelMin, weight, provenance)` valueless.

> *Proposed:* add `sourceModifierId` to **both** shapes, **required on every entry** — not hybrid-only. Carry the contract's reason: required everywhere so `core` has one identity notion rather than two code paths, and so a producer forgetting it on a hybrid cannot emit a file that still validates.

A producer building to the PRD's current tuple emits a file `core` refuses at load. Governing AD: **AD-29**.

### C-56 — FR-27's hard-error list is stale in four ways

> *Proposed:* four corrections against the contract's 4.0.0 `## Validation` section:
>
> 1. the duplicate key becomes `(sourceModifierId, statId, kind, valueMin, valueMax, itemLevelMin)`;
> 2. non-overlap is scoped by `sourceModifierId` **as well as** `itemLevelMin` — two distinct game modifiers may legitimately publish the same stat over the same values, and refusing that file would force a producer to merge them, destroying the co-occurrence marker on both;
> 3. **new error:** a missing `sourceModifierId`;
> 4. **new error:** a `sourceModifierId` group whose per-`statId` weight sums **disagree** — the same shape and reason as `cohortTotals`, and the only mechanical check on the explosion.

**Correction to the reconcile review, and it matters:** the review closes by proposing that the cohort-carriage error be scoped to `(base, slot, statId, sourceModifierId)`. **Do not apply that.** The gate found it makes the check **vacuous** — a source row is one tier and therefore has exactly one cohort, so a per-row count can never exceed 1, and AD-28's only mechanical defence against a degenerate coarse partition would be silently disarmed. **The key stays `(base, slot, statId)`**, counted across every source modifier publishing that stat. The two keys differ deliberately, and FR-27 should say why: non-overlap is narrowed by `sourceModifierId` to keep two modifiers' mass separable; the carriage bound is not, because only a family-wide count can see a partition cut too coarsely.

Governing ADs: **AD-28, AD-29**.

### C-57 — the contract is cited as 3.0.0 in four places, and 4.0.0 is breaking

> *Current:* §3 *Weights File*; FR-27 twice; §10 BQ-2's "2.0.0 — 3.0.0 at the current revision".

> *Proposed:* **4.0.0** throughout, and FR-27's refusal clause widened to **1.x, 2.x or 3.x**.

Severe rather than bookkeeping because §7.3 names the Weights File a release dependency from a near-complete external project: a 3.0.0 file in flight when revision 5 landed is now refused at load, and the PRD is the document that project's owner reads for the version number. Governing AD: **AD-11**.

### C-58 — §3 *Eligible Pool* characterises the denominator as the scoped set of cells

> *Current:* "the **scoped pool is the denominator** of every probability for that entry".

> *Proposed:* the scoped pool is the **domain** the denominator is computed over; the denominator is the sum of **source-modifier masses** within it, not the sum of its cells.

As written, the glossary — which §0 declares normative for every FR using the term — states the exact defect AD-29 exists to remove, in the one place a reader goes to settle a disagreement. Governing ADs: **AD-18, AD-29**.

## 26. High — stale in a way a reader will act on

### C-59 — the glossary has no term for the source modifier

**Sequence this ahead of C-53…C-56**: §0 commits the document to being glossary-anchored and to FRs using glossary terms verbatim, so those four cannot be written without the term existing.

> *Proposed:* a **Source Modifier** entry (and/or **`sourceModifierId`**, matching the `lastAttemptedAt` and `cohortTotals` precedent of naming the field), carrying: one game modifier may publish several distinct trade stats under one spawn weight, rolled as a unit; the producer emits one entry per stat line, each carrying the row's **full** weight; the id names **one source row — one tier of one modifier, never a family**, so a group sits in exactly one Cohort; it is producer-assigned, opaque, stable within one `(Base Type, slot)`, never validated against the Trade Catalogue, and **never part of a Modifier Reference, a Tracked Entry or its canonical key**.

Governing AD: **AD-29**.

### C-60 — §0 describes the inherited spine as revision 4, AD-1 through AD-28

> *Proposed:* revision **5**, **AD-1 through AD-29**, contract **4.0.0**. State what revision 5 added (AD-29) and amended (**AD-5, AD-6, AD-9, AD-11, AD-16, AD-17, AD-18, AD-26, AD-28**), recompute the "further thirteen decisions" arithmetic, and **retain the AD-id stability claim** — it still holds and is the reassurance that no other FR's citations went stale.

### C-61 — §10 OQ-13 is listed as open; it is resolved **against** the PRD

> *Proposed:* move to resolved, recording that this is the one item of the eight where the **PRD changes and the spine does not**, and why — see C-77 for the edit itself.

OQ-13 argued that four decimals are more precision than a Divine price has or needs, which is true of the **payout** side and was never tested against the **cost** side. Retain that argument in the record, and add the reason it did not carry: one precision governs every persisted Divine value, FR-26's Craft Cost among them, and 0.01 is not fine enough for a currency worth a fraction of a Divine. The player reverted the call on that basis. Worth noting in the record that the concern OQ-13 raised is still granted — the precision is simply pinned by the cheaper quantity, not by the price.

### C-62 — §10 OQ-14 is open, and FR-27 asserts a disagreement that no longer exists

> *Current (FR-27):* "**`WEIGHTS-FILE-SCHEMA.md` disagrees** and states it as a hard file error — see §10 OQ-14."

> *Proposed:* OQ-14 moves to resolved, recording the direction (AD-6's — the check is `sync`'s and report-only, the file loads) and the rejected alternative (file-refusal, which would need AD-24 amended to fetch a ninth artifact). **FR-27's "disagrees" clause must go or invert** — the contract now agrees, and a reader acting on the stale sentence would hunt a contradiction that has been fixed.

*(The reconcile review flagged one contract cell still carrying the old text. It was fixed during the gate pass — the `## Field rules` `statId` and `bases` key rows now both name `sync` and report-only. No residue remains.)*

### C-63 — §10 OQ-15 is open, and **its own revision-3 list is wrong**

> *Current:* gives revision 3 as "AD-9, AD-11, AD-12, AD-18, AD-19, AD-21, AD-26 and AD-27" — eight ADs, **omitting AD-24**.

> *Proposed:* move to resolved **and correct the list on the way**. `.memlog.md`'s rev-3 closing entry names **nine**, including **AD-24** — the gate fix that names `data/currencies.json` among the files `web` does not fetch and closes the set at eight. The spine's corrected banner is right; the PRD's list is not. The revision-4 list is correct and needs no change.

This is a **correction, not a retirement**: unlike OQ-13 and OQ-14, the PRD's OQ-15 body carries a factual error of its own, and closing it without fixing the list would preserve the error in the record. Worth recording *why* it surfaced — the spine went back to the memlog rather than copying the PRD.

### C-64 — FR-23's `[NOTE FOR PM]` claims to supersede the spine

> *Proposed:* **delete it.** The note says FR-23 supersedes the spine's 4 decimal places and routes the reader to OQ-13. Both halves are now wrong in the same direction: the spine keeps 4 dp, FR-23 adopts it (C-77), and there is no conflict left to escalate. The note did its job — it triggered exactly the review cycle it was written for, and the review went the other way.

### C-65 — FR-28 states pool completeness over modifiers, not stat lines

> *Current:* "must enumerate **every modifier** that can roll there at any item level."

> *Proposed:* add the contract's 4.0.0 clarification — **pool completeness counts stat lines, not rows.** A `complete` pool enumerates every stat line every rollable modifier publishes; emitting one line of a hybrid and dropping the other is the same defect as dropping a modifier outright.

Without it a producer reading FR-28 alone can drop the second line of each of the 560 hybrid rows and still believe it declared `complete` honestly — which shrinks numerators without touching the denominator, the mirror of the defect FR-28's own text argues against. Governing ADs: **AD-11, AD-29**.

## 27. Medium

| Id | Location | The edit |
| --- | --- | --- |
| **C-66** | §3 *Modifier Reference* | Add AD-5's new clause — a reference names a **stat line**, not a game modifier. The thing the game draws is the source modifier, which lives on the Weights File and never on a reference, because a curator can only filter on what trade exposes. This is the sentence that stops a reader concluding `sourceModifierId` belongs on a Tracked Entry. |
| **C-67** | FR-1 | The partition consequence names only band overlap. Add co-occurring stat lines as a second, non-obvious way for it to break — two references on distinct `statId`s, no bands intersecting, both satisfied by one item. It belongs here as well as in FR-16, because FR-1 is where the `ΣP ≤ 1` premise is asserted. |
| **C-68** | §7.2 Deferred | Add the spine's *pricing a deliberate conjunction of co-occurring stats*. Recording it matters because the deferral is **why** FR-16 rejects a configuration a curator will plausibly try. |
| **C-69** | §7.3 Release Dependencies | Note the second breaking contract revision (3.0.0 → 4.0.0) against the near-complete producer: a 3.0.0 file is refused at load, and the producer must add `sourceModifierId` to every entry and satisfy group consistency. |
| **C-70** | FR-16 | The "three consequences" list becomes **four** — two entries in *one* slot naming two lines of one source modifier, which no bands-intersect or slot-conjunction reading catches. Same failure as the third case, reached from the other direction. |
| **C-71** | FR-22 | The curation rules say nothing about co-occurrence. Tell the curator that two Modifier References naming two stat lines of one source modifier cannot both be tracked in one slot — a load-time rejection under FR-16, not a budget question — and that isolating such a conjunction is deferred (C-68). |

## 28. Low

| Id | Location | The edit |
| --- | --- | --- |
| **C-72** | §0 | "Two further rounds have since closed." **Three** have. Add a revision-5 sentence mirroring the rev-3 and rev-4 ones. |
| **C-73** | §10 preamble | "OQ-12 through OQ-14 are open" — after C-61/C-62/C-63 only **OQ-12** is open, and it alone is owned outside the repository. Narrow the sentence. |
| **C-74** | §3 *Base Type* | The flat ids rule ("never re-encoded into an internal id") now has an explicit carve-out in the spine's conventions for `sourceModifierId`. A reader could read the flat rule as forbidding the new field. |

## 29. New requirements revision 5 creates

These three arise from the reviewer-gate fixes and are **not** in `reviews/review-rev5-reconcile.md`. C-77 also carries a decision the player made after that review ran, which **reverses** the direction §23 and C-61 originally recorded for OQ-13.

One knock-on rides with C-77: **FR-21's median consequence cites "FR-23's 2-decimal grid"** as a reason for taking the lower of two middle values. The reason survives the reversal but the grid reference does not — restate it as the spine does, that each listing is normalised and rounded **once on the way in**, so choosing one of them cannot leave the grid where a mean would. That argument holds at any precision, which is why it is worth decoupling from the number.

| Id | Requirement |
| --- | --- |
| **C-75 — high** | **§3 *Cohort* describes the emission as per `(cohort, cell)`; it is now per `(tier, cell)`.** A tier *is* a source row and an entry names exactly one, so a per-cohort entry would have to name two source rows or discard one where two tiers share a cohort — the first unrepresentable, the second destroying a co-occurrence marker. The entry's weight is `w(t) × P(value ∈ c \| t)` for its own tier, not a sum across the cohort. Cohorts remain, and remain `itemLevelMin`-**equality** groupings, because `cohortTotals` is still stated per cohort (AD-28, AD-29). |
| **C-76 — high** | **FR-17 row 2 and §3 key "infinitely old" on the `not-yet-synced` Price State; it must key on an absent `lastAttemptedAt`.** FR-12/AD-9 have now decoupled the two: FR-23 writes `not-yet-synced` with reason `no-exchange-rate` for an entry that *was* attempted and carries a fresh timestamp. Sorting that entry as infinitely old re-selects it every Chunk and lets it monopolise the rotation permanently — the same starvation row 2's ordering exists to prevent, reached through the Price State instead of the observation time (AD-9, AD-26). |
| **C-77 — severe** | **FR-23's persisted precision returns to 4 decimal places — the player has reversed the 2-decimal call.** FR-23 currently states two decimals and carries a `[NOTE FOR PM]` claiming to supersede the spine (C-64, now a deletion). The reversal's reason belongs in FR-23 with the number, because it is not the reason the original call was made: **one precision governs every persisted Divine value, and it is pinned by the cheapest one, not by the price.** A crafting currency is worth a small fraction of a Divine — the very reason FR-23 normalises at all — so on a 2-decimal grid a cheap orb rounds toward `0.00`, FR-26's Craft Cost collapses, and FR-1's subtraction becomes a silent no-op that **inflates every EV in the product**. At 0.0001 Divine one rule safely covers both sides. State that a future coarsening would have to exempt `CurrencyRate` deliberately rather than let it inherit the rule. OQ-13's own argument — that four decimals exceed what an asking-price estimate carries — is still granted and is retained at C-61; it simply does not set the precision. |

## 30. Suggested order

1. **C-59** first — the glossary term has to exist before the FR text can use it verbatim, which §0 requires.
2. **C-53, C-54, C-55, C-56** as **one pass**. They are four faces of AD-29 and applying any one alone leaves the PRD internally inconsistent — FR-29's denominator de-duplicating on a field FR-27's entry shape does not require. Note the two corrections to the reconcile review carried in C-54 and C-56.
3. **C-77**, then **C-57**. The first is the one item here that silently corrupts every ranked row; the second is what the external producer reads for a version number.
4. **C-76, C-75** — the two runtime-behaviour items.
5. **C-58, C-65, C-70, C-67, C-71, C-66** — the pool/partition/curation pass.
6. **C-60, C-61, C-62, C-63, C-64, C-68, C-69** — §0, the §10 retirements (C-63 is a *correction*), and the two record additions.
7. **C-72, C-73, C-74** — bookkeeping, can ride with anything.

Nothing here is blocked, and **nothing asks the architecture to decide anything**. Every item is the PRD catching up to a settled amendment.

## 31. How to run this

A new session, from the project root:

```
/bmad-prd
```

> Update `docs/prds/prd-poe-crafting-base-price-checker-2026-09-12/prd.md` against the
> **Revision 5** section of
> `docs/architecture/architecture-poe-crafting-base-price-checker-2026-09-12/PRD-EDIT-PROPOSALS.md`.
> The sections above it were already absorbed — do not re-apply them.
> Architecture Spine revision 5 amended AD-5, AD-6, AD-9, AD-11, AD-16, AD-17, AD-18, AD-26
> and AD-28 in place and added **AD-29**, so every existing `(AD-n)` citation stays valid.
> The weights contract is reissued at **4.0.0**, breaking.
> Full analysis for C-53…C-74 is in `reviews/review-rev5-reconcile.md` — but note that
> C-54 and C-56 carry deliberate **corrections** to that review, applied after it ran.
> C-75, C-76 and C-77 are not in it at all.
> Work the twenty-five proposals in the order given in §30. All decisions are settled
> except the filter-unit Open Question, which is owned by the weights scraper project.

---

# Revision 6 — OQ-16, and the two candidates PRD rev 5 raised

Continuing the `C-` series. **9 proposals, C-78…C-86** — 2 severe, 3 high, 2 medium, 2 low, plus 1 new requirement.

Revision 6 was opened on three items PRD revision 5 raised plus one correction to this file. **PRD revision 5 is final and has absorbed spine revision 5 in full** — §22–§31 above are applied and nothing in them is outstanding. Do not re-apply them.

## 32. What revision 6 amends

**AD-18, AD-28 and AD-29 amended in place. No AD added. No AD renumbered — 29 total.** The weights contract goes to **`4.1.0`**, a **non-breaking minor**: a conforming `4.0.0` file is a conforming `4.1.0` file, and no producer work is invalidated.

One thing to carry into the PRD before anything else: **an earlier reading was wrong, and the correction is the substance of this revision.** Revision 6 first accepted the dropped-Stat-Line gap on the ground that it could not reorder the ranking. The reviewer gate falsified that. It holds only where the dropped stat has a single publisher; where two Source Modifiers publish one `statId`, the failure is silent and can take a Base Type to the top of the list. Any PRD text repeating the benign reading must be corrected, not merely extended.

## 33. Severe — the PRD states something now false

### C-78 — FR-29's empty-containment-set error is only half the story

> *Current (FR-29):* names two causes for an empty containment set — a bad Modifier Reference, or a Weights File that dropped a Stat Line — and leaves which document is wrong to the reader.

Right as far as it goes, and it must now say **when it fires**. The error is raised only where the dropped Stat Line's `statId` had a **single** publisher. Where a second Source Modifier publishes the same `statId` — which AD-29 expressly permits — the containment set is **not** empty, nothing is reported at all, and the reference's numerator silently loses that modifier's share, deflating its probability on that Base Type alone. Add the asymmetry, and say plainly that the silent case is what `statLineCounts` exists for.

Governing ADs: **AD-18, AD-29**.

### C-79 — FR-27 must carry the exactness rules, which no requirement states

The contract's exact-equality rules never fixed a decimal precision, a rounding rule, a float epsilon **or a summation order** — and three conforming `core` implementations returned three different verdicts on one file. FR-27 should state, as the copy the external producer reads:

- The comparison is over **parsed IEEE doubles**, summed in **the file's own entry order**, with **no tolerance and no pre-rounding**. Comparing serialised decimals at a common scale is a *different* test that accepts files this one refuses.
- **Two** rules `core` applies at load (cohort conservation; a group's per-`statId` agreement). A third — a tier's split summing to that tier's weight — `core` cannot apply at all, since tier weights never enter the file. That is *why* the two checkable ones are not softened.
- Band edges are compared exactly for a **separate** reason: an integer or half-integer lattice is exact in binary, and a near-miss edge is a straddle rather than a rounding artefact.
- How a producer discharges it: emit values exact in binary (**preferred**), or let a residue-absorbing cell close each sum (**fallback**, unsound where a cell is constrained by both sums).
- A refusal reports the observed sum, the expected total and the **signed difference**.

Governing ADs: **AD-28, AD-29**.

## 34. High — silent divergence a builder cannot resolve from the PRD

### C-80 — FR-27 gains the optional `statLineCounts` field

A per-`(base, slot)` list of `{ sourceModifierId, statLineCount }`, a sibling of `cohortTotals` in placement and terms: permitted everywhere, checked wherever present, omitted for any group the producer cannot vouch for. The count is the number of distinct Stat Lines the **source row as scraped** publishes, taken *before* the explosion — recomputing it from the entries just emitted makes the check vacuous, and FR-27 should say so. A listed group whose distinct `statId` count disagrees, or a listed `sourceModifierId` matching no entry, is a hard file error.

### C-81 — FR-27 gains the one-Cohort hard error

A `sourceModifierId` group whose entries carry more than one distinct `itemLevelMin` is now a hard file error. AD-29 always held that a source row is one tier and therefore one Cohort, but nothing enforced it — which left `mass(g)` with two conforming readings, whole-group or per-Cohort, and so two different denominators. Nothing conforming is newly refused.

### C-82 — §3 Glossary: `Source Modifier` gains the line-count and one-Cohort facts

The entry already carries the full-weight explosion rule and the one-tier-never-a-family granularity. Add that a group may declare how many Stat Lines it publishes, and that sitting in exactly one Cohort is now checked rather than assumed.

## 35. Medium

### C-83 — §10 retires OQ-16

Resolved in AD-18's direction, exactly as the PRD argued: AD-29 no longer writes `mass(g, L)`. Retire it on the established pattern, recording the direction and that the respelling was accompanied by *enforcing* the one-Cohort property the spelling depends on — the correction alone would have left the ambiguity it was meant to remove. **The open count returns to one: OQ-12 only**, still owned outside this repository.

### C-84 — §7.2 records the two new Deferred items

Making `statLineCounts` required — to be folded into the next breaking revision rather than deferred again — and a relative epsilon on the two sum rules.

## 36. Low — bookkeeping, but visible

### C-85 — contract version references move to `4.1.0`

Every `4.0.0` in §3, FR-27 and §10 BQ-2. Note in passing that the refusal rule is unchanged — `core` refuses an unknown **major**, so `4.0.0` and `4.1.0` interoperate.

### C-86 — §7.3 records that the producer gains work it can schedule

`4.1.0` is non-breaking, so the release dependency is **not** re-gated. `statLineCounts` is adopted when the producer is ready.

## 37. New requirement revision 6 creates

**A dropped source *row* has no mechanical check at all, and it is the larger gap.** `statLineCounts` guards the Stat Lines within a row; nothing guards the set of rows. `cohortTotals` is only *required* where a family carries a `modelled-split` entry, and most rows are single-stat and undecomposed — so a row dropped from a pool still declaring `complete` shrinks the denominator and **inflates every probability on that Base Type**, which reorders. It is strictly worse than a dropped line and has nothing behind it but the `poolCoverage` declaration itself. State this where the PRD states FR-28's completeness rule, with the mitigation: emitting `cohortTotals` for every family is permitted and encouraged, and narrows the gap considerably.

## 38. Suggested order

1. **C-78 and C-79** first — both correct or complete statements a builder would otherwise act on.
2. **C-80, C-81, C-82** as one pass; they are three faces of the same contract revision.
3. **C-83, C-84**, then the two low items.
4. **§37** last, where FR-28's completeness rule is stated.

## 39. How to run this

A new session, from the project root:

```
/bmad-prd
```

> Update `docs/prds/prd-poe-crafting-base-price-checker-2026-09-12/prd.md` against the
> **Revision 6** section of
> `docs/architecture/architecture-poe-crafting-base-price-checker-2026-09-12/PRD-EDIT-PROPOSALS.md`.
> The sections above it were already absorbed — do not re-apply them.
> Architecture Spine revision 6 amended **AD-18, AD-28 and AD-29** in place and added no
> decision, so every existing `(AD-n)` citation stays valid.
> The weights contract is reissued at **4.1.0**, **non-breaking** — a conforming `4.0.0`
> file still conforms, and the §7.3 release dependency is not re-gated.
> Work the nine proposals in the order given in §38. All decisions are settled except the
> filter-unit Open Question (OQ-12), which is owned by the weights scraper project.
