---
title: 'Altitude Fix Plan — PRD revision 13 → 14'
type: plan
target: prd.md (revision 13)
sources:
  - validation-report.md
  - review-rev13-altitude.md
  - simplification-plan.md
created: '2026-09-19'
---

# Altitude Fix Plan — closing the four criticals

## 1. What this plan fixes, and what it deliberately does not

`validation-report.md` grades revision 13 **Poor** on a mechanical formula: any critical
forces it. All four criticals come from the altitude lens, and **none of them makes the PRD
wrong**. They measure durability — mechanism that survived the cut and will invite its own
re-import. That is what this plan closes.

**In scope — Wave 1 (the ask).** A-1, A-2, A-3, A-4, plus the two items that cannot be
separated from them:

| Item | Why it is inseparable |
| --- | --- |
| **H2** — the `*Architecture-owned*` marker is undeclared, under-applied and read as an exemption | A-4 exists *because* the marker reads as a licence. Fixing A-4's text without fixing the marker's meaning fixes one instance of a rule the document still permits. Three reviewers converged here independently; the report names it the highest-value fix in the round. |
| **O-3** — FR-19 and FR-20 state no testable acceptance | A-4 worked as a deletion empties FR-20. The over-cut register says in terms: *rewrite, not deletion*. |

**Explicitly deferred — Wave 2 (recommended, not required).** The altitude lens's verdict is
that the rule leaks through **three self-granted exemptions**, and only one of them (the
marker) is a critical. The other two are A-10 (FR-28's written argument that restating a
companion's contract is correct) and A-14 (a `*(PRD-owned)*` marker on a computation), with
A-19 (§10's preamble contradicted by the next four lines) as the second-order case. Closing
the four criticals and leaving these three means the next round has a standing rebuttal to
the altitude lens pre-installed in the PRD. See §6.

**Out of scope entirely.** The remaining 17 altitude findings, the three unmade product
decisions, and everything routed to architecture, UX or the story set. They are a separate
pass and none of them blocks this one.

## 2. Precondition — is Wave 1 blocked on anything?

**No.** This matters, because `simplification-plan.md` §5 governs: *nothing is deleted until
it has a home*. Every Wave 1 deletion has a verified owner already:

| Finding | Material leaving the PRD | Owner, verified by the altitude review |
| --- | --- | --- |
| A-1 | The probability ratio | `IMPLEMENTATION-NOTES.md` §1 (*Containment* + riding rules); AD-11, AD-17 |
| A-2 | The three run-start gates and their cost split | AD-12 (spine line 602; the PRD copy is already stale against the carve-out at line 615) |
| A-3 | `data/config.json`'s field inventory and the amendment rule | AD-19 verbatim, including "and nothing else"; AD-7 for the yardstick |
| A-4 | 429 / `Retry-After` / bucket / component boundary | AD-8 and `IMPLEMENTATION-NOTES.md` §5.3, in more detail |

The one absorption item in the whole review — **O-1**, the curator's floor-derivation rule,
which exists in no companion — belongs to A-14, which is Wave 2. **Wave 1 needs nothing from
`bmad-architecture` and can start immediately.**

## 3. The edits, one by one

Each is stated as the exact text out and the exact text in, so the run is mechanical and the
diff is reviewable. Every replacement is sourced from the altitude review's own remedy, which
was written under the changed gate brief — *propose the citation, never add mechanism*.

### Edit 1 — §0 *Conventions*: declare the marker (H2)

This goes **first**. It is the sentence that makes Edits 4 and 5 a rule rather than two
one-off rewrites.

Append to §0's *Conventions* paragraph (`prd.md:29`), after the `(PRD-owned)` sentence:

> A heading marked *Architecture-owned* names a capability whose acceptance conditions live
> in the cited decision rather than here; a workflow turning this document into stories
> raises a spike against the citation instead of writing an ordinary story from the bullets
> below it.

Then **extend the marker** to every FR whose acceptance lives in a companion. The report
names the current asymmetry precisely, and it runs the wrong way:

- Marked today, and correctly: FR-19, FR-20, FR-27.
- **Unmarked and should be marked:** FR-16, FR-21, FR-29, FR-33.

No PRD text is added by the extension — it is one italic phrase per heading.

### Edit 2 — FR-29, first consequence (A-1) · `prd.md:470`

The plan's own FR-29 entry said *"Cut nearly everything: the ratio…"*. Only the notation was
cut. Out:

> A Modifier Reference's probability is the weight of the tiers it wholly contains over the
> weight of every tier in scope at the entry's floor. A tier only partly covered contributes
> nothing, and that is not an error (AD-11, AD-17).

In:

> A tier only partly covered by a curated band contributes nothing to the probability, and
> that is not an error (AD-11, AD-17; `IMPLEMENTATION-NOTES.md` §1).

The second sentence survives intact; only the numerator/denominator clause leaves. §1's
containment block states it, so nothing is lost.

### Edit 3 — FR-14, consequences 2 and 3 (A-2) · `prd.md:294-295`

Two bullets out, one in. The second of the two is near word-for-word against the spine, and
the copy is **already stale** — AD-12 has since added the absent-`weights.json` carve-out
that the PRD copy does not carry. Out:

> - Three run-start gates stand in front of every priced entry, and their consequences
>   differ: a Trade Catalogue failure marks one entry `unresolvable` and the run continues; a
>   cross-file or league failure aborts the run and is recorded in the Sync Report (AD-12,
>   AD-17, FR-24, FR-32).
> - Only the league gate costs a request; the other two exist to stop budget being spent on a
>   configuration that cannot be ranked (AD-12).

In:

> - A run validates its premise before spending budget; a failure that invalidates the run
>   aborts it and is visible in the Sync Report rather than only in an exit code (AD-12,
>   FR-25).

**Worth recording in the memlog:** the first of these two bullets was *added at a previous
reviewer gate's demand in rev 12*. That is the re-inflation cycle in miniature, and it is the
evidence for why Edit 1 exists.

### Edit 4 — FR-31, first consequence (A-3) · `prd.md:499`

Four rule-2 breaches in one sentence — a file path, a field inventory, a cross-AD field
reference and a schema-version concept. Out:

> The active league is player-owned configuration in `data/config.json`, which holds that
> league, the pinned-cap yardstick and its schema version, and nothing else; a fourth field
> is an architecture amendment (AD-19, AD-7).

In:

> The player sets the active league in a committed config file, and the edit is the whole
> act (AD-19).

UJ-6 already states this, and §2.3's file path is defensible there because the player is the
actor. The glossary and FR occurrences are not.

### Edit 5 — FR-20, all four consequences (A-4 + O-3) · `prd.md:360-364`

This is the one that must be a **rewrite**. Worked as a deletion, FR-20 becomes an empty
story — the exact failure the marker was meant to prevent. Out: all four bullets. In:

> - The tool's traffic is paced so that access is never lost; losing it ends the product
>   (R-7).
> - Exactly one governed client is the mechanism, and it is AD-8's (AD-8, NFR-9;
>   `IMPLEMENTATION-NOTES.md` §5.3).

NFR-9 already carries the citizenship requirement (the tool and contact address), so the
fourth bullet is not lost, only relocated to where it already lives.

### Edit 6 — FR-19, keep one observable acceptance (O-3) · `prd.md:352-354`

Strictly this is A-18 (medium), not a critical. It is here because O-3 treats FR-19 and FR-20
as one problem, and leaving FR-19 while rewriting FR-20 leaves the marker meaning two
different things in adjacent FRs. Out: bullets 1 and 3 (Chunk size discovered at runtime;
resumed run continues). **Keep bullet 2 unchanged** — lock recovery is a real product
consequence, the failure mode AD-7 itself calls "the worst one available". Add:

> - An unattended run that fails is visible in the Sync Report rather than only in an exit
>   code (AD-7, FR-25).

### Cheap adjacency — take it or leave it, but decide deliberately

Three high findings sit in FRs Wave 1 already opens. Working them costs one extra bullet each
and no extra verification; skipping them means reopening the same FR next pass.

- **A-9** — FR-29's two error payloads and the edge-alignment predicate (bullets 2 and 3, `prd.md:471-472`), collapsing to one bullet.
- **A-8** — FR-21's query-field prose and its duplicate open-questions bullet. FR-21 is already being touched by Edit 1's marker extension.
- **A-20 (partial)** — FR-29's fourth bullet (`prd.md:473`) carries three package names (`web`, `sync`, `core`) in one sentence. It is the densest single instance of the 22.

**Recommendation: take all three.** They are inside files already open, and A-9's first
payload is one sentence behind `IMPLEMENTATION-NOTES.md` §2.5 today.

## 4. Gates — how we know the run worked

Run `gate.py` unchanged; it passed 11/11 on rev 13 and must still. Add four checks specific to
this pass:

1. **No new mechanism.** Diff word count must be net *negative*. Expected: −200 to −280 words
   for Wave 1 alone, −350 to −450 with the adjacency.
2. **Marker symmetry.** Every FR whose **Consequences (testable)** list resolves its acceptance
   through a companion citation carries *Architecture-owned*; every FR carrying the marker is
   declared by §0. Seven FRs after Edit 1 (FR-16, 19, 20, 21, 27, 29, 33).
3. **No FR emptied.** FR-19 and FR-20 each retain at least one consequence a test could
   observe without reading the spine. This is O-3 restated as a gate.
4. **Citation resolution.** Every `AD-n` and companion `§n` introduced by an edit resolves —
   `IMPLEMENTATION-NOTES.md` §1 and §5.3, AD-12, AD-19, AD-8, NFR-9, R-7, FR-25.

Then re-run the **altitude lens alone** against the six edits, under the same changed brief.
Not the full four-reviewer gate — the other three found zero criticals and nothing here
touches their dimensions.

## 5. Sequence and effort

One `bmad-prd` Update run. Edits are ordered by dependency, not by severity.

| Step | Work | Depends on |
| --- | --- | --- |
| 1 | Edit 1 — §0 declaration, then the marker extension sweep | — |
| 2 | Edits 2, 3, 4 — the three text-only criticals | — (parallelisable; FR text is self-contained) |
| 3 | Edits 5 and 6 — the FR-19/FR-20 rewrite pair | Step 1 (the marker must mean something first) |
| 4 | Adjacency, if taken | Step 2 |
| 5 | Gates, memlog entries, `revision: 14` | all |

**Effort: half a day.** No architecture round-trip, no UX round-trip, no story-set change.
The relocation ledger from Phase 0 already covers every fragment being cut.

**Not touched by this run, and therefore still open after it:** the three unmade product
decisions, the `AGENT-WORKFLOW.md` build-order contradiction, `EXPERIENCE.md` state 28, and
the `4.1.0` instruction in `spec-contracts-accepted-tier-and-search-id.md` — that last one is
the only finding in the entire round where a builder obeying a current document writes the
wrong code, and it is a story-set fix, not a PRD one.

## 6. The argument for folding Wave 2 in now

The altitude lens's verdict is blunt: *fix those four and the remaining twenty are a
mechanical sweep; leave them and the next validation round will cite FR-28's meta-bullet to
justify the first re-import, exactly as rounds 2 through 12 did.* The "four" it means are the
marker (Wave 1), plus:

- **A-10** — FR-28's meta-bullet, which argues that restating a companion's contract is
  correct. Delete it; the addendum's *Revision 13 rationale* is where it belongs. **One
  deletion, zero replacement text.**
- **A-14 / O-1** — the `*(PRD-owned)*` marker on the curator's floor arithmetic. This is the
  only Wave 2 item with a cost: the rule has **no owner anywhere**, so it must be absorbed
  into `IMPLEMENTATION-NOTES.md` before it can leave. One `bmad-architecture` round-trip.
- **A-19** — §10's preamble promises "by id only" and the next four lines break it. Either
  hold to the stated form or change the preamble. **Recommendation: hold to the form** — §7.2
  and §7.3 already cite these OQs by id, so nothing downstream needs the restatement. Keep
  OQ-21's `[NOTE FOR PM]`.

Two of the three are pure deletions. Only A-14 adds a round-trip, and that round-trip is
already owed to architecture for the build-order contradiction, so it costs one batch, not
two. **My recommendation: fold A-10 and A-19 into this run, and send A-14/O-1 to architecture
in the same batch as the build-order fix.** That closes all three self-granted exemptions and
leaves revision 14 with no standing argument against its own altitude rule.

## 7. Decisions I need from you

1. **Wave 2 — in or out?** Recommendation above: fold A-10 and A-19 in, route A-14/O-1 to
   architecture. Cost is roughly two extra hours and one batched architecture request.
2. **The adjacency (A-8, A-9, A-20-partial)?** Recommendation: take it. Same files, no extra
   verification.
3. **Revision number.** Ship as **revision 14** now, or hold the criticals and bundle them
   with the full 24-finding sweep as one larger revision 14? Recommendation: **ship now.** The
   report is explicit that the grade is a mechanical artifact and the document is not wrong —
   but the four criticals are precisely the items that *decay*, and one of them (A-2) is
   already stale against AD-12 one revision after the rewrite that existed to prevent that.
4. **The marker extension list.** I have FR-16, FR-21, FR-29, FR-33 from the report. Confirm,
   or say if you want the criterion applied by script against the whole FR set rather than
   taken from the review.
