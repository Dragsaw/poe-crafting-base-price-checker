# Reconciliation review — PRD revision 6

**Scope.** `PRD-EDIT-PROPOSALS.md` §32–§39 (Revision 6) against
`docs/prds/prd-poe-crafting-base-price-checker-2026-09-12/prd.md`.
Ten items: C-78 … C-86 plus the new requirement in §37. Sections above §32 were absorbed by
earlier runs and were not checked.

**Verdict counts: 10 LANDED / 0 PARTIAL / 0 MISSED.**

---

## 1. Item-by-item

### C-78 — FR-29's empty-containment-set error is only half the story — **LANDED**

*Location:* FR-29, prd.md line 648 (bullet immediately after the "report must name both possible
causes" bullet at 647).

The bullet states every element the proposal asked for: the error "fires only where the dropped Stat
Line's `statId` had a **single** publisher"; where "a **second Source Modifier publishes the same
`statId`** — which AD-29 expressly permits (§3 *Eligible Pool*)" the containment set is "**not**
empty, **nothing is reported at all**", the "**numerator** silently loses that modifier's share",
the probability "deflates on that Base Type alone, which **reorders** the ranked list rather than
shifting it uniformly", and the base "still reads `complete` and still counts as covered under
FR-4". It closes with "**The silent case is what `statLineCounts` exists for** (FR-27)". Governing
ADs cited (AD-18, AD-29). Nothing weaker or narrower than the proposal.

### C-79 — FR-27 must carry the exactness rules — **LANDED**

*Location:* FR-27, prd.md lines 598–603, under the lead-in "Exact equality means something specific,
and until it was written down three conforming `core` implementations returned three different
verdicts on one file… This is the copy the external producer reads (§7.3)".

All five bullets present and complete:

1. line 599 — parsed IEEE doubles, **file's own entry order**, no tolerance and no pre-rounding, plus
   the "comparing serialised decimals at a common scale is a **different** test that accepts files
   this one refuses" clause and the non-associativity reason for pinning the order.
2. line 600 — exactly **two** checkable rules (cohort conservation; per-`statId` group agreement);
   the **third** (a tier's split summing to the tier weight) is one `core` "**cannot** apply at all,
   because tier weights never enter the file", and that is "precisely **why** the two checkable ones
   are not softened".
3. line 601 — band edges exact for a **separate** reason (integer/half-integer lattice exact in
   binary; a near-miss edge is a **straddle**, not a rounding artefact), with the explicit "the two
   must not be conflated".
4. line 602 — **preferred** (values exact in binary, largest-remainder split onto an integer grid)
   vs **fallback** (residue-absorbing cell, in file entry order), with the unsoundness condition
   stated exactly: "unsound where a cell is constrained by both sums", plus the intermittent-failure
   frequencies.
5. line 603 — refusal reports "the observed sum, the expected total and the **signed difference**",
   with the `1e-13`-vs-dropped-cell reasoning and the §7.2 revisit hook.

### C-80 — FR-27 gains the optional `statLineCounts` field — **LANDED**

*Location:* FR-27 line 596 (the field's normative bullet) plus the hard-error row at line 590; the
`4.1.0` minor is also described as adding "one optional field (`statLineCounts`)" at line 574.

Line 596 carries every clause of the proposal: "a sibling of `cohortTotals` in placement and in
terms"; "A per-`(base, slot)` list of `{ sourceModifierId, statLineCount }`"; "**permitted
everywhere, checked wherever present, and omitted for any group the producer cannot vouch for**";
the count is "the number of **distinct Stat Lines the source row as scraped publishes** — taken
*before* the explosion into entries"; and, as the proposal specifically demanded FR-27 say,
"**Recomputing it from the entries just emitted makes the check vacuous**", with the
path-independence rationale. The hard error is stated in both places (596 and the 590 bullet): a
listed group whose distinct `statId` count disagrees, or a listed `sourceModifierId` matching no
entry — with "checked only for the groups the list names, since the field is optional".

### C-81 — FR-27 gains the one-Cohort hard error — **LANDED**

*Location:* FR-27 hard-error list, prd.md line 588.

"a `sourceModifierId` group whose entries carry more than one distinct `itemLevelMin` — a source row
is one tier and therefore one Cohort (§3 *Source Modifier*), so such a group is malformed. AD-29
always held the property; nothing enforced it, which left `mass(g)` with **two conforming readings**
— whole-group, or per-Cohort — and so two different denominators. **Nothing conforming is newly
refused** by checking it (AD-29)." Every clause of the proposal, including the "nothing conforming
is newly refused" reassurance. The adjacent bullet at 589 leans on the new rule correctly ("The
group being one Cohort by the rule above, this is a **single unqualified comparison**").

### C-82 — §3 Glossary `Source Modifier` gains both facts — **LANDED**

*Location:* §3 *Source Modifier*, prd.md line 93.

One-Cohort: "It also puts a group in **exactly one Cohort**… — and that property is now **checked
rather than assumed**: a group carrying more than one distinct `itemLevelMin` is a hard file error,
because leaving it unenforced left `mass(g)` with two conforming readings and so two different
denominators (FR-27)." Line count: "A group may also **declare how many Stat Lines it publishes**,
in the optional `statLineCounts` list, counted from the source row as scraped rather than from the
entries emitted — the only check on a dropped Stat Line where a second Source Modifier publishes the
same `statId` (FR-27, FR-29)." The pre-existing full-weight-explosion and one-tier-never-a-family
material is intact around it, as the proposal assumed.

### C-83 — §10 retires OQ-16 — **LANDED**

*Location:* §10, new subsection "Raised against the spine by revision 5 — resolved by spine rev 6",
item 16 at prd.md line 847; §10's opening paragraph at line 837.

Retired on the established pattern: direction recorded ("RESOLVED, in AD-18's direction, exactly as
this PRD argued"), the superseded `mass(g, L)` spelling quoted only as history, and — as the
proposal insisted — the substantive half recorded: "the respelling alone would not have closed it…
the correction was accompanied by **making that property a hard file error** (FR-27, §3 *Source
Modifier*); the spelling fix by itself would have removed the notation while leaving the ambiguity
it was meant to remove." Closes with "**The open count returns to one: OQ-12 only**, still owned
outside this repository", matching line 837's "**One item is open: OQ-12**… OQ-16 by spine revision
6."

### C-84 — §7.2 records the two new Deferred items — **LANDED**

*Location:* §7.2, prd.md lines 785 and 786.

- "**Making `statLineCounts` required**" — with the reason it is deferred (breaking against a
  producer already on `4.x`) and the proposal's specific instruction carried verbatim in force:
  "**To be folded into the next breaking revision rather than deferred again**".
- "**A relative epsilon on the two sum rules**" — names both rules, states they are exact with no
  tolerance, accepts the failure because it is "loud, immediate and fails **closed**", sets the
  revisit trigger ("if a conforming producer reports spurious refusals in practice") and ties it to
  the signed difference from C-79; adds correctly that it "would never extend to band edges, which
  stay exact for a separate reason".

### C-85 — contract version references move to `4.1.0` — **LANDED**

*Location:* §3 *Weights File* (line 95), FR-16 (375), FR-27 (572, 574, 575, 595), §10 BQ-2 (873),
§0 (20, 26), §7.3 (799).

Every statement about the **current** contract version reads `4.1.0`; see check 4 below for the
full occurrence audit. The "refusal rule unchanged" note the proposal asked for is present at line
574: "**The refusal rule is unchanged by the move to `4.1.0`, and that is what makes the move
non-breaking**: the check is on the **major**, so a conforming `4.0.0` file is a conforming `4.1.0`
file and the two interoperate."

### C-86 — §7.3 records that the producer gains schedulable work — **LANDED**

*Location:* §7.3, prd.md line 799.

"**The contract has since moved to `4.1.0`, and this one is work the producer can schedule rather
than a re-gate.** `4.1.0` is a **non-breaking minor**… and **the release dependency above is
therefore not re-gated**. What it offers is the optional `statLineCounts` declaration — **adopted
when the producer is ready**, and effectively mandatory for any producer handling multi-stat rows…
It also makes the one-Cohort-per-group property a checked error rather than an assumed one, which
refuses nothing that already conformed. The exactness rules FR-27 now states are not new obligations
either." All three of the proposal's points, plus a correct framing of C-79 and C-81 for the
producer's owner.

### §37 — the new requirement (a dropped source *row* has no mechanical check) — **LANDED**

*Location:* FR-28, prd.md line 614 — immediately after the "Completeness counts Stat Lines, not
rows" consequence, which is exactly where the proposal said to put it ("where the PRD states FR-28's
completeness rule").

Carries every element: "**A dropped source *row* has no mechanical check at all, and it is the
larger of the two gaps**"; `statLineCounts` guards within a row while "**nothing guards the set of
rows**"; `cohortTotals` "is only *required* where a family carries a `modelled-split` entry — and
most rows are single-stat and undecomposed"; the effect — "**shrinks the denominator and inflates
every probability on that Base Type**, which reorders the ranked list"; "**strictly worse than a
dropped Stat Line**"; "it has nothing behind it but the `poolCoverage` declaration itself"; and the
mitigation in the proposal's own terms — "**The mitigation is real and cheap: emitting
`cohortTotals` for every family is permitted and encouraged**, and narrows the gap considerably".
Adds a correct escape ("a producer that cannot vouch for it declares `partial` instead") consistent
with FR-28's existing no-third-option rule.

---

## 2. The five deliberate checks

### Check 1 — FR-29 states the asymmetry and names `statLineCounts` — **CLEAN**

prd.md line 648. Single-publisher case fires; two-publisher case is silent, the containment set is
non-empty, the numerator deflates, and the result **reorders**. `statLineCounts` is named as the
only thing standing behind the silent case, with the builder trap spelled out ("a builder who reads
the empty-containment-set error as the whole defence is reading a check that cannot fire"). FR-29's
preceding bullet (647) is consistent: it already qualifies FR-27's check as applying "only where the
group declares `statLineCount`" and explains why the group-consistency check cannot catch a fully
dropped line.

### Check 2 — no surviving text repeats the superseded benign reading — **CLEAN**

Searched the whole document for `reorder`, `silent`, `numerator`, `harmless`, `benign`, `cannot
reorder`. No claim anywhere that a dropped Stat Line cannot reorder the ranking or shrinks a
numerator harmlessly.

- line 375 ("a missed double-count **cannot reorder** anything") is FR-16's partial/absent-pool
  carve-out — a different subject, and correct: the base is already Unrankable.
- line 480 ("That is **harmless** where a reference's population is one tier") is FR-21 on
  cheap-end pricing within a homogeneous band — unrelated.
- line 881 ("The bound was **harmless**") is OQ-9's historical record.
- §0 line 26 states the correction affirmatively and names the earlier reading as wrong, which is
  what the proposal demanded ("corrected, not merely extended").

*One soft residue, not a violation (see Findings 1).* FR-28 line 614 contrasts the dropped row with
"a dropped Stat Line, **which shrinks one numerator**: it moves every row on the base." Read alone,
the contrast can be heard as *a dropped line moves nothing*. It makes no such claim, and FR-29 line
648 says the opposite explicitly — but the two are three sections apart and only FR-29 carries the
reorder fact for the line case.

### Check 3 — FR-27 carries all five exactness points of C-79 — **CLEAN**

All five present and none narrowed. See C-79 above for the clause-by-clause mapping (lines
598–603). The two sub-clauses most often dropped in a paraphrase are both present: the "serialised
decimals at a common scale is a *different* test" warning (599) and the fallback's precise
unsoundness condition, "unsound where a cell is constrained by both sums" (602).

### Check 4 — version references — **CLEAN**

Full occurrence audit (`4.0.0`, `4.1.0`, `3.0.0`):

| Line | Occurrence | Classification |
| --- | --- | --- |
| 20 | "Revision 5 … raised the Weights File contract to **4.0.0**, a breaking change" | historical — what rev 5 did |
| 20 | "reissuing the contract at **4.1.0**, a **non-breaking minor**" | current ✔ |
| 20 | "a conforming **4.0.0** file is a conforming **4.1.0** file" | comparative/interop, correct |
| 26 | "the optional **`statLineCounts`** declaration `4.1.0` adds" | current ✔ |
| 95 | §3 *Weights File*: "at contract version **4.1.0**" | current ✔ |
| 375 | FR-16: "contract **4.1.0** requires `sourceModifierId` on every entry" | current ✔ |
| 572 | FR-27: "A producer building to a 1.x, 2.x or 3.x shape emits a file that `core` refuses (schema **4.1.0**)" | current ✔ |
| 574 | FR-27: refusal rule unchanged; "a conforming **4.0.0** file is a conforming **4.1.0** file" | comparative/interop, correct |
| 575 | FR-27: "Hard file errors reject the file outright (schema **4.1.0**)" | current ✔ |
| 594 | FR-27: "through **3.0.0** it listed the row as a hard file error, and **4.0.0** removes it" | historical — what the 4.0.0 revision did |
| 595 | FR-27: "The unscoped non-overlap rule of schema 2.0.0 would refuse a conforming **4.1.0** file" | current ✔ |
| 798 | §7.3: "The contract moved **3.0.0** → **4.0.0**, so a **3.0.0** file in flight is refused at load… Satisfying **4.0.0** costs that project two things" | historical — the bullet is headed "A second **breaking** contract revision **has landed**" and is immediately superseded by line 799 |
| 799 | §7.3: "has since moved to **4.1.0**"; "**4.1.0** is a non-breaking minor"; "a conforming **4.0.0** file is a conforming **4.1.0** file" | current ✔ / interop |
| 852 | §10 OQ-14 record: "Contract **4.0.0** removes the row" | historical record of a retired question |
| 873 | §10 BQ-2: "Weights File schema 2.0.0 — **4.1.0** at the current revision" | current ✔ |

No statement about the current contract version says `4.0.0`. The weakest entry is line 798, whose
obligations ("`sourceModifierId` on every entry", "group consistency") are still live but are
attributed to the 4.0.0 revision that introduced them; the bullet's past-tense framing and the
4.1.0 bullet directly beneath it keep it historical rather than stale. Also confirmed: `mass(g, L)`
survives only inside OQ-16's retired record at line 847.

### Check 5 — §10 declares exactly one open item; OQ-16 is a retired record — **CLEAN**

- §10 preamble (837): "**One item is open: OQ-12**, and it is owned outside this repository. Every
  other question raised against the spine has been answered, OQ-16 by spine revision 6."
- Subsection "Open, and owned outside this repository" (839–843) contains **only** OQ-12, with its
  own lead-in "One question is live".
- OQ-16 appears only at 847, under the heading "Raised against the spine by revision 5 — resolved by
  spine rev 6", marked "**RESOLVED**" and closing with "The open count returns to one: OQ-12 only".
- The other live-item surfaces agree: §0 line 28 ("One question on that dependency is **open by
  design**… §10 OQ-12"), §7.3 line 797 ("Its second gate is an open question… **§10 OQ-12**"),
  FR-21 lines 478–479, §11 line 893. No second open item anywhere.

---

## 3. Collateral damage

No contradiction found between the rev-6 edits and the rest of the document. Cross-references
introduced by the round resolve correctly (FR-29 → FR-27 and §3 *Eligible Pool*; FR-28 → FR-27 and
`cohortTotals`; §3 *Source Modifier* → FR-27/FR-29; §7.3 → FR-27/FR-29; §7.2 → FR-27/§7.3;
OQ-16 → FR-27/§3), and the pre-existing arithmetic still holds:

- §0's "sixteen decisions amended in place across revisions 3–6" is correct against §10 OQ-15's
  lists plus rev 6's AD-18/AD-28/AD-29 (union = AD-5, 6, 9, 10, 11, 12, 16, 17, 18, 19, 21, 24, 26,
  27, 28, 29 = 16).
- §0's "29 remains the total" and "no citation went stale" are consistent with §10 OQ-15, which
  covers only revisions 3–5 and is correctly referenced as "the first three rounds' lists".
- Front matter `revision: 6`, `updated: 2026-09-13` — consistent with §0 and §10.
- FR-27's "at most two Cohorts" bound (591–593) still reads correctly beside the new one-Cohort rule
  (588): line 593 explicitly explains why the cohort-carriage count is *not* narrowed by
  `sourceModifierId` precisely because a group has one Cohort, which the new hard error now
  guarantees rather than assumes — strengthened, not contradicted.
- FR-33's eight-artifact fetch set, FR-17's cap tables, FR-4's coverage predicates and FR-10/FR-11's
  provenance treatments are untouched by rev 6 and unaffected by it.

Two minor items worth a PM's eye, neither rising to a defect:

1. **FR-28 line 614's contrast is the one place a reader could still pick up the old benign
   reading.** "strictly worse than a dropped Stat Line, **which shrinks one numerator**" is accurate
   but does not say that shrinking one numerator also reorders; FR-29 line 648 does, three sections
   away. Six words ("which shrinks one numerator and reorders on that base alone") would make the
   comparison safe to read in isolation.
2. **FR-27 line 574's characterisation of the minor is slightly narrower than the minor actually
   is** — "The minor adds one optional field (`statLineCounts`) and one check on a property the
   contract already asserted" omits the exactness rules written down at 598–603. §7.3 line 799
   covers this correctly ("The exactness rules FR-27 now states are not new obligations either"), so
   the two are reconcilable, but a producer reading FR-27 alone gets an under-count of what moved.

---

## 4. Conclusion

All nine proposals and the §37 requirement landed in full, in the sections the proposals named, in
terms at least as strong as asked. All five deliberate checks are CLEAN. No collateral damage; two
cosmetic sharpenings noted above.
