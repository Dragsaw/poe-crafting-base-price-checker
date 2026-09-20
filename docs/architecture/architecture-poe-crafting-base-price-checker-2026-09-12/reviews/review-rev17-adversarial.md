---
title: 'Adversarial Review — Revision 17 (class discriminator)'
type: architecture-review
lens: 'adversarial: two conforming builders diverge'
reviewed_revision: 17
created: '2026-09-20'
---

# Adversarial Review — Revision 17

**Lens.** Construct two units one level down that each obey every AD to the letter yet
still build incompatibly. Concentrated on revision 17's new material: AD-17's fifth
cross-file check (class discriminability), the `className → discriminator` derivation
(AD-5, AD-16, `IMPLEMENTATION-NOTES.md` §10), and `WEIGHTS-FILE-SCHEMA.md` `5.1.0`'s
normative `className` grammar.

**Verdict: not closed.** Three concrete two-builder incompatibilities survive, one of
them a self-contradiction inside a single binding section (§2.6), and one a scope
mismatch between the spine's companion notes and the schema it delegates to. A fourth
item is a lower-severity completeness gap in the grammar's own prose specification.

---

## Critical — §2.6's "load error vs. per-class exclusion" claim is self-contradicting, and the two documents that would implement it disagree

**Where:** `IMPLEMENTATION-NOTES.md` §2.6 (lines 227–232), cross-checked against
`WEIGHTS-FILE-SCHEMA.md`'s Validation section (lines 256–265) and its `className` grammar
field rule (line 221) and change table (line 47, 49).

**The claim.** §2.6 states:

> "A `className` that satisfies no arm of §10's grammar fails here, and separately fails
> at load. The two are not redundant. §10's grammar failure is a `weights.json` load
> error and fires for **any** class, discriminable or not... This check fires only where
> the unparseable key would also have changed what got priced."

This asserts two things that cannot both be true for the same input:

1. Hitting §10.2's "otherwise" arm (satisfies no arm of the grammar) is **always** a
   whole-file `weights.json` load error — i.e. `WEIGHTS-FILE-SCHEMA.md`'s Validation
   section refuses the file.
2. §2.6 (the narrower, per-class, cross-file check) **also** fires "where the unparseable
   key would also have changed what got priced" — implying §2.6 sometimes fires *because
   of* an unparseable key, without the whole file having already been refused.

**Why (1) is false as written.** Walk `WEIGHTS-FILE-SCHEMA.md`'s actual grammar (line 47,
221): a `className` is **defined** to be exactly one of two things — *defence-suffixed*
(`<family>_<letters>`), or *plain*, which the schema defines as simply "carrying no such
suffix." Since "plain" is the literal negation of "defence-suffixed," **every string is
one or the other by construction** — there is no third shape for the file-level hard
error ("an inner `className` key matching neither grammar above," line 256) to actually
catch, absent some unstated syntactic restriction on what a "family" or "letters" token
may contain.

But §10.2's three arms are **not** a re-statement of that two-way file grammar. Arm 2 is
gated on "`className` is under `categoryId` `\"jewel\"`" and arm 3 on "its `categoryId`
carries exactly one class" — both are facts about **category fan-out and a literal
string**, not about the shape of `className` itself. A **plain** `className` (schema-valid
under `5.1.0`, passes the file's hard error) that sits under a `categoryId` which (a) fans
out and (b) is not literally `"jewel"` matches **none** of §10.2's three arms and falls to
"otherwise." `WEIGHTS-FILE-SCHEMA.md`'s Validation section has no hard error for this
shape — it is not "matching neither grammar" (it matches "plain" fine), it does not
violate the distinctness rule (that rule is scoped to defence-suffixed classes only, line
48/221), and it does not violate no-mixing (a fan-out category of all-plain classes is
exactly the shape the no-mixing rule *permits*). **The file loads.**

**The two-builder split.** Builder A implements §2.6 literally as written: "§10's grammar
failure is a `weights.json` load error... fires for any class" — so on hitting the
"otherwise" arm for *any* class (needing a discriminator or not), Builder A's `sync`/`core`
**refuses the whole file**, aborting the run non-zero (AD-12's cross-file-failure
consequence) and making every crafted item class unrankable. Builder B implements
`WEIGHTS-FILE-SCHEMA.md`'s Validation section literally: the plain-fan-out-non-jewel
`className` passes every listed hard error, so the file **loads fine**; only §2.6's
`fails(entry) = fansOut(entry) ∧ ¬discriminable(entry)` fires, and only for that one
tracked entry's item class — every other class in the file ranks normally (AD-17's stated,
narrower consequence: "AD-17 excludes that one class from the ordering with a reason,
rather than the file being refused whole").

Both builders can point to binding text (§2.6's own two sentences contradict each other;
one half of the paragraph supports each builder). This is not a hypothetical construction
one level down — it is two readings of **one paragraph**, and the observable outcomes are
opposite: whole-dataset outage vs. one-class-excluded-with-a-reason.

**Fix direction:** §2.6 should not claim §10's "otherwise" is *itself* a file-level hard
error. It should say plainly that hitting "otherwise" is caught **only** by this
cross-file check (§2.6), for a class that needs a discriminator, and that
`WEIGHTS-FILE-SCHEMA.md`'s own hard error covers a narrower, purely syntactic failure (if
one is even reachable given "plain" is a negation — see the Medium finding below on
whether that hard error is vacuous). The "not redundant" framing needs a real second case
to be non-redundant with, and right now it does not have one.

---

## High — Arm 2's literal `"jewel"` test versus the schema's generalized "all-plain fan-out category" rule

**Where:** `IMPLEMENTATION-NOTES.md` §10.2 arm 2 (line 898: `className is under categoryId
"jewel"`) versus `WEIGHTS-FILE-SCHEMA.md` line 47 ("a `categoryId` whose classes are all
plain **(today: `jewel`)**") and line 221 (same parenthetical).

The schema's own phrasing — "today: `jewel`" — is a deliberate signal that the rule is
meant to generalize: *any* `categoryId` whose classes are all plain (not just the one
that happens to be `jewel` on the 2026-09-19 file) is structurally the shape that should
take the base-type derivation. `IMPLEMENTATION-NOTES.md` §10.2 does not implement the
general rule — it hardcodes the literal string `"jewel"`.

**The two-builder split.** Suppose a future patch (or a future weights regeneration) adds
a second all-plain, fan-out category — say a new `talisman` category with several plain
classNames, each a real base-type name, structurally identical to `jewel`'s shape today.
Builder A codes arm 2 exactly as §10.2 states it — a literal equality test against the
string `"jewel"`. For the new category, arm 2 does not match (`categoryId != "jewel"`),
arm 3 does not match (category fans out), so every one of that category's classes falls
to "otherwise" — an undiscriminability failure (or, per the Critical finding above,
possibly a whole-file refusal) for a category that is in fact exactly as discriminable as
`jewel` is today. Builder B codes arm 2 against `WEIGHTS-FILE-SCHEMA.md`'s general rule
("all classes under this `categoryId` are plain, and the category fans out") and derives
a correct base-type discriminator for the new category, exactly as for `jewel`. Both
builders can cite binding text for their reading — §10.2 for A, the schema's own change
table and field-rule prose for B — and they ship different search shapes (and different
rankability) for the identical new weights file.

**Fix direction:** §10.2 arm 2's guard should read "`className`'s `categoryId` fans out
and every class under it is plain" (mirroring the schema's own generalized condition),
not a literal `categoryId == "jewel"` check. `jewel` should be cited as the *measured
instance* of that condition today (as §10.3 already does), not as the condition itself.

---

## High — the jewel arm's catalogue-validation failure has no assigned consequence among AD-9 / AD-12 / AD-17's named buckets

**Where:** `ARCHITECTURE-SPINE.md` AD-25 (lines ~1495–1501: "sync validates that
**output** before building the search... an unvalidated derivation would send a search
for an item that does not exist"), cross-checked against AD-9 (lines 576–614, the
catalogue-validation table and its explicit exclusion of `className`), AD-12 (lines
824–844, "**Three** run-start gates"), and `IMPLEMENTATION-NOTES.md` §10.2 ("a load error
naming the class, never a search issued in hope").

AD-9's catalogue-validation table lists exactly two rows — tracked-list ids
(pre-request, per-entry, → `unresolvable`) and weights-file ids (at load, report-only) —
and explicitly states `className` has "no row here." AD-25 then introduces a **third**
catalogue-checkable thing: not `className` itself, but the jewel arm's **derived**
base-type string, which it says is "validated... before building the search," and calls
this "not a contradiction" of AD-9's exclusion.

That leaves the failure's timing and consequence unspecified:

- **Timing.** AD-12 enumerates exactly **three** run-start gates and is explicit about
  the count ("Three run-start gates stand in front of those three sources"). Is the
  jewel-arm catalogue check a fourth run-start gate (batch-checked for every jewel entry
  before any request is issued, alongside AD-9's catalogue gate), or is it a per-entry
  check performed **during** the chunk, immediately before that one entry's search is
  built (which is what "before building the search" most naturally reads as, and is
  consistent with AD-25 calling it something `sync` does while constructing one entry's
  query, not a batch pre-pass)? The two readings visit a different number of entries
  before the first failure is even detectable.
- **Consequence.** On failure, does `sync` (a) mark just that one entry `unresolvable`
  under AD-9's four-state model — plausible, since AD-25 says "Arm 2's output is a
  `baseTypeId` and is treated as one," and AD-9's `baseTypeId` row already prescribes
  `unresolvable` for exactly this shape of failure — and continue the chunk; or (b) treat
  it as a cross-file-gate-style failure and **abort the whole run non-zero**, which is the
  consequence AD-12 attaches to its three named gates and which `IMPLEMENTATION-NOTES.md`
  §10.2's own word choice ("load error") evokes?

**The two-builder split.** Builder A folds the jewel-arm catalogue check into AD-9's
existing `baseTypeId` handling: at run start (or lazily, per entry, same as any other
`baseTypeId`), a jewel entry whose derived base type is not in `items.json` is marked
`unresolvable`, `sync-report.json` records it, and the run continues pricing every other
entry — exactly AD-9's designed behavior for an id the trade API no longer recognises.
Builder B treats "load error" literally, as AD-12's cross-file gates are described: the
malformed jewel derivation invalidates the run's premise, so `sync` aborts non-zero before
spending any budget, and no entry in that chunk gets priced at all — a wildly more
disruptive outcome for the identical bad className. Neither reading contradicts any single
sentence in isolation; the spine simply never says which of AD-9's four states or AD-12's
gate semantics this new, revision-17-introduced check belongs to.

**Fix direction:** State explicitly, next to AD-25's catalogue-checkable derived value,
that a failure here is folded into AD-9's `unresolvable` state (treating the derived value
exactly as a `baseTypeId`, as AD-25 already half-argues) and specify whether the check
runs at AD-12's run-start batch pass or per-entry during the chunk. If it is meant to be a
whole-run abort instead, AD-12's "three run-start gates" count needs to become four (or
this needs to be folded explicitly into the existing cross-file gate's payload), and its
consequence table needs the same abort/commit/push treatment AD-12 gives its other gates.

---

## Medium — the defence-suffix grammar's family/letters split has no stated tokenization rule

**Where:** `WEIGHTS-FILE-SCHEMA.md` line 47/221 ("`<family>_<letters>`, where `<letters>`
is a `_`-separated non-repeating sequence... over `str` / `dex` / `int`"),
`IMPLEMENTATION-NOTES.md` §10.2 arm 1.

The grammar is prose, not a formal BNF/regex, and never states **how** to split
`<family>` from `<letters>` when the boundary is ambiguous — specifically, whether the
parser takes the **maximal** trailing run of underscore-separated tokens each drawn from
{`str`,`dex`,`int`} (greedy-from-the-right), or something narrower (e.g. only the single
final token). On the measured 59-class file this never bites, because every family root
(`Body_Armours`, `Boots`, `Gloves`, `Helmets`, `Shields`) is a token sequence that shares
no tokens with the three-letter alphabet, so any reasonable parser agrees. But the task's
own framing ("for every `className` in scope — not just the worked examples") and the
document's own habit of re-verifying arm totality on every regeneration (§10.4: "re-check
on a regeneration that adds a class or a modifier family") both anticipate the class list
growing. A `className` whose family root's last token happened to coincide with one of
`str`/`dex`/`int` (or a class with an unusually long letters run split across a family
boundary token) would let two builders — one taking a maximal trailing match, one taking a
minimal single-token match — derive different signatures from the same string, exactly
the byte-identical-derivation question the task lens asks about. This is lower severity
than the three above only because it does not currently manifest on the conforming file
and the fix is a one-line clarification ("take the maximal trailing run"), not a
structural change.

---

## Other areas checked, no finding

- **AD-9 / AD-6 unresolvable-id path swallowing the discriminator failure for the
  *grammar* case (arm-otherwise on a non-jewel path):** not reachable — AD-9 explicitly
  excludes `className` from its table, and the grammar failure's consequence (whichever
  of the Critical/High findings above resolves it) is a `weights.json`-level or
  cross-file-check-level event, not a per-entry catalogue check, so it cannot be
  conflated with AD-9's `unresolvable` state for the *syntactic* failure — only for the
  *derived-value* (jewel-arm) failure discussed above, which is a distinct and genuine
  gap already reported.
- **`fansOut`/`discriminable` predicates themselves (§2.6):** both are fully mechanical
  given a resolved `discriminator()` function — `fansOut` is a direct cardinality read of
  `weights.bases[categoryId]`, `discriminable` is "is `discriminator` defined." The
  ambiguity is entirely inside what `discriminator()` returns for the edge cases above,
  not in how §2.6 combines the two predicates.
- **Open questions (OQ-*):** re-read all of OQ-12, OQ-19 (closed), OQ-20 (closed), OQ-21,
  OQ-22 (closed), OQ-23 (closed), OQ-24 (closed), OQ-25 (closed). None is silently
  resolved incompatibly by two different ADs — the revision-17 closures (OQ-23, OQ-25)
  are internally consistent with AD-5/AD-16/AD-17's current text. OQ-21 and OQ-12 remain
  genuinely open and are not contradicted elsewhere. No stale OQ found.
- **AD-27 coverage measurement (§3):** `covered(cat)` and `rankable(cat)` are unaffected
  by the discriminator work and remain a direct two-rung lookup; no interaction found
  with the new class-discriminability check (§2.6 is a distinct, fifth check with its own
  denominator-free consequence, and does not feed AD-27's fraction).
- **AD-16's `jewel` arm emitting both `query.type` and `type_filters.category`:** verified
  against a captured live request (§5.1c) and stated as the one exception to trap 1; no
  divergence found between AD-5, AD-16 and §5.2's restated trap.
- **Underscore-to-space transform for the jewel arm's derived base type
  (`Time-Lost_Diamond → Time-Lost Diamond`):** consistent between AD-5's Consistency
  Conventions note and `IMPLEMENTATION-NOTES.md` §5.1c/§10.2; only underscores are
  replaced, hyphens are untouched, and both citations agree.
- **`AGENT-WORKFLOW.md`:** carries no independent statement of the discriminator
  derivation or the fifth cross-file check (it cites AD-27 by id only, per revision 16's
  fix to stop restating it), so it introduces no new divergence surface for revision 17's
  material. (Also not binding under AD-0 per the spine's own carve-out.)
