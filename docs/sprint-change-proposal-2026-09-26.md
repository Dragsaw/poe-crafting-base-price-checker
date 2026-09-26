---
title: 'Sprint Change Proposal — weights contract 6.0.0'
date: '2026-09-26'
status: approved
scope: minor
mode: incremental
trigger: 'Bug: tierLabel numbered per modifier group (https://claude.ai/code/artifact/94ac46dc-375f-4e9c-8a0a-863f04311d8b)'
---

# Sprint Change Proposal — weights contract 6.0.0

## 1. Issue summary

**Problem.** `tierLabel` in `data/weights.json` (producer 5.0.0, contract `5.0.0`, patch 0.5.5)
was numbered across a whole modifier family, not per stat. Distinct stats in one family shared
one `T1…Tn` run, ascending by item level. Example: Amulets suffix `IncreaseSocketedGemLevel` ran
T1–T12 across four stats, and +3 Spell Skills (the best spell tier) was `T9`. 53 of 1,758
groups mix stats. The contract never fixed the rule, and it exposed the game's mutual-exclusion
group only inside the opaque `sourceModifierId`.

**Fix upstream.** The producer shipped contract `6.0.0`: a required `modGroup` on every entry,
`tierLabel` numbered per stat within `(slot, modGroup)` with T1 = highest `itemLevelMin`, and an
item-wide exclusivity rule. A conforming file (producer 6.0.0, generated 2026-09-26) replaced
`data/weights.json`.

**Issue type.** Technical limitation discovered: a contract gap, found by the curator.

**Evidence.**

- The bug report above: the tier table for Amulets `IncreaseSocketedGemLevel`, and the 53/1,120
  multi-stat multi-tier groups.
- `data/tracked.json` mixed both conventions. The suffix had been hand-corrected `T9` → `T1`;
  the prefix Spirit `[47, 50]` still read `T5`, the 5.0.0 label. It is `T1` under 6.0.0.
- The working-tree `WEIGHTS-FILE-SCHEMA.md` was the producer's own draft, built on `5.0.0`. It
  silently dropped 5.1.0's `className` grammar, its three hard errors (grammar, more than two
  `#`, a duplicate `statId` within one entry), the two-level keying rationale and the item-class
  pool key. It also restored the "producer-side draft" header that spine revision 17's reviewer
  gate had flagged as critical.

## 2. Impact analysis

**Checklist status.** §1 done · §2 done · §3 action-needed (resolved by §4 below) · §4 Option 1
viable, Options 2–3 not needed · §5 done · §6 pending approval.

**Measured on the 2026-09-26 file:** 59 pools, 8,437 entries; `modGroup` present on all and
equal to the family field of `sourceModifierId`; 53 of 1,758 groups hold more than one stat; no
label repeats within a run; **no `modGroup` spans both slots of any pool**; the 5.1.0 `className`
grammar and every hard error pass.

| Area | Impact |
| --- | --- |
| Epic 1 (in progress) | None. Done stories treat `acceptedTier` as an opaque string. No weights schema exists in `packages/` yet. |
| Epic 3 (backlog) | AC edits to Stories 3.1, 3.2, 3.3. No story is added, removed or resequenced. |
| PRD | One FR-29 consequence restated mechanism that becomes false; replaced by a citation. No PRD revision; `PRODUCT.md` unaffected. |
| Architecture | Spine AD-11 (contract version, entry shape), AD-17 (exclusion replaces independence), two diagram labels, revision 19. IN gains §11. AGENT-WORKFLOW step 2. Schema file rebuilt as 5.1.0 plus the 6.0.0 deltas. |
| UX | None. The page never reads `tierLabel`; the Accepted Tier stays curator-declared. |
| Data | `data/tracked.json`: one label. |
| Ranking numbers | Unchanged today. With no cross-slot group, the exclusion formula reduces exactly to `P(prefix) × P(suffix)`. |

## 3. Recommended approach

**Option 1, direct adjustment.** Effort: low (docs plus one data line). Risk: low. Timeline:
no impact; the affected stories have not started.

Decisions taken with the player:

- **[USER]** 6.0.0 is merged onto 5.1.0; the producer draft is not adopted verbatim.
- **[USER]** `core` **models** mod-group exclusion, rather than guarding against it or deferring it.
- **[USER]** `core` accepts 6.x only; a 5.x file is refused as an unknown major.
- **[USER]** A transmute draws from the prefix and suffix pools **combined, by weight**. This is a
  game fact, not an assumption, so no OQ is opened.

Rejected: a guard only (a class is unrankable where a group spans slots), which is simpler but
not what the player chose; continuing to accept 5.x, which leaves exclusion unrunnable on such a file.

## 4. Detailed change proposals (all approved)

### 4.1 `WEIGHTS-FILE-SCHEMA.md` — 6.0.0 merged onto 5.1.0

- Base: the committed 5.1.0 text. Remove the producer-draft framing ("producer-side draft",
  "gitignored in this repo", the `baseTypeId` pool key).
- Frontmatter: `schemaVersion: '6.0.0'`, `updated: '2026-09-26'`; keep `status: final` and
  `governed_by: AD-17`.
- Header: "`6.0.0` is adopted, as of spine revision 19 … (revisions 16–17, 19)".
- New `## 6.0.0 — modGroup and per-stat tierLabel` above the 5.1.0 section: the producer's
  two-row table. The *Nothing else* row adds "the 5.1.0 `className` grammar and every 5.x hard
  error". The opening line reads "**Breaking.** `core` implements `6` and refuses `5.x` as an
  unknown major (spine AD-11)". Add the verification line from §2.
- New `## The exclusivity rule` after the pool-completeness rule: the producer's three bullets,
  plus "How `core` applies it to a crafting act is spine AD-17 and `IMPLEMENTATION-NOTES.md`
  §11". Drop "core cannot accept 6.0.0 until it applies the exclusivity rule".
- *Shape*: `6.0.0`, and `modGroup` on each example entry.
- *Field rules*: a new `modGroup` row; `tierLabel` gets the per-stat, T1-highest rule.
- *Validation*: new hard error "a missing, non-string or empty `modGroup`".

### 4.2 Spine AD-11, diagrams, frontmatter

- *Rule*: `5.1.0` → **`6.0.0`**. The "additive over 5.0.0" paragraph is replaced: 6.0.0 is
  breaking and `core` refuses 5.x; it adds `modGroup` for AD-17's exclusion; it renumbers the
  display-only `tierLabel`; the 5.1.0 `className` grammar carries forward (AD-16, IN §10); the
  2026-09-26 file satisfies it across all 59 classes.
- Entry paragraph: add `modGroup` to the field list, and "`core` reads `modGroup` for AD-17's
  exclusion only, and never parses `sourceModifierId` to recover it."
- Line 1755 diagram label: `schema-conformant 6.0.0<br/>tiers + lines + modGroup + itemLevelMin`.
  Line 1840 tree: `contract 6.0.0`.
- Frontmatter: `revision: 19`, `updated: '2026-09-26'`.

### 4.3 Spine AD-17 — exclusion replaces independence

OLD (lines 1200–1203): prefix and suffix as independent draws, `P(prefix) × P(suffix)`, with
mod-group exclusion "Deferred".

NEW: `P(combination)` is one crafting act. The transmute draws from the prefix and suffix pools
combined, by weight (a game fact, confirmed by the player 2026-09-26). The augment draws from
the other slot's pool with the first affix's `modGroup` removed, renormalised. `P = 1` for an
absent affix. The formula and the order scope → truncate → exclude → renormalise live in IN §11,
binding under AD-0. Where no group spans both slots, the result is exactly `P(prefix) ×
P(suffix)`, which is true of all 59 classes today. An augment left with no eligible entry makes
the `(itemClass, recipe)` pair unrankable with a reason, never a zero. No OQ is opened.

### 4.4 `IMPLEMENTATION-NOTES.md` — new §11 *Mod-group exclusion across the two draws (AD-17)*

- Setting: one transmute and one augment on a magic item. There is one affix per slot, so
  exclusion never acts within a slot. Rare items are out of v1.
- Symbols: `E_P`/`E_S` from §9, `W_P`/`W_S`, `C_p`/`C_s` (an absent affix gives `C = E`),
  `g(e) = e.modGroup`, and `W_X∖G`.
- Formula: the two-order sum, prefix-first and suffix-first, each weighted by
  `weight / (W_P + W_S)`, with the second draw's numerator and denominator excluding the first
  affix's group.
- Order: scope, truncate (§9), exclude, renormalise. Excluding before truncating is the error.
- Reduction: with no cross-slot group it equals `P(p | recipe) × P(s | recipe)`. Tests assert
  agreement to 1e-12 relative on every tracked entry of the real file, and assert a cross-slot
  case built inside the test (NFR-2).
- A zero `W_X∖g(·)` under a positive weight is an unrankable reason, never a zero.

### 4.5 `AGENT-WORKFLOW.md` step 2

`ModifierWeight` follows `6.0.0`, carries `modGroup`, never takes a `5.x`/`4.x` shape, and the
schema refuses 5.x. Read `modGroup` for exclusion (AD-17, IN §11) and never parse it out of
`sourceModifierId`. The 5.1.0 `className` grammar is unchanged (IN §10). `tierLabel` stays
display-only.

### 4.6 `epics.md`

- **Story 3.1, AC 1**: accepts `6.0.0`, refuses any `5.x` as an unknown major (FR-27, AD-11, NFR-8).
- **Story 3.1, the entry AC**: add `modGroup`, and "`core` reads the group from `modGroup`, never
  by parsing `sourceModifierId`".
- **Story 3.2, the Combination AC**: combined-pool transmute, augment with the group removed,
  scope → truncate → exclude → renormalise, `P = 1` for an absent affix. Plus two new ACs: the
  reduction to the product (1e-12, on the real file), and a cross-slot case built inside a test,
  including the unrankable dead end (AD-17, IN §11, NFR-2).
- **Story 3.3, kind agreement**: "because `5.0.0` carries no `kind` field" → "because the
  contract carries no `kind` field".

### 4.7 `prd.md` FR-29 — citation sweep, not a revision

OLD: "Prefix and suffix are independent draws, and an absent affix is certain (AD-17)."
NEW: "A Combination's probability follows one crafting act on the Item Class, and an absent
affix is certain (AD-17; `IMPLEMENTATION-NOTES.md` §11)."

None of the five PRD triggers fires, so there is no revision bump and no `PRODUCT.md` refresh.

### 4.8 Data and records

- `data/tracked.json`: the Amulets crafted `prefix.acceptedTier` `"T5"` → `"T1"`. **Applied by the agent on the
  player's explicit instruction** (AGENT-WORKFLOW makes the player the only writer of
  `tracked.json`).
- Spine `.memlog.md`: a revision 19 entry (event, finding, [USER] decisions, verification,
  PRD citation sweep).
- `docs/stories/deferred-work.md`, one line appended: the Emerald prefix band `[12, 15]` does
  not contain its only tier `[5, 15]`, so Story 3.3's empty-containment check will reject it.
  This predates the change.
- `sprint-status.yaml`: no change.

## 5. Implementation handoff

**Scope: Minor.** Developer agent, direct implementation of §4 as documentation and data edits.
There is no code change now. Stories 3.1–3.3 pick up the new ACs when they are built.

**Success criteria**

- `WEIGHTS-FILE-SCHEMA.md` diff against `HEAD` shows only the §4.1 additions, and no 5.1.0 rule removed.
- No `5.1.0` or `5.0.0` remains in the spine, AGENT-WORKFLOW or epics as a *current* contract
  pin. Historical mentions in changelog sections and measured-against notes stay.
- The spine and the schema agree on the major; AD-17 cites IN §11, and §11 exists.
- `pnpm test` stays green.
- `lint_spine` is clean if available.
