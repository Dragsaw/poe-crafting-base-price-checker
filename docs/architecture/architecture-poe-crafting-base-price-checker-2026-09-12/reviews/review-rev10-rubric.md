---
title: "Rubric review — ARCHITECTURE-SPINE.md revision 10"
lens: rubric (good-spine checklist)
target: docs/architecture/architecture-poe-crafting-base-price-checker-2026-09-12/ARCHITECTURE-SPINE.md
companions_reviewed:
  - IMPLEMENTATION-NOTES.md
  - WEIGHTS-FILE-SCHEMA.md (5.0.0)
revision_reviewed: 10
date: 2026-09-19
verdict: "Accept with required fixes — the merge and the 5.0.0 absorption are both sound, but the simplification pass dropped the one curation rule that kept the priced and weighted populations aligned, and pushed five enforceable rules into a companion that no AD carries."
---

# Rubric review — revision 10

## 0. Verdict

**Accept with required fixes.**

Revision 10 attempts two things at once and mostly gets both. The 29→19 merge is
substantively right: every retired id was genuinely half of a decision its neighbour
already owned (purity + dependency direction; four price states + unresolvable detection;
chunk bounds + rotation order; one writer + one schema + one channel). The `5.0.0`
absorption is honest in the hard place — AD-11's *"What `core` can check, and what it
cannot"* paragraph states the widened trust surface rather than implying it, and the
Deferred entry on consumer-side pro-rating correctly binds `modelled-split`'s return to
the same change. Those are the two paragraphs a weaker revision would have omitted.

The failure mode is the one this kind of pass always has. Compressing 853 lines to 1,105
lines across two files (the notes are new) moved a great deal of text, and five rules
came out of the move without a home in the spine — they are now stated **only** in
`IMPLEMENTATION-NOTES.md`, whose own preamble makes it subordinate to an AD that does not
exist. One rule came out of the move with no home at all: rev 9's *curate to interior
cells* rule, which is the only thing that ever stood between AD-16's cheapest-ten
estimator and AD-17's threshold truncation on a multi-tier band. Whole-tier containment
makes that band **more** attractive than it was, not less, so the rule was needed more at
rev 10 than at rev 9 and is the one that vanished.

The spine also knowingly ships with ~106 dangling AD citations in `prd.md` and an
off-by-one in its own retirement count.

## 1. Checklist pass

| Criterion | Result |
| --- | --- |
| Fixes the real divergence points for the level below, at feature altitude | **Mostly.** Altitude is held — no epics, no story-level detail, nothing that belongs in `core`'s source. But the level below is `prd.md`, and rev 10 breaks ~106 of its citations (F3). |
| Every AD's Rule is enforceable and prevents its stated divergence | **No.** Five enforceable clauses now live only in the companion (F2); AD-7 row 3 defines entry to the retry bucket and no exit (F4); AD-11's claim that "two things bound the damage" overstates what AD-16's ascending sort does (F1). |
| Nothing under Deferred could let two units diverge | **Pass.** Every item carries an explicit revisit condition, and the pro-rating item carries a *precondition on adoption* (provenance must return in the same change), which is the strongest form in the document. |
| Every dimension the altitude owns is decided, deferred or an open question | **Mostly.** The operational envelope survived the pass intact — *Deployment & environments* still covers the single environment, the Actions/Pages path, the absence of staging and secrets, and the two patch-cadence maintenance dependencies. One dimension is silent and always has been: the git write path itself (F6). |
| Seed stays minimal; invariants lead | **Pass.** Folding the standalone `## Stack` section into *Structural Seed* and condensing the TS 7 blocker table to a paragraph is a net improvement. The seed is a stack table, three diagrams, an environment paragraph and a tree — nothing a builder would have to unlearn. |
| The spine records decisions, not rationale | **Improved, not achieved.** The bulk of the argument is gone. What remains is the rev-10 banner (which is revision history, reintroduced at the top of the document it was deleted from) and a handful of embedded arguments (F8). |
| Split between spine and IMPLEMENTATION-NOTES is clean | **No, in one direction.** Nothing arithmetic was left behind in the spine — the EV expression and the `P(ref)` ratio are invariants, not arithmetic, and belong where they are. But enforceable, non-arithmetic rules travelled with the arithmetic (F2), and five items are now stated twice (F7). |

## 2. Findings

### F1 — HIGH — The *curate to interior cells* rule was dropped, and whole-tier containment makes the band it protected against the attractive shape

Rev 9 AD-28 carried this, as a rule and not as advice:

> A curator should nevertheless track the interior cell rather than the span […] AD-16
> prices a reference from the **cheapest 10** listings the reference matches, so a
> reference that spans a boundary cell is priced at the cheap tail of the neighbouring
> tier while carrying the whole span's probability mass. Below AD-17's threshold that
> summand does not merely understate. That summand **truncates to zero and takes the good
> tier's mass with it** […] Curate to interiors by default. Span a boundary only where the
> two tiers' prices are known to be close.

Revision 10 contains no equivalent. The word *interior* does not appear, and neither does
the truncation argument.

Its disappearance is understandable — cells are gone, so *interior cell* had no referent —
and it is exactly the wrong outcome, because `5.0.0` widens the case rather than closing
it. Under whole-tier containment a tier contributes its weight only if a tracked band
contains it **whole**. A curator who wants two adjacent tiers' mass therefore has exactly
one spelling available: the union band. `IMPLEMENTATION-NOTES.md` §2.4 confirms it is
legal and prints it as an accepted example — `43.0 – 80.0`, *"a run of adjacent tiers,
edges are the extremes"*. AD-16 then prices that entry from the cheapest ten listings it
matches, which are T7's, while AD-17 multiplies the T7-priced figure by T7+T8's combined
probability and compares it against the payout threshold. If the T7 price sits below the
threshold, the summand truncates to zero **and takes T8's mass with it** — the jackpot
deletion that AD-5's bands exist to prevent, re-entered through a legal, edge-aligned,
schema-valid tracked entry.

AD-11 acknowledges a residual and then misdescribes what bounds it:

> Two things bound the damage and neither is accidental: AD-16 sorts ascending and takes
> the cheapest ten while an excluded tail sits at the top of the band by construction, and
> AD-17's edge alignment rejects the one band shape that would make the gap wide.

The first clause is about *partial* containment — a tier only partly covered, whose
excluded remainder is at the top of the band. It does not speak to the multi-tier band at
all, where the ascending sort is not a bound on the damage but its **cause**. The second
clause is false for this shape: edge alignment accepts the multi-tier run, by §2.4's own
worked table.

AD-16's *"the priced population is deliberately wider than the weighted one"* paragraph is
adjacent but weaker — it accepts a *neighbouring tier's tail* leaking into the priced set,
not a whole neighbouring tier being priced as if it were the tracked one.

**Fix:** restate the rule in AD-11 or AD-16 in `5.0.0`'s vocabulary — *a tracked band
should contain exactly one tier by default; a band containing a run of tiers is priced at
the cheapest tier in the run while carrying the run's whole mass, so span a run only where
the tiers' prices are known to be close* — and correct AD-11's "two things bound the
damage" sentence, which currently tells a reader the shape is already handled.

### F2 — HIGH — Five enforceable rules now live only in `IMPLEMENTATION-NOTES.md`, under no AD

The companion's own preamble sets the contract: *"Every item here is subordinate to an AD
and names which one — where this file and the spine disagree, the spine wins."* That
tiebreak is empty for any rule the spine does not state, and a rule that exists in only
one document can be edited out of it without amending anything.

| Rule | Where it lives now | Why it is enforceable, not arithmetic |
| --- | --- | --- |
| The **overlap predicate** and its branch ordering (`coOccur` must sit above the `statId` inequality or it is unreachable) | §2.1 only; AD-17 says *"The predicate […] is in `IMPLEMENTATION-NOTES.md`"* | This is the load-time rejection rule for `data/tracked.json`, and the spine's own note says an enumeration has twice been found to miss a case. The spine now carries neither the predicate nor the enumeration. |
| **Where the pool cannot answer, `coOccur` is `false` and the tracked list still loads** | §2.2 only | The two wrong readings are *render anyway* and *reject site-wide*. The difference is whether the product is up. That is a divergence between `web` and `core` builders, not a computation. |
| **Within-file kind agreement is `contracts`' job** (two tracked entries naming one `statId` under different kinds) | §2.3 table only | AD-17's check table lists only the cross-file half, owned by `core`. The schema obligation on `contracts` appears nowhere in the spine, so `contracts` can land without it. |
| **`sync` emits an interval edge exactly as derived and may not round a half-integer to reach an integer filter** | §5.2 tail only | This was a Rule clause of rev 9 AD-28 that expressly *"binds `sync`, and not only the producer"*. It is the adapter-side restatement of the sentinel defect. AD-16's trap list cites the notes but states no prohibition on `sync`. |
| **The pinned truncation policy** — oldest-`lastAttemptedAt` order, reserve at least one search for the rotation | §6 only | AD-7 states that truncation happens and that a starvation record is written; *which* pinned entries are dropped is what makes the pinned tail rotate instead of starving behind a fixed key order, and rev 9 AD-26 named the key for exactly that reason. |

The load-time inequality itself (`count(pinned) + currencyStepSearches ≤ 0.5 ×
minChunkSearches`) is a defensible thing to site in the notes, since AD-7 states that the
check exists, who evaluates it and what it gates. The five above are not.

**Fix:** pull the operative sentence of each back into its AD and leave the working and the
worked examples in the notes. Two lines in AD-17 and one each in AD-16 and AD-7 would do
it. A useful invariant for the split: *the notes may hold any sentence whose removal would
only make a builder slower; the spine must hold any sentence whose removal would make two
builders correct in different ways.*

### F3 — HIGH — Ten ids retired, ~106 dangling citations left in `prd.md`, and the count in the banner is wrong

The banner states the problem and then leaves it:

> **AD ids 1–29 no longer all resolve.** Citations in `prd.md` rev 10 that name a retired
> id are stale by this revision and need a PRD pass.

Measured against the working tree, `prd.md` cites retired ids 106 times: AD-18 ×30, AD-29
×19, AD-26 ×13, AD-23 ×10, AD-28 ×10, AD-6 ×8, AD-14 ×6, AD-21 ×6, AD-2 ×2, AD-22 ×2.
`AGENTS.md` records the house rule that PRD↔spine references are made *"by stable id
only"*, precisely so a citation survives the source changing. Retiring ten ids in one pass
inverts that guarantee for a third of the FR set, and the *Retired AD map* is a forwarding
table, not a repair — a reader of FR-*n* still has to find the map before the citation
means anything, and a future reader of a rev-11 spine may not find the map at all.

Two smaller defects ride along:

- The banner says *"Nine ADs merged"* and the map's intro says *"merged nine decisions"*.
  The table has **ten** rows, and 29 − 19 = 10. AD-2, 6, 14, 18, 21, 22, 23, 26, 28, 29.
- `WEIGHTS-FILE-SCHEMA.md`'s own banner forwards only four of the ten (AD-6, AD-18, AD-28,
  AD-29) — correct for that document, but its `governed_by` front-matter is already the
  new numbering, so a reader cannot tell whether the list was audited or left alone.

**Fix:** treat the PRD renumbering as part of this change, not after it. Failing that, give
the banner an explicit expiry (*"this map is load-bearing until `prd.md` rev 11"*) and
correct nine → ten in both places.

### F4 — MEDIUM — AD-7 row 3 defines entry to the `unresolvable` retry bucket and no exit

Rev 9 AD-26 carried two definitions to make row 3 coherent, and named the divergence each
one closed. Rev 10 keeps the first (*only an attempt that issues a request stamps
`lastAttemptedAt`*, now correctly sited in AD-9) and drops the second:

> **An id that resolves again stops being `unresolvable` at that moment**, and rejoins row
> 2 as an ordinary `active` entry. Such an entry does not wait for a retry slot.

As written, rev 10 says an `unresolvable` entry is selected *"on a bounded retry schedule —
at most one attempt per entry per 24h"*, and nothing says when it stops being
`unresolvable`. Two readings are available and both are consistent with everything else in
the document: (a) AD-9's catalogue validation clears the state the moment the id reappears,
which is free and offline, so a recovered entry rejoins the oldest-first rotation the same
run; (b) the state clears only when a priced attempt succeeds, so a recovered entry is
paced at one attempt per 24h for as long as pricing keeps failing. After a patch that
restores a renamed stat id, reading (b) leaves a recovered list refreshing at one attempt
per entry per day with no artifact invalid anywhere — the silent staleness difference that
AD-7's *Prevents* clause names.

**Fix:** one sentence in AD-7 row 3 or in AD-9's *Unresolvable* paragraph. AD-9 is the
better home, since it owns the state.

### F5 — MEDIUM — Craft-cost ownership retired with AD-22 and landed nowhere

Rev 9 AD-22 carried: *"`core` computes a recipe's cost from synced rates, and `sync` never
computes a craft cost."* The *Retired AD map* sends AD-22 to AD-3, and AD-3 carries the
schema-identity half of AD-22 but not this clause. No AD in rev 10 says who computes craft
cost.

The surrounding text now points the other way in two places. AD-4 expressly permits
published artifacts to carry *"prices, weights, costs"*, so a `sync`-written craft cost
violates nothing on its face. The *Scope → Architecture Map* lists *"Craft cost from
currency prices"* under `sync` + `core`, governed by AD-20 and AD-3 — neither of which
assigns the computation. The only surviving guard is indirect: AD-3's writer table gives
`data/recipes.json` a single reader, `web`, so `sync` has no recipe to cost. That is a
real guard, but it is an inference from a table two sections away, and the Design Paradigm
paragraph listing *"craft cost"* among `core`'s pure functions is a capability statement,
not a prohibition.

**Fix:** restore the clause to AD-17, beside *"`core` subtracts craft cost once"*, where
the term is already defined.

### F6 — MEDIUM — The git write path is the one operational dimension left silent

This is inherited from rev 9 rather than introduced by rev 10, but the checklist asks
about the envelope as it now stands, and the whole publishing model rests on this path.

The spine decides that `sync` **commits** — *"only the files `sync` owns, by explicit path,
and never `git add -A`"* (AD-3) — and *Deployment & environments* then says *"That push
triggers a GitHub Actions workflow"*. Between the commit and the push, nothing is decided:

- whether `sync` pushes at all, or leaves the commit for the player;
- which branch and remote, and whether the deploy workflow is branch-triggered;
- what happens when the remote has moved — the player edited `tracked.json` from another
  machine, or an earlier run's push is still unmerged. Pull-rebase-retry, fail the run, and
  force-push are three builder-plausible answers with three different data outcomes;
- what happens when the push fails **after** `sync-progress.json` is written and committed.
  A chunk's work is then recorded as complete locally and invisible to `web`, and whether
  the next run re-prices those entries depends on a rule nobody wrote.

Every other external effect in the system has a named port and a governed adapter (AD-1
lists git among them explicitly). Git is the only one whose *policy* is undecided.

**Fix:** a short clause in AD-3 or in *Deployment & environments* fixing the push, the
branch, the remote-divergence behaviour, and the ordering of the progress write against the
push.

### F7 — LOW-MEDIUM — Five rules are now stated in full in both documents, which is the drift the project already records as a pitfall

`AGENTS.md` records an observed failure: FR-14/17/19/20/23/27/32 had copied AD mechanism
verbatim, and *"a citation survives the source changing; a duplicated copy silently
drifts."* The spine↔notes split has recreated the same shape:

| Restated in both | Spine | Notes |
| --- | --- | --- |
| Four-decimal divine rounding, with the `craftCost`-collapse argument | *Numeric precision* row | §4.2 |
| The even-sample median, with its reasons | AD-16 | §4.3 |
| Rate-limit header parsing and *never enumerate rule names* | AD-8 | §5.3 |
| The empty containment set's two indistinguishable causes | AD-17 | §2.5 |
| Pool coverage's three load-bearing `covered` conditions | AD-27 | §3 |

Each pair currently agrees. The AD-8 pair is the most exposed, because the spine's version
is a paraphrase rather than a copy and the two will not diff against each other.

**Fix:** in each pair, keep the binding sentence in the spine and reduce the other side to
the working — or the reverse — but not both at full length.

### F8 — LOW — Residual rationale, and a revision banner in a document that just deleted its revision history

The pass states its own standard: *"It no longer argues for itself."* Mostly true, and the
document reads far better for it. What is left:

- The rev-10 banner is revision history, reintroduced at the top of the document the
  revision history was removed from. It will be stale the moment rev 11 lands, and it is
  the only part of the document that dates itself.
- AD-11's *"Whole-tier containment understates every affected probability, and unevenly, so
  it reorders rather than shifts"* — an argument, and one that is load-bearing enough to
  keep; flagged only because it sits beside the sentence F1 says is wrong.
- AD-24's `[ASSUMPTION]` paragraph on identifier staleness and AD-8's *Recorded risk* run
  to a paragraph each where a sentence and a Deferred/Open Question entry would carry the
  same weight.

The `[ASSUMPTION]` markers themselves are good and should stay — they are the one form of
rationale a builder cannot safely skip.

## 3. What revision 10 got right, and should not lose in the fixes

- **The merges are real, not cosmetic.** Every retired id was half of a decision. AD-1
  (purity + one-way graph), AD-3 (channel + writer + schema), AD-7 (bounds + rotation) and
  AD-9 (four states + unresolvable detection) each read as one decision now, which is what
  a merge is supposed to buy.
- **AD-11's trust-surface paragraph.** *"It has no arithmetic audit of the producer's work
  at all […] the quiet case has nothing behind it. That trust surface is wider than
  `4.x`'s, and this AD states it rather than implying it."* This is the paragraph a
  revision under time pressure omits.
- **The Deferred entry on consumer-side pro-rating binds its own adoption** — *"AD-10's
  `modelled-split` provenance must return in the same change, or the product carries an
  unlabelled model inside every ranked number."* A precondition on a deferred item, not
  just a revisit trigger.
- **AD-27 now binds `sync`**, which it did not at rev 9, so the coverage figure has a
  computing owner to match the `sync-report.json` field it lands in.
- **OQ-12's framing under `5.0.0` is better than under `4.x`** — the unit now binds the
  producer and `core` independently, so a disagreement surfaces as an edge-alignment error
  rather than as a silently wrong population. That is the decomposition withdrawal paying
  for itself, and it is correctly recorded.

## 4. Required before this revision is built from

1. F1 — restore the one-tier-by-default curation rule and correct AD-11's "two things bound
   the damage" sentence.
2. F2 — return the five enforceable clauses to their ADs.
3. F3 — renumber `prd.md`'s citations, and fix nine → ten.
4. F4 — state when an entry stops being `unresolvable`.
5. F5 — restore craft-cost ownership to AD-17.

F6 and F7 are worth doing in the same pass; F8 is optional.
