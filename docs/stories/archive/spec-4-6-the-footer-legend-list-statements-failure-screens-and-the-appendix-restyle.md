---
title: 'Story 4.6: The footer legend, list statements, failure screens and the appendix restyle'
type: 'feature'
created: '2026-10-10'
status: 'done'
baseline_commit: 'fe6b4c03e6b453691e31ba4bd5cfabf5b3116085'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/docs/stories/epic-4-context.md'
  - '{project-root}/docs/ux-designs/ux-poe-crafting-base-price-checker-2026-09-13/EXPERIENCE.md'
  - '{project-root}/docs/ux-designs/ux-poe-crafting-base-price-checker-2026-09-13/DESIGN.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The foot of the page and its edge states still use the paper direction. `KeyBlock`, `RunningFoot`, `AskingPriceLine` and the global `UniformPriorBanner` (state 19, retired) are still mounted. `TrustStrip` and `TrustMark` are dead code. The appendix, the list statements and the failure screens use glyphs, italic, weight 700 and interim `layout` px values.

**Approach:** Delete the retired components and replace them with the `DESIGN.md` `footer-legend`. Restyle `list-statement`, `failure-screen` and `unrankable-appendix` to `DESIGN.md` revision 19. Use the `EXPERIENCE.md` Copy Deck for every string, and write the build-drafted strings into the deck in this PR.

## Boundaries & Constraints

**Always:**
- Footer legend: the nine Copy Deck items in deck order. ■ is drawn in `rarity-magic` and `rarity-normal`. The marks are the drawn `VerdictMark` / `EstimateMark`: each word is in the mark colour at weight 600, and the meaning is in `text-secondary`. † and * are Inter text. Item 9 sits at the right edge. The legend renders in the pending and ready states, and not on a failure screen. It carries the asking-price sentence, so `AskingPriceLine` goes.
- List statement: `label` role in `text-secondary`, one line above the column header. It is shown for states 23, 25 and 35 only, with precedence 23 > 35 > 25 (unchanged). State 23 names no cause.
- Failure screen: the page frame with padding-top 24px and no header bar. The eyebrow uses the `eyebrow` role in `trust-broken`, set uppercase by CSS, and is led by the drawn ✕. The title uses `title`. The body uses `line-text` in `text-secondary`, at most 640px wide. The retry is `show-more`, on the fetch failure only. The body names the file and the cause. A partial set never renders (FR-33, NFR-8).
- Appendix: the `DESIGN.md` `unrankable-appendix` block. The top border is `line-strong`, and there is no surface fill and no mark. The grid is blank `col-rank` · class `col-name` (`line-text`, `rarity-magic`) · reason `expansion-trust-cell` (`line-text`, `text-secondary`, verbatim from `core`) · note 1fr (`note`, `text-tertiary`, upright). The title uses `row-name` with a neutral count. The lead uses `note`. The empty form is the title alone (state 37).
- Appendix notes: the deck note for states 14, 15 and 15a by reason. Add the state 16 note when the active ranking's `ordering` holds a raw row whose tracked entry has the class's `(categoryId, className)`. Join two notes with ` · `. The state 15 note shows on every `class absent from weights file` row, because no signal marks a class as freshly scraped. `recipe cannot reach this class` (state 36) prints its reason and no note.
- NFR-10: price trust reads from the silhouette, estimated odds from ≈, and crafted versus Raw Base from the sell-as-is line. The legend states each cue in words.

**Never:**
- Changes to `core`, `contracts` or `sync`. A new FR-4 reason string. Editing `DESIGN.md`. Copy Deck edits other than the drafted strings.
- Italic or weight 700 anywhere in the touched files. A retired glyph (`unitClass`, `unitRaw`, `unresolvable`, `prior`, `unknown`, `stale`) left in `glyphs`.
- An attention colour on the appendix count. A Copy Deck string or token value copied as a literal into a test that can import it.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Ready, healthy | ranked list, 0 unrankable | legend (9 items); appendix title `— 0 Item Classes` alone | N/A |
| Pending | cold load | header, skeleton rows, legend; no appendix | N/A |
| League reset | state 23, one row pending | `In canonical order, not ranked: no tracked unit has a price from <league> yet.` | every row broken → no `yet` |
| Nothing clears | threshold 2.5 | state 25 statement with `2.50` | N/A |
| Uncostable | recipe `greater` uncostable | state 35 statement naming `greater` | N/A |
| Pool partial + raw ranks | class reason `pool partial`, one raw row of the class in `ordering` | note `ranks once … pool · some of its bases still rank, sold as is` | N/A |
| Disagrees | 15a | reason verbatim and the 15a note; no check name | N/A |
| Unreachable | state 36 | reason `recipe cannot reach this class`, no note | N/A |
| Refused, version | `weights.json` declares 9 | refusal screen, body names the file and both versions | no retry |
| Refused, missing | `tracked.json` 404 | refusal screen, missing sentence | no retry |
| Fetch failure | `dataset.json` network error | fetch-failure screen, `+ Try again` refetches the whole set | no legend, no header |

**Decisions (2026-10-10, human):**
1. Drafted strings, written into the Copy Deck by this PR: state 25 `Nothing clears your Payout Threshold of N.NN div.` State 35 `The <recipe> Craft Recipe has no Craft Cost figure yet: Item Classes and Raw Bases are ordered apart, not ranked against each other.` Refusal, one per cause: `<file> declares schema version X; the page expects Y.` · `<file> declares no schema version; the page expects Y.` · `<file> does not match the schema the page expects, version Y.` · `<file> was not published, and the page cannot render without it.` The `× unresolvable` fragment goes.
2. State 35's branch boundary (an `EXPERIENCE.md` known gap): no new chrome. The raw branch's show-more ends it, and the crafted branch follows. The rank cell stays reserved and blank.
3. The full spec is kept above the token guideline. It is one story in `epics.md`.

</frozen-after-approval>

## Code Map

- `web/src/App.tsx` -- `renderPending`, `renderReady`, `ReadyBody` and `PageTail`. Drop `AskingPriceLine`, `UniformPriorBanner` and its dismissal state, `KeyBlock` and `RunningFoot`. `PageTail` holds `{appendix}` and then `FooterLegend`.
- Delete these files: `list/{UniformPriorBanner,KeyBlock,RunningFoot,AskingPriceLine,TrustMark,UnitGlyph}.tsx`, `frame/TrustStrip.tsx`, `frame/trust-strip.test.tsx`, `frame/trust-strip/`, `recipe/craft-recipe/provenance-banner.test.tsx` and `list/ranked-list/key-and-glyphs.test.tsx`. Remove `.fg-trust-strip` and `.fg-strip-affordance` from `frame/frame.css`. Before you delete a file, check that its exports have no other reader (`isBannerRaised`, `HAIR_SPACE`, `ASKING_PRICE_COPY`).
- `web/src/list/FooterLegend.tsx` (new) -- reuse `VerdictMark`, `EstimateMark` and `MARK_COLORS` from `marks/marks.tsx`. Add a drawn ■ `SwatchMark` there, built the way the other marks are. The legend layout is in `DESIGN.md` `footer-legend`.
- `web/src/list/ListStatement.tsx` and `list-statement.ts` -- restyle. Change the copy as Decision 1 sets it.
- `web/src/frame/FailureScreen.tsx` -- write the eyebrow as the deck string (`✕ The page will not render this`) with `textTransform: uppercase` and a drawn ✕. Restyle the screen to `failure-screen`. Make the retry `show-more`. `load/load-artifacts.ts` is unchanged.
- `web/src/list/UnrankableAppendix.tsx` -- restyle. Replace `DISAGREES_NOTE` and `APPENDIX_MARK_WORD` with the four deck notes. It takes the raw-ranks set as a prop, which `ReadyBody` builds from `active.ordering` joined to `set.tracked.entries`.
- `web/src/theme/tokens.ts` (+ `tokens.test.ts`) -- delete the `layout` keys whose readers go (`banner*`, `trustStrip*`, `trustSeparatorPadX`, `key*`, `foot*`, `asking*`, `unitGlyphBox`, `appendix*`, `contentWidth`, `failureBodyMaxWidth`, and `healthLineHeight` if it has no reader), and `columnSums.appendix` with its test at L203. Remove the retired `glyphs` entries. Add the px values that `footer-legend` and `failure-screen` write inline (28, 14, 22, 24, 640). Update the comment that says Stories 4.5 and 4.6 replace the `layout` group.
- `test/directory-structure.test.ts` -- lower `OVER_CAP['packages/web/src/list']` to the new count of files, or delete the entry at 25 or fewer.
- Tests to re-pin: `App/{list-statement,page-chrome,unrankable-appendix,interaction-surface,header-bar}.test.tsx`, `App.test.tsx`, `list/unrankable-appendix.test.tsx`, `list/list-statement.test.ts` and the FailureScreen cases in `App.test.tsx`.
- Dependency-cruiser (`.dependency-cruiser.mjs` and `depcruise.rules.mjs`) has no exception that names the four components, so it needs no edit.
- `docs/stories/deferred-work.md` -- this story discharges the four entries with `retry_when: Story 4.6`: the 4.1 restyle, the 4.3 TrustMark deletion, the 4.5 TrustStrip deletion and the 4.5 `glyphs.prior` entry. Remove them in the last commit.

## Tasks & Acceptance

**Execution:**
- [x] `marks/marks.tsx` (+ test) -- the ■ swatch mark -- DESIGN.md Marks.
- [x] `list/FooterLegend.tsx` (+ test) -- the nine items -- Copy Deck *Footer legend*.
- [x] `list/UnrankableAppendix.tsx` (+ tests) -- the restyle, the notes for states 14 to 16 and 36, and state 37 -- FR-4.
- [x] `list/ListStatement.tsx`, `list-statement.ts` (+ tests) -- the restyle and the Decision 1 copy -- states 23, 25 and 35.
- [x] `frame/FailureScreen.tsx` (+ tests) -- states 26 and 28.
- [x] `App.tsx`, the deletions, `frame.css`, `tokens.ts`, `directory-structure.test.ts` -- the wiring and the retirements -- state 19.
- [x] The App tests in the Code Map -- re-pin them, and add one test per I/O matrix row.
- [x] `EXPERIENCE.md` Copy Deck -- write the Decision 1 strings, and drop them from *Strings drafted at build*.

**Acceptance Criteria:**
- Given the source tree, when it is searched, then no file names `UniformPriorBanner`, `KeyBlock`, `TrustStrip`, `RunningFoot`, `AskingPriceLine`, `TrustMark` or `UnitGlyph`.
- Given a failure screen, when it shows, then neither the header bar, the list nor the footer legend renders.
- Given every colour removed, when the page is read, then the legend, the rows and the appendix still tell the trust states, ≈ and crafted versus Raw Base apart (NFR-10).
- Given `pnpm check`, then it is green.

## Implementation Notes

- State 16 is wired in `UnrankableAppendix` (the `rawRanks` prop) but `ReadyBody` passes no set: a raw Tracked Entry carries no `(categoryId, className)` and no loaded artifact maps a Base Type to its class. Human decision 2026-10-10: defer to Story 4.8 (`deferred-work.md`).

## Spec Change Log

## Review Triage Log

Iteration 0 (blind, edge-case, verification-gap, ledger, design layers):

| Finding | Verdict | Route | Evidence |
|---|---|---|---|
| Retry hand-copies `ShowMore`; `affordance.css` comment still names `+ Try again` | medium | patch | Same style in `FailureScreen.tsx` and private `ShowMore` in `ExpansionPanel.tsx`; DESIGN.md wants one show-more look. |
| ≈ cue lost its weights-to-row test with `provenance-banner.test.tsx` | medium | patch | Remaining ≈ tests inject `provenance` directly; nothing runs `toListBranches` from an `invented` tier. |
| Refusal sentence tests are tautological; stale "unchanged" comment | medium | patch | Both sides of each assertion call `refusalSentence`; Decision 1 wording is pinned nowhere. |
| `FETCH_FAILURE_TITLE` why-comment deleted | low | patch | The 2026-09-27 reason still holds; one-line restore. |
| NFR-10 legend test compares mark names, not drawings | low | patch | `data-mark` strings always differ, so the colour-free claim is untested. |
| Italic deferred entry (4.1) is discharged | low | patch | No `italic` left in `packages/web/src`; ledger rule removes it on the landing branch. |
| `sprint-status.yaml` `last_updated` moved backward | low | patch | 16:30 → 15:48; reset at the final edit. |
| Story 4.8 AC hides the open class-source decision | low | patch | Added an open-question line to `epics.md` Story 4.8. |
| Appendix note/class cells `nowrap` with no overflow guard; truncation test dropped | low | defer | Longest single note fits today; overflow needs the joined state 16 note, which is Story 4.8's work. |
| State 16 `rawRanks` never passed by `ReadyBody` | medium | reject | Human decision 2026-10-10: deferred to Story 4.8, ledger entry exists. |
| Task checkbox and Code Map claim the state 16 join | low | reject | Fix edits this build's spec; Implementation Notes record the deferral. |
| Duplicate appendix React keys | false | reject | New key `classKey + recipeId` is strictly finer than the old class-only key. |
| `refusalSentence` crashes on an unknown cause | false | reject | `RefusalCause` is a closed union checked exhaustively by the type checker. |
| Removed `× unresolvable` fragment loses a cue | false | reject | Decision 1 retires it; the eyebrow names the fault. |
| ListStatement / legend item 9 overflow on narrow viewports | low | reject | Fits the target frame; a narrow viewport is outside the page's layout target. |
| Eyebrow ✕ stroke lighter than weight-600 text | low | reject | Failure screen only, rarely seen; fix adds a new prop. |
| Spec `in-review` vs sprint `in-progress` | false | reject | The workflow syncs sprint status at presentation. |
| `retry_when: Story 4.8` points at itself | false | reject | Same form as the `retry_when: Story 4.6` entries this story discharged. |
| `epic-4-context.md` lacks Story 4.8 | false | reject | The cached context is invalidated by the newer `epics.md` and recompiles. |
| State 35 / weights refusal not covered at App level | false | reject | `crafted-states.test.tsx` L56 renders state 35; `load-artifacts.test.ts` L167 refuses a weights major. |
| List jumps without the reserved statement slot | false | reject | The old component also returned nothing for `none`; no slot was reserved. |
| `[style*="700"]` guard is fragile | low | reject | Test-only heuristic; no observed false pass. |
| Legend `paddingBottom` and duplicated `0.3em` gap | low | reject | Values recorded in the implementation report; no named harm. |
| Ledger audit | — | — | Zero findings. |

## Design Notes

- The legend's ■ follows `DESIGN.md` `footer-legend.swatches`: a solid square drawn as a trust mark is, in a 1em box. It is not a glyph.
- The `layout` keys of the sync report and the rows (`syncReport*`, `absenceLineHeight`, `columnHeaderMarginTop`, `expandPadTop`, `s1`–`s6` and `hairline`) belong to the surfaces of Stories 4.4 and 4.5, and they stay. The 4.1 entry names only the components that this story deletes or restyles.

## Verification

**Commands:**
- `pnpm check` -- expected: green.

**Manual checks:**
- Run agent-browser with a named session against `pnpm dev` at 1080px. Take screenshots of the footer legend, the appendix with rows, the appendix in its empty form, and each list statement. For the failure screens, block a fetch and serve an invalid file.
