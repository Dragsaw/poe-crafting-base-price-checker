---
title: 'Reviewer Gate — rubric-walker lens, spine revision 13'
type: review
lens: rubric-walker
target: ARCHITECTURE-SPINE.md revision 13, IMPLEMENTATION-NOTES.md §8, AGENT-WORKFLOW.md step 2
date: '2026-09-19'
verdict: revise
---

# Rubric walk — spine revision 13

**Verdict: revise.** The change is well-aimed and the AD-5 / Conventions pointers are correct.
But the new `IMPLEMENTATION-NOTES.md` §8 — the whole substance of the revision — carries a
variable-capture defect that makes its central formula circular, defines `tier(ref)` in terms
of a check that itself depends on the number being derived, restates a product-owned number
without citing its owner, and is the only binding-companion section in the file with no
enforcement surface on the side that matters. None of these is fatal to the decision; all four
are cheap to fix now and expensive to fix after a curator has populated `tracked.json`.

Scope of the walk: the four changed loci (spine banner, AD-5's closing paragraph, the
Conventions *Item level* row, `IMPLEMENTATION-NOTES.md` §8, `AGENT-WORKFLOW.md` build-order
step 2), plus the ADs they touch — AD-0, AD-5, AD-11, AD-12, AD-17, AD-24, AD-27 — and
`IMPLEMENTATION-NOTES.md` §1, §2.2, §2.4, §2.5, §3.

---

## F1 — §8's `candidate(entry)` is circular as written (severity: **critical**)

```
candidate(entry) = max over the entry's PRESENT affixes of
                   max over tier(affix) of  entry.itemLevelMin
```

`entry` is bound by `candidate`'s own parameter — the **tracked** entry. So the inner
`max over tier(affix) of entry.itemLevelMin` ranges over a set while evaluating an expression
that does not mention the bound variable. It is a constant, and the constant is the tracked
entry's **own declared `itemLevelMin`** — the very number §8 exists to derive. Read literally,
`candidate(entry) = entry.itemLevelMin` and the derivation is an identity.

The intended reading is obvious to a human and invisible to the rule: the inner maximum ranges
over the **weights** entries in `tier(affix)` and takes **each weights entry's** own
`itemLevelMin` (AD-11 puts `itemLevelMin` on every weights entry, which is where the collision
of names comes from). The two `itemLevelMin`s are different fields on different records, and
§8 is the one place in the corpus where both are in scope in one expression.

This is exactly the failure mode `IMPLEMENTATION-NOTES.md`'s own preamble names — *"two
builders once derived it differently"* — reintroduced in the section written to close it.

**Fix.** Bind the weights entry explicitly, and name the field on its owner:

```
tier(ref)        = { w ∈ weights entries for (base, slot) : contains(ref, w) }   // §1

candidate(entry) = max over the entry's PRESENT affixes a of
                   max { w.itemLevelMin : w ∈ tier(a) }

floor(base)      = max over the base's crafted tracked entries of candidate(entry)
```

---

## F2 — `tier(ref)` is defined through §2.4, which depends on the floor §8 is deriving (severity: **high**)

§8 says:

> `tier(ref)` = the weights entries whose derived interval (§1) the reference's band edges
> **align to under §2.4**.

§2.4 is scoped. Its own text: *"Evaluate under the scope, at the entry's own floor. The
containment set shrinks as the floor drops, so a reference can align at one floor and fail at a
lower one."* And AD-17 fixes the scope as `scoped(base, slot, L) = { e : e.itemLevelMin <= L }`
with `L` the entry's floor. So `tier(ref)` needs `L`; `L` is `floor(base)`; `floor(base)` is
computed from `tier(ref)`. The definition is not well-founded as stated.

It happens to be *resolvable*, and the resolution is worth stating because a builder or a
curator will not see it: alignment is **monotone upward in `L`**. Admitting further entries to
the scoped set can only add entries that are **contained** in the band (an entry outside the
band contributes no line under §2.4's `statId`-filtered `lines(ref)` unless contained), and a
contained line's interval lies inside `[valueMin, valueMax]` by construction — so the set's
`min` can never fall below `valueMin` and its `max` can never rise above `valueMax`. A band that
aligns at `L` therefore still aligns at any `L' > L`. Raising the floor never breaks alignment;
only lowering it can.

**Fix.** Define `tier(ref)` by **unscoped containment under §1** — `contains(ref, w)` is a pure
interval-and-`statId` test on one entry and needs no scope — and add one sentence stating that
§2.4 alignment is then *checked* at the resulting `floor(base)`, noting the monotonicity so the
order of operations is not a puzzle. As written, a careful curator reading §8 has no legal way
to start.

---

## F3 — §8 restates a product-owned number and cites two ADs that do not state it (severity: **high**, ownership)

> *"A **raw base** is pinned at item level 82 and takes no part in either maximum (AD-5, AD-17)."*

Neither cited owner states this rule.

- **AD-5** mentions 82 only descriptively, inside a clause about representation: *"An entry
  with both affixes absent is a raw base, which is how the data represents white ilvl-82
  bases."* It states no obligation to pin anything at 82.
- **AD-17** states the exemption — *"A raw base is exempt, because it is never a summand"* —
  and says nothing about 82.

The owner of 82 is `prd.md`: glossary *Raw Base* (§ line 74), FR-3 (*"A Raw Base is priced as a
white base at item level 82"*), FR-22's floor rule, and the FR-3 `[ASSUMPTION]` recorded in the
PRD addendum index (*"82 is the effective item level cap for these bases… If bases above 82
exist, this needs a ceiling, not a floor"*). Under `AGENTS.md`'s ownership rule, product-owned
numbers live in the PRD and are **cited** elsewhere, never restated — and this one is
restated **with a load-bearing caveat dropped**. §8 presents 82 as settled; the PRD marks it an
assumption with a named failure mode.

**Fix.** Replace with a citation: *"A raw base is exempt from both maxima (AD-17); its item
level is the PRD's number (FR-3), carried with the assumption recorded there."*

---

## F4 — §8 binds under AD-0, but AD-0 supplies no force against the only actor §8 addresses (severity: **high**)

AD-5's new paragraph says §8 is *"binding under AD-0"*, then immediately says *"No component
performs that derivation."* AD-0's force clause reads: *"Where an AD delegates a **computation,
an encoding or a threshold** to a named section of that file, the section carries the full force
of the delegating AD, and **a deviation is a violation of that AD**."* A violation by whom? AD-0
is written for components and builders. §8's own first line says it *"is the one section
addressed to the **curator** rather than to a builder."* The delegation therefore points force
at an actor AD-0 cannot reach, and AD-0's closing paragraph already excludes the project's other
human-facing document (`AGENT-WORKFLOW.md`) from binding on precisely that ground — *"process
guidance carrying no invariant of its own."*

What actually enforces §8, checked against the four cross-file checks (AD-17 / §2.4 / §2.5):

| Error | Caught by | Consequence |
| --- | --- | --- |
| Floor declared **too low** | empty containment set (§2.5), edge alignment (§2.4) | cross-file failure — `sync` aborts, `web` marks the base unrankable |
| Floors **disagree** across one base's crafted entries | AD-17's shared-floor rule | load-time rejection |
| Floor declared **too high** | **nothing** | silently dilutes every denominator on the base (AD-17's `scoped`), moving the ranking |

So §8's maxima are enforced on the lower side only, and the *upper* side — the side both maxima
are about — has no mechanism at all. §8's closing paragraph (*"Raising a floor is never
free"*) says as much without drawing the conclusion.

**Fix.** Either state plainly that §8 binds the curator and that the only mechanical backstop is
the lower-side pair above, with over-declaration unobservable by design; or route §8 through a
footing that fits a human rule rather than asserting AD-0. Silently leaning on AD-0 is the
weaker of the two, because AD-0's whole purpose is to stop a *builder* reading a companion as
advice, and a curator is not in its audience.

---

## F5 — the "run of adjacent tiers" clause reaches the right answer with the wrong reason (severity: **medium**)

> *"A band naming a run of adjacent tiers takes the run's highest `itemLevelMin` — AD-17 permits
> such a run, and **the run is chased only where its rarest tier can roll**."*

The rule is correct. The rationale is not, and it contradicts §8's own two paragraphs above it.
§8 grounds both maxima in **reachability**: *"the chased outcome is only reachable at or above
the highest such level among the affixes being chased."* Apply that test to a run: a band
spanning T7 and T8 succeeds on **any** roll inside it — both tiers are contained and both
contribute to the numerator (AD-11, §1 *Containment*) — so the chased outcome is reachable as
soon as the **lowest** tier in the run can roll. Reachability argues for the minimum here, not
the maximum. "Rarest" is also doing unearned work: tier rarity is a weight, and nothing in the
contract ties a higher `itemLevelMin` to a lower weight.

What actually forces the maximum is **§2.4**. At a floor below the top tier's `itemLevelMin`,
that tier leaves `scoped(base, slot, L)`, its interval leaves `lines(ref)`, and
`ref.valueMax == max{...}` fails — the band is rejected as reaching into a tier it does not
contain (§2.4's fourth worked row). The run's highest `itemLevelMin` is the lowest floor at
which the band is *legal*, not the lowest at which the outcome is *reachable*.

This matters because a curator given the wrong reason will reason from it at the next edge case
and land on the wrong number. **Fix:** replace the rationale with §2.4's, which is the binding
one.

---

## F6 — §8's "do not re-derive when a file arrives" can manufacture the cross-file failure AD-12 aborts on (severity: **medium**)

> *"The declared number is not re-derived when a file later arrives — a floor that moved under a
> base's entries would move the pool and the price with it, and **AD-17's enforcement would not
> notice**, because it compares the entries against each other and never against the file."*

The second clause is true of AD-17's *shared-floor* rule and false of the surrounding system.
Two of AD-17's four cross-file checks compare a tracked entry against the weights file **at that
entry's own floor** — edge alignment (§2.4) and the empty containment set (§2.5). A day-one
floor derived from game data the producer mirrors, that turns out to sit below a tier's real
`itemLevelMin`, will fail one of those two on the first conforming file. The consequence is not
cosmetic: AD-12 makes a present-and-failing weights file abort the run non-zero, and AD-17 has
`web` drop the base's crafted branch as unrankable.

So the instruction "do not re-derive" is safe advice about **price stability** and unsafe advice
about **validity** — and §8 offers no path for the case where the file disagrees. The honest
statement is: the arrival of a conforming file is the first time the floor is *checked*, a
mismatch surfaces as a cross-file failure, and correcting it is a curation edit whose price
movement is expected rather than a defect.

**Fix.** Keep the stability point, drop the "would not notice" claim, and name the two checks
that do notice plus the edit they force.

---

## F7 — the revision banner's FR-22 claim overstates what §8 displaces (severity: **medium**, citation)

The banner says: *"With §8 in place, `prd.md` FR-22 can drop **the last** `*(PRD-owned)*` marker
it wears over a computation."*

FR-22 carries **three** `*(PRD-owned)*` markers, on three different rules:

1. *"A stated curation rule gives that level, not a global constant, and the curator writes it
   by hand"* — the fact that the number is hand-written; AD-5 already owns this.
2. *"The Accepted Tier of a modifier is **tier 1**, except where tier 1 first appears at item
   level 81 or 82 and is too rare to chase; the curator then accepts **tier 2**."*
3. *"A crafted entry's candidate floor is the highest item level among its affixes' Accepted
   Tiers. A Base Type's floor is the highest candidate across its crafted entries…"*

§8 displaces **(3) only**. Marker (2) is a *tier-selection* rule — which tier is worth chasing —
and §8 explicitly does not cover it: §8's `tier(ref)` takes the band as already written and
derives a level from it. Nothing upstream of `tier(ref)` exists anywhere in the spine or its
companions. Marker (2) is also genuinely product-owned (*"too rare to chase"* is a player
judgement, not mechanism), so it should stay in the PRD — but the banner's claim that §8 empties
FR-22 of computation is wrong as written, and a PRD editor acting on it will delete a rule with
no other home.

**Fix.** Narrow the banner to the floor-arithmetic marker, and add one line to §8 stating that
*which* tier a band names is upstream and PRD-owned (FR-22), so the seam is visible from both
sides.

---

## F8 — the Conventions *Item level* row now conflates two different `itemLevelMin` fields (severity: **low**, collateral)

The row covers both fields in one sentence:

> `itemLevelMin` is a declared floor, uniform across a base's crafted tracked entries (AD-17)
> **and present on every weights entry** (AD-11). No component infers or adjusts it; **the
> curator derives it per §8** (AD-5).

The weights entry's `itemLevelMin` is **producer**-owned (AD-11: the producer emits it verbatim
per tier); the curator derives only the *tracked entry's* floor. The appended clause reads as
though it governs both. Before rev 13 the row's final sentence was symmetric across the two
fields and the ambiguity did not bite; the new clause is asymmetric and now does.

**Fix.** Scope the clause: *"…the curator derives **the tracked entry's** floor per
`IMPLEMENTATION-NOTES.md` §8 (AD-5); the weights entry's is the producer's, verbatim (AD-11)."*

---

## F9 — step 2's day-one path is faithful, but leaves AD-27's own *Prevents* unanswered (severity: **medium**)

Every individual claim in the new carve-out checks out against its cited owner:

| Claim in step 2 | Owner | Verdict |
| --- | --- | --- |
| absent file → coverage **undefined, not 0%**; no threshold row fires | AD-27 ¶ *"The gate measures a weights file that exists"* | ✅ verbatim |
| do not escalate; the state is the declared day-one phase | AD-12 ¶ *"An absent `weights.json` is not a cross-file failure"*; AD-24 *"That state is the product's entire day-one phase"* | ✅ |
| every **crafted** base unrankable with a stated reason | AD-17 ¶ *"A base absent from the weights file is likewise unrankable on that branch"* | ✅ |
| **raw bases need no pool and still rank** | AD-11 ¶ *"The file is a prerequisite"*; AD-24's absent-artifact table | ✅ stated in both |
| `sync-report.json` omits the fraction **and its denominator together**, never a zero | §3 *"when `weights.json` is absent both fields are omitted together, which is how 'undefined' is spelled"* | ✅ verbatim |
| the gate is **pending** and fires on the first conforming file | AD-27 ¶ *"re-measured on every weights-file regeneration"* | ✅ consistent; "pending" is step 2's own word, which is fine — `AGENT-WORKFLOW.md` carries no invariant (AD-0) |

The residue is the one thing the carve-out does not say. AD-27's **Prevents** is: *"the view
being designed around a full ranked list that the weights file cannot populate — discovered
after the layout is committed rather than while it is still free to change."* Step 2 now
instructs *"Build the view"* before any measurement can exist, and the paragraph it kept — *"A
commitment to a layout before this number exists is a commitment to an assumption about how much
of the product there is"* — is left sitting directly beneath that instruction, unreconciled.
Worse, AD-27's `< 50%` row says *"Escalate rather than ship"*, while AD-12 and AD-24 make
shipping before the gate the plan; on the day-one path the first measurement necessarily lands
**after** ship.

This is not new mechanism and it is not a contradiction either document commits on its own — it
is a tension rev 13 created by making the two paths adjacent in one step. It needs one sentence,
not an AD.

**Fix.** Add to the day-one paragraph: the layout built on day one must keep the unrankable
group promotable to a primary surface without a redesign, because the first measurement can land
in any band and can only land after the view exists. That preserves AD-27's *Prevents* under the
day-one path instead of silently trading it away.

---

## F10 — AD-12's absent-weights-file record has no home in the Conventions *Logging* enumeration (severity: **low**, pre-existing, now load-bearing)

AD-12 says `sync` *"skips that gate, **records the absence** in `sync-report.json`, and runs
normally."* The Conventions *Logging* row enumerates the report's **records** — `stale-lock-broken`,
pinned-starvation, `unresolvable`, cross-file gate failure, failed push — and the absence record
is not among them. §3 covers only the *omission* of the two coverage figures, which is a
different fact: an omitted field is not a record, and `web` cannot distinguish "absent file"
from "field the producer forgot" without one.

This predates rev 13 (it arrived with rev 12's AD-12 absorption), but rev 13's step 2 now rests
the whole day-one story on the absence being **visible**, which makes the gap consequential.
Flagging as collateral rather than as a finding against the change.

---

## What the walk found clean

- **AD-5's new paragraph does not weaken the four `acceptedTier` prohibitions** — it reinforces
  them. Routing the derivation through the band and naming the label-to-weights join as the
  thing being closed is the right framing, and §8's *"The derivation reads the band, never the
  label"* paragraph restates it consistently with, not in place of, AD-5.
- **No duplication of AD-11 or AD-17.** §8 cites `scoped`, the one-floor rule and containment
  rather than restating any of them; the only near-restatement is the closing *"Raising a floor
  is never free"* paragraph, which adds the curator-facing consequence rather than the rule.
- **No contradiction with §1 or §2.4's arithmetic.** Containment stays whole-tier, the interval
  derivation stays §1's single exported function, and §8 introduces no second reading of either.
- **§8 states nothing the code must do.** Checked deliberately, per the brief: every imperative
  in §8 is addressed to the curator, and the two paragraphs that mention `core`'s behaviour
  (*"AD-17's enforcement…"*, *"Raising a floor…"*) describe existing obligations rather than
  creating new ones. The claim *"no component performs the derivation"* survives — F4's problem
  is the **footing** for binding it, not a hidden component obligation.
- **Altitude.** Nothing in §8 belongs in the PRD (the brief's own constraint, respected), and
  nothing belongs in the spine proper — a curation procedure is companion material by the
  project's ownership rules. The one ownership breach runs the other way: F3, a product-owned
  number pulled *into* the companion.

---

## Required before this revision is done

| # | Finding | Severity | Fix size |
| --- | --- | --- | --- |
| F1 | `candidate(entry)` variable capture — the formula is an identity | critical | one line |
| F2 | `tier(ref)` defined through the scope it is deriving | high | two lines |
| F3 | item level 82 restated without its PRD owner or its assumption | high | one line |
| F4 | §8 binds under AD-0, which has no force over a curator | high | one paragraph |
| F5 | run-of-tiers rationale is reachability; the binding reason is §2.4 | medium | one clause |
| F6 | "AD-17's enforcement would not notice" ignores §2.4 / §2.5 | medium | one sentence |
| F7 | banner's "last `*(PRD-owned)*` marker" claim is wrong | medium | one clause + one line in §8 |
| F9 | day-one path leaves AD-27's *Prevents* unanswered | medium | one sentence |
| F8 | Conventions row conflates two `itemLevelMin` fields | low | one clause |
| F10 | absent-weights record missing from the *Logging* enumeration | low | one list item |

F1 alone justifies **revise** rather than pass-with-fixes: §8's reason for existing is that
*"a floor that two curators compute differently is not a curation preference — it is a different
eligible pool, and so a different price on the same row"*, and as published the section's
central formula computes nothing.
