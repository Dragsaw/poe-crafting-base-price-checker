---
title: 'Epic 2 retro item 22: carry a refusal cause to the failure screen'
type: 'bugfix'
created: '2026-09-27'
status: 'done'
baseline_revision: '5fb836a30832812b83b0efbdbaf35dc2a428623b'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/docs/stories/epic-2-retro-2026-09-27.md'
warnings: []
deferred:
  - summary: >-
      For a required 404 the refusal screen's title still reads "A published file does not match its schema." while the new body says "It was not published"; the title (and EXPERIENCE.md state 26's "Schema-invalid artifact" label) needs a UX ruling for the missing cause.
    evidence: |-
      Pre-existing: a required 404 has reached the refusal screen with this title since spec 2.1 (triage #9, accepted deviation, deferred-work.md "Record the accepted deviations" entry). This change makes the contradiction visible in the body sentence. Title copy is UX-owned (DESIGN.md refusal-screen.titleText), and the spec kept it on purpose.
    location: >-
      packages/web/src/frame/FailureScreen.tsx REFUSAL_TITLE; DESIGN.md components.refusal-screen.titleText
    severity: medium
---

<intent-contract>

## Intent

**Problem:** The refusal screen prints "It declares schema version X; the page expects Y" for every refusal (retro F10, action 5, sprint-status `epic-2-retro-item-22-…`). A content failure therefore reads "declares 1.0.0; the page expects 1.0.0", and a missing required file reads "declares none".

**Approach:** The loader's `refused` outcome carries a `cause` of `'version' | 'content' | 'missing'`. The refusal screen prints one body sentence per cause. The eyebrow, title, unresolvable mark and recovery sentence stay as they are.

## Boundaries & Constraints

**Always:** Keep the `refused` outcome's `path`, `declared` and `expected` fields. Keep the precedence and AD-24 order in `classify`. Name the artifact beside the `× unresolvable` mark for every cause. Record the per-cause copy in the UX owner doc (DESIGN.md `refusal-screen`), and let EXPERIENCE.md cite it.

**Never:** No change to `@poe/contracts` or `parseEnvelope`. No retry on the refusal screen. No change to the fetch-failure screen. No new fetch or artifact.

## I/O & Edge-Case Matrix

| Scenario | Input / State | `cause` | Body sentence after "`<path>` × unresolvable." |
|---|---|---|---|
| Unknown major | dataset declares `2.0.0` | `version` | "It declares schema version 2.0.0; the page expects 1.0.0." |
| Malformed version string | declares `"abc"` | `version` | "It declares schema version abc; the page expects 1.0.0." |
| No or non-string `schemaVersion` | valid JSON, no string version | `version` | "It declares no schema version; the page expects 1.0.0." |
| Shape failure at the right major | tracked `{schemaVersion:'1.0.0', entries:42}`; dataset with a repeated entryKey | `content` | "Its content does not match the schema the page expects, version 1.0.0." |
| Not JSON | 200 with an HTML body | `content` | same content sentence |
| Required absent | tracked 404 | `missing` | "It was not published, and the page cannot render without it." |

</intent-contract>

## Code Map

- `packages/web/src/load/load-artifacts.ts` -- `LoadOutcome` (refused arm), `Fetched` (`invalid` arm), `fetchOne` (JSON-parse failure → content; `parseEnvelope` failure → version or content), `classify` (required-absent → missing). `parseEnvelope` returns `reason: 'unknown-major' | 'malformed-version'` for a version fault. It returns `reason: 'invalid'` for both a failed version probe and a failed shape parse. Split these with `declaredVersion(data) === NO_DECLARED_VERSION`: a failed probe means that no string version was declared.
- `packages/contracts/src/envelopes.ts:239` -- `parseEnvelope`. Read only.
- `packages/web/src/frame/FailureScreen.tsx` -- `FailureScreenProperties` refused arm; body `<p>` at lines 46-55. Keep the `data-artifact`, `data-declared` and `data-expected` spans where the sentence names those values.
- `packages/web/src/App.tsx:94` -- passes the refused view's fields to `FailureScreen`. `ViewState` reuses `LoadOutcome`, so the new field flows through.
- `packages/web/src/load/load-artifacts.test.ts:72-190` -- loader matrix. Its `toEqual` refusals need `cause`.
- `packages/web/src/App.test.tsx:158-262` -- screen matrix: invalid tracked, dataset 2.0.0, config with no version, tracked 404, HTML body.
- `docs/ux-designs/ux-poe-crafting-base-price-checker-2026-09-13/DESIGN.md:774-785` (frontmatter `refusal-screen.names`) and `:2367` (prose) -- the copy owner.
- `docs/ux-designs/ux-poe-crafting-base-price-checker-2026-09-13/EXPERIENCE.md:536,852` -- the state 26 treatment. It says the screen names the declared version. Change it to cite the DESIGN.md per-cause body.

## Tasks & Acceptance

**Execution:**
- `packages/web/src/load/load-artifacts.ts` -- export `RefusalCause`. Add `cause` to the refused outcome and to `Fetched.invalid`. Set it per the matrix. Update the docblocks.
- `packages/web/src/frame/FailureScreen.tsx` -- add `cause` to the refused props. Render the per-cause body sentence. Export the sentences' fixed parts as constants so that tests do not copy the strings.
- `packages/web/src/App.tsx` -- pass `cause={view.cause}`.
- `packages/web/src/load/load-artifacts.test.ts` -- assert `cause` in each refusal case. Add a malformed-version case (`"abc"`) → `version`.
- `packages/web/src/App.test.tsx` -- assert the per-cause body for each matrix row. The content case must not contain "declares". The missing case must not contain "schema version". The no-version case reads "declares no schema version".
- `docs/ux-designs/.../DESIGN.md` and `EXPERIENCE.md` -- record the three causes and their sentences in DESIGN.md `refusal-screen`. Point EXPERIENCE.md rows 536 and 852 at it. Do not copy the sentences.

**Acceptance Criteria:**
- Given a published `tracked.json` at schema version 1.0.0 whose body fails its schema, when the page loads, then the refusal screen names `tracked.json`, says that its content does not match the schema the page expects, and prints no "declares … expects" sentence.
- Given a required artifact that returns 404, when the page loads, then the refusal screen says that the file was not published and the page cannot render without it.
- Given a dataset that declares 2.0.0, when the page loads, then the screen still reads "It declares schema version 2.0.0; the page expects 1.0.0."
- Given any refusal, when the screen renders, then the eyebrow, title, `× unresolvable` mark and recovery sentence are unchanged, and no retry button appears.

## Spec Change Log

### 2026-09-27 — sentinel replaced by declared: null

- Commit `8a47e24` replaced the `NO_DECLARED_VERSION = 'none'` sentinel with `declared: string | null` in `Fetched.invalid` and the `refused` outcome of `LoadOutcome`, and in `FailureScreenProperties`. `declaredVersion` returns `null` where the file declares no string version. A declared string, `"none"` included, is kept as declared.
- The loader now splits a `reason: 'invalid'` result with `declared === null`: `null` gives `cause: 'version'`, and a string gives `cause: 'content'`.
- These passages describe the superseded design. They stay as written, and this entry is the record of the change:
  - The Code Map `load-artifacts.ts` predicate "Split these with `declaredVersion(data) === NO_DECLARED_VERSION`".
  - The sentinel `reject` rows of the first triage pass (the verification-gap row, the edge-case "Same sentinel collision" row and the blind "Sentinel collision" row) and its blind "loader tests leave gaps" row, which names `"none"`.
  - The sentinel rows of the second triage pass: the `schemaVersion: "none"` `low` row and the `false` "declares none … non-string one" test-title row.
  - The Auto Run Result's "sentinel \"none\" (3 rows)".
- The review of `78db4da..ec38dce` reopened the collision, and `8a47e24` fixed it, so the sentinel reject verdicts above no longer hold for `"none"`. The second pass's rejection of the non-string `schemaVersion` row still stands.
- Regression tests: `load-artifacts.test.ts` "keeps a declared \"none\" as a declared malformed version" and `App.test.tsx` "refuses dataset.json declaring \"none\" by naming it, not as declaring no version".

## Review Triage Log

### 2026-09-27 — Review pass
- verdicts: 21 findings — high 0, medium 3, low 13, false 5, maybe-false 0
- findings:
  - `low` `reject` (verification-gap) A literal `"schemaVersion": "none"` collides with the `NO_DECLARED_VERSION` sentinel, so the screen prints "declares no schema version". — Real, but no publisher writes "none". The fix needs a new field or discriminant, not a direct correction.
  - `low` `reject` (edge-case) Same sentinel collision. — Same as the row above.
  - `low` `reject` (edge-case) An empty-string `schemaVersion` prints "declares schema version ; …". — Real, but no tool writes an empty version. The fix adds a branch.
  - `false` `reject` (edge-case) A non-object JSON body gets the version sentence, not content. — The sentence "It declares no schema version" is true of `[]`, `42` or `null`, and the spec's matrix row "No or non-string `schemaVersion`" rules this case.
  - `false` `reject` (edge-case) The tests copy literal strings although the constants exist. — The AC requires the literal version sentence, and the spec's task list mandates the `declares` and `schema version` negatives.
  - `low` `patch` (edge-case) The `FailureScreen.tsx` constants' docblock cites `refusal-screen.names`. — Changed to `refusal-screen.bodyByCause`.
  - `medium` `defer` (intent-alignment) For a 404, the title "A published file does not match its schema." contradicts the body "It was not published". — Pre-existing: a required 404 has reached this title since spec 2.1 (triage #9). The title is UX-owned. Deferred to the frontmatter and deferred-work.md.
  - `false` `reject` (intent-alignment) The no-version case going to `version` is the diff's own ruling. — The spec's I/O matrix rules it explicitly, so this is not a defect.
  - `low` `reject` (intent-alignment) The fix is proven in jsdom, not in a browser. — `App.test.tsx` mounts the real App and loader through MSW and asserts the rendered text. The change is to copy only, with no layout change.
  - `medium` `defer` (blind) The title, and the recovery framing, contradict the missing body. — Grouped with the intent-alignment title row. Same root cause, same deferral.
  - `low` `reject` (blind) Sentinel collision. — Same as the first row.
  - `low` `reject` (blind) The content sentence drops a declared same-major, different minor, such as `1.3.0`. — Real diagnostic loss, but rare, and the player cannot act on it. The fix adds a branch.
  - `low` `reject` (blind) An HTML 200 is usually an SPA fallback for a missing file, not a content fault. — GitHub Pages answers 404 for a missing file. The spec's matrix records the not-JSON → content choice.
  - `low` `patch` (blind) Stale `names` citation. — Same fix as the edge-case row.
  - `false` `reject` (blind) The props type allows impossible states (`declared` on `missing`). — No bad outcome: the renderer ignores the field for those causes, and the spec keeps the fields on purpose.
  - `medium` `defer` (blind) The label of EXPERIENCE.md state 26, "Schema-invalid artifact", is not widened for a required 404. — Same root cause as the title rows (the pre-existing 404-to-refusal deviation, which UX owns). Grouped into the same deferral.
  - `false` `reject` (blind) The tests copy strings, and `not.toContain('declares')` is weak. — Each content case also asserts the exact sentence with `toBe`, so any extra declared text fails.
  - `low` `reject` (blind) `refusalBody` takes the first `section p`, which is fragile. — Test-only, with no present harm. Adding a hook adds surface.
  - `low` `reject` (blind) The loader tests leave gaps (non-object, "none", different minor). — Each case is covered by a rejected row above.
  - `low` `patch` (blind) `sprint-status.yaml` still reads `open`, there is no browser check, and the spec cites line numbers. — `sprint-status.yaml` is set to `done` at finalize. The browser check is rejected as in the intent-alignment row. The line anchors would be a spec edit, which the review rules reject.
  - `low` `patch` (blind) `DESIGN.md` `bodyByCause` restates the loader's classification predicate. — Deleted the three "Cause: …" clauses. The predicate now lives only in the `RefusalCause` docblock.

### Review Findings

Code review 2026-09-27 of `78db4da..ec38dce`, chunk `packages/web` (see the item 18 spec for the merge-integrity result).

- [x] [Review][Patch] The version/content split tests `result.reason !== 'invalid'`. A reason added to `EnvelopeResult` later becomes `cause: 'version'` with no compiler signal. Switch on `result.reason` with a `never` default, as `envelopes.ts` does. [packages/web/src/load/load-artifacts.ts:116]
- Rejected:
  - `low` (edge+verification-gap+blind) A literal `schemaVersion: "none"` prints "declares no schema version". It is rare, and the first review rejected it. The fix re-types the sentinel through `LoadOutcome` and the screen.
  - `low` (verification-gap+blind) A non-object JSON body (`[]`, `42`) gets the version cause. "It declares no schema version" is true of it, and the first review rejected it.
  - `low` (blind) A non-string `schemaVersion` reads "declares no schema version". It is rare, and it needs a new UX sentence.
  - `low` (blind) Make `refused` a union keyed on `cause`. This is type churn across the loader and the screen, and no caller shows a wrong value.
  - `low` (blind) The title says "required" for an invalid optional file. UX memlog 220 ruled the title cause-neutral for every refusal, and an optional file that is present but invalid still blocks the render.
  - `low` (blind) `refusalBody` reads the first `section p`. The first review rejected it.
  - `false` (blind) The test title "declares none … non-string one" is stale. The test still asserts `declared: 'none'`, which is what its title names.

## Verification

**Commands:**
- `pnpm test` -- expected: all pass (the web package has no test script of its own)
- `pnpm check` -- expected: exit 0

## Auto Run Result

Status: done

Accepted by the human on 2026-09-27.

**Summary:**
- The loader's `refused` outcome now carries `cause: 'version' | 'content' | 'missing'`.
- The refusal screen prints one body sentence per cause, so a content failure no longer reads "declares 1.0.0; the page expects 1.0.0" (retro F10).
- The eyebrow, title, mark and recovery sentence are unchanged.

**Files changed:**
- `packages/web/src/load/load-artifacts.ts`: `RefusalCause`, and the cause is set in `fetchOne` and `classify`.
- `packages/web/src/frame/FailureScreen.tsx`: `RefusalCauseSentence` and the exported sentence constants.
- `packages/web/src/App.tsx`: passes `cause`.
- `packages/web/src/load/load-artifacts.test.ts`: asserts `cause` in every refusal case, plus a malformed-version case.
- `packages/web/src/App.test.tsx`: asserts the per-cause sentence for every matrix row, plus repeated-entryKey and malformed-version cases.
- `docs/ux-designs/.../DESIGN.md`: `refusal-screen.names` and `bodyByCause`, and the prose.
- `docs/ux-designs/.../EXPERIENCE.md`: the component row and state 26 cite `bodyByCause`.
- `docs/stories/sprint-status.yaml`: item 22 is `done`.
- `docs/stories/deferred-work.md`: one entry for the deferred title ruling.

**Review:**
- 21 findings.
- Patches applied: 4 (all `low`). These are the docblock citation (reported twice), the removal of the mechanism from DESIGN.md, and the sprint-status bookkeeping.
- Deferred: 1 entry, `medium`, from three grouped rows. The refusal title contradicts the missing cause, and it needs a UX ruling.
- Rejected: 9 `low` rows. These are the sentinel "none" (3 rows), the empty-string version, the different minor, the HTML 200, the jsdom-only proof (2 rows) and the fragile helper. The Review Triage Log gives the reason for each. The loader test gaps fold into these rows.
- `false`: 5.

**Follow-up review:** `false`. No `high` or `medium` findings were patched.

**Verification:**
- `pnpm test`: 88 files, 1158 tests passed, before and after the patches.
- `pnpm check`: exit 0.
- Matrix audit: every I/O row has a loader test and a screen test that ran and passed.

**Residual risks:**
- For a required 404 the title still says the file does not match its schema (deferred).
- The implementer saw one unexplained full-suite failure. Every later run, three in all, passed.
- There was no agent-browser check.
