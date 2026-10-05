---
stepsCompleted: ['step-01-validate-prerequisites', 'step-02-design-epics', 'step-03-create-stories', 'step-04-final-validation']
storiesWrittenForEpics: [1, 2, 3]
storiesPendingForEpics: []
blockedStories: []
revisionPass: 'Targeted revision 2026-09-27 of Story 3.6 and the weights-contract citations for spine revision 23 (AD-10 folds Provenance per (itemClass, recipe) pair; contract 6.1.0) and PRD revision 23. Before it, targeted revision 2026-09-27 of Epic 2 and Stories 2.7 and 2.8 (epic 2 retro item 19) for the committed weights.json 6.0.0 with recipes.json published with no recipe, which the masthead dek explains. The last full pass was the re-run of 2026-09-20 against PRD revision 19, EXPERIENCE.md revision 4 and DESIGN.md revision 4.'
inputDocuments:
  - docs/prds/prd-poe-crafting-base-price-checker-2026-09-12/prd.md
  - docs/architecture/architecture-poe-crafting-base-price-checker-2026-09-12/ARCHITECTURE-SPINE.md
  - docs/ux-designs/ux-poe-crafting-base-price-checker-2026-09-13/DESIGN.md
  - docs/ux-designs/ux-poe-crafting-base-price-checker-2026-09-13/EXPERIENCE.md
---

# PoE2 Crafting Base Price Checker - Epic Breakdown

## Overview

This document holds the complete epic and story breakdown for PoE2 Crafting Base Price Checker. It decomposes the requirements of the PRD, the architecture spine and the UX designs into stories a developer can implement.

**Citation discipline.** Every planning fact has exactly one owning document. This document names each requirement by its stable id. It never restates the owner's text. `prd.md` owns what the player gets. `ARCHITECTURE-SPINE.md` owns the decisions (ADs). `DESIGN.md` owns the tokens and the visual treatment. `EXPERIENCE.md` owns behaviour, states and flows. Under **AD-0**, a companion section that an AD delegates to binds exactly as that AD binds. An acceptance criterion may therefore cite `IMPLEMENTATION-NOTES.md`, `WEIGHTS-FILE-SCHEMA.md` or `AGENT-WORKFLOW.md` by section number. The input list above does not name those three files.

## Requirements Inventory

### Functional Requirements

`prd.md` §4 numbers thirty-three functional requirements globally, contiguous from FR-1 to FR-33. A heading marked *Architecture-owned* keeps its acceptance conditions in the cited AD. The PRD does not hold them.

FR-1: Rank by threshold-truncated expected value (AD-17, AD-4)
FR-2: Render Chase Combinations on each collapsed row (AD-17)
FR-3: Rank Raw Bases on a separate branch, visibly labelled (AD-5, AD-16, AD-17)
FR-4: Render Unrankable Item Classes outside the ordering (AD-17, AD-10, AD-27)
FR-5: Bound the ranked list to a readable length (AD-4)
FR-6: Set the Payout Threshold and reorder the list immediately (AD-17, AD-20, AD-24)
FR-7: Remember the Payout Threshold between visits (AD-15)
FR-8: Expand a ranked row to its full tracked Combination list (AD-9, AD-12, AD-16, AD-17)
FR-9: Render the four Price States distinctly, with a reason on `not-yet-synced` (AD-9, AD-19, AD-20)
FR-10: Propagate and render the weakest Provenance behind every figure (AD-10, AD-11, AD-20)
FR-11: State the uniform-prior caveat globally when the per-row badge cannot discriminate (AD-10)
FR-12: Render per-row freshness, and name the clock it reads (AD-9, AD-10, AD-19)
FR-13: Present estimates as asking prices, never as realised value (AD-12, AD-16)
FR-14: Bound every request to one of three declared sources (AD-12)
FR-15: Honour Curation Status as schema-level behaviour (AD-7, AD-12, AD-17)
FR-16: Reject an overlapping Tracked List at load — *Architecture-owned* (AD-17, `IMPLEMENTATION-NOTES.md` §2.1, §2.2)
FR-17: Refresh the Tracked List in a defined, deterministic rotation — *Architecture-owned* (AD-7)
FR-18: Render the Tracked List's age (AD-12, AD-9)
FR-19: Run as a bounded, resumable, single-instance Chunk runner — *Architecture-owned* (AD-7, §6, §7)
FR-20: Route all outbound trade traffic through one rate-limit-adaptive client — *Architecture-owned* (AD-8, §5.3)
FR-21: Estimate a price from the cheapest live instant-buyout listings — *Architecture-owned* (AD-16, §4.3, §5.2)
FR-22: Declare each entry's Item Level Floor from its Accepted Tier (AD-5, AD-17, §8)
FR-23: Normalise every price to Divine at the sync boundary (AD-20, §4.2)
FR-24: Fail loudly on an unresolvable stat id or Base Type (AD-9, AD-25)
FR-25: Publish a structured Sync Report (AD-7, AD-9, AD-12, AD-17, AD-27)
FR-26: Compute Craft Cost in valuation, from synced rates (AD-3, AD-17, AD-20, §9)
FR-27: Consume a schema-conformant Weights File and never produce one — *Architecture-owned* (AD-11)
FR-28: Enforce the pool-completeness contract in both directions (AD-11, AD-17, AD-10)
FR-29: Derive probabilities from the Weights File scoped to the entry's floor — *Architecture-owned* (AD-17, §1, §2.4, §2.5)
FR-30: Depend on an externally produced Weights File as a v1 prerequisite (AD-11, AD-24, AD-27)
FR-31: Refuse to value an observation from a different league (AD-19, AD-20)
FR-32: Validate the configured league against the live leagues endpoint — *Architecture-owned* (AD-19, AD-12, AD-7)
FR-33: Load published artifacts at runtime as one consistent set (AD-3, AD-15, AD-24, AD-25)

### NonFunctional Requirements

`prd.md` §5 holds ten cross-cutting requirements.

NFR-1: Zero network in the test path. No test at any level makes a real network call. An unfixtured request fails loudly (AD-13)
NFR-2: Fixtures are real captured responses, never hand-written mocks. Re-recording is a separate human-invoked command (AD-13)
NFR-3: Determinism. Valuation is pure. Time, randomness and configuration enter only as passed-in values (AD-1)
NFR-4: Parallel worktree development. Packages own disjoint directories. The dependency graph is one-way, and CI enforces it (AD-1)
NFR-5: One writer per file. No component of the product writes a file another owns (AD-3)
NFR-6: Read-time budget. A full ranking pass completes under 100 ms on a mid-range machine. It re-runs synchronously on a threshold change. The remedy for a miss is memoisation, never precomputation (AD-4, AD-24)
NFR-7: Static delivery, zero upkeep. No server, no secret material, no expiring credential (AD-15)
NFR-8: Schema versioning at every trust boundary. A consumer refuses an unknown major rather than guessing (AD-3)
NFR-9: Third-party citizenship. Requests identify the tool and a contact address. Requests pace from live rate-limit headers and honour `Retry-After` (AD-8)
NFR-10: Accessibility floor. Colour alone never carries a product-meaningful distinction. The three distinctions are Price State (FR-9), crafted versus Raw Base (FR-3) and Provenance (FR-10)

### Additional Requirements

These requirements come from `ARCHITECTURE-SPINE.md`. They shape the epic and story structure. They are not player-observable behaviour.

**Greenfield setup. The spine names no starter template.** The spine's *Structural Seed* declares the stack and the source tree directly. Epic 1 Story 1 therefore scaffolds from the declared versions. It does not scaffold from a generator.

- **Four-package pnpm workspace with a one-way dependency graph**: `contracts` (imports nothing) → `core` → `sync` / `web`. `core` never imports `sync` or `web`. `sync` and `web` never import each other. `dependency-cruiser` fails CI on a violation. Review does not carry that job (AD-1).
- **Pinned stack versions**, from the spine's Stack table: Node 24.21.0, TypeScript 6.0.3, pnpm 12.5.1, React 19.3.0, Vite 8.3.0, Mantine 9.6.1, Zod 4.6.5, Vitest 5.0.1, MSW 2.15.0, ESLint 10.11.0 with typescript-eslint 8.70.0, and dependency-cruiser 18.4.0. Two peer ranges block TypeScript 7. Do not take TypeScript 7 (spine, *Upgrade trigger*).
- **Paradigm: functional core and imperative shell, with ports and adapters.** `contracts` declares every external effect as a port interface. The external effects are HTTP, the filesystem, git and time. Only `sync` or `web` implements a port as an adapter. Every port ships a fake beside the real adapter (AD-1, Consistency Conventions).
- **Eleven Zod schemas live in `contracts`, each defined once.** Every type is `z.infer`red from its schema. The eleven are `BaseType`, `TrackedEntry`, `ItemClass`, `ModifierReference`, `PriceObservation`, `ModifierWeight`, `CraftRecipe`, `CurrencyRate`, `SyncRunReport`, `RankedRow` and `TradeCatalogue` (AD-3).
- **`contracts` lands alone and first.** Dependent work rebases onto it (AD-1, `AGENT-WORKFLOW.md` *Build order*).
- **Two discriminated unions are the shapes most likely to be built wrong.** `ModifierReference` is `banded` or `valueless`. A `banded` reference always carries both edges. A `valueless` reference carries no edges at all. `TrackedEntry` is `crafted` or `raw`. A `crafted` entry keys on `(categoryId, className, itemLevelMin, prefix?, suffix?)`. A `raw` entry keys on `(baseTypeId, itemLevelMin)`. The entry names its own kind. No component infers the kind from what the entry omits (AD-5).
- **Five cross-file checks live in `core` as exported pure functions over both loaded files.** Both shells call them. The five are edge alignment, empty containment set, `coOccur`, kind agreement and class discriminability. `web` reports a failure and still renders. `sync` aborts as a run-start gate, before it spends any budget (AD-17, AD-12).
- **Exactly one governed HTTP client issues every trade request.** Searches, fetches and catalogue refreshes all pass through it. It paces from the live `X-Rate-Limit-*` headers. It hardcodes no rate and names no rule in code (AD-8).
- **The sync CLI performs one bounded chunk and exits.** It runs under an exclusive recoverable on-disk lock. The lock carries a pid and an ISO-8601 start time. It writes progress into a schema-pinned `sync-progress.json`. It computes a deterministic selection order through `core` (AD-7).
- **Three request sources, and a fourth needs an amendment.** The three are `data/tracked.json`, the per-run league validation and the explicit catalogue refresh. `sync` reads `data/currencies.json` and never fetches against it (AD-12).
- **One writer per file**, per AD-3's table. The player owns `tracked.json`, `config.json`, `currencies.json` and `recipes.json`. The external producer owns `weights.json`. `sync` owns `catalogue/*.json`, `dataset.json`, `sync-report.json` and `sync-progress.json`.
- **`sync` makes no git write.** It writes the files it owns by explicit path and exits. Those files are git-tracked and updated in place. The player commits and pushes them, and that push is what deploys. The git port is read-only and carries one operation: the author date of the last commit touching a path (AD-3, AD-12).
- **The trade catalogue is four committed artifacts under `data/catalogue/`.** An explicit command refreshes them at GGG patch cadence. That command never runs on the chunk path. The catalogue is an identity and validation authority only. It contributes nothing to the Eligible Pool (AD-25).
- **`web` fetches exactly seven artifacts at runtime.** Each one is a separate `no-cache` request with no query token. None is bundled into the JS. Four are required for a render and three are absent-tolerable. An eighth artifact needs an amendment (AD-24).
- **Currency rates are hand-maintained committed data.** `sync` copies each rate's own `league` and `asOf` through unchanged and must not stamp them. `sync` always writes divine's own rate as exactly `1` (AD-20).
- **Provenance is a three-value total order.** It derives only from the sources AD-10's table names. `"absent"` maps to `uniform-prior`. It never maps to provenance `absent` (AD-10).
- **The Consistency Conventions bind:**
  - Entity keys serialise in field order.
  - Keys compare by UTF-8 code unit, never by locale collation.
  - All persisted data carries ISO-8601 UTC.
  - Band edges are `number` and not `integer`, and compare for exact equality.
  - `sync` rounds every persisted divine value to 4 decimal places, once.
  - Files are UTF-8 without BOM, with LF line endings, stable JSON key order and a trailing newline.
  - `core` returns a typed result and never throws for an expected condition.
- **`sync-report.json` holds two kinds of entry, and `SyncRunReport` types them apart.** A **figure** describes the latest chunk, and the next chunk overwrites it. A **record** survives the chunk that wrote it. The player's edit clears a record. The next run does not (Consistency Conventions, *Logging*).
- **Deployment: one environment.** The syncer runs on the player's machine: the long-running `pnpm sync` session, or `pnpm sync:batch` under a scheduler such as Task Scheduler (AD-7). The syncer writes files and never pushes. **The player's push** triggers a GitHub Actions workflow. That workflow builds the Vite bundle and deploys it to Pages. Branch-published Pages runs Jekyll and cannot build this app. The workflow is therefore required, not optional.
- **Agent loop and definition of done.** The commands are `pnpm install`, `pnpm check`, `pnpm test`, `pnpm dev` and `pnpm sync:dry`. `pnpm check` enforces the package boundaries. `pnpm sync:dry` runs the full pipeline against fixtures and writes nowhere. `fixtures:record` and `catalogue:refresh` are explicit and human-invoked. Neither is ever part of a test run (`AGENT-WORKFLOW.md`).
- **`sync` measures pool coverage before any view work, and measures it again on every weights-file regeneration.** It publishes the figure with its denominator. Where `weights.json` is absent, the measurement does not happen at all and both fields are omitted together. Coverage is undefined there. It is never `0%` (AD-27).

### UX Design Requirements

`DESIGN.md` owns the visual identity and the tokens. `EXPERIENCE.md` owns behaviour, states and flows. Both are at revision 4. Each item below is scoped for a story with testable acceptance criteria.

**Substrate and foundations**

UX-DR1: Mantine v9 theme override layer. The page inherits Mantine's *behaviour*, its layout primitives and its CSS-variable mechanism. The page replaces Mantine's appearance wholesale. The replacement rules are:
  - `theme.lineHeights` and `theme.headings` are replaced, not extended.
  - `theme.primaryColor` points off blue.
  - `defaultRadius` is `0`.
  - Every component that ships a shadow takes `shadow="none"`.
  - Font sizes pass as literal px, so `--mantine-scale`'s rem conversion cannot round the .5px sizes.
  - `Accordion` and `Collapse` lose their chevrons, their control padding and their hover background.

UX-DR2: Colour token set, in two registers. The set is five paper tones, four inks, three structure rules, one decorative sepia and exactly two semantic inks (ochre, rust). Sepia may mark what the operator *chose*. Sepia may never mark what the data *is*. There is no third ink, no success colour and no green.

UX-DR3: Typography token set. Every role declares an explicit `lineHeight`. In-row roles sit at 1.2, display roles are tight, and reading roles sit at 1.5–1.85. **Three** system-resident stacks carry the page: a book serif for content, a system sans for labels, and a mono **verbatim register** for text the page did not write but quoted out of a file. The third is reserved to the two surfaces UX-DR40 names and has no size of its own — it takes the line's. The page downloads no font.

UX-DR4: Every glyph in the vocabulary must be resident in Segoe UI Regular, Semibold **and** Bold. `↗` is the single exception, and it is pinned to `fontWeight: 400`.

UX-DR5: Fixed frame. The frame is 1060px wide, with a `min-height` of 1920px. The width is 1060 and not 1080: the 20px is scrollbar clearance, and it came out of the gutters and never out of a column. The frame is centred with a surround fill. Its edge is a 1px `outline` and not a `border`. There are no breakpoints, no responsive story and no dark mode.

UX-DR6: Overflow contract, **in two clauses**. Revision 4 separated a single sentence into the two rules it always contained, and only the second one moved.
  - **Clause one — budgeted chrome never overruns the frame.** Anything that can appear at rest without a click and is **not a ranked row** is budgeted in pixels against 528px of computed slack. The banner (74px) and the health line (21px) are the two budgeted data-raised exceptions, and both keep their exact force. New resting chrome is admissible only by taking a budget line of its own. This is not a list that grows by precedent.
  - **Clause two — twenty rows is the resting *target*, and it releases into scroll.** The frame is `min-height`, so a data condition that puts more rows on the resting page grows the document and scrolls it, with nothing clipped and the printed order intact. Two conditions do, and both are accepted rather than designed around: the per-branch bound under an uncostable recipe (up to 40 rows, about 560px over) and FR-30's world (about 29 appendix rows, about 638px over).
  - Rows are not chrome and cannot be budgeted, so neither condition is a third exception to clause one. It is not an exception to that clause at all.
  - The document scrolls and the frame does not. Only the sync report panel takes `overflow-y`. Shrinking rows, dropping columns, truncating the appendix and hiding the key block stay forbidden as escape hatches — for a **grown** state exactly as for an expanded one.

**Layout contracts. Each one is a verified sum, and this document reproduces it literally.**

UX-DR7: Ranked-row column budget. Six fixed cells sum to 1012px. Every column's right padding is tokenised, because every one of these columns ellipsises.

UX-DR8: Unrankable appendix column budget. Four cells sum to 970px.

UX-DR9: Combination row column budgets. Line one is five cells and line two is three cells. Each line sums to 966px. The tombstone's line two is one cell at the same sum (DESIGN.md `components.tombstone-band.line2Columns`).

UX-DR10: Masthead control group arithmetic. 216 + 16 + 276 = 508px of controls. That leaves a 480px dek cap, which must still set to two lines.

**Components. Each one has both a visual spec and a behavioural row.**

UX-DR11: `ranked-row`. The row is 28px high, uniformly. The whole row is a toggle target. Three emphasis tiers differ only in weight and in rank-numeral colour. The `openMarker` bleeds into the gutter, so no column moves when a row opens.

UX-DR12: `unit-glyph-class` (`≡`) and `unit-glyph-raw` (`▪`). These two glyphs are the FR-3 non-colour cue. Both sit in one fixed 14px box, so every unit name starts at the same x. A glyph is never omitted, never truncated and never given a semantic ink. They are the page's only wordless glyphs, and they take no key-block entry.

UX-DR13: `raw-base-row`. Three cues carry the row, and none is load-bearing alone: the tint, the italic name and the glyph. A full-width italic note replaces the three chase cells. The row takes its own hover tint, so a hovered raw row still reads as raw.

UX-DR14: `column-header`. Six fixed flex cells carry the header. They are never inline-block spans. They never ellipsise, and they are never trimmed to fit. Columns are not sortable.

UX-DR15: Five trust marks: `prior`, `unknown`, `stale`, `never` and `unresolvable`. Each mark is inline text carrying colour, weight, glyph and word. A mark has no background, no border and no capsule. A mark takes the type size of the line it sits in. A sixth mark needs a decision. A healthy row renders no mark element at all.

UX-DR48: `curation-status-pinned`. The mark is a glyph plus the word `* pinned`. It takes `{colors.ink-tertiary}`, weight `600`, roman, at the type size of the line it sits in. It **leads** `{spacing.col-combination}` on line one of `{components.combination-row}`. The mark is loud rather than tasteful, by decision. The trust strip's third line names no entries, so this mark is what a player scans open expansions for after that line fires. Findability is the requirement. The mark takes no semantic ink and no sepia: `pinned` is neither a degraded figure nor an operator choice. Nothing marks `active`. The per-row width is a build-time verification against the 460px cell. It does not reopen a column sum.

UX-DR16: Four `price-state-glyph` treatments: `●` priced, `○` no-listings, `∆` not-yet-synced and `×` unresolvable. The Price State's name in words always accompanies the glyph.

UX-DR17: `money-slot`. Five phrases name which question is open: *an open question*, *no figure yet*, *not valued*, *unknown*, *not tracked*. A money slot is never `0`, never `0.00%`, never blank and never an em dash. A real figure too small to print at 2dp renders `< 0.01`. That is a quantity and not a money slot.

UX-DR18: `payout-threshold`. The figure itself *is* the input, with no field, no box and no form chrome. The resting rule is dotted sepia. It goes solid on hover, and it takes `rule-strong` while the player edits. The `Divine` suffix sits outside the editable region. The constraints are min 0, max 3, step 0.05, 2dp, and clamped on blur. The control re-ranks on every valid parse, debounced at about 150ms. The track and the marker survive as a **non-interactive** readout.

UX-DR19: `craft-recipe`. This control is the page's second ranking dial. It prints the two options as the single distinguishing word, `greater | perfect`, divided by a pipe and not by the page's middle dot. The inactive word carries the dotted sepia affordance **at rest**. The active word takes a 2px solid rule, so the player cannot read it as the threshold's 1px hover. Only the inactive option is a click target. The switch re-ranks synchronously and is **not** debounced. Open panels stay open.

UX-DR20: Craft Cost line. The page prints it once, inside the recipe panel. It is never a seventh ranked-row column. The figure takes 13px serif, with `Divine / craft` as a quiet unit. An uncostable recipe renders *no figure yet* and never a zero.

UX-DR21: `trust-strip`. The strip carries five plain unconditional facts, with verbatim labels, across two lines. No fact carries a mark, and no fact carries colour. The whole strip is the click target. Data raises a third rust line on exactly two triggers: unresolvable entries exist, or pinned entries starved. Each trigger carries a glyph, a word **and** a count.

UX-DR22: `sync-report-panel`. The panel holds **six groups** in three columns, and it held five until revision 4. It carries one heading per column and never one per group. It opens in place beneath the strip. It is capped at 400px and scrolls inside its own band. It is closed on every load. It renders `sync-report.json` as published, and it computes nothing.

UX-DR49: The cross-file diagnosis is the panel's **sixth group**, and it is the third group of the **second** column, under that column's existing *what is broken* heading, separated from the two groups above it by vertical space alone. `columnHeadingRule` is intact: no second heading, no rule, no bullet. It is neither a global region nor inline on the affected Item Class. It is the only group that is not a figure — one line per failing check, naming the check, the entry and that entry's canonical key — and therefore the only group whose length is unbounded, which is why the panel's own cap and internal scroll are what make it placeable at all. It is never promoted to the trust strip, which keeps exactly two health triggers.

UX-DR50: **Two registers in one panel.** The panel is the one region on the page carrying two registers at once. Every figure group takes the page's voice. The diagnosis alone takes the file's voice, and the back-end-only vocabulary is licensed inside it. The licence is one of **register, not of audience** — there is one user, he wrote the Tracked List and he is the person fixing the file, so audience never discriminated in this product. The cue separating the two registers may not be a semantic ink, and it is **settled**: the diagnosis alone takes the mono verbatim register, the same cue UX-DR40 takes, at the panel's own size and weight.

UX-DR23: `asking-price-line`. The page renders this line in every state. It is never dismissible and never below the fold. It is FR-13's only mitigation for Risk R-1.

UX-DR24: `uniform-prior-banner`. A data condition raises the banner, never a build flag. It carries an ochre left marker. It is dismissible for the session only. It lowers itself the moment any `measured` figure appears.

UX-DR25: `expansion-panel`. The panel opens in place instantly, with no height animation. Many panels may be open at once. The title is the unit name, led by the row's own glyph. The panel repeats the active threshold **and** the active Craft Recipe, plus the asking-price framing.

UX-DR26: `combination-row`. The row is two lines under one hairline. Line one carries the figure. Line two carries the evidence: the note, and **both** labelled ages in their own cells. Line two is always present. Line two wraps rather than truncating, in whole 20px steps, because its `lineHeight` is absolute. A note marks a below-threshold entry. Such an entry is never greyed and never hidden.

UX-DR27: `trade-link`. The `↗` glyph alone is the click target, and it opens in a new tab. The page renders the link where the entry carries a stored `lastSearchId` **and** that search ran in the active league. The test reads the stored field, never the Price State. Otherwise the link is absent: not greyed, not disabled. It never appears inside the tombstone band.

UX-DR28: `tombstone-band`. The band is collapsed behind a `+ N pruned` toggle, local to its own panel. Its line two carries the prune reason alone, in place of the two age cells, and no removal date (EXPERIENCE.md `{components.tombstone-band}`, state 10).

UX-DR29: `unrankable-appendix`. The appendix is pinned to the foot as a decision, not as a coverage band. The count is readable without expanding anything. The rows are not interactive. Every row is an Item Class, and a Base Type never appears. The page prints the reason strings verbatim from FR-4.

UX-DR30: `key-block`. The block is three columns, and one of them is *Silence means healthy*. It is mandatory in every state. It covers the resting page only.

UX-DR31: `expand-affordance`. One `+` / `−` vocabulary governs everything that opens, including the tombstone toggle and the fetch-failure retry. The `−` is U+2212 and not an em dash. The list affordance names no unit. It grows the list in place rather than paging.

UX-DR32: `running-foot`. The foot is the only place where the page says where curation actually happens.

UX-DR33: `refusal-screen` and `fetch-failure-screen`. These are two page-replacing screens with the same shape and different copy. The refusal screen names the artifact, the schema version the artifact declared and the version the page expects. It offers no retry. The fetch-failure screen names which of the seven files did not arrive. It offers `+ Try again`, which re-attempts the whole set. Neither screen serves a partial set.

**Behaviour, content and state**

UX-DR34: `EXPERIENCE.md` *State Patterns* enumerates the states, and each state carries a specified treatment. The enumerated states are:
  - the four Price States, and the three `not-yet-synced` reasons
  - the three Curation Statuses
  - the three Provenance values, plus the Raw Base's absent case
  - the three Unrankable reasons, plus the Base-Types-still-rank case
  - stale, never-attempted and below-threshold
  - cold load, honest-empty and partial refresh
  - nothing-clears, schema-invalid, cross-file failure and fetch failure
  - stale weights
  - the three trust-strip states
  - grown list, recipe switch, uncostable recipe and recipe-scoped unrankability

  State numbers are stable identifiers. Renumbering them is a sweep, not a script.

UX-DR35: The page carries exactly seven interactions, mouse only: set the threshold, switch the recipe, expand a row, toggle the tombstone band, read the remainder, open the sync report, and open a trade search. One banner dismissal sits beside those seven.

UX-DR36: The following are banned everywhere: column sorting, hover-revealed row actions, tooltips, modals, auto-refresh, polling, any animation that attracts attention to a row, any write path from the browser, and per-row clipboard snippets. Mantine's `SegmentedControl`, `Select`, `Radio` and `Switch` are banned for the recipe. Virtualisation and windowing are banned as well.

UX-DR37: Persistence. The Payout Threshold **and** the active Craft Recipe persist in the viewer's own browser storage. Open panels, tombstone toggles, the grown list and the sync report reset on every load. The banner dismissal lasts the session. The test is a value the player deliberately set, against a record of a reading position.

UX-DR38: Domain vocabulary enforcement. The page prints twenty player-facing Glossary terms verbatim. Five further terms have their substance on the page while their name never appears. Four enum sets appear as written, and the page never translates them. Fourteen back-end terms are banned from the page, except inside a validation message. Four specific wordings must not be reintroduced.

UX-DR39: Combination text rule. The page prints the tier plus the canonical short form (`T1 Cold Res · T1 Mana`), and never the value, on **both** surfaces. A hand-maintained short-form table serves a chase-cell budget of about 27 characters. Five coining rules govern that table. Pruning is the escape valve, and a shorter coinage is not.

UX-DR40: The fallback. A modifier missing either its short form (a product gap) or its declared Accepted Tier (a curation gap) falls back to the catalogue stat name plus the value band (EXPERIENCE.md *Domain Vocabulary*). That is the one place in the product where a numeral from modifier text survives. The fallback must be identifiable as a fallback, and it must not borrow a semantic ink. **Its cue is settled and is shared with UX-DR50**: both surfaces print text the page did not write, so both take the **mono verbatim register** — a third type stack reserved to that one meaning. It is not an ink, not a mark and not a glyph, it has no size of its own and takes the line's, and it reopens no column budget. One cue, answered once, as the merged question required.

UX-DR41: Money display precision. EV, price and threshold take 2 decimal places. `core` persists 4dp, and the page never re-rounds what it passes on. A column header states the unit once, and no row repeats it.

UX-DR42: Honest-empty league-reset presentation. The page renders every tracked unit in canonical order with its glyph. It **suppresses** the rank numerals. It states that the order is canonical and not ranked. Every EV cell holds *no figure yet*, and never a blank or a zero.

UX-DR51: Nothing-clears-the-threshold presentation (state 25). The copy is `EXPERIENCE.md`'s, ruled at revision 4 — the PRD's silence on it was never ownership. The state is **not an empty list**: every crafted Item Class is still ranked, at an EV of minus its Craft Cost, so the crafted branch is twenty rows carrying the same figure, while Raw Bases under the threshold leave the ranking altogether and the raw branch may be empty beside a full crafted one. **Rank numerals stay.** The order here is computed and the figures merely tie, unlike the honest-empty state whose order is canonical rather than ranked, and hiding a computed result because it is flat would be the page editing its own answer. A **plain declarative** sits above the list, under the asking-price line, naming the live Payout Threshold figure at the page's 2dp — the condition, and **no instruction**, because the player set that number deliberately and the remedy is already on screen 16px away. It is not the uniform-prior banner, which a data condition raises and this is not one. It is not a money-slot phrase either, because no figure is missing.

UX-DR52: Uncostable-recipe presentation (state 35). **Every row stays.** No row leaves the list, and no Item Class becomes Unrankable — FR-4's reason enum is **not** extended, because such a class's pool is complete, published and agreeing, so all three of its strings are false of it. The class is unpriced, not unrankable. **Each branch keeps its own order, and neither is ordered against the other**, because Craft Cost is one figure subtracted equally from every crafted row and the threshold compares a Combination's gross price; what is unavailable is only the *distance* between a crafted row and a Raw Base row. **No rank numeral spans the two**: numerals are suppressed, for the same reason the honest-empty state suppresses them. The three emphasis tiers run **per branch**, so two tier-1 rows is the correct render and is the only thing left marking the strong end of each order. Every crafted EV cell holds the money-slot phrase *no figure yet*, and never `0.00`. A plain declarative sits above the list in UX-DR51's register, naming the active recipe and stating that the two branches are not comparable while it holds. **FR-5's bound applies per branch** — 20 rows of each, one expand affordance under each, neither naming a unit — so the resting page can hold 40 rows and scroll, which UX-DR6's clause two accepts. This is a routine state on the costlier recipe, not a defensive one.

UX-DR53: FR-30's no-weights-file world needs **no treatment of its own**. Until a conforming Weights File exists, every Item Class is Unrankable and the page is a white-base price list with an appendix holding the crafted branch entire — about 29 rows against a committed budget of 7. The three rules read as colliding there do not: the footer pin and the no-truncation rule are mechanism and hold, and the third was the sentence UX-DR6 has now split. So the behaviour is the ordinary behaviour — the appendix sits at the foot, holds every row untruncated, and the document grows and scrolls beneath it. This closes **by ruling**. The earlier acceptance of designing it at implementation time is **discharged, not still standing**, and no story may re-defer it.

UX-DR43: Cold load. The masthead and twenty row slots render immediately in the final layout. The artifacts AD-24 names resolve in a **single transition**, never row by row. A partly filled list would render a ranking computed from an incomplete dataset.

UX-DR44: Hover and active states, tabulated per target. Nothing lifts, glows or rounds. Any colour change is instantaneous or a fast linear step. A 28px row takes no fade. A non-interactive surface takes no hover response.

UX-DR45: Accessibility floor, deliberately thin. The floor states no WCAG level, no contrast claim, no screen-reader behaviour, no keyboard path, no focus-visible styling and no reduced-motion handling. What binds instead is NFR-10 reframed as legibility: the page must still read with every colour removed, and it renders text rather than raw ids.

UX-DR46: Voice and tone. Eight paired do and don't microcopy rules govern the copy. The copy uses plain declaratives. It carries no exclamation, no encouragement and no celebration of a good number.

UX-DR47: Six PRD journeys, UJ-1 to UJ-6. Each journey has a Key Flow with numbered steps and a climax beat. Two journeys carry failure paths. The design supports UJ-5 in part: the *review* is fully on the page, and the *edit* happens in a text editor and in git.

**Two requirements discharged distributively, by design**

UX-DR34 and UX-DR47 are inventories rather than units of work, and no single story owns either one. This breakdown discharges UX-DR34's state table state by state. The acceptance criteria of the story that renders a state cite that state's number. Those numbers are stable identifiers, renumbered only by a sweep, and they are what tie the two documents together. UX-DR47's six journeys are compositions of capabilities the FRs already own. Each journey's steps therefore land in the stories that cover its FRs. UJ-5 is the only journey carrying a design-level limit. Its boundary is *review here, edit in a text editor and git*, and Story 2.7's running-foot criterion holds it.

The consequence is deliberate, and this document records it rather than leaving it to be discovered. **No story asserts an end-to-end journey.** Nothing in this breakdown verifies UJ-1 to UJ-6 as flows rather than as parts. That verification belongs to acceptance testing against `EXPERIENCE.md`'s Key Flows. It does not belong to a story here. A story that owned a whole journey would restate criteria that three other stories already hold.

**Known UX gaps — carried, not invented**

**Two** gaps in the state table carry the tag `[NOTE FOR UX]`, and they are unresolved by decision. A story that touches one must surface it rather than settle it silently. The two gaps are:
  - The skeleton's own appearance (state 22).
  - The reason string a recipe-scoped Unrankable would need (state 36). That enum is the PRD's to extend, not UX's, and it stays declined: no base is tracked below item level 70, so the case is defensive rather than live.

**It was six, then five, and revision 4 closed three at once.** The nothing-clears copy (state 25) is ruled and UX-DR51 holds it. What crafted rows do under an uncostable recipe (state 35) is ruled, with PRD revision 19 carrying the player-visible half and UX-DR52 the rest. Where the cross-file report lands (state 27) is ruled, and UX-DR49 holds it. The sixth closed earlier, when the `pinned` mark settled: state 9 carries `{components.curation-status-pinned}` and no note, UX-DR48 holds the treatment, and Story 2.5 builds it.

Two gaps sit outside the state table.
  - Whether `† pruned` and `* pinned` belong in `{components.key-block}`, whose contract is to list every mark that can appear (Story 2.5). The mark's own appearance is settled; only its key-block membership is open.
  - Two Combinations that read identically on the page. The hazard survived the mechanism that produced it: the page prints the curator's declared Accepted Tier, and nothing stops two tracked bands on one Item Class declaring the same one.

**The one non-colour cue is no longer a gap either.** It closed on 2026-09-20 and UX-DR40 holds it, with UX-DR50 citing the same cue: both surfaces print text the page did not write, and both take the mono verbatim register. It closed as **one** answer, which is what the merge was protecting. A story that touches either surface now cites UX-DR40 and does not re-raise the question.

**FR-30's world is no longer a gap.** It closed by ruling, not by deferral, and UX-DR53 holds it. The earlier acceptance of designing it at implementation time is discharged, so no story may re-defer it. One further gap outside the state table is also **closed**: no Item Class name needs a display mapping. The only transform is the underscore-to-space trim that AD-5 already owns, applied at render time, with the identity left verbatim (AD-5, Story 2.3).

### Extraction Findings

All four findings closed on 2026-09-20 and the owning documents carry those rulings. No finding is open. Ids are stable and are never reused, so each finding keeps its line.

**D-1 — CLOSED 2026-09-20.** There was never a real disagreement. Currency rates became hand-maintained committed data at spine revision 14, and FR-14 carried a stale numeral. FR-14 now reads *one of three declared sources*, which matches AD-12. Cite AD-12.

**D-2 — CLOSED 2026-09-20.** The count was the shallow half of this finding. State 27's *"four checks, not five"* was a correction aimed at the retired straddle rule. Class discriminability arrived later and landed in the slot that sentence had emptied, so the sentence read as a rejection of a binding check. State 27 now enumerates five checks, and the defence is struck. The real payload was FR-4's reason enum. A class that fails any of the five has a `complete`, published pool, so neither existing string was true of it. FR-4 now carries a third string. Cite AD-17.

**D-4 — CLOSED 2026-09-20.** `EXPERIENCE.md` carried *a declared tiebreak for equal EV* on its unresolved list as `core`'s and unanswered, on the ground that state 25 ties every crafted row at minus its Craft Cost and the rank numerals print over that tie, so an undeclared tiebreak would shift the printed order between loads. **AD-17 already declares it.** The ranked list breaks ties on the row's unit key, then the recipe id; the comparison is against the serialised canonical key of AD-5's arm rather than a bare string; and a raw row, having no recipe id, sorts before a crafted row at an equal EV, which makes the ordering total across the mixed list. Under that rule a twenty-way tie on one figure is fully determined and stable across loads, because unit keys are distinct. **The gap is therefore a citation gap and not a missing decision.** Two consequences: `IMPLEMENTATION-NOTES.md` does not own this rule and none of its sections state it, so an acceptance criterion cites AD-17 directly; and `EXPERIENCE.md`'s entry closes against AD-17 rather than waiting on a fresh ruling. UX made that edit on 2026-09-20: the unresolved bullet is gone, state 25 cites AD-17, and the closure is recorded under *Closed against the architecture*. Cite AD-17. No story invents a tiebreak of its own.

**D-3 — CLOSED 2026-09-20.** The recipe axis is settled, and AD-17 now carries the ruling. `core` ranks every `(Item Class, recipe)` pair inside one ordering, which is what gives the recipe-id tie-break work to do. `web` renders only the rows whose recipe is the active one, so a crafted class appears on the page exactly once. The cross product is an ordering-internal fact and is never player-observable. The list does not double, the Craft Recipe control is a filter, and no row names its recipe. AD-4 carries the read-time consequence. Cite AD-17.

### FR Coverage Map

Every FR maps to exactly one owning epic. Where a second epic touches an FR, that touch is a story inside the second epic. The FR's acceptance still belongs to the owner named here.

Four touches are recorded rather than left to be discovered. Epic 2 builds `{components.unrankable-appendix}`'s structure under **FR-4**, because FR-30's world is Epic 2's own shipped state and UX-DR53 now specifies its treatment. Epic 3 applies **FR-5**'s bound per branch under an uncostable recipe, and adds a sixth group to the sync report panel Epic 2 built. Epic 3 also owns the crafted half of state 25, whose copy Epic 2 writes.

FR-1: Epic 3 — the ranking figure itself, EV under the active recipe and threshold
FR-2: Epic 3 — Chase Combinations on each collapsed crafted row
FR-3: Epic 2 — the raw branch, and the unit glyph that labels every row's unit
FR-4: Epic 3 — the Unrankable group, its reasons and its count. Epic 2 builds the appendix's structure and its one day-one reason
FR-5: Epic 2 — the top-20 bound and the expand affordance. Epic 3 applies it per branch under an uncostable recipe
FR-6: Epic 2 — the Payout Threshold control and the immediate re-rank
FR-7: Epic 2 — threshold persistence in browser storage
FR-8: Epic 2 — row expansion to the full tracked Combination list, tombstones included
FR-9: Epic 2 — the four Price States rendered distinctly, with reasons
FR-10: Epic 3 — Provenance propagation and its per-row mark
FR-11: Epic 3 — the global uniform-prior banner
FR-12: Epic 2 — per-row freshness, with the clock named
FR-13: Epic 2 — the asking-price framing, R-1's only mitigation
FR-14: Epic 1 — the declared request sources and per-source accounting
FR-15: Epic 1 — Curation Status as schema-level behaviour in the workload
FR-16: Epic 3 — overlap rejection, because the EV sum is over a partition
FR-17: Epic 1 — the deterministic Refresh Rotation
FR-18: Epic 2 — the Tracked List's age, rendered unconditionally
FR-19: Epic 1 — the bounded, resumable, single-instance Chunk runner
FR-20: Epic 1 — the one rate-limit-adaptive trade client
FR-21: Epic 1 — price estimation from the cheapest instant-buyout listings
FR-22: Epic 3 — the Item Level Floor derived from the Accepted Tier
FR-23: Epic 1 — Divine normalisation at the sync boundary
FR-24: Epic 1 — unresolvable ids detected against the catalogue and reported
FR-25: Epic 1 — the structured Sync Report
FR-26: Epic 3 — Craft Cost and the Craft Recipe control
FR-27: Epic 3 — consuming a schema-conformant Weights File
FR-28: Epic 3 — the pool-completeness contract, both halves
FR-29: Epic 3 — probabilities scoped to the entry's floor
FR-30: Epic 3 — the external Weights File as a v1 prerequisite. Its no-weights-file world is Epic 2's shipped state, and Epic 2 renders it
FR-31: Epic 2 — refusing to value an observation from another league
FR-32: Epic 1 — validating the configured league before the run spends budget
FR-33: Epic 2 — runtime artifact loading as one consistent set

## Epic List

### Epic 1: Foundations and the Background Sync

The player installs one scheduled command. That command keeps a git-tracked, league-correct price dataset up to date on its own. The player publishes it when he chooses. It paces itself, so the product never loses the API access it depends on. It resumes where it left off. It publishes a Sync Report that says what the run did and what broke. Nothing in this epic reads the Weights File. The epic therefore delivers in full, before the external dependency of §7.3 arrives.

**FRs covered:** FR-14, FR-15, FR-17, FR-19, FR-20, FR-21, FR-23, FR-24, FR-25, FR-32

**Also delivers:**
  - the four-package pnpm workspace on the spine's pinned stack
  - all eleven `contracts` Zod schemas, with their ports and fakes, landed alone and first
  - `dependency-cruiser` enforcing AD-1's one-way graph in CI
  - the zero-network test path under MSW `onUnhandledRequest: "error"`
  - `pnpm check`, `pnpm test` and `pnpm sync:dry`
  - the explicit human-invoked `fixtures:record` and `catalogue:refresh` commands

**NFRs addressed:** NFR-1, NFR-2, NFR-3, NFR-4, NFR-5, NFR-8, NFR-9

**Standalone:** yes. The dataset and the Sync Report are real artifacts. A developer runs both entirely offline against fixtures, before any page exists.

### Epic 2: Day One — the Deployed Raw Base Price List

The player opens a page on the second monitor before a session. The page renders an ordered list of the Base Types worth picking up to sell raw, under a Payout Threshold the player sets. Each row states how old its price is and what state it is in. The player can expand any row and read the evidence behind it. Across a league reset the list goes honestly empty, and it does not serve last league's numbers. This is the day-one phase AD-24 declares, deployed to Pages.

**FRs covered:** FR-3, FR-5, FR-6, FR-7, FR-8, FR-9, FR-12, FR-13, FR-18, FR-31, FR-33

**Also delivers:**
  - the Mantine v9 override layer
  - the colour, typography and spacing token sets
  - the fixed 1060x1920 frame, and every verified column sum
  - the trust strip with its health line, and the sync report panel's **five** figure groups
  - the expansion panel, the two-line combination row, the tombstone band and the trade link
  - `{components.unrankable-appendix}`'s structure, holding every crafted Item Class under FR-4's day-one reason
  - both page-replacing failure screens
  - the key block and the running foot
  - the GitHub Actions build-and-deploy workflow

**NFRs addressed:** NFR-6, NFR-7, NFR-10

**Standalone:** yes. This is a complete and useful product that never reads `weights.json`. Crafted Item Classes are Unrankable for a reason the page states, exactly as AD-24 and AD-27 require — and that is FR-30's world, which UX-DR53 now specifies rather than defers. **Epic 2 therefore builds the appendix itself**, at UX-DR8's four-cell 970px budget, pinned to the foot, its count readable without expanding anything, its rows non-interactive, holding on the order of 29 rows untruncated while the document scrolls beneath it. Where `weights.json` is absent, every row there carries FR-4's second string, `class absent from weights file`, because in that world the string is true of every crafted class. FR-4's acceptance still belongs to Epic 3, which adds the other two strings and the Provenance `absent` case to an appendix that already exists.

**Two day-one worlds, and the committed data sits in the second.** The Epic was written against an absent `weights.json`, but a 6.1.0 file is committed, and `data/recipes.json` is committed with an empty recipe list (Story 2.7 Decisions). Epic 2 builds no weights-fed valuation, so the page does not read the file's `bases` and cannot say which classes it publishes. On the committed data no `(itemClass, recipe)` pair exists, the crafted branch is empty, and raw bases rank. No absence line prints, because every file is published. The masthead dek says why no crafted Item Class is ranked (EXPERIENCE.md, *The Epic 2 masthead dek* and state 37). An absent `recipes.json` gives the same empty crafted branch, and there Story 2.1's absence line names why. In both the committed and the absent-recipes worlds, no class is Unrankable in FR-4's sense, so the appendix is empty. The absent-weights world stays a real, tested state, because the file is absent-tolerable and a player can remove it. Stories 2.6 to 2.8 state both.

### Epic 3: The Crafted Ranking, on a Real Weights File

The player reads Item Classes ranked by threshold-truncated expected value, under a Craft Recipe the player chooses, beside the raw rows in one mixed list. Each crafted row carries the Combinations worth chasing on it, and the Craft Cost the player pays on every attempt including the failures. The player can tell a figure resting on measured weights from a figure resting on an invented prior. The classes the tool cannot rank honestly sit outside the ordering, with their reason. This is the product's central bet: the ranking is not "most expensive base".

**FRs covered:** FR-1, FR-2, FR-4, FR-10, FR-11, FR-16, FR-22, FR-26, FR-27, FR-28, FR-29, FR-30

**Also delivers:**
  - the five cross-file checks as exported pure functions that both shells call
  - the Craft Recipe control, and the single printing of Craft Cost
  - the chase cells, with their short-form table and coining rules
  - the appendix's remaining two reason strings, its quiet notes and the Provenance `absent` case, added to the structure Epic 2 built
  - the sync report panel's **sixth** group — the cross-file diagnosis, in the file's voice
  - the Provenance marks and the uniform-prior banner
  - the pool-coverage figure, published with its denominator

**NFRs addressed:** NFR-3, NFR-5, NFR-6, NFR-8, NFR-10

**Standalone:** yes. It builds on Epics 1 and 2, and neither of them requires it to function. It adds to two components Epic 2 shipped — the appendix and the sync report panel — rather than replacing either.

**Why this is not folded into Epic 2.** Epics 2 and 3 both extend `core` and `web`. The overlap was examined rather than assumed. Consolidation is rejected for two reasons, and neither is a matter of taste. First, Epic 3 is gated on an artifact this project does not produce. FR-30 makes an externally produced Weights File a v1 prerequisite, so merging the epics would make the whole page wait on a dependency that §7.3 does not control. Second, AD-24 declares the raw-only page a *shipped phase* and not a milestone. Epic 2 deploys to Pages and is read during a real league, so its feedback arrives before anyone designs Epic 3's ranking against it. The split therefore buys a real release and a real feedback loop, and that is what justifies touching the same files twice. The two epics also divide cleanly inside those packages. Epic 2 owns the substrate, the raw branch and every chrome component. Epic 3 adds the weights-fed valuation path beside them, rather than rewriting it.

## Epic 1: Foundations and the Background Sync

The player installs one scheduled command. That command keeps a git-tracked, league-correct price dataset up to date on its own. The player publishes it when he chooses. It paces itself, so the product never loses the API access it depends on. It resumes where it left off. It publishes a Sync Report that says what the run did and what broke. Nothing in this epic reads the Weights File. The epic therefore delivers in full, before the external dependency of §7.3 arrives.

### Story 1.1: The four-package workspace and the offline development loop

As a development agent,
I want a four-package workspace whose boundaries CI enforces and whose test path cannot reach the network,
So that I can run the whole development loop at machine speed without a human unblocking me.

**Acceptance Criteria:**

**Given** a clean checkout
**When** `pnpm install` runs
**Then** it succeeds and reaches the package registry for the declared dependencies. Fetching what the manifest names is not the test path NFR-1 binds
**And** it requires no credentials and no human (`AGENT-WORKFLOW.md`).

**Given** an installed workspace with the network disconnected
**When** a developer runs `pnpm check` and `pnpm test`
**Then** both commands succeed offline
**And** neither requires credentials, a network or a human. This is what lets an agent iterate against a service that would otherwise rate-limit it into uselessness (NFR-1, AD-13, `AGENT-WORKFLOW.md`).

**Given** the four packages `contracts`, `core`, `sync` and `web`
**When** a module in `core` imports from `sync` or `web`, or a module in `sync` imports from `web`
**Then** `dependency-cruiser` fails `pnpm check` and names the offending edge
**And** nobody relies on review to catch it (AD-1, NFR-4).

**Given** `packages/contracts`
**When** a developer inspects its dependency manifest
**Then** the manifest declares no workspace dependency at all (AD-1).

**Given** the spine's Structural Seed Stack table
**When** `pnpm install` installs the dependencies
**Then** every declared version matches that table exactly
**And** TypeScript stays at 6.0.3, because `typescript-eslint` peers `typescript` at `<6.1.0` and `dependency-cruiser` caps `supportedTranspilers.typescript` at `<7.0.0`
**And** nobody uses the `@typescript/typescript6` shim to appear upgraded.

**Given** a test that issues an HTTP request with no matching fixture
**When** the suite runs
**Then** the suite fails that test loudly, naming the request
**And** the request does not escape to the network (NFR-1, AD-13).

**Given** each of the four packages
**When** a developer inspects the workspace
**Then** each package owns a disjoint directory with its own test suite. Two agents working in two packages touch no common file (NFR-4).

### Story 1.2: Contract schemas and ports for the curated workload and the published dataset

As a development agent,
I want every concept that crosses a package boundary to have exactly one Zod schema with its type inferred from it,
So that the producer and the consumer of an artifact cannot drift apart while both stay schema-valid.

**Acceptance Criteria:**

**Given** the `contracts` package
**When** it defines the schemas this epic needs
**Then** `BaseType`, `ItemClass`, `ModifierReference`, `TrackedEntry`, `PriceObservation`, `CurrencyRate`, `TradeCatalogue` and `SyncRunReport` each have exactly one Zod schema, with no parallel definition anywhere
**And** every static type is `z.infer`red from its schema, and no type is declared beside it (AD-3).

**Given** `ModifierReference`
**When** a component constructs a reference
**Then** a `banded` reference requires `statId`, `valueMin` and `valueMax`, and has no open-top form
**And** a `valueless` reference carries `statId` and no edges at all, and never sentinel edges
**And** an exhaustive `switch` over the two kinds type-checks (AD-5).

**Given** `TrackedEntry`
**When** a component parses an entry
**Then** it reads the kind from what the entry names, and never infers the kind from what the entry omits
**And** a `crafted` entry keys on `(categoryId, className, itemLevelMin, prefix?, suffix?)`, with at least one affix present
**And** a `raw` entry keys on `(baseTypeId, itemLevelMin)`, and carries no affix members at all (AD-5).

**Given** a `TrackedEntry`
**When** a component serialises its canonical key
**Then** the fields serialise in the declared order
**And** each affix takes one of three distinguishable forms, so an absent affix and a valueless affix can never collide
**And** the serialisation carries the kind, so the two key spaces cannot collide
**And** keys compare by UTF-8 code unit, and never by locale collation (`IMPLEMENTATION-NOTES.md` §4.1, Consistency Conventions).

**Given** `acceptedTier` on a modifier reference
**When** `contracts` types it
**Then** it is an optional free string on both arms, and the `valueless` arm does not use it
**And** nothing validates it against a band, nothing validates its spelling, and it is never part of a canonical key (AD-5).

**Given** `TrackedEntry.status`
**When** `contracts` defines the schema
**Then** `active`, `pinned` and `pruned` are schema members rather than conventions
**And** a `pruned` entry carries its reason (FR-15, AD-12).

**Given** `CurrencyRate`
**When** `contracts` writes its schema description
**Then** the description states the orientation explicitly: `rate` is divine per one unit of the named currency. `contracts` is built first, by whoever holds neither side of the calculation (AD-20).

**Given** every external effect this epic touches — HTTP, the filesystem, **git (read-only)** and the clock
**When** `contracts` declares that effect
**Then** it declares the effect as a `<Thing>Port` interface
**And** every port ships a fake beside the real adapter (AD-1, Consistency Conventions).

**Given** any artifact or input schema
**When** `contracts` defines it
**Then** the schema carries `schemaVersion`
**And** a consumer refuses an unknown major version rather than guessing (NFR-8).

### Story 1.3: One governed trade client that paces itself from live headers

As the player,
I want every trade request to leave through one client that paces itself from the live rate-limit headers,
So that I never lose the API access the entire tool depends on.

**Acceptance Criteria:**

**Given** the `sync` package
**When** any component issues a trade request — a search, a fetch or a catalogue refresh
**Then** that request passes through exactly one adapter
**And** no other call site in the system issues a trade request (FR-20, AD-8).

**Given** a response carrying `X-Rate-Limit-Rules`
**When** the adapter paces itself
**Then** it learns the active rule names at runtime, and it names no rule in code
**And** it parses the policy header and the `-State` header for each named rule
**And** it distinguishes the search bucket from the fetch bucket by `X-Rate-Limit-Policy`
**And** it paces against the tightest unsatisfied bucket, with no rate hardcoded (`IMPLEMENTATION-NOTES.md` §5.3).

**Given** a `429` carrying `Retry-After`
**When** the adapter receives it
**Then** it honours the header and yields the chunk
**And** it does not retry tightly.

**Given** any outbound request
**When** the adapter issues it
**Then** the request carries a descriptive `User-Agent` naming the tool and a contact address, taken from the small environment overlay `sync` reads
**And** `core` performs no environment lookup for it (NFR-9, Consistency Conventions).

**Given** a test of backoff behaviour
**When** it runs
**Then** it exercises the adapter with supplied header values
**And** it never waits on the wall clock (NFR-3).

**Given** `pnpm fixtures:record`
**When** a human invokes it explicitly
**Then** it writes real captured trade-API payloads under `fixtures/`, with every personal identifier removed at record time
**And** it is never part of a test run
**And** its diff is what makes a change by GGG visible (NFR-2, AD-13).

### Story 1.4: The committed Trade Catalogue and its explicit refresh command

As the player,
I want the trade API's own identifier lists committed to the repository and refreshed only when I ask,
So that a change GGG makes arrives as a diff I can review rather than as a silent change in behaviour.

**Acceptance Criteria:**

**Given** `pnpm catalogue:refresh`
**When** a human invokes it
**Then** the governed client fetches the four trade data endpoints
**And** the command validates the responses and writes `items.json`, `stats.json`, `static.json` and `filters.json` under `data/catalogue/` as sync-owned artifacts (AD-25).

**Given** the refresh command
**When** a chunk runs, or the view loads
**Then** the refresh is not part of either one
**And** it never runs on a schedule (AD-25, `AGENT-WORKFLOW.md`).

**Given** `catalogue/stats.json`
**When** a consumer looks up a stat id
**Then** it first flattens the category groups, which take the form `{id, label, entries[]}`
**And** it treats the group's `label` as a trade-UI heading that carries no pool meaning.

**Given** the catalogue as a whole
**When** any component reads it
**Then** the catalogue serves as an identity and validation authority only
**And** it contributes nothing to any Eligible Pool, and no component derives a tier, an item-level availability or a spawn weight from it (AD-25).

**Given** a GGG patch that renames a stat id or adds a base type
**When** a human refreshes the catalogue and commits it
**Then** the rename appears as a reviewable line in the diff, and not as a production incident.

**Given** one invocation of the refresh
**When** a developer counts its requests
**Then** the count is exactly four, as its declared source allows (AD-12).

### Story 1.5: One bounded, resumable, single-instance chunk

As the player,
I want a command that does one bounded piece of work and exits,
So that I can schedule it repeatedly on my own machine and a crash can never wedge it behind a green surface.

**Acceptance Criteria:**

**Given** an invocation
**When** the run executes
**Then** it performs exactly one chunk and exits
**And** whichever of three bounds runs out first bounds that chunk: the remaining search allowance, the remaining fetch allowance, or the unprocessed remainder of the workload (FR-19, AD-7).

**Given** a live run that already holds the lock
**When** a second invocation starts
**Then** it logs that fact and exits 0. A busy lock is a normal outcome for a repeatedly-invoked job.

**Given** a lock whose ISO-8601 start time is older than the declared staleness threshold
**When** a run finds that lock
**Then** it breaks the lock, proceeds, and writes a distinct `stale-lock-broken` record (`IMPLEMENTATION-NOTES.md` §7).

**Given** two runs that arrive at the staleness boundary together
**When** each run tries to take the lock
**Then** taking the lock is a single atomic operation, and exactly one run succeeds.

**Given** a slow run that was dispossessed at the threshold
**When** it reaches the point of committing
**Then** it re-reads the lock, finds contents that are no longer its own, and aborts without writing anything.

**Given** any exit path on which a run still holds the lock it took, including an abort caused by a run-start gate
**When** the run exits
**Then** it releases that lock
**And** a dispossessed run does not release the lock its successor now holds.

**Given** the lock file
**When** a developer inspects it
**Then** it carries the holder's pid and its ISO-8601 start time, and nothing else.

**Given** a chunk that completes part of its workload
**When** it writes progress
**Then** `sync-progress.json` is schema-pinned, and it records which entries the chunk *completed*, never which entries the chunk intended to visit
**And** a resumed chunk recomputes its order rather than replaying a frozen plan.

**Given** `pnpm sync:dry`
**When** an agent invokes it
**Then** it runs deterministically against recorded fixtures, emits to stdout, and writes nothing to disk.

**Given** the two criteria above that name work no earlier story has built — `sync:dry` emitting a *dataset* and a *run report*, and a lock released on an abort raised by a *run-start gate*
**When** a developer builds this story
**Then** each criterion is asserted over whatever the pipeline holds at this point. The command and the release path are complete here, and the artifacts they carry are not
**And** Story 1.8 discharges the dataset assertion, Story 1.9 discharges the run-report assertion, and Story 1.11 discharges the run-start-gate abort. Each of those stories extends this story's criteria rather than rewriting them
**And** no criterion here waits on a later story to be satisfiable. Story 2.5 defers UX-DR25's recipe half to Story 3.4 in the same way (AD-7, `AGENT-WORKFLOW.md`).

**Given** `minChunkSearches` in `data/config.json`
**When** the chunk runs
**Then** nothing lets that value cap, pace or shorten the chunk. It is a validation yardstick and never a chunk bound (AD-7).

### Story 1.6: The deterministic Refresh Rotation

As the player,
I want every chunk to select entries in one defined order,
So that I can answer "how often does a row get re-priced?" of any figure, and a dry run predicts a live run exactly.

**Acceptance Criteria:**

**Given** a chunk
**When** it selects entries
**Then** it selects in exactly this order, and it stops when any bound is reached:
  1. every `pinned` entry, oldest `lastAttemptedAt` first, subject to the cap
  2. then `active` entries, oldest `lastAttemptedAt` first
  3. then `unresolvable` entries, on a bounded retry of at most one attempt per entry per 24 hours, measured from that entry's own `lastAttemptedAt`

**And** it never selects a `pruned` entry (FR-17, FR-15, AD-7).

**Given** an entry that carries no `lastAttemptedAt` at all
**When** `core` computes the order
**Then** it treats that entry as infinitely old, so the chunk reaches it before any entry a run has already attempted
**And** the key is the field's absence, and never the `not-yet-synced` price state.

**Given** an entry that is both `active` and `unresolvable`
**When** `core` computes the order
**Then** row 3 alone selects that entry, so row 3's bound means something and oldest-first does not defeat it.

**Given** an `unresolvable` entry whose id resolves again
**When** the run-start catalogue check observes the recovery
**Then** the entry stops being `unresolvable` at that moment, and it rejoins the ordinary rotation without waiting for a retry slot.

**Given** two entries with equal age
**When** `core` breaks the tie
**Then** it breaks on the canonical entry key, under UTF-8 code-unit ordering. At cold start every entry is equally stale, and that key is the only ordering there is.

**Given** the same tracked list, dataset and passed-in clock
**When** `core` computes the order
**Then** the order is a pure function evaluated through `core`
**And** a dry run and a real run select the same entries in the same order (NFR-3, AD-7).

**Given** the ordering key
**When** a developer chooses it
**Then** it is `lastAttemptedAt`, and never the observation time. An entry that stays `no-listings` never acquires an observation time, and the rotation would otherwise select it forever (AD-9).

**Given** a chunk that cannot fund the pinned set plus at least one `active` entry
**When** it selects
**Then** it truncates the pinned set and produces a pinned-starvation record
**And** it does not change the exit code (`IMPLEMENTATION-NOTES.md` §6).

**Given** the load-time inequality that denominates the `pinned` cap against a chunk
**When** a component evaluates it
**Then** only `sync` evaluates it. `data/currencies.json` is not in the view's fetch set (AD-7, AD-24).

### Story 1.7: A Divine price estimate for one Tracked Entry

As the player,
I want each tracked entry priced from the cheapest live instant-buyout listings and converted to Divine at the boundary,
So that every figure the tool shows me is one comparable number resting on a method I can state.

**Acceptance Criteria:**

**Given** a tracked entry
**When** `sync` prices it
**Then** it issues one search, and one fetch of the cheapest 10 result ids
**And** it builds the search from the entry alone (FR-21, AD-16).

**Given** a `raw` tracked entry
**When** `sync` builds its search
**Then** `query.type` at the top level carries the entry's `baseTypeId` verbatim, and it is not a filter
**And** the search carries no category filter
**And** `type_filters.rarity` is `normal`, and `type_filters.ilvl.min` is the entry's `itemLevelMin` (`IMPLEMENTATION-NOTES.md` §5.2).

**Given** any search
**When** `sync` emits it
**Then** `query.status` is `{"option": "securable"}`, always
**And** `trade_filters.filters.price` is `{"option": "exalted_divine"}`, always
**And** `sync` does not emit `trade_filters.sale_type` at all
**And** `sort` is price ascending (AD-16).

**Given** a modifier reference on the search
**When** `sync` builds its stat filter
**Then** a `banded` reference carries both `min` and `max`
**And** a `valueless` reference carries the stat id and no edges at all, and never a sentinel pair (AD-16, AD-5).

**Given** a band edge the derivation produced
**When** `sync` emits it
**Then** it emits the value exactly, and it never rounds the value to reach an integer filter (AD-16).

**Given** a returned sample of listings
**When** `sync` takes the median
**Then** on an even sample the median is the lower of the two middle values, and never their mean. Every persisted price is therefore a price someone actually asked (`IMPLEMENTATION-NOTES.md` §4.3).

**Given** a returned listing
**When** `sync` normalises it
**Then** it converts the listing to Divine once, at the sync boundary, using a rate from `data/currencies.json`
**And** it records on the observation which exchange observation it used (FR-23, AD-20, §4.2).

**Given** each rate in `data/currencies.json`
**When** `sync` writes a `CurrencyRate`
**Then** it copies that rate's own `league` and `asOf` through unchanged, and it does not stamp them with the active league
**And** it writes divine's own rate as exactly `1`
**And** it issues no request of any kind for a rate (AD-20).

**Given** a listing whose currency has no current rate for the active league
**When** `sync` writes the entry
**Then** the entry's state is `not-yet-synced` with reason `no-exchange-rate`
**And** `sync` never stores the listing unnormalised (FR-23, FR-9).

**Given** a search that returns zero listings
**When** `sync` writes the entry
**Then** the entry's state is `no-listings`. It is never a price, and never `unresolvable` (AD-16, AD-9).

**Given** a search that returns fewer than ten listings
**When** `sync` takes the estimate
**Then** the sample is valid
**And** `sync` records the true count the search returned.

**Given** any persisted divine value
**When** `sync` writes it
**Then** it rounds that value to 4 decimal places once, and `core` never re-rounds it (Consistency Conventions).

**Given** a search the trade site answered, whatever the answer contained
**When** `sync` writes the entry
**Then** it records the response's top-level `id` as `lastSearchId`, beside `lastSearchLeague` and `lastAttemptedAt` on the entry
**And** it never records those fields on a `PriceObservation` (AD-9, AD-16).

**Given** an attempt that issues a request and receives no answer — a 429, a 5xx or a timeout
**When** `sync` writes the entry
**Then** it stamps `lastAttemptedAt` alone
**And** it leaves `lastSearchId` and `lastSearchLeague` exactly as they were — unless the request that got no answer was the fetch after an answered search, in which case the answered search's `id` and league are recorded, because the unit is the request, not the attempt (AD-9).

**Given** a 4xx response other than 429
**When** `sync` receives it
**Then** it stamps `lastAttemptedAt`, leaves the entry's price state as it was (an answered search still sets `lastSearchId` and `lastSearchLeague`), and writes a record
**And** it aborts the run non-zero, rather than spending the rest of the chunk on requests it knows are malformed (AD-9).

### Story 1.8: The published Dataset, written to a git-tracked working tree

As the player,
I want each run to write what it observed into files I already track in git,
So that every chunk leaves a reviewable change I publish when I choose, instead of a robot committing on my behalf a thousand times a day.

**Acceptance Criteria:**

**Given** a completed chunk
**When** `sync` writes the dataset
**Then** `dataset.json` carries only the latest observation per tracked entry, and no history
**And** each observation is stamped with its league
**And** the file carries the current `CurrencyRate` set beside those observations (AD-19, AD-20).

**Given** a league change
**When** `sync` writes the dataset
**Then** it does not filter the dataset on write, so the site is not blanked while a re-sync runs (AD-19).

**Given** a completed chunk
**When** `sync` finishes writing
**Then** it performs no `git add`, `commit`, `push` or `pull`
**And** the files it wrote are git-tracked and updated in place, by explicit path
**And** publishing them is the player's own commit and push (AD-3, NFR-5).

**Given** any artifact
**When** `sync` writes it
**Then** `sync` validates that artifact before writing it
**And** the artifact carries `schemaVersion` (AD-3, NFR-8).

**Given** any file this epic writes
**When** `sync` serialises it
**Then** the file is UTF-8 without BOM, with LF line endings, JSON with stable key order, and a trailing newline. A data commit's diff then shows changed data rather than reserialisation noise (Consistency Conventions).

**Given** the filesystem, **read-only git** and clock effects
**When** `sync` reaches them
**Then** it reaches them through the ports `contracts` declares
**And** time enters `core` only as a passed-in value (AD-1, NFR-3).

### Story 1.9: The structured Sync Report, with requests accounted per source

As the player,
I want every run's outcome published as data rather than console output,
So that what the run did and what broke reaches the surface I already read instead of an exit code nobody watches.

**Acceptance Criteria:**

**Given** a run
**When** it records its outcome
**Then** it emits structured records into `sync-report.json`, and not free-text console output (Consistency Conventions *Logging*, FR-25).

**Given** the report
**When** `SyncRunReport` types its contents
**Then** it types two kinds of entry apart
**And** a **figure** describes the latest chunk, and the next chunk overwrites it
**And** the figures are the requests consumed per source, the not-reached count, and the tracked-list edit date
**And** a **record** describes an event the player must see.

**Given** a record an earlier chunk wrote that the player has not acknowledged
**When** the next chunk writes its report
**Then** the report still carries that record
**And** the player's edit clears a record, and the next run never clears one. A report rewritten wholesale each chunk would remove a `stale-lock-broken` record or a starvation record within minutes of its being written.

**Given** the requests a run consumed
**When** the report accounts for them
**Then** it accounts for them per source a chunk spends — the tracked list and the league validation — so budget drift is attributable to a cause (FR-14, AD-12).

**Given** the declared request sources
**When** AD-12 declares them
**Then** exactly three generate a request: `data/tracked.json`, the per-run league validation, and the explicit catalogue refresh
**And** the catalogue refresh is not a report figure, because it never runs on the chunk path; the refresh command prints its own request count (AD-12)
**And** `sync` reads `data/currencies.json` and never fetches against it. It left the set at spine revision 14 (AD-12).

**Given** the entries that rows 1 to 3 of the rotation made eligible for this chunk and the chunk did not attempt
**When** `sync` writes the report
**Then** the report carries their count as a single figure, and never a list
**And** the count excludes `pruned` entries, and excludes an `unresolvable` entry still inside its retry interval, because neither was due
**And** *not reached* is a normal rotation outcome, kept distinct from a pinned-starvation record (AD-7, FR-25).

**Given** the tracked-list edit date
**When** `sync` derives it
**Then** it reads the author date of the last commit touching `data/tracked.json`, through the git port, and never a hand-maintained field
**And** where the file has commit history, an uncommitted working-tree edit does not move that date
**And** where git yields no date, it reads the file's last-modified time through the filesystem port
**And** the date carries the clock that produced it, `git-author-date` or `file-modified`, and no component drops that tag
**And** where neither clock answers, the report carries no date at all, and never a placeholder (AD-12, AD-9).

**Given** a chunk that truncated its pinned set
**When** `sync` writes the report
**Then** the report carries a pinned-starvation record naming the declared yardstick beside the observed allowance, so the shortfall is diagnosable (`IMPLEMENTATION-NOTES.md` §6).

**Given** an unattended run that fails
**When** it exits
**Then** the Sync Report carries the failure, and not only the exit code (FR-19, FR-25).

### Story 1.10: Unresolvable ids, detected offline and reported

As the player,
I want an entry whose stat id or base type the trade API no longer exposes to be marked and reported rather than skipped,
So that a modifier a patch removed cannot keep ranking on its last-good price.

**Acceptance Criteria:**

**Given** every `statId`, `baseTypeId` and `categoryId` in `data/tracked.json`
**When** a run starts
**Then** `sync` validates each one against the committed Trade Catalogue, before it issues any request (FR-24, AD-9, AD-25).

**Given** an id the catalogue does not carry
**When** `sync` writes the entry
**Then** the entry's Price State becomes `unresolvable`, and `sync` records the failure in `sync-report.json`
**And** `sync` never skips the entry, never defaults it, and never leaves it at its previous value.

**Given** this detection
**When** it runs
**Then** it is validation against the committed catalogue, and never inference from results
**And** it is offline, so it never stamps `lastAttemptedAt` (AD-9).

**Given** an empty result set from a search
**When** `sync` writes the entry
**Then** the entry's state is `no-listings`, and never `unresolvable` (AD-9).

**Given** a per-entry validation failure
**When** the run continues
**Then** `sync` marks the entry and the run does not abort. This is a per-entry condition rather than a failed premise (AD-12).

**Given** a tracked entry's `className`
**When** catalogue validation runs
**Then** it validates nothing here at all. No catalogue endpoint carries a class axis (AD-9, AD-25).

**Given** `data/weights.json` absent from the repository
**When** a run starts
**Then** `sync` records the absence in the report and runs normally. Pricing a tracked entry needs the trade API and the catalogue, and never the weights file (AD-12, AD-24).

### Story 1.11: League validation as a run-start gate

As the player,
I want the run to check that the configured league is real before it spends any budget,
So that a mistyped league name shows up where I already look instead of quietly wedging the sync.

**Acceptance Criteria:**

**Given** a run
**When** it starts
**Then** it validates `data/config.json`'s active league against the live leagues endpoint
**And** the check runs once per run, and costs exactly one request (FR-32, AD-19, AD-12).

**Given** a league the endpoint does not carry
**When** the check fails
**Then** the run aborts, records the failure in `sync-report.json`, and releases its lock
**And** it prices no entry (AD-7, AD-12).

**Given** a leagues request that gets no answer — a 429, a 5xx or a timeout
**When** the check cannot run
**Then** the run does not abort: it is a chunk yield with no entry attempted, exits 0 and publishes like any yielded chunk
**And** its not-reached figure counts every entry the rotation made eligible, so a yielded run is distinguishable from an empty tracked list (AD-8, AD-7, AD-12).

**Given** an aborting run
**When** it exits
**Then** it still writes `sync-report.json` alone, by AD-3's explicit path
**And** it leaves `dataset.json` and `sync-progress.json` untouched. A run that aborts without recording why leaves nothing to diagnose (AD-12).

**Given** `data/config.json`
**When** a component reads it
**Then** it carries the active league, `minChunkSearches` and `schemaVersion`, and nothing else. It is a player-owned file rather than a settings bag (AD-19).

**Given** every `PriceObservation` and every `CurrencyRate` a run writes
**When** `sync` persists it
**Then** it records the league the observation or the rate was made in (AD-19, AD-20).

## Epic 2: Day One — the Deployed Raw Base Price List

The player opens a page on the second monitor before a session. The page renders an ordered list of the Base Types worth picking up to sell raw, under a Payout Threshold the player sets. Each row states how old its price is and what state it is in. The player can expand any row and read the evidence behind it. Across a league reset the list goes honestly empty, and it does not serve last league's numbers. This is the day-one phase AD-24 declares, deployed to Pages.

### Story 2.1: The page's substrate — the override layer, the fixed frame, and one consistent artifact set

As the player,
I want the page to paint its own layout immediately and then either show me a whole ranking or tell me exactly what is missing,
So that I never read half a ranking and never mistake a partial set for the list.

**Acceptance Criteria:**

**Given** Mantine v9 at the spine's pinned 9.6.1
**When** `web` builds the theme
**Then** `theme.lineHeights` and `theme.headings` are replaced rather than extended
**And** `theme.primaryColor` points off blue, and `defaultRadius` is `0`
**And** every component that ships a shadow takes `shadow="none"`
**And** font sizes pass as literal px, so `--mantine-scale`'s rem conversion cannot round the .5px roles away (UX-DR1, UX-DR3).

**Given** `Accordion` and `Collapse`
**When** `web` uses either one
**Then** it strips the chevrons, the control padding and the hover background
**And** no expansion animates its height. The fastest transition on a 28px row is none (UX-DR1).

**Given** the colour token set
**When** `web` declares it
**Then** it is five paper tones, four inks, three structure rules, one decorative sepia and exactly two semantic inks
**And** no third ink, no success colour and no green exists
**And** sepia may mark what the operator *chose*, and it may never mark what the data *is* (UX-DR2).

**Given** every typography role
**When** `web` declares it
**Then** the role carries an explicit `lineHeight`, drawn from the three system-resident stacks
**And** the third stack is the **mono verbatim register**, which no role on this page's resting surfaces selects — it is applied by the two surfaces UX-DR40 names, at the line's own size, weight and line height
**And** the page downloads no font (UX-DR3, UX-DR40, NFR-7).

**Given** the page's glyph vocabulary
**When** `web` fixes it
**Then** every glyph is resident in Segoe UI Regular, Semibold **and** Bold
**And** `↗` is the single exception, and it is pinned to `fontWeight: 400` (UX-DR4).

**Given** the frame
**When** the page renders
**Then** the frame is `{spacing.frame-width}` wide, with `min-height: {spacing.frame-height}`, centred with a surround fill
**And** its edge is a 1px `outline` and not a `border`
**And** there are no breakpoints, no responsive story and no dark mode (UX-DR5).

**Given** the frame's width
**When** `web` sets the gutters
**Then** `{spacing.content-width}` is exactly 1012px
**And** the 20px of scrollbar clearance came out of `{spacing.frame-padding-x}`, and never out of a column contract (UX-DR5, UX-DR7).

**Given** resting **chrome** — anything that can appear without a click and is not a ranked row
**When** it renders
**Then** it never overruns `{spacing.frame-height}`. The banner and the health line are the two data-raised exceptions, budgeted in pixels against `{spacing.frame-slack}`
**And** new resting chrome is admissible only by taking a budget line of its own, so the two exceptions are not a list that grows by precedent (UX-DR6 clause one).

**Given** a **row count** above the twenty-row resting target
**When** a data condition produces one
**Then** the frame is `min-height`, so the document grows and scrolls, with nothing clipped and the printed order intact
**And** rows are not chrome and are never budgeted, so this is not a third exception to clause one — it is not an exception to that clause at all
**And** the document scrolls rather than the frame, and no region takes `overflow-y` except the sync report panel
**And** shrinking rows, dropping columns, truncating the appendix and hiding the key block are forbidden as escape hatches, for a **grown** state exactly as for an expanded one (UX-DR6 clause two).

**Given** a load
**When** `web` fetches its data
**Then** it issues exactly seven separate `no-cache` requests with no query token for the artifacts AD-24 names, and it bundles none of them into the JS
**And** it validates each artifact on load
**And** an eighth artifact would require an amendment to AD-24 (FR-33, AD-24, AD-3).

**Given** the masthead and twenty row slots
**When** the page first renders
**Then** they render immediately in the final layout, and all seven artifacts resolve in a **single transition**, never row by row. A partly filled list would render a ranking computed from an incomplete dataset
**And** the skeleton's own fill tone and placeholder shape are an unresolved `[NOTE FOR UX]`. This story surfaces that gap rather than inventing an answer (UX-DR43, state 22).

**Given** an artifact that fails validation
**When** the page loads
**Then** `{components.refusal-screen}` replaces the whole page
**And** that screen names the artifact, the schema version the artifact declared, and the version the page expects
**And** it offers no retry (FR-33, NFR-8, UX-DR33, state 26).

**Given** one of the seven artifacts that does not arrive
**When** the page loads
**Then** `{components.fetch-failure-screen}` replaces the whole page, names which file did not arrive, and offers `+ Try again`, which re-attempts the whole set
**And** an artifact that answers 404 is *absent*, not *did not arrive*: a required one gets `{components.refusal-screen}` instead, and a tolerable one renders as the absent-tolerable AC below says. This is an accepted deviation; do not re-flag it (AD-24, spec 2.1 Decisions *What absent means* and triage #9)
**And** neither screen ever serves a partial set (FR-33, AD-24, UX-DR33, state 28).

**Given** an absent but tolerable artifact — `weights.json`, `recipes.json` or `sync-report.json`
**When** the page renders
**Then** it renders and names the absence on screen
**And** it never presents a diminished list as a whole one (FR-33, AD-24).

**Given** a `statId` or a currency denomination
**When** the page prints it
**Then** a stat's text comes from `catalogue/stats.json`, and the denomination `Divine` is a product literal, not catalogue text, both rendered as text with no icon
**And** the page makes no runtime call to pathofexile.com (FR-33, AD-15, AD-20, AD-24, AD-25).

**Given** `recipes.json`, which this story must validate on load and which Story 1.2 did not need
**When** `contracts` defines its schema
**Then** `CraftRecipe` has exactly one Zod schema in `contracts`, with its type `z.infer`red from it, carrying `schemaVersion` and the recipe's declared `modifierLevelMin`
**And** nothing in this story reads a recipe for valuation. That is Story 3.4's work (AD-3, AD-17, NFR-8).

### Story 2.2: The raw ranking branch, league-scoped and computed at read time

As the player,
I want `core` to rank my Raw Bases from the published files under a threshold I supply,
So that the ordering I read is a pure function of what was published, and last league's prices never reach it.

**Acceptance Criteria:**

**Given** a `raw` Tracked Entry
**When** `core` values it
**Then** its EV is its observed price, with zero Craft Cost
**And** it is never a summand in any Item Class's EV sum. At `P = 1` it would enter at certainty and swamp every crafted outcome (FR-3, AD-17).

**Given** a Raw Base whose observed price is below the Payout Threshold
**When** `core` computes the ordering
**Then** that Raw Base leaves the ordering entirely, and `core` returns it in a distinct below-threshold group, outside the ordering and outside the Unrankable group
**And** `core` never ranks it at its price, and never gives it a row at zero. It has no Craft Cost to rank at (FR-3, AD-17).

**Given** two rows at equal EV
**When** `core` breaks the tie
**Then** it breaks on the serialised canonical key of the entry's own AD-5 arm
**And** it never breaks on a bare string that a `categoryId` and a `baseTypeId` could both supply
**And** a raw row carries no recipe id, so it sorts before a crafted row. The ordering is therefore total across the mixed list, and not only within each branch (AD-17, `IMPLEMENTATION-NOTES.md` §4.1).

**Given** a `PriceObservation` whose league differs from `data/config.json`'s active league
**When** `core` values it
**Then** it refuses that observation and treats the entry as `not-yet-synced` with reason `league-mismatch`, and never as stale-but-usable (FR-31, FR-9, AD-19).

**Given** league filtering
**When** it happens
**Then** it happens once, in `core`, at ranking time
**And** it is never a filter `sync` applied on write, so the site is not blanked while a re-sync runs (FR-31, AD-19).

**Given** an entry whose Price State is not `priced`
**When** `core` computes the ordering
**Then** that entry contributes nothing — not zero, nothing
**And** `core` reports each state separately, so the view can render non-`priced` entries outside the ranking (AD-9, FR-1).

**Given** `core` and `web`
**When** `core` produces a row
**Then** `core` computes every ranking term, and `web` computes none
**And** `web` renders only what `core` returns (AD-4).

**Given** a full ranking pass over the whole Tracked List
**When** it runs on a mid-range machine
**Then** it completes under 100 ms, and it re-runs synchronously on a threshold change
**And** the remedy for a miss is memoising the pure function, and never precomputing in `sync` (NFR-6, AD-4, AD-24).

**Given** time, randomness and configuration
**When** they reach `core`
**Then** they enter only as passed-in values, so two evaluations over the same files produce the same ordering (NFR-3, AD-1).

**Given** a persisted divine value that `sync` already rounded to 4 decimal places
**When** `core` passes it on
**Then** `core` never re-rounds it
**And** display precision belongs to the view alone (UX-DR41, Consistency Conventions).

**Given** any expected condition — a refused league, an absent observation, a below-threshold row
**When** `core` meets it
**Then** it returns a typed result, and it never throws (Consistency Conventions).

**Given** the row shape `core` returns, which Story 1.2 did not need
**When** `contracts` defines its schema
**Then** `RankedRow` has exactly one Zod schema in `contracts`, with its type `z.infer`red from it, and no parallel definition anywhere
**And** no component persists a `RankedRow`. `web` derives it in the browser on every input change (AD-3, AD-4).

### Story 2.3: The ranked list at rest — rows, units, freshness and the key block

As the player,
I want one ordered list whose every row says which unit it names and how old its figure is,
So that I can read the top five at an angle from across the desk and tell a class I craft on from a base I sell raw.

**Acceptance Criteria:**

**Given** `{components.ranked-row}`
**When** `web` lays it out
**Then** it is six fixed cells summing to 1012px — 32 + 222 + 84 + 88 + 94 + 492 — at a uniform 28px height
**And** every column's right padding is tokenised, because every one of these columns ellipsises (UX-DR7, UX-DR11).

**Given** `{components.column-header}`
**When** it renders
**Then** it is six fixed flex cells, never inline-block spans, never ellipsising and never trimmed to fit
**And** the second header reads `Item Class / Base Type`, because that column holds both units
**And** the fourth header reads `Provenance`, and never `Weight`
**And** the EV header reads `EV (Divine)`, and its cell holds the figure alone
**And** columns are not sortable (UX-DR14, UX-DR38).

**Given** every ranked row
**When** it renders
**Then** it opens with exactly one unit glyph, `{components.unit-glyph-class}` or `{components.unit-glyph-raw}`, both in one fixed 14px box, so every unit name starts at the same x
**And** the glyph is `flex: 0 0 auto`, so a long name yields first and the glyph never does
**And** the glyph is never omitted, never truncated and never given a semantic ink, and it carries no key-block entry (FR-3, UX-DR12, NFR-10).

**Given** an Item Class name
**When** the page prints it
**Then** it prints the class's own name, such as `Bow`, and it never prefixes that name with the word *class*
**And** the two words *Item Class* appear only where the page names the kind of thing rather than an instance of it (UX-DR38, PRD §3).

**Given** a `className` carrying underscores
**When** `web` renders it
**Then** it substitutes a space for each underscore at render time, and it prints nothing else differently. No display mapping is needed
**And** the identity is untouched. The stored `className` stays verbatim, and every key and every comparison uses it unchanged
**And** only the label is trimmed (AD-5, Consistency Conventions, PRD §3).

**Given** `{components.raw-base-row}`
**When** it renders
**Then** it carries three cues, and none of them is load-bearing alone: the `{colors.paper-raw}` tint, the italic name and its glyph
**And** a full-width italic note replaces the three chase cells
**And** that note spells the item level in words, rather than as `ILVL 82`
**And** the row takes its own hover tint, so a hovered raw row still reads as raw (FR-3, UX-DR13, UX-DR38, NFR-10).

**Given** a Raw Base row's Provenance cell
**When** it renders
**Then** it is empty, and it is indistinguishable from a healthy crafted row's cell. That is correct, because a Raw Base needs no Eligible Pool
**And** this is a third case, rather than a fourth Provenance value (FR-4, state 12a).

**Given** the three emphasis tiers
**When** a ranking pass completes
**Then** they are purely a function of rank position, and they differ only in weight and in rank-numeral colour
**And** they say nothing about which branch a row is on. A Raw Base at rank 1 takes tier 1, like any other row (UX-DR11).

**Given** the list at rest
**When** it renders
**Then** it renders the top 20 rows, and the remainder sits behind `{components.expand-affordance}`
**And** that affordance reads `+ Read the remaining N rows` when closed, and `− Show only the top 20` when open, where `−` is U+2212
**And** the affordance names no unit, because the remainder holds Item Classes and Base Types together
**And** it grows the list in place rather than paging, and ranks 21 and beyond all take tier 3
**And** the appendix, the key block and the foot stay below in the same order (FR-5, UX-DR31, state 33).

**Given** the top-20 bound
**When** `web` applies it
**Then** it is a display concern only: `core` ranks the full Tracked List and the view truncates, so the threshold still reorders across everything (FR-5, AD-4).

**Given** a row whose reported age is younger than the 48-hour freshness cut-off
**When** it renders
**Then** it renders no age at all. The empty cell is the statement (FR-12, AD-10).

**Given** a row at or beyond the cut-off
**When** it renders
**Then** it carries a stale mark naming which clock it reads: *priced 5d ago* for an observation, and *tried 9d ago* for an attempt
**And** the page never collapses the two into one unlabelled age (FR-12, AD-9, AD-10, state 17).

**Given** a never-synced row
**When** it renders
**Then** it reads *never attempted* in italic, and never an age, a blank, a dash or a placeholder (FR-12, AD-9, state 18).

**Given** the age the cut-off compares
**When** `web` chooses it
**Then** it is `observedAt` where an observation exists, and `lastAttemptedAt` otherwise
**And** that rule holds unconditionally, on every surface (AD-10, AD-9).

**Given** a trust mark
**When** it renders
**Then** it is inline text carrying colour, weight, glyph and word together, with no background, no border and no capsule
**And** it takes the type size of the line it sits in
**And** a healthy row renders no mark element at all: the cell is empty, and not filled
**And** a sixth mark would need a decision, and the two unit glyphs do not supply one (UX-DR15).

**Given** `{components.key-block}`
**When** the page renders in any state but the two page-replacing screens
**Then** the key block renders in three columns, and one of them is *Silence means healthy*. It covers the resting page only
**And** it is mandatory rather than an optional legend, because it is what makes an empty cell quiet rather than ambiguous (UX-DR30).

**Given** any cell where a figure is missing
**When** it renders
**Then** it holds one of the five money-slot phrases naming which question is open: *an open question*, *no figure yet*, *not valued*, *unknown*, *not tracked*
**And** it never holds `0`, `0.00%`, a blank or an em dash (FR-9, FR-4, UX-DR17).

**Given** a real figure too small to print at two decimal places
**When** it renders
**Then** it reads `< 0.01`, which is a quantity and never a money-slot phrase (UX-DR17, UX-DR41).

**Given** EV, price and the threshold
**When** the page prints them
**Then** they take two decimal places
**And** a column header states the unit once, and no row repeats it (UX-DR41, UX-DR38).

**Given** `{components.asking-price-line}`
**When** the page renders
**Then** the line is always present, never dismissible, never below the fold and never shortened. It is FR-13's only mitigation for Risk R-1 (FR-13, UX-DR23).

**Given** any copy naming a price
**When** someone writes that copy
**Then** it never reads "sells for", "worth" or "market value"
**And** no wording implies an observed sale (FR-13, UX-DR46).

**Given** every product-meaningful distinction — Price State, Provenance, and crafted versus Raw Base
**When** someone reads the page with every colour removed
**Then** each distinction still reads, carried by a glyph, a word, a weight or an italic (NFR-10, UX-DR45).

**Given** a ranked row
**When** the pointer is over it
**Then** its background moves to `{colors.paper-inset}`, and the cursor is a pointer
**And** nothing is revealed, nothing moves, and no row changes height
**And** a colour change is instantaneous or a fast linear step, with no fade on a 28px row
**And** a non-interactive surface takes no hover response at all (UX-DR44).

**Given** a ranked row
**When** the player clicks it anywhere
**Then** the whole row is one toggle target, with no per-row controls, no hover-revealed actions and no tooltip
**And** an open row takes an `openMarker` that bleeds into the gutter on a negative left margin. No column moves, and the list never jumps sideways (UX-DR11, UX-DR36).

### Story 2.4: The Payout Threshold, and what survives a reload

As the player,
I want to type a new threshold over the old one and watch the list reorder in front of me,
So that the page answers a richer player's question without a reload and without a re-sync.

**Acceptance Criteria:**

**Given** `{components.payout-threshold}`
**When** it renders
**Then** the figure itself is the input, with no field, no box and no form chrome
**And** the `Divine` suffix sits outside the editable region, and the player cannot type over it (FR-6, UX-DR18).

**Given** its resting state
**When** the pointer is elsewhere
**Then** it carries a dotted sepia rule
**And** that rule goes solid sepia on hover, and `{colors.rule-strong}` while the player edits
**And** the caret is `{colors.ink}` and the selection is `{colors.paper-deep}` (UX-DR18, UX-DR44).

**Given** the control's constraints
**When** the player enters a value
**Then** min is `0`, max is `3`, step is `0.05`, precision is two decimals, and the control clamps on blur
**And** a negative threshold is not enterable (UX-DR18).

**Given** a valid parse
**When** it occurs
**Then** the ranking re-runs synchronously against the already-loaded artifacts, debounced at about 150ms, with no network request and no sync
**And** the list re-ranks on input change, rather than on commit (FR-6, AD-24, UX-DR18).

**Given** the control's form
**When** `web` builds it
**Then** it is a number input rather than a slider. The continuous sweep was traded for exactness and masthead width (FR-6).

**Given** a re-rank
**When** it completes
**Then** the ordering changes, and the Chase Combination set on each crafted row changes with it. Only Combinations at or above the threshold appear (FR-6, FR-2).

**Given** a Raw Base
**When** the threshold moves
**Then** the threshold governs that Raw Base exactly as it governs any Combination
**And** a Raw Base below the threshold leaves the ordering altogether, absent from the top 20 **and** from the grown list
**And** it does not reappear further down (FR-3, FR-6, AD-17).

**Given** the track and the marker beneath the figure
**When** they render
**Then** they survive as a **non-interactive** readout, answering where the current value sits in the range
**And** the player cannot drag the marker, and cannot click the track (UX-DR18, UX-DR35).

**Given** the masthead control group
**When** `web` lays it out
**Then** it sums to 508px — 216 + 16 + 276 — leaving a 480px dek cap, which must still set to two lines (UX-DR10).

**Given** a first visit with nothing stored
**When** the page loads
**Then** the threshold starts at **0.25 Divine** (FR-7).

**Given** a reload
**When** the page loads
**Then** it reads the Payout Threshold from the viewer's own browser storage, with no backend, no account and no authenticated request (FR-7, AD-15, UX-DR37).

**Given** open panels, the tombstone toggles inside them, the grown list and the sync report
**When** the page reloads
**Then** every one of them resets, and the banner dismissal lasts the session only
**And** the test that decides this is a value the player deliberately **set**, against a record of a reading position (UX-DR37, FR-7).

**Given** cleared browser storage
**When** the page loads
**Then** the control returns to the default, and nothing else on the page changes (FR-7).

### Story 2.5: Row expansion — the evidence behind a row, its tombstones and its trade link

As the player,
I want to expand any row and read every Tracked Entry behind it, priced or not,
So that a rank stops being a claim and becomes an argument I can check.

**Acceptance Criteria:**

**Given** a click anywhere on a ranked row
**When** the panel opens
**Then** it opens in place, instantly, with no height animation, and it pushes the regions below it down
**And** it is not a modal, not a drawer and not a second route
**And** many panels may be open at once, and nothing closes a panel but a second click on its own row (FR-8, UX-DR25, UX-DR35).

**Given** the panel's title
**When** it renders
**Then** it carries the row's unit name, led by the row's own glyph
**And** it repeats the active Payout Threshold and the asking-price framing, so a panel read on its own cannot be misread (UX-DR25).

**Given** UX-DR25's second requirement, that the panel also repeat the active Craft Recipe
**When** a developer builds this story
**Then** that requirement is deferred to the story that introduces the control. No Craft Recipe control exists until FR-26 ships, and a panel cannot name a choice the player has not been given
**And** the panel's context line is therefore extended, and not rewritten, when that control ships (UX-DR25, FR-26).

**Given** a crafted row's panel
**When** it lists entries
**Then** it lists **every** Tracked Entry on that Item Class — priced or not, above or below the threshold — including `pruned` tombstones (FR-8, AD-17).

**Given** a Raw Base row's panel
**When** it opens
**Then** it holds exactly one combination row, for the degenerate Combination of no affixes
**And** that row's note reads `no affixes — this Base Type priced as it drops, at Item Level 82`
**And** the panel is never empty. An empty expansion would strand that entry's exact ages (FR-8, FR-3, FR-12).

**Given** `{components.combination-row}`
**When** it renders
**Then** it is two lines under one hairline
**And** line one carries the Combination, and the Price State with its glyph **and** its word
**And** line one also carries the price in Divine or a money phrase, and the listing sample count
**And** line two carries the note and **both** labelled ages, each in its own cell
**And** line two is always present, so rows scan evenly down the expansion (FR-8, FR-9, FR-12, UX-DR26).

**Given** the combination row's cells
**When** `web` lays them out
**Then** line one is five cells summing to 966px — 460 + 250 + 116 + 116 + 24
**And** line two is three cells summing to 966px — 560 + 200 + 206 (UX-DR9).

**Given** a long note
**When** line two renders
**Then** it wraps rather than truncating, and it grows the row by whole `{spacing.combination-row-line-2-height}` steps, because that role's `lineHeight` is absolute
**And** `{spacing.combination-row-height}` is therefore a minimum, and not a height (UX-DR26).

**Given** anything inside a combination row
**When** it does not fit
**Then** the page does not truncate it, does not ellipsise it, and does not replace it with a tooltip. The expansion is the bottom of the page, and the text has nowhere to go (UX-DR26).

**Given** the four Price States
**When** they render
**Then** each takes its own glyph — `●` priced, `○` no-listings, `∆` not-yet-synced, `×` unresolvable — always accompanied by the Price State's name in words
**And** the glyph never appears alone, and never substitutes for the word (FR-9, UX-DR16).

**Given** `not-yet-synced`
**When** it renders
**Then** the page renders its reason rather than merely storing it, and that reason is exactly one of `never-synced`, `league-mismatch` or `no-exchange-rate`
**And** each reason carries its own note on line two (FR-9, states 3, 5–7).

**Given** `no-listings`
**When** it renders
**Then** it holds the money slot *an open question*, with `0 listings found`
**And** its note says that nobody is listing this right now, and that a jackpot and junk look alike here
**And** the page never presents it as an answer that the Combination is junk, and never as "no value" or "worthless" (FR-9, UX-DR46, state 2).

**Given** `unresolvable`
**When** it renders
**Then** the page renders it rather than merely omitting it
**And** it carries its `×` in `{colors.rust}`, the money slot *not valued*, and a note naming a patch as the cause (FR-9, FR-24, AD-9, state 4).

**Given** a `never-synced` entry
**When** its line two renders
**Then** both age cells are empty rather than filled. It is the one row with no age at all (FR-12, state 5).

**Given** an entry below the Payout Threshold
**When** it renders
**Then** its note reads *below the threshold — adds nothing to EV*
**And** the page renders that entry, never hides it and never greys it (FR-8, UX-DR26, state 20).

**Given** a Combination's text
**When** the page prints it
**Then** it is the curator's declared Accepted Tier plus the canonical short form, as `T1 Cold Res · T1 Mana`, and never the value
**And** that rule holds on **both** this surface and the collapsed row's chase cells
**And** the tier prefix is never abbreviated and never varied, and a mixture takes an en dash, as `T1–T2` (UX-DR39).

**Given** a modifier missing either its short form or its declared `acceptedTier`
**When** it renders
**Then** it falls back to the Trade Catalogue stat name plus the value band. That is the one place in the product where a numeral from modifier text survives
**And** the fallback is identifiable as a fallback, and it does not borrow a semantic ink
**And** it is identifiable by the **mono verbatim register** — the third type stack, meaning *the page did not write this text* — taking the line's own size, weight and line height and adding no ink, no mark and no glyph
**And** the cell may ellipsise a character or two earlier than a curated one, which is accepted: the column budget is unchanged, the cell already ellipsises, and the expansion holds the text in full
**And** this story invents no cue of its own. Story 3.3 renders the same register on the other surface, and the two must not diverge (UX-DR40, UX-DR50).

**Given** the Provenance mark
**When** the panel renders
**Then** the panel never repeats that mark inside the expansion. Every combination row in one panel carries the same label by construction, and a per-row mark would discriminate nothing (FR-10, FR-11, AD-10).

**Given** a Combination row whose Curation Status is `pinned`
**When** it renders
**Then** it carries `{components.curation-status-pinned}`: a glyph plus the word `* pinned`, in `{colors.ink-tertiary}` at weight `600`, roman, at the type size of the line it sits in
**And** the mark **leads** `{spacing.col-combination}` on line one, ahead of the tier and the short form. That is the reading position `† pruned` holds in a tombstone, and the one column the eye already runs down
**And** the mark never trails, and never sits in the state cell, which on a live row holds the Price State glyph (FR-15, UX-DR48, state 9).

**Given** that mark's loudness
**When** a developer implements it
**Then** the loudness is deliberate rather than untidy. `{components.trust-strip}`'s third line reads `× N of M pinned entries starved` and **names no entries**, so this mark is what the player scans open expansions for after that line fires. Being findable in a scan *is* the requirement
**And** a quiet tertiary decoration would therefore be a failure rather than good taste (FR-15, FR-17, FR-25, UX-DR48, state 31).

**Given** the mark's ink
**When** a developer chooses it
**Then** it takes no semantic ink and no sepia. `pinned` is neither a degraded figure nor an operator choice: it is a fact about the Tracked List
**And** nothing at all marks Curation Status `active`. Silence means ordinary here, as everywhere (FR-15, UX-DR2, UX-DR48, state 8).

**Given** `* pinned ` leading a 460px `{spacing.col-combination}` that already holds the tier and the short form, on a line that neither wraps nor ellipsises
**When** a developer builds the component
**Then** the build measures the longest tier-plus-short-form against that cell, less the mark, before shipping
**And** no column sum is reopened. The mark appears on pinned rows alone, so it is a per-row worst case rather than a column-budget change (UX-DR48, UX-DR9).

**Given** `{components.key-block}`, whose contract is to list every mark that can appear
**When** a developer considers the curation marks for it
**Then** whether `† pruned` and `* pinned` belong there is an unresolved `[NOTE FOR UX]`. This story surfaces that gap rather than settling it: the mark's own treatment is closed, and only its key-block membership is open
**And** the resolution is either that curation marks earn entries, or that the key block's contract narrows to trust marks. Neither spine has ruled on it (UX-DR30, UX-DR48, memlog 201).

**Given** `{components.tombstone-band}`
**When** the panel opens
**Then** the band is collapsed behind a `+ N pruned` toggle, local to that panel, in the page's one `+` / `−` vocabulary
**And** the toggle resets when the panel closes (FR-8, FR-15, UX-DR28, UX-DR31).

**Given** an opened tombstone row
**When** it renders
**Then** line one is the Combination struck through, with `† pruned`, and *not tracked* in the money slot
**And** line two is the prune reason alone, in one cell across the full 966px line-two width, with no removal date
**And** the row does not borrow the two age cells. A prune is a decision, and not a reading of either clock (FR-8, FR-15, UX-DR28, state 10, EXPERIENCE.md `{components.tombstone-band}`).

**Given** an entry whose `lastSearchId` is present, whose `lastSearchLeague` equals the active league, and which is not `pruned`
**When** the row renders
**Then** `{components.trade-link}`'s `↗` glyph alone is the click target, and it opens that search in a new tab
**And** the test reads the stored fields, and never the Price State (FR-33, FR-21, AD-24, UX-DR27).

**Given** the link's URL
**When** `web` builds it
**Then** it takes the form `IMPLEMENTATION-NOTES.md` §5.4 fixes
**And** **the league segment alone** is percent-encoded, and never the whole path. Live league ids carry spaces, and an unencoded segment silently 404s (AD-24, §5.4).

**Given** an entry that fails any of the three conditions
**When** the row renders
**Then** the cell is blank, and it is not greyed and not disabled-looking
**And** the glyph never appears inside the tombstone band (UX-DR27, AD-24).

**Given** a click on the link
**When** the new tab opens
**Then** the page issues no request of its own, and its state is unchanged
**And** its state is unchanged again when the tab closes (AD-15, UX-DR35).

### Story 2.6: The trust strip, its health line, and the Sync Report panel

As the player,
I want the page to carry what the ranking rests on, and to get loud when something is actually broken,
So that a list that is not doing what I think is visible without my going to look for it.

**Acceptance Criteria:**

**Given** `{components.trust-strip}`
**When** the page renders
**Then** the strip carries five plain facts unconditionally, across two lines, with no mark and no colour on any of them
**And** line one reads `Weights File`, leading `producer` · `generatedAt` · `gamePatch`
**And** line two reads `Last synced`, with `Tracked List last edited`, and `|` separates the fields
**And** the strip is always present, and never dismissible (FR-10, FR-18, UX-DR21).

**Given** line one's three fields
**When** `weights.json` is present, which is the committed state
**Then** the page reads `producer`, `generatedAt` and `gamePatch` from the file's header as published
**And** Story 2.1's `WeightsFileEnvelopeSchema` widens to type those three header fields and nothing more. It still does not read `bases`, which remains Story 3.1's (AD-3, AD-24)
**And** where `weights.json` is absent, each of the three renders *unknown*, as a Tracked List with no date does, and never a placeholder value. Story 2.1's absence line already names the missing file (AD-24, FR-30).

**Given** the tracked-list edit date
**When** it renders
**Then** the page prints it plainly as attribution, with no staleness threshold and no age at which it turns red
**And** a `file-modified` date renders with the plain suffix `(not committed)`, with no mark and no colour
**And** a Tracked List with no date renders *unknown*, and never a placeholder date (FR-18, AD-12, AD-9).

**Given** a healthy run
**When** the strip renders
**Then** it raises no third line
**And** it carries no count of nothing, no "0 unresolvable" and no success mark (UX-DR21, state 30).

**Given** exactly two data triggers — unresolvable entries exist, or pinned entries starved
**When** either trigger holds
**Then** the strip raises one rust third line, carrying a glyph, a word **and** a count for each trigger
**And** that line costs `{spacing.frame-reserve-health-line}`, charged to the resting budget, because data raises it and no click does
**And** the five resting facts are unaffected (FR-24, FR-25, FR-17, UX-DR21, state 31).

**Given** the strip
**When** the player clicks it anywhere
**Then** the whole strip is the target, and it toggles `{components.sync-report-panel}`
**And** the affordance reads `+ the full sync report` when closed, and `− the full sync report` when open (UX-DR21, UX-DR31, UX-DR35).

**Given** the panel
**When** it opens
**Then** it opens in place beneath the strip, and it pushes the regions below it down
**And** it is capped at `{spacing.sync-report-max-height}`, and it scrolls inside its own band past that cap
**And** it is closed on every load, so the strip alone never makes the page scroll in any data state (UX-DR22, UX-DR6, state 32).

**Given** the panel's contents
**When** it renders
**Then** it holds five figure groups in three columns: the sync run, what is broken, and what the weights cover
**And** it carries **one heading per column, and never one per group**, with vertical space alone separating two groups in one column (UX-DR22).

**Given** that `columnHeadingRule`
**When** Epic 3 adds the panel's sixth group beneath *what is broken*
**Then** this story builds the second column so a third group is admitted by vertical space alone, with no second heading, no rule and no bullet
**And** five is the correct count for this epic, because no cross-file check runs until Story 3.3 builds them, with or without a weights file, so nothing here renders an empty group against a future one (UX-DR22, UX-DR49).

**Given** the figures themselves
**When** they render
**Then** they are the requests consumed per source and the entries not reached, the unresolvable count and the pinned-starvation records, and pool coverage as a fraction **with its denominator** (FR-14, FR-24, FR-25, FR-4, AD-27).

**Given** the entries-not-reached figure
**When** someone words it
**Then** it reads *in the last sync pass*, and never *in this Chunk*
**And** the ground for that is **register, not audience**: it is a figure-group label, read at a glance, in the page's voice. The rule stood on audience until revision 4, and audience never discriminated in this product — there is one user, he wrote the Tracked List and he is the person fixing the file (UX-DR38, UX-DR50).

**Given** every figure in the panel
**When** it renders
**Then** the page reads it from `sync-report.json` as published, and the page computes nothing — not even the coverage fraction it holds both files for (UX-DR22, AD-27, §3).

**Given** an omitted coverage figure, where `weights.json` is absent and the fraction and its denominator are omitted together
**When** the panel renders
**Then** the page never renders that omission as `0`. Coverage is undefined there, rather than zero (AD-27, §3).

**Given** an omitted coverage figure while `weights.json` is **present** — the committed state until Story 3.6 teaches `sync` to measure it
**When** the panel renders
**Then** the page renders the figure as *not measured*, and never as `0`, and never with wording that says the file is absent
**And** the page tells this case apart from the absent-file case by the weights envelope it loaded itself, and never by inferring a file state from `sync-report.json`
**And** the words are provisional. UX owns the final copy and placement, and a `[NOTE FOR UX]` in `deferred-work.md` holds that question open (AD-27, AD-24, UX-DR22).

**Given** the tracked-list edit date
**When** the panel renders
**Then** the panel does not repeat that date. It is already a resting fact on the strip two lines above (UX-DR22).

**Given** the panel's contents and the appendix rows
**When** the pointer moves over them
**Then** they take no hover state at all
**And** only the strip responds, with a dotted sepia underline on its affordance text (UX-DR44).

### Story 2.7: Day one, deployed — the honest-empty league reset and the published site

As the player,
I want a league reset to leave the page honestly empty, and the site to refresh itself from the data commit I push,
So that I never read last league's numbers and never have to rebuild anything by hand.

**Acceptance Criteria:**

**Given** a league reset, where every observation carries a league other than the active one
**When** the page renders
**Then** every tracked unit appears in **canonical order**, each with its glyph, carrying Price State `not-yet-synced` with reason `league-mismatch` (FR-31, UX-DR42, state 23).

**Given** that list
**When** it renders
**Then** the page **suppresses** the rank numerals
**And** the list states that the order is canonical and not ranked. An ordering implies a ranking the page does not have (FR-31, UX-DR42).

**Given** every EV cell in that state
**When** it renders
**Then** it holds the money phrase *no figure yet*, and never a blank and never a zero (FR-9, UX-DR42, UX-DR17, state 23).

**Given** the honest-empty state
**When** it renders
**Then** `{components.asking-price-line}`, `{components.key-block}` and `{components.running-foot}` still render. A page with no numbers still has to say what its numbers would mean (FR-13, UX-DR23, UX-DR30, UX-DR32).

**Given** the following day's partial refresh
**When** rows acquire prices one rotation at a time
**Then** the list renders normally, with no global stale treatment. Per-row freshness is what makes that honest (FR-12, AD-19, state 24).

**Given** a threshold that nothing clears
**When** the list renders
**Then** a **plain declarative** sits above the list, under `{components.asking-price-line}`, naming the live Payout Threshold figure at the page's 2dp
**And** it states the condition and **no instruction**, because the player set that number deliberately and its remedy is the figure he typed, 16px away
**And** it is not `{components.uniform-prior-banner}`, which a data condition raises and this is not one, and it is not a `{components.money-slot}` phrase either, because no figure is missing
**And** that makes the state distinguishable from both a partial refresh and an empty league, so it never reads as a data outage (state 25, UX-DR51, UJ-2 failure path).

**Given** that same state
**When** the rows render
**Then** the rows **stay** and the **rank numerals stay**
**And** numerals are suppressed in the honest-empty state because its order is canonical rather than ranked, where here the order is computed and the figures merely tie — hiding a computed result because it is flat would be the page editing its own answer
**And** in this epic a Raw Base under the threshold leaves the ranking altogether, so the list may be short or empty without any crafted row to tie against. The twenty tied crafted rows are Epic 3's (state 25, UX-DR51, FR-5).

**Given** `{components.running-foot}`
**When** it renders
**Then** it states that the page is read-only while playing, and that exact ages sit one click down
**And** it states that pruning and pinning happen in `data/tracked.json`, followed by a commit
**And** it is the only place where the page says where curation actually happens (UX-DR32, FR-15).

**Given** the page's interaction surface
**When** `web` builds it
**Then** it holds exactly the seven interactions and the one banner dismissal `EXPERIENCE.md` enumerates, mouse only
**And** no column sorting, hover-revealed row action, tooltip, modal, auto-refresh, attention-seeking animation, browser write path, per-row clipboard snippet, virtualisation or windowing exists anywhere (UX-DR35, UX-DR36, AD-15).

**Given** the accessibility floor
**When** `web` implements it
**Then** what binds is NFR-10 reframed as legibility, and rendered text rather than raw ids
**And** nobody infers a WCAG level, a contrast claim, a screen-reader behaviour, a keyboard path, focus-visible styling or reduced-motion handling from the floor's existence (UX-DR45, NFR-10)
**And** keyboard and screen-reader access to the row and trust-strip toggles is out of scope under EXPERIENCE.md *Accessibility Floor*. This is an accepted deviation; do not re-flag it (retro F19).

**Given** the player pushing a data commit to the default branch
**When** it lands
**Then** a GitHub Actions workflow builds the Vite bundle and deploys it to Pages
**And** the workflow is required rather than optional. Branch-published Pages runs Jekyll and cannot build this app (spine *Deployment & environments*, NFR-7).

**Given** the deployed site
**When** it serves
**Then** it is a static bundle, with no server, no secret material and no expiring credential
**And** a data commit updates the data without rebuilding the app. The page fetches the seven artifacts at runtime rather than bundling them (NFR-7, AD-15, AD-24, FR-33).

**Given** the deployed page on the committed artifact set, where `weights.json` is published and `recipes.json` is published with no recipe (Story 2.7 Decisions)
**When** a player opens it
**Then** the Raw Base price list is the day-one content, no absence line prints, and the masthead dek says that crafted Item Classes are not ranked yet (EXPERIENCE.md, *The Epic 2 masthead dek* and state 37)
**And** the crafted branch is empty because no `(itemClass, recipe)` pair exists, which is not a failure. An absent `recipes.json` gives the same empty branch, and there Story 2.1's absence line names the missing file
**And** that is the launch experience this epic deploys, rather than an edge case (AD-24, FR-30).

**Given** the deployed page with no `weights.json` published
**When** a player opens it
**Then** the Raw Base price list is still the day-one content, and the page names the absence
**And** Story 2.8 renders the crafted classes that absence makes Unrankable. This story does not (AD-24, AD-27, FR-30).

### Story 2.8: The Unrankable appendix, and the day-one page it completes

As the player,
I want the crafted Item Classes the tool cannot rank to sit at the foot of the page with their reason, on a day when that is all of them,
So that the launch page states what it is not showing me instead of quietly showing me a shorter list.

**Acceptance Criteria:**

**Given** `{components.unrankable-appendix}`
**When** `web` builds it
**Then** it is four cells summing to 970px — 292 + 118 + 250 + 310 — pinned to the foot of the document
**And** the pin is a decision, and never a coverage band. The page never switches layout on a measurement, and there is one arrangement in every data state (UX-DR8, UX-DR29, FR-4).

**Given** the count of Unrankable Item Classes
**When** the page renders
**Then** that count is readable without expanding anything (FR-4, UX-DR29).

**Given** every row in the appendix
**When** it renders
**Then** it is an Item Class, and never a Base Type. Unrankability governs the crafted branch alone, and a Raw Base needs no Eligible Pool
**And** the rows are not interactive and do not expand. An Unrankable Item Class has no ranking to explain (FR-4, FR-3, UX-DR29).

**Given** `weights.json` absent, which is a state this epic must reach and test against a fixture, because the file is absent-tolerable
**When** the appendix renders
**Then** every crafted Item Class sits in it, carrying FR-4's second reason string verbatim — `class absent from weights file`
**And** that is the only string this epic renders, because in that world it is true of every crafted class. Story 3.6 adds the other two (FR-4, FR-30, AD-24, state 15).

**Given** `weights.json` present and `recipes.json` published with no recipe, which is the committed state this epic deploys (Story 2.7 Decisions), or `recipes.json` absent
**When** the appendix renders
**Then** it holds no row, because no `(itemClass, recipe)` pair exists and no class is Unrankable in FR-4's sense. In the committed state the masthead dek says why the crafted branch is empty; with `recipes.json` absent, Story 2.1's absence line says why (AD-24, EXPERIENCE.md state 37)
**And** the page never prints `class absent from weights file` while it holds a loaded weights envelope. Epic 2 does not read `bases`, so the string would be a claim it cannot check (FR-4, FR-9)
**And** the empty appendix still renders in its place, with its count readable. The empty treatment is UX's, and EXPERIENCE.md state 37 rules it. This story builds the empty case to that ruling and does not invent copy for it (UX-DR29, FR-4).

**Given** the absent-weights world's row count — on the order of 29 rows against a committed budget of 7
**When** the page rests
**Then** the appendix holds **every** row, untruncated, and the document grows and scrolls beneath it
**And** `margin-top: auto` produces slack only while the content is shorter than the frame, and none past it, which is the behaviour this state wants
**And** nothing shrinks a row, drops a column, truncates the appendix or hides the key block to keep the page inside 1920px (UX-DR53, UX-DR6 clause two, FR-30).

**Given** that treatment
**When** a developer looks for a decision to make
**Then** there is none left to make. The three rules once read as colliding do not: the footer pin and the no-truncation rule are mechanism and hold, and the third was the sentence UX-DR6 has split
**And** the earlier acceptance of designing this at implementation time is **discharged**. This story may not re-defer it (UX-DR53).

**Given** an Unrankable Item Class some of whose Base Types still rank on the raw branch
**When** its note renders
**Then** the note names that fact, and not a rank. A class holds several Base Types, they do not rank together, and pointing at one position would invent a relationship the list does not have (FR-4, FR-3, state 16).

**Given** the appendix, the key block and the running foot
**When** the page renders in any state this epic reaches
**Then** all three still render, and they stay below the list in that order. A page with no crafted ranking still has to say what it is not ranking (FR-13, UX-DR23, UX-DR29, UX-DR30, UX-DR32).

**Given** the appendix rows
**When** the pointer moves over them
**Then** they take no hover state at all (UX-DR44).

## Epic 3: The Crafted Ranking, on a Real Weights File

The player reads Item Classes ranked by threshold-truncated expected value, under a Craft Recipe the player chooses, beside the raw rows in one mixed list. Each crafted row carries the Combinations worth chasing on it, and the Craft Cost the player pays on every attempt including the failures. The player can tell a figure resting on measured weights from a figure resting on an invented prior. The classes the tool cannot rank honestly sit outside the ordering, with their reason. This is the product's central bet: the ranking is not "most expensive base".

**The recipe axis is settled, and Story 3.4 is specified against it.** AD-17 rules that `core` ranks every `(Item Class, recipe)` pair inside one ordering, while `web` renders only the active recipe's rows. The cross product is therefore ordering-internal, and never player-observable. Three consequences of that ruling carry their own acceptance criteria in Story 3.4: the rendered bound applied after the recipe filter, the raw rows' stability across a switch, and where a test may assert the recipe-id tie-break. Story 3.4 also re-sites NFR-6's budget onto the cross product.

### Story 3.1: Consuming a schema-conformant Weights File and its pool-completeness contract

As the player,
I want the tool to consume whatever conforming Weights File the scraper project delivers, and to refuse one it cannot trust,
So that the ranking rests on a file somebody else produced and this app never invents a pool.

**Acceptance Criteria:**

**Given** `data/weights.json`
**When** `core` loads it
**Then** it accepts a file conforming to `WEIGHTS-FILE-SCHEMA.md` `6.1.0`
**And** it refuses a file declaring any `5.x` as an unknown **major**, because the `6.x` major adds the required `modGroup` that exclusion reads (FR-27, AD-11, NFR-8).

**Given** a file that trips any hard error in `WEIGHTS-FILE-SCHEMA.md` *Validation*, an unknown schema major among them
**When** `core` loads it
**Then** it refuses the file and names the failure
**And** it never loads the file in part (FR-27, AD-11).

**Given** any producer that satisfies the contract
**When** `core` loads that producer's file
**Then** the app is indifferent to which producer wrote it
**And** the app depends on no producer-specific behaviour (FR-27, AD-11).

**Given** any component of this app
**When** it runs
**Then** it never writes, patches or regenerates a Weights File (FR-27, AD-11, AD-3, NFR-5).

**Given** one entry of the file
**When** `core` reads it
**Then** the entry is one tier of one modifier, carrying `sourceModifierId`, `modGroup`, `itemLevelMin`, `weight`, `weightSource` and its `lines[]` nested inside it
**And** each line carries its own `statId`, or `null`, and its `ranges` verbatim
**And** `core` reads the entry's mutual-exclusion group from `modGroup`, never by parsing `sourceModifierId` (AD-11)
**And** the entry carries the tier's weight once (AD-11).

**Given** all of one entry's lines
**When** `core` reads them
**Then** it reads co-occurrence directly off that one entry. The game draws the modifier rather than the line, and nobody can reconstruct that fact once the source row is split (AD-11).

**Given** a line whose `statId` is `null`
**When** `core` reads it
**Then** that line is data rather than a file error, never a reason to declare a pool `partial`, and never a fact about coverage
**And** such a line can never be contained, while its entry still enters the denominator like any other (AD-11, `IMPLEMENTATION-NOTES.md` §1, §3).

**Given** a pool declared `complete`
**When** a developer reads the contract
**Then** that declaration asserts every tier of every modifier that can roll in the slot at any item level
**And** it asserts every Stat Line of each tier
**And** a producer that cannot guarantee that declares `partial`. There is no third option (FR-28, `WEIGHTS-FILE-SCHEMA.md`).

**Given** a `partial` pool
**When** `core` values against it
**Then** the Item Class is Unrankable, and every probability from that pool carries Provenance `absent`. That is the only path to `absent` (FR-28, FR-4, AD-17, AD-10).

**Given** a dropped tier or a dropped Stat Line
**When** someone asks `core` to catch it
**Then** `core` has no arithmetic audit of the producer's work at all. The ranking rests on the producer's `poolCoverage` assertion, and this epic states that trust rather than implying it (FR-28, AD-11).

**Given** the checks `core` does retain
**When** a file loads
**Then** `core` enforces the shape rules, the duplicate-`sourceModifierId` rule and the pool rules that `WEIGHTS-FILE-SCHEMA.md` lists
**And** it reads `sourceModifierId` at load for that duplicate check, and never in valuation (AD-11).

**Given** `gamePatch`
**When** a component reads it
**Then** it is operator-asserted, and `core` neither parses nor branches on it
**And** `web` renders it beside `producer.id` and `producer.generatedAt` (AD-11, FR-10).

**Given** `data/weights.json` absent from the repository
**When** the page loads
**Then** every crafted Item Class is Unrankable with that reason, Raw Bases still rank, and the page names the absence
**And** that state is the product's declared day-one phase, rather than an error
**And** its page treatment is **specified and not deferred** — the appendix sits at the foot, holds every row untruncated, and the document scrolls. Story 2.8 built that, and this story neither re-designs it nor re-defers it (FR-30, AD-24, AD-11, UX-DR53).

**Given** a uniform-prior file, with every `weight: 1` and `weightSource: "absent"`
**When** `core` loads it
**Then** it is a legal *weighting* placeholder, and never a *sourcing* one
**And** every figure it influences carries Provenance `uniform-prior` (FR-30, AD-11, AD-10).

**Given** the probability code path
**When** measured weights arrive later
**Then** that path has run from day one, and the ranking formula does not change shape (FR-30).

**Given** one entry of the file as it crosses into `core`, which Story 1.2 did not need
**When** `contracts` defines its schema
**Then** `ModifierWeight` has exactly one Zod schema in `contracts`, with its type `z.infer`red from it, and no parallel definition anywhere
**And** it nests that tier's `lines[]` rather than flattening them. The co-occurrence fact is the one thing `core` cannot reconstruct once it is lost (AD-3, AD-11).

**Given** `sync` reading the file
**When** a `statId` or a `categoryId` in it is absent from the Trade Catalogue
**Then** `sync` records the failure in `sync-report.json` only, and it never rewrites the file and never refuses it
**And** that validation skips a `null` `statId` rather than failing it. The two have different causes and different owners (FR-24, AD-9, AD-3).

### Story 3.2: The probability term — a tier's interval, containment, and the entry's floor

As the player,
I want one derivation from the Weights File to the probability behind every crafted figure,
So that two builders cannot produce two different orderings from the same two files.

**Acceptance Criteria:**

**Given** a weights line
**When** `core` derives its filter-comparable interval
**Then** an empty `ranges` is valueless, one `#` derives `[a, b]`, and two `#` derive `[(a1+a2)/2, (b1+b2)/2]`
**And** three or more `#` cannot occur, and are a file error (FR-29, AD-11, §1).

**Given** that division
**When** a developer implements it
**Then** it happens once, in one exported function that both the containment test and the edge-alignment test call. Two call sites are two chances to round differently (§1).

**Given** the two-`#` rule
**When** someone records it
**Then** it is recorded as the producer's inference, pending OQ-12
**And** this one function is the single place to change when OQ-12 resolves (§1).

**Given** the comparison of a derived edge against a curator's declared edge
**When** `core` makes it
**Then** it is exact equality, with no tolerance and no epsilon. The comparison is load-bearing against the sentinel defect AD-5 exists to close, and an epsilon readmits that defect (§1, AD-5, AD-17).

**Given** `isContaining(ref, entry)`
**When** `core` evaluates it
**Then** a `banded` reference matches a line that shares its `statId`, whose `ranges` is non-empty, and whose derived interval lies wholly inside the band
**And** a `valueless` reference matches a line that shares its `statId` and whose `ranges` is empty (§1, AD-5, AD-11).

**Given** a contained entry
**When** `core` sums the numerator
**Then** that entry contributes its whole weight **once**, however many of its lines match (§1, AD-11).

**Given** a merely overlapping entry
**When** `core` sums the numerator
**Then** that entry contributes nothing, and that is not an error
**And** it still counts in the denominator (FR-29, §1, AD-11).

**Given** `P(ref | cat, slot, L)`
**When** `core` computes it
**Then** it is a ratio over the pool scoped by item level, and the same scope applies to both halves
**And** `cat` is the `(categoryId, className)` pair, and `L` is the entry's own declared floor (FR-29, AD-17, AD-5).

**Given** `pool(cat, slot)`
**When** `core` resolves it
**Then** it is the direct lookup `bases[categoryId][className][slot]`, with no search, no derivation, and no fallback to a sibling class when the named class is absent
**And** an absent pool is unrankability with a reason (AD-17, AD-5).

**Given** the denominator
**When** `core` sums it
**Then** it is a plain sum over the entries in scope. One entry is one tier, which is one source row, counted once (AD-17, AD-11).

**Given** a Combination's probability
**When** `core` computes it
**Then** the transmute draws its affix from the prefix and suffix pools combined, by weight, and the augment draws from the other slot's pool with the first affix's `modGroup` removed
**And** scope, truncate, exclude and renormalise run in that order
**And** `P = 1` for an absent affix (FR-29, AD-17, `IMPLEMENTATION-NOTES.md` §11).

**Given** a class where no `modGroup` spans both slots
**When** `core` computes a Combination's probability
**Then** it equals `P(prefix) × P(suffix)` to 1e-12 relative, asserted on every tracked entry of the real file (§11).

**Given** a cross-slot `modGroup` built inside a test
**When** `core` computes the probability
**Then** it matches §11's two-order sum
**And** an augment left with no eligible entry is unrankable with a reason, never a zero (AD-17, §11, NFR-2).

**Given** a tier only partly covered by a curated band
**When** `core` computes the probability
**Then** that tier contributes nothing, and that is not an error (FR-29, AD-11, §1).

**Given** every crafted Tracked Entry on one Item Class
**When** `core` reads their floors
**Then** they share one `itemLevelMin`, and the load enforces that
**And** a Raw Base is exempt by construction rather than by exception. It names a Base Type, and it takes no part in any class's floor (FR-22, FR-16, AD-17).

**Given** a declared `itemLevelMin`
**When** a component reads it
**Then** no component derives that floor. `IMPLEMENTATION-NOTES.md` §8 states it as a conformance condition on `data/tracked.json`
**And** the code reads the declared number (FR-22, AD-5, §8).

**Given** a floor declared *higher* than §8 derives
**When** a check runs over the file
**Then** nothing mechanical catches it
**And** this document records that trust surface rather than implying it (FR-22, AD-5).

**Given** `acceptedTier`
**When** any component touches it
**Then** `core` and `sync` never read it, nothing validates it against a band, nothing validates its spelling, and it is never part of a canonical key
**And** a missing label still loads and still ranks, and `web` renders the marked fallback rather than failing (FR-22, AD-5).

**Given** a band spanning a run of whole adjacent tiers
**When** `core` values it
**Then** that band is legitimate, while a band containing one tier and clipping another is not
**And** the span is priced at the cheap end of the whole span while carrying both tiers' mass. Below the Payout Threshold that truncates the summand to zero, and it takes the good tier's mass with it (FR-22, AD-17, AD-16).

**Given** the understatement whole-tier containment produces
**When** someone asks for its size
**Then** it is unmeasured and unbounded, and OQ-21 owns it
**And** the ordering rests on an operating bet this story does not close (FR-29, AD-11).

### Story 3.3: The five cross-file checks, defined once and run by both shells

As the player,
I want the tool to refuse a curation mistake at load rather than ranking on it,
So that a double-counted Combination cannot hand an Item Class the top of the list.

**Acceptance Criteria:**

**Given** the five checks — edge alignment, empty containment set, `coOccur`, kind agreement and class discriminability
**When** a developer implements them
**Then** they are exported pure functions in `core` over both loaded files, defined once
**And** `web` calls them at load, and `sync` calls them as a run-start gate
**And** neither shell re-implements one. `sync` imports `core`, and that adds no package edge (FR-16, AD-17, AD-12, AD-1).

**Given** `web`
**When** a check fails
**Then** it reports the failing check's payload
**And** it excludes the affected Item Class from the ordering as Unrankable with that reason
**And** it ranks every unaffected row normally
**And** a cross-file failure is not an invalid artifact, because each file is valid on its own (FR-33, FR-16, AD-17, state 27).

**Given** that report
**When** `web` places it
**Then** it lands in `{components.sync-report-panel}` as a **third group in that panel's second column**, under the existing *what is broken* heading, separated from the unresolvable count and the pinned-starvation records by vertical space alone
**And** `columnHeadingRule` is intact: no second heading, no rule, no bullet. The panel goes from five groups to six
**And** it is neither a global region nor inline on the affected Item Class (state 27, UX-DR49, UX-DR22).

**Given** why the panel is the only home that works
**When** a developer is tempted to move it
**Then** the diagnosis is the one piece of content on the page whose length is genuinely unbounded — one line per failing check, across as many as every tracked Item Class — and the panel is the one region permitted to cap itself at `{spacing.sync-report-max-height}` and scroll inside its own band
**And** everywhere else an unbounded list moves the page (UX-DR49, UX-DR6).

**Given** the group's contents
**When** it renders
**Then** it is a **list and not a figure** — one line per failing check, naming the check, the entry and that entry's canonical key
**And** it is the only group in the panel that is not a figure (UX-DR49).

**Given** the back-end-only vocabulary inside those lines
**When** someone checks it against the page's rules
**Then** it is licensed, because this group speaks in **the file's voice** while every figure group speaks in the page's
**And** the licence is one of **register, not audience**. Audience never discriminated in this product: there is one user, he wrote the Tracked List and he is the person fixing the file
**And** a canonical key is a string he copies into an editor, where a figure-group label is read at a glance. Both are legitimate for this reader, and not in the same typographic breath (UX-DR50, UX-DR38).

**Given** the cue that separates the two registers
**When** a developer reaches for one
**Then** it may **not** be a semantic ink. An ink states that a *figure's* footing is degraded or broken, and a failing cross-file check says nothing about any figure on the page — the affected classes are already in the appendix carrying their reason
**And** it is the **mono verbatim register**, at the panel's own size, weight and line height — the diagnosis alone, with every figure group left in the page's voice and its existing face
**And** it is **the same cue** the UX-DR40 fallback takes, because both print text the page did not write. This story invents no second cue, and a divergence from Story 2.5's rendering of it is a defect in whichever shipped later (UX-DR50, UX-DR40).

**Given** the diagnosis
**When** someone proposes promoting it
**Then** it is never promoted out of this panel and never reaches `{components.trust-strip}`, which keeps exactly two health triggers
**And** the player already sees its result as Unrankable rows he can count without expanding anything (UX-DR49, FR-4).

**Given** the payload `sync` writes for the same failure
**When** `SyncRunReport` carries it
**Then** it is a **record** rather than a figure, because it survives the chunk that wrote it and the player's edit is what clears it
**And** if the schema Story 1.2 declared cannot carry the per-check lines this group renders, extending it is this story's work (FR-25, AD-3, Consistency Conventions *Logging*).

**Given** `sync`
**When** a check fails
**Then** the run aborts non-zero before any priced entry consumes budget, leaves `sync-progress.json` untouched, and records the failing payload in `sync-report.json`
**And** the abort is therefore visible on the surface `web` already reads (AD-17, AD-12).

**Given** overlap between two Tracked Entries on one Item Class
**When** `core` tests it
**Then** a predicate decides it, and never an enumeration of shapes, evaluated in §2.1's branch order
**And** the `coOccur` branch sits above the `statId` inequality, or it is unreachable (FR-16, AD-17, §2.1).

**Given** the predicate's four consequences
**When** a test exercises them
**Then** adjacent tiers of one `statId` in one slot are disjoint, so a curator may track both, while `core` still rejects intersecting bands
**And** a partial-affix entry subsumes a fuller one
**And** an absent affix means any roll in that slot, which is why the conjunction covers both
**And** a prefix-only entry and a suffix-only entry on one Item Class overlap each other (FR-16, §2.1).

**Given** an overlap rejection
**When** `core` writes the payload
**Then** it names **both** offending entries by their canonical key, and the slot or slots on which they overlap (FR-16, §2.1, §4.1).

**Given** the within-file branches of that predicate — bands intersect, both valueless, an absent affix
**When** they fire
**Then** they are `contracts`' per-file validation, and they refuse the artifact under AD-3
**And** the `coOccur` branch needs the weights file, so it takes the per-class consequence instead (AD-17, AD-3).

**Given** `coOccur(x, y)`
**When** `core` evaluates it
**Then** it is a direct read of one entry's `lines` over the pool scoped to the Item Class's own crafted floor, with no cohort reasoning (§2.2, AD-11).

**Given** a class absent from `weights.json`, or a class whose pool is `partial`
**When** `core` is asked for `coOccur`
**Then** the answer is `false`, the Tracked List still loads, and the class's unrankability is reported as it already would be
**And** nobody takes the refuse-site-wide reading. The partition `coOccur` protects is never summed for a class already excluded from the ordering (AD-17, §2.2).

**Given** a curator tracking two Stat Lines of one game modifier as two entries in one slot
**When** the list loads
**Then** `core` rejects it. The two always roll together, and one item would be counted twice
**And** pricing that conjunction as one outcome is deferred rather than supported, so the rejection is not a defect (FR-16, §2.2).

**Given** edge alignment
**When** `core` evaluates it
**Then** a `banded` reference's edges must be exactly the extremes of its containment set under the scope
**And** the `statId` filter over a contained entry's lines is load-bearing, so a hybrid entry's foreign line is not pulled into the comparison
**And** `core` evaluates alignment at the entry's own floor, once per Item Class (FR-16, §2.4, AD-17).

**Given** a band of `0 – 9999`
**When** alignment runs
**Then** `core` rejects that band. This is what closes the sentinel loophole that a mere `valueMax` presence leaves open (§2.4, AD-5).

**Given** a band whose ceiling reaches into a tier it does not contain
**When** alignment runs
**Then** `core` rejects that band. The band would silently drop that tier's whole weight, while the search still returns its items in range (§2.4, AD-11).

**Given** an empty containment set
**When** `core` finds one
**Then** it is a validation error, and never a `P = 0`
**And** the payload names the tracked entry by canonical key, the reference, the reference's floor and the absence
**And** the payload names **neither file** as at fault, because `core` cannot tell the two causes apart (FR-16, §2.5, AD-17).

**Given** kind agreement
**When** `core` evaluates it
**Then** the quantifier is **universal**: any scoped line sharing the reference's `statId` that disagrees with the reference's kind is a defect, however many lines agree
**And** a line's kind is read from whether its `ranges` is empty, because the contract carries no `kind` field (§2.3, AD-17).

**Given** class discriminability
**When** `core` evaluates it
**Then** it fails only on the conjunction of `fansOut(entry)` and `¬discriminable(entry)`. Both conjuncts are necessary, and neither is sufficient (§2.6, AD-17, AD-16).

**Given** a failure of that check
**When** `core` handles it
**Then** the payload carries the entry's canonical key, its `className`, its `categoryId`, the sibling count under that `categoryId`, and the reason `class not discriminable`
**And** nothing ever uses a category-wide search as a fallback. That is exactly the silent failure this check exists to make loud. The check protects FR-1's guarantee that no Base Type outside the class contributes (§2.6, FR-1).

**Given** `weights.json` absent
**When** the checks run
**Then** class discriminability does not run, and nothing is lost. Every crafted entry is unrankable already, and `sync` still builds every crafted search without consulting that file (AD-17, AD-24, AD-5).

**Given** the `IMPLEMENTATION-NOTES.md` sections these checks name
**When** a developer builds a shell
**Then** each check's quantifiers, scope and error payload live in those sections and nowhere else
**And** a shell that re-derives one has diverged from AD-17, rather than from a style note (AD-0, AD-17).

### Story 3.4: The crafted EV, Craft Cost and the Craft Recipe control

As the player,
I want Item Classes ranked by threshold-truncated expected value under a Craft Recipe I choose, with the Craft Cost I pay on every attempt shown once,
So that the list ranks the decision I actually make rather than the price of a base.

**Acceptance Criteria:**

**Given** an `(Item Class, recipe)` pair whose tracked entries are `crafted`
**When** `core` computes its EV
**Then** the EV is the sum of `P(combo) × price(combo)` over the Combinations that are priced and whose price is at or above the Payout Threshold, less Craft Cost (FR-1, AD-17).

**Given** the Payout Threshold
**When** `core` compares against it
**Then** it compares against a Combination's **gross** price, and never its price net of Craft Cost
**And** `core` subtracts Craft Cost **once** per Item Class, and never once per Combination. The crafter pays it on every attempt, including the failures (FR-1, AD-17).

**Given** a Combination whose Price State is not `priced`, or whose Curation Status is `pruned`
**When** `core` takes the sum
**Then** that Combination contributes nothing — not zero, nothing — so pruning changes the ranking (FR-1, AD-9, AD-12).

**Given** an Item Class with no Combination above the Payout Threshold
**When** `core` ranks it
**Then** it ranks at an EV of minus its Craft Cost, with an empty summand list
**And** `core` ranks it rather than marking it Unrankable. A threshold that excludes every outcome is an answer about that class, and not an absence of data (FR-1, AD-17).

**Given** the threshold, every price and Craft Cost
**When** they cross a package boundary
**Then** all three are denominated in Divine
**And** `web` supplies the threshold as a value, renders the result, and computes no term (FR-1, AD-17, AD-20, AD-4).

**Given** every `(Item Class, recipe)` pair
**When** `core` ranks
**Then** it ranks every pair inside one ordering, which is what gives AD-17's recipe-id tie-break work to do
**And** `web` renders only the rows whose recipe is the active one, so a crafted class appears on the page exactly once, under the recipe the player chose (FR-1, AD-17).

**Given** that cross product
**When** the player reads the page
**Then** the cross product is an ordering-internal fact, and never player-observable
**And** the list does not double, `{components.craft-recipe}` is a filter, and no row names its recipe (FR-1, FR-26, AD-17).

**Given** FR-5's bound on the rendered list's length
**When** `web` applies it
**Then** it applies that bound **after** the recipe filter, and never before. A bound taken against the cross product and then filtered yields a short list silently. Nothing in the system would report it (FR-5, FR-1, AD-17).

**Given** a Raw Base, which carries no recipe
**When** the active recipe changes
**Then** that Raw Base renders under both recipes unchanged
**And** a recipe switch re-interleaves the mixed list without reordering the raw rows relative to each other
**And** a raw row's own rank may still move as crafted rows reorder around it (FR-3, FR-26, AD-17).

**Given** AD-17's recipe-id tie-break
**When** a test exercises it
**Then** the test asserts against the ordering `core` returns, and never through the view. The view cannot see the comparison it would be testing (AD-17, NFR-3).

**Given** Craft Cost
**When** `core` computes it
**Then** it derives that cost from the `CurrencyRate` set `dataset.json` carries
**And** `sync` never computes or stores a Craft Cost (FR-26, AD-3, AD-20).

**Given** a Craft Recipe
**When** the player adds one
**Then** it is a currency composition the player declares by hand in `data/recipes.json`, and it needs no code change
**And** v1 ships exactly two recipes, and it models neither larger currency quantities nor partial-craft abandonment (FR-26, AD-3).

**Given** a recipe naming a currency with no current rate for the active league
**When** `core` costs it
**Then** it reports that recipe as **uncostable**, and it never costs it at zero. A zero Craft Cost inflates every EV on that recipe (FR-26, AD-20).

**Given** a `CurrencyRate` whose league is not the active league
**When** `core` reads it
**Then** it refuses that rate, and the recipe costed from it is uncostable
**And** `core` never costs that recipe from the stale rate (FR-26, AD-19, AD-20).

**Given** the recipe's declared `modifierLevelMin`
**When** `core` prepares the pool
**Then** it scopes first, truncates the tiers below that floor second, and renormalises third
**And** renormalising before truncating is the error. It leaves a denominator that no longer sums its own numerators (FR-26, AD-17, `IMPLEMENTATION-NOTES.md` §9).

**Given** the two bounds on a tier
**When** `core` tests eligibility
**Then** they are one axis: `recipe.modifierLevelMin ≤ tier.itemLevelMin ≤ entry.itemLevelMin`. The orb's reach bounds from below, and the item's own level bounds from above
**And** reading them as two ladders produces a pool silently wrong in one direction, which never errors (AD-17, §9).

**Given** a `modifierLevelMin` of `0`
**When** a recipe imposes no floor
**Then** the same predicate runs and changes nothing, so there is no separate no-floor code path to get wrong (§9, AD-3).

**Given** an empty surviving pool
**When** no tier survives the floor
**Then** `core` returns that `(Item Class, recipe)` pair as unrankable with that reason, and never as `P = 0`. A zero would rank an impossible craft among merely unprofitable ones (FR-26, AD-17, §9).

**Given** the truncation
**When** it runs
**Then** it happens after containment, and before anything reads coverage
**And** AD-27 coverage is measured on the unrestricted pool. A recipe that cannot reach a tier has not made the producer's file less complete (§9, AD-27).

**Given** two recipes over one Tracked List
**When** `core` ranks both
**Then** they produce genuinely different orderings, rather than one ordering shifted by a constant
**And** an Item Class's Chase Combinations can differ between them (FR-26, AD-17).

**Given** `{components.craft-recipe}`
**When** it renders
**Then** it prints the two options as the single word that distinguishes each composition, `greater | perfect`, divided by a pipe rather than the page's middle dot. The middle dot joins two affixes in every chase cell, and it would carry the opposite operator here
**And** nobody invents a display name. The word follows the grade-prefix rule of EXPERIENCE.md `{components.craft-recipe}` (FR-26, UX-DR19, UX-DR38).

**Given** the inactive word
**When** the page rests
**Then** it carries the page's dotted sepia *this is clickable* rule **at rest**, and that rule goes solid on hover
**And** the inactive word alone is a click target (UX-DR19, UX-DR44).

**Given** the active word
**When** it renders
**Then** it takes a 2px solid sepia rule, of two pixels and not one. Nobody can then read it as `{components.payout-threshold}`'s 1px solid hover on the sibling panel
**And** it is not a click target, and it carries no dotted rule, no hover state and no pointer cursor (UX-DR19, UX-DR44).

**Given** a click on the inactive option
**When** it fires
**Then** the ranking re-runs synchronously against the already-loaded artifacts, with **no debounce**. A click is one deliberate act, where a keystroke is one of several on the way to a value (FR-26, UX-DR19, AD-24, state 34).

**Given** that switch
**When** it completes
**Then** ranks, EV figures **and** Chase Combination sets all change together. A recipe changes which outcomes are reachable, and not only what an attempt costs
**And** open panels stay open and re-render against the new recipe, and nothing closes (FR-26, UX-DR19, state 34).

**Given** the control's form
**When** `web` builds it
**Then** it uses none of Mantine's `SegmentedControl`, `Select`, `Radio` or `Switch`. All four bring a filled track, a radius or a form control's chrome that the page has none of (UX-DR36, UX-DR19).

**Given** the active Craft Recipe
**When** the page reloads
**Then** `web` reads it from the viewer's own browser storage, alongside the Payout Threshold. FR-26 makes it a choice the player declares, rather than a record of a reading position (FR-7, UX-DR37, AD-15).

**Given** Craft Cost
**When** the page prints it
**Then** it appears exactly once, in the line beneath the recipe's options, and never as a seventh ranked-row column
**And** the figure takes `{typography.recipe-cost-figure}`, with `Divine / craft` as a quiet unit beside it, at the page's two decimal places (FR-26, UX-DR20, UX-DR41).

**Given** an uncostable recipe
**When** that line renders
**Then** it holds the money-slot phrase *no figure yet* in its italic sans treatment, and never a zero (FR-26, UX-DR20, UX-DR17, AD-20).

**Given** `{components.expansion-panel}`'s context line
**When** this control ships
**Then** `web` extends that line to repeat the active Craft Recipe beside the active Payout Threshold, which discharges the half Story 2.5 deferred (UX-DR25, FR-26).

**Given** a full ranking pass over the cross product of every crafted Item Class with every recipe
**When** a developer measures it on a mid-range machine
**Then** it completes under 100 ms, measured **against the cross product**, and not against the active recipe's pairs alone (NFR-6, AD-4, AD-17).

**Given** the operation that budget binds
**When** a developer chooses it
**Then** it is a **threshold change**, which re-truncates every EV in both recipes and is debounced at about 150ms
**And** it is not the recipe switch, which is a filter over an ordering already computed (NFR-6, AD-4, UX-DR18, UX-DR19).

**Given** that number
**When** a developer builds this story
**Then** a measurement stands behind it, rather than prose asserting it. No measurement exists today
**And** a miss is remedied by memoising the pure function, and never by precomputing in `sync` (NFR-6, AD-4).

**Given** the inactive recipe's pairs computed inside that pure pass
**When** a developer applies AD-4
**Then** computing them is not the precomputation AD-4 forbids. What AD-4 forbids is a rank, a score or an ordering persisted into an artifact (AD-4).

**Given** state 35, where the active recipe is uncostable
**When** the list renders
**Then** **every row stays.** No row leaves the list, and no Item Class becomes Unrankable
**And** FR-4's reason enum is **not** extended for it, because such a class's Eligible Pool is complete, published and agreeing, so none of FR-4's three strings is true of it. The class is unpriced, not unrankable
**And** the appendix option is dead by name: moving those rows there would print a reason that is not the reason (state 35, FR-26, FR-4, AD-17).

**Given** why the rows can stay
**When** a developer checks the reasoning
**Then** Craft Cost is one figure subtracted equally from every crafted row, and the Payout Threshold compares against a Combination's **gross** price and never touches the cost
**And** the crafted order and the Chase Combination sets are therefore exactly what they would have been
**And** what is genuinely unavailable is only the *distance* between a crafted row and a Raw Base row, which is the missing figure itself (state 35, FR-1, FR-26).

**Given** the two branches in that state
**When** they render
**Then** each keeps its own order, and neither is ordered against the other
**And** **no rank numeral spans the two** — numerals are suppressed, as in the honest-empty state and for the same reason: a numeral is an explicit claim about position that the line below cannot retract, where vertical adjacency under a stated limit is not a claim
**And** `{components.ranked-row-tier-1/2/3}` run **per branch**, so two tier-1 rows is the correct render, and that is the only thing left saying *this is the strong end of its order* (state 35, UX-DR52, UX-DR11).

**Given** the merged-order alternative
**When** someone re-proposes it
**Then** it is rejected on a stated ground and not on taste: its error is **anti-correlated with its own trigger**. A recipe goes uncostable when a currency has no league rate, likeliest for the thinly traded one, and of FR-26's two recipes the rarer-orb recipe carries the larger Craft Cost — so the approximation is worst exactly where it fires
**And** the revisit condition is a **measurement** and never a preference: if Craft Cost is shown small against typical payouts at the default threshold, the merged order becomes defensible and the PRD addendum's revision-19 bullet reopens (state 35, FR-26, PRD `addendum.md` revision 19).

**Given** FR-5's bound in that state
**When** `web` applies it
**Then** it applies **per branch** — up to 20 rows of each, one `{components.expand-affordance}` under each, and neither affordance naming a unit
**And** the count 20 is held rather than halved, because it is a product-owned number and halving it would make the top 20 sometimes a top 10, which is a capability change bought to reclaim page height
**And** the resting page can therefore hold up to 40 rows and scroll, which UX-DR6's clause two accepts as an overrun rather than a breach (state 35, FR-5, FR-26, UX-DR52, UX-DR6).

**Given** the EV cells on crafted rows in that state
**When** they render
**Then** every one holds the money-slot phrase *no figure yet*, and never `0.00` and never a blank
**And** a plain declarative sits above the list in state 25's register, naming the active recipe and stating that the two branches are not comparable while it holds
**And** the raw branch is otherwise unaffected, because it has no Craft Cost to be missing (state 35, UX-DR52, UX-DR17, UX-DR51).

**Given** how often this state fires
**When** someone sizes the work
**Then** it is a **routine** state on the costlier recipe, and not a defensive one. It is built to the same standard as any resting state (state 35, PRD `addendum.md` revision 19).

**Given** state 25, where nothing clears the threshold
**When** the crafted branch renders
**Then** every crafted Item Class is still ranked, at an EV of minus its Craft Cost, so the branch is twenty rows carrying the **same figure** — not an empty list
**And** the rank numerals **print over that tie**, because the order is computed and the figures merely tie (state 25, UX-DR51, FR-1).

**Given** that twenty-way tie
**When** `core` orders it
**Then** AD-17's declared tie-break settles it — on the row's unit key, then the recipe id, comparing the serialised canonical key of AD-5's arm rather than a bare string
**And** because unit keys are distinct, the printed order is fully determined and identical across loads. Nothing here shifts between two builders or two page loads
**And** no story invents a tie-break of its own. `IMPLEMENTATION-NOTES.md` does not own this rule and none of its sections state it, so an acceptance criterion cites AD-17 directly (state 25, FR-1, AD-17, AD-5, finding D-4).

**Given** a raw row and a crafted row at an equal EV
**When** `core` compares them
**Then** the raw row has no recipe id and sorts first, which is what makes the ordering **total across the mixed list** rather than total only within each branch (FR-1, FR-3, AD-17).

**Given** state 36, an Item Class unrankable under one recipe only
**When** it renders
**Then** it is Unrankable while that recipe is active, and it ranks normally under the other recipe
**And** this story does not extend FR-4's reason enum. The string such a case would need is the PRD's to decide, and it is an unresolved `[NOTE FOR UX]` this story surfaces (state 36, FR-4, AD-17).

### Story 3.5: Chase Combinations on the collapsed crafted row

As the player,
I want each crafted row to name the Combinations most worth chasing on it,
So that I know what to look for without expanding anything.

**Acceptance Criteria:**

**Given** a ranked row `core` returns
**When** `web` reads its summands
**Then** each surviving summand carries its own `P(combo) × price(combo)` contribution, ordered by that contribution **descending**
**And** ties break on the canonical entry key, under the byte-wise ordering the Consistency Conventions fix (FR-2, AD-17, §4.1).

**Given** that ordering
**When** a developer chooses it
**Then** it is by contribution to EV, and never by raw price. An ordering by price alone advertises a Combination the player will essentially never roll (FR-2).

**Given** `web`
**When** it renders the chase cells
**Then** it renders a prefix of `core`'s list, and it chooses only how many to render
**And** it computes no ranking term itself (FR-2, AD-4, AD-17).

**Given** the collapsed row
**When** it renders
**Then** it renders at most three Chase Combinations, in three cells inside the row's 492px chase budget (FR-2, UX-DR7).

**Given** the Payout Threshold or the active Craft Recipe
**When** either one changes
**Then** the chase set is recomputed with the ordering
**And** only Combinations at or above the threshold appear (FR-2, FR-6, FR-26).

**Given** an Item Class whose priced Combinations all fall below the threshold
**When** it renders
**Then** its chase cells are empty
**And** its EV is negative by its Craft Cost, rendered as a real quantity at two decimal places rather than as a money-slot phrase
**And** it is **ranked, not Unrankable**. A threshold that excludes every outcome is an answer about that class, and not an absence of data (FR-2, FR-1, AD-17, state 21).

**Given** a Raw Base row
**When** it renders
**Then** it has no chase cells at all, and it carries its full-width italic note in their place. There is nothing to chase on it (FR-3, UX-DR13).

**Given** a chase cell's text
**When** someone writes it
**Then** it is the declared Accepted Tier plus the canonical short form per affix, joined by the page's middle dot — `T1 Cold Res · T1 Mana` — and never the value (UX-DR39).

**Given** a short form
**When** someone coins it
**Then** five rules govern the coinage (UX-DR39):
  1. No Glossary term is abbreviated.
  2. A form is borrowed from what the player already reads, and never invented here.
  3. A form is unique across the whole table.
  4. A form is written once, and never varied per row.
  5. The tier prefix is never abbreviated and never varied, and a mixture takes an en dash.

**Given** the chase-cell budget of about 27 characters
**When** a legitimate form still overruns that budget when paired
**Then** the entry is a candidate for **pruning**, rather than for a shorter coinage, and nobody cuts a word to make it fit
**And** a form that does overrun ellipsises, and the full text sits one click down in the expansion (UX-DR39, UX-DR26).

**Given** two tracked bands of one modifier on one Item Class that declare the same `acceptedTier`
**When** both render
**Then** they can read identically. The value text that used to tell them apart has gone, and short-form uniqueness does not reach this case
**And** what the second one prints is an unresolved `[NOTE FOR UX]`. This story surfaces that gap rather than settling it (UX-DR39).

### Story 3.6: Provenance, the uniform-prior banner, and the appendix's remaining reasons

As the player,
I want to tell a figure resting on measured weights from one resting on an invented prior, and to see the classes the tool cannot rank at all,
So that I discount a row rather than acting on it, and a placeholder never keeps my trust months after it stopped deserving it.

**Acceptance Criteria:**

**Given** every derived figure
**When** `core` produces it
**Then** it carries the **weakest** Provenance and the **oldest** timestamp of every input, with no exception (FR-10, AD-10).

**Given** Provenance
**When** `core` derives it
**Then** it comes only from the sources AD-10's table names
**And** `"absent"` maps to `uniform-prior`, and never to Provenance `absent`
**And** `web` never prints that marker's own words on screen (FR-10, AD-10, UX-DR38).

**Given** a probability's inputs
**When** `core` propagates Provenance
**Then** the inputs are the ones AD-10 scopes to each `(itemClass, recipe)` pair, numerator and denominator alike
**And** one invented tier among them therefore makes **every** probability of that pair read `uniform-prior`
**And** that consequence is deliberate, rather than a defect (FR-10, AD-10, state 12).

**Given** the per-row mark
**When** it renders
**Then** it carries one label per `(itemClass, recipe)` pair, and it belongs to the ranked row
**And** it discriminates **between** ranked rows, and never within one
**And** two recipes on one Item Class may carry different labels, so a recipe switch may change a class's mark (FR-10, FR-11, AD-10).

**Given** two render treatments, and not three
**When** a figure renders
**Then** a `measured` figure is plain, a figure resting on anything weaker is visibly degraded, and `absent` renders as an unknown rather than as a number
**And** colour alone carries neither distinction (FR-10, AD-10, NFR-10).

**Given** the mark's wording
**When** it renders
**Then** `uniform-prior` reads *prior only*, and `absent` reads *unknown*, each a gloss beside the term rather than a synonym replacing it
**And** the enum value still appears in the key block and in the expansion (UX-DR15, UX-DR38).

**Given** the exchange observation that normalised a price
**When** `core` computes Provenance
**Then** that observation participates like any other input. A hand-maintained rate the player last touched months ago therefore drags the freshness of everything costed from it (FR-10, AD-20, AD-10).

**Given** the Weights File's declared producer, generation time and game patch
**When** a figure they influenced renders
**Then** the trust strip renders those three beside it, so a file left behind by a patch is visible as such (FR-10, AD-11, UX-DR21).

**Given** Provenance `absent`
**When** `core` reaches it
**Then** it arises from a `partial` pool and nowhere else
**And** it cannot occur on a ranked row. A `partial` pool makes the Item Class Unrankable, so `absent` is exercised only inside the appendix (FR-10, AD-10, AD-17).

**Given** no probability in the loaded set carrying `measured`
**When** the page renders
**Then** the page raises `{components.uniform-prior-banner}` above the list
**And** the banner states that the whole ranking rests on a uniform prior, and that ordering between Item Classes is not evidence-backed
**And** it points the player at per-row freshness instead (FR-11, UX-DR24, state 19).

**Given** the banner
**When** the page raises it
**Then** the page reads that condition from the loaded data, and never from a build flag
**And** the banner carries an ochre left marker, and it is dismissible for the session only
**And** it lowers itself the moment any `measured` figure appears (FR-11, UX-DR24).

**Given** the banner up
**When** a row carries `uniform-prior`
**Then** that row still carries its own mark. The per-row badge is required regardless (FR-11, FR-10).

**Given** the banner's wording, the mark's wording and the key block's wording
**When** someone writes it
**Then** it says that something in the pool was invented, and no more
**And** it never says that the pool is invented throughout (FR-11, AD-10).

**Given** an Item Class whose Eligible Pool for either slot is not `complete`, or for which the Weights File publishes no pool at all
**When** `core` ranks the list
**Then** that class leaves the ordering and appears in `{components.unrankable-appendix}` with its reason
**And** `core` never substitutes an invented pool (FR-4, AD-17).

**Given** the three reasons
**When** the page prints them
**Then** they are `pool partial`, `class absent from weights file` and `class disagrees with weights file`, verbatim
**And** a direct lookup of the named `(categoryId, className)` in `bases` separates the first two, with nothing inferred (FR-4, AD-17).

**Given** an Item Class excluded by any of AD-17's five cross-file checks
**When** its appendix row renders
**Then** it carries the third string. Such a class has a `complete`, published pool, and neither of the other two strings is true of it
**And** **one string covers all five checks**. Which check failed, which entry failed it, and that entry's canonical key are diagnosis, and they never appear in the appendix (FR-4, AD-17, state 15a).

**Given** that row's quiet note
**When** someone writes it
**Then** it may say that the class's pool is published and complete, and that the disagreement is in the player's own Tracked List. It is the one Unrankable row the player can fix
**And** it may **not** name the check, the entry or its key. Those are diagnosis, and they belong in `{components.sync-report-panel}`'s second column, which Story 3.3 builds (state 15a, state 27, UX-DR49).

**Given** a pool present, declaring `complete`, over no entries at all
**When** `core` meets it
**Then** it reports the cause it observed, and it never relabels that cause as `partial`
**And** if FR-4's enum has no member for that cause, that is a finding for the PRD rather than a licence to relabel (FR-4, AD-17).

**Given** `{components.unrankable-appendix}`
**When** this story reaches it
**Then** Story 2.8 already built it — the four cells summing to 970px, the foot pin, the readable count, the non-interactive rows, the Item-Class-only rule and the Base-Types-still-rank note
**And** this story **adds to that structure** rather than rebuilding it: the two reason strings day one never renders, the quiet notes those strings carry, and the Provenance `absent` case
**And** no column sum and no layout decision is reopened here (FR-4, UX-DR8, UX-DR29, Story 2.8).

**Given** any coverage figure
**When** it moves
**Then** the page never switches layout on a measurement. There is one arrangement in every data state (FR-4, UX-DR29).

**Given** pool coverage
**When** a component computes it
**Then** `sync` computes §3's fraction over rankable Item Classes, and `web` only renders it
**And** `web` does not recompute it, even though it holds both files. Two figures on two surfaces would be the divergence AD-27 exists to prevent (FR-4, AD-27, §3).

**Given** `covered(cat)`
**When** `sync` evaluates it
**Then** all three conditions bind: the two-rung lookup resolves, both slots declare `complete`, and neither slot's pool is empty
**And** neither rung falls back to a sibling class (AD-27, §3).

**Given** a class whose every crafted entry is `pruned`
**When** `sync` computes coverage
**Then** that class is not rankable, and it enters neither half of the fraction
**And** a raw entry never appears in either half. Its unit is not a member of the fraction's universe (AD-27, §3).

**Given** an unresolved Stat Line
**When** `sync` computes coverage
**Then** it does not affect the figure. It is data, rather than a completeness failure (FR-28, AD-27, §3).

**Given** the published figure
**When** `sync` writes it
**Then** it is a `number` in `[0, 1]` — a fraction, and never a percentage — carried beside its denominator
**And** `sync` measures it before any view work, and measures it again on every Weights File regeneration
**And** no threshold reads it. The coverage bands were withdrawn (FR-4, AD-27, §3).

**Given** `weights.json` absent
**When** the report covers coverage
**Then** the fraction and its denominator are omitted **together**, which is how undefined is spelled
**And** `web` must never render that omission as `0%` (FR-4, AD-27, §3).
