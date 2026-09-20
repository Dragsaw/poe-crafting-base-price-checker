---
title: 'Adversarial review — spine revision 13'
type: review
status: final
created: '2026-09-19'
target: ARCHITECTURE-SPINE.md revision 13
companions_read: [IMPLEMENTATION-NOTES.md, AGENT-WORKFLOW.md, WEIGHTS-FILE-SCHEMA.md]
---

# Adversarial review — revision 13

**Verdict: not closed.** Seven pairs of conforming units build incompatibly. Two of them
(F1, F2) are load-bearing on the exact surface revision 13 added.

**Note on the text reviewed.** `IMPLEMENTATION-NOTES.md` §8 changed in the working tree
*during* this review. The first read had `tier(ref)` defined through §2.4 edge alignment
(circular — the floor from the tiers, the tiers under the floor). The text reviewed below is
the later one, which declares `tier(ref)` **unscoped** over the `(baseTypeId, slot, statId)`
pool and adds the paragraph *"The derived floor keeps its own tiers in scope, but may admit
others."* **The circularity attack (brief item 4) is closed by that rewrite** — the curator's
act runs tiers → band → floor, and nothing resolves a tier under a floor. F2 below is a defect
*introduced by* the same rewrite.

Every finding names two units, the exact inputs, and the incompatible outputs, and each was
checked against the clause that governs the composition before being written down.

---

## F1 — CRITICAL. The weights pool is keyed by class; every consumer of it is keyed by base, and no artifact joins the two

**The two units.** The weights producer (`poe-mod-weights-scraper`, satisfying
`WEIGHTS-FILE-SCHEMA.md` `5.0.0`) and the `core` builder implementing AD-17's
`scoped(base, slot, L)`.

**The governing clauses, read.**

- `WEIGHTS-FILE-SCHEMA.md` *Field rules*, `bases` key: **"Two levels. Outer key is a trade
  category filter id (`categoryId`)… Inner key is the poe2db `className` verbatim."** The
  `{prefix, suffix}` pools hang off `(categoryId, className)`.
- AD-5: **"`baseTypeId` is the trade API's base type `type` string exactly as `data/items`
  spells it."** A `TrackedEntry` is keyed on that string.
- AD-17: `scoped(base, slot, L) = { entry ∈ pool(base, slot) : … }`. `pool` takes a **base**.
- `IMPLEMENTATION-NOTES.md` §3: `covered(base) = base is PRESENT in weights.json ∧ both slots
  declare poolCoverage "complete"`. Presence of a **base**.
- §8 (new): `tier(ref) = the weights entries for the reference's **(baseTypeId, slot, statId)**`.
- `IMPLEMENTATION-NOTES.md` §5.2 trap 1: **"no committed artifact maps a base type to its leaf
  category — `data/items` groups only ten coarse labels. Do not attempt that mapping."**
- AD-24: the eight fetched artifacts are `dataset`, `sync-report`, `weights`, `recipes`,
  `tracked`, `config`, `catalogue/stats`, `catalogue/static`. **`catalogue/items.json` is
  expressly withheld from `web`**, and a ninth artifact is an amendment.

**The incompatibility.** `pool(baseTypeId, slot)` is not a computable expression. The file
offers `pool(categoryId, className, slot)`; `tracked.json` offers `baseTypeId`; §5.2 forbids
building the `baseTypeId → categoryId` map and states that no committed artifact carries it;
and AD-24 withholds from `web` the one catalogue file that carries even the coarse grouping.
`web` performs the ranking at read time (AD-4) and therefore cannot resolve a single pool.

**Two conforming units, two outputs.** Builder A reads the outer `categoryId` level and
resolves `"Guardian Bow"` by scanning for a `className` sub-key it guesses (`"Bows"`) — a
mapping AD-25 gives it no authority for, since the catalogue carries **"no per-base
association"**. Builder B applies §3 literally, finds no key equal to `"Guardian Bow"`, and
declares the base **absent from `weights.json`** — which under AD-17 makes every crafted base
in the product unrankable and under §3 sets `coverage` to `0 / n`. Both obey every AD to the
letter. A ships a ranked list; B ships an empty one and AD-27's `< 50%` row fires *"escalate
rather than ship."*

**Why no check catches it.** Both files are schema-valid; the four cross-file checks all
presuppose a resolved pool, so under B they never evaluate and under A they evaluate against a
pool chosen by guesswork. `sync`'s `bases`-key validation is **report-only** by the contract's
own *Not a file error* list.

**Close it with.** Either an AD that makes the weights file's outer key `baseTypeId`
(one pool per base, the entity AD-3 already names), or a new AD declaring a committed,
sync-owned `baseTypeId → (categoryId, className)` map as a ninth artifact — which also amends
AD-24 and relaxes §5.2 trap 1 from *"do not attempt that mapping"* to *"read it from the
committed map."* Nothing weaker resolves it: today the join is simultaneously required by
AD-17 and prohibited by §5.2.

---

## F2 — HIGH. §8's new safety paragraph asserts a check that provably cannot fire

**The claim under attack.** §8: *"It can, however, pull **lower** tiers into the containment
set — and if their intervals extend past the band's edges, §2.4 rejects the reference at load.
**That rejection is the pair being wrong, not this rule**."*

**The governing clauses, read.**

- §2.4: `lines(ref) = { line : entry ∈ **contained(ref)** ∧ line ∈ entry.lines ∧ line.statId ==
  ref.statId }`, then `ref.valueMin == min{…}` and `ref.valueMax == max{…}`. The comparison set
  is the **containment** set.
- §1 *Containment*: `contains` requires `interval(line).min >= ref.valueMin ∧ interval(line).max
  <= ref.valueMax`. A tier whose interval **extends past the band's edges is by definition not
  contained**.
- AD-11, OQ-21 paragraph: *"Edge alignment compares a band only against its **own containment
  set**, so an excluded tier that is *flush* with a band edge is invisible to it."*

**The defect.** The two halves of §8's sentence are mutually exclusive. A tier whose interval
extends past the band's edges is **excluded from `contained(ref)`**, so §2.4 never reads it and
cannot reject anything on its account. The sentence promises the curator that a wrong
floor/band pair is caught at load; the clause it cites says the opposite in so many words.

**Worse: the reverse is a theorem.** Raising the floor can **never** break edge alignment.
Every entry newly pulled into `contained(ref)` satisfies `min ≥ ref.valueMin` and
`max ≤ ref.valueMax`, so it cannot move either extreme outward; and the tier that set the band
stays in scope by §8's own construction (`itemLevelMin ≤ candidate ≤ floor`), so it keeps
supplying both extremes exactly. `min` stays `ref.valueMin`, `max` stays `ref.valueMax`,
alignment holds. The same argument runs for a band written over a run: both edge-setting tiers
are in `tier(ref)` and so are both ≤ the floor. The empty-containment check likewise cannot
fire, since the set only grows.

**The two units.** Curator A believes §8 and raises `floor(base)` from 40 to 75 to accommodate
a second tracked entry, relying on load-time alignment to police the result. `core` builder B
implements §2.4 exactly as written. Input: base with `prefix` band `[43.0, 56.5]` on T7
(`itemLevelMin` 40), plus a scoped-in T6 `[35.0, 50.0]` at `itemLevelMin` 55 that covers the
band's `valueMin` without being contained. Output: the file loads clean, T6's weight enters the
**denominator**, T6's cheaper items enter AD-16's ascending-sorted sample, and the row is the
**floor intrusion** AD-11 names as *"the worse case."* A is told nothing.

**Close it with.** Delete the false reassurance and state the true consequence: raising a floor
is **silent** — it admits both intrusion shapes of OQ-21 and inflates the denominator, and no
check fires. §8's own *"Raising a floor is never free"* paragraph is the correct statement and
the new paragraph contradicts it.

---

## F3 — HIGH. `floor(base)` has no enforcement in the over-declaring direction, and §8 concedes it

**The two units.** Curator A (derives per §8) and Curator B (declares `82` on every crafted
entry — schema-valid, uniform, never wrong about *reachability*).

**The governing clauses, read.** AD-17: *"The crafted entries on one `baseTypeId` must share
one `itemLevelMin`."* That is a **within-file** rule over `tracked.json` alone — it is not one of
the four cross-file checks, and §8 says so: *"AD-17's enforcement would not notice, because it
compares the entries against each other and never against the file."* AD-5: *"No component
performs that derivation — the file states the result and the code reads it."*

**The incompatible outputs.** Same `tracked.json` bands, same `weights.json`. A declares 60, B
declares 82. By F2's monotonicity result both files pass **all four** cross-file checks and
AD-17's shared-floor check. B's `scoped(base, slot, 82)` is a strict superset of A's, so every
denominator is larger and **every probability on the base is smaller**; AD-17's `EV` and the
ranked order differ. Two conforming builds, two different top-20 lists, no artifact invalid and
nothing reported.

**Severity note.** This is the failure AD-0 exists to prevent (*"two conforming implementations
return different numbers from the same files while every artifact stays schema-valid"*),
re-entering through the one input AD-5 hands to a human and takes out of the code's reach.

**Close it with.** Either a fifth cross-file check — *the base's declared floor equals
`max over crafted entries of candidate(entry)`, recomputed in `core` from the file* — which is
computable exactly as written and would make §8 enforceable; or an explicit AD clause stating
that the floor is an unchecked curator assertion and that a ranking is only as good as it,
which at least stops a builder from assuming the number is audited. The current position —
a binding derivation with no possible detector — is the worst of the three.

---

## F4 — HIGH. The day-one floor freeze and AD-12's abort gate deadlock each other

**The clauses.** §8: *"Where no conforming `weights.json` exists yet… the curator declares the
floor from the same game data the producer mirrors… **The declared number is not re-derived
when a file later arrives**."* AD-12: a cross-file failure *"invalidates the run's premise, so
the run **aborts**"* — the whole run, for any one failing base. AD-27/AD-24: absent weights is
the product's **declared day-one phase**, and curation happens during it.

**The scenario, with two units.** Day one, Curator A declares `itemLevelMin: 55` for a base,
derived from poe2db as §8 permits. The producer later ships a conforming file in which the
chased tier's `itemLevelMin` is 60 (a source revision, a patch, or simply a different reading of
the same page). At `L = 55` the tier is out of `scoped(base, slot, 55)`, so the reference's
containment set is **empty** → the empty-containment cross-file check fails → AD-12 aborts the
run **non-zero, on every invocation, for the whole product**, and `dataset.json` stops updating
for every other base.

**The deadlock.** The only fix is to move the floor to 60. §8 forbids it. §8's offered remedies
— *"widen the band to the run it now contains, or retreat to a tier whose run stays whole"* —
do not reach this case: no band written at any width contains a tier that is **out of scope**,
because scoping happens before containment. The curator must violate binding text to restore
syncing.

**And §2.5 makes it undiagnosable.** The payload must *"name **neither file as at fault**."*
The curator is handed a reference, a floor, and an absence, with the document that would
explain it (§8) instructing them that the floor is not the thing to change.

**Close it with.** A stated exception: a floor derived without a weights file is **provisional**
and is re-derived once on the first conforming file, as part of AD-27's first measurement,
after which the freeze applies. That preserves §8's real concern (floors must not drift
silently under a live dataset) without making a day-one guess permanent.

---

## F5 — MEDIUM-HIGH. `tier(ref)` is undefined for a `valueless` reference

**The clauses.** §8: `tier(ref) = the weights entries … **whose derived interval (§1) lies wholly
within the band's edges**`. AD-5: a `valueless` reference is `(statId)` with **"no edges at
all"**, *"not a degenerate band"*, and **"no component may give it sentinel edges."** §1: a line
with no `#` has **"none; the line is `valueless`"** for its derived interval. §8's `candidate`
maxes *"over the entry's **PRESENT** affixes"*, and a valueless affix is present.

**The gap.** For a valueless affix, both operands of §8's predicate are absent: there is no
derived interval and there are no band edges. `tier(ref)` is the empty set or is undefined, and
§8 gives no other arm — even though §1's `contains` *does* define a valueless arm
(`statId` match ∧ `ranges` empty), which §8 does not cite.

**Two curators, one base.** Input: the contract's own example entry —
`ExtraBolt`, `itemLevelMin: 45`, one line `{statId: "explicit.stat_2954116742", ranges: []}` —
tracked as a prefix-only crafted entry, its suffix a banded reference whose tier sits at
`itemLevelMin` 30. Curator A treats `tier(valueless)` as empty and takes `candidate = 30`.
Curator B reads §1's valueless containment arm and takes `candidate = 45`. A's file declares
`itemLevelMin: 30`; at that scope the ExtraBolt entry (45) is out of the pool, the containment
set is empty, the cross-file check fails, and per F4 `sync` aborts on every run. B's file ranks.

**Close it with.** One sentence in §8: *for a `valueless` reference, `tier(ref)` is the entries
carrying a line with the reference's `statId` and an empty `ranges`* — i.e. cite §1's second
containment arm instead of a predicate that only exists for bands.

---

## F6 — MEDIUM. Nothing filters `weight: 0`, and a zero-weight tier can set the floor and satisfy every check

**The clauses.** `WEIGHTS-FILE-SCHEMA.md`: *"`0` is meaningful (**"cannot roll on this base"**)
and must still be emitted."* §1 `contains` has no weight condition. §2.4's `lines(ref)` has no
weight condition. §8's `tier(ref)` has no weight condition. AD-17: an empty containment set is
*"a validation error, never a `P = 0`."*

**Two units, two outputs.** Builder/curator A treats a `weight: 0` tier as a tier (it is one —
the file says emit it). Curator B treats *"cannot roll on this base"* as absence. Input: a base
whose statA pool carries T3 `[10, 20]` at `weight: 0`, `itemLevelMin: 70`, and nothing else
matching a band `[10, 20]`.

- A: `tier(ref) = {T3}`, `candidate = 70`, the band aligns exactly on T3's interval, the
  containment set is **non-empty** so AD-17's empty-set check does not fire — and
  `P(ref) = 0 / Σ`. AD-17 says a zero here should have been a validation error; the check that
  was supposed to produce the error is satisfied by a tier that cannot roll. The summand
  contributes nothing, the base ranks at `EV = −craftCost` (AD-17's below-threshold rule), and
  the row reads as *"threshold excluded every outcome"* rather than *"this cannot roll."*
- B: `tier(ref)` is empty, `candidate` undefined, and B either drops the entry or declares a
  lower floor that then fails the empty-containment check loudly.

Secondarily, A's floor is raised to 70 by a tier that cannot roll, which by F2 silently widens
every other reference's denominator on that base.

**Close it with.** State in §1 *Containment* whether `weight: 0` entries participate — in the
numerator, in the denominator, in `tier(ref)`, and in the empty-containment check. Four
answers, one sentence; today there are two defensible readings and no clause that picks.

---

## F7 — LOW. §8's `candidate(entry)` rebinds `entry`, and the literal reading is an identity

```
candidate(entry) = max over the entry's PRESENT affixes of
                   max over tier(affix) of  entry.itemLevelMin
```

`entry` is bound in the head to the **tracked** entry; `tier(affix)` returns **weights** entries;
the inner `entry.itemLevelMin` is meant to range over those. Read under the head's binding —
the only binding the notation actually establishes — the expression is
`candidate(entry) = entry.itemLevelMin`, i.e. *declare what you declared*, and `floor(base)` is
the max of the entries' own declarations, which AD-17 already forces to be equal. The
surrounding prose disambiguates it; the formula, which is the binding artefact under AD-0, does
not. Rename the bound variable (`max over t ∈ tier(affix) of t.itemLevelMin`). The collision is
not accidental: `itemLevelMin` names two different quantities in two files (AD-5's declared
crafting floor, AD-11's per-tier lowest roll level) and §8 is the one place they meet.

---

## Brief item 6 — `AGENT-WORKFLOW.md` step 2 on day one: CLOSED, with a residue

Two readers now land in the same place. The carve-out is decisive on its face: *"**First,
decide whether the gate fires at all.** Where `data/weights.json` is **absent**, coverage is
**undefined — not `0%`** — and **none of the threshold rows below fires**… Do not read an
absent file as a coverage failure and do not escalate,"* followed by *"**Build the view.**"*
A reader who waits has to ignore an imperative addressed at exactly their situation.

Two residues, neither a divergence:

1. The step heading still reads *"Measure pool coverage **before any view work**, once a
   weights file exists"* and the section preamble still says *"Two activities run in sequence
   and not in parallel."* The heading's trailing clause does the work, but a reader skimming
   headings sees a sequencing instruction with the resolving clause four screens below the
   body's answer. Cheap fix: put *"— on day one, build the view"* in the heading.
2. **Nothing in `AGENT-WORKFLOW.md` binds.** AD-0: *"This rule does **not** extend to
   `AGENT-WORKFLOW.md`, which is process guidance carrying no invariant of its own."* The
   day-one path is therefore advisory wherever it is not also carried by AD-24's
   absent-tolerable table, AD-27's *"the gate measures a weights file that exists"* and §3's
   *"both fields are omitted together."* All three do carry it, so the carve-out is safe — but
   it is safe because of the spine, not because step 2 says it.

---

## Attacks constructed that did NOT hold up

Recorded so the next reviewer does not re-run them.

- **`tier(ref)` is circular (brief item 4).** It was, in the first text read; the working-tree
  rewrite closes it by declaring `tier(ref)` **unscoped** and defining it by containment rather
  than by §2.4. The curator's order (tiers → band → floor) is well-founded and needs no fixed
  point. Withdrawn.
- **"The run's highest `itemLevelMin`" is ill-defined (brief item 5).** §8's sentence is
  *descriptive*, not a second rule: `tier(ref)` already returns the set, and
  `max over tier(affix)` already takes its highest `itemLevelMin`. "Run of adjacent tiers" is
  never load-bearing — no reader has to identify a *run*, only the containment set, which is
  defined without the word. Two readers cannot pick different runs because neither picks a run.
  Withdrawn.
- **A band aligning at one floor and failing at another (§2.4's *"a reference can align at one
  floor and fail at a lower one"*).** True as stated, and it does not produce a divergence under
  §8, because §8 guarantees the edge-setting tiers are at or below the declared floor. It is the
  basis of F2 and F3 rather than a finding of its own.
- **`acceptedTier` leaking into the derivation.** AD-5's four prohibitions plus §8's
  *"reads the band, never the label"* are airtight, and §4.1 keeps the label out of the
  canonical key. No reading admits the join. No finding.
- **`sync` and `web` deriving different coverage figures.** §3 assigns the computation to
  `sync` and forbids `web` from recomputing it, by name and with the reason. Closed.

---

## Summary of what to add or tighten

| # | Severity | Close with |
| --- | --- | --- |
| F1 | Critical | Re-key the weights file on `baseTypeId`, **or** amend AD-24 for a ninth committed `baseTypeId → (categoryId, className)` artifact and relax §5.2 trap 1 accordingly |
| F2 | High | Delete §8's *"§2.4 rejects the reference at load"* paragraph; state that raising a floor is silent and admits OQ-21's intrusion shapes |
| F3 | High | A fifth cross-file check on the declared floor, **or** an explicit AD clause that the floor is an unaudited curator assertion |
| F4 | High | A provisional-floor exception: a floor derived with no weights file is re-derived once, on the first conforming file |
| F5 | Medium-high | Give §8 a `valueless` arm citing §1's second containment branch |
| F6 | Medium | State `weight: 0` participation in §1: numerator, denominator, `tier(ref)`, empty-containment check |
| F7 | Low | Rename §8's inner bound variable |
