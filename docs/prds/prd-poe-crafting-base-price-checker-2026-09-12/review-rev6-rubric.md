# PRD Quality Review — PoE2 Crafting Base Price Checker (revision 6)

Rubric: `.claude/skills/bmad-prd/assets/prd-validation-checklist.md`
Target: `docs/prds/prd-poe-crafting-base-price-checker-2026-09-12/prd.md` (rev 6, status `final`)
Supporting: `addendum.md` (rev 5), architecture spine rev 6 (AD-1..AD-29, inherited)

## Overall verdict

This is a mature, unusually disciplined requirements document, and on six of seven rubric dimensions it is at or near the ceiling for a hobby/solo tool: the thesis is real, the trade-offs are named with what was given up, the Open Questions are genuinely open (exactly one, owned outside the repo), and almost every FR carries a testable consequence with the failure mode it exists to prevent spelled out. Revision 6's additions — FR-29's dropped-Stat-Line asymmetry, FR-27's exactness rules and `statLineCounts`, FR-28's dropped-row gap — are substantive and are the right things to have written down; they close real holes rather than decorating the document.

What is at risk is narrow and concentrated in exactly the place this round touched: the **file-validation rule set of FR-27**. The new hard file errors are stated as group-level predicates without stating what a "group" is scoped to, one of them (`at most two Cohorts`) now provably refuses files that AD-29 expressly permits, and one (`per-statId group agreement`) has no declared target value, which leaves both `core`'s refusal message and the producer's discharge route undefined. These are the rules the *external* producer builds to and the rules that decide whether the product loads at all, so they are the one area where two independent builders — and worse, a builder and a producer — still diverge.

Verdict: **ship-ready on requirements, with one blocking correction to FR-27 before the contract is handed to the producer.**

---

## 1. Decision-readiness — **strong**

Decisions are stated as decisions. FR-4's coverage bands, FR-17's two-row `pinned` owner table, FR-21's lower-of-two-middle-values median rule, FR-23's 4-decimal grid, FR-27's exactness rules — each names the alternative and says why it lost. Where the PRD disagreed with the spine it says so and records who won (OQ-13 against the PRD, OQ-14 and OQ-16 in the PRD's direction). `[NOTE FOR PM]` callouts sit at real tensions (FR-18's R-2 gap, §7.2's coarser-fallback option), not at safe checkpoints. Nothing "balances."

The one live question, OQ-12, is genuinely open, correctly owned outside the repository, and correctly classified blocking-for-correctness-not-for-building. The §7.3 refusal to characterise the producer project's progress ("any characterisation of how near completion the project is would be undated the moment it was written") is the right instinct.

Where decision-readiness actually fails is not in the product decisions but in three *validation* rules, all in FR-27, all touched or added this round. They are covered under Done-ness clarity, where they do their damage.

### Findings

- **medium** — *The silent dropped-Stat-Line path has no observable, and `statLineCounts` adoption is invisible* (FR-29 final bullets / FR-25 / FR-27 `statLineCounts`). FR-29 now states plainly that where two Source Modifiers publish one `statId`, a dropped line is silent: containment is non-empty, nothing is reported, the numerator deflates, the base still reads `complete` and still counts as covered under FR-4. The stated defence is `statLineCounts` — which is **optional**, so whether the defence is armed for a given file is a property of the file, and nothing in the product tells the player which. A ranking that is silently reordered is exactly what §2.1's "know when the answer has gone stale" job exists to prevent, and this is the one staleness the honesty apparatus cannot see. *Fix:* add one consequence to FR-25: the Sync Report records, beside the coverage fraction, the fraction of `sourceModifierId` groups in the loaded Weights File that appear in `statLineCounts` (and the count of multi-stat groups that do not). Add a matching consequence to FR-10 or FR-11 that `web` surfaces it alongside `producer.id` / `gamePatch`. It costs a counter and turns an unverifiable trust assumption into a number that moves across a regeneration.

---

## 2. Substance over theater — **strong**

No persona theater: §2 is two paragraphs of jobs-to-be-done plus a non-users list, for a product with one user, which is the correct amount. No innovation theater — there is no differentiation section, and there should not be. NFRs are product-specific with real thresholds (NFR-1's `onUnhandledRequest: "error"`, NFR-6's 100 ms, NFR-9's live-header pacing); NFR-10 is the only extension beyond the spine and it is tagged as such. The Vision (§1) could not swap into another PRD — "the ranking is not 'most expensive base,' and everything else in the system exists to make that distinction hold" is the actual thesis and the rest of the document serves it.

The §10 retained record (BQ-1..3, OQ-8..11, OQ-13..16) is the one place where furniture would be easy and it is not furniture: each entry states why the argument survives nowhere else, and the claim is verifiable — the amended ADs do carry conclusions without arguments.

No findings.

---

## 3. Strategic coherence — **strong**

There is a thesis (threshold-truncated EV is the product; everything else exists to make that one number right and honest about what it rests on) and the feature set follows it rather than a backlog. Prioritisation follows the thesis: the coverage measurement (FR-4) is sequenced *before* view work because it binds a layout decision, not because it is easy. Success Metrics are behavioural because there is one user and no instrument — §8 says so rather than inventing DAU. Counter-metrics exist and are real: SM-C1 is denominated in searches rather than entries precisely because the entry count would hide a band split, which is a genuine measurement insight rather than a ritual counter-metric. MVP scope kind is coherently "problem-solving," and §7.2's deferrals each name what is lost.

No findings.

---

## 4. Done-ness clarity — **adequate**

This is where revision 6's additions land and where the remaining defects are. Most of the document is unforgivingly precise — FR-29's containment table, FR-16's overlap predicate with branch order stated as load-bearing, FR-4's two predicates written out because "a fraction that binds a layout decision must be reproducible by two people who have never spoken." That standard is the right one and the document mostly meets it.

FR-27's hard-file-error list does not. Three of its rules are stated as predicates over a "`sourceModifierId` group" without the document ever fixing what that group is scoped to, without a declared target for one of the two sum comparisons, and — in one case — with a bound whose justification is a per-modifier property while the count is taken family-wide across modifiers. All three are rules the external producer builds to and `core` refuses files on.

### Findings

- **critical** — *The "at most two Cohorts" carriage bound refuses files AD-29 expressly permits* (FR-27 hard-error list, final bullet; §3 *Value Cell*). The bound is counted per `(Base Type, slot, statId)` **across every Source Modifier publishing that stat**, and FR-27 argues at length that narrowing it by `sourceModifierId` would make it vacuous. But its stated justification is a **per-modifier** property: *"only adjacent tiers overlap, so a correct partition yields cells belonging to one tier or to exactly two."* Since AD-29 permits two distinct Source Modifiers to publish one `statId` over one range (§3 *Eligible Pool*; FR-27's own non-overlap carve-out), the family's value axis is cut at **both** modifiers' tier endpoints. A cell inside both modifiers' ranges can then be reached by up to two tiers of modifier X *and* up to two tiers of modifier Y — four tiers in up to four distinct Cohorts — with every tier adjacent-overlapping only within its own modifier. Such a file is conforming under every other rule in FR-27 and is **hard-refused**, taking the whole product down, with §7.3 telling the producer this was a non-breaking minor. The failure is not hypothetical: two-publisher stats are the case AD-29 was added for, and decomposed multi-`#` families (53 of 63 item classes) are where overlapping adjacent tiers are the norm. *Fix:* the bound must be counted per `(Base Type, slot, statId, sourceModifierId-family)` — i.e. per publishing modifier, over that modifier's own tiers — while the *cut* stays family-wide so cell edges remain comparable. That is not the vacuous per-row count FR-27 rejects: a "group" is one tier, but a *modifier* spans tiers, so the count over one modifier's tiers can legitimately exceed two and still catches the coarse-partition degenerate case FR-27 is defending against. If the PRD wants to keep a family-wide count, it must state the bound as `2 × (number of distinct publishing modifiers)` and say so explicitly. Either way this needs a decision before the contract goes to the producer; as written the rule and AD-29 cannot both hold.

- **high** — *Two of the new hard file errors do not state their grouping scope, and the PRD's own id-opacity rule makes the unscoped reading wrong* (FR-27 hard-error list: "*a `sourceModifierId` group whose entries carry more than one distinct `itemLevelMin`*" and "*a `sourceModifierId` group whose per-`statId` weight sums disagree*"). §3 *Source Modifier* says the id is "producer-assigned and opaque: **stable within one `(Base Type, slot)`**" — so nothing forbids the same id string recurring under a different `(Base Type, slot)` with a different tier, a different `itemLevelMin` and different weights. A builder grouping globally by `sourceModifierId` therefore hard-refuses conforming files on both new checks. The document knows to scope these things elsewhere — the adjacent duplicate-key error says "within a slot," and `statLineCounts` is defined as "a per-`(base, slot)` list" — which makes the omission on the two new bullets read as deliberate rather than elided. *Fix:* add "within a `(Base Type, slot)`" to both bullets, and to §3 `cohortTotals` ("declared per `(statId, itemLevelMin)`" → "per `(statId, itemLevelMin)` within a `(Base Type, slot)`"). One clause each.

- **high** — *The per-`statId` group-agreement check has no declared target, so neither the refusal message nor the producer's discharge route is defined* (FR-27, "*a `sourceModifierId` group whose per-`statId` weight sums disagree*" + the exactness bullets + §7.2 *A relative epsilon on the two sum rules*). FR-27 requires that "**a refusal reports the observed sum, the expected total and the signed difference**" and calls the two sum rules symmetrical — but they are not. `cohortTotals` compares an observed sum against a **declared** total, so "expected" is well-defined. The group-agreement rule compares N independently-computed float sums (one per `statId`, each a different-length split over a different value axis) for mutual exact equality: there is no declared total, so "the expected total" is undefined, and `core` has no basis for saying *which* Stat Line's sum is the wrong one. The producer's stated fallback — "let a residue-absorbing cell close each sum" — is likewise undefined here, because there is no value to close *to*. This is not a documentation nicety: FR-27 itself says these rules exist because "three conforming `core` implementations returned three different verdicts on one file," and this rule reintroduces exactly that. *Fix:* nominate a canonical target for the group — the simplest is the sum for the `statId` that appears **first in the file's own entry order within the group**, matching the pinned summation order already specified — and state that the refusal reports each other `statId`'s observed sum and its signed difference against that target. Then §7.2's epsilon deferral has a concrete object, and a producer using the fallback route knows what to close each split to.

- **high** — *Nothing says who runs `core`'s cross-file validation before a sync run spends budget* (FR-29 edge-alignment and straddle bullets; FR-16's `coOccur`; FR-19; FR-24). FR-29 places edge-alignment, straddle and `coOccur` in "`core` at load," and motivates the placement with the Monday/Tuesday scenario: *"Without it, `sync` would price `min..9999` on Monday and `core` would refuse the configuration in the browser on Tuesday — after the observation was written, committed and ranked."* But placing the check in `core` does not by itself prevent that outcome, because the PRD never says that `sync` invokes `core`'s load validation, nor what `sync` does if it fails. `sync` demonstrably reads `data/weights.json` (FR-24 checks every id in it) and `data/tracked.json`, so it holds both sides and *could* run the check — but FR-19's consequence list, FR-24's "two checks, two surfaces," and FR-17's explicit assignment of the `pinned` cap to "`sync` only" together create the impression that check ownership has been enumerated exhaustively, and this one is not in the enumeration. Two builders diverge: one runs `core`'s validation at sync startup and aborts before spending a search, the other prices the sentinel band all week. *Fix:* add a consequence to FR-19 (or a third row to FR-24's "two checks, two surfaces") stating that `sync` runs `core`'s cross-file tracked-list validation at run start, and what it does on failure — the FR-32 league-validation pattern ("fails loudly before any priced entry consumes budget") is the obvious precedent, and reusing it verbatim also settles the exit code.

- **medium** — *FR-28's "no mechanical check at all" for a dropped source row is overstated, and the cheaper mitigation is the one it does not recommend* (FR-28, "*A dropped source row has no mechanical check at all*"). FR-27 already makes "**a listed `sourceModifierId` matching no entry**" a hard file error. So a row that the producer scraped, listed in `statLineCounts`, and then dropped during explosion **is** caught — which covers the arithmetic-slip case that actually happens, exactly as `cohortTotals` does for a dropped cell. What remains genuinely unguarded is the narrower case of a row never scraped at all. As written, FR-28 tells the producer the mitigation is "emitting `cohortTotals` for every family," which is the *weaker* of the two available levers for this gap, and §7.2's deferral of mandatory `statLineCounts` frames its value as closing only the dropped-**line** gap. A producer reading FR-28 alone will prioritise the wrong field. *Fix:* narrow the claim to "a row the producer never scraped has no mechanical check"; add that **listing every group in `statLineCounts`, including single-stat ones, catches any row dropped after scraping** via FR-27's matching-no-entry error, and recommend it alongside universal `cohortTotals`. Then amend §7.2's `statLineCounts` deferral to say it would close both gaps, which strengthens the case for folding it into the next breaking revision.

- **medium** — *"Cell" and "entry" are used interchangeably in the conservation checks, after revision 5 made them different things* (FR-27: "*a Cohort whose emitted cells do not sum to its declared total*", "*`core` applies exactly two of these rules at load*", "*that independence is what catches a dropped, duplicated or misattributed cell*"; FR-29: "*Every Weights File cell carries `itemLevelMin`*"). AD-29 made the mapping one-to-many: "Where two tiers reach one cell, the file carries **two entries**" (§3 *Modifier Weight*, §3 *Cohort*). The conservation check must therefore sum **entries**, and a builder who reads "emitted cells sum to its declared total" literally and de-duplicates by cell identity — which §3 *Value Cell* defines as "its value edges, never a tier name" — undercounts a Cohort holding two tiers that reach one cell, and refuses a conforming file. The rest of the document is scrupulous about this distinction; FR-27's checks are where it lapses. *Fix:* say "emitted **entries**" in the `cohortTotals` bullet and in the exactness bullet, and "every Weights File **entry** carries `itemLevelMin`" in FR-29. The "at most two Cohorts" bullet is correctly about cells and should stay as-is (subject to the critical finding above).

---

## 5. Scope honesty — **strong**

§6 Non-Goals does real work and each entry says what is lost, not just what is excluded — the loot-filter entry goes as far as stating that the brief's own desired outcome is unachievable, which is the opposite of smoothing. §7.2 names eleven deferrals each with a revisit condition; the two added this round are honest about their own cost (the `statLineCounts` deferral records that the optional form leaves a silent gap and commits to folding it into the next breaking revision; the epsilon deferral records that a correct producer can still be refused and names the evidence a revisit would turn on). §7.3 elevates the one hard prerequisite out of the FRs, exactly as it says, "because leaving it implicit inside an FR is how a prerequisite gets discovered at integration."

Open-items density is appropriate and falling: one live OQ, ten indexed assumptions, a handful of `[NOTE FOR PM]` callouts — low for a document of this length and entirely appropriate for a green-light-to-build hobby PRD.

The one scope-honesty soft spot is covered above as the medium finding on FR-28, which understates the reach of a check that already exists rather than overstating it — an unusual direction for the error to run, and a benign one.

No further findings.

---

## 6. Downstream usability — **adequate**

This PRD is chain-top in the direction that matters: §7.3 makes it the document the *external producer's owner reads* for the contract. That raises the bar on FR-27 and FR-28 specifically, and it is why the findings above are graded where they are — a scope omission that a `core` author would shrug off is a false refusal when the producer builds to it.

Mechanically it is in good shape. §3 is comprehensive and the FRs use its nouns verbatim. IDs are contiguous and unique (FR-1..FR-33, UJ-1..UJ-6, SM-1..SM-6, SM-C1..C4, NFR-1..NFR-10, R-1..R-7); OQ numbering starts at 4 with the gap explained and ids never reused; the Assumptions Index round-trips cleanly in both directions (ten inline tags, ten index entries, FR-2's two tags correctly folded into one entry). Cross-references resolve. §0's arithmetic checks out — the union of rev 3-6's amended AD lists is exactly sixteen distinct decisions, and no `(AD-n)` citation is stale.

Sections do mostly stand alone, with one systemic exception: FR-27's error list and §3's Glossary entries are mutually load-bearing to a degree that a reader extracting FR-27 alone would miss (the group-scope convention lives only in §3 *Source Modifier*, which is the root of the high finding above).

### Findings

- **low** — *§3 `cohortTotals` and §3 *Value Cell* state family scope inconsistently* (§3 `cohortTotals`: "declared per `(statId, itemLevelMin)`"; §3 *Value Cell*: "counted per `(Base Type, slot, statId)`"; FR-27: "per `(statId, itemLevelMin)`"). A "family" is defined in §3 *Value Cell* as `(Base Type, slot, statId)`, so `cohortTotals` rows are necessarily per `(Base Type, slot, statId, itemLevelMin)` and the shorter spelling only works if the reader supplies the enclosing block. Harmless for a reader of the whole §3, but this is the copy the producer reads. *Fix:* spell it in full once, in §3 `cohortTotals`, and let FR-27 keep the short form.

- **low** — *An unsourced measurement is used to argue a producer obligation* (FR-27: "*measured over random two-decimal splits of round totals, two cells never failed, three failed ~9% of the time, four ~16%, eight ~33%*"). The numbers do real work — they are the reason the fallback discharge route is described as a trap rather than an option — but nothing says who measured them or against what, and the rest of the document is careful to attribute (FR-21's filter details carry "verified against live payloads on 2026-09-12"). *Fix:* one parenthetical naming the source and date, or demote to "measured informally" so a reader knows not to cite it back.

---

## 7. Shape fit — **strong**

The shape is right and deliberately so. §2.3 states outright that the lighter UJ form is used because there is a single operator, single role, no auth and no handoff — and then writes six UJs anyway, each with a protagonist carrying context inline, each realised by named FRs. That is the correct amount of formalisation for a hobby/solo tool with a genuine read-mostly UX. Success Metrics are behavioural and self-observed with the reason stated. The capability-spec density in §4.6-§4.8 matches the fact that the sync and weights halves have no UX at all.

The rubric's "hobby/solo → rigor light, substance bar still applies" calibration is worth naming explicitly: this document is *far* heavier than a hobby PRD needs, and that is justified rather than over-formalised, because the builders are agents working in parallel worktrees (NFR-4) and one consumer is an external project that will never speak to the author. The precision is load-bearing, not ceremonial.

The inheritance posture is correct and should not be read as a gap: §0 and the addendum's closing section both justify why a requirements document states arithmetic, and the justification holds.

No findings.

---

## Mechanical notes

- **Glossary drift:** one real instance — `cell` vs `entry` in FR-27's conservation checks and FR-29's `itemLevelMin` bullet (medium finding above). Otherwise clean; domain nouns are used identically across §3, §4, §7 and §10, including the hard ones (`Source Modifier` vs `Stat Line` vs `Modifier Reference` are never confused, which is the drift this round was most exposed to).
- **ID continuity:** clean. FR-1..FR-33 contiguous; OQ gap at 1-3 explained in §10's preamble; BQ-1..3 intact; no duplicates; all cross-references resolve, including the dense FR-16 ↔ FR-22 ↔ FR-27 ↔ FR-29 web.
- **Assumptions Index round-trip:** complete in both directions. Ten inline `[ASSUMPTION]` tags (FR-2 ×2, FR-3, FR-4, FR-5, FR-7, FR-18, FR-21, FR-26, FR-31, NFR-10), ten index entries, no orphans either way. FR-21's entry correctly distinguishes itself from the four verified filter facts beside it.
- **`[NOTE FOR PM]` placement:** at FR-18 (the R-2 gap the FR prompts but does not close) and §7.2 (the coarser-fallback revisit). Both are real tensions. Correctly not indexed, and §0 says why.
- **Contract version consistency:** `4.1.0` stated identically in §3 *Weights File*, FR-27 (×3), §7.3 and BQ-2's superseding note. §0's `2.0.0` and `4.0.0` references are historical and correctly scoped.
- **Version arithmetic:** §0's "sixteen decisions amended in place across revisions 3 through 6" is the distinct union of OQ-15's corrected lists plus rev 6's AD-18/28/29 — verified correct. "29 remains the total" is consistent throughout.
- **Required sections:** all present for the stakes and product type; §7.3 Release Dependencies is a non-template addition that earns its place.

---

## Summary of findings

| Tier | Count | Locations |
| --- | --- | --- |
| critical | 1 | FR-27 (at-most-two-Cohorts bound) |
| high | 3 | FR-27 (group scope), FR-27 (group-agreement target), FR-19/FR-24/FR-29 (who runs cross-file validation) |
| medium | 3 | FR-25/FR-29 (no observable for the silent case), FR-28 (dropped-row mitigation), FR-27/FR-29 (cell vs entry) |
| low | 2 | §3 `cohortTotals` scope, FR-27 unsourced measurement |

All four critical/high findings sit inside FR-27's file-validation rule set or its enforcement boundary — the material revision 6 touched. Nothing in §1-§2, §4.1-§4.5, §6, §8 or §9 required a finding at this maturity.
