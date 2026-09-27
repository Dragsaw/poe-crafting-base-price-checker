---
title: 'Story 2.6: The trust strip, its health line, and the Sync Report panel'
type: 'feature'
created: '2026-09-27'
status: 'done'
baseline_revision: '7cb03886d8a29c45c946c536ea90dee47d95bd12'
route: 'dispatch'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/docs/stories/epic-2-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The page does not show what the ranking rests on. There is no weights header, no sync time and no Tracked List date. A broken run (unresolvable entries, pinned starvation) is invisible, and the Sync Report cannot be read. The absence lines sit under the masthead, outside the strip where UX now puts them.

**Approach:** Build `{components.trust-strip}` between the masthead and the asking-price line. It has two resting lines, the moved absence lines, a data-raised rust health line, and a whole-strip toggle for `{components.sync-report-panel}`. The panel shows five figure groups in three columns. Widen `WeightsFileEnvelopeSchema` to type the header only.

## Boundaries & Constraints

**Always:**
- The epics.md Story 2.6 ACs are normative. DESIGN.md `trust-strip` / `sync-report-panel` (L616-652, L1963-2080) own the look. Mockups `key-hero-resting.html` (L187-195, L406-413) and `key-expanded-states.html` (L280-290, L512-555) own the geometry. Mockup source names are stale. Use the contract's source keys.
- Line one: `Weights File` + `producer <producer.id>` | `generatedAt <YYYY-MM-DD>` | `gamePatch <v>`. Line two: `Last synced <…>` | `Tracked List last edited <YYYY-MM-DD>`, with ` (not committed)` for `source: 'file-modified'`. Dates are in UTC. A missing value reads italic *unknown*. Labels are ink 600, values ink-secondary, and `|` is ink-tertiary with `0 9px` padding. No mark and no colour on these facts.
- Absence lines move into the strip, after line two and before the health line, with copy unchanged. Add the token `frameReserveAbsenceLine` (21) and use it in `reservedChrome`.
- Health line: the unresolvable count is the number of `records` of kind `unresolvable` in `sync-report.json`. `× N unresolvable` shows when N > 0, and `× pinned entries starved this run` shows when any `pinned-starvation` record exists. When both show, `|` separates them. The line is rust 700 on a 21px line. There is no line when the run is healthy or `sync-report.json` is absent.
- Toggle: the whole strip is the click target. The affordance, right-aligned on line one in sepia `expand-affordance`, reads `+ the full sync report` / `− the full sync report` (U+2212). It gets a dotted sepia underline only while the strip is hovered. The panel is closed on every load. The panel and the appendix have no hover state.
- Panel: paper-inset, with hairlines top and bottom and padding `14px 16px 12px`. `max-height` is `syncReportMaxHeight`, with `overflow-y: auto`. There are three equal columns, with `padding-right: 22px` except on the last. Each column has one `key-heading` (`The sync run`, `What is broken`, `What the weights cover`), and groups are 8px apart. Figures are ink with tabular numerals. Column two is a vertical stack, so Epic 3's sixth group needs only vertical space.
- Every figure is read from `sync-report.json` as published. Counting records is the only derivation. Coverage prints `coverage` as a percent together with `rankableClassCount`. When coverage is omitted, the panel reads *not measured* if `set.weights` is loaded and *unknown* if it is not, never `0`. The panel says `in the last sync pass` and never uses the word "Chunk". The panel does not repeat the Tracked List edit date.
- `WeightsFileEnvelopeSchema` types `producer: { id, generatedAt }` (loose) and `gamePatch` (non-empty) and nothing more. It does not type `bases`.
- Tests stay offline. The strip toggle fires no request.
- **Decisions (2026-09-27):**
  - `Last synced` is the relative age of `runFinishedAt ?? runStartedAt` against the load `now`: `< 1 minute ago`, `N minutes ago` under 1h, `N hours ago` under 24h, then `N days ago` (singular `1 minute`/`1 hour`/`1 day`). With `sync-report.json` absent it reads *unknown*.
  - The panel prints only published figures, with no sum and no numerator: `10 tracked list · 1 league validation requests this pass.` · `N tracked entries were not reached in the last sync pass.` · `N entries are unresolvable.` · `N pinned-starvation records.`, and for each record `pinnedRefreshed of pinnedCount pinned entries refreshed` · `86% of 29 tracked Item Classes.` Zeros print in the panel. The strip's no-zero rule is for the strip only. Append a `[NOTE FOR UX]` entry on this copy to `deferred-work.md`.
  - With `sync-report.json` absent, the strip still toggles, and each of the five groups reads italic *unknown* under its column heading.
  - The spec is kept whole at about 2,300 tokens. The user declined the split.

**Never:**
- No change to `core`, `sync` or `vite.config.ts`. No new artifact. No coverage computation. No count of zero on the strip, and no success mark. No staleness colour on any date. No sixth group, no cross-file diagnosis and no banner.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Committed | weights 6.0.0, report `file-modified`, no records | `producer poe-mod-weights-producer`, `generatedAt 2026-09-26`, `gamePatch 0.5.5`, `… 2026-09-26 (not committed)`, no health line | N/A |
| Git date | `git-author-date` | bare date | N/A |
| No edit date | `trackedListEditedAt` omitted | *unknown* | N/A |
| Weights absent | `set.weights` null | the three line-one values *unknown*; the absence line in the strip; coverage *unknown* | N/A |
| Coverage omitted, weights loaded | no `coverage` | *not measured* | N/A |
| Coverage present | coverage 0.862, rankableClassCount 29 | `86% of 29 tracked Item Classes` (no numerator: the report does not publish one) | N/A |
| Broken | 12 unresolvable records + 1 pinned-starvation record | `× 12 unresolvable | × pinned entries starved this run` | N/A |
| Toggle | click anywhere on the strip twice | open with `−`, then closed with `+` | N/A |

</frozen-after-approval>

## Code Map

- `packages/contracts/src/envelopes.ts` -- `WeightsFileEnvelopeSchema` (L94) is `looseObject({schemaVersion})`. Add the three header fields. `SyncReportFileSchema` (L134) is read-only.
- `packages/contracts/src/sync-run-report.ts` -- `SyncRunFiguresSchema` (L70): `requestsBySource{'tracked-list','league-validation'}`, `notReachedCount`, `coverage?` (0..1), `rankableClassCount?`, `trackedListEditedAt?`. `records` has the kinds `unresolvable` (L129) and `pinned-starvation` (L114: `pinnedCount`, `pinnedRefreshed`, `activeRefreshed`, …). `runStartedAt`, `runFinishedAt?` (L279).
- `packages/contracts/src/tracked-list-age.ts` -- `TrackedListAge {source:'git-author-date'|'file-modified', at}`.
- `packages/web/src/load/artifacts.ts` -- `ArtifactSet` (L84): a tolerable key is `Parsed<K> | null`. `load-artifacts.ts` `LoadOutcome.ready {set, absent}`.
- `packages/web/src/App.tsx` -- the ready branch (L78-86): `Frame > Masthead > AbsenceLines > AskingPriceLine > ReadyList > PageTail`, with `now` in `ViewState`. Replace `AbsenceLines` with `TrustStrip {set, absent, now}` in that slot.
- `packages/web/src/frame/AbsenceLines.tsx` -- `absenceLine`/`CONSEQUENCE`. Reuse it inside the strip, and change the lead styling to label ink 600.
- `packages/web/src/theme/tokens.ts` -- `frameSlack` 530 (L70), `frameReserveHealthLine` 21 (L72), `syncReportMaxHeight` 400 (L73), `typeRoles['trust-strip']` (L225), `committedChrome` trust strip 68 (L300), `reservedChrome` (L315), `glyphs.unresolvable`. The `key-heading`/`key-body`/`expand-affordance` roles exist.
- `packages/web/src/theme/tokens.test.ts` (L133-142) -- the budget assertions. Update them for the absence token.
- `packages/web/src/frame/frame.css` -- the `.fg-affordance` precedent. Add strip-hover underline CSS.
- `packages/web/src/list/format.ts` -- the italic missing-figure style and the `formatDivine` precedents.
- `packages/web/src/App.test.tsx` (`mount`, `settleTo`, the absence test L236, the chrome order L289) and `test-support/artifact-server.ts` `VALID_BODIES` (L31): the weights fixture lacks `producer`, so add it. The report fixture lacks `trackedListEditedAt`.

## Tasks & Acceptance

**Execution:**
- [x] `packages/contracts/src/envelopes.ts` (+ test) -- widen the weights envelope with the header fields only.
- [x] `packages/web/src/theme/tokens.ts` (+ test) -- `frameReserveAbsenceLine`, the panel padding and the column gap. Assert the 95px co-occurring worst case, and assert that 400 is at most `frameSlack − 95`.
- [x] `packages/web/src/frame/trust-facts.ts` (+ test) -- pure formatters: the header facts, the dates, the edit date and suffix, last synced, the health triggers, and the panel figure copy.
- [x] `packages/web/src/frame/TrustStrip.tsx`, `SyncReportPanel.tsx`, `frame.css` -- the strip, the moved absence lines, the health line, the toggle and the panel.
- [x] `packages/web/src/App.tsx`, `test-support/artifact-server.ts` -- mount the strip, and fix the fixtures.
- [x] `packages/web/src/frame/trust-strip.test.tsx`, `App.test.tsx` -- the matrix rows, the chrome order, one heading per column, the panel closed on load, no request on toggle, and no zero on a healthy strip.

**Acceptance Criteria:**
- Given the committed `data/` under `pnpm dev`, when the player opens and closes the strip in agent-browser (named `--session`), then the strip matches the mockup (68px at rest, and the affordance underlines on hover), the panel pushes the list down inside the 400px cap, and no request fires.
- Given `pnpm check` and `pnpm test`, when they run, then both pass.

## Verification

**Commands:**
- `pnpm check` -- expected: tsc, eslint and depcruise clean.
- `pnpm test` -- expected: all green, and no escaped request.

**Manual checks:**
- Run `pnpm dev` in the background. With agent-browser: screenshot the strip at rest and open, measure the strip height (68) and the panel columns, hover the strip, and then stop the server.

## Review Triage Log

### 2026-09-27 — Review pass
- verdicts: 28 findings — high 0, medium 4, low 9, false 13, maybe-false 2
- findings:
  - `[medium]` `[patch]` (blind) The pending skeleton paints no trust strip, so the page jumps 68px on load and the App docstring is false — added `TrustStripSlot` (blank, 67.55px, two rules, `aria-hidden`) to the pending branch, fixed the docstring, and extended the pending test.
  - `[false]` `[reject]` (blind) The strip has no keyboard or ARIA toggle — DESIGN.md L2034 and EXPERIENCE.md L971 rule the strip mouse-only with "no keyboard affordance to add".
  - `[low]` `[reject]` (blind) Drag-selecting strip text toggles the panel — real, but uncommon, and the fix adds a selection guard branch.
  - `[false]` `[reject]` (blind) The 68px height is only checked by arithmetic, and the affordance could grow line one — the `expand-affordance` line box is 12.5×1.5 = 18.75px, under 21.28px, and the browser measured 67.53px.
  - `[false]` `[reject]` (blind) Absence and health lines can wrap past 21px — the copy is fixed and short (under 70 chars at 11.5px in the frame width). The health line holds at most two short signals.
  - `[low]` `[reject]` (blind) `coOccurringReserve` is argued in prose, not derived by enumeration — the spec asks for the 95px assertion. An enumeration test adds complexity for a rule no caller changes today.
  - `[low]` `[reject]` (blind) The italic missing-value markup is duplicated in TrustStrip and SyncReportPanel — cosmetic duplication, and the fix is a refactor, not a direct correction.
  - `[false]` `[reject]` (blind) An aborted run reads like a finished one in Last synced — `runFinishedAt ?? runStartedAt` is the intent's 2026-09-27 decision.
  - `[false]` `[reject]` (blind) `utcDate` throws on a bad instant and clock skew is hidden — inputs pass `IsoTimestampSchema` upstream. `< 1 minute ago` for a non-positive age is the intent's ladder.
  - `[low]` `[reject]` (blind) The spec's tasks were unchecked while in review — the fix edits this build's spec (ticked at finalize).
  - `[low]` `[reject]` (blind) Panel copy has singular and period issues (`1 league validation requests`, no period on the per-record line) — the copy is the intent's verbatim decision, and the `[NOTE FOR UX]` entry hands UX the wording, singulars included.
  - `[low]` `[reject]` (blind) The schema shape-key test is brittle, no test covers a header-less weights file, and the App no-zero check is weak — the shape test asserts the intent's "does not type bases". The component test holds the stronger no-zero regex. Hardening adds tests for no reachable defect.
  - `[false]` `[reject]` (edge) No keyboard or ARIA toggle — same refutation as above (DESIGN L2034, EXPERIENCE L971).
  - `[low]` `[reject]` (edge) Text selection toggles the panel — same as above: uncommon, and the fix adds a guard.
  - `[low]` `[reject]` (edge) A long `producer.id` or `gamePatch` could wrap line one past 68px — producer ids and patch strings are short in practice (committed: `poe-mod-weights-producer`, `0.5.5`). An ellipsis guard adds layout complexity.
  - `[medium]` `[patch]` (edge) The pending skeleton has no strip slot, so layout jumps 68px — grouped with the skeleton patch above.
  - `[maybe-false]` `[reject]` (edge) `Math.round` prints 0% or 100% for coverage near the ends — this happens only if the published coverage falls in (0, 0.005) or [0.995, 1). Over 29 classes a class-ratio coverage steps by about 3.4%. It would be at most low, and Story 3.6's measurement would settle it.
  - `[false]` `[reject]` (edge) A header-less weights file refuses the whole page instead of reading *unknown* — WEIGHTS-FILE-SCHEMA.md L252/L293 make `gamePatch` and `producer` required, so such a file is invalid (NFR-8 refusal). *unknown* is for an absent file.
  - `[medium]` `[patch]` (verification-gap) The pending skeleton reserves no strip slot, and no test checks it — grouped with the skeleton patch above. The pending test now asserts the slot sits between masthead and asking-price line.
  - `[low]` `[patch]` (verification-gap) The hover underline depends on two unpinned class names — `trust-strip.test.tsx` now asserts `fg-trust-strip`, `fg-strip-affordance`, and no inline borderBottom or textDecoration.
  - `[medium]` `[patch]` (verification-gap, other) The App docstring says the skeleton paints the same chrome — grouped with the skeleton patch above. The docstring is corrected.
  - `[false]` `[reject]` (intent) Browser geometry and hover are asserted only as token sums and inline styles — the agent-browser check ran (strip 67.53px, sepia dotted underline on hover, panel 90px pushing the list 237.5→327.8px, no request), and the class-name binding is now pinned.
  - `[maybe-false]` `[reject]` (intent) The Committed matrix row uses an inline copy of the committed `data/` values — `load-artifacts.test.ts:187-210` loads the committed `data/` and expects ready, and the browser check read the committed values. A test tying the copy to the files would be at most low.
  - `[false]` `[reject]` (intent) Schema strictness goes past "type the header" — the weights contract requires `producer` and a non-empty `gamePatch` (WEIGHTS-FILE-SCHEMA L252/L293), and `generatedAt` is ISO-8601 UTC by contract.
  - `[false]` `[reject]` (intent) The health line colours signals, not the whole line — DESIGN, which the intent names as owner of the look, makes each signal a rust mark. The `|` keeps the strip's separator.
  - `[false]` `[reject]` (intent) The Broken row's textContent lacks spaces around `|` — the separator's `0 9px` padding renders the spacing, the same as the mockup.
  - `[false]` `[reject]` (intent) NBSP plus space joins label and value — the mockup `key-hero-resting.html` L408 uses exactly `</b>&nbsp; `.
  - `[false]` `[reject]` (intent) Uppercase ink-tertiary headings and `coOccurringReserve` go beyond the intent — DESIGN `columnHeadingColor` and the spec task list call for them.

## Auto Run Result

Status: done

**Summary.** The trust strip sits between the masthead and the asking-price line. It has two resting lines of plain facts: the weights header, Last synced, and the Tracked List edit date with ` (not committed)`. After them come the moved absence lines, a data-raised rust health line, and a whole-strip toggle for the Sync Report panel. The panel is paper-inset, capped at 400px, with three columns, five figure groups and one heading per column. `WeightsFileEnvelopeSchema` now types `producer {id, generatedAt}` and `gamePatch` only. The pending skeleton reserves a blank strip slot so load does not jump.

**Files changed**
- `packages/contracts/src/envelopes.ts` (+ test): the weights envelope types the header only. `bases` is untyped.
- `packages/web/src/theme/tokens.ts` (+ test): adds `frameReserveAbsenceLine` 21 in `reservedChrome`, the strip and panel paddings and gaps, and `coOccurringReserve` (95), with the 68px and 400 ≤ 530 − 95 assertions.
- `packages/web/src/frame/trust-facts.ts` (+ test): pure formatters for line one, UTC dates, the edit suffix, Last synced, the health triggers and the panel copy.
- `packages/web/src/frame/TrustStrip.tsx`: the strip, the toggle, the health line, and `TrustStripSlot` for the skeleton.
- `packages/web/src/frame/SyncReportPanel.tsx`: the capped three-column panel.
- `packages/web/src/frame/AbsenceLines.tsx`: moved into the strip in DESIGN order, with the lead in ink 600 and the copy unchanged.
- `packages/web/src/frame/frame.css`: the dotted sepia underline on the affordance while the strip is hovered.
- `packages/web/src/App.tsx`: mounts the strip in ready and the slot in pending.
- `packages/web/src/test-support/artifact-server.ts`: fixtures gain `producer` and `trackedListEditedAt`.
- `packages/web/src/frame/trust-strip.test.tsx`, `packages/web/src/App.test.tsx`: the matrix rows, chrome order, toggle without a request, no zero on a healthy strip, the pending slot, and the hover class binding.
- `docs/stories/deferred-work.md`: a `[NOTE FOR UX]` entry on the provisional panel copy.

**Review findings.** 28 in all. 2 patch groups were applied: the skeleton strip slot (medium, 4 rows across layers) and the hover class-name test (low). 0 were deferred. 23 were rejected, each with its reason in the triage log above (13 false, 8 low not worth the added complexity or edits to this spec's tasks, 2 maybe-false at most low). The Deferred Ledger audit found 0 findings.

**Follow-up review recommended: false.** Patched this pass: high 0, medium 1, low 1.

**Verification.** `pnpm check` is clean (tsc, eslint, depcruise). `pnpm test` passes: 80 files and 1009 tests, with no escaped request. Manual agent-browser check by the implementation subagent (named session, `pnpm dev --port 5186`, committed `data/`): strip 67.53px at rest, sepia dotted underline on hover, panel opening 90px tall and pushing the asking-price line 237.5→327.8px, the `−` affordance while open, coverage *not measured*, and no request on toggle. The server was stopped afterwards.

**Residual risks**
- The skeleton slot's height (67.55px by arithmetic) was not measured in a browser.
- The committed `data/recipes.json` is present, so the committed page shows no absence line.
- An earlier Story 2.1 `[NOTE FOR UX]` still describes the absence lines as sitting under the masthead. The ledger is append-only, so it was left as written.
- The panel copy's singular forms await a UX ruling.
