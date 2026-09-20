---
title: 'Handover — the crafted branch moves to class altitude (OQ-23)'
status: handover
from: 'Winston (architect), session 2026-09-20'
to: 'John (PM)'
created: '2026-09-20'
---

# Handover to John — the crafted branch ranks item classes, not Base Types

> **How to run this.** Start a session with the `bmad-agent-pm` skill and give John this
> file. It is a brief, not a patch: every call below is the PRD's to make. Where it names a
> specific edit, that is the architect's reading of what follows from the decision — argue
> with it if the product says otherwise, and say so in the reply, because the spine revision
> is written against whatever the PRD settles.

## The decision, in one paragraph

Spine **OQ-23** asked where a crafted base's item class is declared, so the base could reach
its modifier pool. The question dissolved rather than resolving: the player (2026-09-20)
confirmed that **modifier combinations are curated and checked per item class, not per named
base**. A named base — *Guardian Bow* — is tracked only as an uncrafted item priced as it
comes. So the crafted branch and the raw branch name different things and never need to meet,
and the `baseTypeId → className` mapping the OQ was hunting is never needed by anything.

**This changes what the player gets**, which is why it reaches the PRD before the spine.
The ranked list's crafted rows stop being Base Types and become item classes. The raw rows
stay Base Types. One list, two units.

## What is settled and is not yours to re-open

These are mechanism, and the spine will carry them once the PRD lands. They are here so you
can see the decision is real, not so you restate any of it in `prd.md`:

- A crafted tracked entry names a pool, and a pool's name is the pair `(categoryId,
  className)` — the same key `WEIGHTS-FILE-SCHEMA.md` already uses. `categoryId` is trade
  vocabulary and is what the search sends; `className` is a poe2db pool name the trade site
  does not accept. Both are needed and neither suffices alone.
- A raw tracked entry still names a `baseTypeId`, exactly as today.
- The crafted search becomes a category search; the raw search stays a base-type search.
- No new artifact, no new committed mapping file, no weights-file schema change.

## What is yours, and what I think follows

### 1. A new glossary noun, and a split in an old one

§3 has no term for the crafted unit. It needs one — the spine will call the key
`(categoryId, className)`, but the PRD needs a player-facing noun (*Item Class*, or whatever
reads right beside *Base Type*). **Base Type stays**, now meaning only what the raw branch
ranks.

**Tracked Entry** (§3) is defined as *"a Base Type, an optional prefix Modifier Reference,
an optional suffix Modifier Reference…"*. That is now two kinds of thing with two different
first members. Note that today the raw/crafted distinction is **inferred** from both affixes
being absent (*Raw Base*, §3); after this change the two are distinguishable by what the
entry names, which is a stronger guarantee and worth saying plainly.

Every §3 term whose definition says *"Base Type"* needs re-pointing at whichever unit it
actually describes. By my count: **Combination**, **Chase Combination**, **Item Level
Floor**, **Expected Value**, **Modifier Weight**, **Eligible Pool**, **Unrankable**. *Raw
Base* and *Base Type* keep their current meaning.

### 2. FR-1, FR-2, FR-4, FR-22 change their subject

- **FR-1** — *"Rank Base Types by threshold-truncated expected value"*. The crafted ranking's
  subject becomes the item class. The EV formula itself is unchanged (it is the one formula
  the PRD owns), but *"Craft Cost is subtracted once per Base Type, not once per
  Combination"* becomes once per item class. Same for the load-time refusal in the last
  consequence: *"two Tracked Entries on one Base Type"* becomes on one item class.
- **FR-2** — Chase Combinations are the combinations worth chasing on a class row.
- **FR-3** — substantively unchanged, and **more load-bearing than before**. It already
  requires the raw branch to be visibly labelled; now the two branches differ in *unit*, not
  only in how they are valued. Whether that needs a stronger treatment than a label is
  yours, and UX's to render (`EXPERIENCE.md` owns the treatment).
- **FR-4** — Unrankability moves to the class. Both reason strings are PRD-owned literals and
  one of them is now wrong: `"base absent from weights file"` describes a lookup that no
  longer happens. `"pool partial"` still reads correctly.
- **FR-22** — *"every crafted entry on a Base Type shares that one floor"* becomes per class.

### 3. The one place this needs a fresh product judgement

**FR-4's coverage bands sit on a denominator that just shrank by an order of magnitude.**
Coverage was the share of *tracked Base Types* needing a pool — hundreds. It is now the share
of *tracked item classes* — the game has 63, and the spine records that 53 of 63 carry the
relevant modifier configuration. The addendum's own note (§4.1 / FR-4) pegs **~20** as the
size below which a fraction stops saying anything about the product.

So the three bands at 80% and 50% may now be measuring a list small enough that the fraction
is advisory in the normal case rather than the edge case. AD-27 already requires the
denominator to be published beside the fraction, which helps, but the band thresholds
themselves are *(PRD-owned)* and I do not think they survive this unexamined. **Please
re-decide them, or state explicitly that they stand.**

### 4. An accepted cost that should be written down

A category search prices the cheapest listings across **every base in the class**, so a
Guardian Bow and a Shortbow carrying the same affixes land in one sample. The probability
term stays exactly right — the modifier pool genuinely is the class's — but the payout term
becomes a class average rather than a specific base's price. A strong base within a class is
therefore understated and a weak one overstated.

**The player confirmed this is intended** (2026-09-20): you craft on whatever the class
gives you, so the class is the real decision unit. It is still a property of the number the
player reads, so it belongs in the PRD — as an accepted cost or a risk, your call on which —
with the rationale in `addendum.md`.

### 5. Journeys, metrics and scope prose

- **UJ-1 – UJ-4** all read *"Base Types"* where they now mean a mixed list. UJ-1's *"top
  five Base Types"* is the one that most needs rewording.
- **UJ-5**, the curation pass, is where the change is most visible to the player-as-curator:
  he is now curating combinations against classes.
- **SM-2** — *"stops keeping a list of chase bases in his head"* — still true, arguably more
  so, but the noun moved.
- **§9 scope** — *"Magic Base Types — one prefix, one suffix"*.
- **§10 dependencies** — the Weights File entry says *"every crafted Base Type is
  Unrankable"* during the day-one phase; same noun swap.

## Things to be careful about

- **Do not add mechanism.** Per `AGENTS.md`, the PRD owns what the player gets; formulas,
  predicates, field names and query shapes belong to the spine and its companions. If a
  change seems to need one, cite the id instead — that is a finding, not an edit.
- **Cite AD ids freely; they are stable.** AD-5, AD-11, AD-16, AD-17, AD-25 and AD-27 all
  keep their ids and keep owning what they own. The spine text behind them will be revised
  after you land, so write against the ids and not against today's wording.
- **`IMPLEMENTATION-NOTES.md` §3's coverage predicates will be rewritten** as part of the
  spine revision. FR-4's citation of them stays valid.
- **`PRODUCT.md` is a distillation of `prd.md`** and nothing detects drift. It will need a
  refresh once this lands.

## What happens after you

Return the PRD revision and a short note on the three calls above — the new noun, the FR-4
bands, and where the class-average cost landed. The spine revision follows and covers AD-5's
entry key, AD-16's query table gaining a crafted branch, AD-27's unit, `IMPLEMENTATION-NOTES.md`
§3, §4.1, §5.2 trap 1 and §8, and `WEIGHTS-FILE-SCHEMA.md`'s note about the uncheckable inner
rung. **OQ-23 closes with that revision**, recorded as *premise withdrawn* rather than
answered, since none of its three candidates was chosen.

One further finding for the record, independent of this change: `IMPLEMENTATION-NOTES.md`
§3 currently defines `covered(base)` as *"base is PRESENT in weights.json"*, which was
written against `4.x`'s single-level per-base key and has had no computable meaning since
`5.0.0` went two-level. The spine revision fixes it. It needs nothing from you.
