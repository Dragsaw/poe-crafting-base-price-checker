# Epic 6 Context: The Pick-up Filter

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

After the pre-session read, the player downloads an in-game item filter (`crafting-bases.filter`) built from the ranking on screen under the current Payout Threshold and Craft Recipe. On the ground, each base worth picking up shows what it is for (craft on it, sell it raw, or identify it and check the rolls), and every other item keeps the look of the player's own NeverSink Base Filter, so he reads no list mid-map (UJ-7). The epic adds one header control and one modal, and changes no ranking, no sync behaviour and no artifact.

## Stories

- Story 6.1: The purpose of each base, decided once in `core`
- Story 6.2: The filter text, Show-only, with the Base Filter imported last
- Story 6.3: The filter button, the filter modal and the download
- Story 6.4: One purpose per drop when a base is tracked at two floors

## Requirements & Constraints

**The filter is a snapshot (FR-35).** It shows exactly what the ranking says under the dial on screen at generation. It makes no second judgement: weak or stale figures enter unmarked. It never names a Combination, a modifier or a price. It adds visibility and never hides an item. A dial or price change reaches the game only on the next download. Generation needs no network request and no sync.

**Purpose rule (FR-36). Each named drop carries exactly one purpose, which can differ by rarity on the same base.**

- *Which bases:* the non-pruned Raw Bases of the Tracked List (FR-15). A pruned base gets no entry. The one exception is a jewel kind: jewels never drop white, so the jewel kind itself is the base.
- *EV gate:* an Item Class C is worth crafting when EV(C) under the current threshold and recipe is > 0. The threshold is not applied again as a cutoff, because it already shapes EV (FR-1).
- *raw value(B):* the Raw Base's price when at or above the Payout Threshold, else 0, as FR-3 truncates a Raw Base.
- *White Raw Base B of class C:*
  - **craft** when EV(C) > 0 and raw value(B) < EV(C).
  - **sell raw** when raw value(B) > 0 and raw value(B) >= EV(C). The equal case is sell raw.
- *Magic drop of Raw Base B:* **check the rolls** when EV(C) > 0 and the game shows the unidentified tier as 4 or 5 (the two best).
- *Jewels:* any magic jewel whose class (its jewel kind) has EV > 0 is **check the rolls**, with no unidentified-tier condition, because jewels drop with no such tier. A jewel kind never gets a white entry.
- *No EV:* a class that is Unrankable (FR-4), has no priced Combination (FR-9), or sits under an uncostable recipe (FR-26, state 35) or no published recipe (state 43) gets no craft and no check-the-rolls entry. Its Raw Bases are sell raw when raw value(B) > 0.
- *EV <= 0* (for example state 25): no craft and no check-the-rolls entry for that class.
- *Unpriced Raw Base:* a missing price is never zero (FR-9). It has no sell-raw entry. It is craft when EV(C) > 0. Its check-the-rolls entry depends on EV(C) alone.
- *One base at two floors (FR-36, PRD revision 36):* a drop belongs to the Raw Base with the highest Item Level Floor it reaches and takes its purpose from that Raw Base alone. If that Raw Base gives no purpose, no block names the drop. Story 6.4 builds this rule.
- *Item-level floors (FR-36, FR-22, AD-17):* every drop must be at or above its Raw Base's own Item Level Floor. Craft and check the rolls must also reach the floor that the class's crafted entries share, because that floor scopes the EV. A jewel kind uses its class's shared floor.

**Treatments (FR-37, NFR-10).** One treatment per purpose, never graded by EV, quiet (unhide and label, not alarm), carrying the colour meaning NeverSink's filter gives that kind of item, bounded by what the game's filter syntax can express. NFR-10's colour floor binds the view, not the filter.

**Testing.** Pure, deterministic output: equal inputs give an equal list and byte-identical text (NFR-3). No test makes a network call (NFR-1). `pnpm check` passes per story.

## Technical Decisions

- **One evaluator (AD-31, AD-1, AD-4).** `core` holds one pure purpose function over the read-time ranking, the Tracked List, and the threshold and recipe as passed-in values. No other module evaluates FR-36. Each entry carries `baseTypeId`, rarity, item-level floor, an optional unidentified-tier condition, and one purpose. Order is by canonical key under UTF-8 code-unit comparison, never locale collation (Consistency Conventions, *Entity keys*).
- **`web` writes the text (AD-31).** The serialiser and its tests own each treatment. No planning document restates a treatment.
- **File layering (AD-31).** Only `Show` blocks: no `Continue`, no `Hide`. The game stops at the first match, so a block is final for its item. The last line is an `Import` of the Base Filter's file name, after every block. With an empty purpose list, the text is the `Import` line alone. The tool never reads or writes the Base Filter.
- **Match form (AD-31).** Each block matches by `BaseType ==` (exact) on `baseTypeId`, plus the rarity, item-level and unidentified-tier conditions. Never by `Class`, and never by a substring `BaseType`, which would catch a longer name that has this name as a prefix. A jewel kind matches by its own `baseTypeId`, taken from the catalogue-validated jewel arm (Consistency Conventions, *Ids*: no component re-encodes an id).
- **Download (AD-15, AD-24).** A `Blob` behind an `<a download>`, built in memory from artifacts already loaded. No request. No File System Access API or other page-performed write: that would need an amendment to AD-15 (deferred in the spine). The file-name field persists in browser storage. A storage access that throws must leave the page working (FR-7).

## UX & Interaction Patterns

- **`filter-button`** (label `Filter ▾`) sits in the header before the sync button. It has the sync-button look with no problem state. The header never wraps.
- **`filter-modal`** is the one modal in the product. It opens and closes instantly, with no transition, on Esc, the overlay or ×. The page under it does not re-rank. Its look is in DESIGN.md `filter-modal` and `mockups/key-filter-modal.html`.
- **Interaction 9:** the lead names the live threshold and recipe (state 43 has its own form). Four numbered steps show at every visit. Step 1 has the folder path and a copy action: the path goes to the clipboard verbatim, `%UserProfile%` unexpanded, and the label reads `Copied` for about 2 s. Step 2 is the file-name field. Step 3 holds the state 46/47 line, then the download action. Step 4 is text only. A download closes the modal with no confirmation. A later dial move marks nothing out of date.
- **Field states:** state 44 (empty) disables the download. State 45 is a name with `"`, `/` or `\`, or one equal to `crafting-bases.filter` ignoring case after `.filter` is added. It disables the download and shows its error on blur, never on a keystroke. A missing `.filter` is not an error: the page adds it at generation. The name saves on each edit that leaves it usable. The modal always starts closed after a reload.
- **State lines:** state 46 (no EV under state 35 or 43) and state 47 (nothing qualifies). The state 47 line replaces the state 46 line when both hold. The download stays enabled in both.
- Every string comes from the EXPERIENCE.md Copy Deck, *Pick-up Filter*. Do not invent copy.

## Cross-Story Dependencies

- The stories run in order: 6.1, then 6.2, then 6.3, and 6.4 at any point after 6.2. 6.2 serialises the output of 6.1. 6.3 calls both on download. Only 6.3 has UI.
- 6.1 is done: `core` exports the purpose function and its entry types. The Payout Threshold reaches it only through the ranking that `rank` built under that threshold, so 6.3 passes the ranking on screen and never a second threshold (a second one could disagree and make a second judgement, which FR-35 forbids).
- 6.4 builds the FR-36 rule for one base at two floors (PRD revision 36). It changes only the outputs of 6.1 and 6.2, adds no UI, and can land before or after 6.3. 6.3 adds no rule of its own for this case.
- Builds on Epics 2 and 3 for the raw branch, EV under the dial, the Item Level Floor and the recipe states (35, 43). It adds no artifact and no external dependency.
- 6.3 ends in a human acceptance step: load the file next to a real NeverSink export in the game. No offline test can run the game's filter parser.
