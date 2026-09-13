---
title: "Rubric review — ARCHITECTURE-SPINE.md revision 9"
lens: rubric (good-spine checklist)
target: docs/architecture/architecture-poe-crafting-base-price-checker-2026-09-12/ARCHITECTURE-SPINE.md
revision_reviewed: 9
date: 2026-09-13
verdict: "Accept with required fixes — the two build blockers are genuinely closed, but the render rule that consumes them is self-contradictory and the stamping rule is unsatisfiable in the failure case."
---

# Rubric review — revision 9

## 0. Verdict

**Accept with required fixes.** Revision 9 does the substantive job it set out to do: the two fields the UX run found missing (`acceptedTier`, `lastSearchId`/`lastSearchLeague`) now have a declared home, a declared owner, a declared stamping moment, and explicit exclusion from the canonical key. The placement argument for `lastSearchId` (attempt-scoped, therefore beside `lastAttemptedAt`, not on `PriceObservation`) is correct and is the single most valuable thing in this revision. The revision holds its stated envelope: no ninth artifact, no new ranking term, no contract reissue, 29 ADs, `WEIGHTS-FILE-SCHEMA.md` at 4.1.0.

What it does not do is carry the new fields all the way to enforceability. Three of the six amendments introduce a rule a builder cannot execute as written — AD-24's render rule contradicts itself within four sentences, AD-16's stamping rule demands an identifier that does not exist on the path it names, and AD-10's new cut-off is declared by nobody. Each is cheap to fix in prose and expensive to discover in `contracts` or in `web`.

## 1. Checklist pass

| Criterion | Result |
| --- | --- |
| Fixes the real divergence points for the level below | **Mostly.** Two contract-level divergences (field placement, key membership) are closed decisively. Three new divergence points are opened — F1, F2, F3 below. |
| Every AD's Rule is enforceable and prevents its stated divergence | **No.** AD-24's render rule (F1), AD-16's stamping rule (F2) and AD-10's cut-off (F3) are each unexecutable or undecidable as written. |
| Nothing under Deferred could let two units diverge | **Pass.** Revision 9 adds no Deferred item. One process gap (F8) — the icon ruling has a future-revisit condition stated inside AD-24 but no Deferred entry, unlike every other revisit condition in this document. |
| Named tech is verified-current | **Pass, untouched.** Revision 9 changes no Stack row and no version. The TS 7 blocker table still carries its 2026-09-12 verification date. No new library is implied by either field — a `target="_blank"` anchor needs nothing. |
| Covers the driving input's capabilities | **Pass.** All six in-scope items of `docs/sprint-change-proposal-2026-09-13.md` (§4.2 A1–A8) are applied, and applied in the approved form, including the two approval-record decisions (key exclusion, dataset-entry placement). The nine deferred items of §6 are correctly untouched. See §3. |
| Every dimension the altitude owns is decided, deferred or an open question | **Mostly.** The operational/environmental envelope is intact and unaffected by rev 9 — *Deployment & environments* still covers the single environment, the Actions/Pages path, the absence of staging and secrets, and the two patch-cadence maintenance dependencies. Two smaller dimensions went silent as a side effect of A4 and A5: what `web` may persist in browser storage (F7), and what `web` now does with `catalogue/static.json` (F4). |

## 2. Findings

### F1 — HIGH — AD-24's link render rule is stated as a biconditional and then violated by a third condition

AD-24 now reads:

> `web` renders the link for a tracked entry **if and only if** the entry's `lastSearchId` is present (AD-9) **and** its `lastSearchLeague` equals the active league (AD-19). […] A `pruned` entry never carries the link (AD-23).

These two sentences cannot both hold. A `pruned` entry is a tombstone: AD-23 removes it from `sync`'s workload and from AD-17's sum, but it keeps whatever the last run wrote. A recently pruned entry therefore carries a present `lastSearchId` whose `lastSearchLeague` equals the active league — it satisfies the biconditional exactly, and the very next sentence says it must not render.

This is the precise failure mode the spine elsewhere legislates against: two builders reading one rule and shipping two behaviours, with no artifact becoming invalid either way. One builder implements the `iff` literally and links pruned rows; the other reads the trailing sentence as a third conjunct. Nothing downstream fails; the rows simply differ.

The rule is also the one place in the document where a stated *iff* is followed by an exception, which is a shape the rest of the spine avoids on purpose (compare AD-17's overlap predicate, written as a total function precisely because "an enumerated list of shapes has twice been found to miss a case").

**Fix:** make the condition one predicate with three conjuncts — `status != pruned` **and** `lastSearchId` present **and** `lastSearchLeague == activeLeague` — and keep the per-conjunct rationale beneath it. The PRD's P6d has the same defect and needs the same fix, since it is the text `web` will be built from.

### F2 — HIGH — AD-16 requires `sync` to record a search identifier on a failed search, where no identifier exists

AD-16's new paragraph:

> The identifier is recorded for every search `sync` issues, whatever the search returns — a full result set, an empty one, **or a failure** — because the value of the identifier to the player does not depend on the outcome.

An empty result set is fine: the `trade2` search endpoint returns an id alongside `total: 0`, so an id exists. A **failure** is different. A 429, a 5xx, a timeout or a transport error returns no body and therefore no identifier. The rule instructs `sync` to record a value that the failure path cannot produce.

This collides with AD-9's companion clause in the same revision — "`sync` stamps all three together, under one rule" — and with the PRD's stronger spelling, "**The three fields are stamped together, or not at all**". Under a failure, `lastAttemptedAt` must be stamped (a request *was* issued, and AD-26 row 2's rotation key depends on it, and AD-26 row 3's 24h retry bound is measured from it), while `lastSearchId` cannot be. So either the three are not stamped together, or a failed attempt goes unstamped and AD-26's rotation re-selects it every chunk — which is the exact starvation AD-26 row 3 exists to stop. Neither reading is written down, and a builder must invent one.

There is a second-order consequence worth naming: if a failure leaves a *stale* `lastSearchId` in place while `lastAttemptedAt` moves forward, then AD-24's link points at a search older than the age the row displays — which quietly falsifies the proposal's own closure of review finding T4 ("an identifier is exactly as old as the attempt that produced it").

**Fix:** state the three-way split explicitly in AD-16: a search that returns a response (any result count) stamps all three; a search that fails to return a response stamps `lastAttemptedAt` and **clears** `lastSearchId`/`lastSearchLeague` (so the link disappears rather than aging invisibly); offline work stamps none. AD-8's 429/`Retry-After` yield path should be named as the main instance of the middle case.

### F3 — MEDIUM-HIGH — AD-10's "declared freshness cut-off" is declared by nobody, and the only candidate home is expressly closed

AD-10 now hangs its whole per-row obligation on a threshold:

> A row **at or beyond a declared freshness cut-off** is marked on every surface it appears on […] A row younger than the cut-off may show no age on a collapsed listing.

The spine never says who declares it, where it lives, or what it is. The obvious home is `data/config.json`, and AD-19 forecloses it in untouched text: *"`data/config.json` also carries AD-26's `minChunkSearches`, **and nothing else**, because `data/config.json` is a player-owned file rather than a settings bag."* The other candidates are equally closed: `contracts` defines schemas, not policy constants; AD-1 bars `core` from reading config; AD-24 does not add a ninth artifact.

The PRD (P2) fixes the number at 48 hours against the ~15-hour refresh cycle. The spine does not carry the number, and does not carry a pointer to it either. The result is a dimension the altitude owns — the value that decides whether any given row is marked — left neither decided, deferred, nor raised as an open question. Two `web` builders will pick different constants, or one will make it configurable and reopen AD-19.

Note that this is not merely a missing number. The word *declared* is doing load-bearing work in the new sentence and is undefined; if the cut-off is a `web` constant, AD-10 should say so and say that it is the only such constant, because the spine's convention everywhere else is that a number a player can feel is either config or is argued for in place (compare `minChunkSearches`, which gets a whole subsection explaining who declares it and against what).

**Fix:** name the owner in AD-10 — either "a constant in `web`, currently 48 hours, chosen against AD-7's refresh cycle (PRD FR-12)", or an amendment to AD-19 admitting a third `config.json` field. The former is cheaper and matches the fact that the cut-off affects no persisted data.

### F4 — MEDIUM — AD-24 removed `catalogue/static.json`'s only stated consumer and replaced it with a claim AD-25's own table contradicts

Before rev 9, `static.json` earned its place in the eight-artifact fetch set because `web` rendered currency icons from it. Rev 9 deletes that use ("v1 denominates currency as text and defines no icon") and re-justifies the fetch as:

> `catalogue/static.json` is fetched for **the stat-text path** and for **currency id validation**.

Both halves are doubtful against untouched text:

- **Stat text** comes from `stats.json`, which AD-25's table describes as "stat ids + display text → `statId` validation (AD-6), **modifier text in `web`**". `static.json`'s own row says it carries "currency ids + icons". AD-25's table and AD-24's new sentence now disagree about which file the stat-text path reads. A6 propagated the same phrase into the table's *Consumed for* column ("stat-text path in `web`"), so the row now contradicts its own *Carries* column.
- **Currency id validation** in `web` has nothing to validate. `data/currencies.json` is deliberately outside AD-24's fetch set (AD-21: read by "`sync` **only**"), and `web` renders prices already normalised to divine by `sync` (AD-20). There is no list of currency ids on the read side to check.

So an artifact in a closed, eight-member set now has no demonstrated consumer, and AD-24 continues to call the two catalogue files jointly responsible for "render[ing] a stat id as its human text". Either `static.json` has a real use in `web` that should be named exactly, or the honest outcome is that v1's fetch set is seven and the icons return with the multi-denomination view. The spine should not keep a fetched artifact alive on a rationale its own catalogue table refutes — that is how a future reader concludes the set is decorative and adds a ninth.

**Fix:** state `static.json`'s actual v1 consumer in one clause, or drop it from the fetch set and record the restoration under Deferred with the multi-denomination revisit condition. If it is kept for currency *display names* (plausible — AD-20 leaves one denomination on screen and something must spell "divine"), say that; it is a defensible reason and it is currently unwritten.

### F5 — MEDIUM — `acceptedTier`'s shape is under-specified for `contracts`: valueless references, optionality, and type

AD-5 says "A present modifier reference carries a declared, display-only `acceptedTier` label **beside its band**". A `valueless` reference has no band — AD-5 spends a paragraph insisting it is *not* a degenerate band. Does a valueless reference carry the label? The ER-diagram note answers yes by implication ("`ModifierRef` is a bounded band **or a valueless stat reference** (AD-5), carrying a declared, display-only `acceptedTier` label"), while AD-5's own wording answers no. A `contracts` author must choose, and the discriminated union makes the choice structural rather than cosmetic.

Two smaller gaps ride along:

- **Required or optional.** AD-5 says a present reference *carries* the label (reads as required) and then says "A missing label is a curation gap that `web` renders as a marked fallback, and never a load error" (reads as optional). The sprint proposal's dev routing says "optional". If a `contracts` author reads the first sentence and makes it required, the fallback path AD-5 mandates becomes unreachable and an unlabelled `tracked.json` fails to load — the exact outcome the paragraph forbids.
- **Type.** The spine never says the field is a string. The PRD does (§11: "a display-only string with no defined grammar beyond the tier-prefix convention"). Since AD-22 puts every cross-boundary concept's single schema in `contracts`, and `ModifierRef` is on that list, the spine is where a builder will look.

**Fix:** one sentence in AD-5 — "an optional opaque string on a reference of either kind; a `valueless` reference may carry one too, since a tier is a property of the modifier rather than of the band."

### F6 — MEDIUM — AD-9 now imposes a stamping obligation on `sync`, and `sync` is not in AD-9's `Binds`

AD-9's `Binds` remains `contracts`, `core`, `web`. Its new paragraph says "**`sync` stamps all three together**, under one rule", and AD-16's new paragraph is the mirror image of that obligation. This document has twice treated exactly this condition as a defect worth a revision: revision 5 added `sync` to AD-28's `Binds` "which AD-28's band-unit clause was already constraining", and revision 7 added `sync` to AD-18's. The same reasoning applies verbatim here, and rev 9 did not apply it.

This matters more than bookkeeping, because `Binds` is what an agent working a single package reads to decide which ADs govern its worktree. A `sync` builder filtering on `Binds` will not see AD-9 at all, and AD-9 is where the "offline work stamps none of the three" rule lives — the rule that protects AD-26's entire rotation key.

**Fix:** AD-9 `Binds:` gains `sync`. (AD-15's `Binds` is correctly still `web`; AD-24's is `web`, `core`, and the link rule binds only `web`, so neither needs a change.)

### F7 — LOW-MEDIUM — A4 deleted the only statement of what `web` persists in browser storage, and nothing replaced it

The proposal's A4 removed the clause "…the viewer's own browser storage, **which holds the threshold dial and view preferences**", and the spine now says only "has no write path to anything but the viewer's own browser storage". The sprint proposal acknowledges this as a side effect (§6 item 7) and defers the PRD half.

The consequence in the spine is that no AD now says the threshold survives a reload. AD-17 says "`web` supplies the threshold as a value"; AD-24 says the ranking re-runs on a threshold change; nothing says where the value lives between sessions. That is a small dimension the altitude owns going silent — and it went silent by deletion rather than by decision, which is the worst of the three ways to leave something unstated.

**Fix:** restore a narrowed clause — "browser storage holds the threshold value and nothing else (PRD FR-7, narrowed by the UX run)" — or record the question as deferred with the proposal's item 7.

### F8 — LOW — the icon ruling states a revisit condition but does not appear under Deferred

AD-24 says "The icons remain in the fetched file, so a future multi-denomination view needs no new artifact", which is a revisit condition in everything but name. Every other such condition in this document is an entry under **Deferred** with an explicit **Revisit if**, and that convention is what makes the Deferred section readable as the complete list of known-postponed decisions. A reader auditing Deferred for "what did v1 knowingly not do" will not find the icon.

**Fix:** one Deferred bullet — "**Currency icons.** v1 denominates in one unit, so an icon distinguishes nothing (AD-24). **Revisit if** a view ever shows two denominations; the icons are already in a fetched artifact, so the change is `web`-only."

### F9 — LOW — the trade-site URL template has no owner

AD-24 obliges `web` to render a link and fixes *when*; nothing fixes *what*. Constructing the URL requires the site host, the realm/game segment and the league segment in addition to `lastSearchId`. Two builders will spell it differently, and one may use the *active* league where the other uses `lastSearchLeague` — harmless only because the render rule forces the two equal, which is a coincidence of the current rule rather than a property anyone stated.

There is also a small duplication of league semantics: AD-19 makes `core` the component that compares an observation's league to the active league, and AD-24 now has `web` performing a league comparison of its own. It is not a ranking term, so AD-4 is not violated, but league-id comparison (case, whitespace, exact-match semantics) is now performed in two packages from two code paths.

**Fix:** name the URL shape once in AD-24, or put the template in `contracts` alongside the schema, and say that the league equality test is `core`'s single definition that `web` calls — consistent with how AD-17 and AD-18 handle every other cross-file predicate.

### F10 — LOW — AD-14's description of `dataset.json` still reads as observation-only

AD-14 (untouched): "`dataset.json` contains only the latest observation per tracked entry, and each observation is stamped with the league it was observed in." Rev 9 puts three attempt-scoped fields on the dataset **entry**, for entries in states that have no observation at all. The tension predates rev 9 (`lastAttemptedAt` has the same shape since rev 3) but rev 9 doubles the weight sitting on the distinction, and AD-14 is the AD a builder reads to learn what the file contains.

**Fix:** one clause in AD-14 — "an entry carries its latest observation where one exists, plus the attempt-scoped fields of AD-9 whether or not one exists."

## 3. Input coverage — the sprint change proposal

All eight architecture edits (A1–A8) are present and faithful to the approved text:

| Edit | Applied | Note |
| --- | --- | --- |
| A1 — AD-5 `acceptedTier` | Yes | Both paragraphs, plus the "why it has to be written down" and "three prohibitions" blocks. Under-specified for `contracts` — F5. |
| A2 — AD-9 `lastSearchId`/`lastSearchLeague` | Yes | The forced-placement argument is the strongest passage in the revision. `Binds` not updated — F6. |
| A3 — AD-16 stamping | Yes | Failure case unsatisfiable — F2. |
| A4 — AD-15 outbound link | Yes | The "who acts" distinction and the reverse consequence are both present and correct. Side-effect deletion — F7. |
| A5 — AD-24 no icon + render rule | Yes | Self-contradictory biconditional — F1; `static.json` rationale — F4. |
| A6 — AD-25 table row | Yes | Row now contradicts its own *Carries* column — F4. |
| A7 — AD-10 per-row, not per-surface | Yes | Cut-off has no declarer — F3. |
| A8 — Conventions, two rows | Yes | Both the *Entity keys* exclusion (three elements, not four) and the *Ids* second-opaque-id clause are exactly as approved. Clean. |

Envelope claims verified as true: 29 ADs (AD-1…AD-29, no gaps, no additions); `WEIGHTS-FILE-SCHEMA.md` frontmatter unchanged at 4.1.0 and its `tierLabel` guidance still consistent with AD-5's display-only ruling; AD-24's fetch set still eight; no new ranking term in AD-4/AD-17; the ER-diagram note under *Core entities* updated for both fields as the routing table asked.

The nine §6 deferred items are correctly absent from the spine. Item 7 leaked in as a deletion rather than a decision (F7); the other eight did not leak.

## 4. What the revision gets right, and should not be lost in a rewrite

- **The placement argument for `lastSearchId`.** "A `PriceObservation` exists only where there is an observation, so `no-listings` and `unresolvable` entries have none — and those are two of the three states that need the identifier most." This is the reasoning that stops a builder putting the field where it obviously belongs and discovering the hole in `web`. It is stated once in AD-9 and once in the ER note, which is the right amount.
- **The key exclusions.** Saying "an affix still encodes as **exactly three elements**" rather than merely "the label is not in the key" is what stops a `contracts` author adding a fourth element to the encoder. The same sentence pattern for `lastSearchId`/`lastSearchLeague` is equally load-bearing.
- **The "who acts" boundary in AD-15**, and especially its reverse ("because `web` may not make the call, `web` cannot mint a trade-site search itself"). That second half is what makes the persisted field a necessity rather than a convenience, and it is the reason a future reader will not try to optimise the field away.
- **Refusing to derive the tier.** The three-way elimination — trade API has none, band cannot (53/63 classes), `tierLabel` sits on a cell a band may span — is exactly the shape of argument this document uses well, and it forecloses the two shortcuts a builder would otherwise take.
- **AD-10's narrowing is correctly narrow.** It concedes the collapsed-row suppression while keeping the thing the rule existed for ("a stale row is never silent"), and it explicitly re-forbids the dataset-level-timestamp fallback that the concession might otherwise license.

## 5. Recommended disposition

Revision 9 should not be reopened as a design question — the six rulings are right. It should take a **revision 9.1 / errata pass** covering F1, F2 and F3 (all three are unexecutable-as-written and all three land in the packages that build first), F5 and F6 (both land in `contracts`, which lands alone and first), and F4 (which decides whether the fetch set is eight or seven). F7–F10 can ride the next revision that opens for another reason.

None of the findings requires a contract reissue, a new AD, or a change to the driving proposal's approved decisions.
