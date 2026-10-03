---
title: 'Implementation Notes'
type: architecture-companion
status: final
binding: true
created: '2026-09-19'
updated: '2026-10-02'
governed_by: ARCHITECTURE-SPINE.md
---

# Implementation Notes

**This file is binding, not advisory.** `ARCHITECTURE-SPINE.md` AD-0 makes every section
here that an AD cites by name carry the force of the AD that cites it. A builder may not
treat an item in this file as a suggestion because it is not spelled out in the spine —
that is precisely the split revision 10 chose, and it only works if both halves bind.

**What it is.** The arithmetic, the encodings and the field-level evidence that spine
revision 10 moved out of itself. The spine states *what must not diverge*; this file states
*how to compute it*. Every item names the AD it serves.

**Precedence.** Where this file and the spine **contradict** each other, the spine wins and
this file is the defect, to be reported and fixed. Where the spine is **silent** and this
file is not, this file governs — silence is not permission, and a rule stated once is
stated.

**Why any of it is written down at all.** Nothing here is a free choice. Each item exists
because two builders once derived it differently, or because a live payload contradicted a
reasonable guess. An item with no such history belongs in the code, not in a document.

---

## 1. Weights file — deriving a tier's interval (AD-11)

`5.0.0` reports each line's `ranges` verbatim, one `[min, max]` pair per `#` in that
line's template text. `core` derives the **one** filter-comparable interval that the trade
stat filter compares against.

| Line shape | `ranges` | Derived interval |
| --- | --- | --- |
| No `#` — a flat, valueless line | `[]` | none; the line is `valueless` |
| One `#` | `[[a, b]]` | `[a, b]` |
| Two `#` | `[[a1, b1], [a2, b2]]` | `[(a1+a2)/2, (b1+b2)/2]` — **pending OQ-12** |
| Three or more `#` | `[[…], […], […]]` | **cannot occur** — a file error (`WEIGHTS-FILE-SCHEMA.md`) |

**The two-`#` rule is the producer's inference, not a confirmed fact (OQ-12).** The
evidence is that poe2db prints a bow tier as `43.0–56.5`, and a `.5` edge can only arise
from averaging two integers. It is written here as the working rule so that `contracts` and
`core` can land, and it is the single place to change when OQ-12 resolves.

**Do the division once, in one exported function**, and let both the containment test and
the edge-alignment test call it. Two call sites that each divide are two chances to round
differently.

**Exactness — settled 2026-09-19 (OQ-19 closed).** Two `#` is the maximum the game
publishes on a stat line, and dividing by 2 is exact in IEEE doubles, so a two-`#` interval
lands on a half-integer lattice and compares equal to a curator's declared edge with no
tolerance. **The division can therefore never fail to terminate, and `core` needs no
guard** — `WEIGHTS-FILE-SCHEMA.md` rejects a three-`#` line at the file, so such a line
never reaches this function. Should a future patch introduce one, the file fails loudly and
the answer is a contract amendment: **do not add an epsilon**, because the comparison is
load-bearing against the sentinel defect AD-5 exists to close and an epsilon readmits it.

### Containment (AD-11, AD-17)

```
contains(ref, entry) ⇔ ∃ line ∈ entry.lines such that:

    ref is banded:     line.statId == ref.statId
                     ∧ line.ranges is non-empty
                     ∧ interval(line).min >= ref.valueMin
                     ∧ interval(line).max <= ref.valueMax

    ref is valueless:  line.statId == ref.statId
                     ∧ line.ranges is empty
```

Three rules ride with it:

- A contained entry contributes its **whole weight, once**, however many of its lines match.
- A merely-overlapping entry contributes **nothing** to the numerator **and is not an
  error**. It still counts in the denominator.
- **A line whose `statId` is `null` can never be contained**, but its entry still enters the
  denominator like any other.
- **An entry whose `weight` is `0` is never contained**, whatever its `weightSource` and
  whatever its lines carry. It still enters the denominator (it adds nothing) and the
  Provenance fold (AD-10). Because §2.3 to §2.5 read `contained(ref)`, a weight-0 tier
  moves no kind, edge or empty-containment verdict, and a band that covers only weight-0
  tiers fails §2.5 instead of ranking at `P = 0`.

---

## 2. Valuation (AD-17)

### 2.1 The overlap predicate

Overlap is defined by a predicate and never by an enumeration of shapes — an enumerated
list has twice been found to miss a case.

```
overlap(a, b)  ⇔  slotOverlap(a.prefix, b.prefix) ∧ slotOverlap(a.suffix, b.suffix)

slotOverlap(x, y) =  true              if x is absent or y is absent
                     true              if x.statId != y.statId ∧ coOccur(x, y)
                     false             if x.statId != y.statId
                     true              if both are valueless
                     bands intersect   otherwise
```

Evaluate the branches in that order. The `coOccur` branch must sit **above** the
`statId` inequality, or it is unreachable.

**Four consequences, and the fourth is the one an enumeration missed:**

1. Adjacent tiers of one `statId` in one slot are disjoint, and a curator may track both —
   that is the point of AD-5's bands. Bands that *intersect* still overlap and are still
   rejected.
2. A partial-affix entry subsumes a fuller entry, because leaving a slot absent covers every
   roll in that slot.
3. An absent affix means *any roll in that slot*, which is why the conjunction covers **both**
   slots.
4. **A prefix-only entry and a suffix-only entry on one item class overlap each other.** Neither
   subsumes the other and no two bands intersect, yet an item carrying both named modifiers
   satisfies both entries and is counted twice.

**Error payload.** An overlap is rejected at load as a `data/tracked.json` validation error
whose payload **names both offending entries by their canonical key** (§4.1) and the slot
or slots on which they overlap. Naming one entry sends the curator hunting for a partner
the checker already knows; naming neither turns a two-line fix into a search of the whole
list. The rejection itself is AD-17's load-time rule, and this payload does not soften it.

### 2.2 `coOccur` (AD-11, AD-17)

Under `5.0.0` this is a **direct read of one entry's `lines`**, and no cohort reasoning is
involved:

```
coOccur(x, y) ⇔ ∃ entry ∈ scoped(cat, slot, L) such that
                    contains(x, entry) ∧ contains(y, entry)
```

The pool is scoped to the item class's own crafted floor `L` — the same `L` that scopes
every probability on the class, and AD-17 gives a class exactly one.

**Where the pool cannot answer — a class absent from `weights.json`, or a `partial` pool —
`coOccur` is `false` and the tracked list still loads.** AD-17 states that ruling and why;
do not re-derive it here, and do not reach for the refuse-site-wide reading it rejects.

### 2.3 Kind agreement (AD-17)

AD-17 states the rule and its **universal** quantifier. The only mechanical point this file
adds: **a line's kind is read from whether its `ranges` array is empty** — empty means
valueless, non-empty means banded — because `5.0.0` carries no `kind` field to read. The
within-file half is `contracts`'s and needs no cross-file view.

### 2.4 Edge alignment (AD-17)

Requiring `valueMax` to be *present* only closes the syntax of an open top. A curator who
writes `valueMax: 9999` is schema-valid, passes containment, and makes AD-16's stat filter
operationally min-only — the sentinel defect verbatim. Therefore, for every tracked
**`banded`** reference, over its containment set under the scope:

```
lines(ref) = { line : entry ∈ contained(ref)
                    ∧ line ∈ entry.lines
                    ∧ line.statId == ref.statId }

ref.valueMin == min { interval(line).min : line ∈ lines(ref) }
ref.valueMax == max { interval(line).max : line ∈ lines(ref) }
```

**`contained(ref)` returns entries, not lines, and the `statId` filter is load-bearing.**
A hybrid entry is contained on one of its lines while carrying others under different
`statId`s (AD-11). Taking the extremes over *every* line of a contained entry would pull a
foreign line's interval into the comparison, and **every** band over a hybrid `statId`
would fail alignment permanently, with nothing a curator could write to satisfy it.

Worked, against a family whose tiers derive to `T7 = [43.0, 56.5]` and `T8 = [56.0, 80.0]`:

| Band | Contains | Verdict |
| --- | --- | --- |
| `43.0 – 56.5` | T7 | **accepted** — edges are exactly T7's |
| `56.0 – 80.0` | T8 | **accepted** — edges are exactly T8's |
| `43.0 – 80.0` | T7, T8 | **accepted** — a run of adjacent tiers, edges are the extremes |
| `43.0 – 60.0` | T7 only | **rejected** — the ceiling reaches into T8, which the band does not contain |
| `0 – 9999` | T7, T8 | **rejected** — sentinel edges are not the extremes |

The fourth row is the **new** mistake whole-tier containment creates, and edge alignment is
what catches it: the band would silently drop all of T8's weight while the search still
returns T8 items in range.

**Evaluate under the scope, at the entry's own floor.** The containment set shrinks as the
floor drops, so a reference can align at one floor and fail at a lower one — that failure is
the rule working. A builder who computed the containment set **unscoped** would silently
accept exactly the references this check catches.

### 2.5 Empty containment set (AD-17)

AD-17 states the rule and its two indistinguishable causes. The mechanical obligation this
file adds is the **error payload**: report the tracked entry by its canonical key (§4.1), the
reference, the reference's floor, and the
absence of any entry carrying that `statId` in the scoped pool — and name **neither file as
at fault**, because `core` cannot tell the causes apart and blaming the tracked list
unconditionally sends a curator hunting a defect in a file that is correct.

### 2.6 Class discriminability (AD-16, AD-17)

The fifth cross-file check, and the only one whose subject is the **search** rather than the
valuation. It asks one question of every `crafted` tracked entry: *if this entry's category
holds more than one class, can AD-16 tell this class apart from its siblings?*

```
fansOut(entry)  = | keys(weights.bases[entry.categoryId]) | > 1

discriminable(entry) = discriminator(entry.className) is defined   (§10)

fails(entry) = fansOut(entry) ∧ ¬discriminable(entry)
```

**Both conjuncts are necessary and neither is sufficient.** A class in a single-class
category needs no discriminator, because `type_filters.category` is already exact — so
`¬discriminable` alone would fail 23 of the 29 categories on the conforming file for no
reason. And a class that fans out but *is* discriminable is the normal, correct case. Only
the conjunction describes a search that would silently price across siblings.

**`fansOut` is read from `weights.json`, and that is the whole reason this is a cross-file
check.** Neither file holds both halves: whether a discriminator is *needed* is a fact about
the weights file's fan-out, while whether one can be *produced* is a fact about the tracked
entry's own `className`. A per-file schema in `contracts` sees one or the other, never the
pair (AD-17).

**§10.2's "otherwise" arm cannot arise against a file that already conforms to
`WEIGHTS-FILE-SCHEMA.md` `5.1.0`.** Every `className` is, by that file's own grammar, either
defence-suffixed or plain (arm 1's condition, or the negation of it), and its distinctness
and no-mixing hard errors (that file's Validation section) mean a fanned-out `categoryId` is
either entirely defence-suffixed (arm 1 covers every class under it) or entirely plain (arm
2, generalized above, covers it) — never a mix `WEIGHTS-FILE-SCHEMA.md` would have let
through. A single-class category takes arm 3 regardless of shape. Given those two hard
errors, this check's `fails(entry)` predicate is therefore **never true against a
schema-conforming file** — it is retained as a cross-file backstop, not a live check on
today's data, for the case a `core` build accepts a file's major version without yet
enforcing `5.1.0`'s two hard errors (e.g. mid-upgrade, or a future minor that loosens them).
**Should it ever fire, the consequence is the narrower one, never a whole-file refusal:**
AD-17 excludes that one class from the ordering with a reason, and every other class in the
file still ranks. A malformed or ambiguous `className` key is a **separate**,
whole-file-refusing failure owned entirely by `WEIGHTS-FILE-SCHEMA.md`'s own Validation
section — this check and that hard error are not two paths to the same outcome, and neither
document should say they are.

**Error payload:** the tracked entry by its canonical key (§4.1), its `className`, its
`categoryId`, the count of sibling classes under that `categoryId`, and the reason
*`class not discriminable`*. **Never a fallback to a category-wide search** — that is the
silent failure this check exists to convert into a loud one, and `prd.md` FR-1's guarantee
that no base outside the class contributes is what it protects.

---

## 3. Pool coverage (AD-27)

The unit is the **item class** — the `(categoryId, className)` pair of AD-5 — and never a
base type. Write `cat` for that pair.

```
rankable(cat) = cat carries at least one tracked entry that is
                crafted and not pruned

covered(cat)  = weights.json has bases[cat.categoryId][cat.className]
                ∧ both slots declare poolCoverage "complete"
                ∧ neither slot's pool is empty      -- total weight 0

coverage = |{ cat ∈ tracked.json : rankable ∧ covered }|
           ──────────────────────────────────────────────
           |{ cat ∈ tracked.json : rankable }|
```

**`covered` resolves by direct lookup at both rungs**, which is what makes it computable at
all. Until spine revision 16 this predicate read *"base is PRESENT in weights.json"*, written
against `4.x`'s single-level per-base key; `5.0.0` went two-level in a way that left no
per-base presence to test, so the first condition had no meaning for a year of revisions
before AD-5 gave the tracked entry the same key the file uses. **Neither rung falls back**:
a named `className` missing under a present `categoryId` is `covered = false`, never a search
of the category's other classes.

**All three conditions are load-bearing**, and stating only the middle one makes the fraction
ambiguous:

- *"Both slots are `complete`"* is **vacuously true** of a class absent from
  `weights.json` entirely, because it has no slots to fail.
- A class declaring `complete` over an **empty** pool passes a naive reading, while AD-17
  excludes it from the ordering anyway.

**A pool is empty when its total weight is `0`**, not only when it has no entries. A slot of
only weight-0 tiers (for example, only `not-in-game` tiers) can roll nothing, so it is not
covered here, it is AD-17's third cause, and §9's `W = 0` is the same test after the
recipe's floor. One definition in all three places keeps the report and the appendix in
agreement.

**The `pruned` exclusion is the only survivor of the old denominator carve-out.** That
carve-out also *counted only bases that need a pool*, excluding a base tracked solely as a
raw base; under AD-5's split nothing can fall through it, because only a `crafted` entry
names a class and every class so named needs a pool by construction (AD-27). A
class whose every crafted entry is `pruned` is not rankable and enters neither half.
**A raw entry never appears in either half**, and no longer because a clause excludes it —
it names a base type, which is not a member of this fraction's universe.

**An unresolved stat line (`statId: null`) does not affect coverage** — it is data, not a
completeness failure.

**The report carries the denominator beside the fraction.** `sync-report.json` records the
count `|{ cat ∈ tracked.json : rankable }|` as its own field next to `coverage`, and
`web` shows both, so a reader can see when the list is too small for the fraction to mean
much. **That is now the usual case rather than the exception** — the denominator counts
**classes**, of which the conforming file of 2026-09-19 carries 59 across 29 categories —
and it is why AD-27 no longer binds anything to the figure. **Spine revision 17 moved the
unit from the category to the class and this reasoning is untouched**: 59 and 29 are the
same order of magnitude, so a threshold over either would still measure the scraper's
progress rather than how much product exists, which is what withdrew the bands. **Wire shape:** `coverage` is a `number` in `[0, 1]` — a fraction, never a percentage —
and `web` formats it; when `weights.json` is absent **both fields are omitted together**,
which is how "undefined" is spelled, and `web` must not read the omission as `0`. `sync`
computes the figure and `web` only renders it: `web` does not recompute coverage even though
it holds both files, because two figures on two surfaces would be the divergence AD-27
exists to prevent. **No threshold reads this figure.** `prd.md` revision 17 withdrew FR-4's
coverage bands and spine revision 16 withdrew AD-27's copy of them; a builder who finds an
80% or 50% rule in an older draft is reading a withdrawn number, not an omission here.

---

## 4. Encodings and precision

### 4.1 The canonical `TrackedEntry` key (Consistency Conventions)

**The key's first element is the kind**, and the rest follows from it (AD-5):

```
crafted:  ["crafted", categoryId, className, itemLevelMin, prefixBand, suffixBand]
raw:      ["raw",     baseTypeId, itemLevelMin]
```

serialised in that element order. Each affix encodes in exactly one of three
**distinguishable** forms:

| Affix state | Encoding |
| --- | --- |
| absent | the literal `null` |
| `banded` | `[statId, valueMin, valueMax]` |
| `valueless` | `[statId, null, null]` |

Three forms, so an absent affix and a valueless affix can never collide. **An affix is always
exactly three elements or `null`** — `acceptedTier` is a display-only sibling of the band, not
a fourth element, and `lastSearchId` / `lastSearchLeague` are dataset-entry facts. Every
artifact that keys entries uses this one encoding.

**The leading kind tag is not decoration.** Without it the two arms would be told apart by
arity and by whether element 1 happens to look like a `categoryId` or a `baseTypeId` — the
same inference AD-5 abolished at the schema, re-entering at the encoding. It also makes the
byte-wise ordering the Conventions table fixes **total across a mixed list**: every `crafted`
key sorts before every `raw` key, deterministically, so AD-17's ranked list and AD-7's
rotation both have one ordering rather than one per branch. **A `crafted` key carries no
`baseTypeId` and a `raw` key carries no affix members**; neither arm carries a `null`
placeholder for the other's fields, because a placeholder would make the two arms the same
shape again.

### 4.2 Divine rounding (AD-20, Consistency Conventions)

Round to **4 decimal places** at the point of normalisation, in `sync`, **once**. `core` never
re-rounds, so two readers of one artifact cannot disagree on a value. The figure binds
`CurrencyRate` as well as `PriceObservation`: 0.0001 divine is far finer than any payout
threshold, and the binding constraint is the other end — on a coarser grid a crafting currency
worth a small fraction of a divine rounds toward `0.0000`, AD-17's `craftCost` term collapses,
and subtracting craft cost becomes a silent no-op that inflates every `EV`.

### 4.3 The even-sample median (AD-16)

Take the **lower** of the two middle values, never their mean. Ten results is the normal path,
so the even sample is not an edge case. Three reasons: every persisted price stays a price
someone actually asked; no second rounding step is needed, because each listing is normalised
and rounded once on the way in and choosing one of them cannot leave the grid; and it leans
very slightly cheap, in the same conservative direction as the ascending sort.

---

## 5. The trade client (AD-8, AD-16, AD-24)

### 5.1 Captured live request — 2026-09-19

Source: `docs/prds/prd-poe-crafting-base-price-checker-2026-09-12/curl-creater-trade-search.txt`,
a browser search captured from the live site. **It is a category search**, which since spine
revision 16 makes it a recorded example of the **crafted** branch's own query shape (AD-5,
AD-16) and not merely of the request envelope. It was filed as neither, under the earlier
reading in which every search named a base type.

```
POST https://www.pathofexile.com/api/trade2/search/poe2/Forbidden%20Rites
content-type: application/json
x-requested-with: XMLHttpRequest
user-agent: <descriptive, with contact — AD-8>
```

**The minimum request body** — a **second, distinct** example, supplied directly by the
player on 2026-09-19 as the smallest body that creates a search, and **not** the JSON
carried by the `curl-creater-trade-search.txt` capture above (that capture's own body has
three stat filters and no `ilvl`; this one is a separate, later capture with no committed
fixture file of its own):

```jsonc
{
  "query": {
    "status": { "option": "securable" },          // settled — AD-16, always emitted
    "stats": [ { "type": "and", "filters": [
      { "id": "explicit.stat_1509134228", "value": { "min": 155 }, "disabled": false },
      { "id": "explicit.stat_518292764",  "value": { "min": 4.5 }, "disabled": false }
    ] } ],
    "filters": {
      "type_filters": { "filters": {
        "category": { "option": "weapon.bow" },   // the crafted branch's unit filter — trap 1
        "ilvl":     { "min": 79 },
        "rarity":   { "option": "magic" }
      } },
      "trade_filters": { "filters": {
        "price": { "option": "exalted_divine" }   // settled — AD-16, always emitted
      } }
    }
  },
  "sort": { "price": "asc" }
}
```

**What it confirms:** the path is `/api/trade2/search/{realm}/{league}` with realm `poe2` and
the **league segment percent-encoded**, which is the same shape AD-24 pins for the outbound
link, now verified on the request side too. `sort.price: "asc"` matches AD-16. Stat filters
are `{id, value: {min, max}, disabled}` inside a `{type: "and", filters: []}` group, and
**`disabled: false` is emitted explicitly** rather than left to a default. `type_filters.ilvl`
takes a bare `{min}`, which is AD-16's shape for the entry's item level floor.

**`"min": 4.5` settles one edge of OQ-12**: the stat filter accepts a **non-integer** bound,
so AD-16's *emit the edge as derived and never round* is satisfiable rather than merely
asserted. A half-integer band edge can be filtered on directly.

**No `trade_filters.sale_type` appears**, which is what closed the duplication half of OQ-20 —
AD-16 emits `status.securable` alone, and trap 2 retired with the field.

**`trade_filters.filters.price` filters by listing denomination**, and AD-16 emits it on every
search (OQ-24, closed 2026-09-19). The result set is confined to listings asking exalted or
divine, which is what keeps AD-20's hand-maintained rate file to one sourced listing currency;
the cost is that a listing asking anything else is never seen, so a sample can be smaller than
the market and `no-listings` can fire on a base listed only in chaos.

**The search response's identifier is `id`** — a top-level field on the response to this body,
confirmed 2026-09-19. `sync` stores it verbatim as `lastSearchId` (AD-9) and AD-24 builds the
outbound link from it. The earlier capture's `referer` ends in a long base64/gzip blob
(`H4sIAAAA…`), which is the trade site's **encoded-query** URL form — a different thing from
the saved-search identifier, and never the value to store.

### 5.1b Captured live request — 2026-09-20, the class discriminator

Supplied by the player on 2026-09-20 as a working search for **`Body_Armours_dex_int`** —
a dex/int body armour, which carries evasion and energy shield and **no armour**:

```jsonc
{
  "query": {
    "status": { "option": "securable" },
    "stats": [ { "type": "and", "filters": [
      { "id": "explicit.stat_1999113824", "value": { "min": 101 } },
      { "id": "explicit.stat_1671376347", "value": { "min": 41  } }
    ] } ],
    "filters": {
      "type_filters": { "filters": {
        "category": { "option": "armour.chest" },   // the category rung
        "rarity":   { "option": "magic" }
      } },
      "equipment_filters": { "filters": {          // the class rung — THE DISCRIMINATOR
        "es": { "min": 1 },                        // int  -> has energy shield
        "ev": { "min": 1 },                        // dex  -> has evasion
        "ar": { "max": 0 }                         // no str -> has no armour
      } },
      "trade_filters": { "filters": {
        "price": { "min": null, "max": null, "option": "exalted_divine" }
      } }
    }
  },
  "sort": { "price": "asc" }
}
```

**This settles the field path and the spelling on the request side**, the same way §5.1's
body settled `status` and `price`. The path is `query.filters.equipment_filters.filters`,
and the three defence keys are **`ar`, `ev`, `es`** — short forms, not long names. Nothing
here is an assumption: AD-16's crafted query shape is written against a body that creates a
search.

**Two incidental readings, recorded so a builder does not take them for rules.** The
`price` object carries `"min": null, "max": null` beside its `option`; AD-16 emits the
`option` and the explicit nulls are the live site's own serialisation, not a requirement —
§5.1's body omits them. And this capture carries **no `type_filters.ilvl`**, because it is a
browse rather than a tracked-entry search; AD-16 always emits the floor.

**The `max: 0` edge is the load-bearing half**, and it is what makes the signature exclusive
rather than merely inclusive: `ev`/`es` at `min: 1` alone would still admit a str/dex/int
chest. Its safety rests on a pool fact, checked in §10.

### 5.1c Captured live request — 2026-09-20, the `jewel` arm

Supplied by the player on 2026-09-20 as a working search for the **`Sapphire`** jewel class:

```jsonc
{
  "query": {
    "status": { "option": "securable" },
    "type": "Sapphire",                            // THE DISCRIMINATOR — arm 2, top level
    "stats": [ { "type": "and", "filters": [
      { "id": "explicit.stat_2482852589", "value": { "min": 18 }, "disabled": false },
      { "id": "explicit.stat_1604736568", "value": { "min":  2 }, "disabled": false }
    ] } ],
    "filters": {
      "trade_filters": { "filters": {
        "price": { "option": "exalted_divine" }
      } },
      "type_filters": { "filters": {
        "rarity":   { "option": "magic" },
        "category": { "option": "jewel" }          // the category rung, emitted as well
      } }
    }
  },
  "sort": { "price": "asc" }
}
```

**This settles the one shape a builder would otherwise hesitate over: `query.type` and
`type_filters.category` are emitted together and the search works.** §5.2 trap 1's *never
both* reading is a pre-revision-17 draft — what that trap forbids is the wrong **value** in
either field, and a `raw` entry carrying a category. It does not forbid a crafted jewel
search carrying both rungs.

**`query.type` sits at the top level of `query`, beside `status` and `stats`** — not inside
`type_filters` — which is the same position the raw branch uses (§5.2 trap 1). The class
name is the base type name with its underscore trimmed: `Sapphire`, and
`Time-Lost_Diamond` → `Time-Lost Diamond`.

**Incidental, not a rule:** this body carries `"disabled": false` on its stat filters and
§5.1b's does not, and its `price` omits the explicit `min`/`max` nulls §5.1b carries. Both
variations create searches, so neither is required; AD-16 fixes what it emits and a builder
should not read either capture's serialisation as a constraint. As in §5.1b there is no
`type_filters.ilvl`, because this is a browse rather than a tracked-entry search.

### 5.2 The three traps (AD-16)

Each is costly to discover in code. A fourth trap — `priced_with_info` versus *"Buyout or
Fixed Price"*, whose option `id` is JSON `null` — retired in revision 14 when AD-16 stopped
emitting `trade_filters.sale_type` altogether; it is recorded here only so a builder who finds
it in an older draft knows it was removed deliberately and not overlooked.

1. **The two unit filters belong to two branches, and the wrong one is never emitted**
   (AD-5, AD-16). A **`raw`** entry sends `query.type` — top level, not a filter — carrying
   its `baseTypeId`, and sends no category at all. A **`crafted`** entry sends
   `type_filters.category` carrying its `categoryId`, **plus its class discriminator**
   (§10). The values are not interchangeable: `category` takes taxonomy ids such as
   `weapon.bow` and will not accept a base type name, while `query.type` takes a base type
   name and will not accept a taxonomy id.

   **Since spine revision 17 a crafted search can carry `query.type` too, and that is not a
   contradiction — it is the `jewel` arm of the discriminator.** A jewel class carries no
   defences, so its discriminator is the class's own base type rather than a defence
   signature, and the search then carries both rungs: `type_filters.category` for the
   category and `query.type` for the class. **This is the only shape in which both appear**,
   it applies to `jewel` alone, and a builder who reads trap 1 as *never both* is reading a
   pre-revision-17 draft. **It is evidence, not inference** — §5.1c is a captured working
   search for `Sapphire` carrying exactly this pair. What is still never legal is a **`raw`** entry carrying a category,
   or a crafted entry carrying `query.type` for any reason other than this one.

   **The prohibition underneath this trap survives the rewrite, and it is the load-bearing
   half.** Until spine revision 16 this trap read *"the base type is `query.type`, never
   `type_filters.category`… do not attempt that mapping"*, because no committed artifact maps
   a base type to its leaf category — `data/items` groups only ten coarse labels. **That is
   still true.** No component derives a category from a base type, or a base type from a
   category, in either direction. The `jewel` arm is **not** a counter-example and the
   distinction matters: it derives a base type from a **`className`**, which is a different
   axis, under a grammar the weights contract makes normative, and it validates the result
   against `items.json` before sending it (AD-25). A `categoryId` is neither its input nor
   its output.

   *(§5.1's captured body is a category browse with stat filters and an `ilvl` floor, which
   makes it a recorded example of the **crafted** envelope. It was filed as a non-example
   under the old reading; it is evidence now, and the note beside it there says so.)*
2. **Pass the band's `max` as well as its `min`.** A min-only filter returns every higher tier
   and prices the band at its floor, which is the sentinel defect reintroduced at the adapter.
   Both §5.1 bodies are min-only, and neither is a counter-example: both are category browses,
   not band-targeted searches.
3. **A multi-`#` stat filters on one derived value, and which value that is, is a measurement
   rather than a choice** (OQ-12, §1). A producer and a `core` that pick different quantities
   produce a file that validates and prices the wrong population.

The no-rounding obligation on `sync` is AD-16's own Rule, not a note — it is repeated there
because it is the adapter that would commit the violation.

### 5.3 Rate-limit governance (AD-8)

Read `X-Rate-Limit-Rules` to learn the **active rule names at runtime**. For each name, parse
two headers: `X-Rate-Limit-<Name>` (the policy) and `X-Rate-Limit-<Name>-State` (consumption).
Unauthenticated, the rule is `Ip`, giving `X-Rate-Limit-Ip` and `X-Rate-Limit-Ip-State`.
**Never enumerate rule names in code** — GGG documents others, `Client` among them, and an
adapter recognising only `Ip` would silently stop pacing the day the rule set changes.
`X-Rate-Limit-Policy` distinguishes the search bucket from the fetch bucket; pace against the
tightest unsatisfied bucket.

Measured 2026-09-12, unauthenticated, rule `Ip` — **the expected shape, never a constant to
compile in**:

| Policy | Buckets (`hits:seconds:penalty`) | Effective |
| --- | --- | --- |
| `trade-search-request-limit` | `5:10:60, 15:60:300, 30:300:1800, 600:21600:3600` | 600 searches / 6h |
| `trade-fetch-request-limit` | `12:4:10, 16:12:300, 50:300:300, 1000:21600:1800` | 1000 fetches / 6h |

**The Invalid Requests Threshold.** GGG's developer documentation counts every `4xx` — `401`,
`403` and `429` named — toward a threshold past which a client "will be restricted from
further access". Counting per policy is this project's choice, not GGG's. The client refuses
to send once a policy's count reaches `invalidRequestThreshold`, a **`sync`-side constant of
`1`**, passed into the client factory as a value by every shell that builds one. The client
keys the count on the policy a lane has learned from the headers, so a lane that has not yet
learned its policy is not refused by another lane's `4xx`; on the chunk path this never
matters, because the first `4xx` ends the chunk. The value is a constant for the reason §7's
`staleLockAfter` is: nothing but `sync` reads it, and AD-19 keeps `data/config.json` to three
keys.

**Penalty memory across processes (AD-8).** Two chunk endings write a `notBefore` instant into
`sync-progress.json`, and nothing else does:

```
after a 429:                  notBefore  =  now + min(retryAfter, staleLockAfter)
after a malformed-request
abort (AD-9):                 notBefore  =  now + staleLockAfter
```

`retryAfter` is the delay the client's yield carried for that `429` — the `Retry-After`
header, or the floor the client derived from the same response. A chunk that is bounded by
its allowance, completes, or ends for any other reason clears the field. An absent
`notBefore` never defers a run. The field is additive, so `sync-progress.json` takes a minor
version; its schema is strict, so a build older than the change refuses a file carrying the
field, which is acceptable because only `sync` reads it.

**The check sits between the lock and every other load.** A run takes the lock — breaking a
stale one per §7 — and then reads `notBefore` before it loads anything else. When
`now < notBefore`, the run releases the lock, sends nothing and exits 0. It writes nothing,
with one exception: a run that broke a stale lock to get here writes `sync-report.json` alone,
carrying the `stale-lock-broken` record, because that record is the only trace of the crash.

**The even spread, under the `pnpm sync` session (AD-7, AD-8).** Before a request on a policy,
the session waits

```
wait  =  max( paceBeforeNext,
              max over buckets with used < hits of  seconds × 1000 / (hits − used) − elapsed )
```

where `paceBeforeNext` is the batch pacer above (a restriction, or a full bucket's remaining
window), `used` is the bucket's consumption in the last State reading, and `elapsed` is the time
since that reading. A policy with no reading waits `0`. The spread never spends more than the
capacity the last reading left in any bucket's period, so it is safe under a rolling and a fixed
window alike, and it corrects itself because each response replaces the reading. Its steady state
is the sustained rate of the tightest bucket: about 36 s per search at `600:21600`. Worked example:
a search policy last read at `20 of 30:300` and `100 of 600:21600` waits
`max(300000 / 10, 21600000 / 500) = 43200 ms`, less the time elapsed.

**The session's backoff (AD-7).** A yield that wrote no `notBefore` and brought no fresh State
reading, and a throw that is not a refusal, a league mismatch or a malformed request and wrote no
`notBefore`, wait

```
backoff(n)  =  min( evenInterval × 2^(n − 1),  staleLockAfter )
evenInterval  =  max over the entry's lanes of  max over the lane's buckets of  seconds × 1000 / hits
```

measured from the end of the chunk, where `n` counts consecutive such waits and a State reading
resets it to `0`. A lane whose policy has not been read counts as the measured search bucket
`600:21600` above: **36 s**. The throw's wait also ends when an input file changes, if that is
sooner.

### 5.4 The outbound link URL (AD-24)

```
https://www.pathofexile.com/trade2/search/poe2/{encodeURIComponent(lastSearchLeague)}/{lastSearchId}
```

Encode **the league segment only**, never the whole path. Live league ids carry spaces
(*"Forbidden Rites"*, *"Runes of Aldur"*), and an unencoded segment produces a link that
silently 404s rather than failing where anyone would see it.

---

## 6. The `pinned` cap (AD-7)

Two ends enforce one requirement — *a chunk must be able to refresh every `pinned` entry and
still make progress on the `active` rotation below it* — because neither end is sufficient
alone.

**Load time, a `tracked.json` validation error, `sync` only:**

```
count(pinned)  ≤  0.5 × config.minChunkSearches
```

At least half of a minimum chunk is left for the `active` rotation. **The currency step was a
summand until revision 14** and is gone with it: AD-20 now reads rates from committed data and
spends no searches, so `currencyStepSearches` is `0` by construction and no longer appears in
this formula or in the record below. Reintroducing an automated rate source (Deferred) puts the
summand back.

**`web` may not evaluate this check and is not obliged to**, even though it also validates
`tracked.json` on load. Both inputs are now in front of it — `count(pinned)` from
`tracked.json` and `minChunkSearches` from `config.json`, both in AD-24's fetch set — so this
is a deliberate division of labour rather than an inability. The cap protects a sync run's
rotation; `web` refusing to render over it would take the product down for a curation error
that only ever affects a sync run.

**Runtime, every chunk, `sync`, surfaced by `web`:** if the discovered allowance cannot cover
the pinned set **plus at least one `active` entry**, truncate the pinned set for that chunk —
taking them in oldest-`lastAttemptedAt` order, reserving at least one search for the rotation —
then complete the chunk normally and record a distinct **pinned-starvation** record in
`sync-report.json`. It is not an error and does not change the exit code.

**The record carries exactly five fields**, and `SyncRunReport` names them so:

| Field | Meaning |
| --- | --- |
| `discoveredAllowance` | the search allowance the chunk actually received from the live headers (AD-8) |
| `declaredMinChunkSearches` | `config.minChunkSearches` as loaded — the yardstick beside the allowance observed |
| `pinnedCount` | the size of the `pinned` set at load |
| `pinnedRefreshed` | how many `pinned` entries the truncation kept |
| `activeRefreshed` | how many `active` entries the chunk reached |

The shortfall is otherwise at least four different numbers, and the declared yardstick
beside the observed allowance is what turns the record from a symptom into a diagnosis.
It is distinct from the **not-reached** record AD-7 acknowledges: *not reached* is a normal
rotation outcome, starvation is a curation defect the player must correct.

### Seeding `minChunkSearches` — read the sustained bucket, not the burst

Whichever of AD-8's search buckets is tightest governs a chunk's allowance, and **in steady
state the long bucket is the tightest**. `600:21600` is **100 searches per hour sustained**,
while `30:300` is a burst allowance a chunk only receives in full at an invocation interval
around 18 minutes or longer. **A syncer invoked every 5 minutes therefore sees roughly 8
searches per chunk once the 6-hour bucket saturates, not 30.** Seeding `minChunkSearches` from
the burst figure at a short cadence would certify a pinned set that starves every chunk
forever — the precise failure the cap exists to prevent, re-entering through the yardstick.

The player declares the smallest allowance a chunk will actually receive **at the cadence the
player schedules**, bounded above by `sustainedRate × interval`. AD-7 is untouched: the syncer
still assumes nothing about its invoker — the player declares the number and the runtime check
audits it.

---

## 7. The lock and its staleness threshold (AD-7)

The lock file carries **two fields and no others** — the holder's `pid` and its ISO-8601 UTC
`startedAt`. Anything else invites a reader to reason about a run it cannot see.

```
stale(lock, now)  ⇔  now − lock.startedAt  >  staleLockAfter
```

**`staleLockAfter` is 6 hours**, and the figure is a ceiling on a chunk, not an estimate of
one. A chunk is bounded by AD-7's three allowances and finishes in minutes; six hours is far
past any legitimate run while still clearing the lock inside a single day's syncing, so a
crash costs at most one wasted cadence rather than every future one. It is a `sync`-side
constant, not a `data/config.json` field — AD-19 keeps that file to the two things the player
owns, and nothing but `sync` reads this.

**A run that breaks a stale lock takes it, proceeds, and records `stale-lock-broken`** in
`sync-report.json`, carrying the broken lock's `pid` and `startedAt`. The record is not an
error and does not change the exit code; its job is to make the recovery **visible**, because
the state it recovers from is otherwise indistinguishable from a healthy idle system.

**Do not check liveness by pid alone.** A pid is reused by the operating system, so a live
unrelated process can wear a dead run's number and hold the lock forever; the time comparison
is what bounds the failure. Where a cheap same-host liveness check is available it may
*shorten* the wait, and may never extend it past the threshold.

## 8. Curation — deriving a tracked entry's item level floor (AD-5, AD-17)

`itemLevelMin` is declared in `data/tracked.json` and no component derives it (AD-5). What
follows is what the declared number must **equal** — a conformance condition on the file, which
AD-5 binds and which a curator is the one who satisfies. It is written down because a floor that
two people compute differently is not a curation preference: it is a different eligible pool,
and so a different price on the same row.

**One direction of this condition is mechanically unchecked** (AD-5), for the reason given
under *Alignment is monotone upward* below.

```
tier(ref)        = over the UNSCOPED pool for the entry's (item class, slot) —
                   every entry at every itemLevelMin — carrying that statId

                   ref is `banded`:     the entries whose derived interval (§1)
                                        lies wholly within the band's edges
                   ref is `valueless`:  every entry publishing that statId
                                        with an empty `ranges` (AD-5, §1)

needs(ref)       = max { w.itemLevelMin : w ∈ tier(ref) }   if ref is `banded`
                   min { w.itemLevelMin : w ∈ tier(ref) }   if ref is `valueless`

candidate(entry) = max over the entry's PRESENT affixes of  needs(affix)

floor(cat)       = max over the class's crafted tracked entries of candidate(entry)
```

**`needs` is a maximum on a band and a minimum on a valueless reference, and the split is
forced rather than stylistic.** A band names a specific tier or run, and §2.4 requires every
named tier to be in scope, so the band's requirement is its rarest tier's level. A valueless
reference has no edges to align and §2.4 does not apply to it at all (AD-5) — any tier
publishing that `statId` satisfies both the pool and the trade filter, so the only obligation
is §2.5's: the scoped pool must hold **at least one** such entry. Taking a maximum there would
declare a floor no rule asks for and quietly narrow the pool on every other affix of the base.

**`w` is a weights entry, and `entry` is a tracked entry.** Both carry a field spelled
`itemLevelMin` and this is the only place in the system where both are in scope at once
(AD-5, AD-11). `needs` ranges over `tier(ref)` and reads **`w.itemLevelMin`** — reading
`entry.itemLevelMin` there would return the number this section exists to derive.

**Every quantity here is the item class's, and that is new since spine revision 16.** The
pool was always the class's (`WEIGHTS-FILE-SCHEMA.md`) while the tracked entry was keyed on a
base type, so this section had to explain that `needs(ref)` was a fact about the class while
only the outer maximum was about the base — and **OQ-23 sat on the gap between the two**.
AD-5 closed the gap by moving the crafted entry onto the pool's own key: `tier(ref)`,
`needs(ref)`, `candidate(entry)` and `floor(cat)` are now all facts about one class, and
the outer maximum ranges over the crafted entries anyone tracks against it. **A raw entry
takes no part in this derivation at all** — it names a base type, carries no affix to resolve
and needs no pool (AD-17), which is now true by the shape of its key rather than by an
exemption this section grants it.

**`tier(ref)` is deliberately unscoped, and that is what keeps this from being circular.**
§2.4 resolves a containment set **under the scope, at the entry's own floor** — so defining
the floor through the scoped set would define the floor from the tiers and the tiers from the
floor. The curator's act runs the other way: the tiers worth chasing are chosen first, the
band is written as exactly their interval, and the floor falls out of them. The unscoped pool
is what the curator can see before a floor exists.

**Alignment is monotone upward in the floor, and that asymmetry is the whole enforcement
story.** Every chosen tier has `itemLevelMin ≤ floor(cat)` by construction, so scoping never
drops the tier that set the floor. Raising the floor further can only add entries to
`contained(ref)`, and a contained entry's interval lies wholly inside the band by definition,
so it can move neither extreme outside the edges: **§2.4 can never be broken by declaring a
floor that is too high.** Lowering it below a chased tier is the opposite — that tier leaves
the scoped set, the extremes shrink inside the band, and §2.4 rejects, which is §2.4's own
"a reference can align at one floor and fail at a lower one".

So of the two directions this section's maxima guard against, **only the low one is caught**:
too low fails §2.4 or §2.5 at load, too high passes every mechanical check in the system while
scoping a wider pool, inflating every denominator and moving the ranked order with nothing
reported (AD-5). Do not read a clean load as confirmation that a floor is the one §8 derives.

Every crafted entry on an `ItemClass` then declares `floor(cat)` — not its own `candidate`
— which is what makes the shared floor AD-17 enforces true by construction rather than by luck.
A **raw entry** is exempt and takes no part in either maximum (AD-17); the level it is pinned at
is a product number the PRD owns and this file does not restate (FR-3, FR-22).

**The two outer maxima are maxima, whatever `needs` returned.** Within an entry, taking the
lower of two affixes' requirements would declare a floor on which one of the two affixes cannot
appear at all, so the chase is unreachable on the very items the search returns. Across entries
the same argument runs one level up: a class carries one floor, so it must be the floor on
which every crafted entry's chase is reachable.

**The derivation reads the band, never the label.** `acceptedTier` describes the same tier in
words, but it is a display-only free string that nothing validates or joins to the weights file
(AD-5). A derivation parsing `"T1–T2"` for an item level would re-open exactly that join, and
would silently follow a typo. The band is the binding statement of which tier is chased; the
label is a caption on it.

**On a run of adjacent tiers, the operative reason is scope, not reachability.** Any roll inside
the band satisfies the search, so reachability alone would argue for the run's *lowest* level —
which is exactly the argument that holds for a valueless reference and fails here. What forbids
it is that the band's edges reach to the rarest tier's extreme, and §2.4 compares those edges
against whatever is in scope (AD-17).

**Where no conforming `weights.json` exists yet**, `tier(ref)` has nothing to resolve against and
the curator declares the floor from the same game data the producer mirrors. The rule is
unchanged; only its evidence is. **Re-derive on the first conforming file**, and on any
regeneration that moves a tier's `itemLevelMin`. A floor derived from game knowledge that
disagrees with the file is not a quiet drift: the same disagreement surfaces at load as an
edge-alignment or empty-containment-set failure against the scoped pool (§2.4, §2.5), which
`web` reports and `sync` treats as a run-start abort (AD-12, AD-17). Leaving the number alone
converts a curation fix into a cross-file gate failure.

**Raising a floor is never free.** The floor scopes the eligible pool before any probability is
computed (AD-11, AD-17), so it is a valuation input and not only a search parameter: a higher
floor admits more tiers into the pool and moves the ranking, on a row whose visible change is
only an item level.

---

## 9. The recipe's modifier-level floor (AD-17, AD-3)

A `CraftRecipe` declares `modifierLevelMin`, the game's *Minimum Modifier Level*. The orb
cannot produce a modifier below it, so the pool that recipe draws from is the entry's scoped
pool with those tiers removed and the remainder renormalised.

```
eligible(entry, recipe) = { w ∈ pool(entry) :
                              w.itemLevelMin ≥ recipe.modifierLevelMin }

W(entry, recipe)        = Σ { w.weight : w ∈ eligible(entry, recipe) }

P(ref | recipe)         = ( Σ { w.weight : w ∈ contained(ref) ∩ eligible(entry, recipe) } )
                          ─────────────────────────────────────────────────────────────────
                                              W(entry, recipe)
```

`pool(entry)` is the scoped pool §8 and AD-11 already define — the item class's pool at the
entry's own `itemLevelMin`, looked up at `bases[categoryId][className][slot]` (AD-5). **The recipe's floor is applied to that pool, never to the
unscoped one**, and the order matters: scope first, truncate second, renormalise third.
Renormalising before truncating leaves a denominator that no longer sums its own numerators.

**Both bounds are the same axis, and this is the one place a builder will assume otherwise.**
A tier is eligible when

```
recipe.modifierLevelMin  ≤  w.itemLevelMin  ≤  entry.itemLevelMin
```

The lower bound is the orb's reach and the upper bound is the item's level; a weights tier's
`itemLevelMin` *is* the modifier's level (`WEIGHTS-FILE-SCHEMA.md`), which is the quantity the
orb's floor names. Reading them as two different ladders produces a pool that is silently wrong
in one direction and never errors.

**`modifierLevelMin` is `0` for a recipe that imposes no floor** (AD-3), so a plain orb runs
this predicate and changes nothing — `eligible` is `pool` and the renormalisation is by the
same total. There is no separate no-floor code path to get wrong.

**An empty `eligible` set is a reason, not a zero.** If no tier survives — a perfect orb's
floor of 70 against an entry whose `itemLevelMin` is 65 — `W` is `0`, the division is
undefined, and `core` returns that `(itemClass, recipe)` pair as **unrankable with that reason**
(AD-17). It never returns `P = 0`. A zero would rank the pair at `−craftCost`, placing an
impossible craft in the ordering among merely unprofitable ones, and the player would read it
as a bad craft rather than a craft this orb cannot perform on this item.

**Truncation happens after containment and before coverage is read, not instead of either.**
`contained(ref)` is resolved against `pool(entry)` by §2.4's own rule, and only the
intersection above removes tiers; a reference that fails edge alignment fails it identically
under every recipe, because alignment is a statement about the band and the scoped pool. AD-27
coverage is likewise measured on the unrestricted pool — a recipe that cannot reach a tier has
not made the producer's file less complete.

**The floors are data.** Greater transmutation and greater augmentation declare `44`, perfect
orbs declare `70`, and both numbers live in `data/recipes.json` where the player maintains
them, never here and never in the spine. A patch that moves a floor is a data edit (AD-3).

---

## 10. The class discriminator (AD-5, AD-16, AD-25)

AD-16's crafted search reaches the entry's item class, not merely its category. This section
states how `sync` derives the filter that reaches it, from the entry's `className` alone.

**`sync` owns this and `core` never sees it.** The discriminator is a search-construction
concern, and search construction is `sync`'s (AD-1's shell/core split). `core` ranks the pool
the entry names and is indifferent to how the price was gathered.

### 10.1 Why the derivation reads `className` at all

Three sources could have carried the discriminator and two were rejected on 2026-09-20:

| Source | Rejected because |
| --- | --- |
| The **weights producer** declares it per pool | It is a trade-API concern, and the producer knows nothing about the trade API. The contract would acquire a field whose correctness no producer can check. |
| The **curator** declares it per tracked entry | It is derivable, so declaring it invites a per-entry transcription error on every crafted entry — and the curator would be hand-copying a fact the class name already states. |
| **`sync` derives it from `className`** | **Adopted.** `sync` owns search construction and already holds the entry. |

The cost is explicit: **`className` stops being opaque.** `WEIGHTS-FILE-SCHEMA.md` `5.1.0`
therefore raises its grammar to a normative rule, which is what makes this a read of a
contracted key rather than a parse of a foreign string. **Nothing else in the system reads
`className` structurally** — the pool lookup and the cross-file gate both treat it as an
atom (AD-17).

### 10.2 The grammar and the three arms

```
discriminator(className) =

  arm 1 — DEFENCE   className matches  <family>_<letters>
                    where <letters> is a '_'-separated, non-empty sequence
                    drawn from { str, dex, int } without repetition — the
                    split takes the MAXIMAL trailing run of such tokens,
                    greedy from the right
                 -> equipment_filters.filters with, for each of the three:
                        str -> "ar"      dex -> "ev"      int -> "es"
                        present in <letters>  ->  { "min": 1 }
                        absent  from <letters> ->  { "max": 0 }

  arm 2 — TYPE      className is PLAIN, and every class under its categoryId
                    is also plain (WEIGHTS-FILE-SCHEMA.md 5.1.0's own general
                    condition — jewel is today's only measured instance, not
                    a literal test against the string "jewel")
                 -> query.type = className with '_' replaced by ' '
                    VALIDATED against catalogue/items.json before sending

  arm 3 — NONE      className is plain, and its categoryId carries
                    exactly one class
                 -> no discriminator; type_filters.category is already exact

  otherwise      -> cannot arise against a file that has already passed
                    WEIGHTS-FILE-SCHEMA.md's distinctness and no-mixing hard
                    errors (see the note after §2.6 below)
```

Arms are tried **in order**, and the order is not cosmetic: arm 1 is keyed on the class name
and arm 2 on the category's composition, so a future `jewel`-shaped class carrying a defence
suffix would be caught by arm 1 — which is the correct answer, since a defence signature is
exact where it applies and `query.type` narrows to a single base type.

**Arm 2 is the file's general rule, not a special case for `jewel`.** The condition is the
*category's composition* — every class under it is plain — not the literal string `"jewel"`.
A future patch adding a second all-plain fan-out category takes arm 2 exactly as `jewel`
does today, with no code change; hardcoding the comparison against `"jewel"` would silently
fall through to "otherwise" for that new category, for a class that is in fact exactly as
discriminable as `jewel` is.

**Arm 1 emits all three keys, always** — the present ones at `min: 1` and the absent ones at
`max: 0`. Emitting only the present ones is the defect this note exists to prevent: `ev`/`es`
at `min: 1` admits a str/dex/int chest as readily as a dex/int one, so a partial signature is
inclusive where the whole point is exclusivity. §5.1b's captured body emits all three.

**Arm 2's output is a `baseTypeId` and is treated as one.** It is validated against
`items.json` (AD-25) before the search is built; an underscore-to-space substitution that
produces a string the catalogue does not carry marks **that entry** `unresolvable` with a
`baseTypeId` record naming its canonical key, and the chunk continues (AD-25) — never a
search issued in hope, and never a load error: a bad derivation for one entry says nothing
about any other entry. This is the only derived value in the system checked against the
catalogue before use rather than after.

**Arm 2 emits `query.type` and `type_filters.category` together, and that pair is verified**
(§5.1c, captured 2026-09-20 for `Sapphire`). It is not the `sale_type` defect AD-16 withdrew:
the two cannot disagree, because a `Sapphire` is in category `jewel` by construction, so
there is no second predicate reaching for an intent the first already carries. **Emit both.**
The shape is a working search, which is a stronger reason than the redundancy argument that
would have dropped the category rung.

### 10.3 Why the arms are total, and measured

Against `data/weights.json` (`5.0.0`, patch `0.5.5`), measured 2026-09-20:

- **29 categories over 59 classes**; **6 categories fan out**, covering **36** classes.
- **28 classes carry a defence suffix**, and they are *exactly* the non-jewel classes of the
  six fan-out categories — no more and no fewer. Arm 1's reach and the need for a
  discriminator are **coextensive on this file**, which is why arm 3 is safe.
- The remaining **8** fan-out classes are `jewel`'s, and take arm 2.
- The **23** single-class categories take arm 3.

**The families are complete subset lattices**, which is the stronger result:

| Category | Classes | Signature set |
| --- | --- | --- |
| `armour.chest` | 7 | all seven non-empty subsets of {ar, ev, es} |
| `armour.boots` / `armour.gloves` / `armour.helmet` | 6 each | the seven less the triple |
| `armour.shield` | 3 | the three containing `ar` |

No sibling shares a triple, so arm 1 separates a class **exactly** rather than usually. That
is what closed OQ-25 on its second candidate instead of its first.

### 10.4 The pool fact arm 1 rests on

`max: 0` filters the item's **displayed** defence, which includes modifier contributions, so
the arm is only sound if a class cannot roll a flat modifier granting a defence its bases
lack. **It cannot**, and the reason is structural rather than incidental: the defence type
*is* what determines the rollable pool, and the weights file's inner rung is exactly that
pool. `bases["armour.chest"]["Body_Armours_dex"]` holds what a dex chest can roll, and no
energy-shield modifier is in it. A curator cannot author the contradictory entry; were one
authored anyway, §2.5's empty containment set rejects it at load with the reference named.

**Verified, not assumed.** Across all 28 defence-suffixed classes on the conforming file,
**no pool carries a flat modifier granting a defence its class lacks** — zero occurrences,
checked over both slots. **Re-check on a regeneration that adds a class or a modifier
family**, since this is a property of the file rather than of the grammar: a future patch
granting flat energy shield to dex chests would make arm 1 exclude legitimately-rolled items,
and it would do so **silently**, which is the one failure mode in this section that no check
above would catch.

### 10.5 What percent-encoding applies

None here. The discriminator's values ride in the **JSON request body**, not in the path, so
`Time-Lost Diamond`'s space needs no encoding. §5.4's encoding rule applies to the league
segment of a URL and nowhere else — a builder who encodes a body value produces a search for
a base type that does not exist.

---

## 11. Mod-group exclusion across the two draws (AD-17)

A crafted entry's combination is made by one transmute and one augment on a magic item. The
transmute's one affix is drawn by weight from the prefix and suffix pools **combined**; the
augment then draws from the **other** slot's pool with every entry sharing the first affix's
`modGroup` removed (`WEIGHTS-FILE-SCHEMA.md` *The exclusivity rule*). A magic item holds one
affix per slot, so exclusion never acts **within** a slot here; rare items are out of v1.

Let `E_P` and `E_S` be the prefix and suffix `eligible(entry, recipe)` sets of §9, and `W_P`,
`W_S` their totals. Let `C_p = contained(p) ∩ E_P` and `C_s = contained(s) ∩ E_S`; an
**absent** affix contains its whole eligible set, `C = E`. Let `g(e)` be `e.modGroup`, and
`W_X∖G` the sum of the weights in `E_X` whose `modGroup ≠ G`.

```
                 Σ_{e ∈ C_p}  e.weight · Σ{ f.weight : f ∈ C_s, g(f) ≠ g(e) } / W_S∖g(e)
P(p ∧ s)  =   ───────────────────────────────────────────────────────────────────────────
                                        W_P + W_S

                 Σ_{f ∈ C_s}  f.weight · Σ{ e.weight : e ∈ C_p, g(e) ≠ g(f) } / W_P∖g(f)
           +  ───────────────────────────────────────────────────────────────────────────
                                        W_P + W_S
```

The first term is a prefix drawn first, the second a suffix drawn first. **The order is scope
(AD-17), truncate (§9), exclude (here), renormalise.** Excluding before truncating removes
groups against tiers that could never roll, and the denominators stop summing their own
numerators — §9's error again.

**It reduces to §9's product where no group spans both slots.** If no `modGroup` of `E_P`
occurs in `E_S`, every `W_X∖G` equals `W_X` and the two terms sum to `P(p | recipe) ×
P(s | recipe)`. On the 2026-09-26 file that holds for all 59 classes. Tests therefore assert
§11 against the product to 1e-12 relative on every tracked entry of the real file, and assert
§11 against a cross-slot `modGroup` built inside the test itself (no hand-written fixture
file, NFR-2).

**A zero `W_X∖g(·)` under a positive weight is a reason, not a zero.** The augment has nothing
it can add after that first affix, so `core` returns the `(itemClass, recipe)` pair as
unrankable with that reason (AD-17), as §9 does for an empty `eligible` set.

---

## 12. Report record identity (Consistency Conventions, *Logging*)

A record survives the chunk that wrote it, so a chunk that meets the same condition again must
recognise the record already present. **Deep equality is the wrong test**: a record that carries
a live measurement differs on almost every chunk, and the report then grows by one record per
tick for as long as the condition lasts.

Every field of a record is one of two things. A **subject** field names *what is wrong* and is
part of the identity. An **observation** field states *what this chunk measured* and is not.

```
same(a, b)  ⇔  a.kind = b.kind  ∧  subject(a) = subject(b)
```

`sync` carries every earlier record forward in its order. For each new record, if an earlier
record is `same`, the earlier record's observation fields are **replaced** by the new one's and
it keeps its position; otherwise the new record is appended. A replacement is not a clear: only
the player's edit removes a record.

| Kind | Subject | Observation |
| --- | --- | --- |
| `stale-lock-broken` | `pid`, `startedAt` | — |
| `pinned-starvation` | `declaredMinChunkSearches`, `pinnedCount` | `discoveredAllowance`, `pinnedRefreshed`, `activeRefreshed` |
| `unresolvable` | `entryKey`, `identifier`, `identifierKind` | — |
| `weights-absent` | — (the kind alone) | `uncheckableClassNames` |
| `uncatalogued-weights-id` | `identifier`, `identifierKind` | — |
| `cross-file-gate-failure` | `check`, `entryKey` | `detail` |
| `run-failure` | `reason`, `entryKey`, `status` | `message` |
| `league-mismatch` | `configuredLeague` | `availableLeagues` |

An absent optional subject field is a value: two `run-failure` records that both lack
`entryKey` agree on it. A `pinned-starvation` whose yardstick or pinned set changed is a new
record, because the player's correction is exactly a change to one of those two. **The
function is defined once, in `contracts`, beside the record schemas**, so a new record kind
cannot land without declaring its subject.

## 13. The session probe and the auth state (AD-30, AD-8, AD-12)

Only the `pnpm sync` and `pnpm sync:batch` shells run this sequence. `catalogue:refresh`,
`fixtures:record` and `sync:dry` never read `POESESSID`.

### 13.1 Settling before the first request

The shell trims `POESESSID` and builds the process auth holder from it.

- A blank value is `absent`.
- A value outside the RFC 6265 `cookie-value` grammar is `malformed`.

After the lock and the `notBefore` check (§5.3), the run reads `authHoldOffUntil` from
`sync-progress.json`. When `now < authHoldOffUntil`, a valid value is `held-off`.

In these three cases the state settles `unauthenticated` and sync sends no probe.

### 13.2 Baseline, probe and the liveness predicate

```
1. baseline  =  the first pricing search of the process that gets an answer,
                sent without the cookie
2. when baseline.status is 2xx, before that entry's fetch:
     probe   =  the same method, path and body as baseline, sent once with
                Cookie: POESESSID=<value>
3. live(r)  ⇔  r.status is 2xx
              ∧  |names(r.X-Rate-Limit-Rules)|  >  |names(baseline.X-Rate-Limit-Rules)|
```

`names(h)` is the set of comma-separated rule names in the header, trimmed and case-folded.
The predicate compares **counts only**. It never compares names, and no name or count is in
the code (`test/no-hardcoded-rate-limits.test.ts` enforces this).

The baseline's answer is the pricing step's result in every case. The probe's State reading
replaces the pacing values like any other reading (§5.3). The probe's search `id` never
becomes a `lastSearchId`. The probe's request counts under `session-probe` in
`requestsBySource`.

When the baseline gets an answer that is not 2xx, the chunk ends by the existing rules (AD-8,
AD-9), and sync sends no probe. The baseline is then the next answered pricing search. Under
the session, that search is in a later chunk. Under `sync:batch`, it is in the next process.

### 13.3 Probe outcomes and the hold-off

| Probe outcome | State | Invalid-request count | Hold-off |
| --- | --- | --- | --- |
| `live(probe)` | `authenticated` | — | cleared |
| 2xx, not live | `unauthenticated (not-elevated)` | — | written |
| `429` | unsettled. The next request yields with the penalty, and `notBefore` follows §5.3. | not counted | — |
| any other non-2xx | `unauthenticated (probe-rejected)` | not counted | written |
| throw, or the client's ordinary request timeout | `unauthenticated (probe-failed)` | — | — |

After a probe `429`, the probe is eligible again on the next chunk's first answered pricing
search. A probe `429` is the only reason a process sends another probe.

"Written" sets `authHoldOffUntil = now + 24h`. "Cleared" removes the field. Sync writes both
with the chunk's other `sync-progress.json` writes, under the lock (AD-7). The operator can
remove the field to end a hold-off early.

### 13.4 Downgrade

A downgrade is one of these two responses to a request after the probe that carried the
cookie:

- a `401` or `403`.
- a 2xx with `¬live(r)`.

A probe `401` or `403` is `probe-rejected` and is not a downgrade. On a downgrade, the
governor does these four things:

1. It drops the cookie for the rest of the process.
2. It resets the process pacing state (ledger and lane memo) to cold, **in place**, so that
   the session does not take the reset for a fresh State reading.
3. It writes the hold-off.
4. It returns a `session-expired` yield.

The chunk ends `yielded`. The entry stamps `lastAttemptedAt`. An answered search keeps its two
search fields (AD-9), and sync keeps the price state. The chunk writes no `notBefore` and no
report record. The batch command exits 0. The session waits `backoff(1)` (§5.3) and then
continues.

### 13.5 The console line

Each settle and each downgrade prints exactly one line. The line is `authenticated`, or a
warning `unauthenticated (<reason>)`.

| Reason | When |
| --- | --- |
| `absent` | `POESESSID` is unset or blank. The line prints before the first request, on every run. |
| `malformed` | the value is outside the `cookie-value` grammar |
| `held-off` | `authHoldOffUntil` is in the future |
| `not-elevated` | the probe got a 2xx answer that failed `live` |
| `probe-rejected` | the probe got a non-2xx answer other than `429` |
| `probe-failed` | the probe threw or timed out |
| `not-probed` | the process ended with no settle: no 2xx pricing search, or only probe `429`s |
| `expired` | a downgrade (§13.4) |

### 13.6 The value never leaves the holder

No line, error message, thrown value or cause carries the cookie value or any part of it. The
holder refuses a `malformed` value, so no HTTP stack quotes the value in an error. The
governor removes the value from each error it passes on, and from that error's cause chain.

A canary test forces each throw path with a known value. The test then scans stdout, stderr
and every written artifact for any part of that value.

### 13.7 Schema versions and the `User-Agent`

`authHoldOffUntil` is additive, so `sync-progress.json` goes to `1.2.0`. The `session-probe`
source is additive, so `sync-report.json` also goes to `1.2.0`. A reader accepts a `1.1.0`
report that has no `session-probe` key.

For a cookie run, the operator puts a browser string in `POE_SYNC_USER_AGENT` (AD-30). All
shells read the same variable, so `catalogue:refresh` and `fixtures:record` also send that
browser string while the operator keeps it there.
