---
title: 'Reply — the crafted branch ranks Item Categories (OQ-23)'
status: reply
from: 'John (PM), session 2026-09-20'
to: 'Winston (architect)'
created: '2026-09-20'
answers: 'handover-oq23-class-altitude.md'
---

# Reply to Winston — PRD revision 17 is in

`prd.md` is at **revision 17** and carries the decision. The noun changes went in as you read
them, with one substitution you will want to know about before you write the spine revision.
Nothing in *What is settled and is not yours to re-open* was touched. No FR was added, removed
or renumbered; the document verifies clean at 33 contiguous FRs, no dangling FR reference,
every AD citation inside AD-0..AD-27, and 9 inline `[ASSUMPTION]` tags against 9 index entries.

## The three calls

### 1. The noun is **Item Category**, not Item Class

The player rejected *Item Class* on the ground you would have hit yourself a paragraph later:
`className` is a **poe2db** pool name, and a PRD noun spelled *class* would read as that key
while meaning the other half of the pair. The unit the player reads and the unit the search
sends are both the trade site's category, so the PRD uses that word.

- §3 defines **Item Category** and narrows **Base Type** to the raw branch.
- The glossary says plainly that the Weights File names the same unit in its own vocabulary
  and that this document does not adopt it. That sentence is deliberately thin — **the
  relationship between the two names is yours**, and the spine revision should state it where
  AD-5's entry key is settled. Right now a reader of both documents can see two words and no
  statement of how they relate.
- Display: a row names a category by its own name — *Bow* — and never prefixes it with the
  word *category*. That is a PRD-owned literal; the treatment is UX's.
- **Tracked Entry** is split into its two kinds, and I took your point about the stronger
  guarantee: the PRD now says the kinds are told apart by *what the entry names*, never by
  inferring craftedness from absent affixes. FR-3 gained a consequence saying the list carries
  two units and each row states which it names — that is the *stronger treatment than a label*
  you left to me, kept at requirement altitude with the rendering left to `EXPERIENCE.md`.

### 2. FR-4's coverage bands are **withdrawn**, not re-fitted

The player's call, and the more aggressive of the options I put up. Coverage survives as a
measurement: taken before any view work, re-measured on every regeneration, published in the
Sync Report with its denominator, predicates still cited to `IMPLEMENTATION-NOTES.md` §3. What
is gone is every threshold and the layout each bound. The reasoning is in `addendum.md` as a
further landing note on *BQ-3 — The unmeasured gate*, which is the analysis that produced the
bands: a threshold over dozens of categories measures the scraper's progress, not how much
product exists, which is the condition FR-4's own *~20* note already called advisory.

**This is the one place my edit breaks something of yours, and I could not fix it from here:**

- **AD-27 carries its own copy of the band table** (*"The result binds, once a file is
  present"*). It is now a layout rule with no product decision behind it. The memlog records
  the bands entering AD-27 *from* the PRD, so the table should come out with them; the rest of
  AD-27 — the measurement, its sequencing, the tracked-list denominator, the absent-file
  carve-out, the report-with-denominator rule — is untouched by this and should stay.
- **`AGENT-WORKFLOW.md` step 2 carries the escalate-below-50% rule.** Day one now tells a
  builder to escalate against a threshold no document owns. This is the second time that line
  has gone stale against AD-27 — the rev-13 gate caught the absent-file case — which is an
  argument for step 2 citing AD-27 rather than restating it.
- AD-27's closing sentence, *"What size makes the bands advisory is a product judgement the
  PRD owns (FR-4)"*, has no referent once the bands are gone. If you want the spine to keep a
  hook for a future re-decision, say so and I will carry a named open question instead; I did
  not open one, because an OQ with no candidate answers is a placeholder, not a question.

### 3. The category-average payout landed as an **FR-1 consequence**

Not a risk. §9 holds threats the product has not closed; this is a property the product chose,
and the player confirmed it. FR-1 now states that a crafted row's payout term describes the
category rather than any one base in it, that a strong base is understated and a weak one
overstated, and that the probability term carries no such spread — marked *(PRD-owned)*, cited
to AD-16 and AD-17, with the rationale in `addendum.md`. The addendum also records the two
facts the PRD does not carry: it compounds with R-1 in the same direction, and it has an
identified, deliberately unspent remedy — tracking a category's strong bases as raw entries
already prices them honestly on the other branch.

## One thing I changed that you called dead, and why

You wrote that `"base absent from weights file"` describes a lookup that no longer happens. I
kept two reason strings and renamed the second to **`"category absent from weights file"`**
rather than collapsing the enum to `"pool partial"` alone.

The reasoning is FR-9's, not stubbornness: *the producer declared a pool it could not
guarantee* and *the producer published nothing for this category at all* are different facts
about different people's work, and this document's standing position is that one state
covering unrelated causes defeats the point of having states. A curator who tracks a category
the scraper has not reached yet should not read *pool partial*.

**If the architecture genuinely cannot distinguish the two once pools are keyed per category,
say so and I will collapse the enum to one member in a one-line revision.** I would rather be
corrected than have you write the spine against a string that cannot be produced.

## A small one you did not list

AD-27's denominator carve-out — *counts only bases that need a pool* — looks **vacuous** now.
It existed to keep a raw-base-only entry from giving the Unrankable group prominence it had
not earned. Once a raw entry names a Base Type and a crafted entry names a category, every
tracked category needs a pool by construction and nothing can fall through the carve-out.
FR-4 now reads *the share of tracked Item Categories with a complete pool*; `IMPLEMENTATION-
NOTES.md` §3 should drop the qualifier or say what still falls outside it, and I would rather
you confirm which than have the PRD and §3 differ by a clause.

## What is now yours

Unchanged from your *What happens after you*, plus the two orphans in §2 above. For the record,
your independent finding about `covered(base)` having had no computable meaning since `5.0.0`
needs nothing from me and is unaffected by any of this.

`PRODUCT.md` has been refreshed in the same pass, since nothing detects its drift.
