# Epic 4 Context: Rarity Dark — the redesigned page

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Epic 4 restyles the page that Epics 1 to 3 shipped. The ranked list stays the same, and it now sits on one dark charcoal page coloured by game rarity. A crafted Item Class prints in magic blue and a Raw Base in normal grey. Silence is the statement: a row with a current price and measured odds carries no mark. A row speaks only when its price needs attention. Sync health shows on the header without a click. The epic also moves the price-trust verdict into `core`, retires the paper direction's leftover components, and corrects the recipe floor so that a greater or perfect recipe is valued on the modifiers it can really roll. It changes no sync behaviour. `EXPERIENCE.md` revision 25 and `DESIGN.md` revision 19 are the source of truth for the page. Acceptance criteria cite state numbers and sections of those documents. They never copy a string, threshold or token value.

## Stories

- Story 4.1: The dark token set, bundled Inter and the sticky header bar
- Story 4.2: The price-trust verdict in `core`
- Story 4.3: The ranked row — rarity names, the uncrafted-base line, the mark slot and the odds cue
- Story 4.4: The expansion — one line per entry, top lines and the trust reasons
- Story 4.5: Header controls and the sync button
- Story 4.6: The footer legend, list statements, failure screens and the appendix restyle
- Story 4.7: The recipe floor per modifier group

## Requirements & Constraints

- Epic 4 retouches FR-3, FR-6 to FR-13, FR-18, FR-24 and FR-25. Their ownership stays with Epics 1 to 3. NFR-10 is the epic's own requirement.
- **Colour alone never carries a meaning (NFR-10).** The page must still read with every colour removed. Price trust shows by mark silhouette, and the empty slot is the fourth state. Estimated odds show by ≈. Crafted versus Raw Base shows by the sell-as-is line. Rank emphasis and dimmed figures show by weight and the minus sign.
- A contrast floor of 4.5:1 applies to all text on every surface it sits on. Measure each new colour pairing before it ships.
- A missing figure is never `0`, `0.00` or blank. It is `—` beside a mark, or a phrase where no mark sits.
- A threshold or recipe change re-ranks synchronously and locally, under 100 ms (NFR-6), with no network request. Only the threshold and the active recipe survive a reload.
- Static delivery (NFR-7): the page fetches no font from a third party.
- `web` derives no trust fact, no freshness cut-off and no problem count of its own.
- `pnpm check` must be green after each story.

## Technical Decisions

- **Theme.** The Mantine theme override layer carries the dark token set of `DESIGN.md`, replacing Mantine's palette, radii, shadows and type ramp. Build `theme.primaryColor` from the bronze accent, so that no Mantine blue appears (blue reads as rarity magic). `defaultRadius` is 0: rows and panels are square, and only controls and floating layers are rounded. One dark theme; it does not follow the OS colour scheme. No component reads a retired paper token.
- **Typography.** Inter is bundled as `@fontsource-variable/inter`, at the version the spine's Stack table pins. Every role declares a `lineHeight`, because Mantine's default of 1.55 changes row heights. Font sizes are literal px. Column figures use tabular numerals. The marks ◐ ○ ✕ ≈ ▾ ↗ ■ ≥ are inline SVG in a 1em box, not glyphs.
- **Price trust (AD-17, AD-10).** `core` computes a four-state verdict (current, rough, pending, broken) with its reason, on every `RankedRow` and beside every combination. Inputs are the Price State, the age under AD-10's clock and `sampleSize`. The age is `observedAt` when an observation exists, else `lastAttemptedAt`; a never-attempted entry has no age. The clock is passed in. The old, thin and share thresholds are `core` named constants, not config, and `web` never copies them.
  - A raw row's verdict is its one entry's verdict.
  - A crafted row follows the ordered rules of *Price trust*, first match wins. *No priced combination* matches before the share rule. No zero-gross fallback.
  - The share rule sums gross value over every `priced` non-pruned entry of the class, below-threshold entries included, so the threshold never moves a verdict. Pending and broken entries are in neither sum.
  - Weakest-input propagation follows AD-10 only.
- **Recipe floor (AD-17, spine revision 34).** A recipe's `modifierLevelMin` applies per `modGroup` within a slot, after AD-5's scope. A group with a tier at or above the floor loses its tiers below it. A group whose highest tier in the unscoped pool is below the floor keeps that tier alone at its own weight; the floor never removes a whole group. A hybrid is its own group, and groups sharing a `statId` are not merged. Order: scope, floor, renormalise, then exclusion and containment; coverage is read on the unrestricted pool. A floor of `0` changes nothing through the same path. The transform truncates and renormalises; it never reweights.
- **Reach verdict.** `core` exposes whether a recipe can reach an entry, per `(entry, recipe)` pair, replacing `canRecipeRoll`. An unreachable pair is a curation defect: `pnpm tracked:check` lists it under `unreachable` and exits non-zero, and `pnpm test:data` fails on the same list. Ranking keeps a backstop: an unreachable entry makes its `(itemClass, recipe)` pair unrankable (state 36), never a probability of zero.
- **Sync problems (AD-12).** Broken entries count from dataset entries with state `unresolvable`, not from the report's `unresolvable` records. Starved pinned entries count from the `pinned-starvation` record that matches the loaded curation. A stale patch has no source and cannot fire in v1. The count is of affected entries, not problem kinds. A cross-file failure, an absent tolerable file and attribution ages are never counted problems.
- **Trade link (AD-24, FR-33).** The ↗ shows only when the entry stores a `lastSearchId` from the active league. Test the stored field, not the Price State. A pruned line has no link. The link opens in a new tab.
- **Retirements.** Story 4.6 deletes `UniformPriorBanner`, `KeyBlock`, `TrustStrip` and `RunningFoot`, with their tests and their dependency-cruiser exceptions. The global estimated-odds banner is retired (state 19); ≈ is per row only.

## UX & Interaction Patterns

- **Regions in fixed order:** sticky header bar, the sync report panel when open, the list statement when one applies, the column header, the ranked rows, the list show-more, the Unrankable appendix and the footer legend. The page never switches layout on data. The header bar is the only pinned region; the sync report is the only region that scrolls inside itself. The frame is centred and bounded; a narrower viewport scrolls sideways. Target: a 1080×1920 portrait monitor.
- **Header bar.** League eyebrow and title on the left. The recipe toggle with Craft Cost, the threshold control and the sync button on the right. It never wraps or shrinks; re-measure it against `DESIGN.md`'s width budget. The sync button shows the age when healthy and the problem count in place of the age when a problem holds, never both.
- **Cold load (state 22).** The header bar, the final column header and twenty flat skeleton bars paint at once in the final layout, with no shimmer. Every artifact resolves in a single transition.
- **Ranked row.** Four columns: rank, name, EV, best combinations. The mark slot is always reserved, so every figure ends at the same x. The EV cell holds ≈ when odds are estimated, then the figure, then the mark. The whole row is one click target. An open row shows an inset bar and moves no column. Ranks 1–5 are emphasised by weight and numeral colour, never size.
- **Controls.** The threshold slider snaps to 0.05 and re-ranks live; the typed figure re-ranks debounced. The recipe toggle is a segmented control, re-ranks undebounced and keeps open panels open. States 35, 42 and 43 handle an uncostable recipe, one recipe and no recipe.
- **Expansion.** Opens in place and instantly; several panels may be open. A context line comes first, then one line per entry: priced by contribution, below-threshold, pending, broken. Pruned lines sit behind `+ N pruned`. The panel opens on its top lines with a remainder affordance (state 39).
- **Tooltips** are only the row mark, the EV label and a cut chase cell, and never hold a control. Modals, drawers, sorting, animation and polling are banned.
- **Open gaps** are left to the build stories; a story that meets one raises it and does not settle it silently: the failure paths of UJ-3 to UJ-5, the page when `sync-report.json` is absent, the state 35 branch boundary and its suppressed ranks, the show-more affordance at 20 rows or fewer, an expansion whose every line is pruned, and a non-numeric threshold entry.

## Cross-Story Dependencies

- Order: 4.1, then 4.2, then 4.3, then 4.7 ahead of 4.4 to 4.6, then 4.6 last. Story 4.7 touches no UI file of 4.4 to 4.6. Story 4.1 provides the token layer and the header bar slots that Story 4.5 fills. Stories 4.3 and 4.4 render the verdict that Story 4.2 returns, and `web` must not recompute it. Story 4.6 retires components only after Stories 4.3 to 4.5 have replaced what they did.
- After Story 4.7, previously pruned `tracked.json` entries are re-checked with the tracked-json skill, and reachable ones are restored. Any entry still unreachable stays pruned so `test:data` stays green.
- The epic builds on the Epic 2 page (rows, threshold, expansion, sync report, appendix) and the Epic 3 crafted branch (recipe control, chase cells, Provenance). Story 4.7 supersedes Story 3.4's recipe-floor rule. The epic changes nothing in `sync`.
