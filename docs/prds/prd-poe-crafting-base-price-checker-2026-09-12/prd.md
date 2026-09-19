---
title: PoE2 Crafting Base Price Checker
status: final
revision: 14
created: 2026-09-12
updated: 2026-09-19
sources:
  - docs/briefs/brief-poe-crafting-base-price-checker-2026-09-12/brief.md
  - docs/briefs/brief-poe-crafting-base-price-checker-2026-09-12/addendum.md
  - docs/sprint-change-proposal-2026-09-13.md
  - docs/sprint-change-proposal-2026-09-19.md
inherits:
  - docs/architecture/architecture-poe-crafting-base-price-checker-2026-09-12/ARCHITECTURE-SPINE.md
  - docs/architecture/architecture-poe-crafting-base-price-checker-2026-09-12/WEIGHTS-FILE-SCHEMA.md
  - docs/architecture/architecture-poe-crafting-base-price-checker-2026-09-12/IMPLEMENTATION-NOTES.md
  - docs/architecture/architecture-poe-crafting-base-price-checker-2026-09-12/AGENT-WORKFLOW.md
---

# PRD: PoE2 Crafting Base Price Checker

## 0. Document Purpose

This PRD is the requirements layer for a single-player tool that answers one question: *is this base worth picking up?* It is written for the agents that build the tool and for the workflows that turn it into epics and stories.

**Altitude.** This document states what the player gets and why it matters, and cites where each behaviour is decided. It never states how. Formulas, predicates, file shapes, field rules, thresholds the architecture chose, and every version number live in `ARCHITECTURE-SPINE.md` and its companions, and this document points at them by stable id. A sentence here that would change if the architect chose a different mechanism for the same player need is a defect in this document, not a requirement.

**Inheritance.** `ARCHITECTURE-SPINE.md` is settled and its decisions are inherited, not re-decided. A citation `(AD-n)` names the decision and its rationale. Under **AD-0**, a companion section an AD delegates to binds exactly as that AD, so a citation to `IMPLEMENTATION-NOTES.md` or `WEIGHTS-FILE-SCHEMA.md` is a citation to the architecture. The spine's *Retired AD map* is the authority for any id that no longer resolves.

**Conventions.** §3 defines every domain noun and the rest of the document uses those terms verbatim. FRs are numbered globally, FR-1 to FR-33, and a number is never reused or reassigned. A bullet marked *(PRD-owned)* is a product decision this document owns, and the architecture does not adjudicate it. A heading marked *Architecture-owned* names a capability whose acceptance conditions live in the cited decision rather than here; a workflow turning this document into stories reads the cited decision for acceptance rather than the bullets below it. Inline `[ASSUMPTION]` tags are indexed in §11. Revision history lives in `.memlog.md` and git, not here. Rationale that earned recording but not a place here is in `addendum.md`.

## 1. Vision

Farming crafting bases is among the most reliable ways to make currency in Path of Exile 2's endgame, and memory gates the method entirely. The method only pays once the player knows which Base Types to pick up and which modifier combinations sell. The player buys that knowledge with weeks of picking up everything, crafting on it, price-checking the result, and slowly committing the answers to memory. League resets destroy that learned knowledge three or four times a year, at exactly the moment the knowledge is worth the most.

This tool replaces the memorisation with a ranked list. A background sync prices a curated set of base-and-modifier combinations against the official trade API. A static web view ranks Base Types by **expected payout per craft**. The view counts only outcomes above a threshold that the player sets, and subtracts the cost of the craft, which the player pays on every attempt including the failures. The player reads the list before a play session, or whenever the economy is worth a look. The list is precomputed, so the list never blocks on a live API call.

The ranking is not "most expensive base," and everything else in the system exists to make that distinction hold. A Base Type with one jackpot combination and a Base Type with many moderate combinations swap places as the threshold moves. For that reason the threshold is a dial the player turns, rather than a constant that someone compiled in. The sync, the schemas and the view all exist to make that one number right, and to make that number honest about what it rests on.

## 2. Target User

### 2.1 Jobs To Be Done

- **Decide, at a glance, what to pick up this week.** Functional: convert a live market into a short ordered list of Base Types worth inventory space.
- **Stop paying the memorisation tax.** Emotional: the relief of not holding a top-five list in your head, and of not losing that list at every league start.
- **Know when the answer has gone stale.** The player must be able to tell a figure resting on real measured weights from a figure resting on a uniform placeholder, and a row priced an hour ago from a row priced yesterday. If the tool does not tell the player, the player will trust the placeholder six months later.
- **Spend time playing, not crafting.** Contextual: the binding constraint is the player's own time. Outcomes below the player's threshold are worth nothing to the player, because that much currency turns up simply from playing. Such outcomes must therefore contribute nothing to the ranking.
- **Keep a tool alive for a year without the tool becoming a second job.** The maintenance surface is a first-class concern: no credentials to rot, no server to patch, no account system.

### 2.2 Non-Users (v1)

- **Anyone who is not the author.** The author publishes the tool openly but does not advertise it. Friends with the link and passers-by are welcome and explicitly not courted — no growth goal, no monetisation, no advertising.
- **Players wanting advice on an item already in hand.** The augment decision is excluded by design (§6).
- **Rare-item crafters.** Magic bases only: at most one prefix and one suffix.
- **Anyone needing their own settings.** No account, no per-user persistence, no sharing (AD-15). The tool may assume one player's thresholds, one player's playstyle, and one player's judgment about when to trust the tool. That freedom is load-bearing.

### 2.3 Key User Journeys

There is a single operator, a single role, no authentication and no multi-device handoff. These journeys are therefore written in the template's lighter form.

- **UJ-1. The pre-session read.** The player is about to map for two hours. The player opens the view, glances at the top five Base Types under his current threshold, notes the two or three Chase Combinations on each Base Type, and closes the view. He picks up accordingly for the rest of the session.
- **UJ-2. The threshold turn.** The player is now richer than at league start. He types a new threshold over the old one, from a quarter of a Divine to one Divine. The list reorders as soon as the typed value parses — steady moderate Base Types fall away, jackpot Base Types rise — and he re-reads the new top five. The control is a number input, not a slider: exactness and masthead width were traded for the continuous sweep.
- **UJ-3. The drill-down.** The player is unsure why an unfamiliar Base Type ranks third. He expands that Base Type and reads the full tracked Combination list: which Combinations are priced, at what price, how old each price is, and which Combinations returned no listings.
- **UJ-4. The trust check.** The player notices a Base Type that ranks suspiciously high. He sees that the price of that Base Type was observed three days ago, and that the whole ranking is flagged as resting on the uniform prior. He discounts that Base Type rather than acting on it.
- **UJ-5. The curation pass.** The player reviews deliberately after a few weeks. He sees three Combinations that have returned no listings all league, and one Combination flagged unresolvable since the last patch. He opens `data/tracked.json`, tombstones the dead Combinations with a reason, pins one Combination he wants watched closely, and commits. The next sync run reflects the edit.
- **UJ-6. The league reset.** A new league starts. The player edits the active league in `data/config.json` and commits. The ranking goes honestly empty rather than quietly serving last league's numbers, and the ranking refills over the following day.

## 3. Glossary

Downstream readers and workflows use these terms exactly. A synonym introduced anywhere is a discipline violation. Each entry is a definition; the shape and the rules behind it are the cited decision's, and the spine's *Core entities* section carries the entity diagram.

- **Base Type** — a specific item base in PoE2, identified by the trade API's own id and never re-encoded (AD-5).
- **Modifier Reference** — the canonical identity of a **Stat Line** a curator tracks: a trade stat id with a closed value band, or a stat id with no value at all for a modifier that rolls no number (AD-5). A Modifier Reference names what the trade API can filter on, never a game modifier.
- **Tracked Entry** — one unit of the curated workload: a Base Type, an optional prefix Modifier Reference, an optional suffix Modifier Reference, a declared **Item Level Floor** and a **Curation Status** (AD-5, AD-12). Each present Modifier Reference carries a hand-written, display-only **Accepted Tier** label (FR-22).
- **Raw Base** — a Tracked Entry with no affixes: an uncrafted white base at item level 82, the one case where selling the base may beat crafting on it.
- **Combination** — the outcome a Tracked Entry describes: this Base Type carrying this prefix and this suffix. A Raw Base describes the degenerate Combination of no affixes, and the Payout Threshold applies to it exactly as to any other (FR-3, AD-17).
- **Chase Combination** — one of the Combinations on a Base Type that contributes most to its EV. The collapsed ranked row shows it, so the player knows what to look for without expanding the row (FR-2).
- **Tracked List** — the complete curated set of Tracked Entries, held in `data/tracked.json`. It is at once what the tool watches and the tool's entire request budget (AD-12).
- **Item Level Floor** — the minimum item level a Tracked Entry's search accepts, declared per entry by the curator from the tier worth chasing (FR-22). Crafted entries on one Base Type share one floor; a Raw Base at 82 is exempt (AD-17).
- **Accepted Tier** — for a modifier, the tier or run of adjacent tiers worth chasing, expressed as the Modifier Reference's band and labelled beside it as a string such as `T1` or `T1–T2` (AD-5, AD-11). The label is display-only: nothing derives it, validates it, joins it to the Weights File, or keys on it (FR-22).
- **Curation Status** — exactly one of `active`, `pinned` or `pruned` (AD-12). A `pinned` entry is refreshed first whenever a Chunk can afford it, within the cap `IMPLEMENTATION-NOTES.md` §6 states; a `pruned` entry is a tombstone carrying its reason, excluded from sync and from the ranking (AD-7, FR-15).
- **Refresh Rotation** — the deterministic order in which Chunks refresh the Tracked List over many runs (AD-7, FR-17).
- **Price Observation** — an observed price for a Tracked Entry, normalised to Divine and stamped with its observation time, league and exchange observation (AD-16, AD-19, AD-20). It exists only where there is an observation; attempt-scoped facts live on the Dataset entry instead (AD-9).
- **Price State** — exactly one of `priced`, `no-listings`, `not-yet-synced` or `unresolvable`; absence is never zero, null or a missing key (AD-9). `not-yet-synced` carries a reason: `never-synced`, `league-mismatch` or `no-exchange-rate` *(PRD-owned; FR-9)*.
- **Divine** — the single currency denomination that crosses every boundary: every price, every Craft Cost and the Payout Threshold (AD-20, AD-17).
- **Payout Threshold** — the player-set gross price, in Divine, below which a Combination's outcome contributes nothing to a ranking (AD-17).
- **Craft Recipe** — a named crafting currency composition. v1 ships one: one perfect transmute plus one perfect augment *(PRD-owned; FR-26)*.
- **Craft Cost** — the Divine cost of one Craft Recipe attempt, computed from synced exchange rates and paid on every attempt including failures (AD-20).
- **Expected Value (EV)** — the ranking figure: the threshold-truncated expected payout of a Base Type under a Craft Recipe, less Craft Cost (FR-1, AD-17).
- **Stat Line** — one trade-API-visible stat that a game modifier publishes; a modifier may publish several, and they roll together as one draw (AD-11). A Modifier Reference names a Stat Line.
- **Modifier Weight** — one entry of the Weights File: one tier of one modifier in one Base Type and affix slot, carrying its spawn weight and its Stat Lines as published (AD-11, `WEIGHTS-FILE-SCHEMA.md`).
- **Weights File** — the externally produced file of Modifier Weights that `WEIGHTS-FILE-SCHEMA.md` defines. It is a v1 prerequisite, not an enrichment: it is the only source of pool membership, tier value ranges and item-level availability (AD-11, FR-30).
- **Trade Catalogue** — the committed mirror of the trade API's own data endpoints, refreshed on command at patch cadence. It is an identity and validation authority only and contributes nothing to the Eligible Pool (AD-25).
- **Eligible Pool** — the set of Modifier Weights that can roll in one Base Type and slot, scoped to a Tracked Entry's Item Level Floor before any probability is computed (AD-11, AD-17). A pool declared anything other than complete makes its Base Type Unrankable.
- **Provenance** — what a derived figure rests on, in a three-value order from weakest to strongest: `absent` (an upper bound from a partial pool, not an estimate), `uniform-prior` (an invented weight), `measured` (a weight someone measured, never ground truth; R-3) (AD-10). Every derived figure carries the weakest Provenance and the oldest timestamp of its inputs.
- **Unrankable** — a Base Type whose crafted branch the tool excludes from the ordering because its Eligible Pool is incomplete or absent; it appears in a separate group with the reason (AD-17, FR-4).
- **Chunk** — one bounded, resumable unit of sync work, sized at runtime and never configured (AD-7).
- **Dataset** — the published snapshot of the latest Price Observation per Tracked Entry, together with the current exchange rates (AD-19, AD-20).
- **Sync Report** — the published structured record of a sync run: requests consumed per source, unresolvable entries, entries not reached in this Chunk *(PRD-owned)*, pinned-starvation records, the measured pool-coverage fraction with its denominator, and the date of the last Tracked List edit (AD-7, AD-12, AD-27, FR-25).

## 4. Features

### 4.1 The Ranked Base List

**Description.** The Ranked Base List is the product's first screen; in most sessions the player reads nothing else. It is one ordered list of Base Types, most profitable first. Each row carries the Base Type's EV, the Combinations worth chasing on it, and the Provenance the EV rests on. The browser ranks on every input change, so the Payout Threshold reorders at once (AD-4). Realises UJ-1, UJ-2, UJ-3.

**Functional Requirements:**

#### FR-1: Rank Base Types by threshold-truncated expected value

The player sees Base Types ordered by EV, computed under the active Craft Recipe and the current Payout Threshold. Realises UJ-1.

**Consequences (testable):**
- For a crafted Base Type, the ranking figure is (AD-17):

```
EV = ( Σ P(combo) × price(combo) over Combinations that are priced and whose price ≥ Payout Threshold ) − Craft Cost
```

- The Payout Threshold compares against a Combination's gross price, never its price net of Craft Cost; Craft Cost is subtracted once per Base Type, not once per Combination (AD-17).
- A Combination whose Price State is not `priced`, or whose Curation Status is `pruned`, contributes nothing to the sum — not zero, nothing. Pruning therefore changes the ranking (AD-9, AD-12).
- A Base Type whose every Combination falls below the Payout Threshold is still ranked, at an EV of minus its Craft Cost; it is not Unrankable (AD-17).
- Changing the Payout Threshold reorders the list without a sync. `core` computes every ranking term and the view computes none (AD-4).
- The probability and the price of a Combination describe the same population: both are scoped to the Tracked Entry's Item Level Floor, and a Tracked List in which two Tracked Entries on one Base Type could be satisfied by a single item is refused at load, because the sum is over a partition (AD-17, FR-16).

#### FR-2: Show Chase Combinations on each collapsed row

Each ranked row names the Combinations most worth chasing on that Base Type, without the player expanding the row. Realises UJ-1.

**Consequences (testable):**
- Chase Combinations are ordered by their contribution to EV, not by raw price; `core` returns that order and the view shows a prefix of it (AD-17). `[ASSUMPTION: the brief says "chase modifiers" without defining the ordering. An ordering by price alone would advertise a Combination the player will essentially never roll.]`
- The collapsed row shows at most three Chase Combinations *(PRD-owned)*. `[ASSUMPTION: the brief's "modifier combinations to look for" is plural and unbounded. Three fits a scannable row and matches UJ-1's "top five bases" reading pattern.]`
- Only Combinations at or above the Payout Threshold appear, so the set changes with the Payout Threshold.
- A Base Type whose priced Combinations all fall below the Payout Threshold shows no Chase Combination, and its EV is negative by its Craft Cost.

#### FR-3: Rank Raw Bases on a separate branch, visibly labelled

Uncrafted item-level-82 white Base Types rank in the same list, valued as a sale rather than a craft, and labelled as uncrafted.

**Consequences (testable):**
- A Raw Base's EV is its observed price with zero Craft Cost. A Raw Base is never a summand in any crafted Base Type's sum (AD-17).
- The Payout Threshold applies to a Raw Base as to any Combination: a Raw Base priced below it leaves the ordering, and is not ranked at its price (AD-17).
- The view renders a Raw Base distinguishably from a crafted Base Type, and colour alone does not carry the distinction (NFR-10).
- A Raw Base is priced as a white base at item level 82 (AD-5, AD-16). `[ASSUMPTION: 82 is the effective item level cap for these bases, so a floor of 82 and "exactly 82" are the same filter. If bases above 82 exist, this needs a ceiling, not a floor.]`

#### FR-4: Surface Unrankable Base Types outside the ordering

Base Types that `core` cannot rank honestly appear in a separate group with the reason. They are neither dropped silently nor ranked anyway.

**Consequences (testable):**
- A Base Type whose Eligible Pool for either slot is not `complete`, or which is absent from the Weights File, is Unrankable on its crafted branch and leaves the ordering. `core` never substitutes an invented pool (AD-17).
- Unrankability governs the crafted branch only. A Raw Base needs no Eligible Pool and ranks regardless, so one Base Type can show an Unrankable crafted branch beside a ranking raw branch, each labelled for what it is (AD-17, AD-11).
- The view shows a reason per Unrankable Base Type, using the strings `"pool partial"` and `"base absent from weights file"` verbatim *(PRD-owned)*.
- The count of Unrankable Base Types is visible without expanding the group *(PRD-owned)*.
- A probability derived from a `partial` pool renders as unknown, not as a number, because it carries Provenance `absent` (AD-17, AD-10, FR-10).
- Coverage — the share of Base Types that need a pool and have a complete one — is measured before any view work, re-measured on every Weights File regeneration, and published in the Sync Report with its denominator (AD-27; predicates in `IMPLEMENTATION-NOTES.md` §3).
- Measured coverage binds the layout in three disjoint bands *(PRD-owned)*:

| Measured coverage | What this FR requires |
| --- | --- |
| **≥ 80%** | The Unrankable group is a footer to the ranked list. |
| **≥ 50% and < 80%** | The group is a first-class surface beside the ranking. A reader must not take the ranked list for the whole product; the treatment is UX's (`EXPERIENCE.md`). |
| **< 50%** | The ranking premise fails. Escalate rather than ship around it. Neither `core` nor the view resolves this case. |

- The bands are advisory below ~20 rankable Base Types, which is why the view shows the denominator beside the fraction *(PRD-owned)*. `[ASSUMPTION: no source names a minimum denominator. ~20 is the size below which a fraction such as three-of-four stops saying anything about the product.]`

#### FR-5: Bound the ranked list to a readable length

The list answers a question rather than presenting an inventory.

**Consequences (testable):**
- The ranked list shows the top 20 Base Types by default; the remainder sits behind an explicit expand *(PRD-owned)*. `[ASSUMPTION: no source names a count. 20 is roughly a screen and comfortably exceeds the "top five" the player acts on.]`
- The bound is a display concern only. `core` ranks the full Tracked List and the view truncates, so the Payout Threshold still reorders across everything (AD-4).

**Feature-specific NFRs:**
- Ranking the full Tracked List completes in under 100 ms on a mid-range machine and re-runs synchronously on a threshold change (AD-24).

### 4.2 The Payout Threshold Control

**Description.** The Payout Threshold sets what counts as a win. It is a control rather than a constant: about a quarter of a Divine in early endgame, a Divine or more once the player is richer, and rising through a league. An outcome below it is worth nothing to him, because that much currency turns up simply by playing. Realises UJ-2.

**Functional Requirements:**

#### FR-6: Set the Payout Threshold and see the list reorder immediately

The player types a Payout Threshold in Divine and the ranked list reorders in front of him, with no round trip. Realises UJ-2.

**Consequences (testable):**
- The control is denominated in Divine, the same unit as every price and every Craft Cost it filters (AD-17, AD-20).
- The control is a number input, not a slider, and the list re-ranks on every valid parse of the input rather than on commit *(PRD-owned; treatment in `EXPERIENCE.md`)*.
- A change re-runs the ranking synchronously against the artifacts already loaded; no network request, no sync (AD-24).
- A change also changes which Chase Combinations a collapsed row shows (FR-2, AD-17).
- A Raw Base is subject to the threshold exactly as a crafted Combination is (FR-3, AD-17).

#### FR-7: Remember the Payout Threshold between visits

The Payout Threshold survives a page reload. No other view state is promised persistence. Realises UJ-2.

**Consequences (testable):**
- The value persists only in the viewer's own browser storage: no backend, no account, no authenticated request (AD-15).
- A first visit, with nothing stored, starts at **0.25 Divine** *(PRD-owned)*. `[ASSUMPTION: 0.25 Divine, the brief's early-endgame figure, is the least-surprising cold start.]`
- Open panels, toggles, the grown list and banner dismissal may reset on reload; whether any of them survives is UX's decision (`EXPERIENCE.md`).
- Clearing browser storage returns the control to the default and changes nothing else on the page.

### 4.3 Combination Detail and Segregated Unknowns

**Description.** The player expands a Base Type and sees every Tracked Entry on it, priced and unpriced alike: what the ranking is built from, and what it deliberately excludes. A Combination with no listings is either a jackpot or junk, and listings cannot tell which, so the unknowns stay out of the ranking without being called worthless. Realises UJ-3, UJ-5.

**Functional Requirements:**

#### FR-8: Expand a Base Type to its full tracked Combination list

The player expands any ranked Base Type and sees all of its Tracked Entries with their prices, Price States and ages. Realises UJ-3. Realises UJ-5.

**Consequences (testable):**
- Every Tracked Entry on the Base Type appears, whether or not it cleared the Payout Threshold (AD-17; treatment `EXPERIENCE.md`).
- `pruned` tombstones are included, set apart from live entries and each showing its prune reason, so UJ-5's review needs no open of the file (AD-12; treatment `EXPERIENCE.md`).
- Each row shows its Combination, its Price State, its price in Divine where priced, the listing count the estimate rested on, and its age, labelled as an observation age or a last-attempted age (AD-9, AD-16, FR-12).
- Each entry below the Payout Threshold is visibly marked as contributing nothing to the EV; it is shown, never hidden (AD-17; treatment `EXPERIENCE.md`).

#### FR-9: Render the four Price States distinctly, with a reason on `not-yet-synced`

The four Price States are four different things on screen, and the view never collapses one into another. Realises UJ-3, UJ-5.

**Consequences (testable):**
- No Price State renders as `0`, as blank, or as a dash that reads as worthless (AD-9).
- `no-listings` is presented as an open question, never as an answer that the Combination is junk (AD-9).
- `unresolvable` entries are shown, not merely omitted; their presence is the symptom of a game patch (AD-9).
- `not-yet-synced` carries a reason, displayed and not merely stored, exactly one of `never-synced`, `league-mismatch` (FR-31) or `no-exchange-rate` (FR-23) *(PRD-owned)*. AD-9, AD-19 and AD-20 supply the three causes; the enum and its display are this PRD's, because one state covering three unrelated causes would defeat the point of distinguishing states.
- The distinction is never carried by colour alone (NFR-10).

### 4.4 Provenance and Freshness Surfacing

**Description.** Every price is an asking price, and the system never observes a sale. A probability rests on whatever the Weights File's producer could source, which is expected to be uneven. A view that renders a placeholder identically to a well-founded figure keeps the player's trust months after it stopped deserving it; this feature exists to prevent that. Realises UJ-4.

**Functional Requirements:**

#### FR-10: Propagate and display the weakest Provenance behind every figure

Every displayed derived figure states what it rests on. Realises UJ-4.

**Consequences (testable):**
- Each derived figure carries the weakest Provenance and the oldest timestamp of every input, with no exception; the three-value order is §3 *Provenance*'s (AD-10).
- Provenance is derived from the Weights File's own per-tier source marker and from nothing else, and the view never prints that marker's words on screen (AD-10).
- A probability's inputs are pool-wide, so one invented tier anywhere in a scoped pool makes every probability on that Base Type read `uniform-prior`. That is the consequence FR-11 turns on, and it is deliberate (AD-10).
- Two render treatments, not three: a `measured` figure is plain, and a figure resting on anything weaker is visibly degraded, with `absent` rendered as an unknown rather than a number (AD-10, AD-17; treatment `EXPERIENCE.md`). Colour alone carries neither (NFR-10).
- The view shows the Weights File's declared producer, generation time and game patch beside any figure they influenced, so a file left behind by a patch is visible as such (AD-11).
- The exchange observation that normalised a price participates in Provenance like any other input (AD-20).

#### FR-11: State the uniform-prior caveat globally when the per-row badge discriminates nothing

A Provenance badge identical on every row conveys nothing, and the view must not pretend otherwise. Realises UJ-4.

**Consequences (testable):**
- The condition is read from the loaded data, never assumed of v1 (FR-30, AD-10).
- While no probability in the loaded set carries `measured`, the view shows a persistent banner, dismissible per session, stating that the ranking rests on a uniform prior and that ordering between Base Types is not evidence-backed *(PRD-owned; treatment `EXPERIENCE.md`)*.
- The banner lowers itself once any `measured` figure is present; it is never a build constant.
- The per-row badge is required regardless (FR-10). It discriminates between Base Types, never within one (AD-10).
- A `uniform-prior` badge means something in this pool was invented; it does not mean the pool is invented throughout (AD-10).
- Where the badge cannot yet discriminate, freshness (FR-12) gets the visual weight (`EXPERIENCE.md`). `[ASSUMPTION: a per-Base-Type Provenance badge is enough for the player to judge trust by; no mixed-Provenance indicator is required for v1.]`

#### FR-12: Show per-row freshness, and say which clock it is reading

Each row carries its own age, and an unpriced row's age is as meaningful as a priced row's. Realises UJ-4.

**Consequences (testable):**
- A single dataset-level timestamp is never the only freshness signal; rows refresh at different times (AD-7, AD-10).
- The age is the observation's where one exists, the last attempt's otherwise (AD-9, AD-10).
- The view always says which of the two ages it shows: *this price is three days old* and *nothing has been found here for three days* are different facts, never one unlabelled "3d" (AD-9).
- In the expansion every entry carries its age with the clock labelled. On the collapsed row, a row younger than the freshness cut-off shows no age, and a row at or beyond it carries a stale mark with a word (AD-10; treatment `EXPERIENCE.md`). The cut-off is **48 hours** *(PRD-owned)*; that a cut-off exists, and which clock it reads, is AD-10's.
- A never-synced row renders as *never attempted*, never as an age, a blank or a placeholder (AD-9); it is FR-9's `never-synced` reason.
- A partially refreshed Dataset renders normally; per-row freshness makes that honest (AD-19).

#### FR-13: Present estimates as asking prices, never as realised value

The view's language never implies that a player achieved a price. Realises UJ-4.

**Consequences (testable):**
- The view labels prices as current asking prices from live instant-buyout listings (AD-12, AD-16).
- No copy describes an estimate as "sells for", as "worth", or with any phrasing that implies an observed sale (`EXPERIENCE.md`).
- This rule is the *only* mitigation in the system for Risk R-1 (§9). The player's manual loop had a real-sale correction, and the tool discards it; a copywriting rule does not replace it *(PRD-owned)*.

### 4.5 The Curated Tracked List

**Description.** The Tracked List is two things at once: what the tool watches, and the tool's entire request budget. Curation discipline is therefore a permanent operating requirement. The Tracked List is a hand-owned, committed file that the browser never writes (AD-15, AD-3). The tool cannot discover a Combination nobody told it to watch; v1 records that limitation. Realises UJ-5.

**Functional Requirements:**

#### FR-14: Bound every request to one of four declared sources

Exactly four declared sources may generate a trade API request, and nothing else does; the Tracked List is one of them, which is why it is also the request budget (AD-12).

**Consequences (testable):**
- The Sync Report records requests consumed per source, so budget drift is attributable to a cause (AD-12, FR-25).
- A run validates its premise before spending budget; a failure that invalidates the run aborts it and is visible in the Sync Report rather than only in an exit code (AD-12, FR-25).
- Adding a fifth source is an architecture amendment, never an implementation detail (AD-12).

#### FR-15: Honour Curation Status as schema-level behaviour

`active`, `pinned` and `pruned` are schema members with defined effects, not conventions (AD-12). Realises UJ-5.

**Consequences (testable):**
- A `pinned` entry is selected first in every Chunk and never waits its turn behind `active` entries. The number of `pinned` entries is capped, and a Chunk that cannot fund the pinned set plus at least one `active` entry truncates the pinned set and records that in the Sync Report (AD-7; `IMPLEMENTATION-NOTES.md` §6; FR-25).
- A `pruned` entry leaves both the sync workload and the ranking sum; its last-good price never contributes (AD-12, AD-17).
- A `pruned` entry carries its reason, and the view shows that reason, so a curator does not re-add a dead Combination and relearn the same lesson each league *(PRD-owned)* (FR-8).

#### FR-16: Reject an overlapping Tracked List at load

*Architecture-owned.* Tracked Entries for one Base Type must describe mutually exclusive outcomes, because the ranking sums over a partition rather than a list. An overlapping Tracked List is refused when it is loaded and never reconciled at ranking time (AD-17).

**Consequences (testable):**
- A predicate defines overlap, not an enumerated list of shapes; the predicate, its branch order and its consequences are binding in `IMPLEMENTATION-NOTES.md` §2.1 (AD-17).
- The rejection names both offending entries and the slot on which they overlap (`IMPLEMENTATION-NOTES.md` §2.1).
- A curator cannot track two Stat Lines of one Source Modifier as two entries in one slot: the two always roll together, so one item would be counted twice (AD-17; `IMPLEMENTATION-NOTES.md` §2.2). Pricing that conjunction as one outcome is deferred (§7.2).
- Where the Weights File cannot answer the co-occurrence question, the Tracked List still loads; the affected Base Type is already Unrankable (AD-17, FR-4).
- The crafted entries on one Base Type share one Item Level Floor; a Raw Base is exempt (AD-17, FR-22).
- The check runs in the view at load and in `sync` as a run-start gate (AD-17, AD-12).

#### FR-17: Refresh the Tracked List in a defined, deterministic rotation

*Architecture-owned.* The player asks *how often does a row get re-priced?* of every figure on screen, so the Refresh Rotation is a requirement rather than an incidental scheduling choice; its order is AD-7's. Realises UJ-5.

**Consequences (testable):**
- Every Chunk selects entries in one deterministic order, and a `pruned` entry is never selected (AD-7, FR-15, FR-23).
- Two runs from the same files and the same clock select the same entries in the same order, so a dry run predicts a live run (AD-7).
- A never-synced entry counts as the oldest of all, so it is reached before any entry that has been attempted (AD-7).
- An `unresolvable` entry neither disappears from the rotation nor monopolises it, and the moment its id resolves again it rejoins the ordinary rotation (AD-7, FR-24).
- A full pass takes many Chunks; the Sync Report states how many due entries this Chunk did not reach (AD-7, FR-25).

#### FR-18: Surface the Tracked List's age

The player can see how long it has been since anyone last edited the Tracked List. Realises UJ-5.

**Consequences (testable):**
- The Sync Report records the date of the last tracked-list edit, and the view shows it unconditionally, so a list running unattended for months is visible as such (AD-12).
- The date comes from the file's commit history, never from a field a curator must remember to update; an uncommitted edit does not move it (AD-12).
- A Tracked List with no commit history shows *unknown*, never a placeholder date (AD-12, AD-9).

**Notes:** The tool cannot show a Combination nobody told it to watch (Risk R-2, §9). FR-18 prompts a periodic deliberate review; it does not close the gap.

### 4.6 Background Price Sync

**Description.** A CLI does one bounded Chunk of work and exits; the player's own scheduler starts it again. No figure the player sees is computed on a user-facing path, so a slow full refresh is acceptable. This section fixes what a price *is*, because every downstream number inherits the estimate method (AD-16).

**Functional Requirements:**

#### FR-19: Run as a bounded, resumable, single-instance Chunk runner

*Architecture-owned.* The sync process is a CLI that performs one Chunk and exits; the player's own scheduler invokes it repeatedly (AD-7; `IMPLEMENTATION-NOTES.md` §6, §7).

**Consequences (testable):**
- A second invocation while a live run holds the lock exits quietly, and a lock left by a crashed run is recovered and reported rather than wedging the product (AD-7; `IMPLEMENTATION-NOTES.md` §7).
- An unattended run that fails is visible in the Sync Report rather than only in an exit code (AD-7, FR-25).

#### FR-20: Route all outbound trade traffic through one rate-limit-adaptive client

*Architecture-owned.* Exactly one adapter issues trade API requests, and it paces itself from the live rate-limit headers so the tool is never throttled or banned (AD-8; `IMPLEMENTATION-NOTES.md` §5.3).

**Consequences (testable):**
- The tool's traffic is paced so that access is never lost; losing it ends the product (R-7).
- No component but the governed client issues a trade request (AD-8, AD-25).
- Exactly one governed client is the mechanism, and it is AD-8's (AD-8, NFR-9; `IMPLEMENTATION-NOTES.md` §5.3).

#### FR-21: Estimate a price from the cheapest live instant-buyout listings

*Architecture-owned.* For each Tracked Entry, one search and one fetch produce one Price Observation: the median of the cheapest live instant-buyout listings matching that entry, in Divine (AD-16; `IMPLEMENTATION-NOTES.md` §4.3).

**Consequences (testable):**
- The search is built from the tracked entry alone (AD-16; `IMPLEMENTATION-NOTES.md` §5.2).
- Fewer than the full sample is valid and the true count is recorded; zero listings is `no-listings`, never a price (AD-16, AD-9).
- Every Price Observation carries when it was taken, which league it was taken in, and the exchange observation used (AD-19, AD-20).
- Whenever the trade site answers a search, the entry records that search's identifier so the view can offer a link to it. The identifier lives on the entry, not the observation, so a `no-listings` row can link as readily as a `priced` one (AD-9, AD-16, AD-24, FR-33).
- Because a curated band may span adjacent tiers, the priced population is deliberately wider than the weighted one; how far that can move the ordering is open as OQ-21 (AD-16, AD-11).

#### FR-22: Declare each entry's Item Level Floor from its Accepted Tier

Each Tracked Entry declares the item level its search filters on. A stated curation rule gives that level, not a global constant, and the curator writes it by hand *(PRD-owned)* (AD-5).

**Consequences (testable):**
- The Accepted Tier of a modifier is tier 1, except where tier 1 first appears at item level 81 or 82 and is too rare to chase; the curator then accepts tier 2 *(PRD-owned)*.
- A crafted entry's candidate floor is the highest item level among its affixes' Accepted Tiers. A Base Type's floor is the highest candidate across its crafted entries, and every crafted entry on that Base Type declares that floor *(PRD-owned)*. The tool enforces the shared floor at load; a Raw Base, pinned at item level 82, is exempt (AD-17, FR-16, FR-3).
- Choosing the Accepted Tier and writing the Modifier Reference's band are one act: the curator writes the tier's own value range, or the range of a run of whole adjacent tiers, and never a band that contains one tier and clips another (AD-5, AD-17).
- Spanning a tier boundary is legitimate but carries a warning: the span is priced at its cheap end while carrying both tiers' mass, and below the Payout Threshold it can zero a jackpot rather than understate it (AD-17).
- The Accepted Tier is also a hand-written, display-only label beside the band, so a ranked row reads as tiers rather than value spreads. Nothing derives or validates it, and a missing label still loads and ranks, with a visibly marked fallback (AD-5).
- The floor scopes the Eligible Pool, so it is a valuation input and not only a search parameter; one tracked reference still costs one search whatever tier or run it names (AD-17, AD-12).

#### FR-23: Normalise every price to Divine at the sync boundary

Raw listing currency never enters valuation; every price the player sees is a Divine figure (AD-20).

**Consequences (testable):**
- `sync` normalises each listing to Divine once, at the sync boundary, and records the exchange observation used (AD-20; `IMPLEMENTATION-NOTES.md` §4.2).
- A listing whose currency has no current rate is written as `not-yet-synced` with reason `no-exchange-rate` *(PRD-owned)*, never stored unnormalised (AD-20, FR-9).
- Currency rates are refreshed before any priced entry in the same Chunk (AD-7, AD-20).

#### FR-24: Fail loudly on an unresolvable stat id or Base Type

`sync` never silently skips a Tracked Entry whose stat id or Base Type the trade API no longer exposes (AD-9).

**Consequences (testable):**
- Such an entry's Price State becomes `unresolvable` and the Sync Report records it. The entry is never skipped, defaulted or left at its previous value, so a patched-out modifier cannot keep ranking on its last-good price (AD-9).
- Detection is validation against the committed Trade Catalogue before any request is issued, never inference from results; an empty result set is `no-listings`, never `unresolvable` (AD-9, AD-25).
- An unresolved id in the Weights File is reported only; `sync` reads that file and never rewrites it (AD-9, AD-3).
- The Trade Catalogue is refreshed by an explicit command at patch cadence, never by a sync run; its diff is how a renamed id becomes visible (AD-25).
- The ranking excludes `unresolvable` entries and the view surfaces their existence (AD-9, FR-9).
- Whether a row can offer a trade link depends on whether a search identifier is present, never on Price State (AD-24, FR-21).

#### FR-25: Publish a structured Sync Report

Every run's outcome is data the view reads, not console output (Consistency Conventions, *Logging*).

**Consequences (testable):**
- The Sync Report records requests consumed per declared source, unresolvable entries, the date of the last tracked-list edit, the measured pool-coverage fraction with its denominator, and any run-start gate failure (AD-12, AD-9, AD-27, AD-17).
- It records the number of due entries not reached in this Chunk, so a partially refreshed Dataset is distinguishable from a stalled one *(PRD-owned; acknowledged in AD-7)*. *Not reached* is a normal rotation outcome, never a skip (AD-7, AD-9).
- Where a Chunk could not fund the pinned set plus at least one `active` entry, it carries a pinned-starvation record that makes the shortfall diagnosable — the declared yardstick beside the allowance observed (`IMPLEMENTATION-NOTES.md` §6). Starvation is a curation defect the player must correct; *not reached* is not *(PRD-owned)*.
- The view surfaces the starvation record's presence alongside the tracked-list age and the unresolvable count — the three figures that tell a player the list is not doing what he thinks *(PRD-owned)* (AD-7, FR-18, FR-24).
- `sync` commits only the files it owns, so an in-progress curation edit neither rides in nor blocks an automated commit (AD-3).

### 4.7 Craft Cost

**Description.** Craft Cost is the term that makes the ranking account for failures: the player pays it on every attempt, and most attempts produce nothing worth selling. Currency prices move during a league, so Craft Cost is computed from synced rates and never configured as a constant. Realises UJ-1.

**Functional Requirements:**

#### FR-26: Compute Craft Cost in valuation, from synced rates

`core` derives Craft Cost from synced exchange rates; `sync` never computes or stores one. Realises UJ-1.

**Consequences (testable):**
- A Craft Recipe is a currency composition the player declares by hand, and adding one is a data edit that needs no code change (AD-3).
- v1 ships exactly **one** Craft Recipe: one perfect transmute plus one perfect augment *(PRD-owned)*. `[ASSUMPTION: larger currency quantities and partial-craft abandonment are not modelled.]`
- A recipe whose currency has no current rate for the active league is reported as uncostable, never costed at zero (AD-20).
- In v1 a Craft Recipe contributes only a cost offset: the ordering does not change with the recipe, and an implementer must not invent a distribution (AD-17).
- Craft Cost is shown in Divine, the unit of every price and the Payout Threshold (AD-20).

### 4.8 Weights File Consumption

**Description.** Probabilities depend on how likely each modifier is to roll. PoE2 does not publish that likelihood and this app never produces it; it consumes a Weights File from any producer that satisfies `WEIGHTS-FILE-SCHEMA.md`. The trade API exposes none of what the file carries, so the Weights File is a prerequisite, not an enrichment (§7.3, AD-11, AD-25).

**Functional Requirements:**

#### FR-27: Consume a schema-conformant Weights File and never produce one

*Architecture-owned.* `core` reads Modifier Weights from a file conforming to `WEIGHTS-FILE-SCHEMA.md`, normalises them itself, and never writes such a file (AD-11).

**Consequences (testable):**
- A file that trips any hard error in `WEIGHTS-FILE-SCHEMA.md` *Validation* — an unknown schema major among them — is refused with the failure named, never loaded in part.
- A file at the version `WEIGHTS-FILE-SCHEMA.md` currently declares loads, whichever producer wrote it (AD-11).
- No component of this app writes, patches or regenerates a Weights File (AD-11).

#### FR-28: Enforce the pool-completeness contract in both directions

A producer's completeness claim and the consumer's treatment of it are two halves of one rule; either half alone yields a ranking that is wrong without warning.

**Consequences (testable):**
- A pool declared `complete` enumerates every tier of every modifier that can roll in that slot at any item level, and every Stat Line of each tier. A producer that cannot guarantee that declares `partial`; there is no third option (`WEIGHTS-FILE-SCHEMA.md` *The pool-completeness rule*).
- An unresolved Stat Line is data, not a defect, and never makes a pool `partial` (AD-11, `WEIGHTS-FILE-SCHEMA.md`).
- A `partial` pool makes the Base Type Unrankable, and every probability from it carries Provenance `absent`; this is the only path to `absent` (AD-17, AD-10, FR-4).
- No mechanical check stands behind a dropped tier or a dropped Stat Line. The ranking rests on the producer's `poolCoverage` assertion, and this PRD states that trust rather than implies it (AD-11).

#### FR-29: Derive probabilities from the Weights File scoped to the entry's floor

*Architecture-owned.* Every probability in a ranking comes from the consumed Weights File, scoped to the Tracked Entry's Item Level Floor, by one derivation two implementers cannot diverge on (AD-17; `IMPLEMENTATION-NOTES.md` §1).

**Consequences (testable):**
- A tier only partly covered by a curated band contributes nothing to the probability, and that is not an error (AD-11, AD-17; `IMPLEMENTATION-NOTES.md` §1).
- A Tracked Entry a Weights File cannot support is reported at load with the offending entry named, rather than ranked on a guess (AD-17; `IMPLEMENTATION-NOTES.md` §2.4, §2.5).
- The view reports such a failure at load and still renders the unaffected Base Types; a sync run treats the same check as a run-start gate and aborts before spending budget (AD-17, AD-12).
- Whole-tier containment understates probabilities unevenly and can reorder the list. How far is unmeasured and owned by OQ-21 (AD-11). `[ASSUMPTION: the understatement stays acceptable in practice for v1 — an operating bet, not a bound; OQ-21 is the measurement that would settle it.]`
- Prefix and suffix are independent draws, and an absent affix is certain (AD-17).

#### FR-30: Depend on an externally produced Weights File as a v1 prerequisite

v1 ranks against a real file that satisfies the real contract, produced by the external scraper project. There is no fallback.

**Consequences (testable):**
- Until a conforming Weights File exists, every crafted Base Type is Unrankable and Raw Bases still rank. What the player sees is a white-base price list, and the view names the absence (AD-11, AD-17, AD-24).
- The dependency is accepted rather than worked around: nothing in this system can source pool membership or item-level availability, and `core` must not invent a pool *(PRD-owned)* (AD-11, AD-25).
- A uniform-prior file is a legal weighting placeholder but never a sourcing one. Every figure it influences carries Provenance `uniform-prior`, and FR-11's caveat applies while any such entry remains (AD-11, AD-10).
- The probability code path runs from day one; the ranking formula does not change shape when measured weights arrive *(PRD-owned)*.
- Where the producer cannot guarantee completeness it declares `partial`, and the resulting coverage is measured before view work (FR-28, FR-4, AD-27).

### 4.9 League Lifecycle

**Description.** Three or four league resets a year wipe prices entirely, and the tool is least useful at league start, when the knowledge is worth most. The requirement is not to survive a reset gracefully but to fail *honestly*: an empty ranking is correct, and last league's numbers served as current are not. Realises UJ-6.

**Functional Requirements:**

#### FR-31: Refuse to value an observation from a different league

The ranking treats a Price Observation from any league but the active one as absent rather than as stale-but-usable (AD-19). Realises UJ-6.

**Consequences (testable):**
- The player sets the active league in a committed config file, and the edit is the whole act (AD-19).
- Every Price Observation and every currency rate records the league it was taken in (AD-19, AD-20).
- An observation from another league is valued as `not-yet-synced` with reason `league-mismatch` *(PRD-owned)* (AD-19, FR-9).
- A league change is a config edit plus a natural re-sync: the ranking is honestly empty until data arrives, and refills without anyone rewriting or purging the Dataset (AD-19).
- League filtering happens once, at ranking time; `sync` does not filter the Dataset on write, so the site is not blanked while a re-sync runs (AD-19).

#### FR-32: Validate the configured league against the live leagues endpoint

*Architecture-owned.* `sync` checks that the configured league is real before spending any budget against it (AD-19). Realises UJ-6.

**Consequences (testable):**
- The check runs once per run and costs one request (AD-12).
- On a mismatch the run aborts, records the failure in the Sync Report and releases its lock, so a mistyped league name is visible on the surface the player already reads rather than wedging syncing (AD-12, AD-7).
- The player-visible consequence is FR-31's: the tool fails loudly and ranks honestly-empty rather than valuing against the wrong league.

### 4.10 Dataset Delivery

**Description.** How data reaches the view looks like an implementation detail and is not one. The delivery method decides whether a sync commit refreshes the site on its own or needs an application rebuild, and so whether the daily refresh is a background fact or a chore. Realises UJ-1, UJ-6.

**Functional Requirements:**

#### FR-33: Load published artifacts at runtime as one consistent set

`web` reads its data at runtime, never at build time, so a sync commit updates the site without a rebuild. Realises UJ-1.

**Consequences (testable):**
- The view loads one consistent published set and never mixes artifacts across a refresh; a partial set is never rendered (AD-24; treatment `EXPERIENCE.md`).
- An invalid artifact is refused loudly: the page names it and serves nothing stale (AD-3, AD-24; treatment `EXPERIENCE.md`).
- An absent artifact is not an invalid one. Where the set can still render without it, the page renders and names the absence on screen, never presenting a diminished list as whole; where it cannot, it says which file did not arrive (AD-24).
- A cross-file policy failure between individually valid artifacts is reported at load and the page still renders, the affected crafted branch shown as Unrankable with that reason (AD-17).
- Stat and currency text comes from the committed Trade Catalogue; the page makes no runtime call to the trade site (AD-15, AD-25).
- A Tracked Entry offers a trade-site link only when its stored search is valid for the active league, never on a `pruned` tombstone, never keyed on Price State. The link is the player's own act, in a new tab; URL form `IMPLEMENTATION-NOTES.md` §5.4 (AD-15, AD-24).


## 5. Cross-Cutting NFRs

- **NFR-1 — Zero network in the test path.** No test at any level makes a real network call, and an unfixtured request fails loudly (AD-13). This is the hardest requirement in the brief: it lets an agent iterate against a service that would otherwise rate-limit it into uselessness, and it makes a red test mean "the code is wrong" rather than "GGG was slow."
- **NFR-2 — Fixtures are real captured responses.** A fixture is a committed real payload, never a hand-written mock. Re-recording is a separate, human-invoked command, never part of a test run, and its diff is what makes GGG's changes visible (AD-13).
- **NFR-3 — Determinism.** Valuation is pure; time, randomness and configuration enter only as passed-in values, and no test depends on wall-clock timing (AD-1).
- **NFR-4 — Parallel worktree development.** Packages own disjoint directories with a one-way dependency graph that CI enforces, so two agents in two packages touch no common file (AD-1). The working rules for contracts changes, live sync and dry runs are `AGENT-WORKFLOW.md`'s.
- **NFR-5 — One writer per file.** Every shared file has exactly one writer; an agent that needs different data uses a fixture, never an edit (AD-3).
- **NFR-6 — Read-time budget.** A full ranking pass completes in under 100 ms on a mid-range machine and re-runs synchronously on a threshold change; the remedy for a miss is memoisation, never precomputation (AD-4, AD-24).
- **NFR-7 — Static delivery, zero upkeep.** The view is a static bundle that CI deploys: no server, no secret material, no expiring credential (AD-15).
- **NFR-8 — Schema versioning at every trust boundary.** Every published artifact and input file carries a schema version, a consumer refuses an unknown major rather than guessing, and a producer validates before it writes (AD-3, Consistency Conventions).
- **NFR-9 — Third-party citizenship.** Requests identify the tool and a contact address, pace from live rate-limit headers and honour `Retry-After` (AD-8). Keeping API access is a standing requirement, because the product depends on it entirely (R-7) *(PRD-owned)*.
- **NFR-10 — Accessibility floor.** Colour alone never carries a product-meaningful distinction: Price State (FR-9), crafted versus Raw Base (FR-3) and Provenance (FR-10). AD-24 requires this for Provenance; this PRD extends it to the other two *(PRD-owned)*. `[ASSUMPTION: the extension beyond AD-24's literal scope is this PRD's, not the spine's.]`

## 6. Non-Goals (Explicit)

- **Producing modifier weight data.** The scraper is a separate project; this app consumes a file and is indifferent to its producer (AD-11). The file is a release dependency, not an optional input (§7.3).
- **Advising whether to augment an item already in hand.** Excluded by design; the strongest v2 candidate if the pickup list proves its value.
- **Loot filter export in v1.** PoE2's filter syntax cannot express modifier Combinations, so a generated filter could automate only the base-name half of the knowledge. The web view is the permanent product, not a step toward another one.
- **Rare items.** Magic only: at most one prefix and one suffix.
- **Accounts, sharing, per-user preferences, anything multi-user.** Any requirement that appears to need a backend is escalated, not implemented (AD-15).
- **Visual design beyond an off-the-shelf framework.** Appearance is explicitly not a priority *(PRD-owned)*.
- **Price history features.** Git carries the history; no v1 feature reads it (AD-19). UJ-5's "no listings all league" judgment is the player's own recollection plus the current Price State.
- **Market scanning as candidate generation.** Rejected on shallowness and cost; see the brief's addendum.
- **Sell-through speed as a ranking term.** The player was explicit that sell speed is not a factor *(PRD-owned)*.
- **Ranking on variance, median outcome, or an exposed risk preference.** At ~144 crafting decisions an hour, mean-based math is sound *(PRD-owned)*.
- **Discovering Combinations the player did not think to track.** Recorded as Risk R-2 and not addressed.

## 7. MVP Scope

### 7.1 In Scope

- Magic Base Types — one prefix, one suffix — at per-entry Item Level Floors derived by the Accepted Tier rule (FR-22).
- Raw Bases at item level 82, threshold-truncated like any other outcome.
- Ranked Base Type list, bounded for readability, with chase Combinations, expandable to the full tracked Combination list including tombstones.
- Player-set Payout Threshold, re-ranking at read time.
- Background sync: unauthenticated, rate-limit adaptive, bounded, resumable, with a defined Refresh Rotation.
- Four-state pricing with reasons on `not-yet-synced`, and unknowns segregated from the ranking.
- Provenance and per-row freshness throughout, plus the global uniform-prior caveat.
- Curation through hand-edited committed files, surfaced read-only in the view with tracked-list age.
- One Craft Recipe with cost computed from synced rates.
- A defined Weights File **schema**, with its pool-completeness contract enforced in both directions. The **file** itself is an external deliverable, and is not in scope here (§7.3).
- Divine normalisation at the sync boundary, with exchange observations carried in Provenance.
- League-scoped observations with an honest empty state across a reset.

### 7.2 Out of Scope for MVP

The spine's *Deferred* section is the register of technical deferrals and their revisit triggers, and this document does not duplicate it. The items below are product-scope calls, or technical deferrals with a product consequence the player will feel.

- **A second Craft Recipe.** Ordering is recipe-invariant in v1 (AD-17), so a second recipe would add a cost column and no ordering information. Revisit when distribution mechanics exist (§10 OQ-5).
- **Producing Modifier Weights.** v1 ranks on whatever the scraper project delivers, gated by FR-4's coverage measurement. The ranking improves as the file improves and the app does not change.
- **Coarser fallback pricing for zero-listing Combinations** — a "base plus this prefix, any suffix" estimate, marked as such. Held as the named option if the unknown bucket proves unusable. `[NOTE FOR PM]` The likeliest thing to be missed if `no-listings` is a large fraction of the Tracked List; check after the first full refresh (§10 OQ-6).
- **Spawn-weight disambiguation of the unknown bucket** — using modifier rarity to separate "rare and unlisted" from "common and unlisted". The only identified route that *resolves* a `no-listings` entry rather than segregating it; contingent on measured weights *(PRD-owned)*.
- **Re-seeding the Tracked List from community sources.** The most promising answer to Risk R-2 and the single largest gap v1 leaves open.
- **Pricing a deliberate conjunction of co-occurring stats.** A curator cannot yet express "both Stat Lines of this hybrid modifier" as one priced outcome, and FR-16 rejects the two-entry spelling. Deferred in the spine; recorded here because a curator will plausibly try it and the rejection is not a defect.
- **Measuring how far whole-tier containment understates the ranking.** Open as §10 OQ-21, owned by the spine. Until it is answered, the ordering is trusted on an operating bet (§11), and the deferred pro-rating and dropped-line guards in the spine's *Deferred* section are only as safe as that answer.
- **Authenticated sync, a hosted syncer, observability beyond the Sync Report, a repository split for the schema.** Spine-owned deferrals with stated revisit triggers; none changes what the player sees.

### 7.3 Release Dependencies

One dependency sits outside this repository and gates the release rather than enriching it.

- **The Weights File, from the external scraper project (FR-30).** It supplies pool membership, tier value ranges, item-level availability and weights, none of which the trade API exposes (AD-11, AD-25). Until a conforming file exists every **crafted** Base Type is Unrankable and what remains is a Raw Base price list, not the product (FR-4). The dependency is accepted rather than worked around: a locally generated file cannot honestly source the fields that matter. The version a file must satisfy is whatever `WEIGHTS-FILE-SCHEMA.md` currently declares; that file, not this one, is where the producer reads it.
- **Its first gate is a measurement.** Pool coverage across the Tracked List is measured before any view work and re-measured on every regeneration, and the result binds a layout decision (FR-4, AD-27). A file that arrives is not the same as a file that covers enough.
- **Its second gate is a set of open questions owned with the producer.** §10 OQ-12 and OQ-19 are facts about the trade API and the source data that the producer must verify before its file's edges mean what `sync` thinks they mean. Both block correctness, not building.
- **It recurs on GGG patch cadence**, alongside the Trade Catalogue refresh (FR-24). Neither is on the Chunk path; a stale file degrades Provenance or display text and surfaces as a reviewable diff rather than a break. **`partial` pools are a recurring state, not a transitional one**: a patch can make freshly scraped classes Unrankable until the source catches up. That is the accepted cost of declining an anonymous-weight escape hatch, and why coverage is re-measured and published rather than measured once (FR-4, FR-25).

## 8. Success Metrics

Behavioural, not numeric. There is one user, and instrumenting the tool would be more work than the signal is worth. Each metric is therefore observed by the player's own recollection — the only instrument available.

**Primary**
- **SM-1: The trade site stays closed mid-session.** The player stops opening the trade site to price-check while mapping. Validates FR-1, FR-2, FR-8.
- **SM-2: The mental top-five goes away.** The player stops keeping a list of chase bases in his head. Validates FR-1, FR-6.
- **SM-3: A league start costs days, not weeks.** The list is useful within days of a reset rather than after weeks of relearning. Validates FR-31, FR-32.
- **SM-4: The list holds up against reality.** Chase decisions made from the list match what actually sells. The player judges this by noticing that his sales agree with the list, because the tool observes no sale (Risk R-1). Validates FR-21, FR-1.
- **SM-4a: The ordering beats the naive one.** Once a season, the player compares the top five by EV against the top five by raw price. If the two lists agree, the product's central bet has not paid, whatever the other metrics say *(PRD-owned)*.

**Secondary**
- **SM-5: The tool is still running in a year.** No credential expired. No server needed a patch. No maintenance task was skipped until something broke. Validates NFR-7, FR-20.
- **SM-6: Agents ship without a human unblocking them.** Development proceeds with tests passing offline and no live API in the loop. Validates NFR-1, NFR-2, NFR-4.

**Counter-metrics (do not optimise)**
- **SM-C1: Searches per full refresh.** A larger Tracked List makes the tool appear comprehensive and makes a daily refresh impossible. Held at roughly 1,500 **searches**, the quantity the rate limit actually constrains, because an entry count would miss a curator who splits one entry into two bands (AD-12). Counterbalances SM-4.
- **SM-C2: Refresh frequency.** A faster refresh spends budget that retries, currency rates and a second recipe need, and prices are stable at daily resolution. Counterbalances SM-1.
- **SM-C3: Number of ranked Base Types shown.** A longer list is not a better one. Bounded by FR-5. Counterbalances SM-2.
- **SM-C4: Apparent confidence.** Rendering `uniform-prior` figures as cleanly as measured ones would make the tool feel more authoritative and be more dangerous. Counterbalances SM-4, and is why FR-10 and FR-11 exist.

## 9. Risks

R-1 through R-6 are carried from the brief, which named them and did not solve them. R-7 is carried from the architecture. v1 closes none of them.

- **R-1 — Listings are supply, not demand.** Every price is what someone asks, filtered to be plausible. **No sale is ever observed.** The manual loop that the tool replaces had a correction that the tool discards: the player actually sold things and learned the result. Mitigation is honesty only (FR-13), not correction.
- **R-2 — The tool cannot discover what it is not told to watch.** A Combination that becomes valuable mid-league stays invisible. The list needs periodic deliberate review rather than unattended running (FR-18). Re-seeding from community sources is the identified answer, and re-seeding is out of v1.
- **R-3 — `measured` weights will carry the same listing bias.** Community weight sources derive from parsing trade listings, which skew toward desirable and higher-tier modifiers. `measured` therefore means *measured by someone*, not *ground truth*, and the honesty apparatus must not imply otherwise.
- **R-4 — Request budget is the permanent binding constraint.** Every Tracked Entry costs a search every refresh. Discipline is an operating requirement, not a one-time tuning exercise (SM-C1).
- **R-5 — Zero-listing Combinations are unresolvable in v1.** A Combination with no listings is either a jackpot or junk, and listings cannot distinguish the two cases. Segregation (FR-9) keeps such Combinations out of the ranking without resolving them.
- **R-6 — League and patch churn.** Resets wipe prices, and patches move the modifier data underneath. The tool is least useful at league start, which is when the knowledge is worth most. This is the central threat to the one-year horizon.
- **R-7 — Every endpoint the product depends on is undocumented.** GGG's developer documentation covers the OAuth API and makes no mention of the trade endpoints, so search, fetch and the catalogue endpoints are unsupported surface that happens to work and may change without notice (AD-8). The product makes a break **loud and cheap** rather than preventing it: one governed client (FR-20), committed fixtures whose re-record diff exposes a reshape (NFR-2), a committed catalogue whose refresh diff exposes a rename (FR-24), and no user-facing path that calls the API live (NFR-7).

## 10. Open Questions

Spine-owned questions are stated in full in `ARCHITECTURE-SPINE.md` *Open Questions* and are listed here by id and owner, never restated. Closed questions and the defects that shaped the valuation model are recorded in `addendum.md` and in git; ids are never reused, which is why this list is not contiguous.

**Owned by the spine or the weights producer**

- **OQ-12** — How a stat filter compares a modifier that publishes several values. Owners: the weights scraper project, and the sync builder.
- **OQ-19** — Whether any Stat Line's shape makes a derived band edge inexact. Owner: the weights scraper project.
- **OQ-20** — What a search must declare about listing status. Owner: the sync builder.
- **OQ-21** — How far whole-tier containment can understate the ranking. Owner: the spine, with the player. `[NOTE FOR PM]` This is the document's live tension: §7.2's deferrals rest on its answer.

**Owned by this document**

- **OQ-5 — Recipe distribution mechanics.** Nothing supplies how perfect versus greater transmute and augment shift the tier distribution. v1 ships one recipe under a documented assumption; ranking per Craft Recipe needs this resolved. Deferred to v2.
- **OQ-6 — What fraction of the Tracked List returns `no-listings`?** Unknown until the first full refresh. If large, the deferred coarser-fallback pricing (§7.2) moves from held option to needed. Revisit after the first full refresh.
- **OQ-7 — Cold-start seeding.** The first Tracked List must be authored from the player's existing knowledge, the very knowledge the tool exists to supply. Not a blocker; the acknowledged price of the curation approach.

## 11. Assumptions Index

Every inline `[ASSUMPTION]` tag in this document, in document order. An entry is a product inference this PRD owns; none is an architecture decision.

- **§4.1 / FR-2** — the brief says "chase modifiers" without defining the ordering. An ordering by price alone would advertise a Combination the player will essentially never roll.
- **§4.1 / FR-2** — the brief's "modifier combinations to look for" is plural and unbounded. Three fits a scannable row and matches UJ-1's "top five bases" reading pattern.
- **§4.1 / FR-3** — 82 is the effective item level cap for these bases, so a floor of 82 and "exactly 82" are the same filter. If bases above 82 exist, this needs a ceiling, not a floor.
- **§4.1 / FR-4** — no source names a minimum denominator. ~20 is the size below which a fraction such as three-of-four stops saying anything about the product.
- **§4.1 / FR-5** — no source names a count. 20 is roughly a screen and comfortably exceeds the "top five" the player acts on.
- **§4.2 / FR-7** — 0.25 Divine, the brief's early-endgame figure, is the least-surprising cold start.
- **§4.4 / FR-11** — a per-Base-Type Provenance badge is enough for the player to judge trust by; no mixed-Provenance indicator is required for v1.
- **§4.7 / FR-26** — larger currency quantities and partial-craft abandonment are not modelled.
- **§4.8 / FR-29** — the understatement stays acceptable in practice for v1 — an operating bet, not a bound; OQ-21 is the measurement that would settle it.
- **§5 / NFR-10** — the extension beyond AD-24's literal scope is this PRD's, not the spine's.
