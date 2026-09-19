---
title: 'Implementation Notes'
type: architecture-companion
status: final
binding: true
created: '2026-09-19'
updated: '2026-09-19'
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
| Three or more `#` | `[[…], […], […]]` | **unresolved — OQ-19** |

**The two-`#` rule is the producer's inference, not a confirmed fact (OQ-12).** The
evidence is that poe2db prints a bow tier as `43.0–56.5`, and a `.5` edge can only arise
from averaging two integers. It is written here as the working rule so that `contracts` and
`core` can land, and it is the single place to change when OQ-12 resolves.

**Do the division once, in one exported function**, and let both the containment test and
the edge-alignment test call it. Two call sites that each divide are two chances to round
differently.

**Exactness (OQ-19).** Dividing by 2 is exact in IEEE doubles, so a two-`#` interval lands
on a half-integer lattice and compares equal to a curator's declared edge with no
tolerance. Dividing by 3 or more is not exact. If such a line exists, **do not add an
epsilon** — the comparison is load-bearing against the sentinel defect AD-5 exists to
close, and an epsilon readmits it. Surface the failure and amend the contract.

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
4. **A prefix-only entry and a suffix-only entry on one base overlap each other.** Neither
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
coOccur(x, y) ⇔ ∃ entry ∈ scoped(base, slot, L) such that
                    contains(x, entry) ∧ contains(y, entry)
```

The pool is scoped to the base's own crafted floor `L` — the same `L` that scopes every
probability on the base, and AD-17 gives a base exactly one.

**Where the pool cannot answer — a base absent from `weights.json`, or a `partial` pool —
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

---

## 3. Pool coverage (AD-27)

```
rankable(base) = base carries at least one tracked entry that is
                 crafted (at least one affix present) and not pruned

covered(base)  = base is PRESENT in weights.json
                 ∧ both slots declare poolCoverage "complete"
                 ∧ neither slot's pool is empty

coverage = |{ baseTypeId ∈ tracked.json : rankable ∧ covered }|
           ──────────────────────────────────────────────────
           |{ baseTypeId ∈ tracked.json : rankable }|
```

**All three conditions in `covered` are load-bearing**, and stating only the middle one makes
the fraction ambiguous across a gate whose consequences turn at 80% and 50%:

- *"Both slots are `complete`"* is **vacuously true** of a base absent from `weights.json`
  entirely, because it has no slots to fail.
- A base declaring `complete` over an **empty** pool passes a naive reading, while AD-17
  excludes it from the ordering anyway.

**The denominator counts only bases that need a pool.** A base tracked solely as a raw base
ranks on AD-17's separate branch, can never resolve to `complete`, and would depress a
fraction that binds a layout decision. `pruned` entries are excluded for the same reason. A
base carrying **both** raw and crafted entries **does** count, because its crafted branch
needs a pool like any other.

**An unresolved stat line (`statId: null`) does not affect coverage** — it is data, not a
completeness failure.

**The report carries the denominator beside the fraction.** `sync-report.json` records the
count `|{ baseTypeId ∈ tracked.json : rankable }|` as its own field next to `coverage`, and
`web` shows both, so a reader can see when the list is too small for the fraction to mean
much. **Wire shape:** `coverage` is a `number` in `[0, 1]` — a fraction, never a percentage —
and `web` formats it; when `weights.json` is absent **both fields are omitted together**,
which is how "undefined" is spelled, and `web` must not read the omission as `0`. `sync`
computes the figure and `web` only renders it: `web` does not recompute coverage even though
it holds both files, because two figures on two surfaces would be the divergence AD-27
exists to prevent. The size at which AD-27's bands become advisory is the PRD's number (FR-4), not this
file's.

---

## 4. Encodings and precision

### 4.1 The canonical `TrackedEntry` key (Consistency Conventions)

`(baseTypeId, itemLevelMin, prefixBand, suffixBand)`, serialised in that field order. Each
affix encodes in exactly one of three **distinguishable** forms:

| Affix state | Encoding |
| --- | --- |
| absent | the literal `null` |
| `banded` | `[statId, valueMin, valueMax]` |
| `valueless` | `[statId, null, null]` |

Three forms, so an absent affix and a valueless affix can never collide. **An affix is always
exactly three elements or `null`** — `acceptedTier` is a display-only sibling of the band, not
a fourth element, and `lastSearchId` / `lastSearchLeague` are dataset-entry facts. Every
artifact that keys entries uses this one encoding.

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
a browser search captured from the live site. **It is a category search, not a base-type
search**, so it is evidence of the request *envelope*, not of this product's query.

```
POST https://www.pathofexile.com/api/trade2/search/poe2/Forbidden%20Rites
content-type: application/json
x-requested-with: XMLHttpRequest
user-agent: <descriptive, with contact — AD-8>
```

```jsonc
{
  "query": {
    "status": { "option": "securable" },          // OQ-20 — unsettled
    "stats": [ { "type": "and", "filters": [
      { "id": "explicit.stat_1509134228", "value": { "min": 75 }, "disabled": false }
    ] } ],
    "filters": {
      "type_filters": { "filters": {
        "category": { "option": "weapon.bow" },   // NOT this product's path — see trap 1
        "rarity":   { "option": "magic" }
      } }
    }
  },
  "sort": { "price": "asc" }
}
```

**What it confirms:** the path is `/api/trade2/search/{realm}/{league}` with realm `poe2` and
the **league segment percent-encoded**, which is the same shape AD-24 pins for the outbound
link, now verified on the request side too. `sort.price: "asc"` matches AD-16. Stat filters
are `{id, value: {min, max}, disabled}` inside a `{type: "and", filters: []}` group.

**What it does not settle:** the capture's `referer` ends in a long base64/gzip blob
(`H4sIAAAA…`), which is the trade site's **encoded-query** URL form — a different thing from
the short saved-search identifier AD-24 builds a link from. The capture is therefore evidence
*for*, not against, the open question about which response field carries that identifier.

### 5.2 The four traps (AD-16)

Each is costly to discover in code, and the first three were verified against live payloads on
2026-09-12.

1. **The base type is `query.type`, not `type_filters.category`.** `category` takes taxonomy
   ids such as `weapon.bow`, not base type names, and no committed artifact maps a base type to
   its leaf category — `data/items` groups only ten coarse labels. Do not attempt that mapping.
   The base type alone is sufficient and exact. *(The §5.1 capture uses the category path,
   which is precisely why it is not this product's query.)*
2. **`priced_with_info` is not instant buyout.** Its live label is *"Price with Note"*. The
   option this product needs is *"Buyout or Fixed Price"*, and that option's `id` is JSON
   **`null`** — a serialiser will silently drop a `null` value unless the code emits the field
   explicitly. Getting it wrong does not error; it silently widens the result set to unpriced
   listings and corrupts every estimate.
3. **Pass the band's `max` as well as its `min`.** A min-only filter returns every higher tier
   and prices the band at its floor, which is the sentinel defect reintroduced at the adapter.
4. **A multi-`#` stat filters on one derived value, and which value that is, is a measurement
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
count(pinned) + currencyStepSearches  ≤  0.5 × config.minChunkSearches
```

At least half of a minimum chunk is left for the `active` rotation. The currency step is a
summand because AD-20 spends it at step 0 of the same chunk. **`currencyStepSearches` is what
that step actually costs in searches**, not the row count of `data/currencies.json`, since a
bulk exchange query may price many currencies in one request. `sync` reports the figure it
used, so the two cannot drift.

**`web` may not evaluate this check and is not obliged to**, even though it also validates
`tracked.json` on load. It *cannot*: `data/currencies.json` is not in AD-24's fetch set and the
currency step's cost is a sync-side fact. `web` refusing to render over a cap it cannot compute
would take the product down for a curation error that only ever affects a sync run.

**Runtime, every chunk, `sync`, surfaced by `web`:** if the discovered allowance cannot cover
the pinned set **plus at least one `active` entry**, truncate the pinned set for that chunk —
taking them in oldest-`lastAttemptedAt` order, reserving at least one search for the rotation —
then complete the chunk normally and record a distinct **pinned-starvation** record in
`sync-report.json`. It is not an error and does not change the exit code.

**The record carries exactly six fields**, and `SyncRunReport` names them so:

| Field | Meaning |
| --- | --- |
| `discoveredAllowance` | the search allowance the chunk actually received from the live headers (AD-8) |
| `declaredMinChunkSearches` | `config.minChunkSearches` as loaded — the yardstick beside the allowance observed |
| `currencyCost` | `currencyStepSearches`, what step 0 actually cost this chunk (AD-20) |
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
