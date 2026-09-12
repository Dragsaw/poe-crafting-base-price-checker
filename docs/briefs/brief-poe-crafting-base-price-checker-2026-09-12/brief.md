---
title: "Product Brief: PoE2 Crafting Base Price Checker"
status: final
created: 2026-09-12
updated: 2026-09-12
---

# Product Brief: PoE2 Crafting Base Price Checker

## Executive Summary

Farming crafting bases is one of the fastest, most reliable ways to make currency in Path of Exile 2's early and mid endgame. It is also gated behind memory. The method only pays once you know which bases are worth picking up and which modifier combinations are worth selling — knowledge currently acquired by picking up everything, crafting on it, price-checking the result, and slowly committing the answers to memory. That apprenticeship takes weeks, and it resets every league.

This tool replaces the memorization with a ranked list. It queries the official PoE2 trade API for magic items carrying real value, works out which bases and which modifier combinations are behind those prices, and presents a short ordered list of what to chase — read before a play session, or whenever the economy is worth a look. The ranking is not "most expensive base." It is expected payout per craft, counting only outcomes above a threshold the player sets, minus the cost of the craft.

It is built for its author, published openly but unadvertised, and intended to be maintained for as long as its author is playing the game — a year or more, across multiple league resets.

## The Problem

Base farming is attractive precisely because it is low-effort: pick up bases while mapping, apply a transmute and an augment, sell the winners. At roughly twelve bases per five-minute map, the loop generates around 144 decisions an hour. Every one of those decisions needs knowledge the player does not have on day one.

Today the only ways to get that knowledge are to check the trade site item by item — which cannot be done at the pace the game produces items — or to memorize. Memorization works, and it is what makes an experienced player efficient, but it has three costs:

- **It is slow to acquire.** Weeks of trial crafting before the method becomes profitable.
- **It goes stale.** Prices move within a league as builds rise and fall. A base that paid last week may not this week, and nothing tells you.
- **It is destroyed by every league start** — three to four times a year — at precisely the moment the information is worth the most.

## The Solution

A web view showing a ranked list of bases worth chasing, most profitable first, with the modifier combinations to look for on each. Each base expands to the full list of tracked combinations and their current prices. The list is precomputed by a background sync, so it is ready before a session begins and never blocks on a live API call.

The product answers exactly one decision: **is this base worth picking up?** It deliberately does not advise on whether to augment a given item — that call stays with the player, who can already tell that an increased-stun-threshold roll is dead without being told.

## How Value Is Estimated

This section is the product; everything else is presentation.

**Prices come from the cheapest live instant-buyout listings.** Pricing a combination requires asking the trade API about that specific combination — there is no way to have the API group or aggregate for you. So each tracked combination costs its own search: magic items of that base with those modifiers, instant-buyout only, cheapest first. Sorting ascending means stale overpriced listings never reach the estimate; restricting to instant buyout means underpriced listings would already have been bought. Refreshed daily — prices are stable enough at that resolution, and measured rate limits make anything faster impossible across the whole list.

**The tracked list is therefore the request budget**, and keeping it small is what makes a daily refresh affordable. The player curates it: pruning combinations known to be worthless so they never consume capacity, pinning ones worth watching closely.

**Which combinations get tracked is a human judgment, and stays one.** The API returns listings, not distributions, so no query discovers valuable combinations for you. The tracked list is seeded from the player's existing knowledge and refined as the market corrects it.

**Ranking is threshold-truncated expected value, not expected value.** Outcomes below the player's payout threshold are worth nothing to him — that much currency turns up just playing — so they must contribute nothing to the ranking. For each base, sum `P(combination) × price(combination)` across only those combinations at or above the threshold, then subtract the full cost of the craft, paid on every attempt including the failures.

The threshold is the dial that decides everything. A base with one jackpot combination and a base with many moderate ones swap places as it moves, which is why it is a user-facing control: roughly a quarter of a divine in early endgame, a divine or more once the player is richer and stronger.

**Modifier weights are an input, not something this app produces.** `P(combination)` depends on how likely each modifier is to roll, which PoE2 does not publish. The app therefore consumes a weights file with a defined schema and is indifferent to its producer. Keeping that separate is a matter of cadence: prices move hourly, weights only when GGG patches the game. Version one ships against a uniform-prior file — every combination in a base's eligible pool treated as equally likely — so the ranking works from the start and improves when better weights arrive without the app changing. Coverage will be partial, so the interface must distinguish a ranking built on measured weights from one resting on the placeholder.

**The ranked unit is a base paired with a crafting recipe**, not a base alone. Perfect and greater transmutes and augments produce different tier distributions at different costs, and currency prices move during a league, so the same base can win under one recipe and lose under another.

## Who This Serves

The author, primarily and by design. Secondarily, the friends he shares the link with, and anyone who happens to find it — welcome, but not courted. There is no growth goal, no monetization, and no advertising. This freedom is load-bearing: it is why the tool can assume one player's thresholds, one player's playstyle, and one player's judgment about when to trust it.

## Scope

**In for the first version**

- Magic bases — one prefix, one suffix — at endgame item levels.
- White bases at item level 82 only, the one case where selling the raw base may beat crafting on it.
- Ranked base list with chase modifiers, expandable to full tracked combinations.
- Player-set payout threshold.
- Background sync against the official trade API, rate-limit aware.
- Curation controls: prune junk combinations, pin ones to watch.
- A defined weights-file schema, and a uniform-prior file satisfying it.

**Explicitly out**

- Producing modifier weight data — the scraper that harvests it is a separate project.
- Loot filter export.
- Advice on whether to augment an item already in hand.
- Rare items.
- Accounts, sharing, per-user saved preferences, anything multi-user.
- Visual design beyond what an off-the-shelf framework provides.

## Success Criteria

Behavioral, not numeric. The tool works when:

- The player stops opening the trade site mid-session.
- The player stops keeping a top-five list in his head.
- A league start no longer costs weeks of relearning — the list is useful within days.
- Chase decisions made from the list hold up against what actually sells.

## Development Constraints

AI agents build the application end to end, which makes the following hard requirements rather than preferences:

- **Fully testable and debuggable by an agent with no human in the loop.** Since the primary data source is a live, rate-limited third-party API, this implies recorded fixtures rather than live calls in the test path.
- **Parallel development across multiple git worktrees**, so several agents can work simultaneously without colliding.
- **An existing UI framework or design system.** Appearance is explicitly not a priority.
- **Two components**: sync and aggregation, and display. Stack otherwise open at this stage.

## Key Risks and Open Questions

- **The tool cannot discover what it is not told to watch.** The tracked list contains only what the player thought to put in it, so a combination that becomes valuable mid-league — a new build making some overlooked modifier desirable — stays invisible until he notices it himself. This is the one part of the original memorization problem the tool does not solve, and it means the list needs periodic deliberate review rather than running unattended. Re-seeding from community sources — spawn weights for rarity, build-popularity data for demand — is the most promising answer, and is out of scope for v1.
- **Request budget is the binding constraint, and it is tighter than first assumed.** Every tracked combination costs a search on every refresh. Measured limits allow ~2,400 searches a day, so a list of ~1,500 combinations takes roughly fifteen hours to refresh in full and consumes around 62% of the budget — leaving headroom for retries, currency rates and a second recipe. Discipline about what is tracked is a permanent operating requirement, not a one-time tuning exercise. Authenticating raises the available rate limit and buys headroom, but does not change the shape of the problem.
- **Zero-listing combinations.** A combination with no listings is either a jackpot or junk, and listings cannot distinguish them. Segregating unknowns keeps them out of the ranking, but does not resolve them. Modifier spawn weights would — a combination that is genuinely rare *and* unlisted is a plausible jackpot, while a common unlisted one is junk.
- **There is no public modifier weight dataset.** PoE2 ships no weights in the game client, and the RePoE PoE2 export sets them all to 1 — placeholders, not values. The usable sources are community-derived: poe2db embeds weight JSON inside page script elements, recoverable only by scraping, and further data circulates informally on Discord. Whatever is obtained is someone's estimate carrying its own listing bias. Until real weights are in hand the tool ranks on a uniform prior — a genuine approximation, and one to label wherever it drives a number on screen.
- **League and patch churn.** Three to four league resets a year wipe prices entirely; game patches move the modifier data underneath. The tool is least useful at league start, which is when the knowledge is worth the most. This is the central threat to the one-year horizon.
- **Listings are supply, not demand.** Every price in the system is what someone is asking, filtered to be plausible. No sale is ever observed. The manual loop has a correction the tool does not: the player actually sells things and finds out.

## Vision

If it works, the memorization goes away and the ranked list becomes the thing consulted before every session — a live read on which corner of the economy is worth farming this week rather than a fact learned last month.

Beyond that, a generated loot filter so the game itself highlights what to pick up — with a hard ceiling worth naming now. PoE2's filter syntax has no working equivalent of `HasExplicitMod`, so a generated filter can express base type, item level and rarity but never modifier combinations. It can automate which bases to grab; the modifier knowledge stays in the web view. That makes the view the permanent product rather than a stepping stone.
