# Review: SPEC-tracked-hybrid-mods

- **Content:** `docs/stories/archive/spec-tracked-hybrid-mods/SPEC.md` (docs, a behavior-defining spec)
- **Lenses:** adversarial, edge-case-hunter, structure, prose (prose ran after structure and used its findings)
- **Skipped:** verification-gap (it applies to code only)
- **Date:** 2026-10-03

## Cross-lens overlaps

Overlap between lenses is signal. These themes came up in more than one lens:

| Theme | Findings |
| --- | --- |
| A single-line ban on hybrid tiers makes pure Bows tiers untrackable, because pure intervals contain the hybrid intervals | adversarial #1, edge-case #3 |
| CAP-4 "containment set includes" vs "reaches into" (contains vs intersects) | adversarial #2, edge-case #4 |
| A hybrid line shares a `statId` with the other slot (Bows `LightRadiusAndAccuracy`), so CAP-6 is too narrow | adversarial #4, edge-case #6 |
| A summed filter admits other tier combinations, so the price population ≠ the probability population | adversarial #5, edge-case #7, edge-case #8 |
| `statId: null` lines on hybrid weights entries | adversarial #7, edge-case #11 |
| "Spans modGroups" is undefined, and one modGroup can mix pure and hybrid line sets | adversarial #11, edge-case #2 |
| Overlap, canonical key and floor mechanics for hybrids are unspecified (IMPLEMENTATION-NOTES sections not listed for revision) | adversarial #8, adversarial #15, edge-case #5, edge-case #13 |
| CAP-7 fallback and label source are undefined | adversarial #12, edge-case #15, structure (Success signal restates CAP-7) |
| Both-slots-required rule has no CAP or success criterion, and its FR-26 citation is wrong | adversarial #10, structure (Constraints bullet 1 QUESTION), edge-case #16 |
| The single-line hybrid ban is stated three times | structure (cut Constraints bullet 5); the substance is challenged by adversarial #1 |

## Adversarial

1. **Constraints bullet 5 and CAP-4.** If a single-line band's containment set includes a hybrid tier, the band is banned. That makes most pure Bows tiers untrackable: pure phys% [50,64] ⊇ hybrid [55,64], [65,84] ⊇ [65,74] and [75,79], and accuracy [11,32] ⊇ [16,20], and so on. **Fix:** Do not reject. Redefine containment so that a single-line reference contains only entries whose line set is exactly `{statId}`, and a hybrid reference contains only entries whose line set equals its own. This changes the ∃-line rule in IMPLEMENTATION-NOTES §1. **Consequence:** Pure phys% and accuracy tiers that the player tracks today can no longer be tracked.
2. **CAP-4 intent vs success.** "Containment set includes a hybrid tier" and "reaches into a hybrid tier" are different predicates. Pure [40,49] intersects hybrid [45,54] without containing it. **Fix:** Name one predicate, give it a formula in IMPLEMENTATION-NOTES §2.x, cite it, and add a worked Bows table. **Consequence:** Builders implement different rejection sets.
3. **Why / CAP-2 / Non-goals.** A pure search (phys% [40,49]) still matches hybrid items that roll 45–49, so cheap hybrids contaminate the AD-16 sample. **Fix:** Add a `not` group with the other statIds of the sharing hybrid families, or record the contamination as an accepted effect under AD-16. **Consequence:** The price and probability populations diverge, which is the defect AD-17 exists to prevent.
4. **CAP-2 / CAP-6 / Constraints bullet 1.** The Bows suffix `LightRadiusAndAccuracy` shares the accuracy statId with the hybrid prefix, and Trade sums them. CAP-6 covers only pure+pure. **Fix:** Generalise CAP-6 to any statId named in both slots: one summed filter per shared statId. Add a success case for this pair. **Consequence:** Duplicate filter ids, or a per-line band compared against a summed value, gives the wrong price or no price.
5. **CAP-6.** A summed band admits other tier pairs whose sum falls in the band. (T1p+T2s) and (T2p+T1s) get identical search bodies but have disjoint probabilities. **Fix:** Record it as an accepted mismatch under AD-16, or restrict to one entry per summed statId, or warn when search bodies are identical. **Consequence:** Distinct combinations share one price, and EV is skewed without a signal.
6. **CAP-1 success / CAP-4.** The line-set completeness check sits only in `tracked:check`. A hand edit bypasses it. **Fix:** Make it a cross-file check in `core` (AD-17) that runs at web load and the sync gate (AD-12), and make the schema enforce unique statIds. **Consequence:** The core guarantee of the spec can be bypassed.
7. **Constraints bullet 2.** "Names exactly the statIds of its weights entry's lines" is undefined for a `statId: null` line or when weights.json is absent (AD-24). **Fix:** Say "the non-null statIds of every contained entry, equal across the containment set", and state the behavior when there is no weights file. **Consequence:** Hybrids with an untradeable line cannot be tracked, or builders diverge.
8. **Constraints (owner-doc changes).** The spec omits the IMPLEMENTATION-NOTES sections that must change: §1 containment, §2.1 slotOverlap, §2.3 kind agreement, §2.4 lines(ref), §4.1 canonical key, §8 needs(ref), §11. **Fix:** List them, and specify the hybrid canonical-key encoding, for example `["hybrid", [[statId,min,max],…]]` sorted by statId. **Consequence:** Builders invent key encodings and overlap semantics, and keys diverge.
9. **Constraints bullet 6.** A major bump without migration means web and sync refuse the committed tracked.json (AD-3) until it is re-curated, and keyed artifacts (dataset, sync-progress, sync-report) are orphaned. **Fix:** Commit a re-curated tracked.json in the landing change, and state how keyed artifacts are reset. **Consequence:** Downtime and stale observations.
10. **Constraints bullet 1.** FR-26 does not say that every recipe rolls two mods. It says that v1 ships two recipes, and that adding one is a data edit. Requiring both affixes contradicts a future one-affix recipe, PRD line 78 and the FR-16 bullet (line 316). **Fix:** Fix the citation or add a PRD capability edit, list the PRD §3 and FR-16 text for edit, and refresh PRODUCT.md. **Consequence:** The PRD and the spine contradict each other on a scope boundary.
11. **CAP-4 success case 2.** "A line set that spans modGroups" is undefined. **Fix:** Define it as `∀ e ∈ contained(ref): same modGroup`, with payload fields in IMPLEMENTATION-NOTES. **Consequence:** The check is implemented inconsistently.
12. **CAP-7 / Success signal.** The spec gives no source for the per-line short form, no hybrid fallback, and the success string is only "-style". The `·` separator sits next to the new comma. **Fix:** Name the label source, define the fallback, and give the exact expected string. **Consequence:** Each builder invents a label, and the test passes on any string.
13. **Success signal.** "After one sync, each has a Divine price" depends on live listings. **Fix:** Make the success signal deterministic with an MSW fixture, and treat a live price as an observation. **Consequence:** The spec cannot be closed, or someone weakens the entry to pass.
14. **CAP-6 / Why.** "Trade sums the two values" is stated with no captured live request (compare §5.1–5.1c). **Fix:** Add it as an assumption, or capture the request as §5.1d before CAP-6 lands. **Consequence:** If Trade does not sum, every CAP-6 entry matches nothing, and nothing signals it.
15. **CAP-1 intent.** Kinds can differ per line. Kind agreement (AD-17) and the §8 needs(ref) are undefined for a hybrid that mixes banded and valueless lines. **Fix:** Apply kind agreement per line, and define needs(hybrid). **Consequence:** Floors are derived inconsistently.

## Edge-Case Hunter

Grounded in data/weights.json (6.1.0), contracts `modifier-ref.ts`, `overlap.ts`, `canonical-key.ts`, core `probability.ts`, `cross-file.ts`, sync `search-body.ts` and web `combination-text.ts`.

1. **CAP-3 / CAP-4.** The hybrid containment predicate is undefined. The current `contains()` matches when any one line matches. **Guard:** `e.weight>0 && sameSet(lines) && every line contained`. **Consequence:** Pure or superset tiers inflate the hybrid probability.
2. **Constraints / CAP-4 "spans modGroups".** One modGroup can mix pure and hybrid line sets (Body_Armours_str_dex_int BaseLocalDefences). **Guard:** Identify a family by (slot, sorted line-statId set), not by modGroup. **Consequence:** The modGroup check passes refs whose tiers have different line sets.
3. **CAP-4 / Constraints.** A pure tier interval wholly contains a hybrid line interval (phys% T7 [50,64] ⊇ hybrid T3 [55,64]). **Guard:** Accept that such tiers become untrackable and report them in lookup, or exclude hybrids from containment and add a `not` filter. **Consequence:** Pure phys% T6/T7 and several accuracy tiers cannot be tracked.
4. **CAP-4.** Partial intersection ([40,49] vs [35,44]) is not covered by a containment-keyed rejection. **Guard:** Reject when the band intersects any hybrid line interval. **Consequence:** Hybrid listings contaminate the pure price.
5. **CAP-4 overlap (FR-16).** `slotOverlap` branches on a single statId, and hybrid vs single and hybrid vs hybrid are undefined. **Guard:** Define both cases. **Consequence:** One item satisfies two entries, and no load-time failure catches it.
6. **CAP-6 / CAP-2.** A hybrid line shares a statId with the other slot (Bows phys+acc with LightRadiusAndAccuracy, Boots DefencesPercentAndStunThreshold with StunThreshold). **Guard:** Group all lines of both slots by statId, and emit one summed filter per statId. **Consequence:** Real items are excluded, and the price is wrong.
7. **CAP-6 vs CAP-3.** Values outside their per-slot bands can still have a sum inside the summed band. **Guard:** Price and compute probability on the same event, or record the accepted mismatch. **Consequence:** EV is miscomputed.
8. **CAP-6 / CAP-4.** Two entries with disjoint per-slot bands can have intersecting sums. **Guard:** Compare overlap on [Σmin,Σmax]. **Consequence:** Overlapping searches pass FR-16.
9. **CAP-6.** A shared statId with a valueless ref leaves Σ undefined. **Guard:** Reject at check, or emit `value:{}`, and specify which. **Consequence:** NaN edges or a crash.
10. **CAP-2 vs CAP-1.** The filter for a valueless hybrid line is unspecified. **Guard:** `valueless ? {id, value:{}} : {id, value:{min,max}}`. **Consequence:** An invalid request or a fixture mismatch.
11. **Constraints.** A hybrid entry has a null-statId line (Time-Lost Diamond/Emerald JewelRadiusLargerRadius). **Guard:** Mark it untrackable, and have lookup give the reason. **Consequence:** An unclear check failure.
12. **CAP-1.** A hybrid ref with 0 or 1 line. **Guard:** `lines.min(2)` plus a unique-statId refine. **Consequence:** Two canonical keys for one search bypass the duplicate checks.
13. **CAP-1 / canonical key.** The same lines in a different order give different keys. **Guard:** Sort lines by statId in the transform, or reject unsorted lines. **Consequence:** Duplicates escape, and fixture keys drift.
14. **CAP-4 edge alignment.** Per-line alignment against per-line containment can pass a band whose conjunction contains fewer tiers. **Guard:** Compute the conjunction containment first, then align each line to its extremes over that set. **Consequence:** False passes.
15. **CAP-7.** The fallback is undefined for a missing acceptedTier, a line with no short form, or a valueless line. **Guard:** If any part is missing, render all lines verbatim with bands and `verbatim:true`. **Consequence:** Mixed short-form and catalogue text.
16. **Constraints (both affixes required).** The `absent` branches remain in overlap.ts, probability.ts and combinationText. **Guard:** Make both slots required in the schema, and remove or assert-unreachable the absent branches. **Consequence:** Dead code, and possible false overlaps.

## Editorial Structure

**Purpose:** Help curators and implementers know what to build and how to verify each capability. **Model:** Strategic/Context (Pyramid), with a Reference-style schema for each CAP. **Words:** 971.

| Pass | Original Text | Revised Text | Changes |
| --- | --- | --- | --- |
| structure | §Why opens "This is a pain to solve." and ends with the deferred-item activation | CONDENSE and MOVE: Cut the opener, and lead with a one-sentence headline that names both gaps | Puts the conclusion first. About −6 words |
| structure | §Why: the rarity gap is buried after the Bows example | MOVE: Headline both gaps, then give each its own paragraph or bullet | Makes the groups MECE. The rarity gap drives CAP-6 |
| structure | CAP-6 sits between CAP-5 and CAP-7 | MOVE: Place it after CAP-2, renumbering only if no citations exist | Keeps the search-body capabilities together |
| structure | Constraints bullet 1, rarity rationale | MOVE: Put it under CAP-6 or §Why, and keep only the both-slots requirement | Rationale is mixed into an unrelated constraint |
| structure | Constraints bullet 1, "requires both a prefix and a suffix" | QUESTION: Should this be its own CAP, or a success line under CAP-1? | A breaking rule has no test target |
| structure | Constraints bullet 5 | CUT: CAP-4 states it twice already | About −13 words |
| structure | Constraints bullet 4 and Non-goal "More than one reference per slot" | MERGE | About −9 words |
| structure | Constraints bullet 2 | CONDENSE: Cite CAP-1 for the rejection, and keep the rationale | About −8 words |
| structure | Constraints bullet 8 (owner-doc edits) | MOVE: Put it in a new "## Document changes" section, with one bullet per owner | It is a deliverable list, not a constraint |
| structure | Preamble sentence about `sources:` | CUT while `sources: []` is empty | About −22 words |
| structure | Preamble blockquote before the H1 | MOVE below the H1 | Readers expect the title first |
| structure | "containment set", "valueless form", "band" | QUESTION: Cite each term's owner | Missing scaffolding |
| structure | Success signal restates the CAP-7 format | CONDENSE: Write "in CAP-7's format" | Avoids drift |
| structure | Assumptions (FR-22) | QUESTION: Is this a decision (merge it) or an assumption (name who confirms it)? | The label sets how implementers treat it |
| structure | Bows example in §Why | PRESERVE | Strongest scaffolding |
| structure | intent/success schema for each CAP | PRESERVE | Consistent and testable |

Net if all are accepted: about −35 words (3.6%). Most of the value is in reordering.

## Editorial Prose

**Voice to keep:** Terse and technical, with short declarative sentences and inline IDs.

| Pass | Original Text | Revised Text | Changes |
| --- | --- | --- | --- |
| prose | "the player re-curates it afterwards" | "the curator re-curates it afterward" | Matches the curator/player split in the CAPs. Uses US spelling |
| prose | "its tier label followed by its lines, separated by commas" | "its tier label, then its lines separated by commas" | The old wording implies a comma after the label |
| prose | CAP-4 "These are … the shared floor (§8) … They reject" | "The checks are … (IMPLEMENTATION-NOTES §8) … The checks also reject" | Unclear pronouns. "§8" could mean a section of this spec |
| prose | "The spine owns the decision." | Consider "the hybrid-reference decision"? | No antecedent |
| prose | "Deferred item" vs "deferred item" | Use one capitalization | Consistency |
| prose | "adds a foreign line" | "adds a line that is not in that entry" | Undefined coinage |
| prose | "takes no product across lines" | "does not multiply probabilities across lines" | Plainer |
| prose | "The ratio has the same denominator as today." | "The probability ratio keeps its current denominator." | Gives "ratio" a referent. Avoids the time-relative "today" |
| prose | "It fails these, and the message names…" | "It fails each of the following, and the error message names…" | Forward reference, and says which message |
| prose | "one stat filter that compares the summed value" | "…that matches the summed value against the summed bands" | "Compares" had no object |
| prose | "That line's `statId` is shared with a pure modifier" | "A pure modifier shares that line's `statId`" | Active voice |
| prose | "(also `LocalPhysicalDamagePercent`)" | Consider "(shared with …)"? | Alias or second modifier is unclear |
| prose | "but sync sends one filter per slot." | "…, so the search cannot match the summed value." | States the consequence |
| prose | "A rarity prefix paired with a non-rarity suffix can never match a summed item." | Consider a rewrite. The meaning is unclear | "Summed item" is undefined |
| prose | Non-goal "Rare items, and conjunctions …" | Split into two bullets | Two items in one |
| prose | "`banded` already handles it." | "The `banded` kind already handles it." | Bare identifier |
| prose | "Each line takes its own band, or the valueless form." | "Each line takes its own band or uses the valueless form." | Parallel options |

## Findings (JSON)

The editorial lenses use their declared table shape above. This array holds the adversarial and edge-case findings.

```json
[
{"lens":"adversarial","location":"Constraints bullet 5; CAP-4","trigger_condition":"Single-line ban on hybrid tiers: pure Bows tiers wholly contain hybrid intervals","guard_snippet":"Redefine containment by exact line set instead of rejecting; revise IMPLEMENTATION-NOTES §1","potential_consequence":"Pure phys%/accuracy tiers become untrackable"},
{"lens":"adversarial","location":"CAP-4 intent vs success","trigger_condition":"'includes' (containment) vs 'reaches into' (intersection) are different predicates","guard_snippet":"One formula in IMPLEMENTATION-NOTES §2.x plus a worked Bows table","potential_consequence":"Divergent rejection sets"},
{"lens":"adversarial","location":"Why; CAP-2; Non-goals","trigger_condition":"Pure search still matches hybrid listings","guard_snippet":"`not` group on sibling hybrid statIds, or accepted effect under AD-16","potential_consequence":"Price/probability populations diverge"},
{"lens":"adversarial","location":"CAP-2; CAP-6; Constraints bullet 1","trigger_condition":"Hybrid prefix line shares statId with a suffix (LightRadiusAndAccuracy)","guard_snippet":"One summed filter per statId named in both slots; add a success case","potential_consequence":"Wrong or empty price"},
{"lens":"adversarial","location":"CAP-6","trigger_condition":"Summed band admits other tier pairs; mirrored entries share a search body","guard_snippet":"Accept in AD-16, restrict, or warn on identical bodies","potential_consequence":"Skewed EV without signal"},
{"lens":"adversarial","location":"CAP-1 success; CAP-4","trigger_condition":"Line-set completeness check only in tracked:check","guard_snippet":"Cross-file check in core (AD-17) at web load and sync gate; schema-level unique statIds","potential_consequence":"Guarantee bypassed by hand edit"},
{"lens":"adversarial","location":"Constraints bullet 2","trigger_condition":"Undefined for statId:null lines or absent weights.json","guard_snippet":"Non-null statIds, equal across containment set; state no-weights behaviour","potential_consequence":"Untrackable hybrids or divergent builders"},
{"lens":"adversarial","location":"Constraints (owner-doc changes)","trigger_condition":"IMPLEMENTATION-NOTES §1, §2.1, §2.3, §2.4, §4.1, §8, §11 omitted","guard_snippet":"List them; specify hybrid canonical key sorted by statId","potential_consequence":"Invented encodings; key divergence"},
{"lens":"adversarial","location":"Constraints bullet 6","trigger_condition":"Major bump without migration breaks the committed tracked.json and orphans keyed artifacts","guard_snippet":"Commit re-curated tracked.json in the landing change; state artifact reset","potential_consequence":"Downtime; stale observations"},
{"lens":"adversarial","location":"Constraints bullet 1","trigger_condition":"FR-26 miscited; both-affix rule contradicts PRD line 78 and FR-16 bullet","guard_snippet":"Fix citation or add PRD capability edit; list PRD §3, FR-16; refresh PRODUCT.md","potential_consequence":"PRD/spine contradiction"},
{"lens":"adversarial","location":"CAP-4 success case 2","trigger_condition":"'spans modGroups' undefined","guard_snippet":"∀ e ∈ contained(ref): same modGroup; payload in IMPLEMENTATION-NOTES","potential_consequence":"Inconsistent check"},
{"lens":"adversarial","location":"CAP-7; Success signal","trigger_condition":"No label source, no hybrid fallback, '-style' string","guard_snippet":"Name source, define fallback, exact string","potential_consequence":"Test passes on any string"},
{"lens":"adversarial","location":"Success signal","trigger_condition":"Depends on live listings","guard_snippet":"MSW-fixture sync; live price as observation","potential_consequence":"Spec cannot close"},
{"lens":"adversarial","location":"CAP-6; Why","trigger_condition":"Trade summing is uncaptured","guard_snippet":"Assumption entry or captured request §5.1d","potential_consequence":"Silent zero matches"},
{"lens":"adversarial","location":"CAP-1 intent","trigger_condition":"Kind agreement and needs(ref) undefined for mixed-kind hybrid lines","guard_snippet":"Per-line kind agreement; define needs(hybrid)","potential_consequence":"Inconsistent floors"},
{"lens":"edge-case-hunter","location":"CAP-3; CAP-4","trigger_condition":"Hybrid containment predicate undefined; contains() matches any one line","guard_snippet":"e.weight>0 && sameSet(e.lines.map(l=>l.statId), ref.lines.map(l=>l.statId)) && ref.lines.every(r => lineContained(r, e.lines.find(l=>l.statId===r.statId)))","potential_consequence":"Inflated hybrid probability"},
{"lens":"edge-case-hunter","location":"Constraints; CAP-4 'spans modGroups'","trigger_condition":"One modGroup mixes pure and hybrid line sets (Body_Armours_str_dex_int BaseLocalDefences)","guard_snippet":"Family = (slot, sorted line statId set)","potential_consequence":"Mismatched line sets pass"},
{"lens":"edge-case-hunter","location":"CAP-4; Constraints","trigger_condition":"Pure tier wholly contains hybrid line interval (phys% T7 [50,64] ⊇ hybrid T3 [55,64])","guard_snippet":"Accept and report in lookup, or exclude hybrids and add a `not` filter","potential_consequence":"Pure tiers untrackable"},
{"lens":"edge-case-hunter","location":"CAP-4","trigger_condition":"Partial intersection ([40,49] vs [35,44])","guard_snippet":"hybridLines.some(l => ref.valueMin <= iv(l).max && iv(l).min <= ref.valueMax)","potential_consequence":"Contaminated pure price"},
{"lens":"edge-case-hunter","location":"CAP-4 overlap (FR-16)","trigger_condition":"slotOverlap branches on single statId","guard_snippet":"Define hybrid×single and hybrid×hybrid overlap","potential_consequence":"Double-counted items"},
{"lens":"edge-case-hunter","location":"CAP-6; CAP-2","trigger_condition":"Hybrid line shares statId with other slot (Bows LightRadiusAndAccuracy; Boots StunThreshold)","guard_snippet":"Group all lines by statId; one summed filter each","potential_consequence":"Real items excluded"},
{"lens":"edge-case-hunter","location":"CAP-6 vs CAP-3","trigger_condition":"Per-slot values outside bands but sum inside","guard_snippet":"Same event for price and probability, or record mismatch","potential_consequence":"EV miscomputed"},
{"lens":"edge-case-hunter","location":"CAP-6; CAP-4","trigger_condition":"Disjoint per-slot bands, intersecting sums","guard_snippet":"Overlap on [Σmin,Σmax]","potential_consequence":"Overlapping searches pass FR-16"},
{"lens":"edge-case-hunter","location":"CAP-6","trigger_condition":"Shared statId with valueless ref","guard_snippet":"Reject or emit value:{}; specify","potential_consequence":"NaN edges or crash"},
{"lens":"edge-case-hunter","location":"CAP-2 vs CAP-1","trigger_condition":"Valueless hybrid line filter unspecified","guard_snippet":"valueless ? {id, value:{}} : {id, value:{min,max}}","potential_consequence":"Invalid request"},
{"lens":"edge-case-hunter","location":"Constraints","trigger_condition":"Hybrid with null-statId line (Time-Lost Diamond/Emerald)","guard_snippet":"Untrackable with stated reason in lookup","potential_consequence":"Unclear check failure"},
{"lens":"edge-case-hunter","location":"CAP-1","trigger_condition":"Hybrid ref with 0 or 1 line","guard_snippet":"lines.min(2) + unique-statId refine","potential_consequence":"Duplicate-check bypass"},
{"lens":"edge-case-hunter","location":"CAP-1; canonical key","trigger_condition":"Same lines in different order","guard_snippet":"Sort by statId or reject unsorted","potential_consequence":"Key drift"},
{"lens":"edge-case-hunter","location":"CAP-4 edge alignment","trigger_condition":"Per-line alignment vs conjunction containment","guard_snippet":"Conjunction containment first, then per-line extremes","potential_consequence":"False passes"},
{"lens":"edge-case-hunter","location":"CAP-7","trigger_condition":"No acceptedTier, missing short form, or valueless line","guard_snippet":"Fallback: all lines verbatim with bands, verbatim:true","potential_consequence":"Mixed display"},
{"lens":"edge-case-hunter","location":"Constraints (both affixes required)","trigger_condition":"Absent-affix branches remain in code","guard_snippet":"Required slots; remove or assert-unreachable absent branches","potential_consequence":"Dead code; false overlaps"}
]
```
