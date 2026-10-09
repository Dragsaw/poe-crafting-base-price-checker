# Review: spine revision 25 after the altitude pass (rubric)

- **Subject:** `git diff HEAD` of `ARCHITECTURE-SPINE.md`, `IMPLEMENTATION-NOTES.md` (IN) and `AGENT-WORKFLOW.md` (AW), revision 25 plus its altitude pass
- **Source:** `docs/stories/archive/spec-tracked-hybrid-mods/SPEC.md`, with the *pending spec correction* in `owner-change-briefs.md` (no `acceptedTier` check)
- **Prior reviews read:** `review-rev25-rubric.md`, `review-rev25-adversarial.md`, `review-rev25-verification.md`
- **Date:** 2026-10-03
- **Verdict:** The altitude pass lost no fact, and every new spine citation resolves to a section that says what the spine claims, apart from one stale count (F3). Most rev-25 review findings are fixed. One gate-level decision, the `partial-pool` unvalidated verdict, exists only in a companion and contradicts the spine's abort rule (F1). The overlap consequence is stated two ways (F2). Fix F1 to F4 before a story cites AD-17 or IN §1, §2.1 or §12.1.

---

## Part 1: Fact preservation (altitude pass)

Each row is a fact that the pre-altitude rev-25 spine stated (as quoted in `review-rev25-rubric.md` and `review-rev25-adversarial.md`), and where it now lives.

| Fact moved out of the spine | Now in | Preserved |
| --- | --- | --- |
| Hybrid shape rules (two or more lines, no repeated `statId`, line order) | IN §4.1 *Shape rules* and *Lines sort by `statId`* | Yes. "Sorted" is now a parse-time normalisation, not a refusal, which fixes adversarial H5 |
| Old-major message names the bump | IN §4.1 *The tracked schema's major version names the change* | Yes |
| Summed edges, Σmin to Σmax | IN §5.5 `min`/`max` block, and §2.1 `sum(e, s)` | Yes |
| Summed operand rules (valueless refused, missing bound, at most two operands) | IN §2.3 within-file list, cited from §5.5 | Yes |
| Accepted wider population | IN §5.5 *The accepted wider population*, which now also names single-slot items (adversarial H3, rubric F2) | Yes, and widened |
| "A summed `statId` compares summed intervals, the one cross-slot comparison" | IN §2.1 prose and consequence 4 ("Per-slot overlap does not apply across slots") | Yes |
| Null-line rule content (not-in-game, internal engine line, `partial` null) | IN §1 *Line sets and the null-line rule* (`untrackable`, `lineSet`) | Yes. It agrees with `WEIGHTS-FILE-SCHEMA.md` 6.1.0 |
| Kind agreement per line | Spine table row ("**per line**") and IN §2.3 *The check runs per line* | Yes |
| Weights-absent per-entry mark and its `sync` record | IN §2.8. The false "like the other five checks" claim is gone (rubric F3, verification F1) | Yes, corrected |
| `tracked:check` behaviour on a skipped check | AW step 1 ("lists each crafted entry marked `weights-absent` under its skipped `cross-file` check and does not fail on them") | Yes |
| Hybrid probability is the contained tiers' weight, never a product | Spine AD-17 (kept as a one-line decision) and IN §11 | Yes |

## Part 2: Citation check

| Spine citation | Target says it | Result |
| --- | --- | --- |
| AD-5 → IN §4.1 (shape rules, line order, old-major message) | All three present | OK |
| AD-16 → IN §5.5 (edges, operand rules) | Edges present. Operand rules present by citation of §2.3 | OK |
| AD-16 → IN §5.1d, OQ-27 | Capture pending, cases 1 and 2. OQ-27 now asks the producer-resolution question (verification F3 fixed) | OK |
| AD-17 → IN §2.1 (predicate, branch order, consequences) | Present | OK |
| AD-17 → IN §11 (hybrid as one modifier) | *A tier counts once* paragraph | OK |
| AD-17 → IN §1 (null-line rule) | Present | OK |
| AD-17 → IN §2.8 (weights-absent mark) | Present | OK |
| AD-17 table → §2.1/§2.2, §2.3, §2.4, §2.5, §2.6, §2.7 | All resolve | OK. See F5 for the wording of the completeness row |
| Conventions *Entity keys* → IN §4.1 (three forms) | banded, valueless, hybrid | OK |
| **AD-11 → IN §1 *Containment*: "the three rules that ride with it"** | **IN §1 now says "Five rules ride with it"** | **Stale (F3)** |

## Part 3: SPEC capability coverage

| CAP | Lands in | Status |
| --- | --- | --- |
| CAP-1 hybrid arm, shape, key | AD-5, IN §4.1 | Covered |
| CAP-2 one filter per line | AD-16 stat-filter row | Covered |
| CAP-3 probability | AD-17, IN §11 | Covered |
| CAP-4 load checks, completeness, weights-absent | AD-17 table, IN §2.4, §2.5, §2.7, §2.8 | Covered. The `acceptedTier` bullet is correctly not implemented (pending correction). SPEC.md still carries it (F11) |
| CAP-5 `tracked:lookup` shares the null-line rule | AD-17 null-line paragraph, IN §1 | Covered as a rule. Enforcement is not stated (F8) |
| CAP-6 summed filter and overlap | AD-16, IN §2.1, §2.3, §5.5 | Covered. One placement differs from SPEC (F11) |
| CAP-7 rendering | `EXPERIENCE.md` (not spine scope). AD-5 keeps the label on the hybrid as a whole | Covered |
| CAP-8 both affixes required | AD-5, ERD prose, IN §4.1, §8, §11 | Covered. No absent-affix residue outside the historical revision-16 blockquote |

## Part 4: Status of earlier rev-25 findings

Fixed: rubric F1 (`contains_S` in §2.2), F3, F4 (table row and IN §2.6), F6.4 (`line-set-completeness` enum value), F6.6 (§2.3 payload); adversarial H1, H2 (pair-level straddle), H3 (accepted in §5.5), H5, H6; verification F1, F2, F3, F5 (named as a change site in IN §1), F6.

Open: adversarial H4 is fixed only in a companion (F1 below). Adversarial H7 is open (F7). Verification F4 is open (F4). AW lines 66 and 94 are open (F6).

---

## Part 5: Findings

### F1: High. The `partial-pool` unvalidated verdict is a gate decision that lives only in IN §1 and contradicts AD-12

**Location:** IN §1 *Containment*, fourth rule ("In a `partial` pool, a §2.4, §2.5 or §2.7 verdict that turns on excluding an untrackable tier is reported as unvalidated with the reason `partial-pool`, never as a failure"). Spine AD-12 ("A weights file that is **present and fails** still aborts") and AD-17 (the weights-absent paragraph, which names only `weights-absent`).

This rule decides whether the `sync` run-start gate aborts. That is AD-12's and AD-17's call, not a predicate detail. A `sync` author who reads the spine aborts. A `core` author who reads IN §1 returns no failure. Three more gaps make units diverge:

1. **"Turns on excluding an untrackable tier" is not a predicate.** One builder re-runs the check with untrackable tiers treated as trackable and downgrades only when the verdict flips. Another downgrades every §2.4/§2.5/§2.7 failure in a `partial` pool. The results differ for a band that is misaligned for reasons unrelated to the untrackable tier.
2. **No surface is named.** IN §12 has no record for a `partial-pool` mark. AW step 1 tells `tracked:check` how to treat `weights-absent` but not `partial-pool`, so one `tracked:check` exits 1 and another exits 0.
3. The `core` return shape (failures plus unvalidated entries) is stated in §2.8 for `weights-absent` only.

**Fix:** In AD-17, beside the weights-absent paragraph, add one sentence: "In a `partial` pool, a verdict that depends on an untrackable tier is unvalidated with reason `partial-pool`, never a failure, so it does not abort `sync` (IN §1)." In IN §1, define it as a predicate: *the check fails as written and passes when every untrackable entry is treated as trackable*. In IN §2.8 (or a new §2.9), give one `core` return shape for both reasons. In AW step 1, state that `tracked:check` lists `partial-pool` entries and does not fail on them. In IN §12, state whether `sync` records it, or that the class-level `partial` unrankability already covers it.

### F2: Medium. Overlap is "rejected at load as a `tracked.json` error" in two places and "per-class" in a third

**Location:** Spine AD-17 *Summands must be mutually exclusive* ("**Overlap is a validation error on `data/tracked.json`, rejected at load**, and never a case `core` reconciles"). IN §2.1 *Error payload* ("An overlap is rejected at load as a `data/tracked.json` validation error … The rejection itself is AD-17's load-time rule"). Against spine AD-17's straddle paragraph ("A pair in which either slot names a hybrid reference is evaluated whole by `core` … takes the per-class consequence").

For a hybrid pair, `web` must render and exclude one class. The first two sentences tell a `web` author to refuse the artifact. Hybrid pairs are now the everyday case: the success signal tracks one hybrid affix with several partners.

**Fix:** In the spine, change the first sentence to "Overlap is a validation error, never a case `core` reconciles; whether it refuses `tracked.json` or excludes one class follows the pair (below)." In IN §2.1, say the payload is the same for both consequences, and that a hybrid pair's verdict is reported as the `coOccur` cross-file failure under AD-17's per-class rule.

### F3: Medium. AD-11 summarises containment for single-line references only, and its rule count is stale

**Location:** Spine AD-11, *Containment is whole-tier* ("A tier whose derived interval lies wholly inside a tracked band contributes … The `contains` predicate and the **three** rules that ride with it are in IN §1").

IN §1 now has five rules, two of them new (untrackable entries, `partial-pool`). For a hybrid, containment also needs line-set equality and every line covered. A reader who stops at AD-11 builds the existential single-line test for a hybrid. The binding citation is correct, but the spine sentence says something the cited section no longer says.

**Fix:** "The `contains` predicate, its hybrid arm (equal line set, every line covered), and the rules that ride with it are in IN §1." Drop the count.

### F4: Medium. The artifact major bumps and the deletion of committed data have no spine anchor, and verification F4 is still open

**Location:** IN §12.1. Spine AD-5 names only the tracked-schema major bump.

The change bumps the majors of `dataset.json`, `sync-progress.json` and `sync-report.json` and deletes the committed files. That is a cross-unit decision: `sync` writes them, `web` reads them, and AD-3 owns the artifacts. It sits only in a companion. Verification F4 measured that no committed key changes under the new encoding, that keys are opaque `z.string()` in every reader, and that the deletion throws away 186 priced observations and leaves `web` without a required artifact until the next sync. §12.1 was extended (version constants, `parseEnvelope` `expected`) but kept the deletion, with no rationale against those measurements.

**Fix:** Decide it in the spine. Either (a) state in AD-5 that only the tracked schema takes a major bump, and that the artifacts keep their majors because keys are opaque and the drop rule removes stale keys, then delete the bump and deletion from IN §12.1, or (b) cite IN §12.1 from AD-5 and record in `addendum.md` why the deletion is worth 186 observations.

### F5: Low. The line-set completeness row claims more than §2.7 checks

**Location:** Spine AD-17 table, row *Line-set completeness* ("a reference does not name **exactly** the line set of the tiers its **search reaches**").

§2.7 fires only on a proper superset (`⊋`). A larger `statId` set fails §2.5, not §2.7. For a summed line, the search reaches further than §2.7 models, and IN §5.5 says that wider reach "is not reported". A test author who writes fixtures from the row expects §2.7 to catch both.

**Fix:** "a reference names fewer lines than a tier its per-slot bands reach (a hybrid subset, or a single-line band reaching into a hybrid tier), or a hybrid's contained tiers span more than one `modGroup`. The summed reach is AD-16's accepted effect, not this check's."

### F6: Low. AGENT-WORKFLOW contradicts itself and the code

**Location:** AW line 66 ("the checks that `pnpm tracked:check` lists under `pending`"), against AW line 98 ("under its skipped `cross-file` check") and `packages/sync/src/curation/check.ts`, whose statuses are `passed | failed | skipped`. AW line 98 also still calls class discriminability "the odd one" because "its subject is the **search**", which IN §2.6 now says §2.7 shares. AW line 94 says `ModifierWeight` follows `6.0.0`; AD-11 says `core` implements `6.1.0`, and IN §1 depends on it.

**Fix:** Change line 66 to `skipped`. Reword the "odd one" sentence to name both search checks. Change `6.0.0` to `6.1.0` on line 94.

### F7: Low. IN §8 `tier(ref)` reads two predicates, and an undefined `needs` has no defined effect (adversarial H7, open)

**Location:** IN §8. The hybrid arm goes through `contains`, which excludes weight-0 and untrackable tiers. The banded and valueless arms do not. A weight-0 tier can raise a single-line floor but not a hybrid floor. "No floor can be derived for its entry" does not say whether `floor(cat)` becomes undefined or skips the entry, so two `tracked:lookup` builders differ.

**Fix:** Define every arm as `{ w ∈ unscoped pool : contains(ref, w) }`. Add: "An undefined `candidate` makes `floor(cat)` undefined, and `tracked:lookup` reports the class without a floor."

### F8: Low. The one-implementation rule for `tracked:lookup` is unenforced, and IN §1 carries code-status narrative

**Location:** Spine AD-17 ("`tracked:lookup`, `core` and the `sync` gate all call the one `core` implementation"). IN §1 ("`tracked:lookup` … today keeps a `null` `statId` … reports the eight Time-Lost Diamond … tiers as hybrids. It must call `core`'s `lineSet`").

The spine states the rule as present fact, and nothing checks it: `lookup.ts` sits outside the package graph that `contracts-isolation.test.ts` guards. The "today" sentence in IN §1 is a work item, and it will be wrong the day the story lands.

**Fix:** Move the "today" sentence to `docs/stories/deferred-work.md` or the story spec. In AW step 1, name `lookup.ts` as a caller of `core`'s exported `lineSet`/`untrackable`, and require a test that `lookup` and `core` give the same verdict on the Time-Lost Diamond fixture.

### F9: Low. Residual mechanism and vague wording in AD-17

**Location:** AD-17 table, *Kind agreement* row ("a line's kind is read from **whether its `ranges` is empty**, since `5.0.0` has no `kind` field"). This repeats IN §2.3 and cites a superseded contract version. AD-17 discriminability paragraph: "with line-set completeness sharing that property **in part**" cannot be enforced or tested.

**Fix:** Cut the `ranges` clause from the row and leave the §2.3 citation. Replace "in part" with the fact: "line-set completeness also prevents a wrong price (a hybrid priced with pure items), not just a pointless one."

### F10: Low. A Deferred item has a larger blast radius after rev 25

**Location:** Spine *Deferred*, "A mechanical guard on a dropped tier or a dropped stat line".

Containment now requires line-set equality, so a dropped line on a hybrid tier in a `complete` pool makes that tier look pure. A pure band then contains it, §2.7 does not see a hybrid to protect, and the search prices hybrid items as the pure chase. No unit diverges, but the item's consequence text no longer describes the risk.

**Fix:** Add one clause: "A dropped line also turns a hybrid tier into a pure one for AD-17's containment and §2.7." Keep the revisit trigger.

### F11: Low. The source SPEC disagrees with the landed design in two places

**Location:** `SPEC.md` CAP-4 still lists the `acceptedTier` failure (overridden by the 2026-10-03 ruling). CAP-6 says the valueless and missing-bound rejections "run in `core`". IN §2.3 places them in `contracts`, which is the correct place for a within-file rule. The spine's new `sources:` entry points at the unamended SPEC.

**Fix:** Amend SPEC.md: delete the `acceptedTier` bullet and say "run in the per-file schema (`contracts`), so at web load, at the sync gate and in `tracked:check`".
