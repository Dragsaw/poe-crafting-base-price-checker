---
title: PoE2 Crafting Base Price Checker
status: final
revision: 2
created: 2026-09-12
updated: 2026-09-12
sources:
  - docs/briefs/brief-poe-crafting-base-price-checker-2026-09-12/brief.md
  - docs/briefs/brief-poe-crafting-base-price-checker-2026-09-12/addendum.md
inherits:
  - docs/architecture/architecture-poe-crafting-base-price-checker-2026-09-12/ARCHITECTURE-SPINE.md
  - docs/architecture/architecture-poe-crafting-base-price-checker-2026-09-12/WEIGHTS-FILE-SCHEMA.md
  - docs/architecture/architecture-poe-crafting-base-price-checker-2026-09-12/AGENT-WORKFLOW.md
---

# PRD: PoE2 Crafting Base Price Checker

## 0. Document Purpose

This PRD is the requirements layer for a single-player tool that answers one question — *is this base worth picking up?* — and it is written for the agents that will build it and for the workflows that will turn it into epics and stories. It is deliberately **downstream of a settled architecture**: `ARCHITECTURE-SPINE.md` is final at revision 2, and its decisions AD-1 through AD-27 are **inherited, not re-decided**. AD-25 (the committed trade catalogue), AD-26 (refresh rotation) and AD-27 (the pool-coverage gate) are new in revision 2, and all three bear on requirements below. Where a requirement here restates something the spine governs, it does so because that thing is visible to the player and therefore belongs in a requirements document — the citation `(AD-n)` points at the decision and its rationale, which is not re-argued.

The document is Glossary-anchored: §3 defines every domain noun, and §4's features and FRs use those terms verbatim. FRs are numbered globally (FR-1 … FR-33) so they stay stable if features are reorganised. Inferences carry inline `[ASSUMPTION]` tags and are indexed in §11. `[NOTE FOR PM]` callouts flag items worth revisiting and are deliberately not indexed — they are prompts, not commitments.

> **This PRD is buildable.** Validation surfaced three defects in the *inherited* valuation model — not in the requirements written here — and all three were absorbed by **Architecture Spine revision 2**: BQ-1 by AD-5, AD-16, AD-17 and AD-18; BQ-2 by AD-17, AD-18 and Weights File schema 2.0.0; BQ-3 by AD-27. The analysis that produced them is retained at **§10, *Resolved by spine rev 2***, because it is the record of why the valuation model is shaped the way it is. Nothing in §4 is gated on a pending amendment.
>
> **The one live gate is data, not architecture.** The crafted branch of the ranking depends on the external Weights File, and there is no fallback — until a conforming file exists, every crafted Base Type is Unrankable (§7.3, FR-30). Its coverage must be measured before any view work, because the result binds a layout decision (FR-4).

## 1. Vision

Farming crafting bases is among the most reliable ways to make currency in Path of Exile 2's endgame, and it is gated entirely behind memory. The method only pays once you know which bases to pick up and which modifier combinations sell — knowledge bought with weeks of picking up everything, crafting on it, price-checking the result, and slowly committing the answers to memory. That apprenticeship is destroyed three or four times a year by league resets, at precisely the moment it is worth the most.

This tool replaces the memorisation with a ranked list. A background sync prices a curated set of base-and-modifier combinations against the official trade API; a static web view ranks bases by **expected payout per craft**, counting only outcomes above a threshold the player sets and subtracting the cost of the craft paid on every attempt including the failures. The list is read before a play session, or whenever the economy is worth a look. It is precomputed, so it never blocks on a live API call.

The ranking is not "most expensive base," and everything else in the system exists to make that distinction hold. A base with one jackpot combination and a base with many moderate ones swap places as the threshold moves, which is why the threshold is a dial the player turns rather than a constant someone compiled in. The sync, the schemas and the view all exist to make that one number right, and to make it honest about what it rests on.

## 2. Target User

### 2.1 Jobs To Be Done

- **Decide, at a glance, what to pick up this week.** Functional: convert a live market into a short ordered list of bases worth inventory space.
- **Stop paying the memorisation tax.** Emotional: the relief of not holding a top-five list in your head, and of not losing it at every league start.
- **Know when the answer has gone stale.** The player must be able to tell a figure resting on real measured weights from one resting on a uniform placeholder, and a row priced an hour ago from one priced yesterday. If the tool does not tell him, he will trust the placeholder six months later.
- **Spend time playing, not crafting.** Contextual: the binding constraint is the player's own time. Outcomes below his threshold are worth nothing to him because that much currency turns up simply playing, so they must contribute nothing to the ranking.
- **Keep a tool alive for a year without it becoming a second job.** The maintenance surface is a first-class concern: no credentials to rot, no server to patch, no account system.

### 2.2 Non-Users (v1)

- **Anyone who is not the author.** Published openly but unadvertised. Friends with the link and passers-by are welcome and explicitly not courted — no growth goal, no monetisation, no advertising.
- **Players wanting advice on an item already in hand.** The augment decision is excluded by design (§6).
- **Rare-item crafters.** Magic bases only: at most one prefix and one suffix.
- **Anyone needing their own settings.** No account, no per-user persistence, no sharing (AD-15). The tool may assume one player's thresholds, one player's playstyle, and one player's judgment about when to trust it — that freedom is load-bearing.

### 2.3 Key User Journeys

There is a single operator, a single role, no authentication and no multi-device handoff, so these journeys are written in the template's lighter form.

- **UJ-1. The pre-session read.** The player, about to map for two hours, opens the view, glances at the top five Base Types under his current threshold, notes the two or three chase Combinations on each, and closes it. He picks up accordingly for the rest of the session.
- **UJ-2. The threshold turn.** The player, now richer than at league start, drags the threshold from a quarter of a Divine to one Divine. The list reorders immediately — steady moderate bases fall away, jackpot bases rise — and he re-reads the new top five.
- **UJ-3. The drill-down.** The player, unsure why an unfamiliar Base Type ranks third, expands it and reads the full tracked Combination list: which are priced, at what, how old each price is, and which returned no listings.
- **UJ-4. The trust check.** The player notices a Base Type ranking suspiciously high, sees its price was observed three days ago and that the whole ranking is flagged as resting on the uniform prior, and discounts it rather than acting on it.
- **UJ-5. The curation pass.** The player, reviewing deliberately after a few weeks, sees three Combinations that have returned no listings all league and one flagged unresolvable since the last patch. He opens `data/tracked.json`, tombstones the dead ones with a reason, pins one he wants watched closely, commits, and the next sync run reflects it.
- **UJ-6. The league reset.** A new league starts. The player edits the active league in `data/config.json` and commits. The ranking goes honestly empty rather than quietly serving last league's numbers, and refills over the following day.

## 3. Glossary

Downstream readers and workflows use these terms exactly. Introducing a synonym anywhere is a discipline violation.

- **Base Type** — a specific item base in PoE2, identified by the trade API's own `baseTypeId`. Never re-encoded into an internal id (AD-5).
- **Modifier Reference** — the canonical identity of a modifier: a trade API `statId` paired with an inclusive, closed **value band** `(valueMin, valueMax)`. The trade API has no tier concept; "tier 1" and "tier 2" exist in this product only as bands (AD-5). **`valueMax` is required, always** — an omitted ceiling is a floor by another name, and a floor spans tiers, which is the defect §10 BQ-1 removed.
- **Tracked Entry** — one unit of the curated workload: a Base Type, an optional prefix Modifier Reference, an optional suffix Modifier Reference, a declared **Item Level Floor**, and a **Curation Status**. An entry with both affixes absent is a **Raw Base**.
- **Raw Base** — a Tracked Entry with no affixes, representing an uncrafted white base at item level 82 — the one case where selling the base may beat crafting on it.
- **Combination** — the outcome a Tracked Entry describes: this Base Type carrying this prefix and this suffix. A Raw Base describes the degenerate Combination of no affixes, and the Payout Threshold applies to it exactly as to any other (FR-3).
- **Chase Combination** — one of the Combinations on a Base Type contributing most to its EV, shown on the collapsed ranked row so the player knows what to look for without expanding it (FR-2).
- **Tracked List** — the complete curated set of Tracked Entries, held in `data/tracked.json`. It is simultaneously what the tool watches and the tool's entire request budget (FR-14).
- **Item Level Floor** — the minimum item level a Tracked Entry's search accepts, declared per entry and derived from the item levels at which its affixes' **Accepted Tiers** become available (FR-22). It is also a valuation input: it scopes the Eligible Pool (FR-29). The crafted entries on one Base Type must share it; a Raw Base at 82 is exempt (AD-17, FR-16).
- **Accepted Tier** — for a modifier, the highest tier worth chasing: tier 1 normally, or tier 2 where tier 1 requires item level 81 or 82 and is therefore too rare to chase. Expressed mechanically as the Modifier Reference's **band** — both edges, not a floor.
- **Curation Status** — exactly one of `active`, `pinned` (refreshed every Chunk, never waiting its turn in the oldest-first ordering, and capped in number), or `pruned` (a tombstone carrying its reason, excluded from both the sync workload and the ranking) — AD-23, FR-17. It is independent of Price State: an entry is `active` *and* `priced`, or `active` *and* `unresolvable`.
- **Refresh Rotation** — the defined, deterministic order in which a Chunk selects entries to refresh, given that a full pass takes many Chunks: currencies, then `pinned`, then `active` by oldest `lastAttemptedAt`, then bounded `unresolvable` retries, never `pruned` (AD-26, FR-17).
- **Workload** — the set of Tracked Entries and currencies a Chunk may spend requests on, held in two declared files. It covers two of the four enumerated request sources; the other two — the per-run leagues check and the catalogue refresh — are fixed overheads rather than workload (FR-14).
- **Price Observation** — an observed price for a Tracked Entry, normalised to Divine, stamped with its observation time, its league, and the exchange observation used (AD-16, AD-19, AD-20).
- **Price State** — exactly one of `priced`, `no-listings`, `not-yet-synced`, or `unresolvable`. Absence is never `0`, `null`, or a missing key (AD-9). `not-yet-synced` carries a **reason** distinguishing its three causes (FR-9).
- **`lastAttemptedAt`** — when `sync` last worked on a Tracked Entry, whatever the outcome. Present in **all four** Price States, and distinct from a Price Observation's `observedAt`, which exists only where there is an observation. A `no-listings` row has an age even though it has no observation (AD-9, FR-12).
- **Divine** — the single currency denomination crossing every boundary. All prices, all Craft Costs and the Payout Threshold are denominated in Divine (AD-17 for the threshold and the ranking terms, AD-20 for the unit itself).
- **Payout Threshold** — the player-set gross price, in Divine, below which a Combination's outcome contributes nothing to a ranking.
- **Craft Recipe** — a named crafting currency composition (v1: one perfect transmute plus one perfect augment) whose **Craft Cost** is computed from synced exchange rates.
- **Craft Cost** — the Divine cost of one Craft Recipe attempt, paid on every attempt including failures.
- **Expected Value (EV)** — the ranking figure: the threshold-truncated expected payout of a Base Type under a Craft Recipe, less Craft Cost (FR-1, AD-17).
- **Modifier Weight** — a raw game spawn weight for one band within a Base Type and affix slot, banded by rolled value **and by item level** — `(statId, valueMin, valueMax, itemLevelMin, weight)`. Consumed from the **Weights File** and never produced by this app (AD-11).
- **Weights File** — the schema-conformant file of Modifier Weights defined by `WEIGHTS-FILE-SCHEMA.md`. Produced by an **external project** and a **v1 prerequisite**, not an enrichment: it is the only source of pool membership, band edges and item-level availability, none of which the trade API exposes (AD-11, AD-25, FR-30).
- **Trade Catalogue** — the committed mirror of the trade API's own data endpoints (`data/catalogue/*.json`), refreshed by an explicit command at patch cadence. It is an **identity and validation authority only** — base types, stat ids and display text, currency ids and icons — and contributes nothing to the Eligible Pool (AD-25).
- **Eligible Pool** — the complete set of modifiers that can roll in one `(Base Type, slot)` at **any** item level, each band carrying the item level at which it becomes available. It is **scoped** to a Tracked Entry's Item Level Floor before it normalises anything, and the scoped pool is the denominator of every probability for that entry (AD-18, FR-29). A pool declared anything other than `complete` makes its Base Type **Unrankable** (AD-18).
- **Provenance** — what a derived figure rests on: `measured`, `uniform-prior`, or `absent`. Every derived figure carries the *weakest* Provenance and the *oldest* timestamp of its inputs (AD-10).
- **Unrankable** — a Base Type excluded from the ordering because its Eligible Pool is incomplete or absent, returned in a separate group with the reason (AD-18).
- **Chunk** — one bounded, resumable unit of sync work, ended by whichever runs out first: the remaining search allowance, the remaining fetch allowance, or the workload remainder (AD-7).
- **Dataset** — the published snapshot of the latest Price Observation per Tracked Entry (AD-14).
- **Sync Report** — the published structured record of a sync run: requests consumed **per declared source** (FR-14), unresolvable entries, entries not reached in this Chunk, and the date of the last tracked-list edit (AD-12, AD-23).

## 4. Features

### 4.1 The Ranked Base List

**Description.** The product's front door and, for most sessions, the only thing read. A single ordered list of Base Types, most profitable first, each row carrying its EV, the Combinations worth chasing on it, and what the figure rests on. Ranking is computed in the browser on every input change (AD-4) — nothing in the published Dataset carries a rank, a score or an ordering, because a precomputed ranking would make the Payout Threshold reorder nothing until the next sync, which would make the product's central control a lie. Realizes UJ-1, UJ-2, UJ-3.

**Functional Requirements:**

#### FR-1: Rank Base Types by threshold-truncated expected value

The player sees Base Types ordered by EV under the active Craft Recipe and the current Payout Threshold. Realizes UJ-1.

**Consequences (testable):**
- For a crafted Base Type, `EV = ( Σ P(combo) × price(combo) over Combinations that are priced and whose price ≥ Payout Threshold ) − Craft Cost` (AD-17).
- The Payout Threshold compares against a Combination's **gross** price, never its price net of Craft Cost.
- Craft Cost is subtracted **once** from the summed expected payout, never per Combination.
- A Combination whose Price State is not `priced` contributes nothing — not zero, not a default (AD-9).
- A Combination with Curation Status `pruned` is not a summand, so pruning changes the ranking rather than being a no-op (AD-23).
- Every ranking term is computed by `core`; the view computes none of them (AD-4).
- `P(combo)` and `price(combo)` describe the **same population**, and the sum is only meaningful because they do: a Modifier Reference is a bounded band (AD-5), so the tier that is weighted is the tier that is priced, and both halves of the probability are scoped to the entry's Item Level Floor (AD-18, FR-29).

#### FR-2: Show chase Combinations on each collapsed row

Each ranked row names the Combinations most worth chasing on that Base Type, without the player expanding it. Realizes UJ-1.

**Consequences (testable):**
- Chase Combinations are ordered by contribution to EV — `P(combo) × price(combo)` — not by raw price. `[ASSUMPTION: the brief says "chase modifiers" without defining the ordering; ranking by price alone would advertise a Combination the player will essentially never roll.]`
- **At most three** are shown per collapsed row. `[ASSUMPTION: the brief says "the modifier combinations to look for", plural and unbounded; three is the count that fits a scannable row and matches the "top five bases" reading pattern of UJ-1.]`
- Only Combinations at or above the Payout Threshold appear, so the set changes when the threshold changes.
- A Base Type whose priced Combinations are all below the threshold shows none, and its EV is negative by its Craft Cost.

#### FR-3: Rank Raw Bases on a separate branch, visibly labelled

Uncrafted item-level-82 white Base Types are ranked in the same list but valued differently and labelled as uncrafted.

**Consequences (testable):**
- A Raw Base's EV is its observed price with zero Craft Cost; it is never a summand in any crafted Base Type's sum (AD-17).
- **The Payout Threshold applies to a Raw Base exactly as to a crafted Combination**: a Raw Base priced below the threshold is truncated out of the list, not ranked at its price. Without this, the threshold would silently govern only one of the two branches.
- A Raw Base is rendered distinguishably from a crafted Base Type, and that distinction is not carried by colour alone (NFR-10).
- A Raw Base's search uses `normal` rarity (AD-16) and item level 82, the brief's white-base scope. `[ASSUMPTION: 82 is the effective item level cap for these bases, so a floor of 82 and "exactly 82" are the same filter. If bases above 82 exist, this needs a ceiling, not a floor.]`

#### FR-4: Surface Unrankable Base Types outside the ordering

Base Types that cannot be honestly ranked appear in a separate group with the reason, rather than being silently dropped or ranked anyway.

**Consequences (testable):**
- A Base Type whose Eligible Pool for either slot is not `complete`, or which is absent from the Weights File entirely, is Unrankable and excluded from the ordering (AD-18).
- **This governs the crafted branch only.** A Raw Base's EV is its observed price with no probability term at all (FR-3), so it needs no Eligible Pool and ranks whatever the Weights File says. A Base Type carrying both a Raw Base and crafted entries can therefore have its crafted branch Unrankable while its raw branch ranks normally, and the view shows each branch in its own place, labelled for what it is.
- The reason is shown per Base Type ("pool partial", "base absent from weights file").
- `core` never substitutes an invented pool to make a Base Type rankable.
- The count of Unrankable Base Types is visible without expanding the group, since a large count means the ranked list covers a small fraction of what the player tracks (§10 BQ-3).
- Every probability derived from a `partial` pool carries Provenance `absent` and is rendered as an **unknown rather than a number** — it is an upper bound, not an estimate, and this is the only path by which `absent` arises (AD-18, FR-10, FR-28).
- **The group's prominence is set by a measurement taken before any view work.** Pool coverage across the tracked list — Base Types resolving to `complete` in **both** slots — is measured first, and the result binds the layout (AD-27, §10 BQ-3):

| Measured coverage | What this FR requires |
| --- | --- |
| **≥ 80%** | The Unrankable group is a footer to the ranked list, as specified above. |
| **50–80%** | The group becomes a **first-class surface** alongside the ranking, not a footer. At this coverage it is a large share of what the player tracks, and hiding it misrepresents the product. |
| **< 50%** | The ranking premise fails. Escalate rather than ship around it; this is not a case `core` or the view resolves. |

- Committing to a layout before that number exists commits to an assumption about how much of the product there is, which is why the measurement is sequenced ahead of the view rather than alongside it.

#### FR-5: Bound the ranked list to a readable length

The list answers a question rather than presenting an inventory.

**Consequences (testable):**
- The ranked list shows the top **20** Base Types by default, with the remainder behind an explicit expand. `[ASSUMPTION: no source names a count; 20 is roughly a screen and comfortably exceeds the "top five" the player actually acts on.]`
- The bound is a display concern only — `core` ranks the full tracked list and the view truncates, so the threshold still reorders across everything (AD-4).

**Feature-specific NFRs:**
- Ranking the full tracked list completes in **under 100 ms** on a mid-range machine and re-runs synchronously on a threshold change. If it cannot, the fix is memoising the pure function — never precomputing in sync (AD-24).

### 4.2 The Payout Threshold Control

**Description.** The threshold sets what counts as a win, and moving it reorders the list. It sits at roughly a quarter of a Divine in early endgame and at a Divine or more once the player is richer and stronger, and it drifts upward through a league, which is why it is a control rather than a constant. Outcomes below it are worth nothing to the player because that much currency turns up simply playing. Realizes UJ-2.

**Functional Requirements:**

#### FR-6: Set the Payout Threshold and see the list reorder immediately

The player sets a Payout Threshold in Divine and the ranked list reorders in front of him. Realizes UJ-2.

**Consequences (testable):**
- The control is denominated in Divine — the same unit as every price and Craft Cost it filters (AD-17, AD-20).
- Changing the threshold re-runs the ranking synchronously against already-loaded artifacts; it triggers no network request and no sync.
- A base with one jackpot Combination and a base with many moderate ones swap order as the threshold crosses the moderate prices — this is the behaviour, not a bug.

#### FR-7: Remember the threshold between visits

The threshold and view preferences survive a page reload.

**Consequences (testable):**
- Persistence is the viewer's own browser storage only. There is no backend, no account, and no authenticated request (AD-15).
- A first visit with no stored value starts at a documented default. `[ASSUMPTION: 0.25 Divine, the brief's early-endgame figure, as the least-surprising cold start.]`

### 4.3 Combination Detail and Segregated Unknowns

**Description.** Expanding a Base Type reveals every Tracked Entry on it — priced and unpriced alike — so the player can see what the ranking is built from and, equally, what it deliberately excludes. A Combination with no listings is either a jackpot or junk, and listings cannot distinguish them; segregating unknowns keeps them out of the ranking without pretending they are worthless. Realizes UJ-3, UJ-5.

**Functional Requirements:**

#### FR-8: Expand a Base Type to its full tracked Combination list

The player expands any ranked Base Type and sees all its Tracked Entries with prices, Price States and ages. Realizes UJ-3.

**Consequences (testable):**
- Every Tracked Entry for that Base Type appears, whether or not it cleared the Payout Threshold. **`pruned` tombstones are included**, visually separated and showing their prune reason — this is what makes UJ-5's review possible without opening the file.
- Each row shows its Combination, its Price State, its price in Divine where priced, the number of listings the estimate rested on, and its age — labelled as an observation age or a last-attempted age per FR-12.
- Entries below the threshold are visibly marked as not contributing to the EV.

#### FR-9: Render the four Price States distinctly, with a reason on `not-yet-synced`

The four states are four different things on screen and are never collapsed into one another.

**Consequences (testable):**
- No Price State is rendered as `0`, blank, or "—" in a way that reads as worthless (AD-9).
- `no-listings` is presented as an open question, not an answer: the view must not imply the Combination is junk.
- `unresolvable` entries are surfaced rather than merely omitted, since their existence is the symptom of a game patch (AD-6).
- **`not-yet-synced` carries a reason** — `never-synced`, `league-mismatch` (FR-31) or `no-exchange-rate` (FR-23) — because one state covering three unrelated causes would defeat the point of distinguishing states at all. The reason is displayed, not merely stored.
- The distinction between states is not carried by colour alone (NFR-10).

### 4.4 Provenance and Freshness Surfacing

**Description.** Every price in the system is an asking price, no sale is ever observed, and a probability rests on whatever the Weights File's producer could actually source — which is expected to be uneven, band by band. A view that renders a placeholder identically to a well-founded figure would still be trusted months later, with nothing on screen to reveal the difference — the failure this feature exists to prevent. Realizes UJ-4.

**Functional Requirements:**

#### FR-10: Propagate and display the weakest Provenance behind every figure

Every displayed derived figure states what it rests on. Realizes UJ-4.

**Consequences (testable):**
- `core` propagates the **weakest** Provenance and the **oldest** timestamp of every input into each derived figure (AD-10).
- A figure resting on `uniform-prior` or `absent` renders visibly differently from one resting on `measured`, and not by colour alone (AD-10, NFR-10).
- The Weights File's declared producer and game patch are visible alongside any figure they influenced.
- The exchange observation used to normalise a price participates in Provenance exactly like any other input (AD-20).

#### FR-11: State the uniform-prior caveat globally when the per-row badge discriminates nothing

A Provenance badge identical on every row conveys no information, and the view must not pretend otherwise.

**Consequences (testable):**
- The condition is **read from the data, not assumed of v1**: the Weights File carries `provenance` per band (`WEIGHTS-FILE-SCHEMA.md`, propagated per AD-10), so what v1 ships is whatever the scraper produces, and a probability's Provenance may legitimately be `measured` (FR-30).
- When **every** probability in the loaded set carries `uniform-prior` or `absent`, the view shows a **persistent, dismissible-per-session banner** stating that the entire ranking rests on a uniform prior and that relative ordering between Base Types is not evidence-backed.
- The banner **disappears on its own** once any `measured` figure is present — it is a function of the data, not a build-time constant someone must remember to remove.
- The per-row badge is required regardless (FR-10): it is the discriminating signal the moment partial measured weights arrive, which is the likeliest shape of the first real file since coverage is expected to be uneven.
- Where the badge cannot yet discriminate, **freshness** is the genuinely discriminating per-row signal (FR-12), and the view gives it the visual weight Provenance has not earned.

#### FR-12: Show per-row freshness, and say which clock it is reading

Each row carries its own age, and the age of an unpriced row is as meaningful as the age of a priced one.

**Consequences (testable):**
- A single dataset-level timestamp is insufficient and must not be the only freshness signal, because Chunked syncing guarantees rows refresh at different times (AD-7, AD-10).
- Every row has an age **in all four Price States**, taken from its `observedAt` where there is an observation and from its `lastAttemptedAt` otherwise (AD-9).
- **The view labels which of the two it is showing.** They mean different things — *this price is three days old* versus *nothing has been found here for three days* — and a `no-listings` row that has been retried hourly all week is a different fact from one last looked at in the previous league. Collapsing them into one unlabelled "3d" would make the second indistinguishable from the first.
- A partially refreshed Dataset publishes and renders normally; per-row freshness is what makes that honest (AD-14).

#### FR-13: Present estimates as asking prices, never as realised value

The view's language never implies a price was achieved.

**Consequences (testable):**
- Prices are labelled as current asking prices from live instant-buyout listings (AD-23).
- No copy describes an estimate as "sells for", "worth", or any phrasing implying an observed sale.
- This is the *only* mitigation in the system for Risk R-1 (§9) — the player's manual loop had a real-sale correction the tool discards, and a copywriting rule does not replace it.

### 4.5 The Curated Tracked List

**Description.** The tracked list is simultaneously what the tool watches and the tool's entire request budget — every Tracked Entry costs a search on every refresh, so curation discipline is a permanent operating requirement rather than a one-time tuning exercise. It is a hand-owned, committed file; the browser never writes to it (AD-15, AD-21). The system cannot discover what it is not told to watch, and v1 records that limitation rather than solving it. Realizes UJ-5.

**Functional Requirements:**

#### FR-14: Bound every request to one of four declared sources

Exactly four things generate a trade API request, and nothing else does.

**Consequences (testable):**

| Source | Cadence | Cost |
| --- | --- | --- |
| `data/tracked.json` — the Combinations to price | every Chunk | one search + one fetch per entry |
| `data/currencies.json` — the currencies to price for Divine normalisation (FR-23) | every Chunk, **first** (FR-17) | small, fixed |
| League validation against the live leagues endpoint (FR-32) | once per run | one request |
| Catalogue refresh (FR-24) | explicit human-invoked command, patch cadence, **never on the Chunk path** | four requests |

- The first two are the recurring **workload**, both schema-pinned committed files; neither is written at runtime (AD-12, AD-21). The last two are fixed overheads.
- Exchange-rate acquisition is part of the **workload**, not an exception to it — `data/currencies.json` is one of the two workload files (AD-12, AD-20).
- The Sync Report records requests consumed **per source** against the live bucket, so budget drift is attributable to a cause (FR-25, AD-12).
- **A fifth source is an architecture amendment, not an implementation detail.**
- **The ceiling is denominated in searches, not entries.** A full refresh is held to **~1,500 searches** against a measured ceiling of ~2,400 per day, leaving headroom for retries, the currency set, the catalogue refresh, the per-run leagues check and a second recipe. One Tracked Entry always costs one search; what changes under AD-5's bands is *how many entries a curator needs* — isolating a jackpot tier means tracking two entries where one stood, and that second band spends from the same ceiling (AD-12).

#### FR-15: Honour Curation Status as schema-level behaviour

`active`, `pinned` and `pruned` are schema members with defined effects, not conventions.

**Consequences (testable):**
- `pinned` entries are refreshed in every Chunk and never wait their turn in the oldest-first ordering, subject to the cap of FR-17 (AD-23).
- `pruned` entries are excluded from the sync workload **and** from the ranking sum; a pruned entry's last-good price never contributes (AD-23, AD-17).
- A `pruned` entry carries its reason, so the same Combination is not re-added and re-learned each league, and that reason is surfaced in the view (FR-8).

#### FR-16: Reject an overlapping tracked list at load

Tracked Entries for one Base Type must describe mutually exclusive outcomes, because the sum of FR-1 is over a partition rather than a list.

**Consequences (testable):**
- Overlap is defined by a **predicate, not an enumeration** — an enumerated list of shapes has now missed a case twice (AD-17). Two entries on one Base Type overlap when, **for both slots**, either the slot is absent in one of them or their bands intersect. An absent affix means *any roll in that slot*, which is why the condition is a conjunction over both slots.
- Three consequences follow, the third of which the earlier enumeration missed:
  - **Adjacent disjoint tiers of one `statId` in one slot may both be tracked** — that is the point of AD-5's bands. Bands that *intersect* still overlap and are still rejected.
  - A **partial-affix entry subsumes a fuller one**: leaving a slot absent covers every roll in it.
  - **A prefix-only entry and a suffix-only entry on one Base Type overlap each other.** Neither subsumes the other and no two bands intersect — yet an item carrying both named modifiers satisfies both entries and is counted twice.
- **Separately, the crafted entries on one Base Type must share an Item Level Floor** (AD-17, FR-22). Entries at floors 75 and 82 are nested, not disjoint: every item the 82 search returns is also matched by the 75 search. The rule has a second, independent reason — EV is an expectation over *one* crafting act on *one* item population, and entries at different floors describe crafts on differently-levelled bases whose `P` terms are normalised against differently-scoped pools (FR-29). Summing them is not an expectation over anything.
- **A Raw Base is exempt from that floor rule.** It is never a summand (FR-3), so its floor cannot break a partition it does not enter — which is what lets a white base at ilvl 82 coexist with crafted entries on the same Base Type at a lower floor (AD-17).
- Overlap is rejected at load with the offending entries named — never reconciled at ranking time.
- Double-counting inflates that Base Type's `ΣP × price` by the measure of the overlap. It does not need `ΣP` to exceed 1 to do damage: a modest overlap on a high-priced Combination is enough to move a Base Type several places.

#### FR-17: Refresh the tracked list in a defined, deterministic rotation

The player asks *how often does a row get re-priced?* of every figure on screen, so the rotation is a requirement rather than an implementation choice. A Chunk selects entries in exactly this order and stops when any Chunk bound is reached (AD-26, FR-19).

**Consequences (testable):**

| Order | Selected | Why it sits here |
| --- | --- | --- |
| 0 | **Currency rates**, always, before any priced entry in the same Chunk | FR-23 requires it; a rotation omitting it produces a Chunk of `not-yet-synced` entries by construction |
| 1 | Every **`pinned`** entry, every Chunk — subject only to the cap below | this is what `pinned` means (FR-15) |
| 2 | **`active`** entries whose Price State is not `unresolvable`, by **oldest `lastAttemptedAt` first** | self-levelling; a full pass completes with no separate scheduler |
| 3 | Entries whose Price State **is** `unresolvable`, on a bounded retry — at most one attempt per entry per 24h | a patched-out modifier neither vanishes nor monopolises the rotation |
| 4 | **Never `pruned`** | excluded from the workload entirely (FR-15) |

- **What an `unresolvable` retry actually costs.** Detection is offline — the id is checked against the committed Trade Catalogue before any request is issued (FR-24) — so a retry spends a search only if the id now resolves, which it can only do after a human has run the catalogue refresh. The 24h bound therefore paces re-checking rather than protecting the request budget. `[NOTE FOR PM]` Build the bound as stated; its rationale in AD-26 is the part that does not hold — see §10 OQ-9.
- Ordering is on **`lastAttemptedAt`, not on observation time**. This is what keeps a permanently `no-listings` entry in the rotation without letting it monopolise it — such an entry never acquires an observation time, so an observation-ordered rotation would re-select it forever (AD-9, AD-26).
- `not-yet-synced` is treated as **infinitely old**, so a newly added entry is picked up before any refresh.
- **Rows 1–4 are a precedence order over two different fields.** Rows 1, 2 and 4 select on Curation Status; row 3 selects on Price State, and an entry can carry `active` *and* `unresolvable` at once. Such an entry is selected at row 3 only — lifting it out of row 2 is what makes row 3's bound mean anything, since otherwise the oldest-first ordering would re-select it every Chunk regardless.
- **The `pinned` set is capped**, enforced as a `data/tracked.json` validation error at load rather than left as a convention. The binding requirement is that **a Chunk must be able to refresh every `pinned` entry and still make progress on the `active` rotation below it** — an oversized pinned set consumes every Chunk, starves both its own tail and the rotation, and produces a symptom indistinguishable from a slow refresh. `[NOTE FOR PM]` Build to that requirement rather than to AD-26's literal *25% of AD-12's search ceiling*, which does not compose into a writable inequality — see §10 OQ-8.
- Ties break on the canonical entry key, so a run is reproducible and a resumed run is explainable (AD-26; the key's encoding is fixed by the spine's Consistency Conventions).
- The order is a **pure function** of the tracked list, the Dataset and a passed-in clock value, computed in `core` — so it is testable with literal inputs and identical between a dry run and a real one (AD-1, AD-26).
- **A resumed Chunk recomputes the order rather than replaying a frozen plan.** Progress records which entries a Chunk *completed*, not which it intended to visit; freezing a plan would act on a stale view of the Dataset and create a second, divergent notion of what the rotation is (AD-26, FR-19).

#### FR-18: Surface the tracked list's age

The player can see how long it has been since anyone reviewed what is tracked.

**Consequences (testable):**
- The date of the last tracked-list edit is recorded in the Sync Report and surfaced in the view (AD-23).
- It is derived from the git commit history of `data/tracked.json` rather than a hand-maintained field, since a hand-maintained one would go stale exactly when it mattered. `[ASSUMPTION: AD-23 requires the date be recorded but names no mechanism.]`
- The surfacing is unconditional — a list running unattended for months is visible as such without the player going looking.

**Notes:** `[NOTE FOR PM]` The tool cannot surface a Combination it was never told to watch (Risk R-2, §9). FR-18 exists so the gap prompts periodic deliberate review; it does not close it.

### 4.6 Background Price Sync

**Description.** A CLI that does one bounded Chunk of work and exits, invoked repeatedly by whatever scheduler the player has. A full refresh takes ~15 hours and consumes ~62% of the daily search budget — acceptable precisely because every figure is precomputed and nothing is on a user-facing path. How a price is estimated is fixed here rather than left to whichever agent writes `sync`, because every downstream number inherits it.

**Functional Requirements:**

#### FR-19: Run as a bounded, resumable, single-instance Chunk runner

One invocation performs one Chunk and exits.

**Consequences (testable):**
- A Chunk ends at whichever comes first: the remaining search allowance, the remaining fetch allowance, or the workload remainder (AD-7).
- **Neither allowance is a configured constant.** Both are whatever the governed client's live rate-limit state says is still available in the tightest unsatisfied bucket (FR-20), so a Chunk's size is discovered at runtime and no number is compiled in. The ~1,500-search figure of FR-14 is a budget across a full refresh, not a per-Chunk bound, and the two must not be conflated.
- Progress is schema-pinned and committed, so a killed run loses at most the requests in flight.
- A run acquires an exclusive on-disk lock; a run finding the lock held logs that and **exits 0**, because routine overlap is not a failure and a non-zero exit would make every scheduler treat it as one (AD-7).
- The syncer assumes nothing about what invokes it, how often, or where it runs.

#### FR-20: Route all outbound trade traffic through one rate-limit-adaptive client

Exactly one adapter issues trade API requests, and it paces from live headers.

**Consequences (testable):**
- It reads `X-Rate-Limit-Rules` to learn the active rule names, then parses the policy and `-State` headers for each named rule, and paces against the tightest unsatisfied bucket (AD-8).
- **No rate is hardcoded.** Measured values are the expected shape, not a compiled-in constant.
- On 429 it honours `Retry-After` and yields the Chunk rather than retrying tightly.
- It sends a descriptive `User-Agent` naming the tool and a contact address, as GGG asks of third-party tools.
- Requests are unauthenticated; no credential is stored or required.

#### FR-21: Estimate a price as the median of the cheapest instant-buyout listings

For each Tracked Entry, one search and one fetch produce one Price Observation.

**Consequences (testable):**
- The search is: that Base Type; that entry's Item Level Floor; `magic` rarity for an entry with affixes and `normal` for a Raw Base; the entry's Modifier References as stat filters carrying **both `min` and `max`** from the band; **instant buyout only**; **sorted by price ascending** (AD-16).
- Passing the band's `max` as well as its `min` is what makes the priced population the same population FR-29 computes a probability for. A min-only filter returns every higher tier and prices the band at its floor — the defect BQ-1 identified, reintroduced at the adapter (AD-5, AD-16).
- The Base Type goes in **`query.type`**, not `type_filters.category`. `category` takes taxonomy ids (`weapon.bow`), and no committed artifact maps a Base Type to its leaf category; the Base Type alone is sufficient and exact (AD-16, AD-25).
- Instant buyout is the option labelled **"Buyout or Fixed Price"**, whose `id` is JSON `null` and must be emitted explicitly rather than dropped by a serialiser. It is **not** `priced_with_info`, whose live label is *"Price with Note"* — getting this wrong does not error; it silently admits unpriced listings and corrupts every estimate (AD-16).
- The fetch retrieves the **cheapest 10 result ids**; the Price Observation is the **median of those listings' prices after normalisation to Divine**, recorded with the sample size actually returned (AD-16).
- Fewer than 10 results is valid and records the true count. **Zero results is `no-listings`, never a price** (AD-9).
- Where a result set spans listing currencies, the median is taken over normalised values, so the sample may not be the globally cheapest ten. Accepted and recorded, not corrected with extra requests.
- Ascending sort keeps stale overpriced listings out of the estimate, and instant-buyout-only removes listings priced below market that would already have been bought (AD-16).

#### FR-22: Derive each entry's Item Level Floor from its Accepted Tier

Each Tracked Entry declares the item level its search filters on, chosen by a stated rule rather than a global constant.

**Consequences (testable):**
- The **Accepted Tier** of a modifier is tier 1, **except** where tier 1 first becomes available at item level 81 or 82 — such modifiers are too rare to chase, and tier 2 is accepted instead.
- A Tracked Entry's **Item Level Floor** is the highest item level among its affixes' Accepted Tiers. Worked example: on bows, critical hit chance tier 1 appears at ilvl 73 and increased physical damage tier 1 only at 82 (rejected in favour of its tier 2 at 75), so a bow entry carrying both is floored at **75**.
- The Accepted Tier decision and the Modifier Reference's **band** are **one act** — since the trade API has no tier concept (AD-5), "accept tier 2" means setting the reference's `valueMin` and `valueMax` to the tier 2 band's edges.
- `itemLevelMin` is a declared field on the Tracked Entry, authored by hand. Neither `sync` nor `core` infers or adjusts it.
- Raw Bases are pinned to item level 82 (FR-3).
- **A Base Type has one Item Level Floor**, and it is derived in two steps, both by hand:
  1. Each crafted entry has a **candidate** floor — the highest item level among its own affixes' Accepted Tiers, per the rule above.
  2. The Base Type's Item Level Floor is the **maximum candidate across its crafted entries**, and every crafted entry on that Base Type declares it.
- Step 2 is what makes the shared floor reachable rather than merely required: two bow entries deriving candidates of 73 and 75 both declare **75**. Without it, FR-16 would reject a tracked list that FR-22 had just told the curator to author.
- Raising an entry from its own candidate to the Base Type's floor is **not cosmetic** — it widens that entry's scoped Eligible Pool and so changes its probability (FR-29). The curator is choosing one crafting proposition for the base, which is exactly what AD-17 requires; tracking the same base at two genuinely different floors is deferred, not available.
- The Base Type's crafted entries share that floor, enforced at load (FR-16, AD-17); a Raw Base at 82 is exempt because it is never a summand (FR-3).
- That floor is what scopes the Eligible Pool normalising every probability on the Base Type (FR-29, AD-18) — it is a valuation input, not only a search parameter.

#### FR-23: Normalise every price to Divine at the sync boundary

Raw listing currency never enters valuation.

**Consequences (testable):**
- All prices are normalised to Divine in `sync`; `core` sees no other unit (AD-20).
- Every normalised price records the exchange observation used — rate, source, timestamp — and that observation participates in Provenance and freshness propagation (AD-10, AD-20).
- Exchange rates for `data/currencies.json` are acquired **before any priced entry in the same Chunk** and are a declared part of the workload (AD-12, AD-20).
- If a listing's currency has no current rate, the entry is written `not-yet-synced` with reason `no-exchange-rate` rather than stored unnormalised (FR-9). There is no "priced but not yet convertible" state, because a half-normalised Dataset is one where the ranking is silently wrong rather than visibly empty.
- Persisted Divine prices are rounded to 4 decimal places once, at normalisation; `core` never re-rounds.

#### FR-24: Fail loudly on an unresolvable stat id or base type

A Tracked Entry referencing a `statId` or Base Type the trade API no longer exposes is never silently skipped.

**Consequences (testable):**
- `sync` writes that entry's Price State as `unresolvable` **and** records it in the Sync Report (AD-6).
- It is never skipped, never defaulted, and never left at its previous value — a patched-out modifier must not keep ranking on its last-good price forever (AD-6).
- Detection is by validating against the **committed Trade Catalogue** (`data/catalogue/*.json`), before any request is issued — never inferred from results. An empty result set is `no-listings` and never `unresolvable`; conflating them would report a patch-out every time a Combination simply had no sellers (AD-6, AD-9).
- The catalogue is refreshed by an **explicit human-invoked command at GGG patch cadence**, never as part of a sync run (AD-25). Its diff is how a renamed `statId` or a new Base Type becomes visible — the same mechanism fixtures use for response shapes (NFR-2).
- **Two checks, two surfaces.** Every id in `data/tracked.json` is checked and a failure becomes that entry's `unresolvable` state *and* a Sync Report line. Every id in the Weights File is checked and a failure is a Sync Report line **only** — `sync` reads that file and never writes it, so it is reported, not repaired (AD-6, AD-21).
- `core` excludes `unresolvable` entries from valuation; the view surfaces their existence (FR-9).

#### FR-25: Publish a structured Sync Report

Every run's outcome is data the view reads, not console output.

**Consequences (testable):**
- The report records requests consumed **per declared source** against the live bucket (AD-12, FR-14), unresolvable entries (AD-6), and the date of the last tracked-list edit (AD-23).
- It also records entries **not reached in this Chunk**. This field is **this PRD's own addition** — no architecture decision requires it — and it exists because a partially refreshed Dataset is otherwise indistinguishable from a stalled one. *Not reached* is a **rotation outcome, not a skip**: AD-6 forbids skipping, and FR-17's defined order is what makes the phrase precise — the entry's turn has not come, and the report says so rather than implying it was passed over (AD-26).
- `sync` commits only the files it owns, by explicit path — never `git add -A` — so an in-progress curation edit is never swept into an automated commit (AD-21).
- A dirty working tree elsewhere neither blocks a sync nor enters its commit.

### 4.7 Craft Cost

**Description.** Craft Cost is the term that keeps the ranking honest about failures: it is paid on every attempt, including the overwhelming majority that produce nothing worth selling. It moves during a league as currency prices move, so it is computed from synced rates rather than configured as a constant.

**Functional Requirements:**

#### FR-26: Compute Craft Cost in valuation, from synced rates

Craft Cost is derived in `core`, never stored by `sync`.

**Consequences (testable):**
- A Craft Recipe is a currency composition defined in `data/recipes.json`; its cost is computed in `core` from synced exchange rates, and `sync` never computes a craft cost (AD-22).
- v1 ships exactly **one** Craft Recipe: perfect transmute plus perfect augment. The file holds a list, so additional recipes need no code change.
- A Craft Recipe contributes **only a cost offset** in v1; the distribution transform is identity, so ordering is recipe-invariant and differs only by the subtracted cost (AD-18). This is a documented limitation — an implementer must not fill the gap by inventing a distribution. `[ASSUMPTION: the v1 Craft Cost is one perfect transmute plus one perfect augment. Larger currency quantities and partial-craft abandonment are not modelled.]`

### 4.8 Weights File Consumption

**Description.** Probabilities depend on how likely each modifier is to roll, which PoE2 does not publish and which this app never produces. It consumes a file with a defined schema and is indifferent to *which* producer satisfies it — but not to whether one does: the trade API exposes no pool membership, no tier, no item-level availability and no spawn weight, so the file is a **prerequisite** rather than an enrichment, and without it nothing ranks (§7.3). The decoupling is justified by cadence: prices move hourly, weights only when GGG patches the game.

**Functional Requirements:**

#### FR-27: Consume a schema-conformant Weights File and never produce one

`core` reads Modifier Weights from a file conforming to `WEIGHTS-FILE-SCHEMA.md` and does the normalising itself.

**Consequences (testable):**
- The file carries raw spawn weights per Base Type and affix slot, **banded by rolled value and by item level** — `(statId, valueMin, valueMax, itemLevelMin, weight)`. Producers must not normalise and must not pre-aggregate bands (AD-11, `WEIGHTS-FILE-SCHEMA.md`).
- **`itemLevelMin` is required on every band, and so is `valueMax`.** Neither has a default and neither may be `null`: `itemLevelMin` is the only source of the pool scoping FR-29 performs, and an open-topped band would make a Modifier Reference covering it span tiers again. A producer building to a 1.x shape emits a file that `core` refuses (schema **2.0.0**, breaking).
- Craft Recipe effects on the tier distribution are modelled in `core` and never baked into the file — a producer never needs to know a recipe exists (AD-11).
- `core` refuses an unknown `schemaVersion` major rather than guessing, and refuses to rank from an invalid file rather than ranking partially.
- Hard file errors reject the file outright (schema 2.0.0): an unknown `schemaVersion` major; a duplicate `(statId, valueMin, valueMax, itemLevelMin)` within a slot; **a missing or `null` `valueMax` on any band**; a **missing `itemLevelMin`**; overlapping value bands for one `statId` within a slot; a missing or negative `weight`; a missing `poolCoverage`; a `statId` or Base Type key absent from the committed Trade Catalogue (FR-24); or a band straddling a **band edge** in use by the tracked list.
- A `partial` pool, a Base Type absent entirely and a slot with an empty pool are **degraded but loadable** — the Base Type leaves the ordering rather than the file being refused (FR-4, FR-28).

#### FR-28: Enforce the pool-completeness contract in both directions

The producer obligation and the consumer treatment are two halves of one rule, and shipping only one of them produces a confidently wrong ranking.

**Consequences (testable):**
- **Producer side:** a `(Base Type, slot)` declaring `poolCoverage: "complete"` must enumerate **every** modifier that can roll there **at any item level**, including worthless ones, with true weights and true `itemLevelMin`. `weight: 0` means "cannot roll here" and is meaningful; omitting the entry instead breaks the completeness claim. There is no third option — a producer that cannot guarantee this declares `partial`.
- **Completeness does not depend on item level.** A band that only rolls at ilvl 82 belongs in a `complete` pool carrying `itemLevelMin: 82`; `core` scopes it out for an entry floored below that (FR-29). Omitting it because "we only care about ilvl 75" breaks `complete` — the claim is about the slot, not about one curator's floor.
- This obligation binds an **external project** (§7.3), and this document plus `WEIGHTS-FILE-SCHEMA.md` are its entire contract. Stating it as a requirement rather than leaving it as a schema footnote is what gives that project something to build to.
- **Consumer side:** a `partial` pool is a *lower bound on the denominator*, so every probability derived from it is an **upper bound**. `core` assigns such probabilities Provenance `absent` and the Base Type is Unrankable (FR-4) — this is the only path by which `absent` arises, and without it the Glossary's third Provenance value would be unreachable.
- A Base Type absent from the file entirely is likewise Unrankable; `core` has no other pool source and must not invent one (AD-18).

#### FR-29: Aggregate weights by band within an item-level-scoped pool

Probability derivation is specified precisely enough that two implementers cannot diverge.

**Consequences (testable):**
- A Modifier Reference is a **bounded band**: its weight is the sum of every Weights File band **within that same `(Base Type, slot)`** carrying that `statId` and lying **wholly inside** the reference — `band.valueMin >=` the reference's `valueMin` **and** `band.valueMax <=` its `valueMax`. **Whole bands only** (AD-5, AD-18). The `(Base Type, slot)` scoping is not optional; ignoring it is the commonest way two implementations diverge.
- **Both numerator and denominator are drawn from the same item-level-scoped pool**, scoped to the entry's Item Level Floor `L`: `{ band ∈ pool(base, slot) : band.itemLevelMin <= L }`. The conditional is written `P(modifier | base, slot, itemLevel)` (AD-18).
- Scoping only the denominator leaves a numerator counting bands that cannot roll at `L`, which inflates one modifier's probability without touching any other — and so **reorders the ranked list** rather than shifting it uniformly (AD-18).
- A Modifier Reference whose containment set is **empty** under that scope is a **validation error**, not a `P = 0`: it means the curator is tracking a tier that cannot roll on the item being crafted, and contributing zero would hide that (AD-18).
- That error is against **`data/tracked.json`**, not the Weights File — the file is complete and the tracked reference is the thing that is wrong — so it is detected in `core` at load and reported the way FR-24 reports a tracked-list failure. It is deliberately harsher than FR-27's treatment of a Base Type missing from the file entirely, which is merely Unrankable: a missing base is an absence the curator can see in the Unrankable group, whereas an unrollable band is a *silently* empty summand in a list that otherwise looks healthy.
- Every Weights File band carries `itemLevelMin`; a band without one is a hard file error (FR-27), because the scoping above has no other source for it.
- `P(Combination)` treats prefix and suffix as independent draws: `P(prefix) × P(suffix)`, with `P = 1` for an absent affix. Mod-group exclusion makes the second draw weakly conditional; that refinement is deferred (§7), not overlooked.
- A band straddling a **band edge** in use is a **hard file error**, not a pro-rata split — such a band prices a population the trade filter does not match, and no arithmetic can recover the difference.
- The craft is modelled as occurring on a base at **exactly** the entry's Item Level Floor, while the `ilvl >=` search returns a slightly higher-level superset. Accepted and recorded; correcting it would need an exact-item-level filter the trade API does not offer (AD-18).

#### FR-30: Depend on an externally produced Weights File as a v1 prerequisite

v1 ranks against a real file satisfying the real contract, produced by the external scraper project. **There is no fallback.**

**Consequences (testable):**
- The Weights File is a **release dependency**, not an enrichment (§7.3). It supplies pool membership, band edges, `itemLevelMin` and weights — and the trade API supplies none of those, so nothing in this system can derive what the file carries (AD-11, AD-25).
- Until a conforming file exists, **every crafted Base Type is Unrankable** (FR-4). That is the honest outcome rather than a degradation to engineer around: there is no other pool source and `core` must not invent one (AD-11, AD-18). Raw Bases are the exception and rank without it, since they carry no probability term (FR-3) — so what survives a missing file is a white-base price list, not the product.
- A **uniform-prior variant** — every band `weight: 1`, `provenance: "uniform-prior"`, `producer.id: "uniform-prior"` — remains a legal file and a valid *weighting* placeholder. It is never a *sourcing* one: it must still carry genuinely sourced pool membership and `itemLevelMin`, which are exactly the two fields nothing can fake.
- Whatever the file's weighting, the probability code path is exercised from day one and the ranking formula does not change shape when measured weights arrive.
- Every figure a `uniform-prior` band influences is labelled as such (FR-10), and FR-11's global caveat applies for as long as any remains.
- Where the producer cannot guarantee completeness, the affected `(Base Type, slot)` is emitted `poolCoverage: "partial"` rather than pretending to completeness (FR-28). The resulting coverage is measured before any view work (FR-4, §10 BQ-3).

### 4.9 League Lifecycle

**Description.** Three or four league resets a year wipe prices entirely, and the tool is least useful at league start — which is when the knowledge is worth the most. This is the central threat to the one-year horizon. The requirement is not to survive it gracefully but to fail *honestly*: an empty ranking is correct, last league's numbers served as current are not. Realizes UJ-6.

**Functional Requirements:**

#### FR-31: Refuse to value an observation from a different league

`core` treats a Price Observation from any league but the active one as absent rather than as stale-but-usable. Realizes UJ-6.

**Consequences (testable):**
- The active league is configuration in `data/config.json`; every Price Observation records the league it was observed in (AD-19).
- `core` refuses to value an observation whose league differs from the active one, treating it as `not-yet-synced` with reason `league-mismatch` (FR-9) rather than stale-but-usable.
- A league change is a config edit plus a natural re-sync: the ranking is honestly empty until data arrives, and refills without anyone rewriting the Dataset.
- The Dataset is **not** filtered on write; league filtering happens once, in `core`, so a league change does not blank the site while a re-sync runs (AD-14). `[ASSUMPTION: this makes a league change a config edit plus a natural re-sync with no manual purge. It follows from AD-14 and AD-19 but has not been exercised against a real reset.]`

#### FR-32: Validate the configured league against the live leagues endpoint

`sync` checks the configured league is real before spending any budget against it.

**Consequences (testable):**
- `sync` validates `data/config.json`'s league against the live leagues endpoint at the start of each run and fails loudly on a mismatch (AD-19).
- The validation happens before any priced entry consumes budget, and its single request is one of FR-14's four declared sources — a fixed per-run overhead, reported separately in the Sync Report.

### 4.10 Dataset Delivery

**Description.** How data reaches the view looks like an implementation detail and is not one: it decides whether a sync commit refreshes the site on its own or needs an application rebuild, which in turn decides whether the daily refresh is a background fact or a chore.

**Functional Requirements:**

#### FR-33: Fetch published artifacts at runtime as a consistent set

`web` reads its data at runtime rather than at build time.

**Consequences (testable):**
- `web` **fetches exactly eight artifacts** at runtime as separate cache-busted requests and never bundles them into the JS, so a sync commit updates data without rebuilding the app (AD-24): `dataset.json`, `sync-report.json`, `weights.json`, `recipes.json`, `tracked.json`, `config.json`, `catalogue/stats.json` and `catalogue/static.json`.
- The two catalogue files are what let the view render a `statId` as its human text and a currency as its icon **without a runtime call to pathofexile.com**, which is forbidden (AD-15, AD-25). Without them the view would show raw stat ids, which is the same list in a form the player cannot read.
- Three files are deliberately **not** fetched: `sync-progress.json`, internal to `sync`; and `catalogue/items.json` and `catalogue/filters.json`, which only `sync` needs (AD-3, AD-24). This is why the Base Type cross-check of FR-24 belongs to `sync` and cannot be performed at load in the browser.
- Each artifact carries `schemaVersion` and is validated on load; `web` refuses to render an invalid artifact rather than degrading (AD-3).
- `web` renders from a **single consistent set** and does not mix artifacts across a refresh (AD-24).

## 5. Cross-Cutting NFRs

- **NFR-1 — Zero network in the test path.** No test at any level makes a real network call. MSW runs in `onUnhandledRequest: "error"` mode so an unfixtured request fails loudly rather than escaping (AD-13). The hardest requirement in the brief: it is what lets an agent iterate against a service that would otherwise rate-limit it into uselessness, and what makes a red test mean "the code is wrong" rather than "GGG was slow."
- **NFR-2 — Fixtures are real captured responses.** Committed real payloads, never hand-written mocks. Re-recording is a separate, explicitly human-invoked command never part of a test run; the resulting fixture diff is the mechanism by which GGG's changes become visible (AD-13).
- **NFR-3 — Determinism.** Valuation is pure; time, randomness and configuration enter only as passed-in values. No test depends on wall-clock timing — rate-limit backoff is tested by injecting header values, not by waiting (AD-1, `AGENT-WORKFLOW.md`).
- **NFR-4 — Parallel worktree development.** Packages own disjoint directories with a one-way acyclic dependency graph, mechanically enforced in CI rather than by review, so two agents in two packages touch no common file (AD-2). `contracts` changes are **serialised and land alone, first**, with dependent work rebasing onto them — it is the one package everything depends on, so a change there is a broad rebuild and a likely conflict. **No worktree runs a live sync or a live catalogue refresh**: only the scheduled invoker on the player's machine runs `pnpm sync`, and `pnpm catalogue:refresh` is a human act on a game patch (FR-24). An agent verifying sync behaviour uses `pnpm sync:dry` — the full pipeline against recorded fixtures, writing nowhere. These partitioning rules are `AGENT-WORKFLOW.md`'s; AD-2 supplies only the dependency graph they rest on.
- **NFR-5 — One writer per file.** Every shared file has exactly one writer; hand-owned inputs belong to the player and sync-owned outputs to the syncer. An agent needing different data uses a fixture, never an edit (AD-21).
- **NFR-6 — Read-time budget.** Under 100 ms for a full ranking pass (§4.1).
- **NFR-7 — Static delivery, zero upkeep.** The view is a static bundle deployed by CI; no server to patch, no secret material, no credential to rot (AD-15).
- **NFR-8 — Schema versioning at every trust boundary.** Every published artifact and input file carries `schemaVersion` and is validated on load; a consumer refuses an unknown major rather than guessing. The producer validates before writing (AD-3, and the spine's Consistency Conventions).
- **NFR-9 — Third-party citizenship.** Requests identify the tool and a contact address, pace from live rate-limit headers, and honour `Retry-After` (AD-8). Preserving API access is a standing requirement — the product depends entirely on it (R-7).
- **NFR-10 — Accessibility floor.** AD-24 requires that the distinctions AD-10 mandates not be carried by colour alone. This PRD **extends** that rule to every product-meaningful distinction — Price State (FR-9), crafted versus Raw Base (FR-3) and Provenance (FR-10) — on the grounds that the reason AD-24 gives applies identically to all three. `[ASSUMPTION: the extension beyond AD-24's literal scope is this PRD's, not the spine's.]`

## 6. Non-Goals (Explicit)

- **Producing modifier weight data.** The scraper is a separate project; the app consumes a file and is indifferent to its producer (AD-11). This is a non-goal for *this repository*, not an optional input — the file is a release dependency (§7.3).
- **Advising whether to augment an item already in hand.** This decision is made dozens of times a session — far more often than the ranked list is read — and is excluded by design. The player can already tell an increased-stun-threshold roll is dead. It is the strongest v2 candidate if the pickup list proves out.
- **Loot filter export in v1.** PoE2's filter syntax has no working equivalent of `HasExplicitMod`, so a generated filter can express base type, item level and rarity but never modifier Combinations. It remains a **roadmap item** for automating the base-name half of the knowledge — but with a permanent ceiling: the modifier half stays in the web view, which makes the view the permanent product rather than a stepping stone. The brief's "eventually I won't have to memorize anything" outcome is not achievable.
- **Rare items.** Magic only: at most one prefix and one suffix.
- **Accounts, sharing, per-user preferences, anything multi-user.** Any requirement appearing to need a backend is escalated, not implemented (AD-15).
- **Visual design beyond an off-the-shelf framework.** Appearance is explicitly not a priority.
- **Price history features.** Git carries the history via sync commits; no v1 feature reads it (AD-14). UJ-5's "returned no listings all league" judgment is therefore the player's own recollection plus the current Price State, not a trend the tool renders.
- **Market scanning as candidate generation.** Rejected on both shallowness and cost — see the brief's addendum.
- **Sell-through speed as a ranking term.** Considered and rejected: the player was explicit that sell speed is not a factor.
- **Ranking on variance, median outcome, or an exposed risk preference.** At ~144 crafting decisions an hour, attempt volume makes mean-based math sound.
- **Discovering Combinations the player did not think to track.** Recorded as Risk R-2 (§9), not addressed.

## 7. MVP Scope

### 7.1 In Scope

- Magic Base Types — one prefix, one suffix — at per-entry Item Level Floors derived by the Accepted Tier rule (FR-22).
- Raw Bases at item level 82, threshold-truncated like any other outcome.
- Ranked Base Type list, bounded for readability, with chase Combinations, expandable to the full tracked Combination list including tombstones.
- Player-set Payout Threshold, re-ranking at read time.
- Background sync: unauthenticated, rate-limit adaptive, bounded, resumable, with a defined Refresh Rotation.
- Four-state pricing with reasons on `not-yet-synced`, unknowns segregated from the ranking.
- Provenance and per-row freshness throughout, plus the global uniform-prior caveat.
- Curation via hand-edited committed files, surfaced read-only in the view with tracked-list age.
- One Craft Recipe with cost computed from synced rates.
- A defined Weights File **schema**, with its pool-completeness contract enforced in both directions. The **file** itself is an external deliverable, not in scope here (§7.3).
- Divine normalisation at the sync boundary with exchange observations carried in Provenance.
- League-scoped observations with an honest empty state across a reset.

### 7.2 Out of Scope for MVP

- **A second Craft Recipe** — AD-18 makes ordering recipe-invariant in v1, so a second recipe adds a cost column and no ordering information. Revisit when distribution mechanics exist.
- **Producing Modifier Weights** — v1 ranks on whatever the scraper project delivers, gated by the coverage measurement of §10 BQ-3. The ranking improves as the file improves, without the app changing. What is out of scope is this repo producing weights, not the app having good ones.
- **Authenticated sync** — a quantified lever that would raise the rate limit, at the cost of reintroducing a rotting credential. Revisit only if a full refresh must exceed ~1,500 searches.
- **Mod-group conditional probability** — FR-29 assumes independent affix draws. Deferred until measured weights make the error estimable.
- **Coarser fallback pricing for zero-listing Combinations** — widening to "base + this prefix, any suffix" as a marked estimate. Held as the named option if the unknown bucket proves unusable. `[NOTE FOR PM]` The likeliest thing to be missed if `no-listings` turns out to be a large fraction of the Tracked List — check after the first full refresh (§10 OQ-6).
- **Spawn-weight disambiguation of the unknown bucket** — using modifier rarity to separate "rare and unlisted" (plausible jackpot) from "common and unlisted" (junk). This is the only identified route that actually *resolves* a `no-listings` entry rather than segregating it, and it is contingent on measured weights arriving. It is the reason the weights deferral above has a cost beyond provenance labelling.
- **Re-seeding the tracked list from community sources** — spawn weights for rarity, build popularity for demand. The most promising answer to Risk R-2, and the single largest gap v1 leaves open.
- **Repository split for the weights schema** — deferred until the schema stops moving; extraction is then mechanical.
- **A hosted syncer** — AD-7 makes this configuration rather than a rewrite. Revisit if a day-stale Dataset becomes intolerable.
- **Observability beyond the Sync Report** — a committed structured report is the whole story; no metrics stack.

### 7.3 Release Dependencies

One dependency sits outside this repository and gates the release rather than merely enriching it. It is stated here because leaving it implicit inside an FR is how a prerequisite gets discovered at integration.

- **The Weights File, from the external scraper project (FR-30).** It supplies pool membership, band edges, `itemLevelMin` and weights. The trade API supplies none of them (AD-25), so until a conforming file exists every **crafted** Base Type is Unrankable (FR-4) and what remains is a Raw Base price list rather than the product. The project is near completion, and the dependency is **accepted rather than worked around** — the alternative, a locally generated file, cannot honestly source the two fields that matter.
- **Its first gate is a measurement, not a delivery.** Pool coverage across the tracked list is measured before any view work begins, and the result binds a layout decision — **FR-4 states the bands normatively** (§10 BQ-3 carries the argument). A file that arrives is not the same as a file that covers enough.
- **It recurs on GGG patch cadence**, alongside the Trade Catalogue refresh (FR-24). Neither is on the Chunk path; a stale Weights File degrades Provenance and a stale catalogue degrades id validation and display text. Neither breaks the app, and both surface as a reviewable diff.

## 8. Success Metrics

Behavioural, not numeric. There is one user, and instrumenting the tool would be more work than the signal is worth, so each metric is observed by the player's own recollection — the only instrument available.

**Primary**
- **SM-1: The trade site stays closed mid-session.** The player stops opening the trade site to price-check while mapping. Validates FR-1, FR-2, FR-8.
- **SM-2: The mental top-five goes away.** The player stops keeping a list of chase bases in his head. Validates FR-1, FR-6.
- **SM-3: A league start costs days, not weeks.** The list is useful within days of a reset rather than after weeks of relearning. Validates FR-31, FR-32.
- **SM-4: The list holds up against reality.** Chase decisions made from the list match what actually sells — judged by the player noticing his sales agree with it, since the tool observes no sale (Risk R-1). Validates FR-21, FR-1.

**Secondary**
- **SM-5: The tool is still running in a year.** No credential expired, no server needed patching, no maintenance task was skipped into breakage. Validates NFR-7, FR-20.
- **SM-6: Agents ship without a human unblocking them.** Development proceeds with tests passing offline and no live API in the loop. Validates NFR-1, NFR-2, NFR-4.

**Counter-metrics (do not optimise)**
- **SM-C1: Searches per full refresh.** Growing the Tracked List makes the tool appear comprehensive while making a daily refresh impossible: ~10,000 searches would need ~4× the ~2,400 a day the measured rate limit allows. Held at ~1,500 **searches**, which is the quantity the rate limit actually constrains — counting entries would miss a curator splitting one entry into two bands to isolate a jackpot tier, which costs a second search while the entry count looks unchanged (FR-14). Counterbalances SM-4.
- **SM-C2: Refresh frequency.** Chasing a faster refresh spends budget that retries, currency rates and a second recipe need, for prices stable at daily resolution. Counterbalances SM-1.
- **SM-C3: Number of ranked Base Types shown.** A longer list is not a better one. Bounded by FR-5. Counterbalances SM-2.
- **SM-C4: Apparent confidence.** Rendering `uniform-prior` figures as cleanly as measured ones would make the tool feel more authoritative and be more dangerous. Counterbalances SM-4, and is why FR-10 and FR-11 exist.

## 9. Risks

R-1 through R-6 are carried from the brief, which named them and did not solve them. R-7 is carried from the architecture. None is closed by v1.

- **R-1 — Listings are supply, not demand.** Every price is what someone is asking, filtered to be plausible. **No sale is ever observed.** The manual loop the tool replaces had a correction the tool discards: the player actually sold things and found out. Mitigation is honesty only (FR-13), not correction.
- **R-2 — The tool cannot discover what it is not told to watch.** A Combination that becomes valuable mid-league stays invisible. The list needs periodic deliberate review rather than running unattended (FR-18). Re-seeding from community sources is the identified answer and is out of v1.
- **R-3 — `measured` weights will carry the same listing bias.** Community weight sources derive from parsing trade listings, which skew toward desirable and higher-tier modifiers. `provenance: "measured"` therefore means *measured by someone*, not *ground truth*, and the honesty apparatus must not imply otherwise. This also independently validates FR-21's ascending sort — the same reasoning poe2db uses when parsing lowest-value listings.
- **R-4 — Request budget is the permanent binding constraint.** Every tracked entry costs a search every refresh. Discipline is an operating requirement, not a one-time tuning exercise (SM-C1).
- **R-5 — Zero-listing Combinations are unresolvable in v1.** A Combination with no listings is either a jackpot or junk, and listings cannot distinguish them. Segregation (FR-9) keeps them out of the ranking without resolving them.
- **R-6 — League and patch churn.** Resets wipe prices; patches move the modifier data underneath. The tool is least useful at league start, which is when the knowledge is worth most. The central threat to the one-year horizon.
- **R-7 — Every endpoint the product depends on is undocumented.** GGG's developer documentation covers the OAuth API and makes no mention of the trade or `trade2` endpoints, so search, fetch and all four catalogue endpoints are unsupported surface that happens to work, and may change or close without notice or deprecation (AD-8). Nothing in the product can prevent that. What it does instead is make a break **loud and cheap**: one governed client (FR-20), committed fixtures whose re-record diff exposes a reshape (NFR-2), a committed catalogue whose refresh diff exposes a rename (FR-24), and no user-facing path that calls the API live (NFR-7). Recorded so it is not rediscovered as a surprise.

## 10. Resolved Defects and Open Questions

### Resolved by spine rev 2 — retained as the record of why the valuation model is shaped this way

These were defects in the **inherited** valuation model, surfaced by validation of this PRD. Per `AGENT-WORKFLOW.md`'s definition of done ("any invariant the task discovered is raised against the spine rather than encoded locally"), they were raised against the spine rather than patched in `core` — and **Architecture Spine revision 2 absorbed all three**. The analysis is kept because none of it is visible in the amended decisions themselves: a reader who wants to know why a Modifier Reference must carry a ceiling, or why the pool is scoped before it is summed, will find the argument only here.

1. **BQ-1 — A floor-spanning probability is multiplied by a lowest-tier price.** AD-18 makes a Modifier Reference "a floor spanning tiers," summing T1 and T2 weight into one probability. AD-16 then prices that reference by sorting **ascending** and taking the median of the cheapest ten — which, since lower tiers are commoner and cheaper, is essentially the **T2** price. EV therefore computes `P(T1 ∪ T2) × price(T2)`. The T1 jackpot is not merely understated: if the T2 price falls below the Payout Threshold, the entire entry truncates to zero and takes the jackpot mass with it — the exact outcome threshold-truncated EV exists to prevent. AD-17's overlap rule blocks the obvious workaround, since tracking T1 and T2 as separate nested floors is a validation error by construction. **Proposed amendment:** make `ModifierRef` a bounded band `(statId, valueMin, valueMax?)` rather than a floor. Tiers become disjoint, AD-17's partition is restored, each tier carries its own price, and the Weights File already models bands this way. Trade stat filters accept both a min and a max, so this is tractable. **Resolved:** adopted in AD-5, which now makes `valueMax` required everywhere with no open-top form — an omitted ceiling being a floor by another name. The change is carried into AD-16's stat filters, AD-17's overlap predicate and AD-18's containment rule. Reflected in FR-16, FR-21 and FR-29.
2. **BQ-2 — The Eligible Pool has no item-level dimension.** Which modifiers can roll depends on item level — FR-22's own example has bow physical-damage T1 unable to roll below ilvl 82 — but AD-18 and the Weights File model exactly one pool per `(Base Type, slot)`. A probability normalised over that pool describes a population the search does not return, so both numerator and denominator are wrong for any entry whose floor sits below the top of its pool. This is **not created by FR-22** — AD-16 already filtered on "endgame item level" — but per-entry floors make it explicit and unavoidable. **Proposed amendment:** either add an `itemLevelMin` to each Weights File band so `core` can scope the pool to the entry's floor, or declare a single canonical item level per Base Type and require all its entries to share it. The first is correct; the second is cheaper. **Resolved: both were adopted, because they fix different defects.** Weights File schema 2.0.0 requires `itemLevelMin` on every band and AD-18 scopes both halves of the ratio by it — that fixes the denominator. AD-17 independently requires the crafted entries on one Base Type to share an Item Level Floor — that fixes the partition, since entries at different floors are crafts on differently-levelled populations and their sum is not an expectation over anything. Reflected in FR-16, FR-22, FR-27 and FR-29.
3. **BQ-3 — Pool coverage is unmeasured, and it gates how much of v1 exists.** Every incomplete `(Base Type, slot)` declares `partial`, which makes that Base Type **Unrankable** (FR-4, FR-28) — removed from the ordering, not annotated, because an inflated denominator reorders the list and a provenance label does not change a sort. So the size of the ranked list is a direct function of the Weights File's coverage, and nobody has measured it. If coverage is poor, v1's ranked list is a small fraction of what the player tracks and the product does not work on day one. **Decision rule, so this does not sit open.** **FR-4** states it normatively and is the copy to build to; what follows is the argument for it. Measure coverage *before* building the view. If **≥80%** of tracked Base Types resolve to `complete` pools in **both** slots, proceed as specified. If **50–80%**, proceed but make FR-4's Unrankable group a first-class surface rather than a footer. If **<50%**, the ranking premise fails and is escalated rather than shipped around. **Resolved:** promoted verbatim into **AD-27**, which fixes the denominator as the tracked list rather than the catalogue and is deliberately **source-agnostic** — it binds whatever produces the Weights File and survives a change of producer untouched. Reflected in FR-4. **Owner: build, first task, before any view work.**

### Non-blocking

4. **OQ-4 — Where do Accepted Tier item levels come from? — CLOSED.** FR-22's rule needs, per modifier, the item level at which each tier becomes available, and this was neither in the trade API nor in the Weights File schema. It is now a **required field of the schema** (`itemLevelMin`, on every band — FR-27, FR-29), owned by the file's producer rather than hand-assembled by the curator. OQ-4's own closing note anticipated this. What remains open is the *producer's* sourcing problem, which the spine carries as its own open question and AD-27's coverage gate then measures. **Owner: transferred to the weights scraper project.**
5. **OQ-5 — Recipe distribution mechanics.** Nothing supplies how perfect versus greater transmute and augment shift the tier distribution. v1 ships one recipe with an identity transform under a documented assumption; ranking per `(Base Type, Craft Recipe)` as the brief describes needs this resolved. **Deferred to v2.**
6. **OQ-6 — What fraction of the Tracked List returns `no-listings`?** Unknown until the first full refresh. If large, the deferred coarser-fallback pricing (§7.2) moves from "held option" to "needed." **Revisit after first full refresh.**
7. **OQ-7 — Cold-start seeding.** The first Tracked List must be authored from the player's existing knowledge — the very knowledge the tool exists to supply. No v1 mechanism beyond sitting down and writing it. Not a blocker; the acknowledged price of the curation approach.

### Raised against the spine by this revision

Four items found while reconciling this PRD against revision 2. None blocks a build — each has a safe reading the PRD states — but each is a place where two decisions do not compose, and the spine is where they get fixed.

8. **OQ-8 — The `pinned` cap is denominated against the wrong quantity.** AD-26 caps the pinned set at *25% of AD-12's search ceiling*, but that ceiling is ~1,500 searches across a **full refresh** of many Chunks, while `pinned` costs a search **every Chunk**. The two do not compose into an inequality an implementer can write. FR-17 states the requirement the cap exists to serve and flags the gap. **Owner: architecture.**
9. **OQ-9 — The `unresolvable` retry bound is justified by a cost AD-6 removed.** AD-26 bounds retries so a patched-out modifier does not "consume the budget every chunk", but AD-6 detects unresolvability offline against the committed catalogue before any request is issued, so retries are free until a human refreshes the catalogue. The bound is harmless; its stated reason is not the real one. **Owner: architecture.**
10. **OQ-10 — AD-27's coverage denominator counts Base Types that need no pool.** The gate divides by every distinct `baseTypeId` in `data/tracked.json`, but a Base Type tracked only as a Raw Base ranks with no Eligible Pool at all (FR-3, FR-4) and can never resolve to `complete`. Including it depresses a fraction that binds a **layout decision**, so the measurement may promote the Unrankable group on the strength of bases that were never unrankable. **Owner: architecture; affects the measurement that gates view work.**
11. **OQ-11 — The spine still writes `valueMax?` in two places.** AD-5 makes `valueMax` required everywhere with no open-top form, and explains why at length; AD-11 and AD-18 still spell the band `(statId, valueMin, valueMax?, …)` and AD-18 still says "an omitted `ref.valueMax` is unbounded above". This PRD follows AD-5 throughout (§3, FR-27, FR-29). Editorial, but an implementer reading AD-18 alone would build the defect BQ-1 removed. **Owner: architecture.**

## 11. Assumptions Index

- **§4.1 / FR-2** — Chase Combinations are ordered by contribution to EV (`P × price`), not raw price; and **three** are shown per row.
- **§4.1 / FR-3** — Item level 82 is the effective cap for white bases, so a floor of 82 and "exactly 82" are the same filter.
- **§4.1 / FR-5** — The ranked list shows **20** Base Types before an explicit expand.
- **§4.2 / FR-7** — The cold-start Payout Threshold default is 0.25 Divine.
- **§4.5 / FR-18** — The tracked-list edit date is derived from git history rather than a hand-maintained field.
- **§4.7 / FR-26** — Craft Cost is one perfect transmute plus one perfect augment, paid on every attempt. Neither larger currency quantities nor partial-craft abandonment is modelled.
- **§4.9 / FR-31** — A league change requires only a config edit and a natural re-sync, with no Dataset rewrite and no manual purge. Follows from AD-14 and AD-19 but has not been exercised against a real reset.
- **§5 / NFR-10** — The colour-alone prohibition is extended beyond AD-24's literal scope to Price State and Raw Base distinctions.
