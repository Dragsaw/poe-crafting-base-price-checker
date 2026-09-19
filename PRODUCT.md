# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

pnpm workspaces, React 19, Vite, Mantine v9 (pinned 9.6.1), Zod, Vitest, MSW — TypeScript, no Python in the product itself. Decided in `AGENTS.md` / the architecture spine; not re-decided here.

## Users

The author, and only the author. This is a single-player, single-operator tool (PRD §2.2): no accounts, no per-user settings, no sharing. The tool bakes in one player's thresholds, one player's playstyle, and one player's judgment about when to trust the data. The author publishes the tool openly but does not court or design for other users; friends with the link are welcome but are not a designed-for audience.

## Product Purpose

A PoE2 (Path of Exile 2) crafting base price checker. A background sync prices a curated set of base-and-modifier combinations against the official trade API; a static web view ranks Base Types by expected payout per craft, above a player-set payout threshold and net of craft cost. It replaces the player's manual memorisation of "which bases are worth picking up" — knowledge that normally costs weeks to rebuild after every league reset. Success is behavioural: the player stops opening the trade site mid-session, stops keeping a mental top-five list, and the tool keeps running for a year with no credential rot and no server to patch (PRD §8).

## Positioning

The ranking is expected value per craft, threshold-truncated at a player-adjustable payout floor and net of craft cost — not "most expensive base." A base with one jackpot combination and a base with many moderate combinations swap rank order as the threshold moves, which is the product's core mechanism (PRD §1). Every displayed figure also carries its Provenance (measured vs. uniform-prior) and freshness, so a placeholder-derived number is never presented indistinguishably from a measured one (PRD §4.4).

## Operating Context

- Pre-code: this is a planning-only repository today (PRD, architecture spine, UX designs, stories in `docs/`); no application source exists yet.
- The player reads the ranked list before a play session or when the economy is worth a look; the list is precomputed and never blocks on a live API call.
- Curation is hand-edited, committed JSON files (`data/tracked.json`, `data/config.json`) reviewed periodically by the player — not a UI-driven workflow.
- A background sync process (`sync`) is a separate, unattended package from the web view (`web`); the two share validated artifacts but the view never calls the trade API live.
- League resets and PoE2 game patches both invalidate prior data; the product must go honestly empty rather than silently serve stale numbers across a reset (PRD UJ-6).

## Capabilities and Constraints

- Magic Base Types only (at most one prefix, one suffix) plus Raw (uncrafted) Bases at item level 82 — rare items are explicitly out of scope (PRD §2.2, §7.1).
- One Craft Recipe in v1 (one perfect transmute + one perfect augment); a second recipe is deferred (PRD §7.2).
- No accounts, no backend, no server, no credentials that expire — static bundle delivery only (NFR-7). Any requirement that appears to need a backend is escalated, not implemented (PRD §6).
- Zero network calls in the test path; all API interaction is tested against committed, real captured fixtures (NFR-1, NFR-2).
- A hard external release dependency: the Weights File (pool membership, tier value ranges, item-level availability), produced by a separate scraper project. Until a conforming file exists, every crafted Base Type is Unrankable (PRD §7.3).
- Four-state pricing model (`priced`, `no-listings`, `not-yet-synced`, `unresolvable`) must always render distinctly — never collapsed, never implied to be zero/worthless (AD-9, FR-9).
- Colour alone must never carry a product-meaningful distinction (Price State, crafted vs. Raw Base, Provenance) — NFR-10, extended beyond the spine's literal scope by this PRD.
- Domain terminology (Base Type, Modifier Reference, Tracked Entry, Combination, Chase Combination, Payout Threshold, Craft Cost, Provenance, Eligible Pool, Unrankable, etc.) is fixed by the PRD Glossary (§3) and must be used verbatim, not re-synonymised, anywhere in product or design work.

## Brand Commitments

No name, logo, or custom visual identity beyond the working title "PoE2 Crafting Base Price Checker." Visual design beyond an off-the-shelf framework (Mantine defaults) is an explicit non-goal — appearance is not a priority for this product, confirmed during init. Future design work should stay close to stock Mantine rather than pursue a custom visual identity.

## Evidence on Hand

None yet. No screenshots, sample data, or a conforming Weights File exist at this stage — the project is pre-code and the Weights File is an external, not-yet-delivered dependency (PRD §7.3). Do not fabricate sample prices, testimonials, or benchmark data; use the PRD's worked examples and glossary only.

## Product Principles

- The Payout Threshold is a dial the player turns, never a constant baked in — the whole system exists to make that one number honest and reorder the list live when it changes.
- Never render a placeholder (uniform-prior) figure with the same visual weight as a measured one; trust must be legible at a glance, months after the fact.
- Segregate what cannot be honestly priced (no-listings, unresolvable, partial pools) rather than guessing or hiding it.
- Zero ongoing maintenance burden: no credentials, no server, no account system — a tool that must still run untouched in a year.
- Domain precision over generic UI polish: correct glossary terms, correct state distinctions, and correct provenance beat visual flourish.

## Accessibility & Inclusion

Colour alone must never be the sole carrier of a product-meaningful distinction — this applies to Price State, crafted-vs-Raw-Base, and Provenance rendering (NFR-10). No other accessibility standard is currently mandated.
