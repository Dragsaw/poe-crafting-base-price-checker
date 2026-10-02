---
title: 'Story 3.5: Chase Combinations on the collapsed crafted row'
type: 'feature'
created: '2026-10-02'
status: 'done'
baseline_commit: '0637f62c9e5564a1a8687d9f957a31e00ddac90e'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/docs/stories/epic-3-context.md'
  - '{project-root}/docs/ux-designs/ux-poe-crafting-base-price-checker-2026-09-13/EXPERIENCE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A crafted ranked row prints its Item Class and EV, but its chase column is blank, and its expansion lists no Combination row. The player cannot see which Combinations the EV rests on (epics Story 3.5, FR-2, UX-DR39; the deferred-work entries from specs 2.5 and 3.4).

**Approach:** `web` renders at most three of `core`'s `summands` as chase cells, and lists every non-pruned Tracked Entry of the class in the expansion. Both surfaces take their text from one formatter: the Accepted Tier plus a short form per affix, joined by ` · `. The short forms come from a hand-kept `web` table keyed by `statId` (EXPERIENCE memlog 231). When a modifier has no short form or no Accepted Tier, the formatter falls back to the catalogue stat name plus its value band, in the mono verbatim register.

## Boundaries & Constraints

**Always:**
- The chase cells are a prefix of `summands` in `core`'s order. `web` chooses only the count (≤ 3) and computes no term. A summand joins its tracked entry by `canonicalKey`.
- Geometry: DESIGN `col-chase` 492px, three fixed 164px cells, `pad-chase-cell-right` 10px, `row-chase`, `ink-secondary`, and `ink-chase-emphasis` on tier-1 rows. A cell ellipsises with `nowrap`. Unused slots stay as empty cells (state 21). Raw rows keep their italic note.
- Every short form obeys the five coinage rules (EXPERIENCE, *How a short form may be coined*). A test asserts that no form is duplicated and that every `statId` in the committed `data/tracked.json` has a form.
- The fallback keeps the line's own size and weight, uses `fonts.mono`, and has no ink, mark or glyph.
- Crafted expansion: one `CombinationRow` per non-pruned entry. The summands come first in `core`'s order, and every other entry follows in canonical-key order. A summand's note is empty. A priced entry below T gets *below the threshold — adds nothing to EV* (state 20). Every other state takes the existing state notes and the state-4 `unresolvable` treatment. Ages, figure, sample, trade link and `* pinned` reuse the raw path. Nothing is ellipsised in the expansion.
- Two bands of one modifier that declare one tier print identically. Append a `[NOTE FOR UX]` and do not settle it (epics 3.5, last AC).

**Never:**
- No value in a curated form, no form coined per row, and no word cut to fit.
- No crafted Age cell (it waits for the architect's ruling on AD-10). No tombstone band. No Provenance (3.6).
- No change to `core` or `contracts`. No new artifact (AD-24). No edit to an owner document.

**Decisions (2026-10-02, player):**
- Scope: the chase cells and the crafted expansion rows. The Age cell stays deferred.
- Tier spelling: print `acceptedTier` verbatim. `T1-T2` keeps its hyphen, and nobody edits `data/tracked.json`.
- Valueless reference: print the short form alone, without a tier, in the curated register (`Extra Bolt`). Append a `[NOTE FOR UX]`. When it has no form, it takes the mono fallback with no band.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Happy path | 5 summands | 3 cells, `core`'s first three, e.g. `T1 Cold Res · T1 Mana` | N/A |
| One affix | suffix only | `T1 Cold Res` | N/A |
| Mixture | `acceptedTier: "T1-T2"` | `T1-T2 % Phys`, verbatim | N/A |
| Valueless | `Loads an additional bolt` | `Extra Bolt` | N/A |
| State 21 | `summands: []` | three empty cells; EV `−cost` at 2dp; numerals print | N/A |
| Fewer | 1 summand | one filled cell and two empty cells | N/A |
| No form / no tier | id not in the table, or a banded ref without a tier | that affix prints its catalogue text with the band, in mono | N/A |
| Unknown stat | fallback id not in `catalogue/stats.json` | the raw `statId` plus the band, in mono | N/A |
| Change | T raised, recipe switched | the cells and the open panel rows change in the same pass | N/A |
| State 35 | `ev: null` | the cells still print, because T reads the gross price | N/A |
| Expansion | 1 summand, 1 entry below T, 1 `no-listings`, 1 `unresolvable`, 1 pruned | 4 rows in that order. The notes are empty, *below the threshold…*, the no-listings note, and the state-4 note. The pruned entry has no row | N/A |

</frozen-after-approval>

## Code Map

- `packages/core/src/rank.ts:458-498` `craftedRow`. The summands are the entries priced at or above T, sorted by `compareSummands` (:484). Read it and do not change it.
- `packages/contracts/src/ranked-row.ts:220-258`: `CraftedSummand {entryKey, probability, priceDivine, contribution}`. `modifier-ref.ts:29-57`: `acceptedTier?`. `tracked-entry.ts:105-114`: `prefix?` and `suffix?`. `canonical-key.ts`: `canonicalKey` and `compareCanonicalKeys`.
- `packages/web/src/list/display-rows.ts:194-206,264-277`: `ClassDisplayRow`. Add `chase` (≤ 3 cell texts) and the panel's combinations, built from the row, the tracked set, the dataset and T. The raw `detail()` (:249-260) is the pattern.
- `packages/web/src/list/RankedRow.tsx:120-135`: the chase slot. A raw row renders `data-raw-note` and a crafted row renders `null`. Render the three cells there.
- `packages/web/src/list/ExpansionPanel.tsx:173-184,270-286`: `rawCombination` is the model. `ClassExpansionPanel` passes `combinations={[]}`.
- `packages/web/src/list/format.ts`: `rawCombinationNote` (:123) (its `priced` arm is raw-only), `combinationFigure`, `sampleText`, `combinationAges` and `STATE_NOTES`. Add the below-threshold note constant.
- `packages/web/src/list/CombinationRow.tsx:29-42,85-91`: the `Combination` shape takes `text` as a string. It must take the formatter's parts so that a fallback affix renders in mono.
- `packages/web/src/list/trade-link.ts:19` `tradeSearchHref`: it is generic over the dataset entry, so reuse it.
- `packages/web/src/theme/tokens.ts`: chase `{width:492,padRight:10}` (:191-198), `row-chase` (:279), `ink-chase-emphasis` (:29), `fonts.mono` (:235). Add `chaseCell: 164` and `padChaseCellRight: 10`.
- `packages/web/src/load/artifacts.ts:48-56`: `catalogueStats` is loaded, but nothing reads it. Build a `statId → text` map from `result[].entries[]` (`contracts/src/trade-catalogue.ts:25-39`).
- New `packages/web/src/list/short-forms.ts` (the table) and `packages/web/src/list/combination-text.ts` (`combinationText(entry, stats)` returns affix parts `{text, verbatim}`).
- Test support: `list-fixtures.ts:23-34` `craftedEntry` builds a valueless prefix without a tier, so add a banded builder. `artifact-server.ts:65` serves an empty catalogue.

## Tasks & Acceptance

**Execution:**
- [x] `packages/web/src/list/short-forms.ts` (+ test): the table, a uniqueness test, and a coverage test over the committed data.
- [x] `packages/web/src/list/combination-text.ts` (+ test): the curated forms, the valueless form, the fallback and the band (Design Notes).
- [x] `packages/web/src/list/{display-rows,format}.ts`, `RankedRow.tsx`, `ExpansionPanel.tsx`, `CombinationRow.tsx`, `theme/tokens.ts`, `App.tsx`, `test-support/*` (+ tests): the chase cells, the crafted panel rows, the catalogue lookup, and every matrix row.
- [x] Fit check (+ test): compute every committed combination text. Assert that the longest one with `* pinned ` leading it fits the combination cell, 460px less its 12px pad, at the line-one type size. List each chase pairing over 27 characters as a pruning candidate.
- [x] `docs/stories/deferred-work.md`: append the identical-tier `[NOTE FOR UX]`, the valueless `[NOTE FOR UX]` and the pruning candidates. Remove the 2.5 entries this story discharges (crafted expansion, Combination text, fit measurement). Narrow the 3.4 "Story 3.5" entry to the Age cell. Keep the architect entry on the short-form module open, and name the module.

**Acceptance Criteria:**
- Given the committed data, when the page loads, then every crafted row of the active recipe shows at most three cells, and no curated cell prints a numeral other than its tier.
- Given the workspace, when searched, then `web` neither reorders nor computes over summands, except for the `slice(0, 3)`.

## Design Notes

The proposed short forms (`explicit.stat_<id>`) are borrowed from game and trade-site usage. A `%` prefix marks the percent-increased variant of a flat stat:

Spirit 3981240776 · Atk Dmg 2843214518 · Flat Phys 1940865751 · % Phys 1509134228 · Flat Cold 1037193709 · Flat Fire 709508406 · Flat Lightning 3336890334 · Ele Atk Dmg 387439868 · % ES 2482852589 · % Evasion 2106365538 · ES 3489782002 · Life 3299347043 · Mana 1050105434 · Rarity 3917489142 · % Life 983749596 · % Mana 2748665614 · Spell Dmg 2974417149 · Spell Skills 124131830 · Atk Spd 681332047 · +Crit Chance 518292764 · +Crit Dmg 2694482655 · Proj Skills 1202301673 · Extra Arrow 2463230181 · Extra Bolt 1967051901 · All Attr 1379411836 · All Res 2901986750 · Chaos Res 2923486259 · Cold Res 4220027924 · Crit Chance 587431675 · Crit Dmg 3556824919 · Melee Skills 9187492 · Minion Skills 2162097452 · Cast Spd 2891184298 · Int 328541901 · Mana Regen 789117908.

Fallback band: when the stat text holds exactly one `#`, substitute `min–max` for it (`35–52.5% to Cold Resistance`). Otherwise, append the band (`Adds # to # Fire Damage 4.41–5`). Numbers print as the file writes them, with no rounding.

## Verification

**Commands:**
- `pnpm check`: expected to pass.
- `pnpm test`: expected to pass, with no network call.

**Manual checks:**
- agent-browser (named session) on `pnpm dev`: each crafted row shows at most 3 cells, raw rows keep their note, and a crafted panel lists its entries. A threshold change and a recipe switch rewrite both surfaces.

## Implementation Notes

- The crafted Price State is resolved in `web` (`format.ts` `resolvedState`) as `core` resolves a Raw Base: no dataset entry is `never-synced`, another league is `league-mismatch`. `web` reads no threshold: a priced, in-league entry that is not a summand is below T by construction, so it takes the state-20 note.
- `toListBranches` takes a `CraftedContext` (tracked entries, catalogue stat texts, active league). `App` builds the `statId → text` map once per load with `flattenStatCatalogue`.
- A crafted row's chase column drops its own 10px right pad; each of the three 164px cells pads 10px (`spacing.chaseCell`, `spacing.padChaseCellRight`).
- `Combination.text` is now `AffixPart[]`. `CombinationText` renders it on both surfaces and sets a fallback part in `stacks.mono` and nothing else.
- Fit check: jsdom lays out no text, so `combination-fit.test.ts` bounds the width at 0.6em per character (a monospace advance). The longest committed text with `* pinned ` is 49 characters, 368px at 12.5px, inside 448px. 54 committed pairings exceed 27 characters. The test and `deferred-work.md` list them.
- A source-scan test (`display-rows.test.ts`, *the summands in web*) pins every code use of `summands` in `web` and forbids reads of `contribution`, `probability` and `grossPayout`.
- Browser (agent-browser, committed data, state 35): 3 crafted rows, at most 3 cells each, none ellipsised; raw rows keep the note; the Amulets panel lists 140 rows; a recipe switch reorders the open panel and rewrites its sub-line; a threshold of 3 raises the below-threshold notes from 26 to 74 in the same pass.

## Spec Change Log

## Review Triage Log

| # | Layer | Finding | Verdict | Evidence | Route |
|---|-------|---------|---------|----------|-------|
| 1 | blind, edge, verification | `display-rows.test.ts` summands filter `/: summands[.)]]/` matches no real use, so the allowlist never runs | medium | `[.)]` then a literal `]`. Every real use (`summands.map(`, `summands.length`) fails the filter, so `code` is empty. The second AC has no working guard | patch |
| 2 | verification | The crafted trade link's `aria-label` is asserted nowhere | low | The crafted-panel test reads only `href`. A one-line assertion is a direct fix. This is not new ARIA, so the Accessibility Floor does not apply | patch |
| 3 | blind | The fit check calls 0.6em/char an upper bound | low | Serif capitals, `*` and `·` can exceed 0.6em. The 368 vs 448px margin holds, but the comment overclaims. The fix is a comment change | patch |
| 4 | blind | The `short-forms.ts` comment says a new modifier prints the fallback, but the coverage test fails `pnpm test` | low | The comment omits the gate that the spec requires. The fix is a comment change | patch |
| 5 | blind | A mixture prints `T1-T2`, against EXPERIENCE rule 5 (en dash). No `[NOTE FOR UX]` records it | low | The player decided on verbatim. The owner doc says en dash. The review brief says to record the conflict | defer (`[NOTE FOR UX]`) |
| 6 | blind, edge | The fallback keeps two `#`, prints a raw `statId`, and can overflow line one of a combination row | low | This follows spec Design Notes and the matrix. It conflicts with EXPERIENCE *Rendered text, not raw ids*. The committed data takes no fallback (`combination-fit.test.ts`) | defer (`[NOTE FOR UX]`) |
| 7 | blind | `resolvedState` and the below-threshold inference copy `core`'s predicate into `web` with no parity test | medium | It matches `craftedRow` today (`rank.ts` 458-498), but a `core` change can drift silently. The fix needs `core`/`contracts`, which the intent forbids here | defer (architect) |
| 8 | blind, edge | A summand key with no tracked entry blanks a cell and drops a panel row silently | false | `core` builds summands from the same non-pruned tracked entries of the class, joined by the same `canonicalKey`, so the case is unreachable | reject |
| 9 | edge | `toDisplayRows` defaults to an empty crafted context | low | Every production call goes through `toListBranches`, which passes the context. Only tests omit it. Making it required touches many callers | reject |
| 10 | edge | `reduce` without an initial value throws on empty texts | low | The test still fails, with a TypeError, and a sibling test asserts `live.length > 0` | reject |
| 11 | edge | A negative band prints `-10–-5` | low | Fallback-only, and no committed data reaches it. A fix adds a formatting branch | reject |
| 12 | blind | `sprint-status.yaml` says `in-progress` while the spec is `in-review` | false | The workflow syncs sprint status at its close (step 5) | reject |
| 13 | blind | The `deferred-work.md` edits rewrite other stories' entries | false | Spec Tasks require narrowing the 3.4 entry and naming the module in the architect entry. A fix would edit this spec | reject |
| 14 | blind | 54 pruning candidates live in two hand-synced copies | low | The ledger is a note, and the test is the checked copy. The fix adds tooling | reject |
| 15 | blind | The short-form table mixes flat and percent conventions, and `+Crit` may be coined | false | The table is the spec's Design Notes (the player's). A fix would edit this spec | reject |
| 16 | blind | The mono fallback is tested only in a chase cell, not in the expansion | low | Both surfaces render the one `CombinationText`. The gap is negligible | reject |
| 17 | blind | `trackedByClass` and `combinationText` rebuild on every threshold or recipe change | low | About 140 rows. There is no observable cost, and the fix adds memoisation | reject |
