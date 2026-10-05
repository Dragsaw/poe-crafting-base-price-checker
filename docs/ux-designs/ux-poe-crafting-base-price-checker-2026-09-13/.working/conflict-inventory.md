# Conflict inventory: visual redesign against the spines

Date: 2026-10-04. Read against DESIGN.md revision 14 and EXPERIENCE.md revision 19 (both `updated: 2026-10-03`).
The authority is `.memlog.md` rows 239–250 and `mockups/key-redesign-dark.html` (v6).

Conventions:
- **D** = DESIGN.md, **E** = EXPERIENCE.md. `L` numbers are line numbers at the time of writing. They help you find a spot. They will drift after the first edit, so use the heading or token name as the stable locator.
- **"v6"** in the "Overturned by" column means the approved mockup draws the change and no memlog row states it in words.
- The dashed "State examples" box in v6 (`#3E4F66` border, `#7F95B3` heading) is mockup annotation chrome. It is not product UI. Do not tokenise it.
- IDs (O-n, T-n, U-n) exist only so a later editor can tick items off.

---

## 1. Overturned

### 1.1 Palette and inks

| ID | Location | Current rule (one line) | Overturned by |
|---|---|---|---|
| O-1 | D frontmatter `description` (L4-7), `name: Field Guide` | "reference-book page … fixed at 1060x1920 … Warm paper … two semantic inks" | 240, 243 |
| O-2 | D `colors.surround`, `paper`, `paper-inset`, `paper-deep` (L35-38) | Warm-paper ground and three tonal steps | 240 (ground #1A1A1D, surface #222226, surface-2 #2C2C31) |
| O-3 | D `colors.paper-raw`, `paper-raw-hover` (L39-41) | Raw Base row tint, plus its own hover tone | 241, 242 (the name colour #C8C8C8 is the raw cue. v6 draws no row tint) |
| O-4 | D `colors.ink`, `ink-secondary`, `ink-tertiary`, `ink-chase-emphasis` (L43-46) | Warm ink ramp, and darker chase text on ranks 1–5 | 240 (text #D9D9D9 / #9A9A9A / #7C7C80), 241 (chase mods #8C8CCF on rows, tiers bold primary text) |
| O-5 | D `colors.rule-hairline`, `rule-strong`, `edge` (L48-50) | Warm rules. `rule-strong` is the ink itself | 240 (line #2E2E33, line-strong #44444B) |
| O-6 | D `colors.sepia` (L52), and D Colors "`{colors.sepia}` is structural and means nothing" (L868-872) | Sepia is the decorative accent: eyebrow, threshold fill, affordances, recipe rule, unit glyphs | 241 (bronze #BFA77A is the one interactive accent), 248 |
| O-7 | D Colors "Sepia may mark what the operator has CHOSEN…" (L874-899) and "*The unit glyphs are the load-bearing case…*" (L910-918) | Sepia carries operator choice, and the unit glyphs are its load-bearing case | 241, 242, 248. The chosen/data distinction may survive with bronze in place of sepia, but the passage cites retired glyphs |
| O-8 | D `colors.ochre`, `colors.rust` (L53-57). D Colors "Two semantic inks…" table (L920-933) | Ochre = `uniform-prior` / `absent`. Rust = stale, never attempted, unresolvable. Told apart by family | 244, 246, v6 (`--rough` #E0913A carries both ◐ and ≈. `--pending` #7E7E86 carries ○) |
| O-9 | D Colors "There were three…" (L935-944), "The freed slot is not reserved" (L946-965), "The refusal did its job" (L967-973) | Slate history and the ink-count argument | 244, 246. The count rule rested on ochre and rust, which are gone. The history is now moot |
| O-10 | D Colors "**No third ink, no success colour.** There is deliberately no green" (L975-978). D Do's and Don'ts row "Keep to the two semantic inks / no success colour" (L2519). E Epistemics *Silence means healthy* "no success mark" (L612-614) | No green, no success colour | v6 draws a green dot (#6FA35F) on the `Synced N ago` button. No memlog row states it (see N-14) |
| O-11 | D Typography "Mantine deltas…": `theme.primaryColor` "would tint … on a page with no blue in it. Point it at … sepia" (L1127-1130). E Foundation Mantine table row `theme.primaryColor` (L55) | The page contains no blue | 241 (magic blue #8888FF is an identity colour) |
| O-12 | D Elevation & Depth (L1637-1647) | Three paper tonal steps. Tombstone takes a 2px `edge` rule. The banner's ochre edge is "the one directional mark" | 240 (re-express on ground/surface/surface-2). The ochre edge no longer has a token |

### 1.2 Type

| ID | Location | Current rule | Overturned by |
|---|---|---|---|
| O-13 | D `typography.stack-serif` (L61-62). D Typography opening and the Serif bullet (L982-990) | Book serif for names, EV, threshold, recipe, appendix, expansion | 242 (bundled Inter for names and figures) |
| O-14 | D frontmatter comment (L29-31) and Brand & Style **Substrate** (L827-830) | "Mantine's … Inter-based type ramp are … replaced" | 242 (Inter is now the face) |
| O-15 | D `typography.stack-mono` comment "the page still downloads no font" (L65-67). D Typography "All three stacks are system-resident. The page downloads no font" (L1047-1048). E Responsive & Platform **Static delivery** "Both font stacks are system-resident and nothing is downloaded (NFR-7)" (L1286-1287) | No downloaded font | 242 (bundled Inter. NFR-7 forbids a server, not a bundle). The mono stack itself can stay system-resident |
| O-16 | D every serif role: `masthead-title`, `dek`, `threshold-value`, `threshold-value-unit`, `recipe-option`, `recipe-cost-figure`, `asking-note`, `row-rank`, `row-unit-name`, `row-ev`, `appendix-title`, `appendix-row`, `panel-title`, `detail-row`, `banner-lead`, `banner-body`, `failure-body` (L84-303) | Sizes and families from the paper design (for example `row-unit-name` 14px/400 serif) | 242 (names 15px/500, top five 600, tabular figures), v6 (EV 15px, chase 12.5px, column header 11px/600 at .06em, header title 18px/600, eyebrow 11px/600 at .08em) |
| O-17 | D `typography.row-unit-glyph` (L180-189) | 11.5px sans glyph role | 242 (glyphs retired) |
| O-18 | D `ranked-row-tier-1` (L437-443) and Typography "**Rank emphasis is carried by weight…**" (L1050-1056) | Ranks 1–5 at 700 with a sepia numeral. Ranks 6–10 take a mid-ink numeral | 242 (top five 600), v6 (name/EV 650, rank numeral text colour 600. Ranks 6+ all `text-3`, so v6 draws no tier-2 step. See N-20) |
| O-19 | D `raw-base-row.nameStyle: italic` (L453) and Components *Raw Base row* "an italic Base Type name" (L1737-1748) | Italic name is one of three raw cues | 242 ("No italics for Raw Base rows") |
| O-20 | D Typography **The mark ramp** (L1058-1061) | Ochre marks at 600. Rust marks at 700. *never attempted* italic | 244, 247 (◐ and ○ glyphs. v6 sets mark 13px, word 12.5px) |
| O-21 | D Typography "The vocabulary is one typeface…" + glyph table (L1063-1093). D `trade-link.fontWeightWhy` (L715). D Do's row "Pick every glyph from Segoe UI Regular and Semibold and Bold" (L2532), "Pin trade-link to 400" (L2533) | The glyph-residency rule is proven against Segoe UI binaries | 242. The rule's subject font is now Inter. ◊ » × ∆ ● are retired from the vocabulary. ◐ ○ ≈ ▾ ■ are new. Residency needs re-proof against the Inter subset (T-24) |
| O-22 | D Typography "**A trust mark has no size of its own**…" (L1095-1101). D comment above `trust-mark-prior` (L496-499) | Mark renders at row-mark, appendix-row, key-body, trust-strip sizes | 243, 244 (key block and trust strip are gone. Mark sizes are v6's) |
| O-23 | D Typography **Tracking** (L1103-1108) | Uppercase at exactly four tracked sizes (0.16 / 0.18 / 0.2 / 0.22em) | v6 (column header .06em, league eyebrow .08em) |
| O-24 | D Typography "**Every role declares a lineHeight**…" (L1110-1124) | The 28px row and 1920px fit are computed from declared line heights | v6 (38px row). The 1920 fit is retired by 243. The rule to declare a lineHeight on every role may survive. Its justification does not |

### 1.3 Frame and layout

| ID | Location | Current rule | Overturned by |
|---|---|---|---|
| O-25 | D `spacing.frame-width`, `frame-height`, `content-width` and their comments (L312-320) | 1060 x 1920 fixed frame, 1012 content | 243 (fixed frame retired), v6 (`max-width: 1120px`, 24px side padding) |
| O-26 | D Brand & Style **The frame is fixed** (L832-836) | Fixed frame, surround, `min-height`, no breakpoints, no dark mode | 240, 243 |
| O-27 | D Layout & Spacing "**The frame is a constant…**", "**The frame is 1060px, not 1080px…**", "**The 20px came out of the gutters…**", "**The frame's box model, exactly**" (L1150-1187) | Scrollbar arithmetic, outline-not-border, gutters versus columns | 243 |
| O-28 | E Responsive & Platform bullets: frame constant, target 1080x1920, 1060 not 1080, 20px from gutters, no breakpoints (L1220-1241) | Same frame rules, restated behaviourally | 243 (the target monitor may survive. The frame does not) |
| O-29 | D `spacing.col-rank` … `col-chase`, `chase-cell`, `pad-*-right` (L326-338). D Layout table "The ranked-row column budget is a contract" (L1203-1213) | Six columns that sum to 1012: rank 32, unit 222, EV 84, Provenance 88, Age 94, chase 492 | 244, 247 (Provenance and Age columns removed), v6 (grid 32 / 220 / 96 / 1fr, 14px column gap, three equal chase cells with 18px gap) |
| O-30 | D Layout "*Provenance is 88px…*", "*The mark that bought those 12px…*", "The Provenance and Age columns are narrow on purpose" (L1259-1285). memlog 174 | Arguments for keeping the 88px column | 247 (the column is gone. Its space goes to Best combinations) |
| O-31 | D Layout "*The chase cell's budget in characters*" ~27 chars (L1287-1292). E Domain Vocabulary 27-char budget (L402-406). E Coverage Self-Check column sums (L1553-1560) | 154px at 10.5px gives a 27-character budget | v6 (chase cells now about 210px+ at 12.5px Inter. The budget must be re-measured, T-25) |
| O-32 | D `spacing.row-height: 28px` and the Do's rows "Hold every ranked row at row-height" / "Relax the 28px ranked row" (L2541, L2553). E Foundation Mantine `Collapse` row "a 28px row" (L52) | 28px ranked row | v6 (38px rows, 32px expansion lines) |
| O-33 | D `spacing.frame-slack`, `frame-reserve-banner`, `-health-line`, `-absence-line`, `-list-statement`, `sync-report-max-height` comment (L366-378). D Layout "**The vertical budget, computed**" table and reservations (L1467-1517). E Responsive & Platform "overflow rule" items 1–4 (L1247-1272) | Resting page budgeted in pixels against 1920 | 243 (footer follows content. No frame to budget against) |
| O-34 | D Layout "**What expansion spends, in order**" (L1519-1530), "**Which box scrolls**" (L1532-1540). E Responsive & Platform "**Which box scrolls**" (L1274-1280) | Frame `min-height: 1920`. No region is pinned. Everything travels with the page | 243, v6 (64px sticky header, `position: sticky`) |
| O-35 | D Layout "**The rule was always two rules…**", clause One and Two, overrun table (L1542-1574) | Budgeted chrome never overruns 1920. Twenty rows release into scroll | 243 (both clauses are written against the frame. The FR-30 and state-35 overrun table is moot) |
| O-36 | D Layout "**Density is the brief**" (L1452-1458) and "**Vertical order down the page, fixed**" (L1460-1465). E Information Architecture region table (L82-96) | masthead → trust strip → sync report → asking-price line → header → 20 rows → affordance → appendix → key block → running foot | 243, 244 (v6: header bar → column header → rows → footer legend) |
| O-37 | D Layout "**The open-row marker bleeds into the padding**" (L1189-1201). D `ranked-row.openMarker` (L436). D Components *Hover and open* (L1730-1735). E Interaction Primitives hover table, `ranked-row` Persistent cell (L1134) | 3px sepia left rule with negative margin, bottom rule promoted to `rule-strong` | v6 (2px bronze `inset` box-shadow on the row and on the panel, bottom border transparent). Bronze per 241/248 |
| O-38 | D Layout **Spacing scale**: `gutter` 34px is the masthead's top padding (L1621-1629). D `spacing.gutter`, `threshold-panel-width`, `recipe-panel-width`, `masthead-control-gap`, `dek-max-width` and the 508/480 arithmetic (L387-400) | Masthead geometry | 243 |
| O-39 | D Do's rows: "Keep the frame at frame-width and centre it / no dark palette" (L2556), "Leave the frame 20px narrower" (L2557), "Fit the default twenty-row state inside 1920px" (L2558), "Keep every piece of resting chrome inside its own pixel budget" (L2559), "Reproduce all three column budgets exactly" (L2542) | Frame and budget rules | 240, 243, v6 |
| O-40 | E Responsive & Platform "**No dark mode.** Light mode is a decision (memlog 12/16)" (L1242-1243). E "**No scrolling in the default state**" (L1244-1245) | Light mode only. Twenty rows plus the appendix, key block and foot fit 1920 | 240, 243 |
| O-41 | D Shapes (L1651-1660). D `rounded.none/DEFAULT: 0` (L305-309). D Do's row "Keep every corner square and every surface flat / Don't add a radius, a shadow" (L2555) | Everything square. No pills or chips | v6 (6px radius on the segmented toggle, threshold figure box, sync button and tooltips. 4px on segment buttons) |
| O-42 | D Elevation & Depth "**There are no shadows**" (L1633-1635) | No shadows anywhere | v6 (tooltips carry `box-shadow`) |

### 1.4 Masthead, trust strip and dek

| ID | Location | Current rule | Overturned by |
|---|---|---|---|
| O-43 | D `components.masthead` (L403-419) and Components **Masthead** (L1679-1689). D Brand & Style "A masthead with an eyebrow, a title and a dek" (L812) | Three-line masthead block with the two control panels floated right | 243 |
| O-44 | E Domain Vocabulary **The masthead eyebrow** reads `League {activeLeague}` (L289-299). D Components "*The eyebrow's exact copy*" (L1691-1699) | Eyebrow string `League {activeLeague}` | 243, v6 (eyebrow prints the league name alone, for example `Forbidden Rites`) |
| O-45 | E Domain Vocabulary **The masthead dek** (L301-309). D `typography.dek`, `masthead.copyDek` | Dek text "Item Classes ranked by expected payout per craft…" | 243 ("the dek … leave[s] the top") |
| O-46 | D `components.craft-recipe` (L549-584): `background`, `border`, `padding`, `label`, `labelText: 'CRAFT RECIPE'`, `optionSeparator` pipe, `activeRule` 2px sepia, `inactiveRestingRule` dotted sepia, `affordanceRule`, `affordanceAsymmetry`, `cursor` | Inset panel. Two words with a pipe. 2px solid active rule. Dotted inactive rule at rest | 243 (segmented toggle in the header bar), 248 (a setting is a bronze-filled control), v6 (label `Recipe`) |
| O-47 | D Components **Craft Recipe control** "**The word is the control.** There is no select, no segmented button, no pill" and the three corrections (L1876-1930) | Segmented control refused | 243, 248 |
| O-48 | E Interaction Primitives **Banned everywhere** "Mantine's `SegmentedControl` … for the Craft Recipe" (L1162-1165) | Segmented control banned | 243, v6 |
| O-49 | E Component Patterns `craft-recipe` row: pipe, dotted rule at rest, 2px rule (L581). E state 34 "takes the sepia rule … dotted rule at rest" (L940) | Visual half of the recipe behaviour | 243, 248. The behaviour (synchronous re-rank, no debounce, persists) survives |
| O-50 | D `typography.recipe-cost-figure` 13px serif and Components "*The figure is serif at 13px…*" (L1944-1955). E Domain Vocabulary "**The figure is set apart from its unit**" (L342-352). D Do's row "Set the Craft Cost figure in 13px serif" (L2530). memlog 194 | Craft Cost figure in 13px serif ink | 242, v6 (one 12px `text-3` line `0.01 div / craft` beside the toggle). See N-16 |
| O-51 | D `components.payout-threshold` (L586-614): `labelText: 'PAYOUT THRESHOLD'`, `valueIsInput` with no box, dotted sepia `valueRestingRule`, `readout-*`, `readoutInteractive: false`, `readoutRange` endpoints | Inset panel. A 32px serif figure is the input. A non-interactive readout track | 243 (label `Count outcomes worth ≥`), 248 (a setting is bronze-filled), v6 (boxed 15px figure plus a 120px bronze slider with thumb. No endpoints drawn) |
| O-52 | D Components **Payout Threshold control** "**The figure is the input** … no field, no box" and "**The track survives, as a readout** … not interactive" (L1847-1874). E Component Patterns `payout-threshold` row (L582). E Interaction Primitives item 1 (L1011-1030). E Foundation Mantine `NumberInput` row "no field, no box" (L54) | Figure-as-input. Track cannot be dragged | 243, v6. Whether the slider is draggable is open (N-6) |
| O-53 | D `components.trust-strip` (L615-632) and Components **Trust strip** "At rest", "five labels, verbatim" (L1965-1999) | Two-line strip of five plain facts under the masthead | 243 (attribution, `generatedAt`, `gamePatch` and the Tracked List date move into the sync report) |
| O-54 | E Domain Vocabulary "**The trust strip's five labels, verbatim**" (L246-258). E Component Patterns `trust-strip` row (L583). E IA region row `trust-strip` (L85) | Strip labels and behaviour | 243 |
| O-55 | E State 30 *Trust strip at rest, healthy* (L936) | Two lines of five facts. Affordance `+ the full sync report` | 243 (`Synced N ago ▾`) |
| O-56 | D `trust-strip.affordance` / `affordanceHoverRule` (L623-624). D Components "*The affordance*" (L2055-2062). E Interaction Primitives item 5 (L1060-1067). E hover table row `trust-strip` (L1141). E state 32 "Affordance reads `− the full sync report`" (L938) | Whole strip is the click target. Sepia `+`/`−` text with dotted hover | 243, 248 (bronze ▾ and outline on hover mean click to open) |
| O-57 | E Domain Vocabulary "*Sync Report* is player-facing … the affordance that opens it says so" (L177-178) | The opener names the Sync Report | v6 (opener reads `Synced 1 min ago ▾`) |
| O-58 | D Components "*Why one region and not two*" (L2108-2114). E Epistemics *Sync health — quiet, but on the page* "At rest the strip carries five plain facts" (L815-822) | FR-25's three figures reach the player through the strip | 243 |
| O-59 | D `sync-report-panel` "The tracked-list edit date is NOT repeated here" (L650) and Components "*The tracked-list edit date is not repeated here*" (L2100-2102). E Component Patterns `sync-report-panel` same sentence (L584) | Edit date excluded from the panel | 243 (the date now lives in the panel) |
| O-60 | D Do's row "Keep the Craft Recipe a control in the masthead" (L2539) | The recipe control sits in the masthead | 243 (header bar. The intent survives, the noun changes) |

### 1.5 Provenance, Age, key block and trust marks

| ID | Location | Current rule | Overturned by |
|---|---|---|---|
| O-61 | D `ranked-row.columns` and `markType` (L424, L429) | The row has Provenance and Age cells | 244, 247 |
| O-62 | D `column-header.labels` and `labelsRule` (L464-465). D Components **Column header** (L1771-1788). E Component Patterns `column-header` row (L577). D Layout "*Two headers are worth measuring*" PROVENANCE tightest (L1428-1434) | Labels: blank · `Item Class / Base Type` · `EV (Divine)` · `Provenance` · `Age` · `Chase Combinations, by contribution to EV` | 244, 247, v6 (`#` · `Item class / base` · `EV (Divine)` with tooltip · `Best combinations`) |
| O-63 | D `trust-mark-prior`, `-unknown`, `-stale`, `-never`, `-unresolvable` (L503-528) | Five marks: ◊ prior only, ? unknown, » priced/tried Nd ago, » never attempted (italic), × unresolvable | 244 (none / ◐ rough / ○ pending), 246 (≈ is not a trust state) |
| O-64 | D Components **Trust mark** "Five marks exist and no sixth…" (L1790-1813) | Glyph, hair space and word inline in a column cell | 244, 247 (glyph alone in an 18px slot after the EV. Word and reason in a tooltip on the row. Glyph, word and reason inline in expansion lines) |
| O-65 | D Components "*A Provenance mark is one label per (Item Class, recipe) pair*", "*A recipe switch swaps the mark silently*", "*Where the mark may not go*", "*A raw row has no Provenance mark*" (L1815-1838). E Epistemics *Provenance* table and the following paragraphs (L683-751) | Provenance shown as a ranked-row mark (◊ prior only) | 244 ("Provenance leaves the screen"), 246 (`uniform-prior` prints as amber ≈ before the EV). The per-pair scope (238) and the silent swap carry over to ≈ (T-21) |
| O-66 | E Domain Vocabulary player-facing list includes **Provenance** and **Price State** (L151-155). E "**Provenance is spoken twice**" (L354-358). E "**Enum values shown as written**" Price State and Provenance (L196-202) | Provenance and Price State enum values print on screen | 244 (Provenance leaves the screen. Price State prints as none / rough / pending with reason text) |
| O-67 | E Domain Vocabulary "Four wordings" row 1 and D Do's row "Call the fourth column Provenance" (L241, L2515). D Components "*The fourth column is called Provenance*" (L1783-1788) | Header is *Provenance*, not "Weight" | 244 |
| O-68 | D `components.key-block` (L678-683). D Components **Key block** (L2182-2186). E Component Patterns `key-block` row (L588). E Epistemics *Silence means healthy* "**The key-block is therefore mandatory**" (L616-618). E IA row `key-block` (L95). E states paragraph "`asking-price-line`, `key-block` and `running-foot` render in every state…" (L946-950) | Mandatory three-column key: Silence means healthy · Provenance marks · Age marks | 244, v6 (one-line footer legend) |
| O-69 | D `typography.key-heading`, `key-body` (L232-242) | Key block type roles | 244 (the sync-report panel also uses them, T-1) |
| O-70 | D `components.price-state-glyph` (L532-537). E Component Patterns `price-state-glyph` row (L579). D Typography ●/○ mass note (L1089-1093). D `unit-glyph-raw.adjacencyNote` (L495) | Expansion glyphs ● priced, ○ no-listings, ∆ not-yet-synced, × unresolvable | 244, v6 (priced = no mark. ○ = pending for both no-listings and not-yet-synced. ◐ = rough) |
| O-71 | D Components "*The × appears at two weights on purpose*" (L2290-2293) | × at 700 and 600 | 244 (× retired) |
| O-72 | D `combination-row.line1Columns` and `line2Columns`, `col-combination-state` / `-figure` / `-sample` / `-note` / `-age-observed` / `-age-attempted` (L347-355, L701-702). D Layout combination table rows (L1442-1443) | Two-line row: state, figure, listing sample. Line two: note, observation age, attempted age | 244 (listing counts leave the UI), v6 (one-line 32px row: combination · price 90px · trust 230px · ↗ 24px) |
| O-73 | D Components **Combination row** line one "the listing count the estimate rested on" and line two "both labelled ages" (L2205-2238). E Component Patterns `combination-row` row (L590) | Same, behaviourally | 244, v6. Where the ages and notes go is open (N-3) |
| O-74 | E state 1 `priced` (L905): `●`, word, figure, listing sample count, both clocks | Priced row anatomy | 244 (priced = no mark. No listing count) |
| O-75 | E state 2 `no-listings` (L906): `○` + word, *an open question*, `0 listings found`, jackpot/junk note | No-listings anatomy | 244, v6 (`○ pending · no listings found`, price `—`) |
| O-76 | E state 3 `not-yet-synced` (L907) and state 5 `never-synced` "*never attempted*" (L909) | ∆ plus word and reason. Money slot *no figure yet* | 244, v6 (`○ pending · not checked yet`) |
| O-77 | E state 12 `uniform-prior` → `trust-mark-prior` (L916) | ◊ prior only on the row | 246 (amber ≈ before EV) |
| O-78 | E state 17 *Stale row (≥48h)* → `trust-mark-stale` (L923) | » priced/tried Nd ago at 48h | 244, 245 (◐ rough at 3 days. Crafted rows judged by a 70% EV share) |
| O-79 | E state 18 *Never attempted* → `trust-mark-never`, italic (L924). E state-pattern pointer "State 18 appears there only in the key block" (L888-890) | Italic rust mark | 244 (○ pending) |
| O-80 | E Epistemics *Freshness* (L649-681): cut-off **48 hours**, rust mark says which clock, league-mismatch reads *tried* (memlog 217), never-synced *never attempted* italic, "**A crafted row's Age cell is the age of its figure**" (memlog 232) | 48h cut-off and oldest-priced-input row age | 244 (3 days), 245 (crafted row is rough when ≥70% of its EV rests on unreliable prices. Raw Base row uses its own price age). memlog 232 is superseded |
| O-81 | D Do's and Don'ts **Silence means healthy** "Provenance and Age cells empty … cut-off is **48 hours**" (L2478-2492). D Do's row "Leave the Provenance and Age cells empty" (L2513) | Same rule, in D | 244, 245 |
| O-82 | E Epistemics *Silence means healthy* "Its Provenance and Age cells are empty" (L606-610) | Silence is expressed by empty cells | 244, 247 (silence is the empty 18px slot and no ≈. The principle survives, the anatomy does not) |
| O-83 | E Component Patterns trust-marks row "Inline text, not interactive, **no tooltip**" (L578). E unit-glyph row "no tooltip" (L549) | No tooltip on marks | 247 |
| O-84 | E Foundation "there are **no tooltips**, on truncated text or anywhere else" (L61-64). E Interaction Primitives **Banned everywhere** "Tooltips." (L1156) | Tooltips banned | 247 (mark reason and EV header tooltips) |
| O-85 | E Component Patterns `ranked-row` "No per-row controls … **nothing revealed on hover**" (L547). E hover table `ranked-row` "Nothing is revealed" (L1134). E hover table row "combination-row … **trust marks**: No hover state" (L1142) | Nothing on a row responds to hover except the background | 247 (the mark reveals its reason on hover) |
| O-86 | E Voice and Tone table rows "someone invented this weight" / "estimated weight" (L525), "priced 5d ago" (L526), "never attempted" (L527), money phrases (L529) | `estimated weight` is banned. `Nd` short form. *never attempted* | 246 (v6 says "Some roll odds … are estimated", "some roll odds estimated"), 244, v6 (`priced 5 days ago`, `not checked yet`, `no listings found`) |
| O-87 | E Epistemics *Money slots* table (L788-811). D `components.money-slot` `phrases` (L538-543). D Components **Money slot** "Never `0` … never an em dash" (L1840-1845). D Do's row "Render … `—` where a figure is missing" in Don't (L2544) | Phrases: *an open question*, *no figure yet*, *not valued* (rust), *unknown*. Never an em dash | 244, v6 (a pending price prints `—` in the expansion and in the EV cell of a pending Raw Base row). See N-5 |
| O-88 | E Epistemics *Provenance* "`absent` … exercised only inside `unrankable-appendix`, with the same mark vocabulary (memlog 44)" (L707-709). E state 13 (L918). D `unrankable-appendix.columns` mark column (L672). D Components **Unrankable appendix** "the ochre *unknown* mark" (L2128-2137) | Appendix rows carry `? unknown` in ochre | 244 (the mark is retired and ochre is gone). Replacement is open (N-9) |
| O-89 | D `[NOTE FOR UX]` "**Two marks in this vocabulary have no key-block entry**" (L2337-2344). E Coverage Self-Check "Unresolved … whether † pruned and * pinned belong in key-block" (L1658-1660) | Open question tied to the key block | 244 (the key block is retired. The question moves to the footer legend, N-19) |
| O-90 | E UJ-4 *The trust check* steps 2–4 and "*One mark he will not find…*" (L1401-1419) | Reads the Age cell `priced 5d ago`, Provenance cell, key-block column | 244, 247 (◐ after EV, reason on hover. No Age cell) |
| O-91 | E Coverage Self-Check "**Note copy checked against its cell**", both clocks have their own cells (L1561-1569) | Line-two column arithmetic | 244, v6 |

### 1.6 Unit glyphs

| ID | Location | Current rule | Overturned by |
|---|---|---|---|
| O-92 | D `components.unit-glyph-box`, `unit-glyph-class` (≡), `unit-glyph-raw` (▪) and their comment block (L467-495) | Two sepia glyphs in a fixed 14px box | 242 (retired. Supersedes memlog 184, 187, 195, 197) |
| O-93 | D `ranked-row.unitGlyph` (L427), `raw-base-row.nameCell` / `unitGlyph` (L454-455), `unrankable-appendix.unitGlyph` (L674) | Each surface leads with its glyph | 242 |
| O-94 | D Layout "*The unit column keeps its 222px, and the glyph is paid for…*", "***The box is fixed-width…***", "*What was NOT done*" hanging-glyph idea (L1215-1245) | Glyph geometry | 242 |
| O-95 | D Layout "**What may ellipsise…** A unit glyph is the exception" (L1410-1416). E Domain Vocabulary "**What may be cut**" "A trust mark and a unit glyph may not be cut" (L498-510) | Glyph never ellipsises | 242 (the clause about the glyph is dead. The trust-mark clause now applies to the 18px slot) |
| O-96 | D Components **Raw Base row** "Three cues — tint, italic, glyph" and "*The RAW BASE word retired…*" (L1737-1761). E Component Patterns `raw-base-row` row "Three cues" (L576) | Tint, italic and glyph carry crafted versus raw | 241, 242 (rarity name colour plus the text `Sell as is · item level N+`. 242 `[OPEN]`, N-1) |
| O-97 | D Components *Trust mark* "*The unit glyphs do not make a sixth…*", "*They are also the page's only glyphs without a word*" (L1797-1813). E Component Patterns unit-glyph row and the "**The unit glyphs stand without a word**" essay (L549-575) | Argument for wordless glyphs | 242 |
| O-98 | D Colors `paper-raw` "always with an italic name and the unit-glyph-raw glyph" (L848-855) | Tint is backed by italic and glyph | 241, 242 |
| O-99 | D Do's rows L2524, L2525, L2531, L2534, L2535 (glyph on every row, glyph in sepia, fixed box, glyph flex, header names both) | Glyph rules | 242 (L2535's "name both units" may survive as `Item class / base`) |
| O-100 | E IA "**One list, two ranked units**" "every row states which it is by carrying unit-glyph-class or unit-glyph-raw" (L117-123) | Row unit stated by glyph | 241, 242 |
| O-101 | E Accessibility Floor second bullet "**The third distinction is the one revision 3 rebuilt**" (L1186-1196) | NFR-10 for crafted versus raw is met by the glyph | 242 (met by the `Sell as is` text) |
| O-102 | E states 16, 22, 23 and UJ-1 step 4, UJ-6 step 2 "each with its glyph" (L922, L928-929, L1310-1315, L1469-1470) | Glyph cited in states and flows | 242 |
| O-103 | E Coverage Self-Check "**Component coverage**" lists `unit-glyph-class`/`-raw`. "**Token references — all resolve**" counts (L1514-1542) | Bookkeeping that cites retired tokens | 242 (re-run after the edit) |
| O-104 | D Typography "*The unit glyph is sans although the name beside it is serif*" (L996-999). D Typography Sans bullet "both unit glyphs" (L992) | Type argument for the glyph | 242 |
| O-105 | D `raw-base-row.chaseSlot` and `expansionNote` (L456-457). D Components Raw Base note "*uncrafted at Item Level 82 — valued at its own current asking price…*" (L1742-1747). E "Four wordings" row 3 (L243) | Italic tertiary note in place of the chase cells | 242, v6 (`Sell as is · item level 82+`, with `Sell as is` bold in `normal` grey) |

### 1.7 Interaction and affordance vocabulary

| ID | Location | Current rule | Overturned by |
|---|---|---|---|
| O-106 | D Components **Payout Threshold control** "the same dotted-sepia vocabulary every other clickable thing on the page uses" (L1851-1856). D `craft-recipe.affordanceRule` "This document declares dotted sepia the page's ONE vocabulary for this is clickable" (L569) | One vocabulary: dotted sepia means clickable | 248 (four looks: dotted underline with help cursor = hover explanation; bronze ▾ with outline on hover = click to open; bronze text = show more; bronze-filled control = a setting) |
| O-107 | D `components.expand-affordance` (L758-765) `color: sepia`, `toggleRule` dotted sepia. D Components **Expand affordance** "One pair, everywhere it appears … trust strip's affordance" (L2357-2363). E Component Patterns `expand-affordance` row "Below row 20 · tombstone toggle · trust strip · fetch-failure retry … one vocabulary everywhere" (L593) | `+`/`−` sepia text is the one opener everywhere | 248 (the sync opener is ▾. Show-more is bronze text. Where the tombstone toggle and retry fall is open, N-12) |
| O-108 | D `tombstone-band.toggleGlyphWhy` (L754) and Typography table row "tombstone toggle ▸ ▾ → + −" (L1084) | ▾ is banned because it fell out of Segoe UI | 248, v6 (▾ is the click-to-open sign) |
| O-109 | E Foundation Mantine `Accordion` row "An affordance here is sepia text and a sign, with no button chrome" (L53) | No button chrome | 243, 248 (the segmented toggle and the outlined sync button have chrome) |
| O-110 | E Interaction Primitives "Mouse only. There are **seven** interactions" (L1003-1005) | Seven interactions, plus banner dismiss | 247 (hover explanations add a class of interaction. The count needs restating) |
| O-111 | E Interaction Primitives hover table rows `expand-affordance`, `craft-recipe` inactive/active, `payout-threshold` figure, `trust-strip`, `trade-link` (L1136-1143) | Sepia hover promotions | 248, v6 (`sync:hover` outline. No other hover drawn) |
| O-112 | E hover table `raw-base-row` → `paper-raw-hover` (L1135) | Raw Base hover keeps the tint | 241 (no tint) |
| O-113 | D Do's rows "Use sepia decoratively" (L2523), "Let sepia mark what the operator chose" (L2526), "Give the inactive recipe option its dotted sepia rule at rest" (L2527), "Set the active recipe rule at 2px" (L2528), "Divide the recipe options with the trust strip's `\|`" (L2529) | Sepia and recipe-rule Do's | 241, 243, 248 |
| O-114 | E Interaction Primitives item 5 "Click anywhere on trust-strip … the whole strip is the target" (L1060-1067) | Opener is the whole strip | 243 (a button in the header bar) |
| O-115 | D Do's row "Open the sync report and a ranked row in place … Don't put either in a modal, a drawer, a **tooltip**" (L2561) | No tooltip, modal or drawer | 247 (tooltips now exist for explanation only. The modal and drawer ban can survive, N-7) |

### 1.8 Footer and running foot

| ID | Location | Current rule | Overturned by |
|---|---|---|---|
| O-116 | D `components.asking-price-line` (L652-655). D Components **Asking-price line** "under the trust strip … does not move below the fold" (L2116-2120). E IA row "above the list, never below the fold" (L87). E Component Patterns `asking-price-line` "Under the trust strip" (L585). E Voice and Tone "it does not move below the ranked list, and it is not shortened" (L531-533) | Italic serif sepia sentence above the list | 243 ("the asking-price disclaimer moves to the footer"), v6 (`Prices are live asking prices, not sales.`) |
| O-117 | D `components.running-foot` and `typography.running-foot` (L243-247, L766-769). D Components **Running foot** (L2377-2380). E Component Patterns `running-foot` row (L596). E IA row (L96) | One line: read-only while playing, exact ages one click down, curation in `data/tracked.json` | 243, 244, v6 (the footer is a legend plus the asking-price sentence. The running-foot copy is not drawn, N-19) |
| O-118 | D Do's row "Say *current asking price from a live instant-buyout listing*" (L2554). E Voice and Tone row 1 (L522) | Exact sentence | 250 (copy is UX-owned), v6 (shortened sentence). FR-13's substance survives |

### 1.9 Accessibility floor

| ID | Location | Current rule | Overturned by |
|---|---|---|---|
| O-119 | E Accessibility Floor first bullet "two semantic inks, each always spoken with a glyph *and* a word" (L1180-1185). D Do's and Don'ts "**Colour alone never carries a distinction.** Every semantic ink is always paired with a glyph and a word" (L2504-2506). D Do's row "Pair every semantic ink with its glyph and its word" (L2518) | Every mark is glyph plus word | 247 (on the row the glyph stands alone and the word is in the tooltip. "Shape plus colour, so NFR-10 holds") |
| O-120 | E Accessibility Floor bullet "**Rendered text, not raw ids**" "no icon appears anywhere in the product" (L1203-1205). D Components "**One denomination, no currency icon — and one other icon**" (L2460-2474) | ↗ is the one icon | v6 (▾ chevron and ■ legend swatches. Swatches are text glyphs, so this is minor) |

### 1.10 Voice and tone copy

| ID | Location | Current rule | Overturned by |
|---|---|---|---|
| O-121 | E Domain Vocabulary "**The PRD's §3 Glossary is binding** … a synonym introduced anywhere is a discipline violation. These terms appear on screen verbatim" (L147-155) | Glossary terms print verbatim on screen | 250 (on-screen strings are UX-owned), v6 (`Best combinations` for Chase Combination, `Count outcomes worth ≥` for Payout Threshold, `Recipe` for Craft Recipe, `Item class / base`, `div`, `Synced`). Needs a PRD touchpoint (§5) |
| O-122 | E "Four wordings" row 2 "`div` after every figure" banned (L242). D Components *Money figures* "That is what retires the `div` abbreviation — the Glossary declares *Divine* verbatim-only" (L1718-1724). D Do's row "Spell *Divine* … Don't print `div` or `ILVL`" (L2516). E Domain Vocabulary **Craft Cost** copy `N.NN Divine / craft` (L333-340). D `craft-recipe.costText`, `costAbbreviation` (L579, L581). D `payout-threshold.unit` "reading Divine" (L603) | *Divine* spelled. `div` never printed | v6 (`0.25 div`, `0.01 div / craft`, `div` in the tooltip). The column header keeps `EV (Divine)`. Confirm under 250 (N-17) |
| O-123 | E Domain Vocabulary Item Class rule "The two words *Item Class* are printed only where the page is naming the kind … the column header and the appendix title" (L157-164) | Header uses the Glossary noun | v6 (`Item class / base`) |
| O-124 | E Domain Vocabulary "**Never printed as a word**": "A Price Observation appears as a price with a sample size and an age", "`lastAttemptedAt` is spoken as *tried Nh ago*" (L185-194) | Sample size and two clocks are on screen | 244 (listing counts leave the UI. Pending reasons replace *tried*) |
| O-125 | E Coverage Self-Check "**Whether any Item Class name needs a display mapping is closed, elsewhere** … the only transform is AD-5's underscore-to-space trim" (L1661-1664) | No display mapping | 230, 249 (defence suffix prints `Helmets (Str)`). This line was already stale before the redesign |
| O-126 | E UJ-2 step 2 "The slider is gone, though the track beneath still shows him where `1` sits" (L1336-1339). E Interaction Primitives item 1 `[OVERRIDE — memlog 36/37]` (L1016-1019). D Components payout "*This is a deliberate override of UJ-2*" (L1872-1874) | No slider | v6 (slider drawn). Interactivity is undecided (N-6) |

---

## 2. Translate (re-skin only)

These keep their behaviour. Each needs its visual spec re-expressed in the new palette and type, and v6 does not draw any of them.

| ID | What | Where specified | Open visual question |
|---|---|---|---|
| T-1 | Sync report panel: six groups in three columns, mono diagnosis, 400px cap, internal scroll | D `components.sync-report-panel` (L633-651), D Components *Expanded* (L2064-2107). E Component Patterns row (L584). E *Two registers in one panel*. E state 32 | It now also holds the Weights File attribution, `generatedAt`, `gamePatch` and the Tracked List date, with the `(not committed)` / *unknown* rules (E L260-265). Does a fourth group or column take them? Its type roles were `key-heading` / `key-body`, which retire with the key block. Placement relative to the sticky header is N-7 |
| T-2 | Unrankable appendix: title with count, lead, four columns, reason strings, note, empty state | D `components.unrankable-appendix` (L662-677), D Components (L2128-2180). E Component Patterns row (L587). E states 13–16, 37 | Count in rust when non-zero (rust is retired). Mark column (`? unknown`) is N-9. Four-column budget summed to 970 against the old 1012 frame. Position "pinned to the foot … above the key block" becomes "above the footer legend"? `typography.appendix-*` serif roles |
| T-3 | Uniform-prior banner (FR-11): inset panel, 5px ochre left edge, ochre lead mark, dismiss control | D `components.uniform-prior-banner` (L656-661), D Components (L2122-2126), D Elevation "the one directional mark" (L1646-1647). E *The uniform-prior banner* (L753-786), state 19 | Ochre is gone. Does the edge take the ≈ amber? Its lead was an ochre `◊ prior only` trust mark, which is retired. Copy relation to ≈ is N-4 |
| T-4 | Refusal screen | D `components.refusal-screen` (L772-789), D Components (L2382-2399). E Component Patterns row (L594), state 26 | Rust eyebrow, `masthead-title` 38px serif, paper ground, `trust-mark-unresolvable` × beside the artifact name, `dek-max-width` body. All retired tokens. No alarm ink exists in the new palette (N-10) |
| T-5 | Fetch-failure screen with `+ Try again` | D `components.fetch-failure-screen` (L790-801), D Components (L2401-2408). E Component Patterns row (L595), state 28 | Same token issue as T-4. Which of the four looks `+ Try again` takes is N-12 |
| T-6 | Absence lines (`Not published` × three) | D `trust-strip.absenceLines` / `absenceLineCopy` (L630-632), D Components (L2028-2053). E Domain Vocabulary (L267-287), state 38 | The strip that held them is gone. Placement is a decision (N-8). The copy and the no-mark rule translate as they are |
| T-7 | Health line (`× N unresolvable`, starvation `N of M`, `left the rotation no search`) | D `trust-strip.healthLine` / `healthSignals` (L627-629), D Components (L2001-2026). E Component Patterns `trust-strip` row (L583), state 31, *And loud when wrong* | Placement, glyph (× retired) and ink (rust retired) all depend on N-2. The trigger semantics (memlog 216/222/223) translate unchanged |
| T-8 | Threshold input edge states: editing rule, caret, selection, clamp on blur, min 0 / max 3 / step 0.05, `Divine` suffix not selectable | D `payout-threshold` (L594-608), D Components (L1851-1863). E Interaction Primitives item 1 | v6 draws only a boxed figure at rest. The editing and focus look of the boxed figure is undrawn. The suffix reads `div` in v6. Does the slider share min/max/step? (N-6) |
| T-9 | Uncostable recipe: the Craft Cost slot reads *no figure yet* | D `craft-recipe.costUncostable` (L583), D Components (L1957-1963). E Domain Vocabulary (L339-340), state 35 | Header slot treatment of the phrase (italic sans was the money-slot look). State 35's per-branch tiers, suppressed numerals and above-list statement need a place (T-15) |
| T-10 | Tombstone band: `+ N pruned` toggle, struck-through line, `† pruned`, *not tracked*, prune reason | D `components.tombstone-band` (L746-757), D Components (L2346-2355). E Component Patterns row (L592), state 10 | `paper-deep` band and a 2px `edge` rule need dark-step equivalents. Its line-two contract is tied to the two-line row, which v6 drops (N-3). Toggle look is N-12 |
| T-11 | List affordance `+ Read the remaining N rows` / `− Show only the top 20` | D `expand-affordance.listCopy*` (L763-765), D Components (L2365-2375). E Interaction Primitives item 4, state 33 | Under 248 this is "bronze text = show more". The dotted toggle rule retires. (E L1055 prints `— Show only` with an em dash, which contradicts U+2212. That typo predates the redesign) |
| T-12 | Below-threshold combination lines: note *below the threshold — adds nothing to EV*, never greyed | D `combination-row.below-threshold-note` (L708), D Components (L2222-2223). E state 20 | The v6 line has no note cell. Where does the marker sit on a one-line row? (N-3) |
| T-13 | Trade link ↗: glyph-only click target, absent rather than greyed, restraint (memlog 202) | D `components.trade-link` (L712-723), D Components (L2263-2288). E Component Patterns row (L591), Interaction 6 | v6 draws ↗ in `text-3`, centred in 24px, with no hover. The old hover was sepia. Is it bronze now, and which of the four looks? (N-12). The weight-400 pin was a Segoe fact (O-21) |
| T-14 | Expand affordance on a ranked row, and the open-row marker | D `ranked-row` hover/active/openMarker. E hover table row `ranked-row` | v6 draws hover = `surface`, open = `surface` + 2px bronze inset. No pointer-down (`paper-deep`) step is drawn. Does it survive? A row opens without a ▾, which sits against 248's "▾ = click to open" (N-12) |
| T-15 | List statements: state 23 *canonical order, not ranked*, state 25 *nothing clears* (live threshold), state 35 *branches not comparable*, the unresolvable-only variant | D `spacing.frame-reserve-list-statement` (L377). E states 23, 25, 35, and "A list of only unresolvable rows" (L990-999) | They sat "under `{components.asking-price-line}`", which moved to the footer. Proposed spot: between the header bar and the column header. That spot is not drawn |
| T-16 | Skeleton rows (state 22): flat bars, header labels final, eyebrow blank until the league is known | D Components **Skeleton rows** (L2410-2425). E Foundation `Skeleton` row, state 22 | Bars were `paper-inset` 10px in a six-column 28px grid. Re-express for 38px rows in the four-column grid, with the header bar painted immediately |
| T-17 | Expansion panel shell | D `components.expansion-panel` (L684-693), D Components (L2188-2203). E Component Patterns row (L589) | v6 panel = `surface` with bronze inset, left padding 46px, no border, no title, no sub-line. The bordered `paper` card, `panel-title` serif 20px and `{spacing.4}` bottom margin retire. Whether the title and sub-line survive is N-11 |
| T-18 | Pinned mark `* pinned`: leads line one, `ink-tertiary` 600, lookup key for the starvation line | D `components.curation-status-pinned` (L732-745), D Components (L2295-2344). E state 9 | Re-express on `text-3`. The colour argument (no ink, no sepia) needs restating against bronze and the rarity pair. Its partner signal (the starvation line) depends on N-2. The 460px width note is tied to the old `col-combination` |
| T-19 | Fallback in the mono verbatim register, and the cross-file diagnosis | D Typography third stack (L1001-1045), D Layout fallback (L1356-1395). E Domain Vocabulary fallback, *Two registers in one panel* | The mono stack survives as system-resident. Re-state "takes the line's size" against Inter line sizes. The `«»` collision argument cites the retired » (D L1385-1386). Mono character count per chase cell needs re-measuring (T-25) |
| T-20 | Price states inside the expansion | D `combination-row`. E states 1–7 | v6 draws priced (blank trust cell), rough (`◐ rough · priced 5 days ago`), and pending in two variants. Unresolvable, league-mismatch and no-exchange-rate are undrawn (N-5) |
| T-21 | Recipe switch (state 34): the ≈ swaps silently, the banner re-reads, panels stay open | E state 34, *Provenance* "A recipe switch swaps the mark silently" (L735-739). D Components (L1823-1826) | Mechanical: "Provenance cell re-renders" becomes "≈ appears or disappears before the EV". The segmented toggle's active state replaces "solid word + sepia rule" |
| T-22 | Negative-EV rows (state 21) | E state 21 | v6 dims the EV of negative rows to `text-3` (`.neg .ev`). State 21 says a negative EV is a real quantity, "bad news rather than missing news". Confirm that dimming does not read as missing (N-20) |
| T-23 | `< 0.01` floor, 2dp money figures | D Components *Money figures*. E Domain Vocabulary (L327-331) | None. Re-express in Inter at 15px tabular |
| T-24 | Glyph residency in bundled Inter | D Typography glyph table (L1078-1087) | Re-prove ◐ U+25D0, ○ U+25CB, ≈ U+2248, ▾ U+25BE, ↗ U+2197, − U+2212, † U+2020, `*`, ■ U+25A0 at 400/500/600/650 in the shipped Inter subset. This is a measurement, not a choice |
| T-25 | Character budgets and width measurements | D Layout chase budget (L1287-1292), Item Class label measurement `Body Armours (Str/Dex/Int)` against 214px (L1247-1257). E Domain Vocabulary (L402-406) | The chase cell is now `1fr` / 3 at 12.5px Inter, and the name column is 220px at 15px/500 (600 in the top five). Re-measure both. The 27-character rule and the "candidate for pruning" escape valve survive as policy |

---

## 3. Needs a user decision

### N-1. Price State mapping onto none / ◐ rough / ○ pending (highest priority)

Proposed mapping. "Fits" means the mapping follows from memlog 244/245 without invention.

| Old state | Proposed verdict | Reason text (row tooltip and expansion line) | Fits? |
|---|---|---|---|
| `priced`, under 3 days | none | — | Yes (244) |
| `priced`, 3 days or more | ◐ rough | `priced N days ago` (v6) | Yes (244) |
| `priced` on 1–2 listings | ◐ rough? | undecided | **Open** (244 `[OPEN]`) |
| `no-listings` | ○ pending | `no listings found` (v6) | Yes (244 rules pending covers it) |
| `not-yet-synced` / `never-synced` | ○ pending | `not checked yet` (v6) | Yes (244) |
| `not-yet-synced` / `league-mismatch` | ○ pending | undecided (old note: *the observation belongs to another league*) | **Partly.** It is "no price yet", but the honest-empty state (23, UJ-6) would then put ○ on every row of the list, which is the opposite of silence. State 23's EV rule (*no figure yet* everywhere) also collides with a ○ verdict |
| `not-yet-synced` / `no-exchange-rate` | ○ pending | undecided (old note: *the listing currency had no rate at sync time*) | **Partly.** A listing exists and only the conversion failed. "Pending" suggests waiting for a check that already ran |
| `unresolvable` | **no clean fit** | old note: *its id is gone from the trade API — a patch did this* | **No.** It is not "no price yet" (no sync will ever price it) and not "unreliable". FR-24 requires it to be loud. Options: (a) ○ pending with a distinct reason, which hides a break behind a waiting word; (b) a fourth verdict, which reopens 244's three states. The ranking excludes these entries, so they appear only in expansions and the health signal |
| Row `tried Nd ago` (no entry priced) | ○ pending? | undecided | **Open.** memlog 232 is gone. What does a crafted row show when none of its entries is priced? Its EV is then minus the Craft Cost (state 21 shape), and a 70% share of a non-positive EV is undefined |
| Row *never attempted* | ○ pending | `not checked yet` (v6 Stellar Amulet) | Yes |
| Crafted row, EV ≤ 0 or no priced input | undecided | — | **Open.** The 245 share rule needs a defined result when EV ≤ 0 (states 21 and 25 put every crafted row there) |
| Provenance `uniform-prior` | ≈ (not a trust verdict) | expansion context line (v6) | Yes (246) |
| Provenance `absent` (partial pool) | **no fit** | — | **No.** It occurs only in the Unrankable appendix. It is neither a price verdict nor ≈. See N-9 |
| `pruned` tombstone | none (tombstone band) | prune reason | Yes. Tombstones never carried a trust verdict |

Two further points belong to the same decision:
- **FR-9 says the four Price States are "four different things on screen" and are never collapsed.** Pending merges two of them on the glyph and splits them only in reason text. That is a requirement-level change (§5).
- **The stale clock.** Old rule: an unpriced row reads *tried Nd ago*, and the clock is always named. With pending, an unpriced entry shows no age at all. Does `tried N days ago` survive anywhere, for example in the expansion reason? FR-12 requires the clock to be named.

### N-2. "Loud when wrong" without a trust strip

The health line (`× N unresolvable`, pinned starvation) was the at-rest, no-click signal that FR-24 and FR-25 require (E *And loud when wrong*, state 31, UJ-5 step 2). The 64px header has room only for `Synced N ago ▾` and its dot. Undecided: does the dot change state (and to what), does a line appear under the header, or does the sync button carry a count? Until this is ruled, "silence means healthy" is half a rule. E itself names that as the failure mode (L623-626).

### N-3. One-line expansion rows versus the two-line combination row

v6 draws 32px one-line rows: combination · price · trust (glyph, word, reason) · ↗. That drops line two (memlog 101, 115), so the following have no drawn home:
- both labelled clocks for every entry (FR-8, FR-12; UJ-3 step 6)
- the per-state notes (jackpot/junk, unresolvable, league-mismatch, no-exchange-rate, never-synced)
- the below-threshold note (state 20)
- the Raw Base row's note *no affixes — this Base Type priced as it drops…*
- the tombstone's prune-reason line

Proposal for the user to confirm or reject: the 230px trust cell's reason text replaces the note and the clocks, and below-threshold and tombstone keep a second line. memlog 247 rules only that expansion lines "keep glyph + word + reason".

### N-4. FR-11's global banner against the new ≈ cue

memlog 246 asks for this re-check. Questions:
- Is the banner kept? While its condition holds, every crafted row carries ≈, so a per-row ≈ discriminates nothing. That is FR-11's own premise.
- Its copy speaks of a "uniform prior", while the new plain vocabulary is "estimated roll odds". Voice and Tone's "someone invented this weight" / don't-say-"estimated weight" row is reversed by 246.
- Its look (inset panel, 5px ochre edge, dismiss ×).
- It "points the player at per-row freshness", which is now ◐.

### N-5. Dash for a missing price

v6 prints `—` for a pending price (expansion line, Stellar Amulet EV). The money-slot rule (memlog 43) and FR-9 forbid "a dash that reads as worthless". Choose one:
- accept `—` because ○ pending and its word sit beside it, or
- keep money phrases, in which case the honest-empty *no figure yet* rule (state 23) needs restating.

The phrase *not valued* (unresolvable, rust) and *an open question* (no-listings) also need a ruling.

### N-6. Threshold slider

v6 draws a bronze slider beside the boxed figure. The spines say the track is a non-interactive readout (memlog 73/74, UJ-2 override), E bans "drag of any kind" (L1148-1150), and FR-6 says "a number input, not a slider". Questions:
- Is the slider draggable?
- If yes: FR-6 changes, the UJ-2 override reverses, and the debounce, step and min/max rules need restating.
- If no: it is a readout styled like a control. That contradicts 248, where a bronze-filled control is a setting.

### N-7. Where the sync report opens

`Synced N ago ▾` sits in a sticky header, and ▾ suggests a dropdown. The spines require "in place, pushing the regions below down … not a modal, not a drawer, not a tooltip" (D L2561, E L584, state 32). With a sticky header, does the panel open below the header and push the list, or overlay as a dropdown? The 400px cap was justified against the retired frame budget.

### N-8. Absence lines and the stale-patch check

- **Absence lines** (state 38). Today they print at rest, with no click, inside the strip. Do they move into the sync report (one click down) or stay at rest under the header?
- **Stale `gamePatch`** (state 29, UJ-4 step 4). The player compared the patch at rest. FR-10 asks for the producer, time and patch "beside any figure they influenced", and now they sit behind a click.

### N-9. Unrankable appendix mark for `absent`

The ochre `? unknown` mark column has no successor. Options: drop the mark column (the reason string already says why), or print the plain word *unknown* with no mark. The appendix count was rust when non-zero, and no alarm ink exists now.

### N-10. Alarm ink for the failure screens and the health signal

Rust carried "broken". The new palette has rough amber (#E0913A, an "unreliable price"), pending grey and bronze (interactive). The refusal and fetch-failure eyebrows, a non-zero appendix count and the health signal need a ruling. This document proposes no colour.

### N-11. Expansion title and sub-line

E (L589) and FR-8 make the panel repeat the active threshold, the recipe and the asking-price framing, "so a panel read on its own cannot be misread" (UJ-3 step 3). v6 draws only the ≈ context line. Keep the sub-line (and in what form), or rely on the sticky header, which now keeps the threshold and recipe always visible?

### N-12. Which of the four looks (248) applies to the undrawn controls

Undrawn controls: the tombstone toggle `+ N pruned`, `+ Try again`, the banner dismiss ×, the trade link ↗, and the ranked row itself (it opens on click without a ▾). Also: v6 writes `+ 19 more combinations` inside an expansion. That implies a capped expansion with a show-more. The spines and FR-8 require the expansion to list every Tracked Entry, uncapped. Is the expansion now capped by default?

### N-13. Rarity colour as the unit cue (242 `[OPEN]`)

Is `Sell as is · item level N+` enough as the non-colour cue for NFR-10, or does the name column need a non-colour mark? Related: UJ-1's climax "told apart without reading a word" now relies on colour, so the non-colour path requires reading. v6 also shows `item level 75+` for Sapphire Ring. FR-3 fixes the Raw Base floor at 82. Are floors per base now?

### N-14. Green sync dot

v6 draws a green #6FA35F dot on the sync button. D Colors and Do's ban green and success colours, E bans "no green tick", and Brand & Style bans "status lights". No memlog row covers it. Keep it (and say what turns it off) or drop it?

### N-15. One amber hue for two families

v6 uses `--rough` #E0913A for ≈ (estimated odds) and ◐ (unreliable price). The old Colors section kept degraded-weight (ochre) and broken-or-old (rust) apart by hue. The glyphs differ, so NFR-10 holds. Confirm that one hue is intended, since 246 split ≈ from price trust to keep the two meanings apart.

### N-16. Craft Cost legibility

memlog 194 raised the cost to 13px serif ink because a smaller one "stated the inverse of its importance". v6 sets it at 12px `text-3`, which is 4.18:1 on the ground. Accept, or restate 194?

### N-17. Glossary words on screen (250)

v6 prints `div`, `Best combinations`, `Count outcomes worth ≥`, `Recipe`, `Item class / base`, `item level 82+`, `Synced`, and "weights source" / "mod tier" in the ≈ context line. "weights source" sits close to the banned back-end term `weightSource`. Confirm that 250 releases on-screen copy from §3's verbatim rule. Also confirm the 250 `[ASSUMPTION]`: 3 days and 70% are UX-owned and not PRD-owned. Does the same apply to FR-7's 0.25 cold start and FR-12's 48 hours, which the 3-day rule replaces?

### N-18. Accessibility floor against the dark palette

memlog 13 keeps accessibility out of scope, and the floor claims no contrast ratio. The legibility rationale (an angled glance across a desk) still binds. Measured (WCAG formula):

| Pair | Ratio |
|---|---|
| `text-3` #7C7C80 on ground / surface / surface-2 | 4.18 / 3.81 / 3.34 |
| `pending` #7E7E86 on ground / surface | 4.31 / 3.94 |
| `text-2` #9A9A9A on ground / surface | 6.17 / 5.63 |
| `magic-dim` #8C8CCF on ground | 5.60 |
| `rough` #E0913A on ground / surface | 6.85 / 6.25 |
| `accent` #BFA77A on ground | 7.46 |
| `line` / `line-strong` on ground | 1.29 / 1.80 |

`text-3` carries the rank numerals, column headers, Craft Cost, the `—` and the trade link. The ○ pending glyph is lowest on the open panel's `surface` (3.94), which is where pending lines live. Decide whether the floor gains a minimum, or stays at "no claim".

Focus rings and keyboard paths stay out of scope (E L1148-1150). The new hover-only tooltips are consistent with mouse-only input. The verdict glyph stays visible without hover, which keeps memlog 191's argument (no affordance only under the pointer).

### N-19. What the footer must carry

The running foot's three facts (read-only while playing; exact ages one click down; curation in `data/tracked.json`) are "the only place the page tells the player where curation actually happens" (E L596, UJ-5 step 6). v6's footer is a legend plus the asking-price sentence. Do the three facts join the footer? Do `† pruned` and `* pinned` join the legend (the old key-block note, memlog 201)? Does the asking-price sentence keep FR-13 force when expansions push the footer out of view? The old rule was "never below the fold".

### N-20. Rank emphasis tiers and the negative-row dimming

v6 draws only top five versus the rest. Ranks 6–9 all use `text-3` numerals. Does tier 2 (ranks 6–10) survive? v6 also dims negative EVs (T-22). Is that a new rule?

### N-21. Freshness rule for crafted rows (245) needs IMPLEMENTATION-NOTES

The share-of-EV computation belongs to the architect (245). UX needs to know the following before writing state 17's replacement:
- the result for EV ≤ 0 (N-1)
- whether the 70% is measured on gross outcome value or on net EV
- whether pending entries are excluded from the denominator

### N-22. Target viewport without a fixed frame

The frame is retired (243), but v6 sets `max-width: 1120px` and no minimum. Is the 1080x1920 portrait monitor still the target? Below what width does the grid break (the name column is 220px plus a 96px EV)? E says "no breakpoints". Should that rule survive as-is?

---

## 4. Unaffected

These survive as written (citations to retired tokens aside):
- E **Foundation**: the trade-link and FR-33 paragraphs (L27-43). The "no virtualisation" rule (L62).
- E **Domain Vocabulary**: the Item Class label rule (memlog 230, re-confirmed by 249); the Accepted Tier group; the back-end-only list; FR-4 reason strings verbatim; Combination as tier plus short form; Accepted Tier; mixtures; the five short-form coining rules; escape valve; fallback gap owners (memlog 231); hybrid modifiers; `[NOTE FOR UX]` memlog 143; 2dp money and `< 0.01`; recipe option word derivation (memlog 233).
- D **Layout & Spacing**: "A Combination reads as tier plus short form" through the coining rules and escape valve (L1294-1354). The `[NOTE FOR UX]` memlog 143 (L1397-1408). The appendix-at-the-foot argument, as a position decision (L1576-1598).
- D Components: `craft-recipe.optionText` / `optionTextSource` / `optionTextWhyNotComposition`; `refusal-screen.bodyByCause` and `titleText`; `fetch-failure-screen.titleText` (memlog 237); appendix reason strings and the note rule (L2148-2180); `trade-link.renderedWhen` / `hiddenWhen` / `restraintWhy`; cross-file diagnosis placement (L2426-2436); fallback `[ASSUMPTION]` (L2438-2445).
- E **Epistemics**: *Two registers in one panel*, except its "strip has exactly two health triggers" sentence (N-2). *A missing coverage figure* (memlog 212). "Nothing in the panel is computed by the page". The propagation sentence "`core` propagates the weakest Provenance…" (internal).
- E **State Patterns**: 8, 11 and 12a (in substance: silence), 14, 15, 15a, 24, 27, 36. Behaviour of 20, 21, 25, 33, 34, 35. *The recipe axis, ratified* (L960-970). *FR-30's world* (behaviour; its frame citation goes with O-35). The unresolvable-only statement copy.
- E **Interaction Primitives**: 1a behaviour, 2, 3, 4 behaviour, 6 including findings T3/T4 (T4's "FR-12 puts the attempt's age on the row" needs a re-read after N-1). *What survives a reload*. The bans on sorting, hover-revealed row actions, modals, auto-refresh, attention animation, write paths and clipboard snippets.
- E **Accessibility Floor**: *Rendered text, not raw ids* (except the "no icon" clause) and the hybrid-label bullet.
- E **Key Flows**: UJ-1 failure path, UJ-2 failure path (state 25), UJ-5's unsupported-edit paragraph, UJ-6 steps 1, 5, 6.

---

## 5. PRD touchpoints

Requirement-level changes only. Strings and fixed values are UX-owned (memlog 250).

- **FR-3**: say that a Raw Base row is told apart by a non-colour text cue as well as colour. Re-check "item level 82" against v6's per-base floor (`75+`) (N-13).
- **FR-6**: "a number input, not a slider" needs a ruling if the v6 slider is interactive (N-6).
- **FR-7**: if fixed values move to UX (250), the 0.25 cold start's *(PRD-owned)* tag moves with it (N-17).
- **FR-8**: drop "the listing count the estimate rested on" (244). Restate "its age, labelled as observation or last-attempted" if the clocks no longer show for every entry (N-3). Restate "every Tracked Entry appears" if expansions cap with a show-more (N-12).
- **FR-9**: "four Price States … never collapses one into another" becomes three player-visible price-trust states. The underlying states stay distinct in reason text. Decide where `unresolvable` lands (N-1).
- **FR-10**: Provenance is no longer named on screen. The degraded treatment becomes an estimated-odds cue. "Producer, generation time and game patch beside any figure they influenced" now means one click away in the sync report (N-8).
- **FR-11**: re-check the global banner against the per-row ≈. The "per-row badge" is now the ≈ cue. "Freshness gets the visual weight" now refers to the price-trust verdict (N-4).
- **FR-12**: the 48-hour *(PRD-owned)* cut-off moves to UX (3 days, 250). The collapsed-row stale mark carries its words in a tooltip, not inline. A crafted row's freshness becomes a share-of-EV judgement (245). "never-synced renders as *never attempted*" becomes a pending verdict (N-1).
- **FR-13**: the requirement holds. Only its placement, which is UX's, moves to the footer. No edit, unless the "only mitigation" clause is read as needing at-rest visibility (N-19).
- **FR-18**: "the view shows it unconditionally" now means inside the sync report, one click down. Confirm or restate.
- **FR-24 / FR-25**: "the view surfaces their existence" / "surfaces the starvation record's presence alongside the tracked-list age and the unresolvable count". These depend on N-2. The tracked-list age is no longer at rest.
- **NFR-7**: no edit (bundled font is static delivery, 242).
- **NFR-10**: wording holds. The cues change: shape for price trust, a glyph for estimated odds, text for Raw Base. Note 242's `[OPEN]`.
- **§3 Glossary / Conventions** (PRD L31, L71): "a synonym introduced anywhere is a discipline violation". This needs scoping so that on-screen copy is UX-owned (250). Otherwise `Best combinations`, `Count outcomes worth ≥`, `Recipe` and `div` violate it.
- **FR-4**: the reason strings are *(PRD-owned)* verbatim. Under 250 they could move to UX. Decide whether they do.
