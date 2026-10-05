# Validation Report — poe-crafting-base-price-checker
- **DESIGN.md:** `docs/ux-designs/ux-poe-crafting-base-price-checker-2026-09-13/DESIGN.md` (rev 17)
- **EXPERIENCE.md:** `docs/ux-designs/ux-poe-crafting-base-price-checker-2026-09-13/EXPERIENCE.md` (rev 22)
- **Run at:** 2026-10-04T20:13:51Z

## Overall verdict

The pair is a usable contract. The token sheet is complete, all 528 DESIGN references resolve, and the measured contrast table is correct. Every memlog decision from 239 to 270 is reflected, and no retired element survives as a live rule. A consumer can extract from it cleanly in most places. Before story-dev starts, fix a small set of load-bearing gaps. The committed deploy state (no recipe published) has no header or list treatment. The copy deck is missing strings that the "a string not written here does not ship" rule makes mandatory. Copy placeholders use the token-reference brace syntax. Several facts are written in both spines, and some of those copies already disagree.

The three extra reviewers shift the picture in two ways. First, duplication is the largest defect class, not a medium one: the structure lens finds most components specified twice inside DESIGN.md, behaviour restated three to five times inside EXPERIENCE.md, and a fifth cross-spine contradiction (the pruned-line price cell), so Bloat and Inheritance read thin and about 19% of the words could go — but only after an owner settles the contradictions, or condensing will pick a side silently. Second, the impeccable critique scores the v9 mockup 30/40 and confirms the tokens render as specified (contrast floor and non-colour cue hold), yet finds two width budgets the spines do not catch: the pinned header overflows at 1000px with a legal age (`Synced 23 hours ago`, 955.6 of 952px), and chase cells cut the distinguishing affix on 13 of 20 cells. The approved picture also teaches things the spec forbids (a silent row on a one-listing price, the sync-report specimen text, right-aligned tooltip prose). After de-duplication: 0 critical, 12 high, 45 medium, 21 low. Nothing challenges the design direction; the high items should close before story-dev extracts from the spines.

## Category verdicts

- Flow coverage — adequate
- Token completeness — strong
- Component coverage — adequate
- State coverage — thin
- Visual reference coverage — adequate
- Bloat & overspecification — thin (rubric walker: adequate; thin after the structure lens's findings merged)
- Inheritance discipline — thin (rubric walker: adequate; thin after the structure lens's findings merged)
- Shape fit — adequate
- Memlog reflection — strong

## Findings by severity

### Critical (0)

### High (12)

**[State coverage · Rubric §4]** — The committed deploy state (no recipe published) has no header or list treatment (§ EXPERIENCE.md 234–235, 422, 838–845; state 37)
The committed deploy publishes `recipes.json` with no recipe in it, yet the recipe toggle is specified as "two segments". No state says what the toggle, the Craft Cost slot, the EV tooltip's craft-cost clause and the crafted rows show with zero recipes or with one. The same gap holds when `recipes.json` is absent, and when the persisted active recipe (reload rule) is no longer published.
Fix: Add a numbered state covering zero recipes, one recipe and a stale persisted recipe: toggle look, Craft Cost text, crafted-row outcome. Give each new string to the copy deck.

**[State coverage · Rubric §4]** — The copy deck lacks strings the spines make mandatory (§ EXPERIENCE.md 130–131, 409–413; DESIGN.md 226–229, 353, 377, 981, 1023)
"A string not written here does not ship", yet these are neither in the deck nor on the drafted-at-build list: both failure-screen eyebrows and the refusal title; the refusal's fixed "renders again as soon as a valid set exists" sentence (state 26); the appendix lead; the appendix notes of states 14, 15, 15a and 16 (prose, not verbatim); and the four sync-report column headings and figure-group labels.
Fix: Write each string into the deck, or name each one on the drafted-at-build list.

**[Bloat & overspecification · Rubric §6 + Structure S2 (high) + Structure S19 (low)]** — DESIGN.md states behaviour, data rules and copy that EXPERIENCE.md owns (§ DESIGN.md 347–348, 705–708, 843–848, 877–881, 962–966, 986–988, 1004–1007, 1019–1022, 1074)
When ↗ renders (stored `lastSearchId` plus active-league test) appears four times across the spines; the recipe-word derivation and its invalid-set refusal, the ≈ per-pair silent swap, the skeleton's paint and single transition, the failure-screen variants, what raises the list statement, the problem-count colour rule and the sync-report FR mapping are all in both files, and the failure-screen variant copies already differ. DESIGN also prints copy EXPERIENCE owns (`no figure yet`, `< 0.01`, `+ Try again`, `+ N pruned`) against its own last Do row.
Fix: Keep the look in DESIGN and the behaviour and copy in EXPERIENCE (memlog 250/251). Replace each DESIGN duplicate with a citation ("Renders when: EXPERIENCE.md, Interaction 6") and refer to strings by role name. Structure lens estimates about 400 words saved.

**[Bloat & overspecification · Rubric §6 (low) + Structure S1 (high)]** — DESIGN.md specifies almost every component twice: YAML, then prose (§ DESIGN.md frontmatter `components:` 174–381 vs `## Components` 671–1023)
The prose restates YAML values nearly word for word ("padded 14px 16px 12px, capped at 400px", "330px wide", "a 100px track … 4px tall"); e.g. threshold-control 194–204 vs 719–734, ranked-row 255–277 vs 814–848. The pressed-row rule appears five times. Each value has two places to drift.
Fix: Make the YAML normative and cut each prose H3 to the non-obvious why, cited by memlog id (keep "tone alone cannot mark the open row", "a zero would look free", the ↗ restraint). Optionally promote repeated literals (90px price cell, 24px link cell, 22px header gap) to `spacing` tokens. About 1,400 words (47% of Components prose).

**[Bloat & overspecification · Rubric §6 (low) + Structure S5 (high)]** — EXPERIENCE.md spells the same behaviours out in 3 to 5 places; Component Patterns cells run to 150–250 words (§ EXPERIENCE.md 419–439, 457–500, 649–659, 688–732, 740–800)
The problem count replacing the sync age appears six times in EXPERIENCE and four in DESIGN; the recipe switch three times; opening the sync report four times; top 8 lines / `+ N more` five times. The `sync-report-panel`, `ranked-row` and `expansion-panel` cells exceed 150 words, which makes extraction hard.
Fix: Give each rule kind one home: Interaction Primitives owns acts, State Patterns owns treatments, Epistemics owns trust and problem rules. Turn Component Patterns into an index of one-line rules citing `Interaction n` / `state n`. Delete *Sync health — quiet, one click down*. About 900 words.

**[Inheritance discipline · Rubric §7 item 2 + Structure S4 (high)]** — Sync-report grouping and the cross-file diagnosis contradict across spines; the headings exist only in DESIGN (§ DESIGN.md 222–229, 771–777; EXPERIENCE.md 425, 675–676, 718)
DESIGN has four columns headed problems / sync run / weights cover / built from, and files the cross-file diagnosis under *problems*. EXPERIENCE groups *the sync run* / *what is broken* / *what the weights cover*, files the diagnosis under *what is broken*, and says it "is not a counted problem". The headings are on-screen strings written only in the look spine.
Fix: Owner decides where the diagnosis sits. Then move the four headings into the EXPERIENCE copy deck; DESIGN keeps the four-column geometry and cites the group order.

**[Impeccable · Impeccable F1 (P1)]** — F1 · The header width budget breaks with legal sync ages (§ `header .sync`, `.sub`; DESIGN Layout & Spacing (header width budget); `components.header-bar`)
Memlog 270 measured the header only with `Synced 1 min ago`. At 1000px, `Synced 23 hours ago` needs 955.6px against 952px (scrollWidth 956, so it overflows); `Synced 12 days ago` leaves 1.6px; a `12.50 div / craft` Craft Cost adds 8.5px. The header is the only pinned region, so on any day the sync is hours old the bar either cuts the age or scrolls sideways under the list.
Fix: Restate the budget in DESIGN.md against the widest legal strings (`Synced 23 hours ago`, `99.99 div / craft`). Recover about 20px: group gap 22→18px and slider 100→90px, or ask EXPERIENCE for a shorter age form. Then update the mockup.

**[Impeccable · Impeccable F2 (P1)]** — F2 · Chase cells cut the distinguishing affix on most rows at the target width (§ `.row .chase span`; `components.chase-cell`; DESIGN *Measure at build*)
Each chase cell is 175px at 1000px: 13 of 20 filled cells ellipsise (2 of 20 at 1168px), and even that flatters the design, because the mockup varies short forms by hand to fit (`Proj` beside `Proj Skills`, `Phys` beside `% Phys`), breaking Domain Vocabulary rule 4. The ellipsis lands on the second affix — the one that tells combinations apart — so the column the player picks items by becomes "open the row to find out".
Fix: Re-render with canonical short forms only so the real budget shows, then rule: (a) two chase cells of about 280px each, or (b) win characters by quieting tier styling (F3) and tightening `chase-gap`. The spec allows ellipsis, so this is a budget decision, not a conformance defect.

**[Structure lens · Structure S3]** — S3 · The pruned-line price cell contradicts across spines (§ DESIGN.md 331, 929; EXPERIENCE.md 636–637, 699 (state 10))
DESIGN says the price slot holds "a phrase in text-tertiary"; EXPERIENCE says the price is `—` with `† pruned` beside it. A live contradiction the duplication caused.
Fix: QUESTION: which is correct? Keep one statement in EXPERIENCE (content); DESIGN says only the tone.

**[Prose lens · Prose P1]** — P1 · A 70-word sentence carries the crafted/Raw Base distinction (§ EXPERIENCE.md 109–117)
"A row states which it is twice: by the game's own rarity colour on its name — … — and, for the non-colour read, by the text a Raw Base row prints …" Two colons and a dash pair in one sentence.
Fix: Split into three: the two ways; the rarity colours; the `Sell as is · item level 82+` text for a reader who cannot see colour.

**[Prose lens · Prose P2]** — P2 · State 23's "or ✕ broken" attaches to the wrong clause (§ EXPERIENCE.md 714)
"Every row reads ○ pending — after a pure reset …; after a mixed reset … — or ✕ broken for a broken entry …" The alternative sits so far from "○ pending" that it reads as part of the aside.
Fix: "Every row reads ○ pending, or ✕ broken for a broken entry, and every EV cell reads `—` (memlog 257)." Then two sentences for the pure and mixed reset reasons.

**[Prose lens · Prose P3]** — P3 · Footer item `No mark price is current` is a garden path in shipped copy (§ EXPERIENCE.md 404, 454)
Every other legend item is separated by its glyph; this one has none, so it fails the document's own colour-removed test (882–883).
Fix: Consider `No mark · price is current`; owner decides.

### Medium (45)

**[Flow coverage · Rubric §1]** — UJ-3, UJ-4 and UJ-5 have no failure path (§ EXPERIENCE.md Key Flows 1001–1086)
Each has one that applies. UJ-3: the drilled row is a pending or broken crafted row (states 18, 41), so there is no figure to argue for. UJ-4: the stale-patch problem cannot fire (NOTE FOR ARCHITECT under *Loud when wrong*), so the trust check rests on the player's own patch knowledge. UJ-5: `sync-report.json` is absent (state 38), or no starvation record matches the current curation, so the alarm the flow depends on does not raise.
Fix: Add one `Failure path:` line to each flow, citing the existing state numbers.

**[Flow coverage · Rubric §1]** — UJ-2 and UJ-4 run ahead of the PRD without saying so (§ EXPERIENCE.md 938; prd.md 63, 65)
The flow intro claims the PRD's "journey names and substance". PRD UJ-2 says "a number input, not a slider" (the spine drags a slider, memlog 255); PRD UJ-4 flags the whole ranking as resting on the uniform prior (that banner is retired, memlog 256); PRD UJ-1 has the player close the view, the spine's climax is "he closes nothing". The PRD handover covers FR-6 and FR-11, but the flows do not say they lead the PRD.
Fix: Tag UJ-2 and UJ-4 with e.g. `[ahead of PRD — memlog 255; handovers/prd-handover-2026-10-04.md FR-6]` and drop "and substance" from the intro.

**[Token completeness · Rubric §2 (low) + Impeccable F5 (P2)]** — Glyph residency list is incomplete, and the mockup's mark glyphs fall back to OS fonts (§ DESIGN.md 550 (glyph residency); EXPERIENCE.md 895–896; mockup `.mk`, `.trust .g`, `.est`, `.chev`)
Rubric: the residency list omits load-bearing glyphs `—`, `≥` (`Worth ≥`, memlog 270) and `–` (`T1–T2`), and EXPERIENCE keeps a third, shorter list. Impeccable: the mockup loads Inter latin + latin-ext only, so ≈ ◐ ○ ✕ ▾ ↗ ■ ≥ render from OS fallback faces; ≈ and ▾ look small, and ◐ and ○ come from different faces at different stroke weights. The glyph shape *is* the non-colour cue, so drift at 13px costs the glance read.
Fix: Keep one complete list in DESIGN.md (add `—`, `≥`, `–`) and cite it from EXPERIENCE.md. At build, confirm each glyph is resident in the bundled Inter at every rendered weight, subsetting in if not, as DESIGN already instructs.

**[Component coverage · Rubric §3 + Structure S15]** — `list-statement` has no EXPERIENCE Component Patterns row, and the self-check claims full coverage (§ DESIGN.md 369–372, 1001–1009; EXPERIENCE.md 93, 419–439, 1120–1125)
It has a DESIGN token and prose section. EXPERIENCE names it only as plain text in IA, and its behaviour is spread over states 23, 25 and 35: which statement wins when several apply, and whether it is static. The Coverage Self-Check's component list leaves it out, so its coverage claim is false.
Fix: Add a `{components.list-statement}` row: raised by states 23 / 25 / 35, one at a time, precedence order, not interactive, copy in the deck. Use the token in IA.

**[Component coverage · Rubric §3 (low) + Structure S8 (medium)]** — Interaction-vocabulary table is duplicated, and "four looks" lists five rows (§ DESIGN.md 673–687; EXPERIENCE.md 806–815)
The look/means/where tables are near-identical in both spines. Both are headed "four looks" and list five rows; only DESIGN explains the fifth ("plus the ranked row").
Fix: EXPERIENCE owns the meaning→where table; DESIGN keeps one line per look spec and cites it. Use DESIGN's "four looks, plus the ranked row" wording.

**[State coverage · Rubric §4]** — List-shape states 23 and 35 have no visual spec (§ EXPERIENCE.md 726; DESIGN.md `ranked-row`, `column-header`)
State 35 splits the list into two branches, each with its own top-five emphasis and list affordance; states 23 and 35 suppress rank numerals. DESIGN does not say how one branch ends and the next starts, or whether a suppressed rank column is blank-but-reserved or collapsed.
Fix: Add a branch-boundary treatment and a "suppressed rank" rule to `ranked-row` / `column-header`.

**[State coverage · Rubric §4]** — Sync button and panel are unspecified when `sync-report.json` is absent (§ EXPERIENCE.md state 38)
The spines do not say which of the three problems can still be counted (broken entries are in the Dataset, starvation records in the report), what the button reads, or what columns 1–3 show. Column 1's resting look when no problem holds is also unspecified.
Fix: Extend state 38 (or add a state) for the button and each panel column, including what the problems column shows when empty.

**[Visual reference coverage · Rubric §5, §9 + Impeccable F6 (P2) + Prose P16]** — Memlog 269 approves the sync-report panel "as drawn", and the drawn text breaks the spines (§ mockup 236–237; DESIGN.md 226, 786–787, 1008–1009; EXPERIENCE.md 199, 206–213, 669–672, 698, 1069–1070)
The mockup's problem lines name entries and Item Classes; UJ-5 step 4 and state 9 say the report names none (the starved-pin line names `Gold Amulet`). Those names are set in `.mono`, a register reserved for the fallback and the cross-file diagnosis, and `.mono` overrides the line's size and colour. It prints "entries not reached this pass" against the fixed "in the last sync pass", and a Weights File line without FR-10 field names and `|` separators. `.report p` is 13px/1.4 against spec 13.5/1.2, and at 1000px dates and ids break mid-token (`2026-` / `10-04`). Prose adds that "approved as drawn" records a review event, not a rule. A build that copies the approved drawing will break these rules.
Fix: Replace "approved as drawn" in both spines with a rule: memlog 269 approves the layout only, and the specimen text does not ship; list the non-shipping lines. In the mockup: plain register for entry names, no names on the starvation line, deck wording, `white-space: nowrap` on figures and dates.

**[Visual reference coverage · Rubric §5 (low) + Impeccable F9 (P2)]** — Mockup copy and characters drift from the copy deck (§ mockup footer item 4, `.panel .ctx`, every `.t`, `body`; EXPERIENCE.md 302, 404)
Footer rough item: mockup `price older than 3 days or under 3 listings`, deck `unreliable price (a row: 70%+ of its EV)`; "older than 3 days" also contradicts the "3 days old or older" rule, so the legend teaches a rule the page does not apply. Context line: mockup `Prices are real listings.`, deck `All prices below are real listings.` Tier mixtures use a hyphen (`T1-T2`) against the en-dash rule. `font-feature-settings: "tnum" 1, "cv11" 1` on `body` appears to widen hyphens and spend chase-cell characters (medium confidence); `cv11` is not in DESIGN.
Fix: Confirm the legend wording with the user and put these items on the spines-win list. In the mockup: match the deck, use the en dash, scope `tnum` to figure cells, drop `cv11` or record it in DESIGN.

**[Bloat & overspecification · Rubric §6 + Structure S13]** — Revision and review history sits in both bodies (§ EXPERIENCE.md 60, 179–181, 201, 235, 317, 425, 693, 738, 790–796, 898, 1129, 1140; DESIGN.md 573, 600)
`[decision — rev 17]`, `rev 18`/`rev 19`, `[decision — revision 9, 2026-09-27]`, "finding T4, closed", "(memlog 247, v7)", "1a stays 1a", "story 2.7 Decisions", "replaces the old 27-character figure", "The target screen is still". The project bans revision narrative, and `rev 17` does not resolve: EXPERIENCE is at revision 22, so it does not say whose revision 17.
Fix: Cite the memlog row or AD/FR id for each decision and delete the narrative; move findings T3/T4 to the memlog or reviews folder.

**[Inheritance discipline · Rubric §7 items 1, 3, 4 + Rubric §9 (low)]** — The spines contradict each other in three further places (§ DESIGN.md 600, 992–997, 1019–1020; EXPERIENCE.md 287–292, 404, 438–439)
(1) Chase-cell budget: DESIGN says the measurement "replaces the old 27-character figure"; EXPERIENCE says the 27-character figure stands until then — memlog 268(d) is reflected both ways. (2) Refusal variant: DESIGN defines it as "a published file the page cannot use"; EXPERIENCE adds "is required and not published". (3) Footer legend: DESIGN orders marks → pruned/pinned → sentence with ≈ unplaced and lets it wrap; EXPERIENCE puts ≈ after pruned/pinned and calls it "one line".
Fix: Make one owner per fact (see the Bloat findings) and align the other file to it.

**[Inheritance discipline · Rubric §7]** — Two frontmatter sources are dead, and the memlog is listed in only one spine (§ DESIGN.md 17–18; EXPERIENCE.md 12–13)
`docs/sprint-change-proposal-2026-09-13.md` and `-2026-09-19.md` were deleted in commit `55fe390`. DESIGN lists `.memlog.md rows 239-270`; EXPERIENCE cites the memlog throughout but does not list it.
Fix: Drop the dead paths or cite them by commit; list the memlog in both frontmatters in the same form.

**[Inheritance discipline · Rubric §7]** — Copy placeholders use the token-reference brace syntax (§ EXPERIENCE.md 387, 392, 396–400, 406, 424, 431, 721, 1126–1128)
`{activeLeague}`, `{age}`, `{threshold}`, `{craftCost}`, `{word}`, `{reason}` and `{name}` are the 7 of 172 brace references that do not resolve, while the Coverage Self-Check claims "`{…}` always means this resolves". State 23 uses a third style, `<league>`. A resolver or lint written against the spec fails on them.
Fix: Pick one non-brace placeholder syntax for copy (e.g. `‹age›` or `$age`) and correct the self-check claim.

**[Inheritance discipline · Rubric §7]** — EXPERIENCE contradicts itself on "worth" (§ EXPERIENCE.md 370–372, 396)
The rule says `worth` prints in two user-ruled strings only (title and threshold label); the EV tooltip prints "outcomes worth at least {threshold} div".
Fix: Add the tooltip to the rule's exceptions (memlog 270 makes it the explainer of `Worth ≥`), or reword the tooltip.

**[Shape fit · Rubric §8 + Structure S14]** — The *Coverage Self-Check* section addresses the reviewer, is wrong twice, and buries the open items (§ EXPERIENCE.md 1109–1143)
It is a validation-run log in the body; it omits `list-statement` and makes the false brace claim; it holds history ("1a stays 1a", "Closed against the architecture"). The one block a consumer needs, *Unresolved*, is at the end of the document.
Fix: Delete the log. Move *Unresolved* into Foundation after the tag legend as a tagged *Open items* list.

**[Impeccable · Impeccable F3 (P2)]** — F3 · Tier tokens invert the hierarchy and undo the below-threshold dimming (§ `.t`, `.line.below`; DESIGN Typography; `components.expansion-line.belowThreshold`)
`.t` is `{colors.text}` at 600, brighter and heavier than the `{colors.rarity-magic-dim}` mod it qualifies, and almost every cell starts with T1 or T1–T2: the eye lands first on the least informative token. On a below-threshold line the mods dim but the tiers stay bright, so the line reads nearly as loud as a priced one. DESIGN's "the tier stands out" and "combination in text-tertiary" contradict each other.
Fix: In DESIGN, take a below-threshold line's tiers to `{colors.text-tertiary}` (4.61 on surface). Consider `{colors.text-secondary}` at 600 for chase-cell tiers (5.6 on ground).

**[Impeccable · Impeccable F4 (P2)]** — F4 · The approved picture shows a silent top row resting on a one-listing price (§ row 2 `.mk`; EXPERIENCE Epistemics *Price trust*, state 17; `trust-mark`)
Bows (#2) has an empty mark slot, but its expansion opens on `550.00 ◐ rough · only 1 listing`, a line that very likely carries most of its EV. Memlog 266 says it was left unmarked only because the mockup does not compute the share. The picture teaches the reverse of state 17 — that a silent row can rest on one listing — and "silence means healthy" is the page's central promise.
Fix: Mark Bows ◐ (`rough · N% of this EV rests on unreliable prices`) or annotate it "share not computed in the mockup". Separately, EXPERIENCE could decide whether one dominant unreliable line marks the row on its own.

**[Impeccable · Impeccable F7 (P2)]** — F7 · The EV tooltip prose is right-aligned (§ `.tip`; `components.ev-tooltip`)
`.tip` inherits `text-align: right` from `.cols .ev-h`, so all three paragraphs are ragged-left. This is the one place every mark is decoded next to the figures, and a build that matches the picture will copy it.
Fix: Add `textAlign: left` to `components.ev-tooltip`, then fix `.tip`.

**[Impeccable · Impeccable F8 (P2)]** — F8 · The threshold slider cannot be aimed (§ `.slider`; DESIGN `threshold-control.slider`; EXPERIENCE Interaction 1)
0 to 3 at step 0.05 is 61 values on a 100px track, about 1.6px per step. The 0.25 cold start sits 8px from the left end, the useful 0–0.5 band takes about 17px, and the 12px thumb is wider than seven steps. UJ-2, the threshold turn, is the core mechanism, and a sweep jumping 0.05 per pixel and a half cannot be read as it moves.
Fix: EXPERIENCE rules: a non-linear scale with finer steps below 0.5, or a narrower slider range (e.g. 0–1) with the typed figure reaching 3.

**[Structure lens · Structure S6]** — S6 · State rows copy the *Price trust* reason strings and thresholds (§ EXPERIENCE.md 690–732 (states 1–7, 17, 18, 35, 40, 41) vs 524–595)
3 days, 1–2 listings, 70%, the zero-value fallback and uncostable precedence are repeated word for word, though the copy deck makes *Price trust* the owner of reasons.
Fix: CONDENSE each row to its treatment plus "reason: *Price trust* table". About 250 words.

**[Structure lens · Structure S7]** — S7 · Four copies of the glyph→colour→meaning mapping (§ DESIGN.md 278–286, 439–443, 855–860; EXPERIENCE.md 517–522)
EXPERIENCE's Colour column puts look in the behaviour spine; DESIGN's "Means" column puts meaning in the look spine.
Fix: MERGE: DESIGN keeps glyph + colour in one table; EXPERIENCE keeps state + word + meaning and drops its Colour column.

**[Structure lens · Structure S9]** — S9 · Look content in the behaviour spine (§ EXPERIENCE.md 62–64, 817–829, 915–916, 931–934)
The `primaryColor` repoint, line-height ramps, px font sizes, colour tokens in the hover table, the one dark theme and bundled Inter are all already in DESIGN.
Fix: MOVE or CUT to DESIGN; the hover table keeps cursor and interactivity facts only.

**[Structure lens · Structure S10]** — S10 · Frame and scroll geometry stated in both spines (§ EXPERIENCE.md 902–934 vs DESIGN.md 569–583)
Frame bounds, no breakpoints, sideways scroll, no fixed height and which box scrolls appear in both.
Fix: Frame and scroll geometry go in DESIGN; EXPERIENCE keeps "what grows the page" and the forbidden overflow escapes, and cites the frame.

**[Structure lens · Structure S11]** — S11 · Contrast floor and non-colour cue list appear 3 to 4 times (§ DESIGN.md 451–457, 470–495, 1038–1040; EXPERIENCE.md 109–117, 595, 874–892)
Duplication only; the Accessibility Floor ruling stands and no new accessibility work is asked for.
Fix: The rule and cue list stay in EXPERIENCE's Accessibility Floor; DESIGN keeps the measured table and cites it; cut the Do's restatement.

**[Structure lens · Structure S12]** — S12 · Architecture mechanism restated in EXPERIENCE (§ EXPERIENCE.md 33–39, 473–482, 627–629, 718, 1140–1143)
`pinnedCount` / `declaredMinChunkSearches` / `config.minChunkSearches`, AD-4 propagation, the five AD-17 checks by name, the FR-33/AD-25 argument. EXPERIENCE 47–48 itself says mechanism belongs to the spine and IMPLEMENTATION-NOTES.
Fix: CONDENSE each to a player-level statement plus a citation ("IMPLEMENTATION-NOTES §6", "AD-17").

**[Structure lens · Structure S16]** — S16 · The copy deck claims every fixed string, but strings live in five other places (§ EXPERIENCE.md 133–149, 176–177, 203–229, 358–368, 380–413)
The mapping table, attribution labels, appendix reasons, Voice Do table and *Price trust* reasons hold strings, and the mapping table re-prints deck strings (`Worth ≥`, `EV (Divine)`, `Sell as is…`, `N.NN div / craft`).
Fix: Move all fixed strings into the deck, or change its intro to a pointer list; the mapping table cites the deck.

**[Structure lens · Structure S17]** — S17 · Domain Vocabulary is one 2,281-word H2 mixing eight topics (§ EXPERIENCE.md 125–342)
Glossary mapping, header strings, labels, attribution, money, Craft Cost, combination writing, hybrids and truncation share one heading. Its "What may be cut" duplicates DESIGN's (620–627).
Fix: Add H3s (Mapping · Header and labels · Sync report labels · Money · Combinations and short forms · Hybrids); merge the two "What may be cut" blocks into one owner.

**[Prose lens · Prose P4]** — P4 · Missing noun in the expansion-line mark spec (§ DESIGN.md 868–870)
"the glyph centred in a 12px box, 6px, the word …"; the YAML (284) says gap.
Fix: "… a 12px box, a 6px gap, then the word in the mark's colour".

**[Prose lens · Prose P5]** — P5 · A 45-word subject before its verb (§ EXPERIENCE.md 41–48)
"Every on-screen string — labels, state words, … — and the fixed values … are written here once."
Fix: "This document writes each on-screen string once: … It also writes each fixed value the page prints or judges by: …"

**[Prose lens · Prose P6]** — P6 · "He" for the player is not stated as a choice (§ DESIGN.md 387; EXPERIENCE.md 31, 154, 279, 670, 762–763, 842–843, Key Flows)
Microsoft style asks for gender-neutral wording.
Fix: Use "the player" or singular "they", or state once in Foundation that "he" is deliberate for the one known user.

**[Prose lens · Prose P7]** — P7 · Colour nicknames appear before their tokens (§ DESIGN.md 395–397, 413, 445, 1047–1048; EXPERIENCE.md 508, 603, 955, 1062)
"bronze", "amber", "red", "blue… grey" are used untied to `{colors.*}`.
Fix: Tie each nickname to its token at first use ("one bronze, `{colors.accent}`").

**[Prose lens · Prose P8]** — P8 · Two or three names for one concept (§ EXPERIENCE.md 110, 222, 435, 437, 729, 768, 1074, 1080; DESIGN.md 776, 783)
"tombstone band" / "pruned lines"; "raw row" / "Raw Base row"; "tolerable file" / "tolerable artifact".
Fix: One term each: "pruned line", "Raw Base row", "tolerable file".

**[Prose lens · Prose P9]** — P9 · "Untracked" collides with the Tracked List (§ DESIGN.md 251, 805)
"sentence case and untracked" reads as a data state.
Fix: "sentence case with no letter-spacing".

**[Prose lens · Prose P10]** — P10 · "Clock" is undefined and used in two senses (§ EXPERIENCE.md 215, 351, 554, 699, 1020)
"The edit date says which clock it came from" … "Ages … name their clock".
Fix: Define it once at 351: the event an age counts from.

**[Prose lens · Prose P11]** — P11 · "Register, not audience" licence is compressed jargon (§ EXPERIENCE.md 187–188, 211–212, 670)
"the licence is one of register, not of audience".
Fix: "They are allowed there because the diagnosis quotes a file, not because someone else reads it."

**[Prose lens · Prose P12]** — P12 · The 70% rough rule is one 150-word bullet (§ EXPERIENCE.md 571–585)
Trigger, basis, exclusion, reason string, zero-value fallback and a NOTE FOR ARCHITECT in one breath — the densest rule in the spec.
Fix: Sub-bullets: Trigger · Measured on · Reason · When gross value is zero; NOTE as its own paragraph.

**[Prose lens · Prose P13]** — P13 · "Every probability of that pair is estimated" may conflict in meaning (§ EXPERIENCE.md 601–603 vs 365, 396, 619–621)
On screen the page says "Some roll odds are estimated". Possibly a meaning conflict, not only wording.
Fix: Check against AD-10; consider "the roll odds of that pair are estimates (AD-10)".

**[Prose lens · Prose P14]** — P14 · The reload test is hard to parse and carries decision narrative (§ EXPERIENCE.md 838–845)
"The test is deliberate setting against reading position: … The recipe passes it as the threshold does"; also "decided rather than left to silence".
Fix: "The test: a value the player deliberately sets persists, and a value that records how far he had read does not. The recipe is a deliberate setting, like the threshold."

**[Prose lens · Prose P15]** — P15 · Common tags are missing from the tag legend; citation forms vary (§ EXPERIENCE.md 81–83, 109, 119, 288, 327, 727, 897, 938, 1056)
`[decision — …]`, `[change — …]`, `[OVERRIDE — …]` are used but undefined; "memlog 22/25"; "PRD memlog 151" does not say whose memlog.
Fix: Add the tags to the legend; one citation form ("memlog 22, 25"); name the memlog owner.

**[Prose lens · Prose P17]** — P17 · Verbless YAML-style fragments in prose (§ DESIGN.md 731–734, 893, 1015–1018)
"An eyebrow in `{typography.eyebrow}`, uppercase, …" / "A 100px track (memlog 270), 4px tall, … Cursor grab …"
Fix: Write sentences ("Its eyebrow is … The track is 100px wide …"); goes away if the YAML/prose duplication is condensed.

**[Prose lens · Prose P18]** — P18 · The Craft Cost rationale argues the opposite (§ DESIGN.md 712–713)
"`core` subtracts it once per Item Class (AD-17), so it is a fact about the recipe and not about a row" — the "so" does not follow.
Fix: "It prints only here. It is a property of the recipe, not of a row: `core` subtracts the same figure from every crafted EV (AD-17)."

**[Prose lens · Prose P19]** — P19 · "A findable link invites the habit SM-1 measures the absence of" (§ DESIGN.md 969–970)
Stacked postpositions; "findable" says the opposite of the intent.
Fix: "A prominent link would invite the habit whose absence SM-1 measures."

**[Prose lens · Prose P20]** — P20 · A 35-word parenthetical mid-list (§ EXPERIENCE.md 923–927)
"a long appendix (FR-30's world, memlog 203 — every Item Class Unrankable until …)"; "FR-30's world" is unclear.
Fix: Pull the FR-30 case (memlog 203) into its own sentences after the list.

**[Prose lens · Prose P21]** — P21 · Appendix title capitalises a Glossary term on screen (§ EXPERIENCE.md 405, 728)
`Appendix: Unrankable — N Item Classes` breaks the rule that Glossary capitals are prose vocabulary and the screen uses sentence case.
Fix: Consider `Appendix: Unrankable — N item classes`; owner decides.

**[Prose lens · Prose P22]** — P22 · EV tooltip ¶3 switches separators mid-list (§ EXPERIENCE.md 396)
`… · ○ no price yet. ✕ broken. Hover a mark for the reason.` — `·` becomes a full stop in shipped copy.
Fix: `… · ○ no price yet · ✕ broken. Hover a mark for the reason.`

### Low (21)

**[Token completeness · Rubric §2]** — `{typography.tier}` breaks two typography rules (§ DESIGN.md 118–122, 555–558, 1070)
It declares no `lineHeight` and sets `fontSize: 0.9em`, against "every role declares a `lineHeight`" and "pass font sizes as literal px".
Fix: Exempt inline roles by name ("`tier` inherits the line height of its line"), or give `tier` px sizes per host role.

**[Token completeness · Rubric §2]** — `accent-soft` is rgba where the spec says hex (§ DESIGN.md 45; design-md-spec.md)
Every other colour token is hex.
Fix: Document it as a deviation, or add the pre-blended hex for each ground.

**[State coverage · Rubric §4]** — Three small edges are unstated (§ EXPERIENCE.md states 33, 39; Interaction 1)
Whether the list affordance is absent when 20 or fewer units rank; what an open panel shows when every line is pruned; what a non-numeric threshold entry does on blur (only clamp is covered).
Fix: Add one clause each to states 33, 39 and Interaction 1.

**[Visual reference coverage · Rubric §5]** — The spines-win rule is worded differently in each spine (§ DESIGN.md 566–567; EXPERIENCE.md 74)
"This spine wins" against "Both spines win".
Fix: Use one sentence in both files.

**[Inheritance discipline · Rubric §7 + Structure S22]** — `Synced {age} ago` renders "Synced 1 min ago ago" (§ EXPERIENCE.md 147, 354–356, 392, 424, 721)
The Ages rule makes an age read `N min ago`; the template appends another "ago". L147 writes the same string as `Synced N ago ▾`, a second placeholder scheme.
Fix: Define the age placeholder as the bare quantity (`1 min`) or write `Synced ‹age›`; define one placeholder convention once in the deck.

**[Shape fit · Rubric §8]** — The copy deck is a sub-section although it is the single source of every string (§ EXPERIENCE.md 380)
`### Copy deck` sits under Voice and Tone.
Fix: Promote it to its own `##` section so extraction can address it directly.

**[Memlog reflection · Rubric §9]** — Memlog 271's open wording choice is carried as final (§ EXPERIENCE.md 397)
Memlog 271 records the EV tooltip ¶1 ending at `{threshold} div.` as a wording choice for the user to confirm; the deck carries it untagged.
Fix: Tag it `[ASSUMPTION — memlog 271]` until the user confirms.

**[Impeccable · Impeccable F10 (P3)]** — F10 · Rendered type metrics differ from the tokens (§ `.top .name`, `.top .ev`, `body`)
Top-five names are 650 (spec 600), and Google serves Inter only at 400/500/600/700, so they render at 700. Every role whose token says line height 1.2 renders at 1.4, inherited from `body { font: 14px/1.4 }`. The approved look is heavier and looser than the spec, and implementers match the picture.
Fix: In the mockup: names at 600, load variable Inter, declare each role's line height.

**[Impeccable · Impeccable F11 (P3)]** — F11 · The problem-state specimen is drawn in its hover look (§ *State examples* box; `components.sync-button`)
`✕ 3 problems ▾` and `◐ 1 problem ▾` carry a `line-strong` border, the hover/open look; at rest the border is transparent. A copied specimen ships a permanently outlined button and blurs the click-to-open vocabulary (memlog 248).
Fix: Draw the specimen at rest, or label it as hovered.

**[Impeccable · Impeccable F12 (P3)]** — F12 · Pending is almost the colour of secondary text (§ `colors.trust-pending`)
`#9898A0` against `text-secondary` `#9A9A9A`: at an angle a pending row's `— ○` reads as quiet text. The ○ shape still carries the state, so NFR-10 holds; it may be intended, but it should be a recorded decision rather than a coincidence.
Fix: Record "pending stays quiet on purpose" against memlog 263, or lift its saturation slightly.

**[Structure lens · Structure S18]** — S18 · Do's and Don'ts lead paragraphs restate principles (§ DESIGN.md 1027–1040)
"Silence means healthy", "Loud when wrong" and "Colour is never alone" are restated before the table; "Loud when wrong" is owned by EXPERIENCE.
Fix: Cut the three paragraphs and cite Epistemics; keep the Do/Don't table.

**[Structure lens · Structure S20]** — S20 · Three copies of the build-measurement checklist (§ DESIGN.md 599–607; EXPERIENCE.md 287–292, 1138–1139)
In DESIGN it is a run of verbless fragments.
Fix: One bulleted checklist in DESIGN; EXPERIENCE cites it.

**[Structure lens · Structure S21]** — S21 · DESIGN.md has no H1 and no orientation (§ DESIGN.md 25–27, 384, 409–414)
It does not say the YAML is normative and the prose explains, or that EXPERIENCE owns behaviour and strings; EXPERIENCE has a `peer-contract`. The substrate statement is repeated.
Fix: Add a two-sentence preamble or a `peer-contract` key; drop the YAML substrate comment.

**[Prose lens · Prose P23]** — P23 · "Re-rounds what it passes on" is unclear (§ EXPERIENCE.md 248–249)
"`core` persists 4dp and the page never re-rounds what it passes on."
Fix: "`core` stores figures at 4dp. The page rounds each figure once, for display."

**[Prose lens · Prose P24]** — P24 · "Validates" implies a page check (§ EXPERIENCE.md 255–257)
"It validates every crafted EV on the page …"; tone is DESIGN's to own.
Fix: "The player checks every crafted EV against it, so it is set no quieter than secondary text."

**[Prose lens · Prose P25]** — P25 · Wordplay; "broken" collides with the ✕ state word (§ EXPERIENCE.md 716, 762–763, 953–954)
"not saying nothing at all"; "the figures merely tie, broken by AD-17's declared tiebreak".
Fix: "the button says that nothing is wrong; it is not silent" / "AD-17's declared tiebreak orders them".

**[Prose lens · Prose P26]** — P26 · "The footer follows the content" can read as "obeys" (§ DESIGN.md 576, 998; EXPERIENCE.md 377, 438, 918)
Ambiguous verb.
Fix: "The footer sits after the content, at the end of the page."

**[Prose lens · Prose P27]** — P27 · Subjectless fragment invites filling the gap (§ EXPERIENCE.md 904)
"Unusual, and stated explicitly so nobody adds what is missing."
Fix: "These platform rules are unusual. They are stated so that nobody adds what is deliberately absent."

**[Prose lens · Prose P28]** — P28 · Exception in a Don't cell; an id "matches" a league; revision residue "still" (§ DESIGN.md 573, 1057, 1066)
A Don't cell holding its exception reads as forbidden.
Fix: Move the exception to the Do column; "where the stored search ran in the active league"; drop "still".

**[Prose lens · Prose P29]** — P29 · Inconsistent unit and approximation formats (§ EXPERIENCE.md 59, 247, 528, 690, 747, 752, 906, 982; DESIGN.md 573, 834)
"~150ms", "~15-hour", "2dp" / "two decimals" / "2 decimal places", "1080x1920" vs "1080×1920".
Fix: "about 150 ms", "two decimal places", "1080×1920" in both files.

**[Prose lens · Prose P30]** — P30 · Serial comma used inconsistently (§ Both files, e.g. DESIGN.md 404 vs 1013; EXPERIENCE.md 496–500)
British spelling and a mostly omitted serial comma look deliberate, but the comma is sometimes used.
Fix: Keep the British house voice if deliberate, but make the serial comma consistent.

## Reviewer files

- `docs/ux-designs/ux-poe-crafting-base-price-checker-2026-09-13/reviews/review-rubric.md`
- `docs/ux-designs/ux-poe-crafting-base-price-checker-2026-09-13/reviews/review-impeccable.md`
- `docs/ux-designs/ux-poe-crafting-base-price-checker-2026-09-13/reviews/review-structure-prose.md`
- `docs/ux-designs/ux-poe-crafting-base-price-checker-2026-09-13/reviews/validation-report.html` (HTML twin)
