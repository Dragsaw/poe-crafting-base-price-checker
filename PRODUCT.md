# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

pnpm workspaces, React 19, Vite, Mantine v9 (pinned 9.6.1), Zod, Vitest, MSW — TypeScript, no Python in the product itself. Decided in `AGENTS.md` / the architecture spine; not re-decided here.

## Users

The author, and only the author. This is a single-player, single-operator tool (PRD §2.2): no accounts, no per-user settings, no sharing. The tool bakes in one player's thresholds, one player's playstyle, and one player's judgment about when to trust the data. The author publishes the tool openly but does not advertise it or design for other users; friends with the link are welcome but are not a designed-for audience. Players wanting advice on an item already in hand, and rare-item crafters, are explicit non-users.

## Product Purpose

A PoE2 (Path of Exile 2) crafting base price checker that answers one question: *is this base worth picking up?* A background sync prices a curated set of base-and-modifier combinations against the official trade API; a static web view ranks Item Classes by expected payout per craft, beside the Base Types worth selling uncrafted, counting only outcomes above a player-set Payout Threshold and net of Craft Cost (PRD §1). It replaces the player's manual memorisation of "what is worth picking up" — knowledge that normally costs weeks to rebuild after every league reset. Success is behavioural: the player stops opening the trade site mid-session, stops keeping a mental top-five list, a league start costs days rather than weeks, the ordering visibly beats a naive rank-by-price, and the tool keeps running for a year with no credential rot and no server to patch (PRD §8, SM-1 to SM-6, SM-4a).

## Positioning

The ranking is expected value per craft, threshold-truncated at a player-adjustable payout floor and net of Craft Cost — not "most expensive base." An Item Class with one jackpot Combination and an Item Class with many moderate Combinations swap rank order as the threshold moves, which is the product's core mechanism (PRD §1). The list carries two units: the crafted branch ranks Item Classes and the raw branch ranks Base Types, and each row states which it names (FR-3). A crafted row's figure describes the Item Class, not any one base in it, and no Base Type outside the class contributes to its price (FR-1). Every displayed figure also carries its Provenance and freshness, so a placeholder-derived number is never presented indistinguishably from a measured one (PRD §4.4), and every price is labelled as an asking price, never a realised sale (FR-13).

## Operating Context

- Implementation is under way in a four-package workspace (`contracts`, `core`, `sync`, `web`). The sync pipeline and the raw-branch ranked view are built; the crafted branch (Weights File consumption, crafted EV, Craft Recipe control, Chase Combinations, Provenance banner) and the Unrankable appendix are still in the backlog (`docs/stories/sprint-status.yaml`).
- The player reads the ranked list before a play session or when the economy is worth a look; the list is precomputed and never blocks on a live API call (PRD §1).
- The Payout Threshold is a number input, re-ranking on every valid parse, and it is the only view state promised to survive a reload (FR-6, FR-7).
- Curation is hand-edited, committed JSON files (`data/tracked.json`, `data/config.json`) reviewed periodically by the player — not a UI-driven workflow. The view surfaces the Tracked List's age so a list left unattended is visible (FR-18).
- A background sync process (`sync`) is a separate, unattended package from the web view (`web`). A sync run writes to the player's working tree and commits nothing; what reaches the site is what the player commits and pushes, and the view loads data at runtime without a rebuild (FR-25, FR-33).
- League resets and PoE2 game patches both invalidate prior data; the product must go honestly empty rather than silently serve stale numbers across a reset (PRD UJ-6, FR-31).

## Capabilities and Constraints

- Magic items only (at most one prefix, one suffix), tracked per Item Class, plus Raw (uncrafted) Bases at item level 82 — rare items are explicitly out of scope (PRD §2.2, §7.1).
- Two Craft Recipes in v1 (greater transmute + greater augment; perfect transmute + perfect augment). The active recipe changes the ordering, not just the cost, so the ranking is read under one recipe at a time. An uncostable recipe shows each ranked unit in its own order and states that no order across them exists (FR-1, FR-26).
- The ranked list is bounded to the top 20 rows by default, behind an expand control; collapsed crafted rows show at most three Chase Combinations (FR-2, FR-5).
- No accounts, no backend, no server, no credentials that expire — static bundle delivery only (NFR-7). Any requirement that appears to need a backend is escalated, not implemented (PRD §6).
- Zero network calls in the test path; all API interaction is tested against committed, real captured fixtures (NFR-1, NFR-2). Every trade endpoint the product depends on is undocumented, so breakage is made loud and cheap rather than prevented (R-7).
- A hard external release dependency: the Weights File (pool membership, tier value ranges, item-level availability), produced by a separate scraper project. Without a conforming file every Item Class is Unrankable and the view is a Raw Base price list that names the absence (FR-30, PRD §7.3).
- Unrankable Item Classes sit in a separate group with a count and one of three reasons, never dropped or ranked anyway (FR-4). Pool coverage is measured and published, but it is reported, not a gate.
- Four-state pricing model (`priced`, `no-listings`, `not-yet-synced`, `unresolvable`) must always render distinctly — never collapsed, never implied to be zero/worthless — and `not-yet-synced` always shows its reason (AD-9, FR-9).
- An entry offers a link to its trade-site search when a valid one exists; following it is the player's own act (FR-21, FR-33).
- Colour alone must never carry a product-meaningful distinction (Price State, crafted vs. Raw Base, Provenance) — NFR-10, extended by the PRD beyond AD-24's literal scope.
- Domain terminology (Item Class, Base Type, Modifier Reference, Tracked Entry, Raw Base, Combination, Chase Combination, Tracked List, Item Level Floor, Accepted Tier, Curation Status, Price State, Payout Threshold, Craft Recipe, Craft Cost, Provenance, Eligible Pool, Unrankable, Sync Report, etc.) is fixed by the PRD Glossary (§3) and must be used verbatim, not re-synonymised, anywhere in product or design work. The view names an Item Class by its own name (*Bow*), never prefixed with the word *class*.

## Brand Commitments

No name, logo, or custom visual identity beyond the working title "PoE2 Crafting Base Price Checker." Visual design beyond an off-the-shelf framework (Mantine defaults) is an explicit non-goal — appearance is not a priority for this product (PRD §6). Future design work should stay close to stock Mantine rather than pursue a custom visual identity.

## Evidence on Hand

Real committed data exists in `data/`: a Weights File from the external producer (a mix of `complete` and `partial` pools), a synced Dataset for the current league (mostly `not-yet-synced` while the rotation fills it, some `priced`), the Tracked List, and the Trade Catalogue. Use these files for realistic examples. Do not fabricate sample prices, testimonials, or benchmark data; where the data does not cover a case, use the PRD's worked examples and glossary.

## Product Principles

- The Payout Threshold is a dial the player turns, never a constant baked in — the whole system exists to make that one number honest and reorder the list live when it changes.
- Never render a placeholder (uniform-prior) figure with the same visual weight as a measured one; trust must be legible at a glance, months after the fact.
- Segregate what cannot be honestly priced (no-listings, unresolvable, partial pools) rather than guessing or hiding it.
- Fail honestly: an empty ranking at league start is correct; last league's numbers served as current are not.
- Zero ongoing maintenance burden: no credentials, no server, no account system — a tool that must still run untouched in a year.
- Domain precision over generic UI polish: correct glossary terms, correct state distinctions, and correct provenance beat visual flourish.

## Accessibility & Inclusion

Colour alone must never be the sole carrier of a product-meaningful distinction — this applies to Price State, crafted-vs-Raw-Base, and Provenance rendering (NFR-10). No other accessibility standard is currently mandated.
