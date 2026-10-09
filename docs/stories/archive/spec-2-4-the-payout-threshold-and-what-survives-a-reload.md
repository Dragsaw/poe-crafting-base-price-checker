---
title: 'Story 2.4: The Payout Threshold, and what survives a reload'
type: 'feature'
created: '2026-09-26'
status: 'done'
baseline_revision: 'e381f34558f2f7f1fb17a51d4622c9df09bf73a2'
route: 'dispatch'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/docs/stories/epic-2-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The page ranks at a hard-coded 0.25 Divine. The masthead's 276px threshold slot is empty, so the player cannot change the threshold, and nothing survives a reload.

**Approach:** Fill the slot with `{components.payout-threshold}`. It is a borderless Mantine `NumberInput`, where the figure is the input and `Divine` sits outside it, with a non-interactive track and marker readout. Hold the threshold in `App`, re-rank through `core`'s `rank` on each valid parse (debounced about 150ms), and persist it to `localStorage`. The value is read once at mount, and a missing or invalid stored value falls back to 0.25.

## Boundaries & Constraints

**Always:**
- The epics.md Story 2.4 ACs are normative. DESIGN.md `payout-threshold` owns the look: panel `paper-inset`, hairline `rule-hairline` border, padding 13×15, label `PAYOUT THRESHOLD` in `ink-tertiary` (`threshold-label`), figure `threshold-value` `ink` tabular-nums at a fixed 2dp (`0.25`, `3.00`), unit `threshold-value-unit` `ink-secondary` with a leading space, track 4px `rule-hairline` with sepia fill, marker 11×14 `ink` centred on the value, range `0 Divine` / `3 Divine` (`threshold-range`). Add the missing spacing tokens to `theme/tokens.ts` (panel padding, the 4/10/7px gaps from `mockups/key-hero-resting.html`).
- Figure rule: dotted sepia at rest, solid sepia on hover, solid `rule-strong` while focused. It is under the figure only. Caret `ink`, selection `paper-deep`. These live as a `.fg-threshold` rule in `frame.css` through `var(--fg-color-*)`.
- Control: min 0, max 3, step 0.05, 2 decimals, clamp on blur, `allowNegative={false}`, no stepper controls. A number input, never a slider.
- Re-ranking: each valid parse sets the ranking threshold after about 150ms. A parse above 3 ranks at 3. An empty or unparseable value (`""`, `"."`) does not re-rank. On blur it restores the last valid value. The readout (fill width and marker left = value / 3) follows the ranking threshold. The track and marker take no pointer events.
- Persistence: key `poe-cbpc.payoutThreshold`. Write the ranking threshold on each change. Read it once at mount. Accept a finite number in [0, 3], rounded to 2dp. Anything else, or a storage accessor that throws, gives `DEFAULT_THRESHOLD`. Every read and write is wrapped in try/catch. Nothing else is persisted: the grown list and the open rows reset on reload, as today.
- The masthead group is 216 (empty recipe slot, Epic 3) + 16 + 276 = 508, and the dek stays at a 480px cap on two lines. The control renders in the `pending` and `ready` states, and not on the two failure screens.
- `web` computes no ordering. Raw Bases below the threshold leave the list through `core` (`belowThreshold`), and they never reappear in the grown list. Tests stay offline (`test-support/artifact-server.ts`).

**Never:**
- No change to `core`, `contracts` or `packages/web/vite.config.ts`. No network request or sync on a threshold change.
- No nothing-clears declarative (Story 2.7 owns UX-DR51 and state 25). No Craft Recipe switch (Epic 3). No crafted rows, so the Chase Combination half of the re-rank AC is carried by `core` and is not asserted in `web`.
- No slider behaviour: no drag, no track click, no tooltip, no animation.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| First visit | storage empty | figure `0.25`, marker at 8.33% | N/A |
| Raise threshold | type `0.6` over `0.25` (bases at 0.5, 0.8) | after ~150ms only the 0.8 base is ranked; grown list lacks the 0.5 base | N/A |
| Lower threshold | type `0.1` (base at 0.1268) | that base gains a row | N/A |
| Over max | type `5`, blur | ranks at 3; blur shows `3.00` | N/A |
| Emptied | clear the field, blur | no re-rank; blur restores the last valid value | N/A |
| Negative | type `-` | not entered | N/A |
| Reload | stored `0.6` | figure `0.60`, list ranked at 0.6; open rows and grown list reset | N/A |
| Bad stored value | `"abc"`, `"7"`, `"-1"` | default 0.25 | fallback |
| Storage throws | `getItem` throws | default 0.25; typing still re-ranks | swallowed |
| Cleared storage | storage cleared after a set | default 0.25; rest of page identical | N/A |

</frozen-after-approval>

## Code Map

- `packages/web/src/App.tsx` -- `App` view switch; `ReadyList` memoises `rank` at `DEFAULT_THRESHOLD`. Lift the threshold into `App` state (initialised from storage), pass it to `Masthead` and to `ReadyList`'s `useMemo` deps.
- `packages/web/src/frame/Masthead.tsx` -- the `data-control-slot` div (508px, `aria-hidden`) becomes the control group: an empty 216 slot, a 16 gap, and the threshold panel. It takes `threshold` and `onThresholdChange` props.
- `packages/web/src/list/format.ts` -- `DEFAULT_THRESHOLD`, `formatDivine`. Reuse them; add `THRESHOLD_MIN/MAX/STEP` here or in the new module.
- `packages/web/src/list/RankedList.tsx` -- holds `grown`/`open` state keyed by `entryKey`. It survives a re-rank, which is acceptable because the keys are stable. Do not reset it on a threshold change.
- `packages/core/src/rank.ts` -- `rank({ threshold })`. It keeps `price ≥ threshold`; below goes to `belowThreshold`. Read only.
- `packages/web/src/theme/tokens.ts` -- `typeRoles` `threshold-*`, `spacing.thresholdPanelWidth`/`recipePanelWidth`/`mastheadControlGap`, `columnSums.mastheadControls`, `colors`. `theme.ts` sets the `--fg-color-*` vars.
- `packages/web/src/frame/frame.css` -- hover rules precedent (`.fg-affordance`).
- `packages/web/src/App.test.tsx`, `src/test-support/{artifact-server,list-fixtures}.ts` -- mount pattern (`createRoot` + `act`, `PageProvider`), `bodiesWith`, `priced`, `rawEntry`. Remount to simulate a reload; clear `localStorage` in `afterEach`.
- `mockups/key-hero-resting.html` lines 123-131, 169-184, 386-392 -- panel geometry reference.

## Tasks & Acceptance

**Execution:**
- [x] `packages/web/src/threshold/threshold-storage.ts` (+ test) -- `readStoredThreshold(storage?)`, `writeStoredThreshold(value, storage?)`, `THRESHOLD_STORAGE_KEY`, and `clampThreshold`. Pure and try/catch-guarded -- the persistence rules and the bad-value matrix.
- [x] `packages/web/src/threshold/PayoutThreshold.tsx` -- the panel: label, `NumberInput` (unstyled, `hideControls`, `className="fg-threshold"`), the unit span, and the readout. A local draft string, with a debounced commit through `useDebouncedCallback` from `@mantine/hooks` (150ms) -- UX-DR18/35/44.
- [x] `packages/web/src/theme/tokens.ts` (+ test) -- the threshold panel spacing tokens.
- [x] `packages/web/src/frame/frame.css` -- `.fg-threshold` input rules: no border, background or padding; the dotted/solid/strong bottom rule; caret; `::selection`.
- [x] `packages/web/src/frame/Masthead.tsx`, `packages/web/src/App.tsx` -- the control group, threshold state and storage wiring, and the re-rank on change.
- [x] `packages/web/src/threshold/payout-threshold.test.tsx`, `App.test.tsx` -- the matrix rows; the group widths sum to 508; the unit is outside the `<input>`; the readout has `pointer-events: none` and no handlers; no request fires on a change (the MSW guard); a reload keeps the threshold and resets the grown list and the open rows.

**Acceptance Criteria:**
- Given the committed `data/` under `pnpm dev`, when the player types `0.1` in agent-browser (named `--session`), then a sub-0.25 base gains a row with no network request, and the panel matches the mockup geometry.
- Given a set threshold and a page reload, when the page loads, then the figure and the ordering are unchanged, and every other view state is back at rest.
- Given `pnpm check` and `pnpm test`, when they run, then both pass.

## Implementation Notes

- Mantine `fixedDecimalScale` keeps the figure at 2dp while typing (`5` shows `5.00` at once). A self-formatted text field could not be cleared with real keystrokes at `3.00`/`1.50`, and jsdom did not show the fault.
- `trimLeadingZeroesOnBlur={false}`: Mantine's trim turned a padded lone `.` (`.00`) into a parse of 0 on blur. The component's own blur handler restores the last valid value.
- A draft needs a leading digit to count (`/^\d+(\.\d*)?$/`). `.5` does not re-rank while typing, and blur restores the last valid value.
- The stored-value read accepts plain decimal text only (`0x1`, `1e0` give the default). This is stricter than "a finite number in [0, 3]".
- Mantine's `Input` writes its own `aria-describedby` after the passed props. The unit link goes through the Styles API `attributes` prop.
- agent-browser `fill ""` does not fire React's change event on this input. Use real key presses (Ctrl+A, Backspace) to empty the field in manual QA.

## Spec Change Log

## Review Triage Log

### 2026-09-26 — Review pass
- verdicts: 22 findings — high 0, medium 0, low 10, false 7, maybe-false 5
- findings:
  - `[low]` `[patch]` sprint-status moves 2-4 to `ready-for-dev` although the work is implemented — set to `review` at finalize, matching 2-2 and 2-3.
  - `[low]` `[patch]` `ReadyList` docstring still says "at the default threshold" — reworded to the player's threshold, memoised on set, `now` and threshold.
  - `[low]` `[reject]` a value typed less than 150ms before a reload or tab close is never written — React does not unmount on unload. `flushOnUnmount` would not help, and the fix needs a `pagehide` listener (added complexity) for a sub-150ms window a player is unlikely to hit.
  - `[false]` `[reject]` pausing at `0` or `0.` re-ranks at 0 — `0` is inside [0, 3] and the spec makes each valid parse re-rank after ~150ms. Only `""` and `"."` are named unparseable, so this is the specified behaviour.
  - `[low]` `[reject]` step 0.05 and arrow keys are untested — Mantine steps through the same `onChange` → parse → debounced commit path the tests cover. A missing extra test with no demonstrated defect.
  - `[low]` `[reject]` no test shows the readout lagging the draft — `share` is computed from the committed `value` prop only (`PayoutThreshold.tsx`), and the App test asserts the marker after the commit. A test-only addition with no defect.
  - `[false]` `[reject]` `draft`/`lastValid` never resync from `value` — `App`'s threshold is changed only by this component's commit and is read once at mount. No other writer exists, and Story 2.7's reset is not built.
  - `[low]` `[patch]` the ` Divine` unit is not linked to the input for screen readers — `aria-describedby` → unit span id, via Mantine `attributes` (a plain prop is overwritten). The focus-outline half is `false`: DESIGN makes the solid `rule-strong` rule the focus indicator.
  - `[maybe-false]` `[reject]` the blur clamp may call `onChange(3)` twice — even if true, two identical commits and writes are idempotent. The if-true grade is only low.
  - `[low]` `[reject]` tests wait on real timers — the full suite runs in about 12s, the 50ms margin has not flaked, and fake timers would be a test refactor, not a direct correction.
  - `[low]` `[patch]` the strip regex also matched attribute names ending in `id`/`for`, and the request count was a bare `8` — anchored as `/\s(id|for|aria-describedby)="…"/` and switched to `ARTIFACT_ORDER.length`, in the whole file.
  - `[maybe-false]` `[reject]` the caret may clip at the end of the twin-sized input — the agent-browser screenshots at `0.10` and focus show no clipping. The if-true grade is cosmetic.
  - `[false]` `[reject]` the spec is missing from the diff and there is no verification evidence — the spec is kept out of the review diff on purpose (it is the claims file), and `pnpm check`, `pnpm test` and agent-browser were run (see Auto Run Result).
  - `[low]` `[patch]` a value typed within 150ms before `pending` gives way to a failure screen is dropped: Mantine `useDebouncedCallback` cancels on unmount (verified in `@mantine/hooks` 9.6.1 source) — now `{ delay: COMMIT_DEBOUNCE_MS, flushOnUnmount: true }`. Pending→ready does not remount (same `Frame`/`Masthead` position).
  - `[maybe-false]` `[reject]` the hidden twin is sized from the raw draft while Mantine may show a padded `.00` — transient, only while a lone `.` is typed. The if-true grade is cosmetic. To settle it, compare `input.value` and the twin text after typing `.`.
  - `[false]` `[reject]` the figure drifts if `value` changes from another source — same as the resync finding. There is no other source.
  - `[low]` `[patch]` (verification-gap, pre-verified) nothing types during `pending`, so a no-op pending handler or a remount would pass — added an App test that types `0.6` behind gated artifacts, opens them before the debounce, and asserts `0.60`, storage `0.6`, and the ranked-at-0.6 grown list.
  - `[maybe-false]` `[reject]` (intent-alignment) the figure-rule states, the rule under the figure only, and the two-line dek are not asserted in jsdom — jsdom cannot render `:hover`/`:focus`/line wrap. The spec's manual agent-browser check covers them (the group measured 508px, the focused rule visible in the screenshot, the dek on two lines at 42px).
  - `[maybe-false]` `[reject]` (intent-alignment) over-max, negative, `"."` and the 8.33% marker are proved at the component, not through `App` — `App` passes the committed value straight to `rank`, and that link is proved at page level by the raise, lower and pending tests.
  - `[low]` `[reject]` (intent-alignment) `typeInto` replaces the whole string instead of typing keys — the agent-browser run typed real keys (`0.1`, `2`, `5`, `.`, `-`, the emptied field). Keystroke-level tests would need a new harness.
  - `[false]` `[reject]` (intent-alignment) the label is mixed case in the DOM — `text-transform: uppercase` renders `PAYOUT THRESHOLD` (screenshot), which is what DESIGN specifies. The DOM case is not a player-visible surface.
  - `[false]` `[reject]` (intent-alignment) the sprint-status mismatch — a duplicate of the first row, fixed there.

## Verification

**Commands:**
- `pnpm check` -- expected: typecheck, lint, depcruise clean.
- `pnpm test` -- expected: all green, no escaped-request failures.

**Manual checks:**
- `pnpm dev` in the background; agent-browser: screenshot the masthead; hover and focus the figure (rule changes); type `0.1` and `2`; reload; clear `localStorage` and reload.

## Auto Run Result

Status: done

**Summary:** The masthead's 276px slot now holds the Payout Threshold. It is a borderless Mantine `NumberInput` figure with `Divine` outside it and a non-interactive track and marker readout. `App` holds the threshold, which is read once from `localStorage` (`poe-cbpc.payoutThreshold`, guarded, falling back to 0.25). `App` passes it to `core`'s `rank` after a ~150ms debounced valid parse, and writes it on each commit. The control shows in `pending` and `ready` only. `core`, `contracts` and `vite.config.ts` are untouched.

**Files changed:**
- `packages/web/src/threshold/threshold-storage.ts` (+ test): the bounds, the key, `clampThreshold`, and the guarded read/write.
- `packages/web/src/threshold/PayoutThreshold.tsx` (+ `payout-threshold.test.tsx`): the panel, the draft/commit logic, the unit linked by `aria-describedby`, and the readout.
- `packages/web/src/test-support/threshold-input.ts`: the test helpers `typeInto`, `blur` and `pastDebounce`.
- `packages/web/src/theme/tokens.ts` (+ test): the panel padding, the 4/10/7 gaps, and the track and marker sizes.
- `packages/web/src/frame/frame.css`: the `.fg-threshold input` rule states, caret and selection.
- `packages/web/src/frame/Masthead.tsx`: the 216 + 16 + 276 = 508 control group.
- `packages/web/src/App.tsx` (+ `App.test.tsx`): the threshold state, storage wiring and re-rank. The tests cover the matrix at page level.
- `docs/stories/sprint-status.yaml`: 2-4 → `review`.

**Review findings:** 22 findings. 6 patched (all low): the sprint status, the `ReadyList` docstring, the unit `aria-describedby`, the test regex and artifact count, `flushOnUnmount`, and the pending-typing test. 0 deferred. 16 rejected, each with its reason in the Review Triage Log (7 false, 5 maybe-false with a cosmetic or low if-true grade, 4 low test-only or unlikely).

**Follow-up review recommended:** false. Patched: high 0, medium 0, low 6.

**Verification:**
- `pnpm check`: typecheck, lint and depcruise are clean.
- `pnpm test`: 72 files and 897 tests pass, after the patches.
- agent-browser (named session `poe-…`, `pnpm dev --port 5237`, stopped afterwards):
  - The masthead group measures 508px.
  - Typing `0.1` adds the Utility Belt row with 0 new resource requests. The marker is at 3.33%, and storage holds `0.1`.
  - A reload keeps `0.10` and the 3 rows.
  - The implementation run also checked hover, focus, `2`, `5`→`3.00`, `.`, empty and `-`, and cleared-storage → `0.25`.
- The matrix audit: every row has a covering test that ran. None is skipped.

**Residual risks:**
- `fixedDecimalScale` pads while typing (`5` shows `5.00` before blur). This is worth a UX look.
- A value typed less than 150ms before a reload is not persisted.
- No automated test asserts the mockup geometry or the hover and focus rule states. The browser check covered them.
- The story 2.2 deferred entry about a bare-`number` `RankInput.threshold` is now satisfied by `web`: every value reaching `rank` is clamped to a finite [0, 3]. The `deferred-work-sweep` skill owns removing it.
