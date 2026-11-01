# Forged idea: crafting-base loot filter (PoE 2)

Status: hardened on 2026-10-31. Brought up to date on 2026-11-01. Landed in PRD revision 35 (FR-35 to FR-37) and spine revision 46 (AD-15, AD-31). Memlog: `.memlog.md` in this folder.

## Decisions

- **Mechanism (AD-31).** The generated file is the filter the player selects in the game. Its last line imports the FilterBlade export, whose filename the player gives when generating. Nobody edits either file by hand. An in-game test verified this on 2026-11-01. All 90 tracked raw base ids appear in active `BaseType` lines of the NeverSink export.
- **Generation.** The web view generates the file from the current Payout Threshold and Craft Recipe, and makes no request.
- **Delivery (AD-15).** The player downloads the file in Chromium, saves it over the old file, and reloads the filter in the game.
- **Precedence.** The file contains only `Show` blocks, without `Continue`, and matches with `BaseType ==`. The app's treatment is final for every item it names, and it overrides FilterBlade's per-base styling. The file hides nothing.
- **Bases.** The tracked raw bases are the bases worth crafting on, and the player curates that list. Jewel kinds are an exception. Runeforged and Runemastered variants never drop, so they get no rule.
- **Rules (FR-36).** B is a tracked raw base and C is its class. raw value(B) is its price when that price is at or above the Payout Threshold, and 0 otherwise.
  - **Craft:** white, EV(C) > 0, and raw value(B) < EV(C). An unpriced base also counts as craft.
  - **Sell raw:** white, raw value(B) > 0, and raw value(B) ≥ EV(C).
  - **Check rolls:** magic, `UnidentifiedItemTier >= 4` (tier 5 is best), and EV(C) > 0. This also covers any magic jewel whose class has EV > 0.
  - **No EV:** a class with no EV gets the sell-raw rule only. A class has no EV when it is Unrankable, has no priced Combination, or its recipe is uncostable.
  - **Weak or stale figures:** they go into the file unmarked. The file is the ranking at the moment the player saves it.
- **Style (FR-37).** One quiet treatment per purpose, with no EV levels. Each treatment reuses NeverSink's colour meanings. The game's filter features limit the treatments, so NFR-10 does not bind them.

## Rejected

- **FilterBlade preset module.** No schema exists, it needs a UI bot, and it would hold a second copy of the threshold and recipe that drifts.
- **Manual paste.** This is now only the fallback.
- **A stub that imports the generated file, then FilterBlade.** It is one more file for the player to write and manage. Its one gain, that a missing generated file leaves FilterBlade running, does not matter: the player sees a missing filter at once and selects FilterBlade directly.
- **Skipping NeverSink's bases.** It couples the app to NeverSink's format and conflicts with FR-1.
- **`Continue` styling.** NeverSink's hide layer would hide the items again.
- **File System Access write.** It needs an AD-15 amendment. Deferred in the spine.
- **Account upload (OAuth).** GGG is "currently unable to process new applications", and the approach breaks AD-15. Deferred in the spine.
- **EV > threshold as the cutoff.** It counts the threshold twice.
- **Graded or loud styles.** These items are common, and the filter only needs to unhide and label them.

## Open

- `EXPERIENCE.md`: the exact treatments.
