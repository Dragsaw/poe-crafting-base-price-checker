# Review: impeccable critique of `mockups/key-redesign-dark.html` (v9)

Method: dual-agent (A: design review · B: detector + browser evidence), synthesized in a parent context.

- Date: 2026-10-04
- Surface: `mockups/key-redesign-dark.html` (v9, the approved dark redesign).
- Judged against: `DESIGN.md` rev 17 ("Rarity Dark"). Intent was read from `EXPERIENCE.md` and `.memlog.md` rows 239–270. `PRODUCT.md` at the root was not used, because it predates the redesign.
- Not reviewed: `key-hero-resting.html` and `key-expanded-states.html`, which are superseded.
- Browser: agent-browser with named sessions, opened from a file:// URL at viewport widths 1000 and 1168. Both sessions were closed.
- Mode: Operate. Reader: one player, on a 1080×1920 portrait second monitor beside the running game. He glances at the page at an angle, with the pointer still in the game.
- Scope: report only. No owner document or mockup was edited.

## Filter applied

- **Accessibility Floor** (`EXPERIENCE.md` § Accessibility Floor; `AGENT-WORKFLOW.md` § Review brief, rule 1). The floor rules out:
  - keyboard paths and focus styling
  - screen-reader and ARIA behaviour
  - WCAG targets
  - reduced-motion handling

  These floor items stay in scope:
  - the 4.5:1 contrast floor on the ground, the surface and the raised surface
  - the non-colour cue for every distinction
  - rendered text instead of raw ids
- **Ownership** (Review brief, rule 2). UX owns `DESIGN.md`, `EXPERIENCE.md` and the mockups. Each fix below names the owner document that should change, and nothing here is a change to that document. No fix asks the PRD for mechanism.

### Dropped findings

| # | Finding | Source | Why dropped |
|---|---|---|---|
| D1 | No keyboard shortcuts and no keyboard path for the primary actions. This was the Alex persona finding and lowered heuristic 7. | A | The Accessibility Floor rules it out: "no keyboard path is provided" (`EXPERIENCE.md` § Accessibility Floor). Under the Review brief, rule 1, it is conformant. |

One finding was dropped by the floor. Separately, the detector findings below were rejected as false positives. That rejection is a judgement on the detector's rules, and the floor does not apply to it.

## Design Health Score

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 3 | The sync age and the problem count work, but legal ages overflow the header (F1). Bows #2 shows no mark although its top line is 550 div on one listing (F4). |
| 2 | Match system / real world | 3 | The game vocabulary and the rarity pair are strong. The EV column holds two meanings: a Raw Base's asking price and a crafted class's net EV per craft. |
| 3 | User control and freedom | 3 | Every action reverses: the toggle, `− show fewer`, the threshold. Closing many open panels takes one click on each row. |
| 4 | Consistency and standards | 3 | The four-look vocabulary holds. The mockup drifts on name weight, tooltip alignment, mono use, short forms and copy (F3, F6, F7, F9, F10). |
| 5 | Error prevention | 3 | The input clamps and the page is read-only. The slider cannot be aimed at 1.6px per step (F8). |
| 6 | Recognition rather than recall | 3 | The marks are decoded only in the footer and in a hover tooltip. ≈ and ◐ share one amber and differ by glyph and side. |
| 7 | Flexibility and efficiency | 3 | The threshold can be typed or dragged, and many panels can be open at once. Keyboard work is not counted (dropped D1). |
| 8 | Aesthetic and minimalist design | 3 | Quiet and disciplined, but bold white tier tokens are the loudest text in the right half of every row (F3). |
| 9 | Error recovery | 3 | Plain-word reasons, the ✕ count and a problems-first report. The report specimen breaks spec (F6). |
| 10 | Help and documentation | 3 | The EV tooltip and the footer legend are enough for one player. The legend sits at the foot, far from the rows. |
| **Total** | | **30/40** | **Good** |

## Design Specificity Verdict

**LLM assessment.** The colour and the vocabulary are written for this product. The structure is generic.

- **Specific to this product:**
  - the game's rarity pair as identity
  - PoE frame bronze as the one control colour
  - the tier-versus-mod styling that echoes the in-game mod line
  - `Sell as is · item level 82+`
  - a title that is the question the page answers
- **Generic:** the skeleton is a standard dark data table with a sticky header, a segmented control, a slider and list rows. Strip the hue and a generic dark table remains.

That is right for an Operate surface. But almost all the identity lives in hue and copy, so drift in either costs more here than usual.

**Deterministic scan.** `impeccable detect --json` exited 2 with 38 findings. The in-page overlay (`detect.js`, injected under file://) reported 23. Almost all are false positives against this spec:

| Rule | Count | Verdict |
|---|---|---|
| `cramped-padding` | 27 | FP. The hairline rows of fixed 38px and 32px height are the design. |
| `gpt-thin-border-wide-shadow` | 4 | FP. Exactly the shadows of `ev-tooltip` and `mark-tooltip`. |
| `design-system-radius` (`.slider` 2px) | 1 | FP. In `threshold-control.slider`, but absent from the `rounded` scale. A token-table gap. |
| `design-system-color` | 3 | FP. Two colours of the specimen annotation, plus the tooltip shadow. |
| `design-system-font-size` (`.chev` 10px) | 1 | FP. `sync-button.openSign` specifies 10px. |
| `overused-font` (Inter) | 1 | FP. Inter is the decided stack (memlog 242). |
| `em-dash-overuse` | 1 | Partly true. Some are the spec's `—` for a missing figure. The rest are prose dashes in annotations and the footer. Minor copy. |
| overlay `text-overflow` / `text-occlusion` | 18 | FP. Chase cells ellipsise by spec, and the forced-open Rings specimen tooltip covers text by design. The truncation counts back F2. |

The detector caught nothing the design review missed. The browser measurements did: the role line-heights in F10 and the glyph fallback in F5.

**Conformance that holds.** These were measured at 1000 and 1168. B checked these values against the DESIGN.md tokens:
- the header: 64px, sticky, 936px of a 952px budget with the sample copy
- row 38, expansion line 32, column header 30
- grid 32/220/96/1fr, gap 14, mark slot 18, chase gap 18
- line grid 1fr/90/270/24
- panel padding 6 0 14 46
- radius 0 on rows and panels, 6/4 on controls
- shadows on the two tooltips only
- every text colour matches its token
- no horizontal overflow
- no ellipsis inside an expansion line
- the widest trust reason is 244px of 270

**Contrast floor.** Holds. The lowest pair is text-tertiary on the surface at 4.61:1, then text-tertiary on the ground at 5.05. No tooltip uses text-tertiary or magic-dim.

**Non-colour cue (NFR-10).** Holds for every distinction:
- trust by glyph shape
- estimated odds by ≈
- crafted versus Raw Base by `Sell as is`
- rank emphasis by weight
- negative EV by U+2212
- the below-threshold line by the words `below threshold`
- the open row by its bar

## Overall Impression

This is a calm, disciplined page that sits well beside a dark game. In the left 350px, a player can read rank, name and EV from across the desk. The weak half is the right side.

- At the 1000px target width, the chase cells cut the second affix on most rows.
- The brightest text there is the least informative token (`T1`/`T1–T2`).

The single biggest opportunity is to make *Best combinations* readable at the real width. The chase column is what the player picks up items by.

## What's Working

1. **The silence-first trust grammar.**
   - Each row has one reserved 18px slot.
   - ≈ sits before the figure and ◐ ○ ✕ after it.
   - Expansion lines spell out glyph, word and reason.
   - No badges, no chips, no green tick.

   Most rows are quiet, so a marked row is findable at an angle.
2. **Rarity identity with a text backup.** Blue for a crafted class and grey for a Raw Base read as the game reads, and `Sell as is · item level 82+` carries the distinction without colour. Bronze stays clearly apart from both rarities and from the attention colours.
3. **A disciplined header and disclosure in place.**
   - One 64px bar within budget (with the sample copy).
   - The problem count *replaces* the age instead of being added to it.
   - The sync report and the expansions push the page down instead of floating over it.

## Priority Issues

Each finding passes both Review-brief rules: the floor does not exclude it, and the fix goes to the UX owner.

### F1 · P1 · The header width budget breaks with legal sync ages

- **What:** memlog 270 measured the header only with `Synced 1 min ago`. The legal age forms (EXPERIENCE Voice and Tone, *Ages*: `N min ago`, `N hours ago`, `N days ago`) measured at 1000px:
  - `Synced 23 hours ago` needs **955.6px against 952px**. The header's scrollWidth is 956, so it overflows.
  - `Synced 12 days ago` leaves 1.6px.
  - A Craft Cost of `12.50 div / craft` adds 8.5px.
  - `✕ 126 problems` (928px) and `Not synced yet` (920px) fit.
- **Where:** `header .sync` and `.sub`. DESIGN Layout & Spacing, *The header's width budget*. `components.header-bar` ("nothing wraps or shrinks").
- **Why it matters at a glance:** the header is the only region pinned to the screen, and its controls are what the player reads mid-session. On any day the sync is hours old, the bar breaks at the target width of about 1015px. Either the age gets cut, or the bar scrolls sideways under the list.
- **Fix (owner: DESIGN.md, then the mockup):**
  - Restate the budget against the widest legal strings (`Synced 23 hours ago`, `99.99 div / craft`), not the sample copy.
  - Recover about 20px: group gap 22→18px (saves 12px) and slider 100→90px. Or ask EXPERIENCE to shorten the age form.
- **Brief check:** in scope; fix in a UX-owned document.

### F2 · P1 · Chase cells cut the distinguishing affix on most rows at the target width

- **What:** each chase cell is 175px wide at 1000px. 13 of 20 filled cells ellipsise at 1000px, and 2 of 20 at 1168px. Even that count flatters the design. The mockup varies short forms by hand to fit, which breaks EXPERIENCE Domain Vocabulary rule 4, "written once, never varied per row":
  - `Proj` beside `Proj Skills`
  - `Minion` beside `Minion Skills`
  - `Phys` beside `% Phys`
- **Where:** `.row .chase span`. `components.chase-cell`. DESIGN Layout & Spacing, *Measure at build* (the character budget of a chase cell).
- **Why it matters at a glance:** the ellipsis lands on the second affix, which is what tells the combinations apart. Bows reads `T1-T2 % Phys · T1-T2 Proj …` in its first cell. The column the player picks up items by turns into "open the row to find out".
- **Fix (owner: DESIGN.md / EXPERIENCE.md):**
  - Re-render the mockup with canonical short forms only, so the real budget shows.
  - Then rule on one of two options:
    - (a) Two chase cells of about 280px each at `content-min`.
    - (b) Win characters by quieting tier styling (F3) and tightening `chase-gap`.

  The spec already allows ellipsis, so this is a budget decision, not a defect in conformance.
- **Brief check:** in scope.

### F3 · P2 · Tier tokens invert the hierarchy and weaken the below-threshold dimming

- **What:**
  - In chase cells, `.t` is `{colors.text}` at 600. That is brighter and heavier than the `{colors.rarity-magic-dim}` mod text it qualifies, and almost every cell starts with T1 or T1–T2.
  - On `.line.below`, the mods dim to tertiary, but the tiers stay `{colors.text}` at 600. In the screenshot the below-threshold line reads nearly as loud as a priced line.
- **Where:** `.t` and `.line.below`. DESIGN Typography, *The tier stands out from the mod*, against `components.expansion-line.belowThreshold` ("combination in text-tertiary"). The two rules contradict each other.
- **Why it matters at a glance:** the eye lands first on the least informative token in every row. A dimmed line that does not look dimmed defeats "dim, not hidden".
- **Fix (owner: DESIGN.md):**
  - State that a below-threshold line takes its tiers to `{colors.text-tertiary}` as well (4.61 on the surface, which clears the floor).
  - Consider `{colors.text-secondary}` at 600 for tiers in chase cells (5.6 on the ground). The tier stays distinct by weight and stops outshining the mod.
- **Brief check:** in scope. A fix by weight and tone keeps the non-colour cue, because the words `below threshold` stay.

### F4 · P2 · The approved picture shows a silent top row resting on a one-listing price

- **What:** Bows (#2) has no mark in its slot. Its expansion opens on `550.00 ◐ rough · only 1 listing`, a line that very likely carries most of the row's EV. Memlog 266 records that the row was left unmarked only because the mockup does not compute the share. The picture still teaches the reverse of EXPERIENCE state 17: a silent row can rest on one listing.
- **Where:** row 2, `.mk` (empty), and the first `.line` of the panel. EXPERIENCE Epistemics, *Price trust*, state 17. DESIGN `trust-mark`.
- **Why it matters at a glance:** "silence means healthy" is the page's central promise. The approved reference shows silence that a click then contradicts. A build that copies the picture has nothing to catch it.
- **Fix (owner: mockup):** mark Bows ◐ with a tooltip `rough · N% of this EV rests on unreliable prices`. If that is not wanted, annotate the row as "share not computed in the mockup". Separately, EXPERIENCE could decide whether one unreliable line above a share threshold should mark the row on its own (see Questions).
- **Brief check:** in scope (a correct rendering of the trust state).

### F5 · P2 · The mark glyphs are not Inter: the trust marks fall back to OS fonts

- **What:** the mockup loads Google-Fonts Inter in the latin and latin-ext subsets. ≈ ◐ ○ ✕ ▾ ↗ ■ ≥ are in neither subset, so the OS falls back to another face for them. In the render:
  - ≈ and ▾ look visibly small.
  - ◐ and ○ come from different faces at different stroke weights.

  The two assessments disagreed on ◐, ✕ and ↗. B's unicode-range evidence is stronger than A's canvas-width test, so B's result is used here.
- **Where:** `.mk`, `.trust .g`, `.est`, `.chev`, the footer swatches. DESIGN Typography, *Glyph residency*.
- **Why it matters at a glance:** the glyph shape *is* the non-colour cue. A 13px ◐ that drifts in weight and size against ○ is harder to tell apart at an angle, and the metrics change per OS.
- **Fix (owner: build check that DESIGN already mandates; mockup optional):** at build, confirm that each of ≈ ◐ ○ ✕ ▾ ↗ ■ ≥ is resident in the bundled Inter at every weight it renders at. If not, subset them in, and report it as DESIGN instructs. Note that `≥` (in `Worth ≥`) is missing from DESIGN's glyph list; add it.
- **Brief check:** in scope; the floor binds the glyph cue.

### F6 · P2 · The sync report specimen breaks the verbatim register, state 9 and the copy deck

- **What:**
  - Entry names in the Problems column (`Bows · T1 % Phys · T1 Bow Atk Spd`, `Gold Amulet`) are set in `.mono`. These are page-written short forms, so this is "mono spread to text the page wrote".
  - `.mono` sets its own size and colour (12px, `--text`). The register takes the size and colour of its line.
  - `.report p` is 13px/1.4. The spec is 13.5/1.2.
  - The starved-pin line names `Gold Amulet`. EXPERIENCE state 9 says "the starvation problem names no entries".
  - `12 entries not reached this pass` should read `entries not reached in the last sync pass` (EXPERIENCE Domain Vocabulary, fixed wordings).
  - At 1000px, figures break mid-token in 208px columns: `2026-` / `10-04` and `poe-mod-` / `weights-producer`.
- **Where:** `.report`, `.mono`. DESIGN Typography, *The verbatim register*; `components.sync-report-panel`. EXPERIENCE state 9 and the fixed wordings.
- **Why it matters at a glance:** memlog 269 approved this panel "as drawn". A build will copy its copy and its mono unless someone records that 269 approved the layout, not the words. A date split over two lines is misread when skimmed.
- **Fix (owner: mockup and DESIGN.md):**
  - Use the plain register for entry names.
  - Put no entry names on the starvation line.
  - Use the deck wording.
  - `white-space: nowrap` on figures and dates in the report.
  - Add a line to DESIGN noting that memlog 269 covers the layout only.
- **Brief check:** in scope.

### F7 · P2 · The EV tooltip prose is right-aligned

- **What:** `.tip` inherits `text-align: right` from `.cols .ev-h`, so all three paragraphs are ragged on the left in the hover capture.
- **Where:** `.tip`. `components.ev-tooltip`, which names no alignment.
- **Why it matters:** this tooltip is the one place where every mark is decoded next to the figures. Right-aligned prose is slow to read, and a build that matches the picture will copy it.
- **Fix (owner: DESIGN.md token, then the mockup):** add `textAlign: left` to `components.ev-tooltip`, and fix `.tip`.
- **Brief check:** in scope.

### F8 · P2 · The threshold slider cannot be aimed

- **What:** the range is 0 to 3 at step 0.05 (EXPERIENCE Interaction 1, linear), which is 61 values on a 100px track, about 1.6px per step.
  - The cold start of 0.25 sits 8px from the left end.
  - The useful band, 0 to 0.5, takes about 17px.
  - The thumb is 12px wide, so it is wider than seven steps.
- **Where:** `.slider`. DESIGN `threshold-control.slider` (100px, memlog 270). EXPERIENCE Interaction 1.
- **Why it matters:** UJ-2, the threshold turn, is the product's core mechanism, and a sweep that jumps 0.05 per pixel and a half cannot be read as it moves. F1 also wants the track shorter.
- **Fix (owner: EXPERIENCE.md, which needs a ruling):** either a non-linear scale with finer steps below 0.5, or a narrower slider range (for example 0 to 1) with the typed figure reaching up to 3.
- **Brief check:** in scope.

### F9 · P2 · Copy and character drift from EXPERIENCE

- **What:**
  - **Context line.** The mockup reads `some roll odds are estimated: … Prices are real listings.`; the deck reads `Some roll odds are estimated: … All prices below are real listings.`
  - **Footer item 4.** The mockup reads `price older than 3 days or under 3 listings (a row: 70%+ of its EV)`; the deck reads `unreliable price (a row: 70%+ of its EV)`. "Older than 3 days" also contradicts the rule "3 days old or older" (Epistemics, *Price trust*).
  - **Tier mixtures.** The mockup uses a hyphen in `T1-T2`; rule 5 requires an en dash, `T1–T2`.
  - **Font features.** `font-feature-settings: "tnum" 1, "cv11" 1` sits on `body`. DESIGN asks for tabular figures in aligned columns, and does not mention `cv11`. In the 2× crop, hyphens look widened (`Read - only`, `2026 - 10 - 03`), and that costs chase-cell characters. Medium confidence.
- **Where:** `.panel .ctx`, footer item 4, every `.t`, `body`. EXPERIENCE Copy deck and Domain Vocabulary rule 5. DESIGN Typography.
- **Why it matters:** the footer states a rule that differs from the rule the page applies. A player who learns "older than 3 days" sees a 3-day-old price marked rough.
- **Fix (owner: mockup):** match the deck, use the en dash, and scope `tnum` to figure cells only. Drop `cv11` or record it in DESIGN.
- **Brief check:** in scope.

### F10 · P3 · Type metrics differ from the tokens

- **What:**
  - `.top .name` is 650; the spec is 600 (`ranked-row.nameTopFive`).
  - Google serves Inter only at 400/500/600/700, so 650 renders as **700** for both top-five names and top-five EVs.
  - Every role whose token says line height 1.2 renders at 1.4, inherited from `body { font: 14px/1.4 }`. These are label, control, control-figure, row-name, row-figure, chase, line-text, trust and mark.
- **Where:** `.top .name, .top .ev`, `body`. DESIGN Typography: *Every role declares a `lineHeight`* and the weights in use.
- **Why it matters:** the approved look is heavier and looser than the spec, and implementers match the picture. Row heights are fixed, so the visible effect is mostly in the header boxes and the report panel.
- **Fix (owner: mockup):** names at 600, load variable Inter so 650 is real, and declare each role's line height.
- **Brief check:** in scope.

### F11 · P3 · The problem-state specimen is drawn in its hover look

- **What:** `✕ 3 problems ▾` and `◐ 1 problem ▾` are drawn with a `line-strong` border, which is the hover/open look. At rest the border is transparent (`sync-button.border`).
- **Where:** the first row of the *State examples* box. `components.sync-button`.
- **Why it matters:** a build that copies the specimen ships a permanently outlined button. That also blurs the click-to-open vocabulary (memlog 248).
- **Fix (owner: mockup):** draw the specimen at rest, or label it as hovered.
- **Brief check:** in scope.

### F12 · P3 · Pending is almost the colour of secondary text

- **What:** `trust-pending` #9898A0 is nearly the same as `text-secondary` #9A9A9A. At an angle, the `— ○` of a pending row reads as quiet text. The ○ shape still carries the state, so NFR-10 holds.
- **Where:** `colors.trust-pending`. The Stellar Amulet specimen.
- **Why it matters:** none for the floor. It may be intended, since a pending price is not a problem. If it is, it should be a recorded decision rather than a coincidence.
- **Fix (owner: DESIGN.md):** record "pending stays quiet on purpose" against memlog 263, or lift its saturation slightly.
- **Brief check:** in scope as a glanceability note. It does not ask for a contrast target, because the pair already clears 4.5:1.

## Persona Red Flags

**Alex (power user).** Keyboard findings were dropped under the floor.
- The chase cells are cut, so comparing rows means opening each one (F2).
- The slider cannot be aimed (F8).
- Recipes cannot be compared side by side; the toggle shows one at a time.
- An EV cannot be understood without opening its row.

**The mid-session glancer** (project persona: pointer in the game, reading at an angle from across the desk).
- ◐ is 13px in an 18px slot beside 15px figures, and is drawn by a fallback face (F5). At an angle it blurs toward a dot, and a grey ○ nearly vanishes (F12).
- The bold white tier tokens are the loudest text right of the EV column (F3).
- The problem alarm is a 12px label in the far top-right corner. While a problem holds, the age disappears, at exactly the moment freshness matters.
- Every reason needs a hover, which pulls the pointer out of the game. This is deliberate (memlog 247), so the glyph alone has to carry the verdict, which is why F5 matters.
- The left 350px (rank, name, EV) reads well at an angle.

## Minor Observations

- The mockup does not draw the trade link's `:hover`, the pointer cursor on `.more`, or hover on an inactive segment. The spec defines all three.
- `Emerald` is singular and in magic blue. Every other Item Class label is plural (`Bows`, `Amulets`), so it reads like a Base Type. Check it against EXPERIENCE's Item Class label rule.
- Rows 8 and 9 show a chase combination beside a negative EV. That is legal, but at a glance it reads as a contradiction.
- The specimen annotation colours (#7F95B3 text, #3E4F66 dashed border) sit near magic blue. Fine as annotation, but a screenshot reader could take them for product colours.
- The combination cell of an expansion line has no `white-space: nowrap`. "One line, never cut" holds only because today's data is short.
- These fit with 0px to spare: `Body Armours (Str/Dex/Int)` at weight 700 in the 220px name column, and the longest old-and-thin reason in the 270px trust cell.
- At 1000px the footer wraps to three lines.
- The `rounded` scale lacks the slider's 2px (a token-table gap the detector flagged).

## Questions for the UX owner

1. **Chase column at the target width (F2):** what should the chase column show at the target width?
   - (a) Two readable combinations at about 280px each.
   - (b) Three cut ones, as now.
   - (c) Three, with tiers quieted and a tighter gap to win characters.
2. **One thin line driving a row (F4):** should one unreliable line that carries most of a top-five row's EV mark the row?
   - (a) Keep the 70%-of-EV rule and fix only the mockup.
   - (b) Add "any single unreliable line at X% or more".
   - (c) Leave the row silent and rely on the expansion.
3. **Header budget (F1):** where should the roughly 20px come from?
   - (a) Narrower group gaps and a narrower slider.
   - (b) A shorter age form in EXPERIENCE.
   - (c) Hide the Craft Cost from the bar.
4. **Loud when wrong:** is a 12px count in the far corner loud enough?
   - (a) Yes, as ruled in memlog 254 and 270.
   - (b) Weight it up in its own colour.
   - (c) Let the count take the slider's space while a problem holds.

## Run notes

- Target slug: `2026-09-13-mockups-key-redesign-dark-html-2ebe7022`. First run for this target, so there is no trend yet.
- Ignore list: `.impeccable/critique/ignore.md` is absent.
- Assessment independence: A and B ran as two isolated sub-agents, and A ran with no access to detector output. Each used its own named agent-browser session (`poe-crit-a-…`, `poe-crit-b-…`), and both sessions were closed.
- CLI detector: ran, exit 2, 38 findings.
- Overlay: injected under file://, and the console reported 23 findings. The live server on port 8400 was stopped, and the port was confirmed free.
- Temp files: in the session scratchpad only.
