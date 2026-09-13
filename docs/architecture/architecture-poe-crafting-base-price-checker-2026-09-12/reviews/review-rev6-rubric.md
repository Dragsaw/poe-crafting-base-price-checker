# Review — ARCHITECTURE-SPINE.md revision 6 — RUBRIC WALKER lens

- **Target:** `docs/architecture/architecture-poe-crafting-base-price-checker-2026-09-12/ARCHITECTURE-SPINE.md` (revision 6, AD-1…AD-29, status `final`)
- **Companions read:** `WEIGHTS-FILE-SCHEMA.md` (4.0.0), `AGENT-WORKFLOW.md`, `.memlog.md` (last five entries)
- **Lens:** rubric walk of the good-spine checklist, weighted onto revision 6's changes (AD-18, AD-28, AD-29, two new Deferred items, the revision-6 banner, and the companion edits).
- **Verdict:** **REVISE.** One critical finding invalidates the stated risk bound on which the Candidate-2 ruling rests. One high finding leaves a producer obligation that cannot be discharged without an unstated `core` rule. The rest of revision 6 is sound and the banner is accurate.

## Severity counts

| Severity | Count |
| --- | --- |
| Critical | 1 |
| High | 1 |
| Medium | 3 |
| Low | 2 |

---

## C-1 — Critical: a dropped stat line **can** reorder the ranking whenever another source modifier publishes the same `statId`

**Where:** spine:369 (AD-18's two-causes paragraph), spine:777 (Deferred, *A declared stat-line count per source modifier*), spine:27 (revision-6 banner), `WEIGHTS-FILE-SCHEMA.md`:378.

**The claim under test.** All four texts assert the same bound, most sharply in the Deferred item:

> It cannot reorder anything — AD-18's denominator sums `mass(g)` over source modifiers, so the group keeps its mass and no probability on the base inflates, unlike a dropped *row* — and it surfaces loudly as an empty containment set.

**The denominator half of the claim is correct.** Verified against AD-18's ratio (spine:355–363) and AD-29's group rules (spine:577–585): `mass(g)` is "the common value of `Σ { e.weight : e ∈ g, e.statId == s }` taken over each `statId s` the group publishes". Deleting every entry of one `statId` from a multi-line group leaves the remaining per-`statId` sums equal to the same `w`, so `mass(g)` is unchanged; `sources(scoped(...))` still contains `g`, because at least one line survives; the denominator is therefore bit-identical. No probability on the base inflates. That part holds, and AD-29's group-consistency check genuinely cannot see the drop, as stated.

**The claim ignores the numerator, and the numerator is where the harm is.** AD-18's numerator sums over *entries*: `Σ { band.weight : band ∈ scoped ∧ band ⊆ ref }`. AD-29:589 explicitly permits one `statId` to be published by more than one source modifier — "two modifiers may legitimately publish the same stat over the same cell" — and says the numerator sums both while the denominator counts each modifier once. So take `statId s` published by groups `g1` and `g2`, and let the producer drop `g1`'s `s` line:

1. The reference on `s` is **not** untrackable and produces **no** empty containment set: `g2`'s cells still carry `s`, so containment is non-empty and edge-alignment still passes wherever `g2` spans the same partition cells (which AD-28's family-wide partition makes the normal case, since the partition is cut per `(base, slot, statId)` across every modifier publishing it).
2. The numerator loses `mass(g1)` while the denominator keeps it. `P(ref | base, slot, L)` is **understated**, on this base only, by a factor that varies per base with how much of that stat's mass sat on the dropped line.
3. That is the exact failure shape AD-18 itself names three times as disqualifying — "wrong by a factor that varies per base — which *reorders the ranked list* rather than shifting it uniformly" (spine:371). Deflation reorders as surely as inflation; the Deferred item's wording only rules out inflation.

**A second, worse consequence on the same input.** If `g1` published `s` together with `t`, dropping `s`'s line destroys the co-occurrence marker AD-29:587 calls "not optional". Two tracked entries in one slot naming `s` and `t` then pass AD-17's `slotOverlap` and are multiplied as independent draws, when a single `g1` item satisfies both — AD-29's own text says the consequence is that "that base's `ΣP` exceeds 1 and it takes the top of the ranking". Again silent, because `s` still exists via `g2`.

**Why this matters beyond the text.** The Candidate-2 ruling (memlog, revision-6 entry) was decided on the premise that the defect "cannot reorder the ranking" and is therefore bought for diagnosis rather than correctness. Under this counterexample it is a correctness defect with no mechanical check and no loud symptom, and the rejected fix — a declared stat-line count per group — is the thing that would catch it. The ruling may still come out the same way (breaking an external producer at 4.0.0 is a real cost), but it has to be made against the true risk, and the Deferred item's revisit condition is currently unfirable for the dangerous branch: "revisit if a curator meets the ambiguous empty-containment error in practice" can only ever observe the benign single-publisher case, because the multi-publisher case raises no error at all.

**What would close it.** Amend the four texts to state the bound with its actual condition:

- The harm is bounded to "that stat becomes untrackable and reports loudly" **only when the dropped line's `statId` is published by no other source modifier on that `(base, slot)`**.
- Where another modifier publishes it, the drop is **silent** and **understates** that reference's probability and can destroy an `coOccur` pairing — i.e. it reorders.
- Re-state the Deferred item's revisit condition so it can observe the silent branch (for example: revisit when any `(base, slot, statId)` is published by more than one `sourceModifierId`, which the file itself exposes and which `core` or a producer-side lint can count today), and re-state the banner's "can reorder nothing".

---

## H-1 — High: the "producer obligation" on the sum rules is not dischargeable, because `core`'s summation order is nowhere pinned

**Where:** spine:555 (AD-28's new exactness paragraph), spine:778 (Deferred, *A numeric tolerance…*), `WEIGHTS-FILE-SCHEMA.md`:394–401.

The contract names two routes to discharge the obligation. Route 1 (emit values exact in binary) is order-independent and sound. Route 2 is:

> **Verify against the consumer's arithmetic** — sum in double precision in the file's own entry order, and let the last cell of each cohort and each stat line absorb the residue before emitting.

This presumes `core` sums in the file's own entry order. **Nothing in the spine or the contract requires it.** AD-28 says only "`core` sums the parsed numbers and tests equality"; AD-29's group check says the weights "grouped by `statId` must sum to the same value", which a builder will naturally implement by grouping (and therefore re-ordering) before summing. Float addition is not associative — the contract says so itself at line 394 — so two `core` builders, one folding in file order and one folding per `statId` bucket or over a sorted array, will disagree about whether the same conforming file loads. That is precisely the divergence AD-18's and AD-28's **Prevents** clauses exist to remove, and it is a divergence *inside* `core`, not between core and a producer.

It also makes the epsilon Deferred item's revisit condition close to unreachable as written: a producer that took route 1 never sees a refusal, and a producer that took route 2 can only see one because of this unpinned order — so "a conforming producer reports spurious refusals in practice" is either a null set or a report of exactly this defect under a different name.

**What would close it.** One sentence in AD-28 and the matching line in the contract: `core` sums each cohort and each `statId` group **in file entry order**, left to right, in double precision, with no intermediate rounding and no re-ordering — and `core` builders may not substitute a grouped, sorted or parallel reduction. That makes route 2 well defined and makes two `core` units agree on which files load.

---

## M-1 — Medium: the contract says **three** exact rules, the spine, Deferred item and AGENT-WORKFLOW all say **two**, and one of the three is not checkable by `core` at all

**Where:** `WEIGHTS-FILE-SCHEMA.md`:392 vs spine:555, spine:778, `AGENT-WORKFLOW.md`:92.

The contract's new section opens: "Three rules in this contract are exact comparisons, and `core` applies them with **no tolerance**: a cohort's emitted cells must sum to its declared `cohortTotals` weight, a group's per-`statId` weights must sum to the same value, and **a tier's split across the cells it reaches must sum to that tier's weight**." The spine's AD-28 paragraph names two ("here and in AD-29's group-consistency check"), the Deferred item is titled "the **two** weights-file sum rules" and scopes its future epsilon to "the two sums only", and AGENT-WORKFLOW:92 names two.

The third rule is also not one `core` *can* apply: `w(t)` — a single tier's weight — is not carried in the file. The file carries per-cohort `cohortTotals` (spine:553, schema:162), which is a sum over the cohort's tiers precisely because the per-tier figure is not published. So "`core` applies them" is wrong for the third, and a builder reading the contract alone will hunt for a check it cannot implement.

**What would close it.** In the contract, say two rules are checked by `core` and that per-tier conservation is an unverifiable producer invariant (the same treatment AD-28:563 already gives its other two unverifiable obligations). Then the "two sums" spelling in the spine, the Deferred item and AGENT-WORKFLOW is consistent with it, and the future epsilon's scope is unambiguous.

---

## M-2 — Medium: the epsilon revisit condition is not observable, because the refusal error is not required to report the delta

**Where:** spine:778, `WEIGHTS-FILE-SCHEMA.md`:401.

"**Revisit if** a conforming producer reports spurious refusals in practice." For that report to exist, a producer must be able to tell a float artefact (a miss of ~1e-13 relative) from a genuinely dropped or misattributed cell (a miss the size of a whole cell). The contract promises only that "`core` names the cohort or group whose sum missed" — not the two values, not the difference. Without the magnitude, every refusal looks the same to the producer, and the only honest report it can make is "your check refused my file", which does not discriminate the case the revisit condition is waiting for. The same gap makes the failure less "loud and immediate" than line 401 claims, since loudness here is about diagnosability, not about failing closed.

**What would close it.** Require the conservation and group-consistency errors to report the declared total, the computed sum, and their difference — one clause in AD-28 and in the contract's Validation list. It costs nothing, it is what makes the accepted residual risk observable, and it is the same "name both sides" pattern AD-18's empty-containment error already follows.

---

## M-3 — Medium: a dropped **row** has the harm the dropped-line texts attribute to it, but no detection and no Deferred entry

**Where:** spine:369, spine:777, `WEIGHTS-FILE-SCHEMA.md`:378 ("unlike a dropped *row*, a dropped *line* shrinks no denominator").

The contrast is drawn four times and is correct about *harm* — a dropped row does shrink the denominator and inflates every probability on the base. It reads, though, as if the dropped-row case were the handled one, and it is not. Walking the validation list (schema:360–382): completeness is a producer **declaration** (`poolCoverage`), not a count `core` performs; `cohortTotals` is only required for a family carrying a `modelled-split` entry (schema:368), so a plain single-number, single-stat row that is dropped entirely is caught by nothing. Per AD-29's own measurement, ~7,900 of 8,437 rows are single-stat, so "drop a row" is both the larger population and the more harmful defect — and it is the one with no named limitation, no Deferred entry and no revisit condition, while its milder sibling has all three.

Note also that the rejected fix (a declared stat-line count *per group*) would not catch a dropped row either: a group that is absent entirely declares nothing to contradict. If the count is ever bought, the thing that catches a dropped row is a per-`(base, slot)` declared source-modifier count or total mass, which is a different field.

**What would close it.** Either state plainly that a dropped row falls inside the trust envelope AD-28:563 already names ("what remains is trust in the producer"), and cross-reference it from the dropped-line texts so the contrast is about harm rather than detection; or file it alongside the line-count item with its own revisit condition.

---

## L-1 — Low: "pool completeness counts stat lines" overstates what anything counts

**Where:** spine:369, spine:777, `WEIGHTS-FILE-SCHEMA.md`:376.

`poolCoverage: "complete"` is a producer declaration; nothing counts anything. The intended meaning — that the *unit* of a complete pool is the stat line, so there is no declared total to compare a count against — is recoverable but takes a second reading, and the phrase sits at the centre of the argument for why the drop is undetectable. Rephrase as "completeness is declared over stat lines and against no declared total".

## L-2 — Low: no summation-order or tie-break rule for the ranking itself

**Where:** AD-18's ratio (spine:355), AD-17's ordering, Consistency Conventions *Numeric precision* (spine:606).

The 4-decimal rule binds persisted `PriceObservation` and `CurrencyRate` values, and AD-16 rounds once in `sync`. `P` and `EV` are neither rounded nor pinned to a summation order, so two `core` builders can differ in the last bit of a denominator and produce different orderings for near-tied bases — a small instance of the divergence AD-18's **Prevents** clause names. H-1's canonical summation order plus an explicit tie-break on the ranking key (the `TrackedEntry` canonical key is already defined and ordered, spine:602) closes it cheaply. Out of revision 6's scope; recorded because the fix rides along with H-1.

---

## Checklist items that pass

**Rule enforceability (revision 6's three amended ADs).**

- **AD-29's `mass(g)` respelling is complete and correct.** No `mass(g, L)` survives anywhere in the spine (only in the older review files, which are historical). AD-29:583 and AD-18:363 now state the same definition in the same words, both assert "carries no `L`", and both give the same reason — a source row is one tier, hence one cohort, hence admitted whole or not at all. The stale word "scoped" went with the `L`, which was the point of PRD OQ-16. `PRD-EDIT-PROPOSALS.md`:594 carries the correction explicitly so a later run cannot reintroduce it.
- **AD-28's exactness paragraph does prevent its stated divergence** — a `core` builder softening the check — subject to H-1. The argument is sound on its own terms: the faults are cell-sized, so an epsilon buys nothing against them and admits an unconserved file. The separation from band edges is argued correctly and in the right place: a half-integer lattice is exactly representable in IEEE binary, a near-miss edge is a straddle rather than an artefact, and relaxing edges would readmit exactly the defect the partition removes (AD-28:567). The two exactness rules are explicitly *not* a joint candidate for softening, which is the trap a builder would otherwise fall into.
- **AD-18's two-causes error is honest and enforceable** as far as it goes: it names the reference, its floor and the missing `statId`, and blames neither document. C-1 is that its case analysis is incomplete, not that the rule is unenforceable.

**Banner accuracy.** The revision-6 banner (spine:25–31) claims "AD-18, AD-28 and AD-29 are amended in place, and no AD is added". Checked against the memlog's revision-6 entries and by reading the ADs: the amended text is exactly at spine:369 (AD-18), spine:555 and spine:567 (AD-28), spine:583 (AD-29), plus the two Deferred items at spine:777–778 — which the banner names separately and correctly as "outside the AD set". The C-53 correction it reports is confirmed in `PRD-EDIT-PROPOSALS.md`. No amended text was found in any AD the banner does not name, and no Consistency Conventions row shows revision-6 content. **The under-reporting failure mode that hit revisions 3 and 4 has not recurred.** (Caveat: the repository has a single commit predating revision 5, so this is a read-based check, not a diff.)

**Internal consistency on what is exact.** Spine AD-28:555/567, the Deferred epsilon item, `WEIGHTS-FILE-SCHEMA.md`'s *Sums must be exact as serialised* and the *Validation* edge clause, and `AGENT-WORKFLOW.md`:92 all tell one story: sums are exact with no epsilon and the residue is a producer obligation; edges are exact for a different, structural reason and are never a candidate for an epsilon; the future fix, if bought, is a relative epsilon on sums only. The only divergences are the count in M-1 and the unpinned order in H-1.

**Internal consistency on what a dropped stat line does.** All four texts say the same thing in the same terms — which is their strength and, under C-1, their weakness: the incomplete case analysis is uniform across spine, contract and workflow, so fixing one without the others would break a consistency that currently holds.

**The contract stayed at 4.0.0 legitimately.** Every revision-6 companion edit is clarifying: no new field, no new required value, no check added or removed. The clarification banner under the 4.0.0 heading is the right instrument, and the two rejected fixes (a declared line count, a tolerance) are both correctly identified as breaking or behaviour-changing and are both filed rather than dropped.

**Deferred items other than the two new ones** were re-walked for divergence risk and none let two units disagree: each either widens expressiveness (`itemLevelMin` as a ranking key, conjunction pricing), improves an estimator without touching the contract (measured split), or is an operational choice (hosted syncer, authenticated sync).

---

## Recommended order of work

1. **C-1** — restate the dropped-line bound with its real condition in all four places, and give the Deferred item a revisit condition that can observe the silent branch. Re-examine the Candidate-2 ruling against the corrected risk; it may survive, but not on the current argument.
2. **H-1** — pin `core`'s summation order in AD-28 and the contract, so route 2 of the producer obligation is well defined and two `core` builders cannot disagree about which files load.
3. **M-1, M-2** — two/three rule count, and require the sum errors to report the delta.
4. **M-3, L-1, L-2** — wording and scope tidy-ups; L-2 rides along with H-1.
