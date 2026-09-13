# PRD revision 6 — citation audit

**Scope:** the material the revision-6 run changed — §0, §3 (`Source Modifier`, `Weights File`), FR-16's contract clause, FR-27 (statLineCounts, exactness, hard-error list, non-breaking note), FR-28's dropped-source-row consequence, FR-29's asymmetry and report-both-causes bullets, §7.2's two new Deferred items, §7.3's 4.1.0 bullet, §10's preamble and OQ-16.

**Authorities read in full for this audit**, not inferred from the PRD's use of them:
- `ARCHITECTURE-SPINE.md` (revision 6, AD-1 … AD-29) — read end to end, plus targeted greps for `mass(g`, `cohortTotals`, `source row`, `dropped`, and every revision banner's AD list.
- `WEIGHTS-FILE-SCHEMA.md` (contract 4.1.0) — read end to end.

**Result: 60 citation instances checked — 58 CORRECT, 0 WRONG, 1 MISATTRIBUTED, 1 UNLABELLED EXTENSION.**

---

## 1. The four directed verifications

### 1.1 The spine really is at revision 6, really amended AD-18/AD-28/AD-29, and added no decision — CORRECT

Frontmatter: `status: final`, `revision: 6`, `updated: '2026-09-13'`. Revision-6 banner closes with:

> "AD ids are stable; **AD-18, AD-28 and AD-29 are amended in place, and no AD is added.**" (spine L33)

AD-29 is the highest-numbered decision in the document, so "29 remains the total" holds. The banner's body independently corroborates each of the three: AD-29 "stops spelling the source-modifier mass function `mass(g, L)`" and "gains an optional `statLineCounts` declaration"; "**AD-18** now names **both** causes of an empty containment set instead of blaming the tracked list"; "**AD-28** now pins the file's own entry order and the comparison is stated as one over **parsed doubles**" (spine L25–29).

### 1.2 "Sixteen decisions amended in place across revisions 3 through 6" — CORRECT

Computed from the spine's own revision notes, not from the PRD:

| Revision | Spine's own amended-in-place list | Count |
| --- | --- | --- |
| 3 (L43) | AD-9, AD-11, AD-12, AD-18, AD-19, AD-21, AD-24, AD-26, AD-27 | 9 |
| 4 (L41) | AD-5, AD-10, AD-11, AD-16, AD-17, AD-18, AD-27 | 7 |
| 5 (L39) | AD-5, AD-6, AD-9, AD-11, AD-16, AD-17, AD-18, AD-26, AD-28 | 9 |
| 6 (L33) | AD-18, AD-28, AD-29 | 3 |

Verbatim, from `sed`/`grep` over the banners:

> "AD ids are stable; AD-9, AD-11, AD-12, AD-18, AD-19, AD-21, AD-24, AD-26 and AD-27 are amended in place and no AD is added."
> "AD ids are stable; AD-5, AD-10, AD-11, AD-16, AD-17, AD-18 and AD-27 are amended in place and AD-28 is added."
> "AD ids are stable; **AD-5, AD-6, AD-9, AD-11, AD-16, AD-17, AD-18, AD-26 and AD-28 are amended in place, and AD-29 is added.**"
> "AD ids are stable; **AD-18, AD-28 and AD-29 are amended in place, and no AD is added.**"

Union, sorted: **AD-5, AD-6, AD-9, AD-10, AD-11, AD-12, AD-16, AD-17, AD-18, AD-19, AD-21, AD-24, AD-26, AD-27, AD-28, AD-29**.

Arithmetic: 5(1), 6(2), 9(3), 10(4), 11(5), 12(6), 16(7), 17(8), 18(9), 19(10), 21(11), 24(12), 26(13), 27(14), 28(15), 29(16) — **16**.

Two robustness notes. AD-29 is *added* in rev 5 and *amended* in rev 6, so it belongs in an "amended in place" union on the strength of rev 6 alone. And the count is insensitive to the one place the spine's rev-4 banner is awkward (its prose names AD-27's amendment, the list names it too, and the parenthetical correction confirms it) — AD-27 is already contributed by rev 3, so the union is 16 either way.

§10 OQ-15's three per-revision lists (not itself in scope) were checked against the same banners and match exactly.

### 1.3 AD-29 no longer writes `mass(g, L)` — CORRECT

`grep -n "mass(g"` over the spine returns five hits. The string `mass(g, L)` occurs **once in the whole document**, in the revision-6 banner, describing its own removal:

> "**AD-29** stops spelling the source-modifier mass function `mass(g, L)`: AD-18 governs, writes `mass(g)`, and states that it carries no `L`" (spine L25)

AD-29's body now reads:

> "`mass(g)` is the weight of that one source row — the common value of `Σ { e.weight : e ∈ g, e.statId == s }` taken over each `statId s` the group publishes. **It carries no `L`.** A group is one tier and therefore one cohort, so the scope admits it whole or not at all… AD-18 states the ratio; this is the same function, spelled the same way." (spine L587)

AD-18 (L365) carries the governing form: "**`mass(g)` carries no `L`.**" OQ-16's retirement claim is exact, including its secondary claim that the respelling alone would not have closed it — AD-29 L589 states the enforcement half: "**That one-cohort property is enforced, not merely asserted.** A group whose entries carry more than one distinct `itemLevelMin` is a hard file error. Left unchecked it was an aspiration, and `mass(g)` then had two conforming readings — over the whole group, or per cohort — which give different denominators and so a different ranking."

### 1.4 The one-Cohort hard error, `statLineCounts`, and the exactness rules — CORRECT as the PRD renders them

**One-Cohort hard error.** Contract *Validation*, hard-error list:

> "a `sourceModifierId` group whose entries carry **more than one distinct `itemLevelMin`** (AD-29) — a source row is one tier and therefore one cohort, so such a group is malformed, and leaving it unchecked left `mass(g)` with two conforming readings (whole-group, or per-cohort)"

and the 4.1.0 change table: "A conforming file already satisfies this, so nothing valid is newly refused." FR-27 renders both the error and the "nothing conforming is newly refused" clause; §3 *Source Modifier* renders it as "checked rather than assumed". Matches.

**`statLineCounts`.** Contract field rule:

> "**Optional**, a per-`(base, slot)` list of `{ sourceModifierId, statLineCount }` — a sibling of `cohortTotals` in placement and on the same terms: permitted everywhere, checked wherever present… `statLineCount` is the number of **distinct stat lines that source row publishes** — taken from the row as scraped, *before* it is exploded into entries. Where a group appears in the list, `core` refuses the file if that group's distinct `statId` count disagrees. A `sourceModifierId` in the list matching no entry is itself a disagreement… a producer that cannot source it honestly should omit it rather than compute it from the entries it just emitted, which would make the check vacuous."

FR-27's `statLineCounts` consequence reproduces every clause, including the vacuity warning and the "effectively mandatory" gloss (contract *Validation*: "a producer handling multi-stat rows should treat it as effectively mandatory").

**Exactness.** Contract *Sums must be exact in double precision*:

> "**The comparison is over parsed IEEE doubles, summed in the file's own entry order.** Both halves of that are binding… `core` does not round and does not compare within an epsilon"

and the spine, AD-28 L559: "**The summation order is pinned to the file's own entry order**, folded left as the array is written… An exact comparison is only well-defined once the order is fixed." The two-checkable / one-uncheckable split (FR-27's second exactness bullet) is AD-28 L559 plus contract: "A third exactness rule — a tier's split across the cells it reaches must sum to that tier's weight — is **not** one `core` can apply, because `core` never holds tier weights (AD-28)." The measured intermittency figures FR-27 quotes — "two cells never failed, three failed ~9% of the time, four ~16%, eight ~33%" — match the contract exactly: "a two-cell split never failed, three cells failed about 9% of the time, four about 16%, eight about 33%."

**Hard-error list.** FR-27's twelve bullets are a complete, order-preserving rendering of the contract's *Hard errors — refuse the file* list; no item is added, dropped or weakened. The two deliberate exclusions the PRD names (an uncatalogued id; a straddle) are both stated as exclusions by the contract in the same place.

---

## 2. Instance-by-instance verdicts

### §0 Document Purpose (13 instances — 13 CORRECT)

| # | Claim | Verdict | Evidence |
| --- | --- | --- | --- |
| 1 | Spine final at revision 6 | CORRECT | frontmatter `status: final`, `revision: 6` |
| 2 | AD-1 … AD-29 inherited | CORRECT | AD-29 is the last decision in the spine |
| 3 | "AD ids are stable across every revision" | CORRECT | every banner opens "AD ids are stable" |
| 4 | Rev 5 added AD-29 and raised the contract to 4.0.0, breaking | CORRECT | spine L39; contract "4.0.0 — what changed and why: Breaking. A `3.x` file will be refused." |
| 5 | Rev 6 added no decision, renumbered none, 29 total, amended AD-18/28/29 | CORRECT | spine L33 |
| 6 | 4.1.0 is a non-breaking minor; a conforming 4.0.0 file is a conforming 4.1.0 file; no producer work invalidated | CORRECT | contract §4.1.0: "**Not breaking.** A `4.0.0` file is a conforming `4.1.0` file, no producer work is invalidated, and `core` refuses only a major it does not implement." |
| 7 | Sixteen decisions amended in place across revisions 3–6 | CORRECT | §1.2 above |
| 8 | The first three rounds' lists are at §10 OQ-15 | CORRECT | OQ-15 carries rev 3/4/5; rev 6's list is given in §0 itself |
| 9 | AD-25/26/27/28/29 named by subject | CORRECT | each AD's heading matches the label used |
| 10 | The earlier "cannot reorder" reading was falsified; true only for a single publisher; the two-publisher case is silent and can reach the top of the list | CORRECT | spine L29: "This was first accepted as a limitation on the ground that it could not reorder the ranking — and the gate **falsified that premise**. It holds only where the stat has a single publisher." |
| 11 | AD-29 expressly permits two Source Modifiers publishing one `statId` | CORRECT | AD-29 L595: "**One `statId` may be published by more than one source modifier**…" |
| 12 | `statLineCounts` is what 4.1.0 adds and what stands behind the silent case | CORRECT | spine L29; contract 4.1.0 table |
| 13 | OQ-16 retired by rev 6, settled in this document's direction | CORRECT | spine L25 cites "PRD OQ-16"; FR-29 writes `mass(g)` with no `L`, which is AD-18's form |

### §3 Glossary — `Source Modifier` (8 instances — 7 CORRECT, 1 UNLABELLED EXTENSION)

CORRECT: the one-row/one-weight/several-stats definition; one entry per Stat Line at full row weight; `sourceModifierId` required on every entry; "one source row — one *tier* of one modifier, never a modifier family", with the granularity fixed by the contract; the one-Cohort property now a hard file error with the two-conforming-readings reason; the optional `statLineCounts` declaration counted from the row as scraped; opacity, stability within one `(Base Type, slot)`, never catalogue-validated, never part of a reference/entry/key. Each is stated by AD-29 (L577–601) and/or the contract's *A row that publishes several stats at once* and `sourceModifierId` field rule, and by the spine's Consistency Conventions *Ids* row ("**`sourceModifierId` is the one exception and is not a counter-example**… It appears only on weights-file entries").

**UNLABELLED EXTENSION (minor) — the *reason* the field is required everywhere.** §3 ends:

> "It is read again at **load**, by the file validation FR-27 specifies — which is a different job, and **the reason the field is required on every entry rather than only where a row published more than one stat** (AD-29, AD-18, AD-17)."

AD-29 L581 gives two reasons, and they are not this one:

> "The field is required rather than hybrid-only so that `core` has **one** identity notion instead of two code paths, and so that a producer forgetting it on a hybrid cannot emit a file that still validates."

The contract's field rule and 4.0.0 table say the same thing. The load-time read is real (the contract's hard errors do read the field at load), but "the reason the field is required" is the PRD's own gloss carried under an `(AD-29 …)` citation. Not a contradiction, and **FR-27 states the inherited reasons correctly** ("Required everywhere so `core` has **one** identity notion rather than two code paths, and so that a producer forgetting it on a split row cannot emit a file that still validates (AD-29)"), so the exposure is a §3 reader taking a PRD rationale for an architectural one. Suggested fix: "and a further reason the field is read on every entry" rather than "the reason the field is required".

### §3 Glossary — `Weights File` (4 instances — 4 CORRECT)

Contract version 4.1.0 (contract frontmatter `schemaVersion: '4.1.0'`); external producer and v1 prerequisite supplying pool membership, cell edges and item-level availability (AD-11: "**The file is a prerequisite, not a convenience.**"); `gamePatch` operator-asserted, never derived, never defaulted, producer refuses to run without it (AD-11: "**`gamePatch` is asserted by the operator, not derived**… refuses to run without it rather than emitting a default"); `core` does not parse it, missing-or-empty is a hard file error, `web` surfaces it beside `producer.id` and `producer.generatedAt` (AD-11 + contract hard-error list "a missing or empty `gamePatch`").

### FR-16 — the contract-4.1.0 clause (2 instances — 2 CORRECT)

> "**A uniform-prior file is not one of these cases**: contract 4.1.0 requires `sourceModifierId` on every entry whatever the file's Provenance, so a bootstrap file declaring `complete` answers `coOccur` exactly like any other and its Base Types rank normally (FR-30)."

Three independent supports. Contract field rule: "`sourceModifierId` — **Required on every entry.**" Contract *The uniform-prior bootstrap*: "It is not a stub — it satisfies the real contract." And the spine's revision-6 banner ratifies precisely this reading against a companion that had said otherwise:

> "It also corrects **`PRD-EDIT-PROPOSALS.md` C-53**, which listed the uniform-prior bootstrap as a third case where `coOccur` cannot be evaluated; AD-17 names only two, and a bootstrap file ranks normally since the contract requires `sourceModifierId` regardless of provenance. The PRD deviated from C-53 deliberately and was right" (spine L31)

The accompanying "exactly two such cases" (absent from the file; `partial` pool) matches AD-17 L309: "A base absent from `weights.json`, or one whose pool is `partial`, has no reading of this branch."

### FR-27 (13 instances — 13 CORRECT)

All verified against AD-28 L529–571, AD-29 L573–601 and the contract. Highlights beyond §1.4: the non-breaking rationale ("the check is on the **major**") matches the contract's "core refuses only a major it does not implement"; the "at most two Cohorts" bound and its stated assumption match AD-28 L569 and the contract ("*Stated assumption:* no three tiers of one family overlap at a value"); the two deliberately different keys (non-overlap narrowed by `sourceModifierId`, cohort-carriage not) match AD-28 L569 and the contract's non-overlap field rule; the 2.0.0-would-refuse-a-4.1.0-file claim is checkable against the contract's own worked table, which emits `[56,56.5]` at `itemLevelMin` 60 **and** 65; the uncatalogued-id exclusion matches AD-6 L149 and the contract's "**An uncatalogued `statId` or `bases` key is not a file error either.**"

One advisory, not a finding: the refusal-reports-the-signed-difference bullet ends "(AD-28, AD-29)". AD-28 L559 does not state the reporting rule; the spine states it in its **Deferred** entry ("the refusal reports the observed sum, the expected total and the signed difference") and the contract states it under *Accepted residual risk*. The PRD's own sentence names §7.2 alongside the AD pair, and the whole exactness block is prefaced "This is the copy the external producer reads (§7.3), so it is stated here rather than left to the contract alone" — so the attribution chain is present and I do not file it as a defect.

### FR-28 — the dropped-source-ROW consequence (2 instances — 1 CORRECT, 1 MISATTRIBUTED)

CORRECT: "**Completeness counts Stat Lines, not rows**… The stat-line reading of completeness is stated by `WEIGHTS-FILE-SCHEMA.md`; AD-29 supplies the underlying fact that one modifier may publish several lines." That is exactly right — the contract states "**Pool completeness counts stat lines, not rows.**" and AD-29 supplies the multi-line fact. Precise attribution.

**MISATTRIBUTED — the new dropped-source-row bullet.** The PRD writes:

> "**A dropped source *row* has no mechanical check at all, and it is the larger of the two gaps.** `statLineCounts` guards the Stat Lines **within** a row (FR-27); **nothing guards the set of rows.** `cohortTotals` catches a row missing from a family it already covers, but it is only *required* where a family carries a `modelled-split` entry… (AD-28, AD-29)."

The claim is **true**, and it is stated — almost sentence for sentence — by the contract's *Validation* section:

> "**A dropped source *row* is not detectable at all, and is the larger of the two gaps.** `statLineCounts` guards the lines within a row; nothing guards the set of rows. `cohortTotals` catches a row missing from a family it already covers, but it is only *required* where a family carries a `modelled-split` entry, and most rows are single-stat and undecomposed… emitting `cohortTotals` for every family — permitted, and encouraged — narrows it considerably."

It is **not** stated by AD-28 or AD-29. `grep -n "cohortTotals"` over the spine returns exactly three hits — the revision-6 banner (L29), AD-29 L591 and AD-29 L597 — and none of them states the conditional requirement the bullet turns on; the spine's nearest statement is AD-28 L557, "The file therefore carries, per decomposed family, the **pre-split cohort total**", which is not the same predicate (a decomposed family whose cell masses were *measured* carries `measured`, not `modelled-split`, per AD-28 L555). The "required only where a `modelled-split` entry is present; permitted and encouraged elsewhere" rule lives solely in the contract ("Required for every `(statId, itemLevelMin)` family containing at least one `modelled-split` entry; permitted, and encouraged, for any other"). Likewise, no AD says the row set is unguarded — `grep` for `dropped` and `source row` across the spine turns up only dropped *lines* and *cells* (AD-18 L371/373, AD-29 L591/597/599) and the Deferred *Unidentified pool weight* item, which is about a producer hiding weight behind a scalar, not about a silently omitted row.

Severity: low. Nothing is asserted that the authorities deny, and the citation trail is one hop off rather than wrong. Fix: cite `WEIGHTS-FILE-SCHEMA.md` (as the neighbouring stat-line bullet already does) — e.g. "(`WEIGHTS-FILE-SCHEMA.md`; AD-28, AD-29 for the checks it names)".

### FR-29 — the asymmetry and report-both-causes bullets (6 instances — 6 CORRECT)

The asymmetry bullet is AD-18's own, near-verbatim:

> "Note the asymmetry, because it is what makes `statLineCounts` worth emitting: this error only fires when the dropped stat had a **single** publisher. Where a second source modifier publishes the same `statId`, the containment set is non-empty, nothing is reported, and the numerator quietly loses a share (AD-29)." (spine L373)

and its "still reads `complete` and still counts as covered" tail is AD-29 L599: "The base still reads `complete` and still counts as covered under AD-27, both being declarations rather than content." The contract's *Validation* section renders the same asymmetry as a two-bullet single-publisher / two-publisher split, agreeing on every element including "a reorder" and the `ΣP > 1` path.

The amended report-both-causes bullet is AD-18 L371, near-verbatim:

> "**Two different faults produce that symptom, `core` cannot distinguish them, and it therefore reports both.** Either the reference names a tier that cannot roll at the entry's floor… or the weights file dropped that stat line entirely while still declaring the pool `complete` — which nothing catches unless that group declares `statLineCounts` (AD-29)… The error names the reference, its floor, and the absence of any cell for that `statId` in the scoped pool, and leaves which document is at fault to the reader. Blaming the tracked list unconditionally would send a curator hunting a defect in a file that is correct."

FR-29's parenthetical on why group-consistency cannot catch it matches AD-29 L597 ("the group-consistency rule compares sums only across the lines a group *does* publish, so a line dropped entirely leaves the rest agreeing"). FR-29's `mass(g)`-carries-no-`L` sentence and its hard-file-error fallback match AD-18 L365 word for word in substance.

### §7.2 — the two new Deferred items (2 instances — 2 CORRECT)

**Making `statLineCounts` required.** Spine Deferred (L787): "Deferred only because it is a new required field, and therefore a breaking revision against a producer already building to `4.x`, while the optional form is available today at no cost to anyone. **Revisit if** a weights file is ever found to have dropped a line in practice, or **when the next breaking revision is opened for another reason — at which point it should be folded in rather than deferred again.**" The PRD's "**To be folded into the next breaking revision rather than deferred again**" is that clause. Contract 4.1.0 table agrees: "Making it required is Deferred."

**A relative epsilon on the two sum rules.** Spine Deferred (L788): "This is carried as a **producer obligation** in the contract… rather than as an epsilon in `core`, so the checks keep failing closed… **Revisit if** a conforming producer reports spurious refusals in practice; the fix is a relative epsilon on the two sums only, never on edges." The PRD's rendering — accepted because loud, immediate and failing closed; the signed difference is the evidence the revisit turns on; never extended to band edges — matches both the spine item and the contract's *Accepted residual risk*.

### §7.3 — the new 4.1.0 bullet (4 instances — 4 CORRECT)

Non-breaking minor, `core` refuses only an unknown major, release dependency not re-gated: contract §4.1.0 opening. Optional `statLineCounts`, adopted when the producer is ready, effectively mandatory for multi-stat producers as the only check behind a silently dropped line: contract *Validation* ("**This is the reason to emit `statLineCount`**, and a producer handling multi-stat rows should treat it as effectively mandatory"). One-Cohort property now a checked error refusing nothing that already conformed: contract 4.1.0 table ("A conforming file already satisfies this, so nothing valid is newly refused"). Exactness rules not new obligations, written down after three `core` implementations disagreed: spine L27 ("no **summation order** was pinned anywhere, and float addition is not associative, so three conforming `core` implementations returned three verdicts on one file") and contract 4.1.0 table ("Nothing about which files validate has changed; what changed is that it is now answerable").

### §10 — preamble and OQ-16 (6 instances — 6 CORRECT)

Preamble's "One item is open: OQ-12… Every other question raised against the spine has been answered, OQ-16 by spine revision 6" is consistent with the spine's Open Questions section, which carries the multi-`#` filter-unit question as live and owned by the scraper project, and with the revision-6 banner citing "PRD OQ-16".

OQ-16's five load-bearing claims all hold: AD-18 writes `mass(g)` and says explicitly "carries no `L`" (L365, quoted above); AD-29 formerly wrote `mass(g, L)` and no longer does (§1.3, by grep); the reason is the one-tier/one-cohort property; the respelling was accompanied by making that property a hard file error (AD-29 L589, contract hard-error list); "the same shape as the retired OQ-11" is the spine's own phrase (L25: "the same shape as the retired OQ-11"); and "Nothing here was ever ambiguous to build" tracks the spine's "Nothing was ambiguous to build, but a `contracts` or `core` author reading AD-29 alone would have carried an `L` into a function that does not take one."

---

## 3. Summary

| Verdict | Count |
| --- | --- |
| CORRECT | 58 |
| WRONG | 0 |
| MISATTRIBUTED | 1 |
| UNLABELLED EXTENSION | 1 |
| **Total instances** | **60** |

Both findings are low-severity attribution slips in which the PRD asserts nothing the authorities deny:

1. **FR-28, dropped-source-row bullet — MISATTRIBUTED.** Cited `(AD-28, AD-29)`; stated by `WEIGHTS-FILE-SCHEMA.md`'s *Validation* section. Neither AD states the gap, and `cohortTotals`' conditional requirement appears nowhere in the spine (three `cohortTotals` hits, all in AD-29 and the rev-6 banner).
2. **§3 `Source Modifier`, final sentence — UNLABELLED EXTENSION.** Presents the load-time read as "the reason the field is required on every entry" under an `(AD-29, AD-18, AD-17)` citation; AD-29 L581 gives two different reasons, which FR-27 renders correctly.

No revision-6 claim in scope was found to be wrong. The four directed verifications — spine at revision 6 amending exactly AD-18/AD-28/AD-29 with no addition; the sixteen-decision union across revisions 3–6; AD-29's removal of `mass(g, L)`; and the one-Cohort hard error, `statLineCounts` rules and exactness rules as the PRD renders them — all check out against the amended text.
