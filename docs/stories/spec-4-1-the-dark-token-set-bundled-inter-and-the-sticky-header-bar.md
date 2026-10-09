---
title: 'Story 4.1: The dark token set, bundled Inter and the sticky header bar'
type: 'feature'
created: '2026-10-09'
status: 'done'
baseline_commit: '57960518377d552252586193faecb382099568be'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/docs/stories/epic-4-context.md'
  - '{project-root}/docs/ux-designs/ux-poe-crafting-base-price-checker-2026-09-13/DESIGN.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The page still wears the retired paper direction: a fixed 1060×1920 paper frame, sepia and ink tokens, serif type, system font stacks, and a 170px masthead that scrolls away with the controls.

**Approach:** Replace `packages/web/src/theme/tokens.ts` with `DESIGN.md` revision 19's frontmatter tokens and repoint every reader. Build the Mantine theme on them as one forced dark theme. Bundle `@fontsource-variable/inter` 5.3.0. Swap the paper frame for the centred column from `DESIGN.md` *Layout & Spacing*, and swap the masthead for a sticky `{components.header-bar}` that has recipe, threshold and sync slots. The cold load (state 22) paints that bar, the column header and twenty flat skeleton bars at once.

## Boundaries & Constraints

**Always:**
- `DESIGN.md` wins over `tokens.ts`. Transcribe its `colors`, `typography`, `rounded` and `spacing` values exactly. Cite the token name in code and never restate a value in prose.
- Each type role declares `lineHeight`, except `tier`, which inherits its host's. Pass font sizes as literal px. Replace `theme.lineHeights` and `theme.headings`. The theme sets `primaryColor` to a palette built from `{colors.accent}`, `defaultRadius` to 0, and `forceColorScheme="dark"`. Both the body and the text CSS variables use dark tokens.
- Column-aligned figures keep `font-feature-settings: "tnum"`.
- The page fetches no font from a third party (NFR-7). The Inter package version matches the spine Stack table exactly.
- Header copy follows the `EXPERIENCE.md` Copy Deck. The eyebrow is the league, and it stays blank until the league is known (state 22). The title is the Copy Deck title, and the dek is removed.
- The load still resolves in one transition (AD-24).
- Decision (Open Question 1, option B): the bar stays 64px and holds the brand block and three width-reserved slots (recipe, threshold, sync), which stay empty in this story. The current `CraftRecipe` and `PayoutThreshold` panels move unchanged into a temporary band directly below the bar (`data-interim-controls`). The band scrolls away. Story 4.5 moves the controls into the slots and deletes the band.

**Never:**
- Any reader of a retired token: no paper, ink, rule, edge, sepia, ochre or rust name in TS, and no `--fg-color-<retired>` in CSS.
- A serif stack. A light theme or an OS colour-scheme switch. A Mantine blue. Shimmer or animation on skeleton bars.
- Changes to the ranked-row grid, row heights, column-header labels, marks, the sync button, the trust verdict, or component deletions. Those belong to Stories 4.2 to 4.6. Changes to `packages/web/vite.config.ts`, `core` or `sync`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Cold load | No artifact has arrived yet | The header bar has an empty eyebrow, the title and empty slots. The column header and twenty `{colors.surface}` 10px bars sit in the final layout, with `aria-busy`. | N/A |
| Loaded | Dataset and report are ready | One transition to the ranked list. The eyebrow gains the league, and the interim band holds the current controls. | N/A |
| Scroll | The page is scrolled past the list | The header bar stays pinned at the top. Nothing else is pinned. | N/A |
| No recipe | `recipes.json` holds no recipe | The recipe slot is empty, and the header neither wraps nor shifts (state 43). | N/A |
| Failure | A refused or failed load | The failure screen sits on the dark ground and shows no header controls. | N/A |

</frozen-after-approval>

## Code Map

- `packages/web/src/theme/tokens.ts` -- Retired token set (`colors`, `PAPER_TONES`/`INKS`/`RULES`/`SEMANTIC_INKS`, `spacing.frame*`, `stacks.serif`, `typeRoles`, `typeStyle()`). Keep `px()`, `rankedRowColumns`, `columnSums` and the non-frame layout spacing that later stories own.
- `packages/web/src/theme/theme.ts` -- `createTheme` with a `sepia` palette and `cssVariablesResolver` (`--fg-color-<name>`). Rebuild it on the dark tokens.
- `packages/web/src/theme/PageProvider.tsx` -- `forceColorScheme="light"`. Change it to dark.
- `packages/web/src/main.tsx` -- Imports `@mantine/core/styles.css`. Add the Inter import here.
- `packages/web/src/frame/Frame.tsx` -- Fixed paper frame. Make it the centred column: `content-min`/`content-max`, gutter, `{colors.ground}`, no height. Keep `data-frame`, `data-state` and `aria-busy`.
- `packages/web/src/frame/Masthead.tsx` -- Replace it with `HeaderBar` (`frame/HeaderBar.tsx`), which has the `data-header-bar` and `data-slot="recipe|threshold|sync"` attributes. Keep the `RecipeSlot` semantics.
- `packages/web/src/frame/RowSlots.tsx` -- Skeleton. Bars become `{colors.surface}`. Keep the grid and the count.
- `packages/web/src/App.tsx` -- `renderPending`, `renderReady` and the failure path mount `Masthead` → `HeaderBar`.
- Retired-colour readers, found with `grep -rlE "colors(\.|\[')(surround|paper|ink|rule|edge|sepia|ochre|rust)|--fg-color-(paper|ink|rule|sepia|surround)" packages/web/src`: about 40 TS/TSX files plus `list/list.css`, `threshold/threshold.css`, `frame/frame.css`, `shared/affordance.css`, `recipe/recipe.css`.
- Tests that assert paper values: `theme/theme.test.ts`, `theme/tokens.test.ts`, `App.test.tsx`, `App/page-chrome.test.tsx`, `frame/trust-strip.test.tsx`, `trust-strip/panel.test.tsx`, `list/expansion.test.tsx`, `list/unrankable-appendix.test.tsx`, `threshold/payout-threshold.test.tsx`. Helpers: `src/test-support/dom.tsx` (`rgb()`) and `src/App/test-support.tsx`.
- `docs/architecture/.../ARCHITECTURE-SPINE.md:1698` -- Stack row: `@fontsource-variable/inter` 5.3.0.

## Tasks & Acceptance

**Execution:**
- [x] `packages/web/package.json` -- Add `@fontsource-variable/inter` at exactly `5.3.0` with `pnpm --filter web add` -- static font delivery.
- [x] `packages/web/src/theme/tokens.ts` -- Transcribe the `DESIGN.md` frontmatter `colors` (17), `typography` (two stacks with Inter first, 17 roles), `rounded` and `spacing` (15). Delete the retired groups and the frame spacing. Keep `typeStyle(role)` with the new role names -- one token source.
- [x] `packages/web/src/theme/theme.ts`, `PageProvider.tsx`, `main.tsx` -- Build the dark Mantine theme and the accent palette. Set the CSS vars for ground and text, force dark, and import Inter -- the theme carries the token set.
- [ ] Every retired-colour reader (Code Map grep) -- Repoint by function: surround/paper → `ground`; paper-inset/paper-deep/paper-raw → `surface`; paper-raw-hover → `surface-raised`; ink and ink-chase-emphasis → `text`; ink-secondary → `text-secondary`; ink-tertiary → `text-tertiary`; rule-hairline → `line`; rule-strong/edge → `line-strong`; sepia → `accent`; ochre → `trust-rough`; rust → `trust-broken`. Repoint each old type role to the nearest `DESIGN.md` role by function -- the AC forbids retired tokens.
- [x] `packages/web/src/frame/Frame.tsx`, `frame/HeaderBar.tsx` (new, replacing `Masthead.tsx`), `App.tsx` -- Build the centred column and the sticky header bar (`position: sticky; top: 0`, `{spacing.header-height}`, ground background, `line-strong` bottom rule, one non-wrapping flex row with 22px gaps). Add the interim controls band below the bar, as the frozen decision says.
- [x] `packages/web/src/frame/RowSlots.tsx` -- Set the bar colour to `surface`, with no animation.
- [x] Tests -- Rewrite the theme and token tests: transcription matches `DESIGN.md`, no retired name, dark body var, accent primary, Inter-first stack, every role except `tier` has a lineHeight, exact dependency version. Add a test that scans `src/**/*.css` and fails on a `--fg-color-*` name that is not a current token. Add tests for the header bar (sticky, slots, blank eyebrow while pending, no wrap) and for state 22. Update the paper-colour assertions.

**Acceptance Criteria:**
- Given the rendered page, when its styles are inspected, then each colour comes from the `DESIGN.md` r19 set, the body is `{colors.ground}`, and no fixed 1060×1920 frame or paper token remains.
- Given a production build, when it is served offline, then Inter renders from bundled assets and the network log shows no third-party font request.
- Given the bundled Inter, when − † * · — – are checked at weights 400, 500, 600 and 650, then each glyph is present, or the gap is reported in Implementation Notes.
- Given a scrolled page, when the viewport is at the bottom, then `{components.header-bar}` is in view with its three slots.

## Spec Change Log

## Review Triage Log

| # | Finding (layer) | Verdict | Route | Evidence |
|---|---|---|---|---|
| 1 | Raw Base row on `surface` at rest, `surface-raised` on hover; pressed equals rest; text-tertiary on surface-raised 4.04:1 (blind, edge, verification-gap other, design) | medium | patch | `list.css` rules confirmed; DESIGN.md `ranked-row` is ground/surface, never surface-raised; the EXPERIENCE.md floor binds 4.5:1. |
| 2 | Rank-1 numeral in `accent` (design) | low | patch | `RankedRow.tsx` `RANK_COLOR[1]`; DESIGN.md `rankTopFive` is `{colors.text}`. |
| 3 | Unit glyph in `accent` beside a name (design) | low | patch | `UnitGlyph.tsx`; DESIGN.md Do's and Don'ts. |
| 4 | Appendix count in `trust-broken` (design) | low | patch | `UnrankableAppendix.tsx:47`; DESIGN.md `unrankable-appendix.title`. |
| 5 | Asking-price line in `accent` (design) | low | patch | Non-interactive statement; the accent marks controls only. Its italic is in #14. |
| 6 | Threshold `::selection` equals the panel `surface` (design, edge) | low | patch | `threshold.css`; DESIGN.md `figureEditing` selection `{colors.accent-soft}`. |
| 7 | A long league pushes the slots past the bar (edge) | low | patch | Brand block `flex: 1 0 auto` under `nowrap` with about 226px left at `content-min`. |
| 8 | White canvas before React mounts the dark scheme (edge) | low | patch | `index.html` declares no colour scheme; the page is now dark only. |
| 9 | "Both failure screens" test runs only `refused` (verification-gap, edge) | low | patch | `header-bar.test.tsx` settles to `refused` only. |
| 10 | State 43 test serves a 404, not an empty `recipes` array (blind) | low | patch | `envelopes.ts` allows `z.array` with no minimum, so the matrix case is reachable. |
| 11 | Nothing checks that `main.tsx` imports `inter.css` or that its URLs resolve (verification-gap) | medium | patch | Pre-verified; the vite test only matches source text. |
| 12 | `columnSums.mastheadControls` keeps the retired name (blind) | low | patch | A direct rename. |
| 13 | Interim band, slot widths and header budget sum, grid overhang below about 1060px, interim restyle (ledger audit, blind, edge) | medium | defer | Carved out by the frozen decision and Design Notes; ledger entries added. |
| 14 | Italic runs render as a synthesized oblique; DESIGN.md says the page sets no italic (blind, edge, design) | low | defer | About 10 call sites; `TrustMark` uses italic as the NFR-10 cue for *never attempted*, so removal waits for Story 4.3's drawn marks. |
| 15 | Weight 700 in five places; failure screen padding 34px and body width 480px (design) | low | defer | Values pre-date this story; Stories 4.3 and 4.6 restyle these components. |
| 16 | Deleted pins: glyph twins, in-row 1.2 line heights, threshold geometry (verification-gap, blind, edge) | low | defer | Stories 4.3 and 4.5 replace these values and pin them in their own tests. |
| 17 | Banner lead and body differ only by colour; odd nearest-role picks (blind) | low | defer | Typographic hierarchy, not an NFR-10 meaning; part of the interim restyle entry. |
| 18 | Focus scrolls under the sticky bar; needs scroll-padding (edge) | false | reject | EXPERIENCE.md Accessibility Floor: no keyboard path is provided. |
| 19 | `theme.white = text` gives low contrast on filled accent components (blind, edge) | false | reject | No filled Mantine component is rendered (no `Button` or `variant` in `src`). |
| 20 | Empty-string league collapses the eyebrow (edge) | maybe-false | reject | The league comes from a validated id schema; would be low at most. |
| 21 | Cyrillic, Greek or Vietnamese characters fall back (edge) | false | reject | League and base names in this game are latin; the latin and latin-ext faces cover them. |
| 22 | Glyph probe weaker than claimed; weight 650 absent from the role union (blind) | false | reject | − † · — – * fall inside the bound unicode ranges of a variable 100–900 face, so every weight covers them. |
| 23 | Spec status and task ticks disagree with tracking (blind) | false | reject | Tasks were ticked at verification; sprint status follows the workflow. |
| 24 | Scratchpad evidence paths do not persist (blind) | low | reject | The spec asks for the result and the path; the results are stated in the notes. |
| 25 | Hand-rolled YAML parsing, hard-coded counts, colour-block slice (blind, edge) | low | reject | DESIGN.md frontmatter order is fixed; unlikely to bite. |
| 26 | Sticky tests check inline style, not layout (blind) | low | reject | jsdom cannot lay out; the browser check covers it. |
| 27 | `epic-4-context.md` restates values; spec cites a spine line number (blind) | low | reject | The context file is a generated cache, and the fix would edit this spec. |

## Design Notes

The colour and type repointing is mechanical and interim. Stories 4.3 to 4.6 restyle each component properly. This story only guarantees that no retired token survives and that the substrate is right. The ranked-row grid, the 28px rows and the column-header labels stay until Story 4.3. On the target 1080px monitor, the content between the gutters is about 1015px, so the 1012px grid fits. On viewports below about 1060px, the grid overhangs the right gutter until Story 4.3 adopts the `DESIGN.md` grid. The page still scrolls sideways below `content-min`.

## Verification

**Commands:**
- `pnpm check` -- expected: green.
- `pnpm --filter web build` and then `grep -rE "fonts\.(googleapis|gstatic)" packages/web/dist` -- expected: no match, and the `inter` woff2 assets are emitted.

**Agent browser checks:** The implementing agent runs these steps itself before it sets the status to `in-review`. It does not hand them to the human. Use the agent-browser skill with a named session (`agent-browser session id --scope worktree --prefix poe`, then `--session <id>` on every call). Start `pnpm dev` in the background and stop it with `pnpm dev:stop` at the end. Write each result, with the path of its screenshot, in Implementation Notes. A failed check is a defect to fix, not a note.
- **Cold load (state 22):** Hold back or delay the artifact requests and take a screenshot. Expected: the header bar, the column header and twenty flat bars, with `aria-busy` on the frame. Then release the requests. Expected: one transition to the list.
- **Sticky header:** Scroll to the bottom of the loaded page and take a screenshot. Expected: the header bar is at the top of the viewport and the interim control band has scrolled away.
- **No third-party font:** Serve the production build (`pnpm --filter web preview` or an equivalent) and read the network log of a full load. Expected: every font request goes to the page's own origin and returns a bundled `woff2`.
- **Glyphs:** Evaluate a probe that renders − † * · — – at weights 400, 500, 600 and 650 and calls `document.fonts.check()` for each weight. Also compare the width of each glyph against a fallback-only font. Expected: Inter draws every glyph. Report any gap.
- **Dark tokens:** Evaluate the computed `background-color` of `body`, the frame and the header, and the `color` of the title, the eyebrow and one column header. Expected: each value equals its `DESIGN.md` token. The probe also checks that no computed colour on the page equals a retired paper value.
- **Mockup comparison:** Take a screenshot of the loaded page at 1080px wide. Compare the header bar against `mockups/key-redesign-dark.html`, and list any difference that this story owns.

## Implementation Notes

- **Inter family name.** `@fontsource-variable/inter` registers the family `Inter Variable`, but `{typography.stack-sans}` names `Inter`. `theme/inter.css` declares two `@font-face` rules named `Inter` (latin and latin-ext, `wght` axis 100–900) on the package's woff2 files, so the stack is transcribed unchanged. `knip.json` ignores the dependency for `packages/web`, because knip does not read CSS `url()`.
- **Colour count.** DESIGN.md r19 declares 16 colours, not the 17 that the task line says. The transcription test parses the frontmatter and holds `colors` equal to it.
- **Token layout.** `spacing` now holds the 15 DESIGN.md tokens. The px measurements that Stories 4.3 to 4.6 replace moved to `layout`. The frame reserves were renamed (`absenceLineHeight`, `healthLineHeight`, `listStatementHeight`, `bannerMinHeight`, `failureBodyMaxWidth`, `interimControlGap`). The vertical-budget helpers were deleted.
- **Header slots.** The reserved widths (recipe 294, threshold 238, sync 128) come from the mockup at 1000px plus the `10.00 div / craft` and `Synced 59m ago` forms. They give a bar of about 939px against 952px. Story 4.5 re-measures them.
- **Failure path.** The failure screens mount no header bar, because a second title would duplicate the failure title. They sit in the dark frame.
- **Interim band.** `frame/InterimControls.tsx` holds the unchanged `CraftRecipe` and `PayoutThreshold` panels, and renders while pending too, so the column header does not move at the transition.
- **Pending `pnpm --filter web build`.** `@poe/web` has no build script. `pnpm build` emits `inter-latin-wght-normal-*.woff2` and `inter-latin-ext-wght-normal-*.woff2`, and `grep -rE "fonts\.(googleapis|gstatic)" packages/web/dist` finds nothing.

### Agent browser checks (session `poe-ad761694c22d`)

- **Cold load (state 22):** the init script `C:/Users/ilyal/AppData/Local/Temp/claude/C--Users-ilyal-orca-workspaces-poe-crafting-base-price-checker-story-4-1/6cb8d6ed-a90d-467c-8b1e-eb18c51148c6/scratchpad/hold.js` held every `fetch`. The frame was `pending` with `aria-busy="true"`. The bar showed a blank eyebrow, the title and three empty slots. The column header and 20 bars showed, each `rgb(34, 34, 38)` (`surface`), with animation `none`. Screenshot: `C:/Users/ilyal/AppData/Local/Temp/claude/C--Users-ilyal-orca-workspaces-poe-crafting-base-price-checker-story-4-1/6cb8d6ed-a90d-467c-8b1e-eb18c51148c6/scratchpad/state22-cold-load.png`. After release, a MutationObserver recorded the states `["ready"]` (one transition): 11 rows, 0 slots, and the eyebrow `Forbidden Rites`. Pass.
- **Sticky header:** at 1080×600, scrolled to the bottom (scrollY 282 of 282). The header bar top is 0 and its height 64. The interim band bottom is −85, so it scrolled away. Slots: 294, 238 and 128. Screenshot: `C:/Users/ilyal/AppData/Local/Temp/claude/C--Users-ilyal-orca-workspaces-poe-crafting-base-price-checker-story-4-1/6cb8d6ed-a90d-467c-8b1e-eb18c51148c6/scratchpad/sticky-scrolled.png`. Pass.
- **No third-party font:** `vite preview` of `pnpm build` on :4173. Every request went to `localhost:4173`. The one font request was `/assets/inter-latin-wght-normal-*.woff2` (Font, 200). Pass.
- **Glyphs:** `C:/Users/ilyal/AppData/Local/Temp/claude/C--Users-ilyal-orca-workspaces-poe-crafting-base-price-checker-story-4-1/6cb8d6ed-a90d-467c-8b1e-eb18c51148c6/scratchpad/glyph-probe.js` checked − † * · — – at 400, 500, 600 and 650. `document.fonts.check` was true for all 24, and each width differs from Courier New. No gap.
- **Dark tokens:** `C:/Users/ilyal/AppData/Local/Temp/claude/C--Users-ilyal-orca-workspaces-poe-crafting-base-price-checker-story-4-1/6cb8d6ed-a90d-467c-8b1e-eb18c51148c6/scratchpad/tokens-probe.js`. The colour scheme is `dark`. The body, frame and header are `rgb(26, 26, 29)` (`ground`). The header rule is `rgb(68, 68, 75)` (`line-strong`). The title is `rgb(217, 217, 217)` (`text`). The eyebrow is `rgb(154, 154, 154)` (`text-secondary`). The column header is `rgb(138, 138, 142)` (`text-tertiary`). No computed colour equals a retired paper value (0 hits). The body font is the Inter stack, and Inter 100–900 is loaded. Pass.
- **Mockup comparison** (`C:/Users/ilyal/AppData/Local/Temp/claude/C--Users-ilyal-orca-workspaces-poe-crafting-base-price-checker-story-4-1/6cb8d6ed-a90d-467c-8b1e-eb18c51148c6/scratchpad/loaded-1080.png` against `mockups/key-redesign-dark.html`): the brand block matches (11px/600 uppercase eyebrow in `text-secondary`, 18px/600 title, 64px bar, `line-strong` rule, 22px gaps). This story owns no other difference. The empty slots are the frozen decision, and the controls stay in the interim band until 4.5. The mockup sets `font-feature-settings: "tnum" 1, "cv11" 1` on `body`. The page keeps `tnum` per figure, as before, and has no `cv11`.
