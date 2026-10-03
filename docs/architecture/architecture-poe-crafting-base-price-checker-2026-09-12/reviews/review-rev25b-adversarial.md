---
title: 'Adversarial review — spine revision 25 (post-altitude pass)'
reviewed: ARCHITECTURE-SPINE.md rev 25, IMPLEMENTATION-NOTES.md, AGENT-WORKFLOW.md (working tree vs HEAD 0197df7)
date: '2026-10-03'
method: 'Build two units one level down that each obey every AD and cited companion section to the letter, and look for an incompatible pair.'
---

# Adversarial review — revision 25, after the altitude pass

## Verdict

The hybrid arm, the summed filter and line-set completeness are coherent as predicates. The holes are at the seams between units. They are: who runs the overlap predicate on a hybrid pair, what an "unvalidated" verdict is and who consumes it, and how per-slot and per-line failures map onto the §12 record identity. One of these (F1) lets a real overlap fall between `contracts` and `core` with no report. Another (F2) leaves the `sync` abort decision on partial pools underdetermined. Neither is fixed by the spine. Both need a short mechanism paragraph in `IMPLEMENTATION-NOTES.md`.

| # | Severity | Short title | Owner of the fix |
| --- | --- | --- | --- |
| F1 | critical | A hybrid-pair overlap can fall between `contracts` and `core` | IN §2.1 (and one spine word) |
| F2 | high | "Turns on excluding an untrackable tier" has no definition | IN §1 |
| F3 | medium | The `unvalidated` result has no shape, no record and no consumer rule | IN §2.8, AGENT-WORKFLOW |
| F4 | medium | Per-slot and per-line payloads collide under the §12 record identity | IN §12 |
| F5 | medium | §8 `tier(ref)` uses different populations for different arms | IN §8 |
| F6 | medium | The wire shape of a hybrid line is not stated | IN §4.1 |
| F7 | low | `tracked:lookup` must import `core` but has no dependency edge | AGENT-WORKFLOW |
| F8 | low | The `co-occur` check name now covers verdicts that never read `coOccur` | IN §2.7/§12 (enum) |
| F9 | low | §2.1 consequence 4 uses a rationale that the predicate applies only halfway | IN §2.1 |
| F10 | low | The §2.7 intro describes the search wrongly for a summed line | IN §2.7 |
| F11 | low | AGENT-WORKFLOW still says to write `ModifierWeight` to `6.0.0` | AGENT-WORKFLOW |
| F12 | low | The order of stat filters inside the `and` group is free | IN §5.5 |

---

## F1 — critical — A hybrid-pair overlap can fall between `contracts` and `core`

**Spine (AD-17):** "A pair of single-line references never reaches `coOccur` … is `contracts`' per-file validation … **A pair in which either slot names a hybrid reference is evaluated whole by `core`** … **`contracts` never refuses a pair that `core` would load.**"

**IN §2.1:** one predicate. Its first `slotOverlap` branch (`true if x or y names no statId outside S`) and the sum conjunct (`∀ s ∈ S : sum(a,s) ∩ sum(b,s) ≠ ∅`) need no weights. So a pair that contains a hybrid can be judged overlapping without `coOccur`.

**Concrete pair.** Entry *a*: prefix pure Rarity `[r1,r2]`, suffix pure Rarity `[r3,r4]`. Entry *b*: prefix hybrid `{Rarity, X}`, suffix pure Rarity. `S = {Rarity}`. Prefix slot: *a*.prefix names nothing outside `S`, so the first branch is `true`. Suffix slot: both name only Rarity, so the first branch is `true`. When the two summed intervals intersect, `overlap(a,b)` is `true`, and no branch read `coOccur`.

**Unit A (`contracts`, `TrackedFileSchema`)** follows the existing pattern (`packages/contracts/src/overlap.ts`). It runs the one predicate with the injected oracle `NEVER_CO_OCCUR`, as IN §2.1/§2.2 describe ("`coOccur` takes `S` too"). The pair fires, and `contracts` refuses the whole artifact under AD-3. This breaks the spine's "evaluated whole by `core`" rule and its per-class consequence: `web` refuses the file instead of reporting the class and still rendering.

**Unit A′ (`contracts`, spine-literal)** skips every pair that contains a hybrid. **Unit B (`core`)** keeps the existing de-duplication (`packages/core/src/cross-file.ts:318`: report only if the real oracle fires **and** `NEVER_CO_OCCUR` does not, "because `contracts` already reported it"). Under A′+B the pair above is reported by **nobody**. The class ranks with `ΣP` counted twice, which is the defect AD-17 exists to stop. Both units obey every cited sentence. No document says that `core` must report oracle-free verdicts on hybrid pairs, or that `contracts` must skip them.

**Second ambiguity in the same sentence.** "A pair in which either slot names a hybrid" can mean "the slot pair" (prefix vs prefix) or "the entry pair" (any of four references). `overlap` is a conjunction over both slots, so the slot reading leaves the single-line slot of a mixed pair to `contracts`, which cannot conclude anything on one slot. The altitude pass moved the "which branch fired" wording out, and the spine now says less than a builder needs.

**Fix (IN §2.1, a new paragraph *Who evaluates which pair*):**
- `contracts` evaluates `overlap` only on an entry pair whose **four** references are all single-line, with `coOccur ≡ false`.
- `core` evaluates every entry pair in which **any of the four** references is `hybrid`, with the real oracle, and **reports every verdict that fires, including the ones reached without `coOccur`**. It does not de-duplicate against the within-file call.
- `core` evaluates no all-single-line pair.

Spine: change "either slot names a hybrid reference" to "any of the pair's four references is `hybrid`". That word is a decision boundary, so it belongs in the spine.

---

## F2 — high — "Turns on excluding an untrackable tier" has no definition

**IN §1, containment rules:** "In a `partial` pool, a §2.4, §2.5 or §2.7 verdict that **turns on excluding an untrackable tier** is reported as unvalidated with the reason `partial-pool`, never as a failure."

This sentence decides whether the `sync` gate aborts (AD-12). It gives no predicate, and there are two independent readings:

1. **Trigger.** Reading (a) is presence: the scoped pool holds any untrackable entry that carries a `statId` of the reference, so the verdict is downgraded. Reading (b) is counterfactual: re-evaluate with untrackable entries treated as trackable, and downgrade only if the verdict flips. Under (a), a genuine curator error, such as a misaligned band on a line unrelated to the null line, becomes unvalidated and `sync` spends budget. Under (b) it aborts.
2. **Which untrackable.** `untrackable` has two disjuncts: `not-in-game`, and a null line in a `partial` pool. A `not-in-game` tier is excluded correctly in any pool, because it cannot roll. Does excluding one in a `partial` pool also downgrade the verdict? The sentence says "an untrackable tier", which includes it.

The `core` author of §2.4 and the `core` author of §2.7 are two units under AGENT-WORKFLOW's "one exported concept per file" convention, and they can pick different readings. The same reference can then be "unvalidated" by §2.7 and "failed" by §2.4 on the same pool.

**Fix (IN §1):** state the predicate. Recommended: *a verdict is `partial-pool`-unvalidated iff the pool is `partial` and re-evaluating the check with every null-line-untrackable entry of that slot read as trackable (its null lines ignored) gives a different verdict; `not-in-game` exclusion never downgrades.* Add a fixture for each half.

---

## F3 — medium — The `unvalidated` result has no shape, no record and no consumer rule

Revision 25 adds two non-failure outcomes: `weights-absent` per crafted entry (§2.8) and `partial-pool` per verdict (§1). Today `core` returns `CrossFileFailure { check, entryKey, categoryId, className, detail }` (`packages/core/src/cross-file.ts:48`). No document says:

- what type carries the mark (a second array, or a `status` field on the failure), or at what grain (per entry, per reference, or per check × entry);
- whether `partial-pool` marks reach `sync-report.json`. §12 has no record kind for them, and `cross-file-gate-failure` is for failures;
- what `pnpm tracked:check` does with a `partial-pool` mark. AGENT-WORKFLOW exempts **only** `weights-absent` from the non-zero exit. A literal builder exits 1 on a file that the `sync` gate accepts. That is a direct verdict conflict between two callers of the same `core` function.

**Fix:** IN §2.8 (renamed *Unvalidated verdicts*) defines one result shape for both reasons, e.g. `{ entryKey, check | null, reason: 'weights-absent' | 'partial-pool' }`, and states that neither reason is written to `sync-report.json` beyond the existing class-level `weights-absent` record. AGENT-WORKFLOW's `tracked:check` line then says "lists every unvalidated mark and does not fail on any of them".

---

## F4 — medium — Per-slot and per-line payloads collide under the §12 record identity

§12: `cross-file-gate-failure` has the subject `(check, entryKey)` and the observation `detail`. Revision 25 adds payloads at a finer grain: §2.3 is per line ("the offending line's `statId`"), §2.7 is per reference ("Each names the tracked entry … and the slot"), and §2.1 can name several partners.

One entry with a §2.7 failure on both prefix and suffix gives two records with the same subject. Under `same(a,b)` the second **replaces** the first's `detail`, and the prefix failure disappears from the report. The rule that prevents this is "one failure per (check, entry), `detail` names every slot" (`cross-file.ts:42`). That rule is a code comment, not a contract term. A new `sync` or `core` builder working from §2.3/§2.7, which now read per line and per slot, has nothing that forbids emitting one failure per slot.

**Fix (IN §12):** state that `core` emits **at most one** failure per `(check, entryKey)` and folds every slot, line and partner into its `detail`. The alternative is to add `slot` and `statId` as optional subject fields. The first fix is smaller and matches the code.

---

## F5 — medium — §8 `tier(ref)` uses different populations for different arms

IN §8: for `banded`, `tier(ref)` is "the entries whose derived interval lies wholly within the band". For `valueless`, it is "every entry publishing that statId with an empty `ranges`". For `hybrid`, it is "the entries that `contains(ref, ·)` admits". Revision 25 made `contains` exclude `weight = 0` and `untrackable`, so the hybrid arm excludes them and the two single-line arms do not.

**Pair:** `tracked:lookup` (unit A) computes `needs` for a band that covers a weight-0 tier (`published` with `DropChance 0`, or `not-in-game`) at a higher `itemLevelMin` than the chased tiers. `needs` takes the weight-0 tier's level, and the curator declares that floor. `core` (unit B) computes §2.4 on `contained(ref)`, which ignores the tier. The floor is too high, and §8's *Alignment is monotone upward* guarantees that nothing catches it ("too high passes every mechanical check … moving the ranked order with nothing reported"). The same band on a hybrid line gives the correct floor.

**Fix (IN §8):** `tier(ref) = { w ∈ unscoped pool of (class, slot) : contains(ref, w) }` for every kind, in one line. This also makes the `hybrid` arm a non-special case.

---

## F6 — medium — The wire shape of a hybrid line is not stated

AD-5: `hybrid` is `lines: [line, …]`, "each line `banded` or `valueless` as above". IN §4.1 lists shape rules (≥2 lines, no repeated `statId`, finite non-negative edges). Neither document says:

- whether each line carries its own `kind` discriminant (`{kind:'banded', statId, valueMin, valueMax}`) or is a bare `{statId, valueMin?, valueMax?}` whose kind is read off edge presence. AD-5 forbids inference for the reference, but says nothing about lines;
- whether a line's `acceptedTier` is rejected (strict object) or ignored. AD-5 says the label "belongs to the reference as a whole, never to one of its lines", which is a semantic rule and not a schema rule.

**Pair:** `contracts` reuses the existing `ModifierRefSchema` members for lines (`kind` required, `acceptedTier` allowed). The `tracked-json` skill and `tracked:lookup` draft hybrids as bare lines without `kind`, following AD-5's "`(statId)` / `(statId, valueMin, valueMax)`" notation. Every drafted hybrid then fails `tracked:check`. With the opposite choices, a per-line `acceptedTier` that `contracts` accepts silently disagrees with the reference-level label that `web` renders.

**Fix (IN §4.1 shape rules):** "each line is a strict object with its own `kind` (`banded` | `valueless`), `statId`, and edges as for that kind; a line carries no `acceptedTier`."

---

## F7 — low — `tracked:lookup` must import `core` but has no dependency edge

IN §1: `tracked:lookup` "must call `core`'s `lineSet` and `untrackable`". The script sits at `.claude/skills/tracked-json/scripts/lookup.ts`, outside every package. The root `package.json` declares only `@poe/contracts`. No document says how the tool gets `@poe/core`: a root devDependency plus a tsconfig reference, or a move into `packages/sync/src/curation/` beside `check.ts`. AGENTS.md's known pitfall applies: a missing reference shows up only as TS2307 on a clean checkout.

**Fix (AGENT-WORKFLOW, the tool rules):** name the edge. Recommended: move `lookup.ts` under `packages/sync/src/curation/` as `check.ts` already is, and keep the `pnpm` script name.

## F8 — low — The `co-occur` check name now covers verdicts that never read `coOccur`

The AD-17 table row "**`coOccur`** — two entries overlap under §2.1 through a hybrid reference" now covers every hybrid-pair overlap, including the F1 case that fires on the sum alone. The `CrossFileCheckSchema` value `co-occur` and the `cross-file-gate-failure.check` field will then label a pure sum overlap "co-occur". **Fix:** in the same change that adds `line-set-completeness` (IN §2.7), rename the value to `overlap`. The schema is getting a major bump anyway (§12.1).

## F9 — low — §2.1 consequence 4 uses a rationale that the predicate applies only halfway

Consequence 4 rejects two entries whose per-slot bands are disjoint, "because AD-16's one summed filter cannot tell the two populations apart". That is a price-population criterion, not the probability-partition criterion that the rest of AD-17's overlap rests on. §5.5 says that a summed filter also admits single-slot items. So entry *a* (summed `s`) and entry *b* (`s` in the prefix only, `s ∉ S`) can have intersecting price populations, yet the predicate compares them per slot and passes them. Both behaviours are explicit, so builders will not diverge. The stated reason, however, licenses a future "fix" in either direction. **Fix:** state in IN §2.1 that consequence 4 exists because one summed filter is one population for both entries, and that a mixed summed/per-slot pair is accepted under §5.5's wider-population acceptance.

## F10 — low — The §2.7 intro describes the search wrongly for a summed line

The intro says "AD-16 filters each line by its band, so an item matches when its rolled values fall inside the bands". This is false for a summed line, which is one filter over the sum. §5.5's last sentence settles that §2.7 uses the per-slot band. **Fix:** add "(per slot; a summed line is judged by its per-slot band, §5.5)" to the intro.

## F11 — low — AGENT-WORKFLOW still says to write `ModifierWeight` to `6.0.0`

AGENT-WORKFLOW *Build `contracts` first* still says "follows weights contract `6.0.0` … Write it to `6.0.0` directly". IN §1's null-line rule depends on `6.1.0` semantics: `not-in-game`, and a complete-pool null line read as internal. WEIGHTS-FILE-SCHEMA says that a `6.0.0` reader refuses a `6.1.0` file. The code is already on `6.1.0`, so this is stale text, but revision 25 makes it load-bearing. **Fix:** change it to `6.1.0` in AGENT-WORKFLOW.

## F12 — low — The order of stat filters inside the `and` group is free

AD-16 now emits filters for prefix lines, suffix lines and summed ids into one `and` group, and IN §5.5 gives no order. The order does not matter to the trade site. It does matter to a recorded fixture (AD-13) if the MSW handler matches on the body: two `sync` builders, one in reference order and one in `statId` order, break each other's fixtures. **Fix (IN §5.5):** "filters are emitted in `statId` byte order, one per distinct `statId`". This reuses §4.1's ordering.

---

## Checked and found consistent

- **`contains_S` "covers read as true".** The literal reading (any line) and the intended reading (`statId` match, no band) give the same `coOccur` result. A single-line reference on a summed id never reaches `coOccur`, because the first branch fires. For a hybrid, `lineSet == statIds` already forces the `statId` to be present.
- **Canonical key.** A hybrid affix is two elements and a single-line affix is three. Element 1 of a hybrid is an array and element 1 of a single-line affix is a number or `null`. These forms cannot collide, and the byte-wise ordering stays total.
- **Sum arity.** "At most one line per `statId` per reference" (§4.1), together with "both affixes required" (AD-5), makes `sum(e,s)` exactly two banded operands once `contracts` has refused a valueless operand. The evaluation order between that refusal and the overlap predicate is unspecified. A `NaN` sum compares `false`, so the refusal still surfaces.
- **§11 `g(e)` for a hybrid tier.** Every weights entry already carries its own `modGroup`, so "the family's `modGroup`" is `e.modGroup`. `mixedGroup` (§2.7) guarantees that the set agrees.
- **A hybrid–single overlap through `coOccur`** also fires §2.7 `incomplete` on the single-line reference. Both reports are correct, and they do not conflict.
