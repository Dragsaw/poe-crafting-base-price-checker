---
title: 'Epic 1 retro item 13: replace compareCodeUnits in weights-ids.ts with the contracts comparator'
type: 'refactor'
created: '2026-09-26'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context:
  - '{project-root}/docs/stories/epic-1-retro-2026-09-26.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `packages/sync/src/catalogue/weights-ids.ts` keeps a private `compareCodeUnits` that compares with JS `<`, which is UTF-16 code-unit order. `compareCanonicalKeys` in `@poe/contracts` compares code points (UTF-8 byte order), and that is the order the report schema promises. The two disagree above the BMP: `"\u{10000}"` and `"￿"` sort in opposite orders (retro finding L-E1, action item 13).

**Approach:** Delete `compareCodeUnits`. Sort the `uncatalogued-weights-id` records and the `weights-absent` class names with `compareCanonicalKeys` from `@poe/contracts`. Add one test per sort that uses an astral-plane string and pins code-point order. Correct the "by code unit" doc comments so they name the shared comparator.

</frozen-after-approval>

## Implementation Notes

- `packages/sync/src/catalogue/weights-ids.ts`: deleted `compareCodeUnits`. Both sorts now use `compareCanonicalKeys` from `@poe/contracts`. The two doc comments name the comparator in place of "by code unit".
- `packages/sync/src/catalogue/weights-ids.test.ts`: added two astral-plane tests, one for each sort (U+FFFF before `'\u{10000}'`). Run against the old source, both failed. Run against the new source, both passed. The existing weights-absent test title now reads "code point".
- The `identifierKind` values (`categoryId`, `statId`) are ASCII, so the kind-first order does not change.
- Verified: `pnpm check` is clean, and `pnpm test` passes 56 files and 646 tests. The red run replaced `weights-ids.ts` with its copy at base commit `910a2c47e906f51574ae0d77fa432f478c2f513c`.
- Surprise: Serena `replace_content` turns a `\u` escape such as the one for U+FFFF in a replacement into the raw character. The tests therefore build both strings with `String.fromCodePoint` (`BMP_LAST`, `ASTRAL`).
- Sweep for other string sorts without a comparator: `fixture-port.ts:32` sorts fixture file names from `readdir`, and three test assertions sort ASCII kind names. None of these feeds report or dataset order, so none was changed.
- Retro item 13 is set to `done` in `sprint-status.yaml` in the same commit, following items 4, 8 and 9.

## Review Triage Log

- Blind Hunter: "use `compareByCodeUnit`, not `compareCanonicalKeys`". Verdict: false. `canonical-key.ts` documents `compareCanonicalKeys` as "the comparator every tie-break in the system resolves on". It is also the export the retro item names.
- Blind Hunter: raw invisible U+FFFF in the tests. Verdict: medium, patched. Serena had unescaped the U+FFFF escape. The tests now use named `String.fromCodePoint` constants.
- Blind Hunter: "its surrogate pair" in the test comment has an unclear referent. Verdict: low, patched. The comment now names U+10000.
- Blind Hunter: `craftedOf` is duplicated. Verdict: low, patched. The helper now sits once at `describe` scope.
- Blind Hunter: the astral test does not cover the `categoryId` tie-break or the kind-first order. Verdict: low, patched. The test now has astral misses of both kinds.
- Blind Hunter: the two doc comments differ and one paraphrases the owner. Verdict: low, patched. Both now cite Consistency Conventions, *Entity keys*.
- Blind Hunter: the sprint entry and the spec status are not closed, and the retro is not in `context`. Verdict: low, patched.
- Blind Hunter: no guard against another code-unit comparator. Verdict: low, rejected. A lint rule is more than a simple correction. The sweep of bare sorts is recorded above, and none of those sites feeds output order.
- Blind Hunter: the red run cannot be reproduced from the spec. Verdict: low, patched. The base commit is recorded above.

