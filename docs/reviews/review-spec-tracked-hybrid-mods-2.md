# Review: SPEC-tracked-hybrid-mods

Content: `docs/stories/archive/spec-tracked-hybrid-mods/SPEC.md` (docs, defines behavior).
Lenses run: adversarial, edge-case-hunter, structure, prose (after structure). Verification-gap skipped (code only).
Overlap between lenses is signal and is noted inline. Edge-case and adversarial both flag the summed-statId valueless rule being checked only in `tracked:check`, the missing hybrid `coOccur` rule, the empty/absent weights handling, and the null-`statId` tier split.

## Adversarial

1. **Null-`statId` rule too coarse** (Constraints; CAP-5)
   - Trigger: WEIGHTS-FILE-SCHEMA 6.1.0 says a `statId:null` line can be an internal engine line that never changes weight. 8 of 560 hybrid tiers have one. The spec calls all of them untrackable.
   - Fix: Split the rule: not-in-game (weight 0) is untrackable; internal lines do not enter the line set; other null lines are untrackable with a reason. State how `tracked:lookup` tells them apart, or declare internal lines out of scope.
   - Consequence: A trackable hybrid is refused, or lookup, core and the sync gate disagree.
2. **§11 mod-group exclusion for hybrids unspecified** (Document changes vs Capabilities)
   - Trigger: §11 needs a containment set and one modGroup per family. CAP-3 covers only the single-slot weight sum.
   - Fix: Extend CAP-3: §11's C_p/C_s use the conjunction containment set, g(e) is the family's modGroup. Test hybrid+pure, hybrid+hybrid, and a hybrid and suffix sharing a modGroup.
   - Consequence: Headline probability for hybrid entries is wrong or untested.
3. **Summed-filter interval wider than reachable sums** (CAP-6 vs §1 containment)
   - Trigger: Sum of mins to sum of maxes admits combinations outside the tracked bands (low prefix + high suffix from different tiers). The accepted-effect bullet covers only neighbouring-tier combinations.
   - Fix: Quantify, or pin with a fixture test, or state in AD-16 that price is an upper-bound population.
   - Consequence: Price is biased in an unmeasured direction; "very unlikely" has no data.
4. **Valueless-on-summed rejection only in `tracked:check`** (CAP-6)
   - Trigger: CAP-4's core cross-file check is not extended to this rule.
   - Fix: Run it in core at web load and the sync gate. It is decidable from the entry alone, no weights file needed.
   - Consequence: Sync sends a min-only or malformed filter.
5. **`coOccur` undefined for hybrids** (CAP-4 / Constraints overlap)
   - Trigger: §2.1 ends in `coOccur` between different statIds. No rule when x or y is a hybrid, or across slots.
   - Fix: Define `coOccur(x,y)` as "some entry in the scoped pool is contained by both". Add tests.
   - Consequence: Double-counting passes load, or valid lists are rejected.
6. **CAP-8 removals not enumerated** (Constraints; CAP-8)
   - Trigger: PRD line 78, FR-16 "prefix-only", FR-22, §2.1 consequences 2-4, §8 and §11 rely on absent affixes.
   - Fix: List each removal under Document changes. State that existing partial entries are deleted, not converted.
   - Consequence: Dead branches and stale normative text remain.
7. **Success signal does not exercise the feature** (Success signal)
   - Trigger: A rewritten `tracked.json` with only pure entries passes.
   - Fix: Require at least one hybrid and one summed-statId entry that pass `tracked:check` and AD-17 against `data/weights.json`.
   - Consequence: Real-data defects surface after merge.
8. **Hybrid label may read as two affixes; no overflow rule** (CAP-7)
   - Trigger: Short forms are shared with pure modifiers, and nothing sets a chase-cell width or ellipsis rule for a two-line label.
   - Fix: Apply the EXPERIENCE short-form overrun rule to the joined label. Test the longest hybrid label. Accept or fix the ambiguity explicitly.
   - Consequence: Misread hybrid, or an overflowing cell.
9. **Schema gaps on bands and key** (CAP-1; canonical key)
   - Trigger: Only repeated `statId` is rejected. `min > max` and non-finite values pass. Key distinctness from single-line keys and exclusion of `acceptedTier` are unshown.
   - Fix: Add schema tests for each.
   - Consequence: Obscure containment errors or key collisions.
10. **Stale-artifact handling inconsistent** (Constraints, breaking changes)
    - Trigger: The spec deletes the three artifacts and also says old keys age out. §4.1 and §12 are not in the revision list. Artifact schema version bumps are not named.
    - Fix: Add §4.1 and §12. Name the bumps. Test that an old-key progress file ages out without throwing.
    - Consequence: Startup break on a restored artifact; stale report identity doc.
11. **Load-bearing "trade sums" premise has no recorded evidence** (Why; Constraints)
    - Trigger: Only "manual observation". Local vs explicit stat ids unchecked.
    - Fix: Add a captured request/response to IMPLEMENTATION-NOTES §5 and cite it in AD-16. Add an OQ if local stats are unverified.
    - Consequence: Every summed price is wrong while fixture tests pass.
12. **Multi-modGroup error blames the wrong party** (CAP-4)
    - Trigger: Spec data shows no such family. Error is framed as a curator fault.
    - Fix: Justify with a fixture. Say in the error text which side is at fault, as §2.5 does.
    - Consequence: A producer fault is reported as a curator error.
13. **Alignment on the conjunction set under-specified** (CAP-4; §2.4)
    - Trigger: No rule for bands where one line covers T1–T2 and another only T1.
    - Fix: Add a worked table: containment set {T1}, so A's T1–T2 band is misaligned.
    - Consequence: Implementers give different verdicts for one entry.
14. **PRD ownership of the capability missing** (Document changes: PRD)
    - Trigger: No FR for hybrid or summed pricing. Line numbers ("line 78") are brittle. PRD line 565 ("one prefix, one suffix") is not listed.
    - Fix: Add an FR, cite it from CAP-1/2/6, and reference sections by id.
    - Consequence: CAPs have no traceable FR; PRD and spine drift.

## Edge-Case Hunter

1. **CAP-6 / summed `statId`, banded vs valueless across slots**: check must also run in core (see Adversarial 4). Consequence: sum with null gives NaN or min-only filter.
2. **CAP-6, composition of the sum**: pure+pure+hybrid mixes beyond two contributors are not asserted impossible. Fix: assert at most two contributions per `statId`.
3. **CAP-6, open-ended bands**: only `min` or only `max` present. Fix: sum is undefined if either operand's bound is missing. Consequence: wrong trade filter.
4. **CAP-6 probability**: summed filter matches neighbouring-tier combos while probability uses per-slot containment. Fix: add a test pinning the divergence. (Overlaps Adversarial 3.)
5. **CAP-1 / completeness, empty containment set**: the check passes vacuously. Fix: fail when no tier with `weight > 0` is contained.
6. **Containment set, tiers with differing line counts** (extra null-`statId` line on some tiers): exclude and report by tier id.
7. **Weights file absent**: the spec defers to AD-17. Fix: state explicitly that the completeness check is skipped and the entry marked unvalidated, in both core and `tracked:check`.
8. **CAP-1, band validity**: `min > max`, single bound, non-integer or negative values. Fix: `z.refine` on each line. (Overlaps Adversarial 9.)
9. **CAP-1, empty or null `statId`**: `z.string().min(1)`. Consequence: filter with no id.
10. **CAP-8 / breaking change**: an old file yields an opaque Zod error. Fix: reject old schema versions with a message naming the major bump.
11. **Stale keys**: after the bump, old and new keys may partially match. Fix: drop artifact entries whose key is not in the current tracked key set.
12. **CAP-2, duplicate ids in one `and` group**: assert none after summing.
13. **CAP-4, single-line band reaching a hybrid tier**: define whether weight-0 tiers and other-slot tiers count. Restrict to same-slot pool with `weight > 0`.
14. **Overlap, two hybrids with zero shared lines**: "every shared line intersects" is vacuously true. Fix: return false when there are no shared lines.
15. **Overlap, hybrid vs single-line across slots on one `statId`**: two rules (summed vs per-slot) can apply. Specify one.
16. **`needs(hybrid)`**: empty containment set gives `-Infinity` from `Math.max`. Guard empty sets and undefined `itemLevelMin`.
17. **CAP-7, 3+ lines, long labels, absent `acceptedTier`**: add fallback tests.
18. **CAP-7, short form missing for one line only**: use short form only if every line has one.
19. **Decisions / CAP-3, `acceptedTier` when lines straddle tiers**: define it as the tier id of the hybrid weights entry. Reject if contained tiers disagree.
20. **CAP-5, mixed trackable and untrackable tiers in one family**: offer the family only when all contained tiers are trackable.
21. **CAP-3, tier in both a hybrid and a pure family**: dedupe by tier id when summing weights.

## Editorial Structure

| Pass | Original Text | Revised Text | Changes |
| --- | --- | --- | --- |
| structure | Constraints (about 700 words, 13 bullets) | MOVE/split into Definitions (before Capabilities), Rules, and Migration and accepted effects | Definitions, rules, rationale, evidence and migration are mixed. CAP-4 and CAP-6 use terms before they are defined. (0 words) |
| structure | Constraints: "Breaking changes are allowed…" and "Accepted effect…" | MOVE to a Risks and migration section after Non-goals | Risk and rollout facts, not build constraints. (0 words) |
| structure | Decisions (one bullet) | MOVE into Constraints or beside CAP-7. Remove the heading | The only decision is buried at the end. (about -5 words) |
| structure | Intro note on CAP ordering | CONDENSE and fix: order is 1, 2, 6, 3, 4, 5, 7, 8. Renumber, or correct the note | The note describes an order the list does not have. (about -15 words) |
| structure | Canonical key sorting in CAP-1 and Constraints | MERGE. Keep it in Constraints | Stated twice. (about -25 words) |
| structure | Completeness rule in Constraints and CAP-4 | MERGE. State once | Stated twice. (about -40 words) |
| structure | Overlap in Constraints and CAP-6 | CONDENSE CAP-6 to a pointer | §2.1 owns the formula. (about -30 words) |
| structure | "occupies exactly one slot" and "Both slots are required…" | CUT the first (AD-5 owns it). Move the second into CAP-8 | Restates AD-5 and CAP-8. (about -35 words) |
| structure | Non-goal "More than one reference per slot" | CUT | Duplicates the constraint and AD-5. (about -6 words) |
| structure | Tier-scope bullet, 2792/560 counts | MOVE the statistic to CAP-4. QUESTION whether the counts go stale | Evidence mixed into a rule. (0 words) |
| structure | CAP-4 trailing paragraph on the core cross-file check | CONDENSE into the first success sentence | Different level from the list. (about -10 words) |
| structure | Why line and "Retire the Deferred item." | PRESERVE the Why line. CUT the repeat | Stated twice. (about -5 words) |
| structure | Why section, no lead | MOVE. Add a one-sentence lead | The conclusion appears late. (about +25 words) |
| structure | Document changes | PRESERVE | A real hand-off list. |
| structure | CAP intent/success pairs | PRESERVE | Consistent and testable. |

Net about -170 words (about 11%), if all are accepted. Word counts are estimates.

## Editorial Prose

| Pass | Original Text | Revised Text | Changes |
| --- | --- | --- | --- |
| prose | "It is the max of `itemLevelMin` when any line is banded and the min when every line is valueless." | "It is the maximum `itemLevelMin` when any line is banded and the minimum `itemLevelMin` when every line is valueless." | Name the field in both branches. |
| prose | "…when the reference's `statId` is one of its lines… and they co-occur in one slot or class pool." | "…one of the hybrid's lines… and the hybrids co-occur…" | "its" and "they" have ambiguous antecedents. |
| prose | "conjunction containment set" (CAP-4, Constraints) vs "hybrid containment set" | Consider: use one term in all places? | One concept, two names. |
| prose | "differ from the line `statId`s of any contained tier" | "differ from those of any contained tier" | Removes repetition. |
| prose | "It fails each of the following, and…" | "It fails each of the following cases, and…" | Missing noun. |
| prose | "A subset is rejected, because it reproduces the overlap…" | "The check rejects a subset because it reproduces the overlap…" | Active voice; no comma. |
| prose | "When `weights.json` is absent the check follows…" | Add a comma after "absent" | Introductory clause. |
| prose | "holds the entries with `weight > 0`, an identical line `statId` set, and every line contained by the reference" | "holds the entries that have `weight > 0`, …" Consider: "…and in which the reference contains every line"? | Unlike items under one "with". |
| prose | "each line is encoded as a single-line reference is today" | "…is encoded today" | Dropped verb. |
| prose | "It sorts lines by `statId`, so…" (CAP-1) | "The schema sorts lines by `statId`, so…" | Unclear antecedent. |
| prose | "yields the hybrid tiers' weight sum only, and each contained tier counts once." | "yields only the hybrid tiers' weight sum and counts each contained tier once." | Ambiguous "only". |
| prose | "one summed filter per such `statId`" | "…for each shared `statId`" | "such" is vague. |
| prose | "`explicit.stat_803737631` holding…" / "`stat_1509134228` holding…" | Drop "holding" for "with". Consider: keep the `explicit.` prefix on both ids, or on neither? | Prefix on one id only. |
| prose | "as its tier label, then its lines separated by commas." | "as its tier label followed by its lines, separated by commas." | Clarity. |
| prose | "catalogue", "neighbouring" | "catalog", "neighboring" | US spelling per the style guide. |
| prose | "Price and probability populations then differ slightly. The case is very unlikely…" | "The price and probability populations then differ slightly. This case is unlikely…" | Cut filler. |
| prose | "takes a major bump and is shaped by this design alone" | "gets a major version bump, and this design alone shapes it" | Idiom and passive. |
| prose | "A key that no longer matches an entry is treated as stale and ages out." | "The next sync treats a key that no longer matches an entry as stale, and the key ages out." | Names the actor. |
| prose | "A hybrid tier whose weights entry has a null-`statId` line is untrackable by a hybrid reference." | "A hybrid reference can't track a hybrid tier whose weights entry has a null-`statId` line." | Active voice. |
| prose | EXPERIENCE.md: "takes CAP-7's treatment." | "applies CAP-7's treatment." | Fragment with a vague verb. |
| prose | "A stat that rolls two numbers on one line. The `banded` kind already handles it." | "…(the `banded` kind already handles it)." | Matches the other non-goals. |

Two further minor prose fixes are omitted (the `prd.md` line-number reference and the "T1 or T1–T2" wording).

## Reviewer note

Per the Review brief, this review edits no owner document. Triage should reject any finding that conflicts with the Accessibility Floor in EXPERIENCE.md. Adversarial 8 asks for a width and ellipsis test, which the Floor does not rule out, since it concerns the short-form overrun rule.
