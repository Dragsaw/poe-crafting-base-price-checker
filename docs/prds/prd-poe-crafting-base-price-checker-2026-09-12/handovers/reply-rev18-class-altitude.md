---
title: 'Reply — the crafted branch ranks Item Classes (PRD revision 18)'
status: reply
from: 'John (PM), session 2026-09-20'
to: 'Winston (architect)'
created: '2026-09-20'
supersedes: 'reply-oq23-class-altitude.md'
---

# Reply to Winston — revision 17 is overruled, revision 18 is in

Read this before you write the spine revision you were about to write. `prd.md` is now at
**revision 18** and the crafted branch's ranked unit is the **Item Class**, one level finer
than the Item Category revision 17 landed a few hours earlier. The player made the call
directly; I put the alternatives up and he chose this one on the merits.

The document verifies clean: 33 contiguous FRs, no FR added, removed or renumbered, no
dangling FR reference, every AD citation inside AD-0..AD-27, and **10** inline `[ASSUMPTION]`
tags against 10 index entries — one more than revision 17, and it is new rather than moved
(see §4). Nothing in your original *What is settled and is not yours to re-open* is touched
except the unit itself, which the player moved.

## 1. Why the noun reversed

Revision 17 chose *Item Category* on your vocabulary argument, and I still think that argument
is correct as far as it goes. It lost to a product argument, which in this document outranks
it: **expected value varies sharply between the classes inside one category**, so a blended
category row lets a low-value class drag a high-value one down and hides both. A row that
averages two classes the player treats differently is not a ranking of a decision he makes.

The vocabulary problem you raised has not gone away — it has moved to you, and it is now
smaller. The PRD names the player-facing unit **Item Class**; you key it. §3's glossary entry
no longer says the Weights File names the same unit in its own vocabulary, because the PRD has
in effect adopted the finer half of your `(categoryId, className)` pair. **State the
relationship where AD-5's entry key is settled.** A reader of both documents should not have to
infer whether the PRD's *Item Class* is your `className` alone or the pair.

## 2. OQ-25 closes on its second candidate, and the premise you recorded was wrong

This is the part that changes your work most, so it leads. The short version: the mitigation
you recorded as incidental is in fact exact, in all six fan-out categories, at no extra search.

You recorded OQ-25's mitigation as *incidental rather than designed* and its candidates as:
accept it, add a class-discriminating filter **if the trade API turns out to offer one**, or
price per base type at the budget cost that moving to category altitude just saved. I costed
the change to the player on the third candidate. **He corrected me, and he is right.**

A class **is** reachable on the existing search, by its **defence signature**. The classes of
one broad kind differ in which defences their bases carry, so a filter can admit one class and
exclude its siblings without ever naming a class:

- `Body Armour (dex)` — min evasion 1, max energy shield 0, max armour 0
- `Body Armour (dex_int)` — min evasion 1, min energy shield 1, max armour 0

So the crafted branch still spends **one search per tracked entry**. There is no budget
increase, and the third candidate is not needed. **OQ-25 closes on candidate two.** The
spread it described — the probability term being one class's while the price spanned six —
is eliminated rather than accepted.

The exact filter fields and their spelling are yours; the PRD says only that no base outside
the class contributes to a crafted row's price (FR-1, new consequence, *(PRD-owned)*).

### Why the obvious objection to that filter does not hold

I raised one and the player struck it down; it is recorded here so you do not raise it again.
The objection was that modifiers grant defences too, so a `Body Armour (dex)` that rolled a
flat energy-shield prefix would have energy shield above zero and be excluded by
`max energy shield 0` — the class filter contradicting the Combination's own stat filters.

**It cannot happen.** The defence type *is* what determines the rollable pool, and that is
exactly what the Weights File's inner rung encodes: `bases["armour.chest"]["Body_Armours_dex"]`
is the set of modifiers a dex chest can roll, and no energy-shield modifier is in it. A curator
cannot author the contradictory entry, and if one were authored anyway, **FR-29 already rejects
it at load with the offending entry named** rather than ranking it on a guess. The filter and
the pool agree by construction. No new requirement is needed to make that true.

### Where the defence signature does *not* reach: `jewel`

Measured against `data/weights.json` (`5.0.0`, patch `0.5.5`), the fan-out is 6 categories over
36 classes, and the defence signature is a **complete** discriminator for five of them — not
merely a usually-sufficient one. The armour classes of a family are exactly the distinct
non-empty subsets of {armour, evasion, energy shield}:

- `armour.chest` — 7 classes, which is all seven subsets
- `armour.boots` / `armour.gloves` / `armour.helmet` — 6 each, the seven less the triple
- `armour.shield` — 3, all containing armour

So every class in those families has a defence triple no sibling shares, and one search
separates it exactly. That is a stronger result than *the stat filters usually exclude the
siblings incidentally*, which is how OQ-25 recorded the mitigation.

**The sixth category is `jewel`, whose 8 classes** — `Diamond`, `Emerald`, `Ruby`, `Sapphire`
and their four `Time-Lost` counterparts — **carry no defences.** I put this up as OQ-25's
residue. It is not one; the player closed it two ways on 2026-09-20, and **either satisfies the
budget at one search per class**:

1. **`query.type`.** The jewel class names are base names, so the filter the raw branch already
   uses isolates a jewel class exactly. The player confirmed this works.
2. **The pool is its own discriminator.** For jewels the modifiers *are* the identifying
   property — the classes differ in what they can roll, so a Combination's own stat filters
   separate them without any class filter at all.

**Prefer (1), and here is the constraint that decides it.** Option 2 discriminates *usually*,
not *always*: where two jewel classes share a tracked modifier it admits both. The player's
position is that such overlap is acceptable, because the shared modifiers are the low-value
ones a curator would not track. I have not written that tolerance into `prd.md`, because
**FR-1's new consequence is absolute** — *no base outside the class contributes to that price*
— and option 1 satisfies it at no extra cost. Choosing option 2 deliberately would make the
PRD's guarantee false for `jewel`, and that is a PRD revision you should ask me for rather
than absorb quietly. Option 2 is the fallback if (1) turns out not to hold, not the default.

**OQ-25 therefore closes with no successor**, on candidate two, across all six fan-out
categories. I have added it to `prd.md` §10 in the meantime, by id and owner as that section
requires, because it is open today and FR-1's guarantee depends on how you land it. Drop it
from §10 when you close it.

### This reintroduces a lookup your handover was glad to be rid of

Your OQ-23 handover recorded as a settled win that **no `baseTypeId → className` mapping exists
anywhere in the system** — no field on a tracked entry, no `baseTypes: []` beside a pool, no
committed artifact, no schema change. Revision 18 does not bring that mapping back, and I am
not asking you to.

It does need a different one. A crafted entry now names an **Item Class**, and the search needs
that class's **defence signature** — and the class name does not carry it. `Body_Armours_dex`
implies min evasion / max armour 0 / max energy shield 0 only to a reader who already knows the
convention. Something in the system has to turn one into the other, and I do not think any
existing artifact publishes it: the Weights File carries modifiers rather than defences, and I
do not know whether the Trade Catalogue exposes a class's defence type at all. The jewel arm
needs its own variant of the same thing, `className → base type name`.

So the question the handover closed reopens one rung over: **where does `className → defence
signature` live, who writes it, and what happens to it on a patch?** It is AD-5, AD-16 and
AD-25 between them. It may be small — a convention parsed from the class name is a legitimate
answer — but it should be a decision rather than an implementation detail discovered later,
because it is the one input the crafted search needs that no artifact currently supplies.

**One PRD consequence follows, and I have already applied it.** FR-21 carried the bullet *"The
search is built from the Tracked Entry alone"*. That was true while an entry named a trade
category, which was itself the filter value. It is not true now, and it was mechanism the PRD
should not have been restating in the first place. It is replaced by the product requirement —
a crafted entry's search prices its Item Class alone, a raw entry's its Base Type alone — with
the construction cited to AD-16 and §5.2 rather than restated.

## 3. What moved in `prd.md`

The noun sweep, and nothing else structural. Every *Item Category* is now *Item Class* across
§1, §2.1, UJ-1/UJ-3/UJ-5, §3, FR-1, FR-2, FR-3, FR-4, FR-8, FR-10, FR-11, FR-16, FR-22, FR-26,
FR-28, FR-30, FR-33, §7.1, §7.3, SM-2 and §11. The PRD now carries **no** *category* noun at
all, which is worth knowing if you were expecting one to survive for the search side.

Three substantive edits:

- **§3 — `Item Class` is redefined**, not renamed. It no longer defines itself by reference to
  how the trade site sorts items, because the unit is no longer the trade site's. It now says
  it is the finest unit the crafted branch values, and that a class holds several Base Types the
  branch does not descend to.
- **FR-1 gains a consequence** *(PRD-owned)*: no base outside the class contributes to a crafted
  row's price, so a class the player would never craft on cannot move one he would. The existing
  accepted-spread consequence is **narrowed, not withdrawn** — inside a class the Base Types
  still differ, a strong base is still understated, and that is still the player's deliberate
  choice per your original §4.
- **FR-4's second reason string is now `"class absent from weights file"`** *(PRD-owned
  literal)*. The enum keeps two members for the reason given in the last reply, unchanged: a
  producer that declared what it could not guarantee and a producer that published nothing are
  different facts. My standing offer stands too — if pools cannot distinguish the two once
  keyed per class, say so and I collapse it in a one-line revision.

FR-4's coverage bands stay withdrawn. The denominator moved from tracked categories to tracked
classes and stayed in the same order of magnitude, so revision 14's reasoning is untouched and
there is nothing here to re-decide.

## 4. The one new assumption

§3 carries a new `[ASSUMPTION]`: that **a class's own name is already what the player calls
it**. Where several classes of one broad kind differ only in defence type, the class's name may
read as source vocabulary rather than the player's — the same objection you raised against
*Item Class* as a noun, arriving now as a display question instead of a modelling one. I have
written it as a label problem for `EXPERIENCE.md`, never a reason to coarsen the unit. Sally
owns the treatment; flag it if the spine's naming makes it worse than I have assumed.

## 5. What is now yours

Unchanged from your original *What happens after you*, with the unit one level finer
throughout, plus:

- **AD-16's crafted query shape** — no longer `type_filters.category` alone. It needs whatever
  carries the defence signature, and a second shape for `jewel` (§2).
- **AD-5's entry key** — plus the sentence saying how the PRD's *Item Class* relates to
  `(categoryId, className)`.
- **`className → defence signature`** — where it lives, who writes it, what a patch does to it
  (§2). The one input the crafted search needs that no artifact supplies today.
- **AD-27's unit and `IMPLEMENTATION-NOTES.md` §3** — coverage counts tracked classes. Your
  independent `covered(base)` finding is unaffected.
- **OQ-25** — close it as **answered** on candidate two, across all six fan-out categories,
  with no successor. The spread it described is eliminated rather than accepted.
- **OQ-23** — still closes as *premise withdrawn*; the premise it withdrew is the same one.

`PRODUCT.md` has been refreshed in the same pass. Rationale for all of the above, including
why revision 17's vocabulary argument is kept on the record rather than deleted, is in
`addendum.md` under *Revision 18 rationale*.
