---
title: 'Citation Accuracy Review — PRD vs Architecture Spine revision 2'
status: final
created: '2026-09-12'
reviewer: citation-accuracy pass
scope:
  - docs/prds/prd-poe-crafting-base-price-checker-2026-09-12/prd.md
  - docs/prds/prd-poe-crafting-base-price-checker-2026-09-12/addendum.md
authority:
  - docs/architecture/architecture-poe-crafting-base-price-checker-2026-09-12/ARCHITECTURE-SPINE.md (revision 2)
  - docs/architecture/architecture-poe-crafting-base-price-checker-2026-09-12/WEIGHTS-FILE-SCHEMA.md (2.0.0)
  - docs/architecture/architecture-poe-crafting-base-price-checker-2026-09-12/AGENT-WORKFLOW.md
---

# Citation Accuracy Review — PRD rev against Spine revision 2

## Verdict

**Pass with three wrong citations and one unlabelled extension.** The rewrite against revision 2 is materially accurate: the seven mis-citations the previous reconciliation found are gone, every load-bearing arithmetic claim (AD-16's search construction, AD-17's formula and overlap predicate, AD-18's scoped normalisation, AD-24's eight artifacts, AD-26's rotation, AD-27's coverage thresholds) is cited to the decision that actually governs it, and every factual claim about the trade API agrees with what the spine records. Three citations name an AD that is silent on the point, one report field is a PRD extension presented as inherited, and a cluster of NFRs restates `AGENT-WORKFLOW.md` and the spine's Consistency Conventions without citing either.

Nothing found blocks the build. All findings are editorial corrections to the PRD, not amendments to the spine.

**Counted:** 218 `(AD-n)` citation tokens across 147 citation sites (184 tokens / 128 sites in `prd.md`; 34 / 19 in `addendum.md`), plus 5 references to `WEIGHTS-FILE-SCHEMA.md` and 2 to `AGENT-WORKFLOW.md`. **Wrong: 3. Unlabelled extension: 1. Uncited-but-inherited: 8 (all minor).**

## A. Wrong citations

### A-1. FR-17, prd.md:328 — tie-breaking rule attributed to AD-7

| | |
| --- | --- |
| **Location** | §4.5 / FR-17, final bullets — "Ties break on the canonical entry key, so a run is reproducible and a resumed run is explainable (AD-7)." |
| **Claim** | Rotation ties are broken on the canonical entry key. |
| **Citation given** | AD-7 |
| **Correct citation** | **AD-26** (+ Consistency Conventions, *Entity keys*) |

AD-7 governs the chunk runner — bounds, the exclusive lock, exit 0 on a busy lock, invoker-agnosticism — and says nothing about selection order or tie-breaking. AD-26 carries the sentence the PRD is paraphrasing almost verbatim: *"Ties break on the canonical entry key (Consistency Conventions) so a run is reproducible and a resumed run is explainable."* The canonical key itself (`(baseTypeId, itemLevelMin, prefixBand, suffixBand)`) is defined in Consistency Conventions. Note that the two bullets immediately around this one (`lastAttemptedAt` ordering, the pure-function property) already cite AD-26 correctly, so this reads as a single slipped reference rather than a misunderstanding.

### A-2. §0, prd.md:23 — AD-26 (and AD-25) credited with absorbing the three blocking defects

| | |
| --- | --- |
| **Location** | §0 Document Purpose, the "This PRD is buildable" callout — "all three were absorbed by **Architecture Spine revision 2** (AD-5, AD-16, AD-17, AD-18, AD-25, AD-26, AD-27)." |
| **Claim** | These decisions are where BQ-1, BQ-2 and BQ-3 were resolved. |
| **Citation given** | AD-5, AD-16, AD-17, AD-18, AD-25, AD-26, AD-27 |
| **Correct citation** | **AD-5, AD-16, AD-17, AD-18, AD-27**, plus `WEIGHTS-FILE-SCHEMA.md` 2.0.0 — drop AD-26; AD-25 at most tangential |

The spine's own revision-2 header states what absorbed what: BQ-1, BQ-2 and BQ-3, plus the `itemLevelMin` amendment routed under AD-22. **AD-26 (refresh rotation) has no bearing on any of the three** — it exists because "AD-23 already depends on the word *rotation*; before this AD, nothing defined it," an unrelated gap. AD-25 resolves none of the three either; it removes RePoE as a data dependency, and touches BQ-3 only in that AD-27's source-agnosticism survives that removal (which the PRD's own §10 BQ-3 entry states correctly). The PRD's §10 per-defect "Resolved:" notes are individually accurate — this is over-citation in the summary line only. The amendment that also landed and is missing from the list is the Weights File schema major bump, which §10 BQ-2 names correctly.

### A-3. FR-11, prd.md:237 — per-band `provenance` attributed to AD-11

| | |
| --- | --- |
| **Location** | §4.4 / FR-11, first consequence — "the Weights File carries `provenance` per band (AD-10, AD-11)". |
| **Claim** | The weights file records provenance per band, so v1's provenance mix is read from data rather than assumed. |
| **Citation given** | AD-10, AD-11 |
| **Correct citation** | **AD-10 + `WEIGHTS-FILE-SCHEMA.md`** (Field rules: *"`provenance` — Per entry, because coverage is expected to be uneven. Propagates per AD-10."*) |

AD-11 establishes that the file is consumed not produced, that it carries raw banded spawn weights, that normalisation and recipe effects live in `core`, and that it is a prerequisite. It is **silent on a `provenance` field** — the per-entry granularity the FR depends on exists only in the schema document's field table. AD-10 correctly supplies the three-value provenance vocabulary and the weakest-provenance propagation rule, so half the citation stands. FR-27 shows the right pattern for this (`(AD-11, WEIGHTS-FILE-SCHEMA.md)` on prd.md:454); FR-11 should match it.

## B. Extension presented as inherited

### B-1. Glossary "Sync Report" (prd.md:93) and FR-25 (prd.md:425) — "entries not reached in this Chunk"

| | |
| --- | --- |
| **Claim** | The Sync Report records requests per source, unresolvable entries, **entries not reached in this Chunk**, and the last tracked-list edit date. |
| **Citation given** | (AD-12, AD-23) |
| **Verdict** | AD-12 governs per-source request accounting; AD-23 governs the tracked-list edit date; **AD-6** governs the unresolvable listing. **No AD requires a "not reached in this Chunk" field** — it is the PRD's own addition and is not labelled as one. |

AD-12's reporting clause is narrow: *"`sync-report.json` must report requests consumed **per source** against the live bucket."* AD-23 adds the edit date. AD-6 adds the unresolvable record (correctly cited at FR-24, prd.md:413, but not here). Nothing in the spine mandates reporting the un-reached remainder.

The field is a *good* addition and consistent with AD-26 and AD-10 — an entry whose turn has not come is a rotation outcome, and the player needs to distinguish it from a failure. FR-25's second bullet (prd.md:426) argues exactly that, citing AD-26. The fix is one clause of labelling, on the model of NFR-10: state that the field is the PRD's requirement, deriving from AD-26's defined order rather than mandated by AD-12.

Two sub-points in the same bullet:
- **"unresolvable entries"** in this list should carry AD-6 alongside AD-12/AD-23.
- **"AD-6 forbids skipping"** (prd.md:426) is a slight stretch but stands: AD-6's *"never skipped, never defaulted, never left at its previous value"* is scoped to unresolvable entries, and the PRD uses it only to argue that *not reached* must not be spelled as a skip. Not flagged as wrong.

## C. Reverse direction — inherited claims carrying no citation

None of these are wrong; each restates something the authority documents own, with no pointer back. Listed in descending significance.

| # | Location | Claim stated as inherited | Where it actually lives |
| --- | --- | --- | --- |
| C-1 | **NFR-4** (prd.md:542) | "`contracts` changes are serialised and land alone, first, with dependent work rebasing onto them"; "No worktree runs a live sync or a live catalogue refresh"; "an agent verifying sync behaviour uses `pnpm sync:dry`"; "an agent needing different data uses a fixture, never an edit" | `AGENT-WORKFLOW.md` §*Parallel worktrees* and §*Fixtures*, verbatim in substance. Cited only to AD-2 (which governs the dependency graph, not the worktree protocol), FR-24 and NFR-5. AD-22 also supplies a pointer (*"Changes to `contracts` are landed alone and first (see `AGENT-WORKFLOW.md`)"*). **`AGENT-WORKFLOW.md` is named in the PRD's `inherits:` list but is cited nowhere in §5 — its only in-body citation in the whole PRD is at §10, prd.md:637.** |
| C-2 | **NFR-3** (prd.md:541) | "No test depends on wall-clock timing — rate-limit backoff is tested by injecting header values, not by waiting" | `AGENT-WORKFLOW.md` §*Determinism*, last bullet. AD-1 correctly covers the purity half of the NFR but not the testing protocol. |
| C-3 | **NFR-8** (prd.md:546) | "Every published artifact and input file carries `schemaVersion` and is validated on load; a consumer refuses an unknown major rather than guessing. The producer validates before writing." | Consistency Conventions (*Schema versioning*, *Validation*) and AD-3. No citation at all. |
| C-4 | **NFR-9** (prd.md:547) | "Requests identify the tool and a contact address, pace from live rate-limit headers, and honour `Retry-After`." | AD-8, in full. No citation at all (FR-20 cites it correctly; the NFR does not). |
| C-5 | **FR-23** (prd.md:406) | "Persisted Divine prices are rounded to 4 decimal places once, at normalisation; `core` never re-rounds." | Consistency Conventions (*Numeric precision*), verbatim. No citation. |
| C-6 | **FR-22** (prd.md:392) | "`itemLevelMin` is a declared field on the Tracked Entry, authored by hand. Neither `sync` nor `core` infers or adjusts it." | AD-5 (*"`itemLevelMin` is declared, never inferred"*) and Consistency Conventions (*Item level*). AD-5 is cited on the adjacent bullet but not this one. |
| C-7 | **§4.6 description** (prd.md:345) | "A full refresh takes roughly fifteen hours and consumes about 62% of the daily search budget" | Arithmetic over AD-8's measured `600 searches / 6h` and AD-12's ~1,500-search ceiling (1,500 ÷ 600 × 6h = 15h; 1,500 ÷ 2,400 = 62.5%). Both figures check out, but the derivation carries neither a citation nor an `[ASSUMPTION]` tag, so a reader cannot tell it was computed rather than measured. |
| C-8 | **§3 Glossary** (prd.md:67, 68, 81, 82) | *Tracked Entry* shape, *Raw Base*, *Payout Threshold*, *Craft Recipe* | AD-5 (entry shape and both-affixes-absent = raw base), AD-17 (threshold), AD-22 (`CraftRecipe` in `contracts` from `data/recipes.json`). Surrounding glossary entries are cited; these four are not. Cosmetic. |

## D. Deliberate extensions — confirmed correctly labelled

- **NFR-10** (prd.md:548) — AD-24's clause is *"Distinctions AD-10 requires must not be carried by colour alone."* The PRD extends this to Price State (FR-9) and crafted-vs-Raw-Base (FR-3), which AD-10 does not mandate, and labels the extension inline: `[ASSUMPTION: the extension beyond AD-24's literal scope is this PRD's, not the spine's.]` It is also indexed at §11 (prd.md:659). **Correct on both counts.** The downstream uses at FR-3 (prd.md:133) and FR-9 (prd.md:214) cite NFR-10 rather than AD-24, which is the right pointer; FR-10 (prd.md:228) cites `(AD-10, NFR-10)`, also right, since Provenance *is* inside AD-24's literal scope.
- **FR-2** (chase ordering by `P × price`, three per row), **FR-5** (top 20), **FR-7** (0.25 Divine default), **FR-18** (edit date from git history), **FR-26** (v1 craft composition), **FR-3** (ilvl 82 as effective cap), **FR-31** (league change needs no purge) — all carry `[ASSUMPTION]` tags and all appear in the §11 index. None claims spine authority.
- **FR-22's Accepted Tier rule** (tier 1 unless it first appears at ilvl 81/82) is the player's curation rule from the addendum, and is presented as such — the spine deliberately declines to set a floor (AD-5: *"declared, never inferred"*). Correctly **not** cited to an AD.

## E. Factual claims about the trade API — all agree with the spine

| Claim | PRD location | Spine record | Verdict |
| --- | --- | --- | --- |
| Base type goes in `query.type`, **not** `type_filters.category`; `category` takes taxonomy ids (`weapon.bow`) and no committed artifact maps a base type to its leaf category | FR-21, prd.md:377 | AD-16, trap 1 (verified 2026-09-12; `data/items` groups only ten coarse labels) | **Agrees**, including the reason. Citation `(AD-16, AD-25)` is apt — AD-25 owns `items.json`. |
| Instant buyout is the option labelled **"Buyout or Fixed Price"**, `id` is JSON `null`, must be emitted explicitly; **not** `priced_with_info`, whose live label is *"Price with Note"* | FR-21, prd.md:378 | AD-16, trap 2 | **Agrees verbatim**, including the silent-widening failure mode. |
| Four catalogue endpoints; refresh costs **four requests**, explicit command, patch cadence, never on the chunk path | FR-14 table (prd.md:279), FR-24 (prd.md:416) | AD-25 table (`items`, `stats`, `static`, `filters`); AD-12 row 4 | **Agrees.** FR-33's split — `stats.json` + `static.json` fetched by `web`, `items.json` + `filters.json` not — matches AD-24 exactly. |
| Measured ceiling ~**2,400 searches/day**; full refresh held to ~**1,500 searches**; ceiling denominated in searches, not entries | FR-14 (prd.md:285), SM-C1 (prd.md:617), §7.2 (prd.md:585) | AD-8 measured table (`600 searches / 6h` = 2,400/day; 1,000 fetches / 6h); AD-12 (~1,500, supersedes the addendum's ~2,000) | **Agrees.** SM-C1's "~10,000 searches would need roughly four times the ~2,400 a day" is arithmetically right (4.17×). The addendum's own ~1,500 references (addendum.md:88, 90) match. |
| No rate is hardcoded; rule names read at runtime from `X-Rate-Limit-Rules`; pace against tightest unsatisfied bucket; honour `Retry-After` and yield the chunk | FR-20, prd.md:364–366 | AD-8 | **Agrees.** |
| Requests unauthenticated; no credential stored | FR-20 (prd.md:368), NFR-7 | AD-15 (*"Confirmed 2026-09-12 by live unauthenticated calls"*) | **Agrees.** |
| Trade API exposes no pool membership, no tier, no item-level availability, no spawn weight | Glossary (prd.md:86), FR-30 (prd.md:491), §7.3 (prd.md:598) | AD-11, AD-25 (*"a flat global list of 3,108 explicit stat ids, each `{id, text, type}` and nothing more"*) | **Agrees.** |
| **3,108 stat ids** | *not stated anywhere in the PRD or addendum* | AD-25 and `WEIGHTS-FILE-SCHEMA.md` §*Why this file has to exist* | **No conflict.** The PRD carries the consequence (no per-base association, no tier, no `required_level`, no weight) without the figure. Nothing to correct; noted because the figure was in scope for this check. |

## F. Spot-checks that passed (representative, not exhaustive)

The following were read against the actual AD text and are correct as cited — recorded because several are the kind of citation a reader would otherwise re-litigate:

- **FR-1 / prd.md:108–114** — the EV formula, gross-price comparison, craft cost subtracted once → AD-17 ✔; non-`priced` contributes nothing → AD-9 ✔; `pruned` not a summand → AD-23 ✔ (AD-23 explicitly excludes tombstones from `tracked(base)` in AD-17's sum); "the view computes none of them" → AD-4 ✔ (*"`web` may not compute any ranking term itself"*).
- **FR-16 / prd.md:301–307** — the overlap predicate, all three consequences including the prefix-only/suffix-only case, the shared-floor rule and the Raw Base exemption → AD-17 ✔ on every point, including the "twice been found to miss a case" framing.
- **FR-29 / prd.md:477–484** — whole-bands-only containment, same-scoped-set numerator and denominator, empty containment set as a validation error, straddling band as a hard error, independence of prefix/suffix draws, the exactly-at-floor modelling assumption → AD-18 ✔ across the board.
- **FR-27 / prd.md:458** — the hard-error list matches `WEIGHTS-FILE-SCHEMA.md` §*Validation* item for item; the degraded-but-loadable set (prd.md:459) matches too.
- **FR-28** — producer side matches the schema's pool-completeness rule including `weight: 0` semantics and item-level independence; consumer side (`partial` → provenance `absent` → Unrankable, the only path by which `absent` arises) matches AD-18 ✔.
- **FR-4 / prd.md:146–152** — the three coverage bands and their consequences reproduce AD-27's table exactly, including the tracked list as denominator and both-slots-complete ✔.
- **FR-33 / prd.md:531–535** — eight artifacts named individually, the three deliberately excluded, single consistent set, validated on load → AD-24 + AD-3 ✔.
- **FR-17 rotation table** — order 0 through 4 reproduces AD-26 exactly, including currencies-first, the `pinned` 25% cap as a `tracked.json` validation error, `lastAttemptedAt` rather than observation time, the 24h bounded `unresolvable` retry, and recompute-on-resume ✔.
- **FR-24 / prd.md:417** — "two checks, two surfaces," with the weights-file check reported but never repaired because `sync` is a reader → AD-6's table + AD-21 ✔. This is a precise reading of an easily-misread AD.
- **Addendum, all 19 citation sites** — clean. The historical descriptions of revision-1 AD-16/AD-17/AD-18 (addendum.md:69–72, 84, 94) are explicitly framed as the *inherited* model under a heading saying revision 2 absorbed them, and each subsection closes with a "What landed" paragraph that cites the amended decision correctly. AD-23's quoted risk (addendum.md:59), AD-12's re-denomination (addendum.md:90), AD-27's tracked-list denominator and source-agnosticism (addendum.md:111) all check out against the spine text.

## G. Observation for the spine, not the PRD

Not a PRD defect, recorded because it was surfaced by this pass and the PRD is the more correct of the two documents.

**AD-11 and AD-18 still spell the modifier band as `(statId, valueMin, valueMax?, itemLevelMin, weight)` and `(statId, valueMin, valueMax?)`** — retaining the optional marker and, in AD-18, the parenthetical *"an omitted `ref.valueMax` is unbounded above."* AD-5 removed the open-top form outright (*"`valueMax` is required, everywhere, with no open-top form"*), Consistency Conventions say bands have *"inclusive, always-present"* edges, and `WEIGHTS-FILE-SCHEMA.md` 2.0.0 makes a missing or `null` `valueMax` a hard file error. The PRD writes `valueMax` as required throughout (prd.md:85, 454–455) and is right to; the residue is an un-swept edit in the spine. AD-5 governs, so no behaviour is ambiguous — but AD-18's "unbounded above" clause should be struck at the next spine revision before an implementer reads it as live.

## H. Recommended edits

1. **prd.md:328** — change `(AD-7)` to `(AD-26)`.
2. **prd.md:23** — drop AD-26 from the absorbed-by list; either drop AD-25 or qualify it; add `WEIGHTS-FILE-SCHEMA.md` 2.0.0.
3. **prd.md:237** — change `(AD-10, AD-11)` to ``(AD-10, `WEIGHTS-FILE-SCHEMA.md`)``.
4. **prd.md:93 and prd.md:425** — add AD-6 for the unresolvable listing, and label "entries not reached in this Chunk" as this PRD's requirement derived from AD-26 rather than as an AD-12 mandate.
5. **prd.md:541–547** — cite `AGENT-WORKFLOW.md` in NFR-3 and NFR-4 (and AD-22 for the serialised-`contracts` rule); add AD-3 + Consistency Conventions to NFR-8 and AD-8 to NFR-9.
6. **prd.md:406, 392** — add Consistency Conventions / AD-5 pointers.
7. **prd.md:345** — tag the fifteen-hour / 62% figures as derived from AD-8 and AD-12.
