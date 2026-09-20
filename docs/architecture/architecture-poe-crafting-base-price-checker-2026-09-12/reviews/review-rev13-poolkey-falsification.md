---
title: 'Falsification review — the weights-file pool key vs. every consumer predicate'
type: review
status: final
created: '2026-09-19'
scope: 'Adversarial finding F1 (review-rev13-adversarial.md) — attempt to kill it'
verdict: CONFIRMED
---

# Falsification review — `bases` keying vs. `pool(base, slot)`

**Brief.** Try to kill the reported critical. A prior reviewer in this project has produced
five recorded false positives by composing two rules without reading the clause that
governs the composition. This review hunted for that clause across the whole repo.

**Result: the clause does not exist.** The finding survives every falsification route
tried, and the search turned up *additional* evidence the reviewer did not have.

---

## 1. `WEIGHTS-FILE-SCHEMA.md` read in full — no base type anywhere inside or beside a pool

The governing clause, and the only statement in the system that says what a pool is keyed
on (`WEIGHTS-FILE-SCHEMA.md:193`, *Field rules*):

> | `bases` key | **Two levels.** Outer key is a trade category filter id (`categoryId`),
> spelled exactly as the trade category filter list spells it. Inner key is the poe2db
> `className` verbatim (never a derived display label) that resolved to that `categoryId` --
> `className -> categoryId` is many-to-one (e.g. six armour `className`s collapse to
> `armour.gloves`), so one `categoryId` can carry several distinct `className` sub-keys,
> each with its own `{prefix, suffix}` pools. There is no cross-class ownership guard:
> `(categoryId, className)` cannot collide because `className`s are already distinct.
> Validated report-only by `sync` (AD-6, AD-25); a base absent from the file is unrankable. |

Checked and found absent:

- **No entry field carries a base type.** An entry is `sourceModifierId`, `itemLevelMin`,
  `tierLabel`, `weight`, `weightSource`, `lines[]` (`:186–203`). Nothing names a base.
- **No third key level, no `baseTypes` list beside a pool.** The worked example (`:117–184`)
  goes `bases → "weapon.bow" → "Bows" → "prefix" → entries`. There is no rung for
  `"Guardian Bow"`.
- **No producer expectation supplies it.** *Producer expectations* (`:228–232`) asks only
  for a per-class resolution count.
- **No validation rule touches it.** The hard-error list (`:210–220`) and the not-a-file-error
  list (`:222–226`) never mention a base type; the surviving mention —
  *"an uncatalogued `statId` or `bases` key"* (`:225`) — is now unsatisfiable as written,
  because the `bases` key is a `categoryId` and `categoryId`s are not in
  `catalogue/items.json`'s base-type list at all (see §5 below).

### Is the pool per class *by design*, making the join a class lookup?

Partly — and this is the one place the finding is slightly over-stated, so it is recorded
here rather than suppressed.

The file's own uniqueness clause — *"`(categoryId, className)` cannot collide because
`className`s are already distinct"* (`:193`) — makes the **outer** `categoryId` rung
**functionally redundant** for lookup. A consumer may ignore it and search the union of
inner keys. So there is one load-bearing missing mapping, not two:
`baseTypeId → className`.

That is the only mitigation found, and it does not reach the finding's core. It reduces two
unsourced mappings to one, and the surviving one is the *harder* of the two: `categoryId`
is at least a trade-API concept that appears in `catalogue/filters.json`, whereas
**`className` is a poe2db concept that appears in no trade artifact, no catalogue endpoint,
and nowhere else in this repository** (§4).

### The schema contradicts itself on this exact point

*The pool-completeness rule* (`:105`) still reads:

> - A **`(baseTypeId, slot)` entry** that declares `poolCoverage: "complete"` **must enumerate
>   every modifier that can roll in that slot on that base at any item level.**

and *What the file is and is not* (`:82–84`):

> **The file is** raw game modifier spawn weights, reported per tier exactly as poe2db
> publishes them, **per base type and affix slot.**

Both are residue from the `4.x` keying. Under `5.0.0` there is no `(baseTypeId, slot)`
entry in the file, so the completeness rule's own subject does not exist in the shape the
same document specifies eighty lines later. **The document states two incompatible pool
keys.**

---

## 2. Spine — `ARCHITECTURE-SPINE.md`

Every consumer-side predicate takes a base and never a class:

- **AD-17** (`:845`): `scoped(base, slot, L) = { entry ∈ pool(base, slot) : entry.itemLevelMin <= L }`.
  `pool` is applied to a base. AD-17 never defines `pool`.
- **AD-17** (`:930`): *"A base absent from the weights file is likewise unrankable on that
  branch; `core` has no other pool source and must not invent one."*
- **AD-11** (`:591–598`) governs the file's *shape* and *reading*, not its keying. The words
  `className`, `categoryId` and "class" appear nowhere in AD-11.
- **Core entities** (`:1301`): `BaseType ||--o{ ModifierWeight : "eligible pool"` — the ER
  model hangs the pool off `BaseType` directly, with no class entity in between.
- **`TrackedEntry` carries no class, category or pool key.** AD-5 (`:246`):
  *"A tracked entry is `(baseTypeId, itemLevelMin, prefix?, suffix?)`"*; the canonical key
  (Conventions `:1193`, §4.1) is `(baseTypeId, itemLevelMin, prefixBand, suffixBand)`.
  Nothing in `contracts` holds a class.
- **`Ids` convention** (`:1191`): *"`baseTypeId` is the `type` string exactly as `data/items`
  spells it. Internal surrogate ids are forbidden."* A `className` would be exactly such a
  surrogate, and no AD introduces one.
- **AD-25** (`:1116–1122`): *"The catalogue is an identity and validation authority, and
  never a pool authority… The catalogue carries no per-base association."*
- **AD-24** (`:1030–1036`) withholds `catalogue/items.json` **and** `catalogue/filters.json`
  from `web`, and AD-4 (`:213–221`) puts ranking in the browser. So even a mapping that
  existed sync-side would be unreachable where `pool(base, slot)` is evaluated.
- **AD-9** (`:423–424`) still instructs `sync` to check *"every `statId` / `baseTypeId` in
  `data/weights.json` exists in the catalogue."* Under `5.0.0` keying **the weights file
  contains no `baseTypeId`**, so half of that check has lost its subject too — a second,
  independent symptom of the same defect.

**No AD states how a base reaches its pool.** Verified by reading AD-5, AD-11, AD-17,
AD-24, AD-25, Core entities and Consistency Conventions in full.

---

## 3. Is `IMPLEMENTATION-NOTES.md` §5.2 trap 1 the same mapping?

Trap 1 (`IMPLEMENTATION-NOTES.md:330–333`):

> 1. **The base type is `query.type`, not `type_filters.category`.** `category` takes taxonomy
>    ids such as `weapon.bow`, not base type names, and **no committed artifact maps a base
>    type to its leaf category** — `data/items` groups only ten coarse labels. **Do not attempt
>    that mapping.**

Assessment — the reviewer's use of trap 1 is **conservative, not overreaching**:

- Its *context* is trade-search construction, so one could argue the prohibition is scoped
  to the adapter. But its *stated ground* is a fact about committed artifacts
  (*"no committed artifact maps…"*, *"`data/items` groups only ten coarse labels"*), which
  is context-free and is the fact that matters here.
- The mapping it names — base type → leaf trade category, e.g. `"Guardian Bow"` →
  `weapon.bow` — is **exactly the weights file's outer key**. Trap 1 therefore forbids, by
  name, computing the outer rung of the pool address.
- Trap 1 does **not** cover the inner rung. `className` is not a trade taxonomy id at all;
  trap 1 does not forbid that mapping because no document has ever contemplated it. That is
  worse for the finding's target, not better: the surviving load-bearing mapping (§1) is the
  one with *no* artifact, *no* prohibition and *no* decision record.

So: **same mapping at the outer level, an additional unaddressed mapping at the inner
level.** Trap 1 does not supply the join anywhere; it forbids half of it.

Also read in full and found silent on the join: §1 (interval derivation), §2 (valuation —
`coOccur` at `:130` reads `scoped(base, slot, L)`, inheriting AD-17's undefined `pool`),
§3 (`covered(base) = base is PRESENT in weights.json`, `:206`), §8 (`tier(ref)` over
*"the reference's `(base, slot, statId)`"*, `:479`).

---

## 4. Repo-wide search — no prior decision settles this

- `grep -rln "className" docs/` returns **exactly two files**:
  `WEIGHTS-FILE-SCHEMA.md` and `reviews/review-rev13-adversarial.md` (the review raising
  the finding). The word appears in no AD, no PRD, no story, no UX doc, and **in neither
  `.memlog.md`**.
- `categoryId` appears only in `WEIGHTS-FILE-SCHEMA.md:193` and the same review.
- **The keying change is undocumented and is mislabelled as a non-change.** The `5.0.0`
  change table (`WEIGHTS-FILE-SCHEMA.md:53`) states:

  > | `bases` keying, `producer` block, `gamePatch` requirement | **Unchanged from `4.x`.** |

  It is not unchanged. The previously committed text (`git show
  ad2986d:…/WEIGHTS-FILE-SCHEMA.md`, line 194) read:

  > | `bases` key | **A trade API base type `type` string, spelled exactly as `data/items`
  > spells it.** Validated report-only by `sync` (AD-9, AD-25); a base absent from the file
  > is unrankable. |

  and the `4.x`-era text before that (`git show 1e48156:…`, line 352) read:

  > | `bases` key | A trade API base type `type` string, spelled exactly as `data/items`
  > spells it, **for example `"Guardian Bow"`** … |

  The single-level `baseTypeId` keying was the contract from `2.0.0` through the last
  committed `5.0.0`. It became two-level `(categoryId, className)` in commit **55fe390**
  (*"docs: PRD revision 14, plus the pending planning working tree"*), inside a diff of
  181 lines to this file, under a change table asserting the keying was untouched. **No
  memlog entry, no AD amendment, no sprint-change proposal records the decision.** This is
  the opposite of a reviewer composing two rules without reading the governing clause: the
  governing clause was silently replaced and the replacement was announced as a no-op.
- The PRD, which owns the player-facing model, still describes the pool per base type —
  `prd.md:93`: *"**Eligible Pool** — the set of Modifier Weights that can roll in **one Base
  Type** and slot"*; `addendum.md:112`: *"the Weights File model one pool per
  `(baseTypeId, slot)`, flat."* Nothing in the PRD contemplates a class rung.

---

## 5. The committed fixture confirms the gap empirically

`data/weights.json` (untracked but present, `schemaVersion: "5.0.0"`, producer
`poe-mod-weights-producer`) has 29 outer keys, all trade taxonomy ids —
`accessory.amulet`, `armour.gloves`, `weapon.bow`, `jewel`, … — and inner keys that are
poe2db class names (`"Amulets"`). **The string `"Guardian Bow"`, or any other
`baseTypeId`, does not appear as a key anywhere in the file.** A builder holding
`tracked.json`'s `baseTypeId` and this file has no expression that reaches a pool.

No `data/tracked.json` exists yet, so no fixture demonstrates the intended lookup either.
`data/catalogue/` is not present. `data/mods.json` is deleted in the working tree.

---

## 6. Falsification routes tried, and why each failed

| Route | Result |
| --- | --- |
| A field or list carrying base types beside a pool | **None.** §1. |
| Pool is per class by design, so no base key is needed | **Half-true, insufficient.** It removes the outer rung (`:193`'s uniqueness clause) but leaves `baseTypeId → className` unsourced. §1. |
| An AD states the join | **None.** AD-5/11/17/24/25, Core entities, Conventions all read. §2. |
| `TrackedEntry` carries a class or pool key | **No.** AD-5 `:246`, Conventions `:1193`, §4.1. §2. |
| Trap 1 is a *different* mapping, so it does not bite | **No** — it is the same mapping at the outer rung, and silent on the inner. §3. |
| `catalogue/items.json` supplies it (sync-side) | **No** — trap 1: *"`data/items` groups only ten coarse labels"*; and AD-24 withholds it from `web`, where ranking runs (AD-4). §2, §3. |
| `catalogue/filters.json` supplies it | Carries *filter ids + options* (AD-25 `:1110`) — the category option list, not a base→category association. Also not in `web`'s fetch set. |
| A prior decision settled it (memlog / git / PRD / stories / UX) | **None exists**; the change is recorded as *"Unchanged from `4.x`"*. §4. |
| The `5.0.0` two-level keying is a producer-side draft not yet adopted, so nothing binds | **Does not resolve it.** The banner (`:11–18`) claims this file lives in the producer repo and is gitignored — yet it sits committed at the consumer repo's authoritative path, AD-11 `:512` binds `core` to *"a file conforming to `WEIGHTS-FILE-SCHEMA.md` **`5.0.0`**"*, and AD-0 `:135` makes it *"the weights contract itself"*. The banner is a further inconsistency, not a carve-out; and the committed `data/weights.json` is already two-level. |

---

## 7. The divergence, restated precisely

Two conforming builders, both satisfying every committed rule:

- **Builder A** ignores the outer rung (permitted by `:193`'s uniqueness clause), guesses
  `baseTypeId → className` from base-name morphology or a hand-written table. Ranking runs.
- **Builder B** reads §3's `covered(base) = base is PRESENT in weights.json` literally,
  tests `baseTypeId ∈ keys(bases)`, finds **every** base absent, and reports
  `coverage = 0`.

Builder B's path is not hypothetical: AD-27's absent-file carve-out (`:1140–1145`) applies
only where `data/weights.json` is **absent**. A file that is present but in which no base
resolves yields a defined `0%`, landing in AD-27's

> | **< 50%** | The ranking premise fails. **Escalate rather than ship** … |

band. So the same two files produce, from two conforming readings, either a full ranking or
a ship-blocking escalation — with every artifact schema-valid and nothing reported. That is
the precise failure class AD-0, AD-17 and AD-27 exist to prevent.

---

## Verdict — **CONFIRMED**

**Governing clause (the one that resolves nothing), `WEIGHTS-FILE-SCHEMA.md:193`:**

> | `bases` key | **Two levels.** Outer key is a trade category filter id (`categoryId`),
> spelled exactly as the trade category filter list spells it. **Inner key is the poe2db
> `className` verbatim** (never a derived display label) that resolved to that `categoryId`
> … Validated report-only by `sync` (AD-6, AD-25); **a base absent from the file is
> unrankable.** |

**against `ARCHITECTURE-SPINE.md` AD-17:849 (`:845`):**

> `scoped(base, slot, L) = { entry ∈ pool(base, slot) : entry.itemLevelMin <= L }`

**and `IMPLEMENTATION-NOTES.md` §3 (`:206`):**

> `covered(base)  = base is PRESENT in weights.json`

### The minimal missing fact

**How a `baseTypeId` resolves to its pool in `weights.json`** — a single mapping,
`baseTypeId → className` (the outer `categoryId` rung is already redundant by the file's own
uniqueness clause).

### Who owns it

One of three, and the choice is a spine decision, not an editorial fix:

1. **`WEIGHTS-FILE-SCHEMA.md`** — re-key `bases` on `baseTypeId` (restoring the contract
   that held from `2.0.0` to the last committed `5.0.0`), or add a `baseTypes: []` list
   beside each `(categoryId, className)` pool. Cheapest; needs no other document to move,
   and repairs `:105`, `:82` and AD-9's weights-side `baseTypeId` check at the same time.
2. **`ARCHITECTURE-SPINE.md` AD-24** — admit a ninth fetched artifact carrying the mapping.
   Explicitly an amendment (*"A ninth artifact requires an amendment to this AD"*, `:1036`),
   and it must also relax `IMPLEMENTATION-NOTES.md` §5.2 trap 1's unqualified *"Do not
   attempt that mapping."*
3. **`ARCHITECTURE-SPINE.md` AD-5 + `contracts`** — put the class on `TrackedEntry`. Collides
   with the `Ids` convention's ban on internal surrogate ids (`:1191`) and with the canonical
   key (`:1193`), so it is the most expensive route.

### Two defects found in passing, independent of which route is taken

- **`WEIGHTS-FILE-SCHEMA.md:53`** asserts *"`bases` keying … **Unchanged from `4.x`**"* while
  `:193` changed it. The change table is how a producer learns what to rebuild; as written it
  tells the producer the one thing that did change did not.
- **`WEIGHTS-FILE-SCHEMA.md:105` and `:82`** still specify the pool per `(baseTypeId, slot)`.
  Whichever way the join is decided, these two must move with it, or the document keeps
  stating two incompatible pool keys.
