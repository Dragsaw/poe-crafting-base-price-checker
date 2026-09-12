---
title: "Addendum: PoE2 Crafting Base Price Checker"
status: final
created: 2026-09-12
updated: 2026-09-12
---

# Addendum

Depth captured during discovery that belongs downstream (PRD, architecture, solution design) rather than in the brief.

## Request Budget Analysis

The decisive engineering question was whether a daily refresh is affordable against trade API rate limits.

**The API does not aggregate.** Pricing a specific modifier combination requires a search filtered to that combination. There is no query that returns "the expensive combinations on this base" as grouped output; an unfiltered search returns an undifferentiated result set. This is a hard property of the trade API and it is what makes the tracked list load-bearing rather than merely convenient.

**Measured limits** (2026-09-12, live unauthenticated calls — these supersede an earlier estimate of ~12 requests/minute, which was roughly 7× too optimistic). Search and fetch are **separate buckets**, both keyed by the rule `Ip`:

| Policy | Buckets (`hits:seconds:penalty`) | Sustained | Per day |
|---|---|---|---|
| `trade-search-request-limit` | `5:10:60, 15:60:300, 30:300:1800, 600:21600:3600` | ~100 searches/hour | **2,400** |
| `trade-fetch-request-limit` | `12:4:10, 16:12:300, 50:300:300, 1000:21600:1800` | ~167 fetches/hour | 4,000 |

**Search is the binding constraint.** One search plus one fetch prices a combination, so the 600-per-rolling-6-hours search bucket sets the ceiling; the fetch bucket is never reached by this workload. ~250 endgame-relevant base types.

| Workload | Requests per refresh | Wall clock |
|---|---|---|
| Exhaustive enumeration of the combination space | ~50,000 searches | ~500 hours (~21 days) |
| Pricing a curated list of ~2,000 combinations | ~2,000 searches + ~2,000 fetches | ~20 hours |
| **Pricing a curated list of ~1,500 combinations (adopted)** | ~1,500 searches + ~1,500 fetches | ~15 hours |
| Market scan with enough paging to be informative (rejected) | ~250 searches + ~3,750 fetches | ~23 hours |

Exhaustive enumeration was costed from the user's worked example: wands carry 11 prefixes and 18 suffixes; restricted to tiers 1–2 that is ~400 combinations per base and ~1,000+ searches for the wand category alone. Infeasible at any useful refresh rate — which is the argument for curation, not against it.

**The curated list size is the budget knob, and the knob is tighter than first thought.** At ~2,000 tracked combinations a full refresh consumes ~83% of the daily search budget and takes most of a day — it fits, but without headroom for retries, currency-rate syncing, or a second crafting recipe. **~1,500 is therefore the adopted size**, at ~62% of budget. At ~10,000 a daily refresh is impossible by a factor of four. This is the number to watch as the list grows.

**Design consequence:** the syncer must read the rate-limit headers GGG returns on each response and adapt its pacing to the live policy rather than hardcoding a rate. The header shape is `X-Rate-Limit-Rules`, naming the active rules, then `X-Rate-Limit-<rule>` and `X-Rate-Limit-<rule>-State` per rule — unauthenticated that is `X-Rate-Limit-Ip` and `X-Rate-Limit-Ip-State`. A multi-hour, multi-chunk refresh is acceptable because all data is precomputed ahead of play; nothing is on a user-facing path.

**Authentication is now a quantified lever rather than a vague one.** The limits above apply to the rule `Ip`. A session moves the client to a different, more generous rule, which is the option to reach for if the tracked list must exceed ~1,500 — at the cost of reintroducing a rotting credential.

## Why Market Scanning Was Rejected

An unfiltered-by-modifier search — one base, magic, endgame item level, instant buyout, above a price floor — does return listings whose fetched items carry `explicitMods` and `listing.price`. That much is verified against a live unauthenticated `trade2/fetch` call. The proposal was to read modifiers off those results and let the market nominate combinations worth tracking, at roughly one search per base.

It was rejected because it collapses into one of two useless shapes:

- **Shallow.** Reading the first ten listings surfaces whichever combination is most *commonly* listed at that price point — which is the combination already known. A rare valuable combination has a handful of listings and does not appear. The API returns individual listings, not a grouped distribution, so a small sample carries no aggregate signal.
- **Not cheap.** Paging the full result set per base to actually tally combination frequencies runs 10–20 fetches per base, roughly 4,000 requests across ~250 bases. Against the measured limits that is ~23 hours — *longer* than pricing the entire curated list, because paging is fetch-heavy and the fetch bucket is only modestly more generous. The cost advantage that motivated the approach disappears entirely.

**Consequence, recorded rather than solved:** the tracked list can only be seeded from the player's existing knowledge, so cold start and meta blindness both remain live. Periodic deliberate review is the mitigation in v1. The more promising direction — re-seeding from community sources, using spawn weights for rarity and build-popularity data for demand, rather than trying to infer either from listings — is noted as a v2 candidate and deliberately not designed here.

## The Tier Restriction

Scope restricts tracked combinations to modifier tiers 1 and 2. Tier is being used as a proxy for "expensive", which it is only roughly — but since every tracked combination costs a search on every refresh, the restriction is doing real budget work and should stay.

Its cost is the off-tier modifier that is valuable anyway because of the current build meta: a T3 roll worth two divine this league is invisible to a tier-restricted tracked list, and — with market scanning rejected — nothing in the system will surface it. The user adds such combinations by exception when he notices them. The restriction governs the default, not the ceiling.

## Ranking Metric — Derivation

The founding question was how to rank base X, which has a single extremely expensive combination, against base Y, which has many moderately expensive ones.

The question has no answer until a denominator is named. Profitability *per drop*, *per craft attempt*, *per inventory slot*, and *per hour played* rank X and Y differently.

The user's binding constraint is his own time — he would rather play than craft — which produced the resolution: outcomes of 1–2 exalts are worth nothing to him, because he would find that much currency simply playing. That is a **threshold**, and a threshold is incompatible with plain expected value, which sums all outcomes including the ones he would vendor. Ranking on raw EV would systematically favor the steady moderate base for producing a pile of results he does not want.

Hence threshold-truncated expected value, with the threshold exposed as a control because it drifts upward through a league.

**Variance was considered and dismissed.** At ~12 bases per 5-minute map (~144/hour), a 1-in-500 jackpot lands every few hours of mapping. Attempt volume is high enough that mean-based math is sound; there is no need to rank on median or to expose a risk preference.

**Sell-through speed was considered and rejected** as a ranking term. The initial hypothesis was that if time is scarce, items that sell fast should outrank items that sell slow. The user was explicit that sell speed is not a factor.

## Alternatives Considered for Combination Discovery

1. **Hand-curated tracked list** (initial user proposal). **Adopted.** The API's lack of aggregation leaves no alternative, and the list doubles as the request budget. Its two weaknesses are the same weakness twice: **cold start** — seeding the list requires the knowledge the app exists to supply — and **meta blindness** — a combination that becomes valuable mid-league never enters the list, so it is never checked, so it is never discovered. A stale top five that the user trusts is worse than no tool. Neither is solved in v1; both are recorded as risks.
2. **Coarser fallback pricing.** When a specific combination has no listings, widen to "base + this prefix, any suffix" and price from the coarser bucket, marked as an estimate. Not adopted; retained as an option if the unknown bucket proves unusable.
3. **Spawn-weight disambiguation.** Use modifier rarity to separate "rare and unlisted" (plausible jackpot) from "common and unlisted" (junk). Contingent on obtaining real weights, which RePoE's PoE2 export does not supply — see *Weights as a Decoupled Input*.
4. **Market scan as candidate generator** (rejected — see *Why Market Scanning Was Rejected*). Either too shallow to reveal anything unknown, or no cheaper than pricing the full list.
5. **Re-seeding from community sources** — spawn weights for rarity, build-popularity data for demand. The most promising answer to cold start and meta blindness. Noted for v2, not designed.

## Price Estimator Rationale

Three options for dealing with listings being asking prices rather than sale prices:

1. Take listings at face value, read a low percentile.
2. Poll repeatedly and watch listings disappear, treating disappearance as a sale signal.
3. Log the user's own actual sales as ground truth.

**Adopted: a middle ground closer to (1).** Cheapest ~10 live listings, instant-buyout only, refreshed every few hours. Sorting ascending makes stale overpriced listings irrelevant to the estimate; instant-buyout-only removes listings priced below market, since those would already have been bought automatically.

Option (2) was noted as the only approach that improves the longer the tool runs, and the only one poe2scout is not doing — but its main benefit is sell-through data, which the user does not value. It is also worthless at league start.

Option (3) was rejected as manual work inside a tool built to avoid manual work.

**PoE2 asynchronous trade** (Merchant Tabs, the NPC Ange, buyers paying listed price plus a gold fee, sellers transacting while offline) is what makes instant-buyout filtering meaningful. Confirmed to exist.

## The Two-Stage Craft

The late-endgame workflow is: perfect transmute everything picked up, evaluate, then perfect augment only the promising items. This contains a second decision — given a magic item with exactly one modifier, is an augment worth spending — which is made dozens of times per session, far more often than the once-per-session read of the ranked list.

It was raised as a candidate for v1 and **deliberately excluded**. The user's position: the pickup decision is what matters, transmute and augment can be assumed always applied, and the skip cases are self-evident to him in the moment (an increased-stun-threshold roll needs no tool to reject). Recorded here because it is the strongest candidate for v2 if the pickup list proves out.

## Early Endgame vs Late Endgame

Early endgame triages before crafting, since perfect transmutes and augments are expensive relative to a small currency pool. Late endgame crafts on everything picked up. The user chose to target **late endgame**, on the judgment that its value transfers downward to early play while the reverse is not true.

Threshold values by stage: ~0.25 divine in early endgame, ≥1 divine once richer and stronger.

## Data Source Notes

- **Official trade API.** Works **unauthenticated**, including the search endpoint. Verified 2026-09-12 with no session cookie on all three surfaces: `GET /api/trade2/data/leagues` (200), `POST /api/trade2/search/poe2/{league}` (200, returning a query id and result ids), and `GET /api/trade2/fetch/{ids}?query={id}&realm=poe2` (200, returning item JSON including `explicitMods` and `listing.price`). This closes the open spike over whether search specifically required `POESESSID` — it does not. `POESESSID` is an *optimization* — it moves the client off the `Ip` rate-limit rule — not a requirement. The active PoE2 league id at time of verification was `Forbidden Rites`. This removes the rotting-credential risk an earlier draft carried. A descriptive `User-Agent` in the form `tool-name, contact@email` should still be sent, as GGG asks of third-party tools.
- **Search filters confirmed by the user**: rarity, item level, price floor and instant-buyout are all exposed together with a price sort.
- **RePoE fork** publishes a PoE2 export at `repoe-fork.github.io/poe2/` (v4.5.5.2) including `mods.json` and `mods_by_base.json`. **Its spawn weights are all set to 1** — placeholders, not data. Usable for modifier identity, tiers and base-to-modifier mapping; useless for probability. Still a recurring maintenance dependency, since it tracks game patches.
- **Modifier weights are not in the PoE2 game client at all**, unlike PoE1, and no clean public dataset exists. [poe2db.tw](https://poe2db.tw/us/) carries weight data as JSON embedded in page script elements — e.g. `poe2db.tw/us/Bows` — recoverable only by scraping HTML, per category page. [Craft of Exile](https://www.craftofexile.com/weightings?game=poe2) also publishes weightings. Further data circulates informally on Discord. Derivation uses recombinator experiments (credited to Krakenbul and the Prohibited Library Discord) and, for bases that cannot be recombined — Charms, Jewels, Tablets, Waystones — large-scale parsing of trade listings, matched to game modifiers to build a distribution, then normalized to apply breakpoints and keep curves consistent across similar base groups.
- **poe2db's own bias caveat is worth inheriting**: trade listings skew toward more desirable and higher-tier modifiers, mitigated by parsing the *lowest-value* listings — though sometimes higher price points are unavoidable, because some modifiers are rare enough to appear meaningfully only above a threshold. This independently validates the ascending-sort choice in the price estimator, and it means any imported weight carries the same listing bias this tool is already exposed to.
- **Weights as a byproduct.** The tool's own pricing output is the same raw material poe2db parses. Deriving in-house weights from accumulated observations is therefore possible in principle, and gets better the longer the tool runs — a third potential producer of the weights file, not a v1 concern.
- **pathofcrafting.net** was raised and struck — its attribution page returns 404 and its game coverage could not be confirmed.
- **poe2scout** was evaluated as prior art and found not to overlap. It is a live PoE2 site with a public API, but covers currency exchange rates and volume, unique items, price history, and *unique base* reference data — the bases uniques drop on, for chancing. It carries nothing on magic base prices by modifier combination. No reuse available; no competitive overlap.

## Weights as a Decoupled Input

Weights are consumed, never produced, by this application.

**The decoupling is justified by cadence, not tidiness.** Prices move hourly and are stale within a day. Weights move only when GGG patches the game — every few months. Routing patch-cadence data through an hourly pipeline couples two things with nothing in common, and a tidiness argument alone would not survive the first moment merging them looked convenient.

**The contract is the deliverable.** The app depends on a weights *file* with a defined schema, not on poe2db and not on a scraper run. The scraper is one producer of that file; a dataset obtained from Discord is another; weights derived in-house from accumulated pricing data would be a third. The app is indifferent. Two repositories without a shared contract do not decouple anything — they produce two components that break together.

**Sequencing.** Define the schema, generate a uniform-prior file that satisfies it, and build the ranking against that. The probability code path is then exercised from day one, the ranking formula never changes shape, and the scraper can land at any later point without touching the app. It also removes the scraper from the critical path: if scraping proves fragile or poe2db changes its markup, a working tool still exists.

**Do not split the repository until the schema stops moving.** A contract still in flux across two repositories means paired commits across a boundary for no benefit. Settle it in one place, then extract.

**Partial coverage must be visible.** Weight coverage will be uneven — some bases measured, others defaulted, others absent. A ranking resting on real weights and one resting on the uniform placeholder must not render identically, or a placeholder will quietly be trusted months later with nothing to reveal it.

## PoE2 Loot Filter Ceiling

PoE2's item filter syntax has no working equivalent of PoE1's `HasExplicitMod` — the condition is absent or behaves differently. A generated filter can therefore express base type, item level and rarity, but never modifier combinations.

Consequence for the roadmap: filter export automates the half of the knowledge that is already easy (a handful of base names) and cannot touch the half that is hard (the modifier combinations). The "eventually I won't have to memorize anything" outcome is not achievable. The web view is the permanent product, not a stepping stone to the filter.
