---
title: 'Story 2.3: The ranked list at rest — rows, units, freshness and the key block'
type: 'feature'
created: '2026-09-26'
status: 'done'
baseline_commit: 'c97c40deb5274a2853fffb2fb121950606c597c6'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/docs/stories/epic-2-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The `ready` state of `packages/web` renders only the masthead and the absence lines. No ranked row, column header, asking-price line, key block or running foot exists. The player cannot read the list.

**Approach:** In `web`, call `core`'s `rank` over the loaded set at the default 0.25 Divine threshold. Render the chrome of the resting page: the asking-price line, the column header, the ranked rows (top 20 plus the expand affordance), the key block and the running foot. The rows carry unit glyphs, the raw-row cues, the emphasis tiers, 2dp figures, money-slot phrases, the stale and never marks, hover, and a click toggle with `openMarker`. The expansion panel is Story 2.5's.

## Boundaries & Constraints

**Always:**
- The epics.md Story 2.3 ACs are normative. DESIGN.md owns tokens, copy and layout, and EXPERIENCE.md owns the states (12a, 17, 18, 22, 33, money-slot table). Reuse `theme/tokens.ts` (`rankedRowColumns`, `typeRoles`, `glyphs`, `colors`). Add any missing token there, not inline.
- `web` renders what `rank` returns and computes no ordering. The top-20 bound is a view slice. Ranks 21 and up take tier 3. Tiers: ranks 1–5 = tier 1, 6–10 = tier 2, 11 and up = tier 3, by position only.
- Freshness: `FRESHNESS_CUTOFF_HOURS = 48` is a `web` constant (AD-10). The age reads the row's dataset entry joined by `entryKey`: `observedAt` if its price is `priced` (a league-mismatched observation included), else `lastAttemptedAt`. Neither → `» never attempted`. Under 48h → an empty cell. At 48h or more → `» priced Nd ago` or `» tried Nd ago`, where N = `floor(hours / 24)`. "Now" is read once, when the load resolves, and is held in state.
- Figures: 2dp. A value `0 < v < 0.005` prints `< 0.01`. A missing figure prints a money-slot phrase (EXPERIENCE table), never `0`, a blank or `—`.
- The unit label is `baseTypeId` verbatim for a raw row. A `unitLabel(className)` helper (underscore → space; identity untouched) and the class glyph `≡` are built and tested, but no crafted row exists until Epic 3.
- The raw note is `uncrafted at Item Level {n} — ranked at its own current asking price, not at a craft outcome`, one italic 492px cell.
- Asking-price copy: `Every price here is a current asking price from a live instant-buyout listing. Nothing on this page is an observed sale.`
- The key block and running foot copy are DESIGN.md's verbatim. `† pruned` / `* pinned` are not listed (open UX note).
- The asking-price line, the key block and the running foot also render in the skeleton state. They never render on the refusal or fetch-failure screens.
- Owed code folded in: `RowSlots` paints the column header with its final labels (UX memlog 211), and `frameSlack` becomes 530 (UX memlog 210).
- **Unpriced Raw Bases (decision 2026-09-26, option a):** they trail the ordering in the same list, in canonical order, `noListings` then `notYetSynced`. They carry no rank numeral, take tier 3 and the raw cues, hold the money phrase in EV (*an open question* / *no figure yet*) and carry their age mark. They count toward the 20 visible rows and toward N. `unresolvable` is excluded (FR-24); Story 2.6's health line surfaces it.
- Tests stay offline via `test-support/artifact-server.ts`. No `"sells for"`, `"worth"` or `"market value"` in `web` source (asserted).

**Never:**
- No threshold input or persistence (Story 2.4), no expansion panel or trade link (2.5), no trust strip (2.6), no league-reset declarative or numeral suppression (2.7), no appendix (2.8), no nothing-clears declarative (2.4).
- No sorting, tooltip, animation or per-row control. No change to `core`, `contracts` or `packages/web/vite.config.ts`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Priced raw, fresh | 0.5 div, observed 3h ago | numeral, `▪`, italic name, `0.50`, empty Provenance and Age, raw note | N/A |
| Tiny figure | 0.0031 | `< 0.01` | N/A |
| Stale observation | observed 5d 4h ago | `» priced 5d ago` | N/A |
| Exactly 48h | observed 48h ago | `» priced 2d ago` | N/A |
| 25 ranked rows | ordering length 25 | 20 rows + `+ Read the remaining 5 rows`; click → 25 rows, `− Show only the top 20` | N/A |
| Row click | click row 3 | `openMarker` on row 3; column x-offsets unchanged; click again clears it | N/A |
| Unpriced trail | 2 priced, 1 no-listings tried 9d ago, 1 never-synced | rows 1–2 numbered; then `an open question` + `» tried 9d ago`; then `no figure yet` + `» never attempted` (italic) | N/A |
| Unresolvable | 1 unresolvable raw | no row | N/A |
| Skeleton | load pending | slot rows + labelled header + asking line + key block + foot | N/A |

</frozen-after-approval>

## Code Map

- `packages/web/src/App.tsx` -- `App` view switch. `pending` → `Frame`+`Masthead`+`RowSlots`; `ready` → `Frame`+`Masthead`+`AbsenceLines`. Add the list chrome here, with the set prop-drilled (no context exists).
- `packages/web/src/load/artifacts.ts` -- `ArtifactSet` (`dataset`, `tracked`, `config.league`; tolerable → `null`).
- `packages/core/src/index.ts` -- `rank(RankInput): Ranking`, `UnrankedEntry` / `NotYetSyncedEntry` (`entry`, `entryKey`, `lastAttemptedAt?`, `reason`). `Ranking.ordering` is sorted, and the other groups are canonical.
- `packages/contracts/src/ranked-row.ts` -- raw `RankedRow` (`entryKey`, `baseTypeId`, `itemLevelMin`, `ev`, `observation.observedAt`, `lastAttemptedAt?`).
- `packages/web/src/theme/tokens.ts` -- `rankedRowColumns` (widths and padRight), `typeRoles` (`column-header`, `row-rank`, `row-unit-name`, `row-unit-glyph`, `row-ev`, `row-mark`, `row-chase`, `money-phrase`, `asking-note`, `key-heading`, `key-body`, `running-foot`, `expand-affordance`), `glyphs`, `colors` (incl. `paper-raw`, `paper-raw-hover`, `paper-deep`), `typeStyle`, `px`, `committedChrome`, `frameSlack` (→ 530; update `tokens.test.ts`).
- `packages/web/src/frame/RowSlots.tsx` -- skeleton; add the shared column header.
- `packages/web/src/frame/frame.css` -- hover rules via `var(--fg-color-*)`; add the row hover and pointer-down rules here.
- `packages/web/src/frame/TradeGlyph.tsx` -- precedent for a small typed component; not used in 2.3.
- `packages/web/src/App.test.tsx`, `test-support/artifact-server.ts` (`serveArtifacts`, `VALID_BODIES`, `TEST_LEAGUE`) -- mount pattern (`createRoot` + `act`, no testing-library); extend `VALID_BODIES` through a local fixture builder for tracked and dataset entries.
- DESIGN.md components `ranked-row`, `column-header`, `unit-glyph-*`, `raw-base-row`, `trust-mark-*`, `money-slot`, `expand-affordance`, `asking-price-line`, `key-block`, `running-foot`; `mockups/key-hero-resting.html` -- visual reference (the spine wins over the mockup).

## Tasks & Acceptance

**Execution:**
- [x] `packages/web/src/theme/tokens.ts` (+ test) -- `frameSlack` 530; add any missing role or colour token -- owed ruling.
- [x] `packages/web/src/list/format.ts` (+ test) -- `formatDivine`, `ageMark(entry, now)`, `unitLabel`, `rawNote`, `FRESHNESS_CUTOFF_HOURS`, `TOP_ROWS = 20`, `DEFAULT_THRESHOLD = 0.25`, `MONEY_PHRASES` -- pure view helpers.
- [x] `packages/web/src/list/display-rows.ts` (+ test) -- `Ranking` + dataset → display rows (numeral, tier, EV text, age mark), with the unpriced rows trailing.
- [x] `packages/web/src/list/{ColumnHeader,UnitGlyph,TrustMark,RankedRow,RankedList,AskingPriceLine,KeyBlock,RunningFoot}.tsx` -- components; `RankedList` holds the grown flag and the open-row set.
- [x] `packages/web/src/frame/frame.css` -- row hover and pointer-down (crafted and raw), cursor pointer, no transition.
- [x] `packages/web/src/frame/RowSlots.tsx`, `App.tsx` -- header in the skeleton; `useMemo` rank in `ready`; chrome order: asking line, header, list, key block, foot.
- [x] `packages/web/src/list/ranked-list.test.tsx`, `App.test.tsx` -- matrix rows; the six header labels; column widths sum to 1012; every row has exactly one glyph; a raw row is italic with the note; the key block renders in the skeleton and ready states and not on failure; no banned words in `web/src`.

**Acceptance Criteria:**
- Given the committed `data/` served by `pnpm dev`, when the page loads, then agent-browser (named `--session`) shows the list, the header, the key block and the foot matching `key-hero-resting.html`'s geometry, and the frame width is unchanged.
- Given the page with colour removed (a grayscale screenshot), when read, then raw versus crafted, stale versus never, and the tiers are each distinguishable by a glyph, a word, a weight or an italic.
- Given `pnpm check` and `pnpm test`, when they run, then both pass.

## Implementation Notes

- The key block and running foot copy is not written out in DESIGN.md prose, so it is taken verbatim from `mockups/key-hero-resting.html`.
- A trust mark prints as glyph, U+200A hair space, word (DESIGN.md, Trust mark). The mockup uses a no-break space.
- The open marker is a 3px sepia `border-left` on a `-3px` margin, with the row widened to 1015px. The columns stay at the same x.
- The row tones (rest, hover, pointer-down, raw and crafted) are `.fg-row` rules in `frame.css`, never inline, so hover can override them.
- The key block and running foot sit in a `data-page-tail` wrapper with `margin-top: auto`, which pins them to the frame foot as in the mockup. Story 2.8's appendix leads that wrapper.
- The banned-words test skips `MASTHEAD_TITLE` / `MASTHEAD_DEK` ("What is worth picking up", "…worth selling raw"). Those strings are DESIGN.md-owned copy that names no price. With them in scope, the assertion as literally written would fail on Story 2.1's masthead.
- New spacing tokens: `openRowMarker`, `unitGlyphBox`, and the chrome gaps (`askingPad*`, `columnHeaderMarginTop`, `expandPadTop`, `key*`, `foot*`).

## Spec Change Log

## Review Triage Log

| # | Layer | Finding | Verdict | Route | Evidence |
|---|-------|---------|---------|-------|----------|
| 1 | verification-gap, blind | Committed-data test claims to drop the below-threshold base but asserts only rows > 0 | low | patch | At threshold 0 Utility Belt (0.1268) would render and the test would still pass; now asserts exactly 2 rows and no Utility Belt. |
| 2 | verification-gap | `HAIR_SPACE` is pinned only against itself | low | patch | Every assertion imports the constant under test; a no-break space would pass. Pinned to U+200A. |
| 3 | verification-gap | Tier-1 EV figure weight 700 is unasserted | low | patch | The tier test checks row 0's rank and name and row 5's EV only. |
| 4 | edge-case | Class glyph `≡` is claimed "built and tested" but never rendered in a test | low | patch | The only reference asserts its absence from the key block. |
| 5 | blind | Refusal test name also claims fetch failure; open-row test hardcodes `rgb(33, 30, 23)` | low | patch | Name mismatch and a literal that breaks on a token change. |
| 6 | edge-case, blind | Banned-words scan strips masthead copy with `.replace` (first occurrence only) | low | patch | A second occurrence would fail the scan for an unrelated reason; `.replaceAll`. |
| 7 | edge-case, blind, ledger | The masthead's "worth" is exempted from the banned-words assertion | false | reject | The normative epics.md AC scopes the ban to "any copy naming a price" (FR-13, UX-DR46), as does PRD FR-13; the masthead names no price. The exemption conforms to the normative AC. Narrowing the Boundaries line would edit this spec. |
| 8 | ledger | `† pruned` / `* pinned` absent from the key block, untracked | medium | defer | Carve-out with no owner story; ledger entry added. |
| 9 | ledger | Key block and foot copy sourced from the mockup, not DESIGN.md | medium | defer | Copy has no owner document; ledger entry added. |
| 10 | edge-case | Tiers 2 and 3 differ only by numeral colour, against the grayscale AC | medium | defer | Code follows DESIGN.md `ranked-row-tier-2/3`, which set only `rankColor`; needs a UX ruling. Ledger entry added. |
| 11 | edge-case | `+ Read the remaining 1 rows` at 21 rows | low | defer | DESIGN.md-owned copy with no singular form; ledger entry added as a UX note. |
| 12 | edge-case, blind | Collapse leaves hidden rows in the open set | low | defer | Invisible in 2.3 (marker only); Story 2.5 attaches the panel and must decide. Ledger entry added. |
| 13 | edge-case, blind | Rows are mouse-only: no role, tabIndex or key handler | false | reject | EXPERIENCE.md Accessibility Floor puts focus styling, Tab traversal and keyboard paths explicitly out of scope; DESIGN.md: "no keyboard affordance to add". |
| 14 | edge-case | Stale `grown`/`open` state when `rows` changes | false | reject | In 2.3 `rows` is memoised on the immutable loaded set and never changes; Story 2.4's threshold input is the first path that changes it. |
| 15 | edge-case, verification-gap | `ageMark` reads a NaN or future clock as fresh | false | reject | `observedAt` and `lastAttemptedAt` parse through `IsoTimestampSchema`, so NaN is unreachable; a future timestamp from `sync` would be clock skew no path produces. |
| 16 | edge-case | A ranked row with no dataset entry prints `never attempted` | false | reject | `rank` builds `ordering` from the same dataset the view joins on, so every ranked row has its entry; only a unit test passes `[]`, and it does not assert age. |
| 17 | blind | Raw note likely ellipsises in the 492px cell | false | reject | Measured in the browser against committed `data/`: text 410px in a 482px box, no overflow. |
| 18 | blind | League-mismatched entry shows `no figure yet` beside `» priced 3d ago` | false | reject | The frozen Freshness rule mandates the observation clock for a league-mismatched priced entry. |
| 19 | blind | `formatDivine` prints `-0.00` for tiny negatives | low | reject | No raw EV is negative; a negative EV arrives with Epic 3 crafted rows, and the fix adds a branch for an unreachable input. |
| 20 | blind | Asking line (32.5px) and header (32.4px) exceed their 32px budget lines; no test ties gaps to the budget | low | reject | Under 1px total against 530px slack on a `min-height` frame; jsdom cannot measure layout, so the guard would be a new browser test. |
| 21 | blind | Browser acceptance checks are not recorded in the spec | low | reject | Recorded in the step-05 hand-off; the checks ran (frame 1060×1920, header cells, hover, click, grayscale). |
| 22 | blind | Spec `in-review` vs sprint-status `in-progress` | false | reject | The workflow syncs sprint status at hand-off. |
| 23 | blind | Chrome-order test omits `AbsenceLines` | low | reject | The fixture has no absent artifact, so no absence line renders; ordering with absence lines is Story 2.6's strip move. |

## Verification

**Commands:**
- `pnpm check` -- expected: typecheck, lint, depcruise clean.
- `pnpm test` -- expected: all green, no escaped-request failures.

**Manual checks:**
- `pnpm dev` in the background; agent-browser screenshot of the resting page, compared against `mockups/key-hero-resting.html`; hover and click a row; toggle the affordance if there are more than 20 rows.
