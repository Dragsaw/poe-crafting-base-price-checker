# Epic 4 Context: Rarity Dark — the redesigned page

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Epic 4 restyles the page that Epics 1 to 3 shipped. The ranked list stays the same, and it now sits on one dark charcoal page coloured by game rarity. A crafted Item Class prints in magic blue and a Raw Base in normal grey. Silence is the statement: a row with a current price and measured odds carries no mark. A row speaks only when its price needs attention. Sync health shows on the header without a click. The epic also moves the price-trust verdict into `core` and retires the paper direction's leftover components. It changes no sync behaviour. `EXPERIENCE.md` revision 25 and `DESIGN.md` revision 19 are the source of truth. Acceptance criteria cite state numbers and sections of those documents. They never copy a string, threshold or token value.

## Stories

- Story 4.1: The dark token set, bundled Inter and the sticky header bar
- Story 4.2: The price-trust verdict in `core`
- Story 4.3: The ranked row — rarity names, the uncrafted-base line, the mark slot and the odds cue
- Story 4.4: The expansion — one line per entry, top lines and the trust reasons
- Story 4.5: Header controls and the sync button
- Story 4.6: The footer legend, list statements, failure screens and the appendix restyle

## Requirements & Constraints

- Epic 4 retouches FR-3, FR-6 to FR-13, FR-18, FR-24 and FR-25. Their ownership stays with Epics 1 to 3. NFR-10 is the epic's own requirement.
- **Colour alone never carries a meaning (NFR-10).** The test is that the page still reads with every colour removed. Price trust shows by mark silhouette, and the empty slot is the fourth state. Estimated odds show by ≈. Crafted versus Raw Base shows by the sell-as-is line. Rank emphasis and dimmed figures show by weight and the minus sign.
- A contrast floor of 4.5:1 applies to all text on every surface it sits on. Do not put a colour on a surface where `DESIGN.md` shows it below the floor. Measure each new colour pairing before it ships.
- A missing figure is never `0`, `0.00` or blank. It is `—` beside a mark, or a phrase where no mark sits.
- A threshold or recipe change re-ranks synchronously and locally, under 100 ms (NFR-6), with no network request. Only the threshold and the active recipe survive a reload.
- Static delivery (NFR-7): the page fetches no font from a third party.
- `web` derives no trust fact, no freshness cut-off and no problem count of its own.
- `pnpm check` must be green after each story.

## Technical Decisions

- **Theme.** The Mantine theme override layer carries the dark token set of `DESIGN.md`. Tokens replace Mantine's palette, radii, shadows and type ramp. Build `theme.primaryColor` from the bronze accent, so that no Mantine blue appears, because blue reads as rarity magic. Set `defaultRadius` to 0. Rows and panels are square, and only controls and floating layers are rounded. The page has one dark theme and does not follow the OS colour scheme. No component may read a retired paper token.
- **Typography.** Inter is bundled as `@fontsource-variable/inter` 5.3.0, as the spine's Stack table pins it. Every role declares a `lineHeight`, because Mantine's default of 1.55 changes row heights. Replace `theme.lineHeights` and `theme.headings`. Pass font sizes as literal px. Column figures use tabular numerals. The marks ◐ ○ ✕ ≈ ▾ ↗ ■ ≥ are inline SVG in a 1em box, not glyphs. Verify that the bundled Inter holds − † * · — and – at every weight it renders, and report any gap.
- **Price trust (AD-17, AD-10).** `core` computes a four-state verdict (current, rough, pending, broken) and its reason. It returns the verdict on every `RankedRow` and beside every combination. The inputs are the Price State, the age under AD-10's clock and `sampleSize`. The age is `observedAt` when an observation exists, and `lastAttemptedAt` otherwise. A never-attempted entry has no age. The clock is passed in. The old, thin and share thresholds are `EXPERIENCE.md` *Price trust* values. `core` holds them as named constants. They are not config and not an artifact, and `web` never copies them.
  - A raw row's verdict is the verdict of its one entry.
  - A crafted row's verdict comes from the ordered rules of *Price trust*, and the first match wins. The *no priced combination* rule matches before the share rule. `core` implements no zero-gross fallback.
  - The share rule sums gross value over every `priced` non-pruned entry of the class, including entries below the threshold. Thus the threshold never moves a verdict. Pending and broken entries are in neither sum.
  - Weakest-input propagation follows AD-10 only.
- **Sync problems (AD-12).** Broken entries count from dataset entries with state `unresolvable`, not from the report's `unresolvable` records. Starved pinned entries count from the `pinned-starvation` record that matches the loaded curation. A stale patch has no source and cannot fire in v1. The count is of affected entries, not of problem kinds. A cross-file failure, an absent tolerable file and attribution ages are never counted problems.
- **Trade link (AD-24, FR-33).** The ↗ shows only when the entry stores a `lastSearchId` from the active league. Test the stored field, not the Price State. A pruned line has no link. The link opens in a new tab.
- **Retirements.** Story 4.6 deletes `UniformPriorBanner`, `KeyBlock`, `TrustStrip` and `RunningFoot`, with their tests and their dependency-cruiser exceptions. The global estimated-odds banner is retired (state 19). ≈ is per row only.

## UX & Interaction Patterns

- **Regions in fixed order:** sticky header bar, then the sync report panel when open, then the list statement when one applies, the column header, the ranked rows, the list show-more, the Unrankable appendix and the footer legend. The page never switches layout on data. The header bar is the only pinned region. The sync report is the only region that scrolls inside itself. The frame is centred and bounded. A narrower viewport scrolls sideways. The target is a 1080×1920 portrait monitor.
- **Header bar.** League eyebrow and title on the left. The recipe toggle with Craft Cost, the threshold control and the sync button on the right. It never wraps or shrinks. Re-measure it against `DESIGN.md`'s width budget. The minutes age form is `Synced 59m ago`. The sync button shows the age when healthy and the problem count in place of the age when a problem holds. It never shows both.
- **Cold load (state 22).** The header bar, the column header with its final labels and twenty flat skeleton bars paint at once in the final layout. The bars have no shimmer. Every artifact resolves in a single transition.
- **Ranked row.** It has four columns: rank, name, EV and best combinations. The mark slot is always reserved, so every figure ends at the same x. The EV cell holds ≈ when the odds are estimated, then the figure, then the mark. The whole row is one click target. An open row shows an inset bar and moves no column. Ranks 1–5 are emphasised by weight and numeral colour, never by size.
- **Threshold control.** A slider snaps to 0.05 and re-ranks live. The typed figure re-ranks debounced. **Recipe toggle.** It is a segmented control, re-ranks undebounced, and keeps open panels open. States 42 and 43 handle one recipe and no recipe.
- **Expansion.** It opens in place and instantly, and several panels may be open at once. A context line comes first. Then one line per entry, in this order: priced lines by contribution, then below-threshold lines, then pending, then broken. Pruned lines sit behind `+ N pruned`. The panel opens on its top lines and shows a remainder affordance (state 39).
- **Tooltips.** There are only three kinds: the row mark, the EV label and a cut chase cell. A tooltip never holds a control. Modals, drawers, sorting, animation and polling are banned.
- **Open gaps.** These are left to the build stories. A story that meets one raises it and does not settle it silently. The gaps are: the failure paths of UJ-3 to UJ-5, the page when `sync-report.json` is absent, the state 35 branch boundary and its suppressed ranks, the show-more affordance at 20 rows or fewer, an expansion whose every line is pruned, and a non-numeric threshold entry.

## Cross-Story Dependencies

- The order is 4.1, then 4.2, then 4.3 to 4.5, then 4.6. Story 4.1 provides the token layer and the header bar slots that Story 4.5 fills. Stories 4.3 and 4.4 render the verdict that Story 4.2 returns, and `web` must not recompute it. Story 4.6 retires components only after Stories 4.3 to 4.5 have replaced what they did.
- The epic builds on the Epic 2 page (rows, threshold, expansion, sync report, appendix) and the Epic 3 crafted branch (recipe control, chase cells, Provenance). It extends them and does not rebuild them. It changes nothing in `sync`.
- Story 4.3 owes a fix and a test for `unitLabel()` on Item Class names that carry a defence suffix.
