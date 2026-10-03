# Review: spine revision 25 (tracked hybrid mods), reconcile + rubric

- **Subject:** uncommitted diff of `ARCHITECTURE-SPINE.md` (rev 23 to 25), `IMPLEMENTATION-NOTES.md`, `AGENT-WORKFLOW.md`
- **Inputs:** `docs/specs/spec-tracked-hybrid-mods/SPEC.md`, `owner-change-briefs.md` §2 and §3 (with the *pending spec correction*: there is no `acceptedTier` check), PRD FR-34 (uncommitted)
- **Date:** 2026-10-03
- **Verdict:** Every brief item has landed, and no `acceptedTier` validation leaked in. Two predicate defects block a build (F1, F2). Fix them, plus the stale text and citations (F3 to F5), before stories cite §2.1, §2.2 and §2.7.

---

## Part 1: Reconciliation

### Brief §2 (spine)

| Brief bullet | Status | Where |
| --- | --- | --- |
| AD-5: discriminated `hybrid` arm, never inferred from an optional field | Landed | AD-5 Rule table row `hybrid`. Paragraph: "**The `hybrid` arm is its own discriminant, never inferred.** No component reads a reference as hybrid because an optional extra field is present…" |
| AD-5: both affixes required | Landed | AD-5 key table: "`(categoryId, className, itemLevelMin, prefix, suffix)`, **both affixes required**". Paragraph "**A crafted entry names both affixes, and no component handles an absent one.**" ERD prose: "carries both affixes" |
| AD-5: major bump, old file rejected with a message that names it | Landed | AD-5: "**This is a major version of the tracked schema:** … the message names the major bump". The message text is in IN §4.1: "**The tracked schema's major version names the change.**" |
| AD-5: retire "at most one reference per slot, absent allowed" | Landed | The `prefix?, suffix?` / "at least one affix present" row is replaced. A grep for "at most one reference", "at least one affix" and "absent affix" in the three files finds only the historical rev-16 blockquote (line 90), which is acceptable. |
| AD-16: summed `statId` is one filter, Σmin to Σmax | Landed | AD-16: "**A summed `statId` is sent as one filter: the sum of the two `min`s to the sum of the two `max`es.**" The stat-filters row is updated to "one per distinct `statId`" |
| AD-16: accepted effect (upper-bound population; probability uses per-slot containment) | Landed, **incomplete**: see F2 | AD-16: "**Accepted effect: a summed filter prices an upper-bound population.**" |
| AD-16: cite the §5 capture as evidence | Landed as *pending* | AD-16 cites "`IMPLEMENTATION-NOTES.md` §5.1d" and says the premise "rests on a manual observation until the capture … lands". No capture exists yet (see brief §3 row §5). |
| AD-17: line-set completeness (subset rejected) | Landed | AD-17 table row **Line-set completeness**, mechanics in IN §2.7 |
| AD-17: kind agreement per line | Landed | AD-17 table row **Kind agreement**: "**per line** … a `hybrid` reference is checked line by line" |
| AD-17: null-line rule + weights-absent treatment | Landed, the weights-absent half is **inconsistent**: see F3 | AD-17: "**The null-line rule classes every `statId: null` line, from the weights file alone**" and "**Where `weights.json` is absent, line-set completeness is skipped and the entry is marked unvalidated**" |
| AD-17: where each check runs (web load, sync gate, `tracked:check`) | Landed | AD-17: "**Six cross-file checks are defined once in `core`** … `web` at load, **`sync` as a run-start gate** … and **`pnpm tracked:check`**". AD-12: "**all six checks**". AGENT-WORKFLOW: "`pnpm tracked:check` is a third caller" |
| Deferred register: retire the conjunction item | Landed | The deferred bullet *"Pricing a deliberate conjunction of co-occurring stats"* is deleted |
| New OQ (local vs explicit stat ids), owner spine | Landed | OQ-27, "**Owner: this spine**", closes on IN §5.1d |
| Check the Retired AD map | N/A | No AD id is retired or retargeted. No change is needed. |

### Brief §3 (IMPLEMENTATION-NOTES)

| Row | Status | Where / note |
| --- | --- | --- |
| §1 containment set | Landed | New `covers`/`contains` predicates. The hybrid arm is `lineSet(entry) == statIds(ref) ∧ ∀ rl …`. Prose: "**The containment set of a hybrid reference** is the same-slot entries with `weight > 0`, a line set **equal** to…". "Reported by tier id" is done by `sourceModifierId` in §2.5 and §2.7. The new subsection *Line sets and the null-line rule* holds `untrackable`, `lineSet` and `statIds`. |
| §2.1 `slotOverlap` | Landed, **internally inconsistent**: see F1 | New `S`, `sum(e,s)`, the four-branch `slotOverlap` and `linesIntersect`. The old consequences 2–4 (absent-affix) are replaced. |
| §2.2 `coOccur` | Landed | Adds the `statIds(x) ∩ statIds(y) ≠ ∅` guard, the weight > 0 term, and "**`coOccur` is `false` when `x` and `y` share no line**". The `weight > 0` term duplicates `contains` and is harmless. |
| §2.3 kind agreement per line; valueless or missing bound on a sum; ≤ 2 operands | Landed | "**The check runs per line.**" Within-file list. "A sum has **at most two operands**". The within-file summed rejections do not define their own payload. §2.3 says the rule "names the payload" but gives none (low, F6). |
| §2.4 `lines(ref)` on the containment set; worked case {T1}; empty set fails | Landed | `lines(ref, s)`. Worked case: "the containment set is {T1}. A band on line *a* that spans T1–T2 … is **misaligned**". "**An empty containment set is not an alignment verdict**; it fails §2.5." |
| §4.1 canonical key | Landed | `["hybrid", [line, …]]` row. "**The absent form `null` is withdrawn**". Sorted byte-wise, excludes `acceptedTier`, collision argument given. |
| §5 trade-sum capture; local vs explicit | **Not landed (deferred honestly)** | §5.1d "capture pending" says what to record and links OQ-27. Acceptable because it needs a live capture, but CAP-6's prices on local ids stay unproven. |
| §8 `needs(ref)` | Landed | Hybrid arm of `tier(ref)`. Max when any line is banded, min when all are valueless. The "undefined if `tier(ref)` is empty" guard is present. `candidate` drops "PRESENT affixes". |
| §11 probability | Landed | "`C_p`/`C_s` … the containment sets of §1 for every kind of reference". `g(e)` is the family's `modGroup`. "**A tier counts once, by `sourceModifierId`.**" The absent `C = E` clause is removed. |
| §12 artifacts | Landed, with one deviation | §12.1: major bump of all three, files deleted, unknown keys dropped. **Deviation:** "A report record that carries an `entryKey` is not dropped this way". This contradicts the brief and the SPEC risk text ("Entries whose key is not in the current tracked key set are dropped"). The §12 identity rule justifies it, but a SPEC note should record it (low). |
| Error payloads, one for each CAP-4 failure | Landed | Misaligned line: §2.4. Set differs, subset or single-line reach: §2.7 `incomplete`. Empty set: §2.5 hybrid addendum. Multi-modGroup, blaming `weights.json`: §2.7 `mixedGroup`. Kind per line: §2.3. |
| CAP-1 schema rules | Landed | IN §4.1 "**Shape rules of a `hybrid` reference**" |

### SPEC CAPs, constraints, risks owned by spine or IN

- CAP-1, CAP-2 (one filter per line, under one `and` group: AD-16 row), CAP-3, CAP-4, CAP-6, CAP-8: all landed as above.
- Constraint "own discriminated kind": landed. "`acceptedTier` applies to the hybrid as a whole": AD-5 "**On a `hybrid` reference the label belongs to the reference as a whole**", and IN §4.1. "coOccur / overlap per line": landed, but see F1. "Canonical key": landed. "Weights contract unchanged": confirmed, `WEIGHTS-FILE-SCHEMA.md` is untouched.
- Risk "accepted effect": landed but incomplete (F2). Risk "breaking changes / major bump": landed. Risk "artifacts": landed (§12.1).
- **`acceptedTier` leak check: clean.** No check, payload or `tracked:check` rule validates `acceptedTier`. AD-5 keeps "no component validates it against a band; **no component validates its spelling**". SPEC CAP-4 still lists the dropped failure, and the spine's new `sources:` entry points at that SPEC unamended. Amend the SPEC so that a later reader of the source does not re-add the check (low).

---

## Part 2: Rubric findings

### F1: High. §2.1 and §2.2 treat a summed line inside a hybrid per slot, which contradicts consequence 4 and AD-17

§2.1 says "**A summed `statId` is compared once, as a sum, and never per slot.**" It also says "`coOccur` reads the **whole** references, not the lines left after removing `S`". Those two sentences collide whenever a slot holds a hybrid that carries a summed line.

Counter-example (one slot hybrid on both entries, summed `acc`):
- a: prefix `{phys [p], acc [10,15]}`, suffix `{lr [l], acc [5,8]}`. Sum `[15,23]`.
- b: prefix `{phys [p], acc [16,20]}`, suffix `{lr [l], acc [5,8]}`. Sum `[21,28]`.

`S = {acc}`. In the prefix slot both references are hybrid and share `phys` outside `S`, so the slot result is `linesIntersect ∧ coOccur`. `coOccur` needs one tier that both references contain. `contains` requires every line to be covered, `acc` included, and `[10,15]` and `[16,20]` are disjoint, so `coOccur = false`. The slot result is false and `overlap(a,b) = false`.

The pure+pure analogue (prefix rarity `[10,15]` / `[16,20]`, suffix rarity, sums intersecting) returns `true`, because both slots take branch 1. So consequence 4 holds for pure operands and fails for hybrid operands, although AD-16's one summed filter blurs both cases in the same way. The spine AD-17 sentence "a summed `statId` compares the summed intervals, the one cross-slot comparison on one `statId`" is violated the same way.

**Fix:** make `coOccur` inside `slotOverlap` read the references with their `S` lines removed. Concretely, `contains` over `statIds(ref) ∖ S`, with the line-set equality still on the full set. Delete the "reads the whole references" sentence. If the asymmetry is deliberate, the alternative is to state it in consequence 4 and in AD-17. Either way, add a fixture for the hybrid case beside CAP-6's pure+pure one.

### F2: High. §2.7 and the AD-16 accepted effect assume every line is a per-slot filter, but a summed line is not

AD-16 replaces both operands of a summed `statId` with one filter on the item total. The filter therefore does not require the other slot's mod to exist at all. It only requires the total to reach Σmin. Two consequences follow, and neither is stated:

1. **An item carrying only one of the two mods can match.** Example: entry `(rarity prefix [15,26], rarity suffix [6,10])` sends one filter `[21,36]`. A prefix-rarity-26 item with an unrelated suffix matches. The AD-16 *Accepted effect* names only "a low prefix with a high suffix from different tiers". It does not name items that lack the second operand. Those items fall outside AD-17's outcome set, which requires both. This happens whenever an operand band's width ≥ the other operand's `valueMin`.
2. **§2.7's `reached()` uses `meets(rl, line)` per slot for every line, the summed lines included.** For a hybrid suffix `{lr, acc}` with `acc` summed, the only per-slot filter the search actually applies is `lr`. A pure light-radius suffix tier can therefore be matched (prefix `acc` alone reaching Σmin), yet §2.7 never reaches it, because it lacks an `acc` line. The guarantee §2.7 states for itself ("*does the search for this reference match a tier that the reference does not name in full?*") is false for summed lines.

**Fix:** pick one. (a) Add a within-file rule to §2.3: for a summed `statId`, each operand's `valueMax` < the other operand's `valueMin` + its own `valueMin`, that is, `max_p < min_p + min_s` and `max_s < min_p + min_s`. One mod alone then cannot reach Σmin, and §2.7's per-slot model becomes sound again. (b) Extend the AD-16 accepted effect to name single-operand items, and make §2.7 treat a summed line as unconstrained per slot. Option (a) is enforceable and cheap. Option (b) widens the documented divergence. The CAP-6 fixture should pin whichever is chosen.

### F3: Medium. Spine AD-17 claims a per-entry `unvalidated` mark that AD-12 never defined for "the other five checks"

AD-17 says: "line-set completeness is skipped and the entry is marked unvalidated, **like the other five checks (AD-12)**. `core` returns the entry as unvalidated with the reason `weights-absent` … `sync` carries it in the existing `weights-absent` record."

- AD-12 (spine ~993) says only that `sync` "skips that gate, records the absence". It defines no per-entry mark for any check.
- IN §12's `weights-absent` record is class-level (`uncheckableClassNames`) and has no entry subject.
- AGENT-WORKFLOW line 66 says the checks are listed "under `pending`", not "unvalidated" or `weights-absent`.

The rule therefore names a pre-existing mechanism that does not exist, and it introduces a third word for it. A `core` author cannot tell whether only completeness returns `unvalidated` or all six checks do.

**Fix:** state once, in AD-17, that with `weights.json` absent all six checks are skipped and `core` returns every crafted entry as `unvalidated` (reason `weights-absent`), or drop the "like the other five" claim. Give the `core` return shape in IN §2. Use one vocabulary across AD-17, IN §12 and AGENT-WORKFLOW (`pending` vs `unvalidated`).

### F4: Medium. Stale "only one" claims about class discriminability

§2.7 frames completeness as a question about the **search**. AD-17 now says completeness "shares that property in part" (prices wrongly, not pointlessly). Three sentences still claim exclusivity:

- Spine AD-17 table, Class discriminability row: "the only one whose subject is the search rather than the valuation".
- IN §2.6 opening: "The fifth cross-file check, and the only one whose subject is the **search** rather than the valuation".
- AGENT-WORKFLOW line 98: "it is the only one whose failure would otherwise produce a plausible-looking wrong number rather than a missing one". AD-17's own new sentence contradicts it.

**Fix:** reword all three to "one of two" or similar, and name §2.7. The AGENT-WORKFLOW sentence is the one a `core` builder reads.

### F5: Medium. Stale PRD citations (report only, not fixed)

- `prd.md` FR-16, line 319: "A curator cannot track two Stat Lines of one game modifier as two entries in one slot … (AD-17; `IMPLEMENTATION-NOTES.md` **§2.2**)". The two-entry spelling is now rejected by §2.7 (consequence 3), and §2.2 explicitly says `coOccur` is `false` for that pair. Retarget to §2.7.
- `prd.md` line 492 (FR on probability): "A Combination's probability follows one crafting act on the Item Class, **and an absent affix is certain** (AD-17; `IMPLEMENTATION-NOTES.md` §11)". §11 dropped `C = E` for an absent affix, and AD-5 abolished absent affixes. This consequence now contradicts FR-34 and must go.
- `prd.md` FR-16, line 322: "The check runs in the view at load and in `sync` as a run-start gate". This omits `pnpm tracked:check`, the third caller AD-17 now names. Minor.
- `prd.md` FR-34, line 356: "A malformed Hybrid Modifier reference is refused at load … (AD-17; CAP-4)". Shape errors (fewer than two lines, a repeated `statId`, `min > max`) are AD-5 / IN §4.1 (CAP-1). The CAP-4 failures are cross-file. Cite AD-5 as well.
- `prd.md` line 489 cites `IMPLEMENTATION-NOTES.md` §2.4, §2.5 for "a Tracked Entry a Weights File cannot support is reported at load". §2.7 now belongs there too. Minor.

### F6: Low. Minor consistency and enforceability items

1. **The hybrid-vs-single `coOccur` branch cannot fire on a file that passes §2.7.** §1 says "on a file that loads, a single-line reference contains pure tiers only". `contains` implies `meets`, so any `coOccur(hybrid, single) = true` is already a §2.7 `incomplete` failure. Consequence 2's first sentence is therefore defence in depth. Say so, and state which payload wins when both fire, so tests do not expect the overlap payload.
2. **§2.7 evaluates under the scope (`itemLevelMin ≤ L`), but the search is `ilvl >= L`.** Higher-level hybrid tiers outside the scope can still be matched by a single-line band. This is consistent with the spine's existing *[ASSUMPTION]* on the superset. Note it in §2.7, or run `reached()` unscoped, since §2.7's subject is the search.
3. **§8 `tier(ref)` is inconsistent across kinds.** The new hybrid arm goes through `contains` (so it excludes weight-0 and untrackable tiers). The banded and valueless arms still read "every entry … carrying that `statId`", with no weight or untrackable exclusion, so a weight-0 tier can raise a banded floor and cannot raise a hybrid one. Align the arms.
4. **IN §12's `cross-file-gate-failure.check` subject** gets no new value for line-set completeness. Name it so the record identity is complete.
5. **IN §4.1 shape rules require "non-negative" on hybrid banded lines only.** If single-line `banded` refs are not also non-negative, say why. Otherwise state the rule once for every banded line.
6. **§2.3's within-file summed rejections** say "this rule names the payload" but define none. Add a payload (entry key, `statId`, the offending slot).
7. **Restatement:** AD-16 spells out the sum formula `[min_p + min_s, max_p + max_s]` that IN §2.1 `sum(e,s)` owns. AD-5's table repeats §4.1's "no `statId` repeated, sorted by `statId`". Both are short and low-risk, but under the one-owner rule cite §2.1 and §4.1 instead.
8. **§1 now makes `untrackable` a condition of `contains` for single-line references too.** A pure reference in a `partial` pool whose matching tier carries an unresolved null line loses that tier and may now fail §2.5 where it passed before. No ranking moves, because the class is already unrankable, but the `sync` gate can newly abort. State this in AD-17's null-line paragraph.

### Counts and citations

- "Six cross-file checks", "all six", "a reference for five of them", "like the other five": correct (alignment, empty set, `coOccur`, kind, discriminability, completeness).
- "The other four" (AD-17, discriminability paragraph) is arithmetically right (six minus discriminability minus completeness) but awkward after "shares that property in part".
- IN §1 "Five rules ride with it": five bullets, correct. IN §2.1 "Four consequences": four, correct.
- Withdrawn `coOccur` branch for unequal `statId`s: no residue. The spine row and IN §2.1 / §2.2 all say it is withdrawn.
- Absent-affix residue in the three files: none outside the historical blockquote at spine line 90. The residue is in the PRD (F5).
- Citations resolve: AD-5 → IN §1, §2.7, §4.1. AD-16 → IN §2.3, §5.1d, OQ-27. OQ-27 → §5.1d. AD-17 table → §2.2 to §2.7. FR-34 exists in the PRD. IN §11 → §2.7. IN §2.7 → §2.1 consequence 3. All resolve.
