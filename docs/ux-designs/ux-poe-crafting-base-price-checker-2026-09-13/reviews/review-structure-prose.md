# Review: DESIGN.md + EXPERIENCE.md (structure, prose)

- **Reviewed:** `DESIGN.md` and `EXPERIENCE.md` in `docs/ux-designs/ux-poe-crafting-base-price-checker-2026-09-13/` (working-tree state, 2026-10-04, after the dark redesign; decisions in `.memlog.md` rows 239–270).
- **Skill:** bmad-review, lenses `structure` then `prose` (prose ran on top of structure's findings). Reader type: humans. Style guide: Microsoft Writing Style Guide.
- **Content class:** docs. Review only — no file was edited.
- **Severity:** the skill emits no severity; the high/medium/low tags were added by the reviewers on request, for counting only.
- **Triage note:** per AGENT-WORKFLOW.md *Review brief*, UX owns both documents; the Accessibility Floor is a ruling (structure #11 asks only for de-duplication, not new accessibility work).

| Lens | High | Medium | Low | Total |
|---|---|---|---|---|
| structure | 5 | 12 | 6 | 23 |
| prose | 3 | 19 | 8 | 30 |

**Overlap (signal, not deduped):** structure #13 and prose #14/#16/#28 all flag decision and revision narrative in the body; structure #2/#19 and prose #3/#21/#22/#24 both touch the DESIGN vs EXPERIENCE ownership split for strings and tone; structure #1 and prose #17 meet on the verbless Components prose.

## Lens: structure (Editorial Structure)

**Purpose read:** These two spines exist so that the people who build and review the page can look up exactly how it looks (DESIGN.md) and how it behaves and what it says (EXPERIENCE.md). Each fact should have one owner.

**Structure model:** Reference/Database. The rules are random access, MECE topics, and a consistent schema for each item. EXPERIENCE.md *Key Flows* is narrative by design, and was judged as Tutorial/Linear.

**Word counts (word_metrics.py):** DESIGN.md has 9,067 words. That includes about 2,244 in the YAML front matter and 2,984 in the prose under `## Components`. EXPERIENCE.md has 15,502 words: Domain Vocabulary 2,281, Component Patterns 1,985, State Patterns 2,562 and Interaction Primitives 1,313. The section counts are exact. The savings per finding are estimates.

| # | Sev | Pass | Location | Original Text | Revised Text | Changes |
|---|---|---|---|---|---|---|
| 1 | high | structure | DESIGN.md, front matter `components:` (L174–381) vs `## Components` H3s (L671–1023) | Almost every component is specified twice. The YAML gives its properties, then the prose restates them nearly word for word. Examples: threshold-control YAML L194–204 vs prose L719–734; ranked-row L255–277 vs L814–848; the expansion-line variants L326–331 vs the table L922–929; sync-button L205–215 vs L739–757. The pressed-row rule appears five times (L262, L491–494, L644, L820–821, and EXPERIENCE L831–834). | CONDENSE. Make the YAML the normative spec. Cut each prose H3 down to what the YAML cannot carry: the non-obvious *why*, cited by memlog id. Examples worth keeping: "tone alone cannot mark the open row", "a zero would look free", the ↗ restraint. | One source per property, and no silent drift between the token block and the prose. Saves about 1,400 words (about 47% of the Components prose). |
| 2 | high | structure | DESIGN.md: Trade link YAML L347–348 and prose L962–966; Recipe toggle L705–708 and YAML L191; Estimate mark L877–881; Skeleton L843–848; Failure screen L1019–1022; List statement L1004–1007; Unrankable appendix L986–988; Expansion line L919–920 and L931–933 | DESIGN states behaviour and data rules that EXPERIENCE owns, and EXPERIENCE states them again. Examples: when ↗ renders (a stored `lastSearchId` and an active-league test, which repeats EXPERIENCE L436 and L780–788); the grade-word derivation and its refusal (EXP L237–245); ≈ switching silently per (class, recipe) pair (EXP L608–615); what paints during the skeleton and the single transition (EXP L65, L713); the failure-screen variants and their causes (EXP L439); what raises the list statement; "an age prints only when there is a problem"; where pruned lines sit in the line order. | MOVE to EXPERIENCE. Where EXPERIENCE already holds the rule, CUT it from DESIGN. Leave one citation, for example "Renders when: EXPERIENCE.md, Interaction 6." Keep in DESIGN only how each case *looks*, such as the flat 10px bars or the absent (not greyed) link cell. | Applies the memlog 250/251 ownership split. Saves about 400 words. |
| 3 | high | structure | DESIGN.md Expansion line, YAML L331 and table L929, vs EXPERIENCE *Missing figures* L636–637 and state 10 L699 | The two duplicated copies of the pruned-line price cell already disagree. DESIGN says the price slot holds "a phrase in text-tertiary". EXPERIENCE says the price is `—`, with `† pruned` beside it. | QUESTION: which one is correct? Then keep a single statement in EXPERIENCE (the content), and have DESIGN say only the tone. | Fixes a live contradiction that the duplication caused. 0 words. |
| 4 | high | structure | DESIGN.md Sync report panel, YAML L222–229 and table L771–777, vs EXPERIENCE Component Patterns L425, *Two registers* L675, state 27 L718 | DESIGN puts "the cross-file diagnosis" in column 1, headed **problems**. EXPERIENCE says the diagnosis "is not a counted problem" and files it under *what is broken*. The group names also differ: DESIGN has problems / the sync run / what the weights cover / built from; EXPERIENCE has *the sync run* / *what is broken* / *what the weights cover* plus attribution lines. These headings are on-screen strings, and they are written only in DESIGN. | QUESTION: where does the diagnosis go? Then MOVE the four column headings into the EXPERIENCE copy deck. DESIGN keeps the 4-column geometry and cites the group order. | A contradiction, and on-screen copy in the look spine. About 0 to +20 words. |
| 5 | high | structure | EXPERIENCE.md, Component Patterns (L419–439), Interaction Primitives (L740–800), State Patterns (L688–732), Epistemics *Loud when wrong* / *Sync health* (L457–500, L649–659) | The same behaviours are spelled out in 3 to 5 places. The problem count that replaces the sync age appears at L393, L424, L463–467, L651–653, L722 and L1061–1063 in EXPERIENCE, and at L215, L441–443, L452–455 and L748–753 in DESIGN. The recipe switch (synchronous, not debounced, open panels stay open) appears at L422, L725 and L758–763. Opening the sync report (in place, scroll to the top, opens on the problem list) appears at L425, L651–659, L723 and L775–779. The top 8 lines / `+ N more` appears at L44–45, L433, L435, L730 and L797–800. Component Patterns cells run to 150–250 words each (L425, L428, L433). | CONDENSE. Give each kind of rule one home. Interaction Primitives owns what an act does. State Patterns owns each treatment. Epistemics owns the trust and problem rules. Component Patterns becomes a short index: Use, plus one-line rules that cite `Interaction n` and `state n`. Delete *Sync health — quiet, one click down* (L649–659), which is wholly covered elsewhere. | Removes about 4× repetition and its drift risk; makes Component Patterns scannable. Saves about 900 words. |
| 6 | medium | structure | EXPERIENCE.md State Patterns rows 1–7, 17, 18, 35, 40, 41 (L690–732) vs *Price trust* (L524–595) | The state rows copy the reason strings and threshold logic word for word (3 days, 1–2 listings, 70%, the zero-value fallback, uncostable precedence). The copy deck (L382–383) already makes *Price trust* the owner of reasons. | CONDENSE each row to its treatment, plus "reason: *Price trust* table". | One copy of each reason string. Saves about 250 words. |
| 7 | medium | structure | Glyph→colour→meaning mapping: DESIGN YAML L278–286, Colors table L439–443, Trust mark table L855–860; EXPERIENCE *Price trust* table, Colour column L517–522 | Four copies of the same mapping. The Colour column puts look content in EXPERIENCE, and the "Means" column in DESIGN puts meaning in the look spine. | MERGE. DESIGN keeps glyph + colour (one table). EXPERIENCE keeps state + word + meaning and drops its Colour column. | Saves about 120 words. |
| 8 | medium | structure | Interaction vocabulary: DESIGN L673–687 vs EXPERIENCE L806–815 | Near-identical look/means/where tables. Both are titled "four looks" but list five rows. Only DESIGN explains the fifth ("plus the ranked row"). | MERGE. EXPERIENCE owns the meaning→where table. DESIGN keeps one line per look spec and cites it. Fix the heading count or label the row as an extra. | Saves about 150 words; removes a miscount. |
| 9 | medium | structure | EXPERIENCE.md Foundation Mantine deltas rows L62–64; hover table L817–829; Responsive & Platform bullets L915–916, L931–934 | Look content in the behaviour spine: the `primaryColor` repoint, line-height ramps, px font sizes (all in DESIGN L412–414 and L555–558); colour tokens in the hover/persistent table; one dark theme (DESIGN L416–417); Inter bundled (DESIGN L499–500). | MOVE or CUT to DESIGN. The hover table keeps cursor and interactivity facts only. | Saves about 200 words. |
| 10 | medium | structure | EXPERIENCE Responsive & Platform (L902–934) vs DESIGN Layout & Spacing (L569–583) | Frame bounds, no breakpoints, sideways scroll, no fixed height and which box scrolls are stated in both. | MERGE. Frame and scroll geometry go in DESIGN. EXPERIENCE keeps "what grows the page" and the forbidden overflow escapes, and cites the frame. | Saves about 200 words. |
| 11 | medium | structure | Contrast floor: DESIGN L470–495 and L1038–1040; EXPERIENCE Accessibility Floor L874–880. NFR-10 cues: DESIGN L451–457 and L1038–1039; EXPERIENCE L109–117, L595, L881–892 | The 4.5:1 rule and the non-colour cue list appear 3 to 4 times. Duplication only; the Accessibility Floor ruling stands and no new accessibility work is asked for. | MERGE. The rule and the cue list stay in EXPERIENCE's Accessibility Floor. DESIGN keeps the measured table and cites the floor. CUT the Do's restatement. | Saves about 150 words. |
| 12 | medium | structure | EXPERIENCE *Loud when wrong* item 2 (L473–482); *Estimated odds* L627–629; state 27 L718; Foundation L33–39; Coverage L1140–1143 | Architecture mechanism restated: the `pinnedCount` / `declaredMinChunkSearches` / `config.minChunkSearches` match, AD-4 propagation, the five AD-17 checks by name, the FR-33/AD-25 runtime-call argument, the AD-17 cross product. EXPERIENCE L47–48 itself says that mechanism belongs to the spine and IMPLEMENTATION-NOTES. | CONDENSE each to a player-level statement plus a citation such as "IMPLEMENTATION-NOTES §6" or "AD-17". | Follows the one-owner rule. Saves about 250 words. |
| 13 | medium | structure | EXPERIENCE L790–796 (findings T3/T4), L693 "revision 9, 2026-09-27", L317 / L898 "rev 17", L425 "rev 18 / rev 19", L738 "which is why the recipe switch is 1a", L1129, L235 "story 2.7 Decisions", L201 "v7"; DESIGN L600 "replaces the old 27-character figure" | Review and revision history in the document body. | CUT the narrative. Move T3/T4 to the memlog or the reviews folder. Re-cite `rev n` tags by memlog id. | Follows the project rule against revision narrative. Saves about 150 words. |
| 14 | medium | structure | EXPERIENCE `## Coverage Self-Check` (L1109–1143) | A validation-run log ("Run against references/validate.md Pass 1", numbering not resequenced, tokens resolve) sits in the body. The one block a reader needs, *Unresolved*, is buried at the end. | CUT the log bullets and move them to reviews/memlog. MOVE *Unresolved* (L1130–1139) into Foundation, after the tag legend (L81–83), as an "Open items" list. | Front-loads the open questions. Saves about 200 words. |
| 15 | medium | structure | EXPERIENCE Component Patterns (L419–439); IA L93; Coverage L1120–1125 | `components.list-statement` exists in DESIGN (L369–372, L1001–1009), but EXPERIENCE has no Component Patterns row for it. IA names it without a token, and the self-check claims full component coverage. | Add a one-line `{components.list-statement}` row: raised by states 23, 25 and 35; copy in the deck. | The coverage claim is currently false. About +40 words. |
| 16 | medium | structure | EXPERIENCE *Copy deck* (L380–413) vs Domain Vocabulary mapping (L133–149), attribution labels (L203–229), appendix reasons (L176–177), Voice Do table (L358–368), *Price trust* reasons | The deck claims "every fixed string the page prints, by place", but strings live in at least five other places, and the mapping table re-prints deck strings (`Worth ≥`, `EV (Divine)`, `Sell as is…`, `N.NN div / craft`). | MERGE. Either move all fixed strings into the deck, or change its intro to a pointer list. The mapping table cites the deck instead of re-printing strings. | One lookup path for a string. Saves about 100 words. |
| 17 | medium | structure | EXPERIENCE `## Domain Vocabulary` (L125–342, 2,281 words) | One H2 mixes the glossary mapping, header strings, labels, attribution, money rules, Craft Cost, combination writing and coining, hybrids, and truncation. "What may be cut" (L333–342) is a layout/behaviour rule and duplicates DESIGN *What may be cut* (L620–627). | Add H3s: Mapping · Header and labels · Sync report labels · Money · Combinations and short forms · Hybrids. MERGE the two "What may be cut" blocks into one owner and cite it from the other. | Random-access navigation for the longest section. Saves about 120 words. |
| 18 | low | structure | DESIGN `## Do's and Don'ts` lead paragraphs (L1027–1040) vs Brand & Style L399–407, Colors L451–457, EXPERIENCE Epistemics L446–500 | "Silence means healthy", "Loud when wrong" and "Colour is never alone" are restated in prose before the table. "Loud when wrong" is a behaviour principle owned by EXPERIENCE. | CUT the three paragraphs and cite Epistemics. PRESERVE the Do/Don't table (L1042–1074). | Saves about 150 words. |
| 19 | low | structure | DESIGN: `no figure yet` (YAML L193, L714, L1060), `< 0.01` (L834), `+ Try again`, `+ N pruned` (L340, L682, L955, L1021) | On-screen strings written in the look spine, against its own last Do row (L1074). | CONDENSE to role names ("the uncostable phrase", "the retry action") and cite the copy deck. | Ownership hygiene. About 0 words. |
| 20 | low | structure | DESIGN `## Layout & Spacing` *Measure at build* (L599–607); EXPERIENCE L287–292 and L1138–1139 | Three copies of the build-measurement checklist. In DESIGN it is a run of verbless fragments. | CONDENSE to one bulleted checklist in DESIGN; EXPERIENCE cites it. | Saves about 60 words. |
| 21 | low | structure | DESIGN body start (L384) | No H1 and no orientation: it does not say the YAML is normative and the prose explains, or that EXPERIENCE owns behaviour and strings. EXPERIENCE has a `peer-contract` (L14–15). The front-matter comment L25–27 and Brand & Style L409–414 repeat the substrate statement. | Add a two-sentence preamble or a `peer-contract` key mirroring EXPERIENCE's. Drop the YAML substrate comment. | Mental model before details. About +30 words. |
| 22 | low | structure | EXPERIENCE L147 (`Synced N ago ▾`) vs L392 (`Synced {age} ago ▾`) vs Ages rule L354–356 (`N min ago`) | Two placeholder schemes for one string. If `{age}` is the full "N min ago", the deck renders "ago ago". | One placeholder convention, defined once in the copy deck. | About 0 words. |
| 23 | low | structure | EXPERIENCE `## Key Flows` (L936–1107); state 19 retired row (L710); DESIGN trade-link rationale (L968–971) | These look cuttable: the narrative restates rules, the row is retired, the rationale is long. | PRESERVE. The flows give human readers the purpose behind the rules. The retired row keeps the stable-id policy (L684–686). The ↗ rationale is a non-obvious why that guards against a likely "improvement". | Keep. |

**Summary**
- 23 recommendations: 22 that change the documents and 1 PRESERVE. By severity (as tagged in the rows): 5 high, 12 medium, 6 low.
- Estimated reduction if all accepted: about 4,700 of 24,569 words (about 19%). DESIGN about −2,100 (23%), mostly Components prose. EXPERIENCE about −2,600 (17%), mostly Component Patterns, State Patterns and the Self-Check.
- Findings 3 and 4 show the duplication has already caused contradictions (pruned price cell; where the cross-file diagnosis sits). An owner has to decide those before condensing.
- Trade-off: condensing Component Patterns into an index (finding 5) means more jumping; explicit `Interaction n` / `state n` citations offset it. Key Flows and the Do/Don't table stay.


## Lens: prose (Editorial Prose)

Runs on top of the structure lens's findings and does not repeat them.

**Purpose:** These two spines tell the people who build and review the page how it looks (DESIGN.md) and how it behaves and what it prints (EXPERIENCE.md).

**Voice to keep:** Short declaratives, lowercase state words, British spelling, mostly no serial comma, "the player" written as "he", and inline citations by memlog, FR or AD. These look intentional; rows 29 and 30 cover the places where the Microsoft style guide disagrees with them. Passages that the structure lens tagged CUT were skipped (DESIGN Do's lead paragraphs L1027–1040, EXPERIENCE *Sync health* L649–659, findings T3/T4 L790–796, self-check log L1111–1129 and L1140–1143). Most sentence fixes inside passages tagged CONDENSE go away if that condensing is accepted, so only survivors are flagged.

| # | Sev | Pass | Location | Original Text | Revised Text | Changes |
|---|---|---|---|---|---|---|
| 1 | high | prose | EXPERIENCE, Information Architecture, *One list, two ranked units* (L109–117) | "A row states which it is twice: by the game's own rarity colour on its name — `{colors.rarity-magic}` for a crafted Item Class, `{colors.rarity-normal}` for a Raw Base, as the trade site prints magic and normal items — and, for the non-colour read, by the text a Raw Base row prints where a crafted row prints its Best combinations: `Sell as is · item level 82+`" | "A row states which it is in two ways. Its name takes the game's rarity colour: `{colors.rarity-magic}` for a crafted Item Class and `{colors.rarity-normal}` for a Raw Base, as the trade site prints magic and normal items. For a reader who cannot see colour, a Raw Base row prints `Sell as is · item level 82+` where a crafted row prints its Best combinations." | Split one ~70-word sentence with two colons and a dash pair into three sentences. |
| 2 | high | prose | EXPERIENCE, State Patterns, row 23 (L714) | "Every row reads ○ pending — after a pure reset with `price from last league`; after a mixed reset some rows carry a new-league reason such as `no listings found` — or ✕ broken for a broken entry, and every EV cell reads `—` (memlog 257)." | "Every row reads ○ pending, or ✕ broken for a broken entry, and every EV cell reads `—` (memlog 257). After a pure reset the pending reason is `price from last league`. After a mixed reset some rows carry a new-league reason such as `no listings found`." | "or ✕ broken" sits so far from "○ pending" that a reader attaches it to the dash aside. |
| 3 | high | prose | EXPERIENCE copy deck, footer item 3 (L404); quoted at L454 | `No mark price is current` | Consider: `No mark · price is current`? | Fails the document's own colour-removed test (L882–883): reads as a garden path. Every other legend item is separated by its glyph; this one has none. |
| 4 | medium | prose | DESIGN, Trust mark, *On an expansion line* (L868–870) | "the glyph centred in a 12px box, 6px, the word in the mark's colour" | "the glyph centred in a 12px box, a 6px gap, then the word in the mark's colour" | Missing noun; the YAML (L284) says gap. |
| 5 | medium | prose | EXPERIENCE, Foundation (L41–48) | "Every on-screen string — labels, state words, reasons, tooltip text, footer text — and the fixed values the page prints or judges by (…) are written here once." | "This document writes each on-screen string once: labels, state words, reasons, tooltip text and footer text. It also writes each fixed value the page prints or judges by: …" | ~45-word subject before its verb. |
| 6 | medium | prose | Both files: DESIGN L387; EXPERIENCE L31, L154, L279, L670, L762–763, L842–843, Key Flows | "he reads it at an angle…", "what he was given", "he wrote the Tracked List" | Consider "the player" or singular "they". If "he" is deliberate for the one known user, state that once in EXPERIENCE Foundation. | Microsoft style asks for gender-neutral wording; make the choice explicit. |
| 7 | medium | prose | DESIGN L395–397, L413, L1047 ("bronze"); L445, EXPERIENCE L603 ("amber"); DESIGN L1048, EXPERIENCE L508, L1062 ("red"); EXPERIENCE L955 ("Blue… grey") | "one bronze, taken from the game's UI frame" … "One amber carries both ◐ and ≈" | "one bronze, `{colors.accent}`, …" … "One amber, `{colors.trust-rough}`, …" | Colour nicknames appear before their token; tie each to its token at first use. |
| 8 | medium | prose | EXPERIENCE L435, L768, L1074, L1080 vs DESIGN "pruned line"; EXPERIENCE L110 "raw row", L437 "raw branch"; DESIGN L776, L783 "absent tolerable file"; EXPERIENCE L222, L729 "tolerable artifact" | "tombstone band" / "pruned lines"; "raw row" / "Raw Base row"; "tolerable file" / "tolerable artifact" | One term each: "pruned line", "Raw Base row", "tolerable file". | Two or three names for one concept. |
| 9 | medium | prose | DESIGN, EV tooltip (L805); YAML `ev-tooltip.typography` (L251) | "sentence case and untracked" / "no tracking" | "sentence case with no letter-spacing" | "Tracked" is a domain word (Tracked List); "untracked" reads as a data state. |
| 10 | medium | prose | EXPERIENCE L215, L351, L554, L699, L1020 | "The edit date says which clock it came from" … "Ages … name their clock (`priced`, `tried`)." | Define "clock" once at L351: the event an age counts from. | Undefined jargon, used in two senses. |
| 11 | medium | prose | EXPERIENCE, Domain Vocabulary (L187–188, L211–212); *Two registers* (L670) | "the licence is one of **register, not of audience**" … "the one place … where that spelling is licensed" | "They are allowed there because the diagnosis quotes a file, not because someone else reads it." | Compressed jargon. |
| 12 | medium | prose | EXPERIENCE, *Price trust*, crafted-row "Rough when at least 70%…" (L571–585) | One ~150-word bullet holding trigger, basis, exclusion, reason string, zero-value fallback and a NOTE FOR ARCHITECT. | Sub-bullets: Trigger · Measured on · Reason · When gross value is zero; NOTE as a separate paragraph. | Densest rule in the spec, five clauses in one breath. |
| 13 | medium | prose | EXPERIENCE, *Estimated odds* (L601–603) vs L365, L396, L619–621 | "…so every probability of that pair is estimated (AD-10)" | Consider "…so the roll odds of that pair are estimates (AD-10)"? | Conflicts with on-screen "Some roll odds are estimated" and L620; check against AD-10 — may be a meaning conflict. |
| 14 | medium | prose | EXPERIENCE, *What survives a reload* (L838–845) | "*The test is deliberate setting against reading position*: … The recipe passes it as the threshold does" | "The test: a value the player deliberately sets persists, and a value that records how far he had read does not. The recipe is a deliberate setting, like the threshold." | Hard to parse; also cut "decided rather than left to silence" (decision narrative). |
| 15 | medium | prose | EXPERIENCE tag legend (L81–83); uses at L109, L119, L938, L1056; citation forms at L288, L327, L897, L727 ("PRD memlog 151"), L1056 ("memlog 22/25") | "Tags used in place: `[OPEN]`, `[ASSUMPTION]`, `[NOTE FOR ARCHITECT]` … `[NOTE FOR UX]`" | Add `[decision — …]`, `[change — …]`, `[OVERRIDE — …]` to the legend; one citation form; "memlog 22, 25"; say whose memlog "PRD memlog 151" is. | Common tags undefined; citation punctuation varies. |
| 16 | medium | prose | DESIGN L786–787, L1008–1009 (also YAML L226, L370); EXPERIENCE L93, L425 | "The four-column panel is approved as drawn in the mockup (memlog 269)." | Cut the sentence; keep "(memlog 269)" on the rule it supports. | Records a review event, not a rule — decision narrative in the body. |
| 17 | medium | prose | DESIGN, Failure screen (L1015–1018); Threshold slider (L731–734); Chase cell (L893) | "An eyebrow in `{typography.eyebrow}`, uppercase, … A title in … Body sentences in …" / "A 100px track (memlog 270), 4px tall, … Cursor grab, and grabbing while dragged." | "Its eyebrow is … Its title is … The track is 100px wide (memlog 270) and 4px tall… The cursor is grab…" | Verbless YAML-style fragments in prose; goes away if structure #1 is accepted. |
| 18 | medium | prose | DESIGN, Recipe toggle (L712–713) | "It is printed here only: `core` subtracts it once per Item Class (AD-17), so it is a fact about the recipe and not about a row." | Consider: "It prints only here. It is a property of the recipe, not of a row: `core` subtracts the same figure from every crafted EV (AD-17)."? | "Once per Item Class" argues the opposite; the "so" does not follow. |
| 19 | medium | prose | DESIGN, Trade link, *Its restraint is functional* (L969–970) | "A findable link invites the habit SM-1 measures the absence of." | "A prominent link would invite the habit whose absence SM-1 measures." | Stacked postpositions; "findable" says the opposite of the intent. |
| 20 | medium | prose | EXPERIENCE, Responsive & Platform, *What grows the page* (L923–927) | "Data: a long appendix (FR-30's world, memlog 203 — every Item Class Unrankable until …: the appendix sits at the foot, …) and state 35's two branches." | "Data: a long appendix, and state 35's two branches. In the FR-30 case (memlog 203), every Item Class is Unrankable until … The appendix then holds every row untruncated at the foot, and the page scrolls beneath it." | ~35-word parenthetical mid-list; "FR-30's world" unclear. |
| 21 | medium | prose | EXPERIENCE copy deck, Appendix title (L405); state 37 (L728) | `Appendix: Unrankable — N Item Classes` | Consider `Appendix: Unrankable — N item classes`? | Breaks the doc's own rule that Glossary capitals are prose vocabulary and the screen uses sentence case (L127–131, L395–396). |
| 22 | medium | prose | EXPERIENCE copy deck, EV tooltip ¶3 (L396) | `≈ some roll odds are estimated · ◐ unreliable price · ○ no price yet. ✕ broken. Hover a mark for the reason.` | `… · ○ no price yet · ✕ broken. Hover a mark for the reason.`? | Separators switch from `·` to full stops mid-list in shipped copy. |
| 23 | low | prose | EXPERIENCE, Money figures (L248–249) | "`core` persists 4dp and the page never re-rounds what it passes on." | "`core` stores figures at 4dp. The page rounds each figure once, for display." | "Re-rounds what it passes on" is unclear. |
| 24 | low | prose | EXPERIENCE, Craft Cost (L255–257) | "It validates every crafted EV on the page, which is why it is not quieter than secondary text." | "The player checks every crafted EV against it, so it is set no quieter than secondary text." | "Validates" implies a page check; tone is DESIGN's to own (memlog 250/251). |
| 25 | low | prose | EXPERIENCE L953–954; L716 (state 25); L762–763 | "the button saying nothing is wrong, not saying nothing at all" / "the figures merely tie, broken by AD-17's declared tiebreak" | "the button says that nothing is wrong; it is not silent" / "the figures tie, and AD-17's declared tiebreak orders them" | Wordplay; "broken" collides with the ✕ state word. |
| 26 | low | prose | DESIGN L576, L998; EXPERIENCE L377, L438, L918 | "The footer follows the content" | "The footer sits after the content, at the end of the page" | "Follows" can read as "obeys". |
| 27 | low | prose | EXPERIENCE, Responsive & Platform lead (L904) | "Unusual, and stated explicitly so nobody adds what is missing." | "These platform rules are unusual. They are stated so that nobody adds what is deliberately absent." | Subjectless fragment; "missing" invites filling the gap. |
| 28 | low | prose | DESIGN Do's and Don'ts (L1057, L1066); DESIGN L573 | Don't: "Vary row height … (a pruned line's reason line is the one exception)" / Do: "…where a stored search id matches the active league" / "The target screen is still a 1080×1920…" | Move the exception to the Do column; "…where the stored search ran in the active league"; drop "still". | Exception in a Don't cell reads as forbidden; an id does not "match" a league; "still" is revision residue. |
| 29 | low | prose | EXPERIENCE L59, L747, L982 ("~150ms"), L528 ("~15-hour"), L247/L690/L752 ("2 decimal places"/"2dp"/"two decimals"), DESIGN L834; DESIGN L573 "1080×1920" vs EXPERIENCE L906 "1080x1920" | "~150ms", "2dp", "two decimals", "1080x1920" | "about 150 ms", "two decimal places", "1080×1920" in both files | Inconsistent unit/approximation formats. |
| 30 | low | prose | Both files throughout, e.g. DESIGN L404 vs L1013; EXPERIENCE L496–500 | British spelling; serial comma mostly omitted but sometimes used | If Microsoft style governs, use US spelling and the serial comma; if the British house voice is deliberate, at least make the serial comma consistent. | Style guide vs intentional house voice; only the comma affects comprehension. |

**Summary**
- 30 prose recommendations: 3 high, 19 medium, 8 low.
- Recurring patterns: undefined or drifting terms (rows 7–11, 15); long sentences with nested asides (1, 2, 5, 12, 20); decision or revision residue in the body (14, 16, 28); on-screen strings that break the documents' own rules (3, 21, 22).
- Rows 3, 21, 22 concern shipped copy and are flagged only against rules the documents set themselves; the owner decides.
- Row 13 may be a real meaning conflict; check against AD-10 before editing.
- If structure findings 1, 2 and 5 are accepted, rows 17 and 18 mostly go away.


## Findings (JSON)

```json
[
  {
    "lens": "structure",
    "id": "S1",
    "severity": "high",
    "location": "DESIGN.md, front matter `components:` (L174–381) vs `## Components` H3s (L671–1023)",
    "trigger_condition": "Almost every component is specified twice. The YAML gives its properties, then the prose restates them nearly word for word. Examples: threshold-control YAML L194–204 vs prose L719–734; ranked-row L255–277 vs L814–848; the expansion-line variants L326–331 vs the table L922–929; sync-button L205–215 vs L739–757. The pressed-row rule appears five times (L262, L491–494, L644, L820–821, and EXPERIENCE L831–834).",
    "guard_snippet": "CONDENSE. Make the YAML the normative spec. Cut each prose H3 down to what the YAML cannot carry: the non-obvious *why*, cited by memlog id. Examples worth keeping: \"tone alone cannot mark the open row\", \"a zero would look free\", the ↗ restraint.",
    "potential_consequence": "One source per property, and no silent drift between the token block and the prose. Saves about 1,400 words (about 47% of the Components prose)."
  },
  {
    "lens": "structure",
    "id": "S2",
    "severity": "high",
    "location": "DESIGN.md: Trade link YAML L347–348 and prose L962–966; Recipe toggle L705–708 and YAML L191; Estimate mark L877–881; Skeleton L843–848; Failure screen L1019–1022; List statement L1004–1007; Unrankable appendix L986–988; Expansion line L919–920 and L931–933",
    "trigger_condition": "DESIGN states behaviour and data rules that EXPERIENCE owns, and EXPERIENCE states them again. Examples: when ↗ renders (a stored `lastSearchId` and an active-league test, which repeats EXPERIENCE L436 and L780–788); the grade-word derivation and its refusal (EXP L237–245); ≈ switching silently per (class, recipe) pair (EXP L608–615); what paints during the skeleton and the single transition (EXP L65, L713); the failure-screen variants and their causes (EXP L439); what raises the list statement; \"an age prints only when there is a problem\"; where pruned lines sit in the line order.",
    "guard_snippet": "MOVE to EXPERIENCE. Where EXPERIENCE already holds the rule, CUT it from DESIGN. Leave one citation, for example \"Renders when: EXPERIENCE.md, Interaction 6.\" Keep in DESIGN only how each case *looks*, such as the flat 10px bars or the absent (not greyed) link cell.",
    "potential_consequence": "Applies the memlog 250/251 ownership split. Saves about 400 words."
  },
  {
    "lens": "structure",
    "id": "S3",
    "severity": "high",
    "location": "DESIGN.md Expansion line, YAML L331 and table L929, vs EXPERIENCE *Missing figures* L636–637 and state 10 L699",
    "trigger_condition": "The two duplicated copies of the pruned-line price cell already disagree. DESIGN says the price slot holds \"a phrase in text-tertiary\". EXPERIENCE says the price is `—`, with `† pruned` beside it.",
    "guard_snippet": "QUESTION: which one is correct? Then keep a single statement in EXPERIENCE (the content), and have DESIGN say only the tone.",
    "potential_consequence": "Fixes a live contradiction that the duplication caused. 0 words."
  },
  {
    "lens": "structure",
    "id": "S4",
    "severity": "high",
    "location": "DESIGN.md Sync report panel, YAML L222–229 and table L771–777, vs EXPERIENCE Component Patterns L425, *Two registers* L675, state 27 L718",
    "trigger_condition": "DESIGN puts \"the cross-file diagnosis\" in column 1, headed **problems**. EXPERIENCE says the diagnosis \"is not a counted problem\" and files it under *what is broken*. The group names also differ: DESIGN has problems / the sync run / what the weights cover / built from; EXPERIENCE has *the sync run* / *what is broken* / *what the weights cover* plus attribution lines. These headings are on-screen strings, and they are written only in DESIGN.",
    "guard_snippet": "QUESTION: where does the diagnosis go? Then MOVE the four column headings into the EXPERIENCE copy deck. DESIGN keeps the 4-column geometry and cites the group order.",
    "potential_consequence": "A contradiction, and on-screen copy in the look spine. About 0 to +20 words."
  },
  {
    "lens": "structure",
    "id": "S5",
    "severity": "high",
    "location": "EXPERIENCE.md, Component Patterns (L419–439), Interaction Primitives (L740–800), State Patterns (L688–732), Epistemics *Loud when wrong* / *Sync health* (L457–500, L649–659)",
    "trigger_condition": "The same behaviours are spelled out in 3 to 5 places. The problem count that replaces the sync age appears at L393, L424, L463–467, L651–653, L722 and L1061–1063 in EXPERIENCE, and at L215, L441–443, L452–455 and L748–753 in DESIGN. The recipe switch (synchronous, not debounced, open panels stay open) appears at L422, L725 and L758–763. Opening the sync report (in place, scroll to the top, opens on the problem list) appears at L425, L651–659, L723 and L775–779. The top 8 lines / `+ N more` appears at L44–45, L433, L435, L730 and L797–800. Component Patterns cells run to 150–250 words each (L425, L428, L433).",
    "guard_snippet": "CONDENSE. Give each kind of rule one home. Interaction Primitives owns what an act does. State Patterns owns each treatment. Epistemics owns the trust and problem rules. Component Patterns becomes a short index: Use, plus one-line rules that cite `Interaction n` and `state n`. Delete *Sync health — quiet, one click down* (L649–659), which is wholly covered elsewhere.",
    "potential_consequence": "Removes about 4× repetition and its drift risk; makes Component Patterns scannable. Saves about 900 words."
  },
  {
    "lens": "structure",
    "id": "S6",
    "severity": "medium",
    "location": "EXPERIENCE.md State Patterns rows 1–7, 17, 18, 35, 40, 41 (L690–732) vs *Price trust* (L524–595)",
    "trigger_condition": "The state rows copy the reason strings and threshold logic word for word (3 days, 1–2 listings, 70%, the zero-value fallback, uncostable precedence). The copy deck (L382–383) already makes *Price trust* the owner of reasons.",
    "guard_snippet": "CONDENSE each row to its treatment, plus \"reason: *Price trust* table\".",
    "potential_consequence": "One copy of each reason string. Saves about 250 words."
  },
  {
    "lens": "structure",
    "id": "S7",
    "severity": "medium",
    "location": "Glyph→colour→meaning mapping: DESIGN YAML L278–286, Colors table L439–443, Trust mark table L855–860; EXPERIENCE *Price trust* table, Colour column L517–522",
    "trigger_condition": "Four copies of the same mapping. The Colour column puts look content in EXPERIENCE, and the \"Means\" column in DESIGN puts meaning in the look spine.",
    "guard_snippet": "MERGE. DESIGN keeps glyph + colour (one table). EXPERIENCE keeps state + word + meaning and drops its Colour column.",
    "potential_consequence": "Saves about 120 words."
  },
  {
    "lens": "structure",
    "id": "S8",
    "severity": "medium",
    "location": "Interaction vocabulary: DESIGN L673–687 vs EXPERIENCE L806–815",
    "trigger_condition": "Near-identical look/means/where tables. Both are titled \"four looks\" but list five rows. Only DESIGN explains the fifth (\"plus the ranked row\").",
    "guard_snippet": "MERGE. EXPERIENCE owns the meaning→where table. DESIGN keeps one line per look spec and cites it. Fix the heading count or label the row as an extra.",
    "potential_consequence": "Saves about 150 words; removes a miscount."
  },
  {
    "lens": "structure",
    "id": "S9",
    "severity": "medium",
    "location": "EXPERIENCE.md Foundation Mantine deltas rows L62–64; hover table L817–829; Responsive & Platform bullets L915–916, L931–934",
    "trigger_condition": "Look content in the behaviour spine: the `primaryColor` repoint, line-height ramps, px font sizes (all in DESIGN L412–414 and L555–558); colour tokens in the hover/persistent table; one dark theme (DESIGN L416–417); Inter bundled (DESIGN L499–500).",
    "guard_snippet": "MOVE or CUT to DESIGN. The hover table keeps cursor and interactivity facts only.",
    "potential_consequence": "Saves about 200 words."
  },
  {
    "lens": "structure",
    "id": "S10",
    "severity": "medium",
    "location": "EXPERIENCE Responsive & Platform (L902–934) vs DESIGN Layout & Spacing (L569–583)",
    "trigger_condition": "Frame bounds, no breakpoints, sideways scroll, no fixed height and which box scrolls are stated in both.",
    "guard_snippet": "MERGE. Frame and scroll geometry go in DESIGN. EXPERIENCE keeps \"what grows the page\" and the forbidden overflow escapes, and cites the frame.",
    "potential_consequence": "Saves about 200 words."
  },
  {
    "lens": "structure",
    "id": "S11",
    "severity": "medium",
    "location": "Contrast floor: DESIGN L470–495 and L1038–1040; EXPERIENCE Accessibility Floor L874–880. NFR-10 cues: DESIGN L451–457 and L1038–1039; EXPERIENCE L109–117, L595, L881–892",
    "trigger_condition": "The 4.5:1 rule and the non-colour cue list appear 3 to 4 times. Duplication only; the Accessibility Floor ruling stands and no new accessibility work is asked for.",
    "guard_snippet": "MERGE. The rule and the cue list stay in EXPERIENCE's Accessibility Floor. DESIGN keeps the measured table and cites the floor. CUT the Do's restatement.",
    "potential_consequence": "Saves about 150 words."
  },
  {
    "lens": "structure",
    "id": "S12",
    "severity": "medium",
    "location": "EXPERIENCE *Loud when wrong* item 2 (L473–482); *Estimated odds* L627–629; state 27 L718; Foundation L33–39; Coverage L1140–1143",
    "trigger_condition": "Architecture mechanism restated: the `pinnedCount` / `declaredMinChunkSearches` / `config.minChunkSearches` match, AD-4 propagation, the five AD-17 checks by name, the FR-33/AD-25 runtime-call argument, the AD-17 cross product. EXPERIENCE L47–48 itself says that mechanism belongs to the spine and IMPLEMENTATION-NOTES.",
    "guard_snippet": "CONDENSE each to a player-level statement plus a citation such as \"IMPLEMENTATION-NOTES §6\" or \"AD-17\".",
    "potential_consequence": "Follows the one-owner rule. Saves about 250 words."
  },
  {
    "lens": "structure",
    "id": "S13",
    "severity": "medium",
    "location": "EXPERIENCE L790–796 (findings T3/T4), L693 \"revision 9, 2026-09-27\", L317 / L898 \"rev 17\", L425 \"rev 18 / rev 19\", L738 \"which is why the recipe switch is 1a\", L1129, L235 \"story 2.7 Decisions\", L201 \"v7\"; DESIGN L600 \"replaces the old 27-character figure\"",
    "trigger_condition": "Review and revision history in the document body.",
    "guard_snippet": "CUT the narrative. Move T3/T4 to the memlog or the reviews folder. Re-cite `rev n` tags by memlog id.",
    "potential_consequence": "Follows the project rule against revision narrative. Saves about 150 words."
  },
  {
    "lens": "structure",
    "id": "S14",
    "severity": "medium",
    "location": "EXPERIENCE `## Coverage Self-Check` (L1109–1143)",
    "trigger_condition": "A validation-run log (\"Run against references/validate.md Pass 1\", numbering not resequenced, tokens resolve) sits in the body. The one block a reader needs, *Unresolved*, is buried at the end.",
    "guard_snippet": "CUT the log bullets and move them to reviews/memlog. MOVE *Unresolved* (L1130–1139) into Foundation, after the tag legend (L81–83), as an \"Open items\" list.",
    "potential_consequence": "Front-loads the open questions. Saves about 200 words."
  },
  {
    "lens": "structure",
    "id": "S15",
    "severity": "medium",
    "location": "EXPERIENCE Component Patterns (L419–439); IA L93; Coverage L1120–1125",
    "trigger_condition": "`components.list-statement` exists in DESIGN (L369–372, L1001–1009), but EXPERIENCE has no Component Patterns row for it. IA names it without a token, and the self-check claims full component coverage.",
    "guard_snippet": "Add a one-line `{components.list-statement}` row: raised by states 23, 25 and 35; copy in the deck.",
    "potential_consequence": "The coverage claim is currently false. About +40 words."
  },
  {
    "lens": "structure",
    "id": "S16",
    "severity": "medium",
    "location": "EXPERIENCE *Copy deck* (L380–413) vs Domain Vocabulary mapping (L133–149), attribution labels (L203–229), appendix reasons (L176–177), Voice Do table (L358–368), *Price trust* reasons",
    "trigger_condition": "The deck claims \"every fixed string the page prints, by place\", but strings live in at least five other places, and the mapping table re-prints deck strings (`Worth ≥`, `EV (Divine)`, `Sell as is…`, `N.NN div / craft`).",
    "guard_snippet": "MERGE. Either move all fixed strings into the deck, or change its intro to a pointer list. The mapping table cites the deck instead of re-printing strings.",
    "potential_consequence": "One lookup path for a string. Saves about 100 words."
  },
  {
    "lens": "structure",
    "id": "S17",
    "severity": "medium",
    "location": "EXPERIENCE `## Domain Vocabulary` (L125–342, 2,281 words)",
    "trigger_condition": "One H2 mixes the glossary mapping, header strings, labels, attribution, money rules, Craft Cost, combination writing and coining, hybrids, and truncation. \"What may be cut\" (L333–342) is a layout/behaviour rule and duplicates DESIGN *What may be cut* (L620–627).",
    "guard_snippet": "Add H3s: Mapping · Header and labels · Sync report labels · Money · Combinations and short forms · Hybrids. MERGE the two \"What may be cut\" blocks into one owner and cite it from the other.",
    "potential_consequence": "Random-access navigation for the longest section. Saves about 120 words."
  },
  {
    "lens": "structure",
    "id": "S18",
    "severity": "low",
    "location": "DESIGN `## Do's and Don'ts` lead paragraphs (L1027–1040) vs Brand & Style L399–407, Colors L451–457, EXPERIENCE Epistemics L446–500",
    "trigger_condition": "\"Silence means healthy\", \"Loud when wrong\" and \"Colour is never alone\" are restated in prose before the table. \"Loud when wrong\" is a behaviour principle owned by EXPERIENCE.",
    "guard_snippet": "CUT the three paragraphs and cite Epistemics. PRESERVE the Do/Don't table (L1042–1074).",
    "potential_consequence": "Saves about 150 words."
  },
  {
    "lens": "structure",
    "id": "S19",
    "severity": "low",
    "location": "DESIGN: `no figure yet` (YAML L193, L714, L1060), `< 0.01` (L834), `+ Try again`, `+ N pruned` (L340, L682, L955, L1021)",
    "trigger_condition": "On-screen strings written in the look spine, against its own last Do row (L1074).",
    "guard_snippet": "CONDENSE to role names (\"the uncostable phrase\", \"the retry action\") and cite the copy deck.",
    "potential_consequence": "Ownership hygiene. About 0 words."
  },
  {
    "lens": "structure",
    "id": "S20",
    "severity": "low",
    "location": "DESIGN `## Layout & Spacing` *Measure at build* (L599–607); EXPERIENCE L287–292 and L1138–1139",
    "trigger_condition": "Three copies of the build-measurement checklist. In DESIGN it is a run of verbless fragments.",
    "guard_snippet": "CONDENSE to one bulleted checklist in DESIGN; EXPERIENCE cites it.",
    "potential_consequence": "Saves about 60 words."
  },
  {
    "lens": "structure",
    "id": "S21",
    "severity": "low",
    "location": "DESIGN body start (L384)",
    "trigger_condition": "No H1 and no orientation: it does not say the YAML is normative and the prose explains, or that EXPERIENCE owns behaviour and strings. EXPERIENCE has a `peer-contract` (L14–15). The front-matter comment L25–27 and Brand & Style L409–414 repeat the substrate statement.",
    "guard_snippet": "Add a two-sentence preamble or a `peer-contract` key mirroring EXPERIENCE's. Drop the YAML substrate comment.",
    "potential_consequence": "Mental model before details. About +30 words."
  },
  {
    "lens": "structure",
    "id": "S22",
    "severity": "low",
    "location": "EXPERIENCE L147 (`Synced N ago ▾`) vs L392 (`Synced {age} ago ▾`) vs Ages rule L354–356 (`N min ago`)",
    "trigger_condition": "Two placeholder schemes for one string. If `{age}` is the full \"N min ago\", the deck renders \"ago ago\".",
    "guard_snippet": "One placeholder convention, defined once in the copy deck.",
    "potential_consequence": "About 0 words."
  },
  {
    "lens": "structure",
    "id": "S23",
    "severity": "low",
    "location": "EXPERIENCE `## Key Flows` (L936–1107); state 19 retired row (L710); DESIGN trade-link rationale (L968–971)",
    "trigger_condition": "These look cuttable: the narrative restates rules, the row is retired, the rationale is long.",
    "guard_snippet": "PRESERVE. The flows give human readers the purpose behind the rules. The retired row keeps the stable-id policy (L684–686). The ↗ rationale is a non-obvious why that guards against a likely \"improvement\".",
    "potential_consequence": "Keep."
  },
  {
    "lens": "prose",
    "id": "P1",
    "severity": "high",
    "location": "EXPERIENCE, Information Architecture, *One list, two ranked units* (L109–117)",
    "trigger_condition": "\"A row states which it is twice: by the game's own rarity colour on its name — `{colors.rarity-magic}` for a crafted Item Class, `{colors.rarity-normal}` for a Raw Base, as the trade site prints magic and normal items — and, for the non-colour read, by the text a Raw Base row prints where a crafted row prints its Best combinations: `Sell as is · item level 82+`\"",
    "guard_snippet": "\"A row states which it is in two ways. Its name takes the game's rarity colour: `{colors.rarity-magic}` for a crafted Item Class and `{colors.rarity-normal}` for a Raw Base, as the trade site prints magic and normal items. For a reader who cannot see colour, a Raw Base row prints `Sell as is · item level 82+` where a crafted row prints its Best combinations.\"",
    "potential_consequence": "Split one ~70-word sentence with two colons and a dash pair into three sentences."
  },
  {
    "lens": "prose",
    "id": "P2",
    "severity": "high",
    "location": "EXPERIENCE, State Patterns, row 23 (L714)",
    "trigger_condition": "\"Every row reads ○ pending — after a pure reset with `price from last league`; after a mixed reset some rows carry a new-league reason such as `no listings found` — or ✕ broken for a broken entry, and every EV cell reads `—` (memlog 257).\"",
    "guard_snippet": "\"Every row reads ○ pending, or ✕ broken for a broken entry, and every EV cell reads `—` (memlog 257). After a pure reset the pending reason is `price from last league`. After a mixed reset some rows carry a new-league reason such as `no listings found`.\"",
    "potential_consequence": "\"or ✕ broken\" sits so far from \"○ pending\" that a reader attaches it to the dash aside."
  },
  {
    "lens": "prose",
    "id": "P3",
    "severity": "high",
    "location": "EXPERIENCE copy deck, footer item 3 (L404); quoted at L454",
    "trigger_condition": "`No mark price is current`",
    "guard_snippet": "Consider: `No mark · price is current`?",
    "potential_consequence": "Fails the document's own colour-removed test (L882–883): reads as a garden path. Every other legend item is separated by its glyph; this one has none."
  },
  {
    "lens": "prose",
    "id": "P4",
    "severity": "medium",
    "location": "DESIGN, Trust mark, *On an expansion line* (L868–870)",
    "trigger_condition": "\"the glyph centred in a 12px box, 6px, the word in the mark's colour\"",
    "guard_snippet": "\"the glyph centred in a 12px box, a 6px gap, then the word in the mark's colour\"",
    "potential_consequence": "Missing noun; the YAML (L284) says gap."
  },
  {
    "lens": "prose",
    "id": "P5",
    "severity": "medium",
    "location": "EXPERIENCE, Foundation (L41–48)",
    "trigger_condition": "\"Every on-screen string — labels, state words, reasons, tooltip text, footer text — and the fixed values the page prints or judges by (…) are written here once.\"",
    "guard_snippet": "\"This document writes each on-screen string once: labels, state words, reasons, tooltip text and footer text. It also writes each fixed value the page prints or judges by: …\"",
    "potential_consequence": "~45-word subject before its verb."
  },
  {
    "lens": "prose",
    "id": "P6",
    "severity": "medium",
    "location": "Both files: DESIGN L387; EXPERIENCE L31, L154, L279, L670, L762–763, L842–843, Key Flows",
    "trigger_condition": "\"he reads it at an angle…\", \"what he was given\", \"he wrote the Tracked List\"",
    "guard_snippet": "Consider \"the player\" or singular \"they\". If \"he\" is deliberate for the one known user, state that once in EXPERIENCE Foundation.",
    "potential_consequence": "Microsoft style asks for gender-neutral wording; make the choice explicit."
  },
  {
    "lens": "prose",
    "id": "P7",
    "severity": "medium",
    "location": "DESIGN L395–397, L413, L1047 (\"bronze\"); L445, EXPERIENCE L603 (\"amber\"); DESIGN L1048, EXPERIENCE L508, L1062 (\"red\"); EXPERIENCE L955 (\"Blue… grey\")",
    "trigger_condition": "\"one bronze, taken from the game's UI frame\" … \"One amber carries both ◐ and ≈\"",
    "guard_snippet": "\"one bronze, `{colors.accent}`, …\" … \"One amber, `{colors.trust-rough}`, …\"",
    "potential_consequence": "Colour nicknames appear before their token; tie each to its token at first use."
  },
  {
    "lens": "prose",
    "id": "P8",
    "severity": "medium",
    "location": "EXPERIENCE L435, L768, L1074, L1080 vs DESIGN \"pruned line\"; EXPERIENCE L110 \"raw row\", L437 \"raw branch\"; DESIGN L776, L783 \"absent tolerable file\"; EXPERIENCE L222, L729 \"tolerable artifact\"",
    "trigger_condition": "\"tombstone band\" / \"pruned lines\"; \"raw row\" / \"Raw Base row\"; \"tolerable file\" / \"tolerable artifact\"",
    "guard_snippet": "One term each: \"pruned line\", \"Raw Base row\", \"tolerable file\".",
    "potential_consequence": "Two or three names for one concept."
  },
  {
    "lens": "prose",
    "id": "P9",
    "severity": "medium",
    "location": "DESIGN, EV tooltip (L805); YAML `ev-tooltip.typography` (L251)",
    "trigger_condition": "\"sentence case and untracked\" / \"no tracking\"",
    "guard_snippet": "\"sentence case with no letter-spacing\"",
    "potential_consequence": "\"Tracked\" is a domain word (Tracked List); \"untracked\" reads as a data state."
  },
  {
    "lens": "prose",
    "id": "P10",
    "severity": "medium",
    "location": "EXPERIENCE L215, L351, L554, L699, L1020",
    "trigger_condition": "\"The edit date says which clock it came from\" … \"Ages … name their clock (`priced`, `tried`).\"",
    "guard_snippet": "Define \"clock\" once at L351: the event an age counts from.",
    "potential_consequence": "Undefined jargon, used in two senses."
  },
  {
    "lens": "prose",
    "id": "P11",
    "severity": "medium",
    "location": "EXPERIENCE, Domain Vocabulary (L187–188, L211–212); *Two registers* (L670)",
    "trigger_condition": "\"the licence is one of **register, not of audience**\" … \"the one place … where that spelling is licensed\"",
    "guard_snippet": "\"They are allowed there because the diagnosis quotes a file, not because someone else reads it.\"",
    "potential_consequence": "Compressed jargon."
  },
  {
    "lens": "prose",
    "id": "P12",
    "severity": "medium",
    "location": "EXPERIENCE, *Price trust*, crafted-row \"Rough when at least 70%…\" (L571–585)",
    "trigger_condition": "One ~150-word bullet holding trigger, basis, exclusion, reason string, zero-value fallback and a NOTE FOR ARCHITECT.",
    "guard_snippet": "Sub-bullets: Trigger · Measured on · Reason · When gross value is zero; NOTE as a separate paragraph.",
    "potential_consequence": "Densest rule in the spec, five clauses in one breath."
  },
  {
    "lens": "prose",
    "id": "P13",
    "severity": "medium",
    "location": "EXPERIENCE, *Estimated odds* (L601–603) vs L365, L396, L619–621",
    "trigger_condition": "\"…so every probability of that pair is estimated (AD-10)\"",
    "guard_snippet": "Consider \"…so the roll odds of that pair are estimates (AD-10)\"?",
    "potential_consequence": "Conflicts with on-screen \"Some roll odds are estimated\" and L620; check against AD-10 — may be a meaning conflict."
  },
  {
    "lens": "prose",
    "id": "P14",
    "severity": "medium",
    "location": "EXPERIENCE, *What survives a reload* (L838–845)",
    "trigger_condition": "\"*The test is deliberate setting against reading position*: … The recipe passes it as the threshold does\"",
    "guard_snippet": "\"The test: a value the player deliberately sets persists, and a value that records how far he had read does not. The recipe is a deliberate setting, like the threshold.\"",
    "potential_consequence": "Hard to parse; also cut \"decided rather than left to silence\" (decision narrative)."
  },
  {
    "lens": "prose",
    "id": "P15",
    "severity": "medium",
    "location": "EXPERIENCE tag legend (L81–83); uses at L109, L119, L938, L1056; citation forms at L288, L327, L897, L727 (\"PRD memlog 151\"), L1056 (\"memlog 22/25\")",
    "trigger_condition": "\"Tags used in place: `[OPEN]`, `[ASSUMPTION]`, `[NOTE FOR ARCHITECT]` … `[NOTE FOR UX]`\"",
    "guard_snippet": "Add `[decision — …]`, `[change — …]`, `[OVERRIDE — …]` to the legend; one citation form; \"memlog 22, 25\"; say whose memlog \"PRD memlog 151\" is.",
    "potential_consequence": "Common tags undefined; citation punctuation varies."
  },
  {
    "lens": "prose",
    "id": "P16",
    "severity": "medium",
    "location": "DESIGN L786–787, L1008–1009 (also YAML L226, L370); EXPERIENCE L93, L425",
    "trigger_condition": "\"The four-column panel is approved as drawn in the mockup (memlog 269).\"",
    "guard_snippet": "Cut the sentence; keep \"(memlog 269)\" on the rule it supports.",
    "potential_consequence": "Records a review event, not a rule — decision narrative in the body."
  },
  {
    "lens": "prose",
    "id": "P17",
    "severity": "medium",
    "location": "DESIGN, Failure screen (L1015–1018); Threshold slider (L731–734); Chase cell (L893)",
    "trigger_condition": "\"An eyebrow in `{typography.eyebrow}`, uppercase, … A title in … Body sentences in …\" / \"A 100px track (memlog 270), 4px tall, … Cursor grab, and grabbing while dragged.\"",
    "guard_snippet": "\"Its eyebrow is … Its title is … The track is 100px wide (memlog 270) and 4px tall… The cursor is grab…\"",
    "potential_consequence": "Verbless YAML-style fragments in prose; goes away if structure #1 is accepted."
  },
  {
    "lens": "prose",
    "id": "P18",
    "severity": "medium",
    "location": "DESIGN, Recipe toggle (L712–713)",
    "trigger_condition": "\"It is printed here only: `core` subtracts it once per Item Class (AD-17), so it is a fact about the recipe and not about a row.\"",
    "guard_snippet": "Consider: \"It prints only here. It is a property of the recipe, not of a row: `core` subtracts the same figure from every crafted EV (AD-17).\"?",
    "potential_consequence": "\"Once per Item Class\" argues the opposite; the \"so\" does not follow."
  },
  {
    "lens": "prose",
    "id": "P19",
    "severity": "medium",
    "location": "DESIGN, Trade link, *Its restraint is functional* (L969–970)",
    "trigger_condition": "\"A findable link invites the habit SM-1 measures the absence of.\"",
    "guard_snippet": "\"A prominent link would invite the habit whose absence SM-1 measures.\"",
    "potential_consequence": "Stacked postpositions; \"findable\" says the opposite of the intent."
  },
  {
    "lens": "prose",
    "id": "P20",
    "severity": "medium",
    "location": "EXPERIENCE, Responsive & Platform, *What grows the page* (L923–927)",
    "trigger_condition": "\"Data: a long appendix (FR-30's world, memlog 203 — every Item Class Unrankable until …: the appendix sits at the foot, …) and state 35's two branches.\"",
    "guard_snippet": "\"Data: a long appendix, and state 35's two branches. In the FR-30 case (memlog 203), every Item Class is Unrankable until … The appendix then holds every row untruncated at the foot, and the page scrolls beneath it.\"",
    "potential_consequence": "~35-word parenthetical mid-list; \"FR-30's world\" unclear."
  },
  {
    "lens": "prose",
    "id": "P21",
    "severity": "medium",
    "location": "EXPERIENCE copy deck, Appendix title (L405); state 37 (L728)",
    "trigger_condition": "`Appendix: Unrankable — N Item Classes`",
    "guard_snippet": "Consider `Appendix: Unrankable — N item classes`?",
    "potential_consequence": "Breaks the doc's own rule that Glossary capitals are prose vocabulary and the screen uses sentence case (L127–131, L395–396)."
  },
  {
    "lens": "prose",
    "id": "P22",
    "severity": "medium",
    "location": "EXPERIENCE copy deck, EV tooltip ¶3 (L396)",
    "trigger_condition": "`≈ some roll odds are estimated · ◐ unreliable price · ○ no price yet. ✕ broken. Hover a mark for the reason.`",
    "guard_snippet": "`… · ○ no price yet · ✕ broken. Hover a mark for the reason.`?",
    "potential_consequence": "Separators switch from `·` to full stops mid-list in shipped copy."
  },
  {
    "lens": "prose",
    "id": "P23",
    "severity": "low",
    "location": "EXPERIENCE, Money figures (L248–249)",
    "trigger_condition": "\"`core` persists 4dp and the page never re-rounds what it passes on.\"",
    "guard_snippet": "\"`core` stores figures at 4dp. The page rounds each figure once, for display.\"",
    "potential_consequence": "\"Re-rounds what it passes on\" is unclear."
  },
  {
    "lens": "prose",
    "id": "P24",
    "severity": "low",
    "location": "EXPERIENCE, Craft Cost (L255–257)",
    "trigger_condition": "\"It validates every crafted EV on the page, which is why it is not quieter than secondary text.\"",
    "guard_snippet": "\"The player checks every crafted EV against it, so it is set no quieter than secondary text.\"",
    "potential_consequence": "\"Validates\" implies a page check; tone is DESIGN's to own (memlog 250/251)."
  },
  {
    "lens": "prose",
    "id": "P25",
    "severity": "low",
    "location": "EXPERIENCE L953–954; L716 (state 25); L762–763",
    "trigger_condition": "\"the button saying nothing is wrong, not saying nothing at all\" / \"the figures merely tie, broken by AD-17's declared tiebreak\"",
    "guard_snippet": "\"the button says that nothing is wrong; it is not silent\" / \"the figures tie, and AD-17's declared tiebreak orders them\"",
    "potential_consequence": "Wordplay; \"broken\" collides with the ✕ state word."
  },
  {
    "lens": "prose",
    "id": "P26",
    "severity": "low",
    "location": "DESIGN L576, L998; EXPERIENCE L377, L438, L918",
    "trigger_condition": "\"The footer follows the content\"",
    "guard_snippet": "\"The footer sits after the content, at the end of the page\"",
    "potential_consequence": "\"Follows\" can read as \"obeys\"."
  },
  {
    "lens": "prose",
    "id": "P27",
    "severity": "low",
    "location": "EXPERIENCE, Responsive & Platform lead (L904)",
    "trigger_condition": "\"Unusual, and stated explicitly so nobody adds what is missing.\"",
    "guard_snippet": "\"These platform rules are unusual. They are stated so that nobody adds what is deliberately absent.\"",
    "potential_consequence": "Subjectless fragment; \"missing\" invites filling the gap."
  },
  {
    "lens": "prose",
    "id": "P28",
    "severity": "low",
    "location": "DESIGN Do's and Don'ts (L1057, L1066); DESIGN L573",
    "trigger_condition": "Don't: \"Vary row height … (a pruned line's reason line is the one exception)\" / Do: \"…where a stored search id matches the active league\" / \"The target screen is still a 1080×1920…\"",
    "guard_snippet": "Move the exception to the Do column; \"…where the stored search ran in the active league\"; drop \"still\".",
    "potential_consequence": "Exception in a Don't cell reads as forbidden; an id does not \"match\" a league; \"still\" is revision residue."
  },
  {
    "lens": "prose",
    "id": "P29",
    "severity": "low",
    "location": "EXPERIENCE L59, L747, L982 (\"~150ms\"), L528 (\"~15-hour\"), L247/L690/L752 (\"2 decimal places\"/\"2dp\"/\"two decimals\"), DESIGN L834; DESIGN L573 \"1080×1920\" vs EXPERIENCE L906 \"1080x1920\"",
    "trigger_condition": "\"~150ms\", \"2dp\", \"two decimals\", \"1080x1920\"",
    "guard_snippet": "\"about 150 ms\", \"two decimal places\", \"1080×1920\" in both files",
    "potential_consequence": "Inconsistent unit/approximation formats."
  },
  {
    "lens": "prose",
    "id": "P30",
    "severity": "low",
    "location": "Both files throughout, e.g. DESIGN L404 vs L1013; EXPERIENCE L496–500",
    "trigger_condition": "British spelling; serial comma mostly omitted but sometimes used",
    "guard_snippet": "If Microsoft style governs, use US spelling and the serial comma; if the British house voice is deliberate, at least make the serial comma consistent.",
    "potential_consequence": "Style guide vs intentional house voice; only the comma affects comprehension."
  }
]
```
