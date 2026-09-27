---
title: 'Weights File Contract'
status: final
governed_by: AD-17
schemaVersion: '6.1.0'
created: '2026-09-12'
updated: '2026-09-27'
---

# Weights File Contract

> **This is the authoritative contract**, owned by this repo (`poe-crafting-base-price-checker`)
> and binding under the spine's AD-0 ("the weights contract itself"). `6.0.0` is adopted, as
> of spine revision 19: `modGroup`, the per-stat `tierLabel` rule, the exclusivity rule and
> the `className` grammar below are normative, enforced rules, not pending proposals. A
> separate working copy may still exist inside the external `poe-mod-weights-producer` scraper
> project for that project's own iteration, but that copy
> is not authoritative and is not this file — this file is what the producer must satisfy and
> what `sync`/`core` validate against. The decision trail for `5.1.0` and `6.0.0` is
> recorded in this repo's `.memlog.md` (revisions 16–17, 19); the producer-side proposal
> documents that preceded them were never part of this repository and are not cited here.

The app **consumes** this file. The app never produces this file (AD-11). Any producer
that satisfies this contract is acceptable. The app does not depend on which producer
wrote the file.

**This file is a prerequisite.** The trade API cannot supply the data that this file
carries. See *Why this file has to exist* below. The app therefore cannot rank any base
type until a conforming file is present. The intended producer is a separate scraper
project. This document is the contract that the scraper project must satisfy.

## 6.1.0 — not-in-game tiers and internal lines

**Additive.** No field is added, removed or reshaped; `weightSource` gains one value and a
`statId: null` line gains two sanctioned meanings. A reader implementing only `6.0.0`
will refuse a file carrying `not-in-game`, because its own hard-error list rejects any
`weightSource` other than `published`/`absent`; a consumer must implement `6.1.0` to accept it.

| Change | Reason |
| --- | --- |
| New **`weightSource: "not-in-game"`**, with **`weight` forced to `0`** | poe2db lists a few modifiers that cannot roll in game (the Incision-chance and Daze-chance jewel mods: the trade catalogue carries only a different, boolean stat for each). They stay in the file as one entry per tier, with `sourceModifierId`, `modGroup` and verbatim `ranges`, but can never be drawn. This is the **one** exception to publishing `DropChance` verbatim. The list is hand-kept by the producer, never inferred from an unmatched line. |
| A `statId: null` line inside a **`complete`** pool is either **not-in-game** or an **internal engine line** | An internal line (`local jewel effect base radius [#]`) is poe2db leaking a raw engine stat next to a real one; it has no trade stat of its own and never changes the tier's weight. Neither kind is a gap in the pool, so neither makes it `partial`. Any other `null` line still does. |
| New hard error: `weightSource: "not-in-game"` with a non-zero `weight` | The marker exists only to say "cannot roll"; a non-zero weight contradicts it. |

**The producer-6.1.0 file of 2026-09-27** has 0 of 118 pools `partial`: 8 tiers are
`not-in-game`, 8 lines are internal, and no line is unresolved.

## 6.0.0 — modGroup and per-stat tierLabel

**Breaking.** Every entry gains a required `modGroup`, and `tierLabel` is renumbered. `core`
implements `6` and refuses a `5.x` file as an unknown major (spine AD-11).

| Change | Reason |
| --- | --- |
| New required field **`modGroup`** on every entry, poe2db's `ModFamilyList` value verbatim | The family is the game's **mutual-exclusion group**: an item holding a modifier from one group cannot roll another from it. Roll-odds math has to know it, and in `5.x` it reached the file only inside the opaque `sourceModifierId`. See *The exclusivity rule*. |
| `tierLabel` is **numbered per stat within `(slot, modGroup)`, T1 = highest `itemLevelMin`** | `5.x` numbered a whole family ascending by item level, so distinct stats in one group shared one run (Amulets suffix `IncreaseSocketedGemLevel` ran T1–T12 across four stats, and +3 Spell Skills came out as T9). Now each stat in a group has its own T1-first run, matching PoE2's in-game convention. |
| Nothing else | `sourceModifierId`, weights, ranges, `statId`s, ordering, `poolCoverage`, **the `5.1.0` `className` grammar and every `5.x` hard error** are unchanged. The producer emits no group totals, per-group probabilities or adjusted weights. |

**The producer-6.0.0 file of 2026-09-26 satisfies this revision.** All 8,437 entries carry
`modGroup`, 53 of 1,758 groups hold more than one stat, **no `modGroup` appears in both slots
of any of the 59 pools**, and the grammar and every hard error pass.

## 5.1.0 — the inner key's grammar becomes normative

**Additive, and minor rather than major on purpose.** No field is added, removed or
reshaped, and **the conforming file of 2026-09-19 already satisfies this revision
unchanged** — verified against all 59 classes on 2026-09-20. What changes is that a rule
the producer was already following by convention is now one a consumer may rely on.

**Why a consumer needs it.** Spine revision 17 moved the ranked crafted unit to the **item
class**, and closed **OQ-25** by having the trade search reach that class exactly rather
than pricing across its siblings. The filter that reaches it is derived from the **inner
`className` key** — a defence signature for an armour class, the class's own base type for a
jewel (spine AD-16, `IMPLEMENTATION-NOTES.md` §10). That derivation reads the key's
structure, so the key's structure has to be a contract term rather than a habit. **Without
this revision the consumer would be parsing a string the contract calls opaque**, and a
producer renaming a pool would silently change which items get priced.

| Change | Reason |
| --- | --- |
| The inner `className` key must match one of **two grammars**: a **defence-suffixed** name `<family>_<letters>`, where `<letters>` is a `_`-separated non-repeating sequence over `str` / `dex` / `int`; or a **plain** name carrying no such suffix | These are the two shapes the source already produces. The first encodes the class's defence type — `str` armour, `dex` evasion, `int` energy shield — which is the fact the consumer's search filter needs. |
| **Every class of one fan-out category must be distinguishable** by its grammar: the defence-suffixed classes of one `categoryId` carry **distinct** letter sets, and a `categoryId` does not mix defence-suffixed and plain classes | This is what makes the derived filter exclusive rather than merely inclusive. It holds on the conforming file by construction — the armour families are complete subset lattices — so it is a rule that documents reality rather than one that asks for work. |
| A **plain** `className` under a `categoryId` whose classes are all plain (today: `jewel`) is a **base type name with spaces written as underscores** | The consumer isolates such a class by `query.type`, and validates the result against the trade catalogue before sending it, so a name that is not a real base type fails loudly at load. |

**This is a producer obligation with no new producer work**, and the rule is written so that
a future patch which breaks it fails at the file rather than as a quietly wrong price. That
is the same treatment `5.0.0` gave the three-`#` stat line.

## 5.0.0 — what changed and why

**Breaking.** This revision removes most of `4.0.0`/`4.1.0`'s hard errors and most of
the fields that existed to support them. A `4.x` file is not a conforming `5.0.0` file,
and a `5.0.0` file is not a conforming `4.x` file.

The producer's own decomposition machinery — value-cell partitioning, mass conservation,
group-consistency checking, largest-remainder rounding — was judged not worth its
complexity for the value it returned. `4.x` asked the producer to turn poe2db's raw,
verbatim spawn weights into a derived, conserved, re-normalised layer, entirely so the
consumer wouldn't have to. `5.0.0` inverts that: the producer reports poe2db's numbers
as published, plus trade-API identity, and nothing else. Whatever weighting, averaging,
or interval math the consumer's ranking needs, the consumer now does directly against
raw tier data.

| Change | Reason |
| --- | --- |
| Entries are **tiers again, not cells** — one entry per poe2db row, never split by value interval | The whole reason `3.0.0` introduced cells was to resolve tier overlap for two-number stats without collapsing it. `5.0.0` accepts that overlap exists and leaves it in the raw data; the producer no longer resolves it at all. A consumer that needs disjoint intervals now computes them itself from the tier list. |
| `cohortTotals`, the conservation check, and the group-consistency check are **removed** | These existed solely to audit the cell-decomposition math. With no decomposition, there is nothing to audit. Their removal is not a relaxation of a check the producer still needs to pass — the operation they audited no longer happens. |
| `provenance` is **removed** | `provenance` existed to distinguish `measured` (poe2db data) from `modelled-split` (the producer's own interval math) from `uniform-prior` (no data at all). With no modelling step, only the last distinction remains, and `weightSource` (see below) already states it. A separate `provenance` enum with one live value left is not worth keeping. |
| New field **`weightSource`**: `"published"` \| `"absent"` per tier | Carries forward, unchanged, the upstream producer's own signal for whether poe2db published a real `DropChance` for this tier (a JSON string) or supplied a filler (a JSON number). Replaces `provenance`'s weaker two-state distinction with the actual upstream fact it was standing in for. |
| A tier's stat lines are grouped under **`lines`**, each carrying its own `statId` and verbatim `ranges` | Replaces the `sourceModifierId`-grouped flat-entry model. A tier with two distinct stats (a hybrid modifier) is one entry with two `lines`, never two entries sharing an id. A tier with one stat that rolls two numbers is one entry with one line holding two ranges. See *Shape* below. |
| `valueMin`/`valueMax` are **removed**; replaced by verbatim `ranges: [[min, max], ...]` per line | The producer no longer derives a single filter-comparable value from a two-number stat (the old "average of two numbers" rule). It reports the numbers as poe2db prints them. Deriving whatever value the trade filter actually compares against is now the consumer's job. |
| `statLineCounts`, `poolCoverage`'s coupling to the cell math, `tierLabel` matching rules | `statLineCount` is superseded — a tier's line count is just `lines.length`, already on the entry, needing no separate field. `poolCoverage` is retained (see *Field rules*) but is no longer entangled with cohort/cell bookkeeping — it now states only whether the producer believes it enumerated every modifier in the pool. `tierLabel` is unchanged: display-only, never a matching key. |
| `bases` keying is **two levels**, `(categoryId, className)` | **Changed from `4.x`**, which keyed a single level on the base type `type` string. A pool is published **per item class**, because that is the granularity poe2db publishes at and the granularity the game rolls at — every base type of one class shares one pool. The single-level key asserted a per-base pool that never existed. A `baseTypeId` never reaches a class: spine **OQ-23** asked how it would and was closed 2026-09-20 by withdrawing the question — a crafted tracked entry names `(categoryId, className)` itself (spine AD-5), and only an uncrafted base is tracked by `baseTypeId`. |
| `producer` block, `gamePatch` requirement | Unchanged from `4.x`. |

## 4.1.0, 4.0.0, 3.0.0, 2.0.0 — superseded history

These four revisions built and then were superseded by the decomposition approach
`5.0.0` removes above. Their measurements remain true of the underlying poe2db data —
560 of 8,437 in-scope rows publish several stats at once, 53 of 63 item classes carry a
two-number modifier, etc. — they just no longer drive this contract's shape. Their full
text is not reproduced below, to avoid describing machinery this contract no longer
specifies; this file **is** git-tracked in this repo, and the authoritative record of the
full `2.0.0`–`4.1.0` text is this document's own git history here.

## Why this file has to exist

Verified on 2026-09-12 against the live endpoints. The endpoint
`https://www.pathofexile.com/api/trade2/data/stats` returns a **flat global list** of
3,108 explicit stat ids. Each stat id has the shape `{id, text, type}` and carries
nothing else. The trade API has no per-base-type association, no tier concept, no
`required_level` and no spawn weight.

The app can therefore learn *that* `explicit.stat_1509134228` exists, and can learn the
text of that stat. The app does learn both, from the catalogue (AD-25). The app cannot
learn **which modifiers can roll on a Guardian Bow prefix, at what item level, or how
often**. To supply those three facts is the entire job of this file. No number of trade
API requests can replace this file.

## What the file is and is not

**The file is** raw game modifier spawn weights, reported per tier exactly as poe2db
publishes them, per **item class** and affix slot. Each entry names one poe2db tier
(`sourceModifierId`) and carries one or more stat lines under `lines`, each resolved to
a trade API `statId` where a match exists.

**The file is not** decomposed, cut, conserved, or rounded. `core` (or whatever
downstream ranking logic consumes this file) receives the same overlapping,
tier-shaped data poe2db published, and is responsible for whatever interval or
averaging math its own ranking needs.

**The file is not** probabilities. Normalising raw weights into `P(modifier | base,
slot, itemLevel)` is entirely a consumer concern.

**The file is not** recipe-aware. Perfect and greater transmute and augment recipes
change the tier distribution; that is a consumer concern.

**The file is not** deduplicated across cohorts. Two tiers of one family that overlap in
value range are both reported, unmodified, exactly as poe2db lists them.

## The pool-completeness rule

Unchanged in spirit from `4.x`, decoupled from the removed cell machinery.

- A `(categoryId, className, slot)` pool that declares `poolCoverage: "complete"` **must
  enumerate every modifier that can roll in that slot on that item class at any item level.**
- A producer that cannot guarantee that enumeration declares `poolCoverage: "partial"`.
- **An unnamed placeholder row still counts as missing.** A source that publishes a
  blank placeholder (e.g. poe2db's `TBD` rows) and is dropped by the producer's
  placeholder policy makes that pool `partial`, not `complete`.
- **(`6.1.0`) A `statId: null` line makes its pool `partial`** unless the producer's
  hand-kept list marks it `not-in-game` (the whole tier then carries `weight: 0`) or as an
  internal engine line. A marked line is not a gap: the pool still enumerates that tier.

There is no third option. `poolCoverage` is an honest per-pool assertion, not something
the producer computes from cell coverage — there are no cells to compute it from.

## The exclusivity rule

- **An item holds at most one modifier per `modGroup`**, item-wide across prefix and
  suffix — not per slot.
- A consumer predicting the next roll on an item **removes every entry whose `modGroup` is
  already on the item** (from both pools) **before normalising** the remaining weights.
- `modGroup` is published verbatim and nothing is derived from it: the file carries no
  group totals, per-group probabilities or adjusted weights. Pools stay flat entry lists;
  entries are not nested under groups.

How `core` applies this rule to a crafting act is spine AD-17 and
`IMPLEMENTATION-NOTES.md` §11.

## Shape

```jsonc
{
  "schemaVersion": "6.1.0",           // semver; core refuses a major it does not know
  "gamePatch": "0.5.5",               // operator-asserted at run time; never defaulted
  "producer": {
    "id": "poe2-weights-scraper",     // stable producer identifier
    "version": "3.0.0",
    "generatedAt": "2026-09-18T00:00:00Z",   // ISO-8601 UTC
    "sourceUrl": "https://..."        // where the data came from, if anywhere
  },
  "bases": {
    "weapon.bow": {                   // trade category filter id (AD-5, AD-25), collapses many classNames
      "Bows": {                       // poe2db className verbatim, never a derived display label
        "prefix": {
          "poolCoverage": "complete",   // "complete" | "partial"
          "entries": [
            {
              "sourceModifierId": "prefix\u0000BaseLightningDamage\u000060\u0000...",
              "modGroup": "BaseLightningDamage",   // mutual-exclusion group, verbatim
              "itemLevelMin": 60,        // this tier's own item level
              "tierLabel": "T7",         // display only; never a matching key
              "weight": 40,              // raw spawn weight as published, unnormalised
              "weightSource": "published",  // "published" | "absent" | "not-in-game"
              "lines": [
                {
                  "statId": "explicit.stat_1509134228",
                  "ranges": [[43, 43], [56, 56.5]]   // verbatim, both numbers of one stat
                }
              ]
            },
            {
              "sourceModifierId": "prefix\u0000BaseEvasionHybrid\u00008\u0000...",
              "modGroup": "BaseEvasionHybrid",
              "itemLevelMin": 8,
              "tierLabel": "T1",
              "weight": 1000,
              "weightSource": "published",
              "lines": [
                { "statId": "explicit.stat_evasion_flat", "ranges": [[4, 6]] },
                { "statId": "explicit.stat_evasion_pct", "ranges": [[6, 13]] }
              ]
            },
            {
              "sourceModifierId": "prefix\u0000ExtraBolt\u000045\u0000...",
              "modGroup": "ExtraBolt",
              "itemLevelMin": 45,
              "tierLabel": "T1",
              "weight": 300,
              "weightSource": "absent",
              "lines": [
                { "statId": "explicit.stat_2954116742", "ranges": [] }   // rolls no number
              ]
            },
            {
              "sourceModifierId": "prefix\u0000UnmatchedMod\u000030\u0000...",
              "modGroup": "UnmatchedMod",
              "itemLevelMin": 30,
              "tierLabel": "T4",
              "weight": 500,
              "weightSource": "published",
              "lines": [
                { "statId": null, "ranges": [[10, 20]] }   // no trade statId matched
              ]
            }
          ]
        },
        "suffix": { "poolCoverage": "complete", "entries": [] }
      }
    }
  }
}
```

## Field rules

| Field | Rule |
| --- | --- |
| `schemaVersion` | Semver. `core` refuses a major version that `core` does not implement. `core` does not guess. |
| `gamePatch` | A free-form GGG patch string, operator-asserted. Never `"unknown"`, never inferred. A producer refuses to run without it. |
| `producer.id` | Stable across regenerations by the same producer. |
| `bases` key | Two levels. Outer key is a trade category filter id (`categoryId`), spelled exactly as the trade category filter list spells it. Inner key is the poe2db `className` verbatim (never a derived display label) that resolved to that `categoryId` -- `className -> categoryId` is many-to-one (e.g. six armour `className`s collapse to `armour.gloves`), so one `categoryId` can carry several distinct `className` sub-keys, each with its own `{prefix, suffix}` pools. There is no cross-class ownership guard: `(categoryId, className)` cannot collide because `className`s are already distinct. Validated report-only by `sync` (AD-6, AD-25); an item class absent from the file is unrankable. **The pair is the consumer's own key for a crafted tracked entry** (spine AD-5), so a consumer looks a pool up at both rungs directly and **never falls back to a sibling `className`** under a `categoryId` it did find. The fan-out is real and measured on the 2026-09-19 file: 6 of 29 categories carry more than one class, `armour.chest` seven and `jewel` eight. **Since `5.1.0` the inner key also carries a normative grammar** — see the row below, and `5.1.0 — the inner key's grammar becomes normative`. |
| `className` grammar (`5.1.0`) | The inner key is either **defence-suffixed**, `<family>_<letters>` with `<letters>` a `_`-separated non-repeating sequence over `str` / `dex` / `int` (`Body_Armours_str_dex`, `Boots_int`), or **plain**, carrying no such suffix (`Bows`, `Amulets`, `Time-Lost_Diamond`). Within one `categoryId`: defence-suffixed classes carry **distinct** letter sets, and defence-suffixed and plain classes are **never mixed**. A plain class under an all-plain fan-out `categoryId` is a **base type name with spaces written as underscores**. The consumer derives its trade-search class filter from this grammar (spine AD-16, `IMPLEMENTATION-NOTES.md` §10) and validates the base-type form against the trade catalogue before use, so a violation surfaces at load rather than as a wrong price. **`str` maps to armour, `dex` to evasion, `int` to energy shield** — that mapping is the point of the rule and is stated here because the consumer depends on it. |
| `slot` | Exactly `prefix` and `suffix`. |
| `poolCoverage` | See *The pool-completeness rule*. Required, with no default. |
| `sourceModifierId` | **Required on every entry.** Names the poe2db tier this entry came from. One entry per tier — never split, never merged. Opaque to the app. |
| `modGroup` (`6.0.0`) | **Required on every entry**, a non-empty string: poe2db's `ModFamilyList` value for this tier, verbatim (a producer refuses a row whose list is not exactly one string). The game's mutual-exclusion group — see *The exclusivity rule*. Nothing is derived from it, and a consumer never recovers it by parsing `sourceModifierId`. |
| `itemLevelMin` | **Required.** The lowest item level at which this tier's mass can roll, taken verbatim from poe2db. |
| `tierLabel` | Display only. Never a matching key. **Since `6.0.0`**, numbered per stat within `(slot, modGroup)`, T1 = highest `itemLevelMin`: one `T1..Tn` run per distinct stat template in a group, an `itemLevelMin` tie broken by poe2db's page order. No label repeats within a run. |
| `weight` | Raw spawn weight as poe2db published it (`DropChance`), unnormalised, non-negative. `0` is meaningful ("cannot roll on this base") and must still be emitted. **Sole exception (`6.1.0`):** a `weightSource: "not-in-game"` entry carries `0` whatever poe2db published. |
| `weightSource` | **Required.** `"published"` where poe2db supplied a real weight (a JSON string `DropChance`), `"absent"` where it supplied a filler (a JSON number). Never inferred from the value. **`"not-in-game"` (`6.1.0`):** poe2db lists the tier but it cannot roll in game; `weight` is forced to `0`. Set only from the producer's hand-kept list, never inferred from an unmatched line. |
| `lines` | **Required, at least one entry.** One item per stat line poe2db's template prints, split at the template's own line breaks — no value math, no partitioning. |
| `lines[].statId` | A trade API stat id matched by this producer's stat-text resolution, or `null` if unresolved. **Since `6.1.0`, a `null` line inside a `complete` pool is either not-in-game (its entry is `weightSource: "not-in-game"`, `weight: 0`) or an internal engine line with no trade stat of its own (weight unchanged)**; any other `null` line makes its pool `partial`. Never a matching key from `core`'s side — `core` treats it as opaque identity. Validated report-only against the trade catalogue by `sync`, same as `4.x` (AD-6, AD-25). |
| `lines[].ranges` | Verbatim `[min, max]` pairs, one per `#` in that line's own template text, in the order poe2db prints them. A line with no `#` (a flat, valueless line) carries an empty array. **Not** cut, cast, or reduced to a single derived value — a two-number stat's two ranges are both reported as poe2db shows them. |

## Validation

The schema is a Zod schema in `packages/contracts`. That Zod schema is the single
source of truth; the shape above documents it and is not a parallel definition.

**Hard errors — refuse the file:**

- unknown `schemaVersion` major
- a missing `sourceModifierId`, `itemLevelMin`, `weight`, `weightSource`, or `lines`
- **(`6.0.0`)** a missing, non-string or empty `modGroup`
- a negative `weight`
- `weightSource` not one of `"published"` / `"absent"` / `"not-in-game"`
- **(`6.1.0`)** `weightSource: "not-in-game"` with a `weight` other than `0`
- `lines` empty
- a `lines[]` entry whose `ranges` contains a pair where `min > max`
- a `lines[]` entry whose `ranges` carries **more than two** pairs. The game publishes at most
  two `#` on a stat line (confirmed 2026-09-19, OQ-19), and `core` derives a line's interval by
  dividing by that count: two divides exactly in binary, three or more does not, and AD-17
  compares edges for equality with no tolerance. A three-`#` line would therefore fail edge
  alignment permanently on every affected base, with nothing a curator could write to satisfy
  it. Failing at the file turns that into one legible error and a contract amendment, which is
  the only correct response — never an epsilon in `core`.
- a duplicate `sourceModifierId` within one slot
- a duplicate `statId` among one entry's own `lines` — a tier cannot roll the same trade stat
  twice, so two lines naming it is a producer error, not a hybrid modifier (a hybrid modifier
  is distinct `statId`s that roll together, which is exactly what `lines` exists to carry)
- a missing or empty `gamePatch`
- a missing `poolCoverage`
- **(`5.1.0`)** an inner `className` key matching neither grammar above, or a `categoryId`
  whose classes violate the distinctness or the no-mixing rule. The consumer derives its
  class filter from this key (spine AD-16), so an unparseable or ambiguous key means it
  cannot build a correct search — and the failure mode without this error is a price
  gathered across sibling classes, which nothing downstream can distinguish from a good one.
  **This is a whole-file refusal, and it is what makes spine `IMPLEMENTATION-NOTES.md` §2.6's
  narrower, per-class check effectively unreachable against a file that passes this one** —
  the distinctness and no-mixing halves of this same hard error are exactly what guarantee
  every `className` lands in a discriminable arm of §10.2's grammar. §2.6 is kept as a
  cross-file backstop (its consequence, if it ever fires, excludes just the one affected
  class rather than refusing the file), not as a second path to the same outcome as this
  hard error.

**Not a file error:**

- an unresolved `statId` (`null`) — reported by the producer, never a refusal
- an uncatalogued `statId`, or an outer `categoryId` the trade category filter list does not
  spell — `sync`'s concern, report-only (AD-6), same as `4.x`. **The inner `className` is not
  checkable against the catalogue**: it is a poe2db name and AD-25's catalogue carries no class
  axis, so `sync` validates the rung it can reach and reports the other as uncheckable rather
  than as clean.

  **That is no longer a gap, and spine revision 16 is why.** The note above cited **OQ-23**,
  which asked how a tracked entry reached the pool `className` keys. It was closed by
  withdrawing its premise: a crafted tracked entry now names `(categoryId, className)`
  directly (spine AD-5), so **this file is the authority the `className` is checked against**
  rather than a name needing an authority of its own. The check is the consumer's cross-file
  gate (AD-12) — a tracked entry whose pair is absent from `bases` is unrankable with a
  reason — and it needs nothing added here. **The `bases` key is unchanged by that closure**:
  no `baseTypes: []` member was added, and none is wanted.
- overlapping `ranges` across tiers of one family — expected and left as-is; the consumer resolves it if its ranking needs disjoint intervals

## Producer expectations

Regenerate the file on GGG patch boundaries, and on no faster cadence. Report, per class
and in totals, how many stat lines resolved to a `statId` versus did not — this replaces
`4.x`'s coverage-per-pool measurement, decoupled from cell math.

## Repository placement

This document lives, and is authoritative, in `poe-crafting-base-price-checker`. Any copy
inside the external `poe-mod-weights-producer` scraper project is that project's own working
reference, not a second authority — a divergence between the two is that project's copy
falling behind, never a live proposal awaiting adoption here. Moving the schema itself to a
shared package remains Deferred, as in prior revisions.
