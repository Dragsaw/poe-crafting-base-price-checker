---
target: key-filter-modal.html
total_score: 30
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:E:\\Program Files\\Jetbrains\\Projects\\poe-crafting-base-price-checker\\docs\\ux-designs\\ux-poe-crafting-base-price-checker-2026-09-13\\.working\\key-filter-modal.html"
target_fingerprint: "sha256:aef23add81063c9438744d13b70fe2233269c8008743f3b5deadde7c169e8fed"
target_path: "E:\\Program Files\\Jetbrains\\Projects\\poe-crafting-base-price-checker\\docs\\ux-designs\\ux-poe-crafting-base-price-checker-2026-09-13\\.working\\key-filter-modal.html"
timestamp: 2026-11-01T12-18-42Z
slug: 2026-09-13-working-key-filter-modal-html-3ddd7dba
---
# Impeccable critique — Pick-up Filter modal

Method: dual-agent (A: design review sub-agent · B: detector + browser sub-agent)

- Target: `.working/key-filter-modal.html` (filter button, modal, states 44–46). The dashed State examples box and its captions are annotation and are not judged as product UI.
- Context: `--target DESIGN.md` of this workspace, plus `EXPERIENCE.md`. Where the mock and a spine disagree, the spine wins: a mock deviation is a **mock fix**, and a weakness in a spine is a **spine finding**.
- Excluded by EXPERIENCE.md *Accessibility Floor*: keyboard paths, focus styling, ARIA, reduced motion, WCAG level. The 4.5:1 text floor binds and is measured below.
- Rendered with agent-browser at 1440 and 390 px. All servers and tabs are closed. No spine or mock file was edited.

## Design Health Score

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of System Status | 2 | The modal does not restate the threshold and orbs it bakes in, and the overlay scrims the header to about 2:1. After a download the modal closes with no confirmation (Interaction 9). |
| 2 | Match System / Real World | 4 | NeverSink, FilterBlade, the real folder and "reload the filter" are the player's own words. |
| 3 | User Control and Freedom | 3 | Esc, an overlay click and × all close it, and a valid name persists. The × target is 11×16 px. |
| 4 | Consistency and Standards | 4 | The filter button reuses the sync-button look. Copy and Download reuse the show-more look. |
| 5 | Error Prevention | 2 | The placeholder is the same string as a real value. The name rules miss `crafting-bases` without `.filter`. The folder path is wrong for OneDrive Documents. |
| 6 | Recognition Rather Than Recall | 3 | The steps carry the whole procedure. What the file will hold is not shown. |
| 7 | Flexibility and Efficiency | 2 | A returning visit reads four steps to reach one action. |
| 8 | Aesthetic and Minimalist Design | 3 | Calm and on-system. Copy and Download differ only by weight. |
| 9 | Error Recovery | 3 | The state 45 strings are plain and actionable. A wrong save location fails silently, outside the page. |
| 10 | Help and Documentation | 4 | The modal is its own instructions. |
| **Total** | | **30/40** | **Good** |

## Design Specificity Verdict

**LLM assessment.** The design is specific to this product, not generic:

- It uses only Rarity Dark tokens and adds no button chrome. Download is accent text because an accent fill means "a setting".
- The path is set in mono because the player pastes it.
- The copy follows the Copy Deck word for word, including the state 46 line with `<recipe>` replaced by "greater".
- Every value in the `filter-modal` YAML is honoured: 480 px, 16 px padding, tooltip radius and shadow, 70 % ground overlay, title role, close colour, mono path with Copy 10 px after it, surface-raised field, and a note-size error with the ✕ mark.

The one category habit is the structure: a four-step setup guide shown in full at every visit. The spine chose this (Interaction 9: "Every step shows at every visit").

**Deterministic scan.** The CLI scan exits 2 with 18 findings.

- One finding is real: **low-contrast**, `.field.empty`, #8A8A8E on #2C2C31 at 4.0:1. The design review found the same failure independently.
- The other 17 are noise for this target:
  - 10 cramped-padding: the ranked rows behind the overlay. Rows separated by a rule are the designed pattern.
  - overused-font Inter: DESIGN.md pins Inter, so this is a false positive.
  - design-system-color on `#3E4F66` and `#7F95B3`: the annotation box.
  - design-system-color on `rgba(0,0,0,.5)`: the spec's own tooltip shadow.
  - 2px radius: the slider track, out of scope.
  - 10 px font size: the sync chevron, out of scope.
  - 16 px font size: the × glyph, see minor observations.

**Visual overlays.** The overlay was injected into the browser and its console reported `No anti-patterns found`. That contradicts the CLI result on the same file, including the confirmed 4.04:1 failure. Treat the overlay as unreliable here. No user-visible overlay remains open.

## Overall Impression

This is a faithful, quiet rendering of a well-specified modal. The mock has one real defect: the placeholder colour, which fails the contrast floor. The larger risks are in the spine:

- The placeholder reads as a filled value.
- The flow trusts a browser save dialog that Chrome and Edge do not show by default.
- The modal never says which dial values it is about to bake in.

The biggest opportunity is the end of the flow. It is the only write the product makes, and it closes in silence.

## What's Working

1. **Copy discipline.** Step 3 ("over the last one") and step 4 ("select … once. After each download, reload") carry the whole maintenance model in two sentences.
2. **Token fidelity.** The modal reads as a floating layer of the same system: tooltip shell, surface over a scrimmed ground. It does not look like a Mantine default dropped onto the page.
3. **State 45.** The error appears on blur and is set in the note role with a drawn ✕ and a broken-colour border. The download is disabled, not hidden.

## Priority Issues

**[P1] The empty-field placeholder fails the 4.5:1 floor.**
- *Where:* mock L136 (`.field.empty`); DESIGN `filter-modal.field`; DESIGN Colors, *Measured contrast*.
- *Why it matters:* text-tertiary on surface-raised measures 4.04:1. DESIGN states that "Neither colour goes on that step", but the field puts the surface-raised step under the placeholder, and the spec names no placeholder colour.
- *Fix (mock):* set the placeholder in `{colors.text-secondary}`, which measures 4.94 on surface-raised.
- *Fix (spine):* `filter-modal.field` names its placeholder colour as text-secondary. The *Measured contrast* prose lists the field as a surface-raised pairing.
- *Suggested command:* /impeccable polish

**[P1] The placeholder is a plausible real file name, so state 44 differs from a ready state by tone alone.**
- *Where:* Copy Deck *Pick-up Filter*, field placeholder; State Patterns row 44 ("Nothing else marks the field as required"); mock L219 against L243.
- *Why it matters:* for a 3-STRICT player the placeholder is exactly their file name. With the colour removed, an empty field and a disabled download read the same as a filled field and an enabled download. The player sees "their" name and a download that does nothing, with no reason given. This fails the Accessibility Floor test, "the page still reads with every colour removed". That test is written for NFR-10 distinctions, but here it decides whether the player can act at all.
- *Fix (spine):* in EXPERIENCE Copy Deck, make the placeholder read as an example, for example `e.g. NeverSink's filter 2 - 3-STRICT.filter`. Or, in row 44, give the disabled download a non-colour cue.
- *Fix (mock):* fill the main frame with a value that is not the placeholder string, so a reader of the mock can tell filled from empty.
- *Suggested command:* /impeccable clarify

**[P1] "The browser's own save is the feedback" assumes a save dialog that the default Chrome and Edge do not show.**
- *Where:* EXPERIENCE Interaction 9 (download action), UJ-7 steps 3–4, Copy Deck step 3.
- *Why it matters:* with "Ask where to save" off, which is the default, the file lands in Downloads. On a repeat download it becomes `crafting-bases (1).filter`. The modal closes and says nothing, and the game keeps loading the old file. The player believes the refresh worked when it did not, and finds out only when a base drops unmarked.
- *Fix (spine):* state the browser prerequisite once, in step 3, or after the download. Or keep the modal open after a download with one line on where the file must go. `showSaveFilePicker` would close the gap, but it touches AD-31, so it needs an architect decision.
- *Suggested command:* /impeccable harden

**[P2] The modal does not show what it will bake in.**
- *Where:* Copy Deck modal lead ("under your current threshold and orbs"); Interaction 9 (a dial moved after a download changes nothing).
- *Why it matters:* the values the lead refers to sit behind a scrim at about 1.7–2.3:1. The player cannot check "0.25 div, greater orbs" before saving.
- *Fix (spine):* put the live values into the lead in the Copy Deck, for example `Shows the bases worth picking up at 0.25 div with greater orbs.`
- *Suggested command:* /impeccable clarify

**[P2] The file-name rules miss self-import and OneDrive paths.**
- *Where:* State Patterns row 45; Copy Deck folder path.
- *Why it matters:* row 45 rejects the exact name `crafting-bases.filter`, and it also says the page adds `.filter` at generation. So the input `crafting-bases` passes validation and produces a self-import. Separately, under OneDrive Known Folder Move, PoE2 reads `%UserProfile%\OneDrive\Documents\…`. There the copied path leads confidently to the wrong folder.
- *Fix (spine):* in row 45, compare the name after `.filter` is added, and case-insensitively. In the Copy Deck, add a clause for OneDrive Documents to the folder line.
- *Suggested command:* /impeccable harden

## Contrast (the floor binds)

| Use (mock line) | Pair | Ratio | 4.5 floor |
|---|---|---|---|
| Modal title "Pick-up filter" (L119) | text-tertiary on surface | 4.61 | Pass, thin |
| Step numerals (L126) | text-tertiary on surface | 4.61 | Pass, thin |
| Disabled download, states 44–45 (L140) | text-tertiary on surface | 4.61 | Pass, thin |
| Empty-field placeholder, state 44 (L136) | text-tertiary on surface-raised | **4.04** | **Fail** |
| Body, lead, state line, × | text-secondary on surface | 5.63 | Pass |
| Copy, Download | accent on surface | 6.81 | Pass |
| Field error | trust-broken on surface | 5.64 | Pass |
| Typed field value | text on surface-raised | 9.84 | Pass |

The three text-tertiary uses on the surface match DESIGN's table, at 4.61, and hold the floor with 0.11 to spare. Any later move of the modal onto surface-raised would break all three.

## Persona Red Flags

**Alex (power user)**
- Every session, Alex reads past four steps to reach one link.
- Alex cannot confirm which threshold, which orbs or how many bases are in the file.
- A filter already in the game that is older than a dial change stays silent.

**Riley (stress tester)**
- Riley types `crafting-bases` without the extension, and the generated file imports itself.
- A trailing space, `.FILTER` or `..` is covered by no rule.
- A long name is cut with an ellipsis, so its end cannot be seen at rest.
- A fast double download produces `(1)` duplicates in Downloads.
- States 46 and 47 together are specified (47 replaces 46's line) but not drawn.

**The solo author-player before a session**
- Trust rests on "did the save land over the old file", and the modal closes in silence.
- OneDrive Documents is common on a Windows 11 gaming PC.
- The dials were set minutes ago and are hidden under the scrim.

## Minor Observations

- **Mock fix: modal body line height.** The mock sets 1.4 (L117). `filter-modal.body` names `typography.line-text`, which is 1.2, a one-line row role. The prose wraps and reads better at 1.4, so this is also a **spine finding**: give the modal's wrapping prose the `note` line height, 1.4, or its own role.
- **Spine finding: the field type role.** `filter-modal.field` says "the threshold-control figure box", which implies the figure text at 15 px/600. The mock uses 13.5 px/400. The spec should name the field's type role and its placeholder colour.
- **Spine finding: spacing values.** The step-control gap (8 px), the title margin (10 px) and the lead margin (12 px) are not in the spec. Adopt the mock's values.
- **Spine finding: the close ×.** It is a typed glyph, 16 px, with an 11×16 px pointer target. It is not in DESIGN's list of drawn marks or of Inter characters to verify, and `filter-modal.close` gives no size. Name a size, or Mantine's CloseButton.
- **Mock fix: second error string.** The state 45 error "That is this filter's own name…" has no specimen.
- **Mock fix: state 47.** It is not drawn. Draw it, because its precedence over 46 is the one rule-driven layout choice in step 3.
- **Mock fix, cosmetic: overlay scope.** The overlay sits in `.frame`, not on the viewport, so the modal centres on the short frame. Mantine fixes it to the viewport.

## Questions to Consider

1. If a dial moves after a download, should `Filter ▾` say so quietly, given that Interaction 9 deliberately stays silent?
2. Should a returning visit show step 3 first, with the setup steps one click down? Or is "every step at every visit" worth its cost to a player who opens the modal once per session?
3. Can the page keep the promise "the browser's own save is the feedback" when the default browser shows no dialog? Or should the modal stay open and say where the file must go?
