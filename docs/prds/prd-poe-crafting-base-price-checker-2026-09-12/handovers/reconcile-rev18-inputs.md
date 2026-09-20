---
title: 'Reconciliation — PRD revision 18 against its inputs'
status: review
created: '2026-09-20'
reconciles:
  - handover-oq23-class-altitude.md
  - reply-oq23-class-altitude.md
  - reply-rev18-class-altitude.md
  - prd.md (revision 18)
  - addendum.md
---

# Reconciliation — what revision 18 claims, and what `prd.md` carries

Method: each claim in the two replies and each item in the architect's handover was checked
against `prd.md` at revision 18 by literal text. Verdicts are **delivered**, **gap** or
**note**. Line numbers are `prd.md`'s at the time of this check.

## 1. Does `prd.md` deliver what `reply-rev18-class-altitude.md` claims?

The reply makes three substantive claims (§3 of the reply) plus a set of verification claims.

### 1.1 §3 — *`Item Class` is redefined, not renamed* — **delivered**

`prd.md` L71 carries all three components the reply promises:

- redefinition away from the trade site's sorting: *"one of the classes of item the game
  distinguishes, and the unit the tool's crafted branch ranks"* — no trade-site reference
  remains;
- the finest-unit statement: *"It is the finest unit the crafted branch values: a class holds
  several Base Types, and the branch does not descend to them (FR-1)"*;
- the revision-17 sentence about the Weights File naming the same unit in its own vocabulary
  is **gone**, as the reply says it is (§1 of the reply). Confirmed absent from L71 and from
  the whole of §3.

### 1.2 FR-1 gains a consequence — **delivered**

`prd.md` L128: *"**No base outside the class contributes to that price** *(PRD-owned)*. A class
is valued against its own bases alone, so a class the player would never craft on cannot pull a
class he would toward it, in either direction. The spread above is therefore bounded by one
class, and the ranking distinguishes two classes that a coarser unit would have averaged into
one row (AD-16, AD-17)."*

The reply also claims the existing accepted-spread consequence is **narrowed, not withdrawn**.
Confirmed at L127: the spread survives, scoped to *"every Base Type in the class"*, with the
probability term still exempt and the property still marked as chosen rather than defective.
The two bullets are mutually consistent: L127 bounds the spread inside a class, L128 bounds the
price sample to the class.

### 1.3 FR-4's second reason string — **delivered**

`prd.md` L161 prints the enum verbatim as `"pool partial"` and `"class absent from weights
file"`, marked *(PRD-owned)*, with FR-9's no-collapsing argument carried over. The standing
offer to collapse the enum lives in the reply and the addendum, not in `prd.md`, which is
correct: it is a question to the spine, not a player-visible fact.

### 1.4 The reply's verification claims — **all delivered**

| Claim | Verdict |
|---|---|
| 33 contiguous FRs, none added, removed or renumbered | FR-1..FR-33 present and contiguous |
| No dangling FR reference | every cited FR id resolves |
| Every AD citation inside AD-0..AD-27 | highest id cited is AD-27 |
| **10** inline `[ASSUMPTION]` tags against 10 index entries | 10 inline (§3 Item Class, FR-2 ×2, FR-3, FR-5, FR-7, FR-11, FR-26, FR-29, NFR-10); §11 lists the same 10 in document order |
| The new tag is new rather than moved | §3 / Item Class has no antecedent at revision 17 |
| The PRD carries **no** *category* noun at all | confirmed — no occurrence of "category"/"categories" anywhere in `prd.md` |
| FR-4's coverage bands stay withdrawn | L164 states coverage is *"reported, not a gate"*, no threshold, no layout bound |

**Conclusion: no claim in the reply is unsupported by the document.** There is no critical
finding of the kind the brief asked to look for.

## 2. The handover's §3 term sweep

The handover named seven terms needing re-pointing, plus two that keep their meaning.

| Term | `prd.md` L | Now points at | Verdict |
|---|---|---|---|
| Combination | 80 | *"this Item Class carrying this prefix and this suffix"* | delivered |
| Chase Combination | 81 | *"the Combinations on an Item Class that contribute most to its EV"* | delivered |
| Item Level Floor | 83 | *"Crafted entries on one Item Class share one floor; a Raw Base at 82 is exempt"* | delivered |
| Expected Value (EV) | 93 | *"threshold-truncated expected payout of an Item Class"* | delivered |
| Modifier Weight | 95 | *"one tier of one modifier in one Item Class and affix slot"* | delivered |
| Eligible Pool | 98 | *"can roll in one Item Class and slot"*; *"makes its Item Class Unrankable"* | delivered |
| Unrankable | 100 | *"an Item Class the tool excludes from the ordering"* | delivered |
| Raw Base (unchanged) | 79 | raw Tracked Entry, il82 white base | correctly unchanged |
| Base Type (narrowed) | 72 | *"A Base Type is what the **raw** branch ranks (FR-3)"* | delivered |

**Nothing is still pointing at a Base Type that should not be.** Every surviving *Base Type*
occurrence in the document is legitimately about the raw branch or about the class/base
relation itself:

- L33, L35, L43, L60 — raw branch prose in §1/§2.1/UJ-1, paired with Item Classes;
- L71 — *"a class holds several Base Types"* (the relation, deliberate);
- L72, L76 — the glossary's raw-branch definitions;
- L127 — the within-class spread, which is **about** the bases inside a class;
- L145, L148, L160 — FR-3 and FR-4's raw-branch statements;
- L395, L397 — FR-24, which resolves a raw entry's Base Type id against the Trade Catalogue;
- L560 — §7.1 *"One ranked list of Item Classes and raw Base Types"*;
- L598 — SM-2.

Also delivered, from handover §1's second paragraph: **Tracked Entry** (L74–78) is split into
its two kinds, and the stronger guarantee is stated plainly — *"The two kinds are told apart by
**what the entry names**, never by craftedness inferred from absent affixes"* (L78).

## 3. The handover's FR, journey, metric and scope sweep

| Handover item | `prd.md` | Verdict |
|---|---|---|
| FR-1 subject → class; Craft Cost once per class; load refusal on two entries per class | L113–131 (L124, L131) | delivered |
| FR-2 chase combos on a class row | L133–141 | delivered |
| FR-3 stronger than a label | L148 — *"The two branches rank **different units** … each row states which unit it names"* | delivered |
| FR-4 unrankability on the class; reason enum | L154–164 | delivered |
| FR-22 *"every crafted entry on an Item Class shares that one floor"* | L380 | delivered |
| UJ-1 (*"top five Base Types"*) | L60 — *"Item Classes to craft on, Base Types to sell raw"* | delivered |
| UJ-2 | L61 — no unit noun; correctly untouched | n/a |
| UJ-3 | L62 — *"an unfamiliar Item Class"* | delivered |
| UJ-4 | L63 — *"a row"*; no unit noun to move | n/a |
| UJ-5 the curation pass | L64 — *"against each Item Class"* | delivered |
| SM-2 | L598 — *"chase Item Classes and Base Types"* | delivered |
| Scope prose (*"Magic Base Types"*; handover called it §9, now §7.1) | L558 — *"tracked per Item Class"*; L560 | delivered |
| Dependencies (*"every crafted Base Type is Unrankable"*; handover called it §10, now §7.3) | L587, L590 — *"every Item Class is Unrankable"*, *"freshly scraped Item Classes"* | delivered |

**Nothing from the handover's list was missed.** The two section numbers the handover cites
(§9 scope, §10 dependencies) have since moved to §7.1 and §7.3; the content is present under
the new numbers, so this is a numbering drift in the handover, not an omission in the PRD.

Also carried and verified: FR-2's revision-17 addition, and revision 17's PRD-owned display
literal — L71, *"The view names a class by its own name — *Bow* — and never prefixes it with
the word *class*"* — which survived the noun reversal with the word swapped.

## 4. Mechanism leak check — **clean**

Searched `prd.md` for: `defence` / `defense`, `signature`, `query.type`, `type_filters`,
`className`, `categoryId`, `baseTypeId`, `weights.json`, `poe2db`, `jewel`, `filter`, and
every weights-file key shape. Findings:

- **No** occurrence of `query.type`, `type_filters`, `className`, `categoryId`, `baseTypeId`,
  `weights.json`, `poe2db`, `jewel`, "defence signature", "stat filter" as a search shape, or
  any weights-file key. The whole of `reply-rev18-class-altitude.md` §2 — the defence-signature
  argument, the six fan-out categories, the 36 classes, the subset enumeration, the two jewel
  options — stayed out of `prd.md` and landed in `addendum.md` §*Revision 18 rationale*, which
  is where `AGENTS.md` puts it.
- FR-21 (L365–372) states the price *method* at the altitude it always had — *"one search and
  one fetch"*, *"the median of the cheapest live instant-buyout listings"* — and delegates the
  search's construction to `IMPLEMENTATION-NOTES.md` §5.2 by citation. Unchanged by this
  revision and not a new leak.

**One borderline item, recorded as a note rather than a finding.** §3's new `[ASSUMPTION]`
(L71, repeated at L645) reads:

> *"Where several classes of one broad kind differ only in defence type, the name may read as
> source vocabulary rather than the player's; that is a display fix in `EXPERIENCE.md`, never a
> change of unit."*

This is the only place the word *defence* appears in the PRD. It is a statement about what a
class **name** looks like to a reader, not about how a search isolates a class, so it does not
disclose the defence-signature filter or any field. It is nevertheless the one sentence in
`prd.md` whose wording was chosen because of a mechanism decided elsewhere. If the spine's
naming settles differently, this sentence is the one to re-read. Acceptable as written; flagged
so that a later reviewer does not mistake it for a leak or widen it into one.

## 5. Facts in the reply or addendum that did not reach the PRD

### 5.1 FR-1's absolute guarantee has an unstated dependency, and nothing in the PRD tracks it — **gap, medium**

This is the one finding worth the architect's attention.

`prd.md` L128 states without qualification that **no base outside the class contributes to a
crafted row's price**. `reply-rev18-class-altitude.md` §2 is explicit that this guarantee is
only free-standing if the spine chooses jewel option 1 (`query.type`):

> *"Option 2 discriminates *usually*, not *always*: where two jewel classes share a tracked
> modifier it admits both. … Choosing option 2 deliberately would make the PRD's guarantee
> false for `jewel`, and that is a PRD revision you should ask me for rather than absorb
> quietly."*

The addendum repeats it (*"where a product guarantee selects a mechanism"*). `prd.md` carries
neither the qualification nor a tracking id: §10 *Open Questions* lists OQ-12, OQ-19, OQ-20,
OQ-21, OQ-6 and OQ-7 and has no entry for this, and OQ-25 is closed with no successor by the
same reply.

The PM's reasoning for not carrying it is sound at the PRD's altitude — the tolerance is a
mechanism property, and writing it in would either add mechanism or weaken a guarantee that is
in fact satisfiable. But the result is that **a PRD-owned absolute, and the only PRD sentence
that constrains a spine choice, is enforced solely by a paragraph in a handover reply that no
document cites.** If the spine takes option 2, nothing in the PRD, the spine or the addendum's
index will fire.

Not a defect in what revision 18 says. A gap in what survives the handover being archived. The
cheapest repair is one sentence in the spine, where AD-16's crafted query shape is settled,
citing FR-1's consequence as the constraint that rules option 2 out — which is what the reply
asks for and which the PRD cannot do for itself.

### 5.2 The unspent remedy is rationale-only — **note, low**

Both replies and the addendum (L224, L262) record that a class's strong bases can be tracked as
separate **raw** entries, which prices them honestly on the other branch. It is described as
*"identified and still deliberately unspent"*. `prd.md` does not carry it: FR-1 L127 states the
within-class spread as an accepted property and stops there, and §7.2 does not list the remedy
among the deferred items.

This is defensible — it is a curation technique, not a product capability, and the PRD's §7.2
holds things the product might later do rather than things the curator may already do today.
Recorded because it is the only player-**actionable** fact in the rationale store that the PRD
does not reflect, and because a curator reading FR-1's accepted spread has no pointer to the
one move that escapes it. If it is ever wanted in the document, it belongs as a line in §7.2 or
as a sentence on FR-22's curation rule, not on FR-1.

### 5.3 The `Bow` display example is a revision-17 artefact — **note, low**

L71's display literal uses *Bow*. It was chosen at category altitude and happens to survive the
move, because `weapon.bow` holds exactly one class. It therefore illustrates the rule without
exercising the new `[ASSUMPTION]` two sentences later, which is about classes of one broad kind
that differ only in defence type. The example is not wrong; an example drawn from a fan-out
family would carry more of the sentence's weight. Purely editorial.

### 5.4 Checked and correctly absent

- **OQ-25's closure, the six fan-out categories, the 36-class count, the subset enumeration**
  — spine-owned, correctly nowhere in `prd.md`.
- **The struck-down objection about modifiers granting defences** — mechanism; correctly in the
  addendum only. Its PRD-side anchor, FR-29's load-time rejection (L466), already existed and
  needed no edit, exactly as the reply says.
- **AD-5's entry-key relationship sentence** — the reply hands this to the spine; the PRD is
  right not to state it, since it would be a field-level fact.
- **AD-27's orphaned band table and `AGENT-WORKFLOW.md` step 2's escalate-below-50% rule** —
  raised at revision 17 (`reply-oq23-class-altitude.md` §2) and still outstanding against the
  spine, not against the PRD. Out of this reconciliation's scope but not yet closed.

## 6. Verdict

Revision 18 delivers every claim its reply makes and every item the architect's handover
listed, adds no mechanism, and leaves the noun sweep complete with no stale Base Type. The one
thing it silently drops is not a sentence but a **dependency**: FR-1's absolute price guarantee
rests on a spine choice that only an archived reply records (§5.1).
