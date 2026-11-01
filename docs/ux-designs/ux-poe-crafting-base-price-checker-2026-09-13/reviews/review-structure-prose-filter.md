# Review: Pick-up Filter UX changes (structure + prose)

Content: `git diff` of `EXPERIENCE.md` and `DESIGN.md`, 2026-11-01. The diff covers the Pick-up
Filter additions, the header-width rewrite, and the removal of every memlog citation.
Lenses: structure, then prose on top of the structure findings.

## Structure

Model: Reference/Database. Each fact has one owner, for random access by build agents.

| # | Finding | Disposition |
|---|---|---|
| S1 | The header-title cut was stated in the Copy Deck, the YAML and the prose, but *What may be cut* (its owner) did not list it | Fixed: new bullet in *What may be cut*. The Copy Deck row keeps only the string |
| S2 | DESIGN *Measure at build* says "Never cut text", but the title now cuts by design | Fixed: exception that points to *What may be cut* |
| S3 | `Synced 365d ago ▾` measured wider than its slot, with no ruling | Fixed: "The slot must hold the widest form" |
| S4 | DESIGN YAML restated behaviour ("no transition", "selectable") | Fixed: cut from DESIGN. EXPERIENCE owns both |
| S5 | `filter-modal` row inside the IA table, which claims a fixed vertical order | Fixed: row removed. The paragraph under the table covers the modal |
| S6 | The write-path ruling appeared three times, and its heading contradicted its body | Fixed: heading "One download, and no write path". The Banned item cites Foundation |
| S7 | The treatments paragraph restated FR-36's rule while disclaiming ownership | Fixed: condensed to the disclaimer and citations |
| S8 | An Accessibility Floor sub-bullet broke the NFR-10 schema | Fixed: merged into Foundation's treatments paragraph |
| S9 | The Mantine `Modal` row restated the default as a delta | Fixed: sentence cut |
| S10 | Esc contradicted "mouse only" | Fixed: Esc named in the intro's exception |
| S11 | The IA paragraph held usage narrative that UJ-7 already carries | Fixed: replaced with "not in the vertical order" and its content |
| S12 | *What survives a reload* had two adjacent "starts closed" sentences | Fixed: merged |
| S13 | The hover table restated the `Copied` string and its timing | Fixed: cites the Copy Deck |
| S14 | The Copy Deck held layout and order notes | Fixed: strings only |
| S15 | The folder path in mono broke the verbatim register's exclusive reservation | Fixed: the register is widened in both owners to "text the player pastes exactly" |
| S16 | A hover cell held "—" followed by text | Fixed |
| S17 | A permissive exception sat in the Don't column | Fixed: moved to the Do column |
| S18 | Lines pushed past the column width | Not fixed. Formatting only |
| B | 29 breaks left by the citation strip (orphan `.` or `,` at the start of a line, one double period, one stray leading space) | Fixed by script. Some joined, overlong lines remain. They render correctly |

## Prose

28 rows. Each one marked fixed was applied to the spines.

| # | Finding | Disposition |
|---|---|---|
| P1 | DESIGN.md frontmatter failed to parse: an unescaped `'` in `filter-modal.steps` | Fixed (`step''s`). Both frontmatters now parse with PyYAML |
| P2 | A blank line split the IA table after the header-bar row | Fixed |
| P3 | Foundation's "writes nothing else" contradicted the clipboard write | Fixed |
| P4 | "A quote" could include the `'` in NeverSink's own file name | Fixed: "a double quote". The Copy Deck error now reads `…with no double quotes or folders.`, in the mock too |
| P5 | State 45: a disabled download cannot be "attempted" | Fixed: disabled while the name is unusable. The error shows on blur |
| P6 | "Pastes" was read as pasting into the field | Fixed in both verbatim-register owners |
| P7 | The mouse-only intro had an unclear "which" and began a sentence with a numeral | Fixed |
| P8 | "Input is mouse-only" contradicted the exceptions | Fixed: it cites the intro |
| P9 | "Under the threshold" read as *below threshold* | Fixed in Interaction 9. Flagged only in the approved lead `under your current threshold` |
| P10–P14 | Interaction 9 (copy reason, `Import` antecedent, dial sentence), state 47 "It", state 45 "which" | Fixed |
| P15–P18 | DESIGN: 952px vs content-min, the sync slot overrun, which tooltip shadow, "either" in Do/Don't | Fixed. The 365d overrun is tagged `[OPEN]` |
| P19–P21 | "Below the target frame", the cut bullet not named as an exception, "it" in the header-bar YAML | Fixed |
| P22–P25 | UJ-7: "orbs" vs "recipe", the step 3 order, "from the first time", the failure-path causality | Fixed |
| P26 | IA paragraph: "holds the download" | Fixed: "the field … and the download action" |
| P27 | Lines left outside their list items by the citation strip, and one whitespace-only line | The whitespace line is fixed. The rest still render through lazy continuation and are left as is |
| P28 | Full stop outside the bold of run-in heads | Not fixed. Cosmetic |
