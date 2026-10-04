---
title: 'poesessid retro item 4: base64 needles at every alignment and the probe-429 notBefore assertion'
type: 'chore'
created: '2026-10-04'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** This is action item 4 of `docs/specs/spec-poesessid-sync/RETROSPECTIVE.md`, which covers findings V3 and V6.
- V3: the CAP-4 canary in `packages/sync/src/session-auth.canary.test.ts` builds its base64 needles from each 8-byte window of the canary, encoded alone. The encoding of a window inside a longer value depends on the window's byte alignment and on the bytes that follow it. The scan therefore catches a base64 leak only when the canary's characters happen to line up. The SPEC wording is "any 8+ character substring … base64".
- V6: the test "a probe 429: no line, notBefore persisted, and the next chunk probes again" in `packages/sync/src/sync.test.ts` never reads `sync-progress.json`. Its name claims an assertion that it does not make.

**Approach:**
- Build the base64 and base64url needles for each window at all three byte alignments. Keep only the characters that depend on the window bytes alone. Extend the self-check so that a base64 copy of the canary at offsets 0, 1 and 2 is caught.
- Keep the test name and add the assertion: read `notBefore` from `PROGRESS_PATH` as the first chunk wrote it, and check that it is the instant the session then waits until.

</frozen-after-approval>

## Implementation Notes

- V3, measured: the old needles were the full 11-character encodings of each 8-byte window. Their last characters depend on the bytes that follow the window. Across every 8-character slice of the canary, with prefix `''`, `'x'` or `'xy'` and a byte after it, in base64 and base64url, the old needles missed 116 leaks. Whole groups at alignment 0 only miss 6, all at windows 27–28: a long leak always holds a group that starts some canary window, and that fails only near the canary's end. All three alignments miss 0.
- `alignedBase64` in the canary encodes, for each window and each lead byte 0–2, only the whole 3-byte groups that start there. These are the characters a leak at any position contains. It is written independently of production `formsOf` (`trade/session-auth.ts`), so the scan does not share a bug with the code under test.
- The self-check `every 8 characters of the canary, base64 behind %j …` runs that exhaustive grid and lists every miss. The grid covers each 8-character slice, prefixes `''`/`'x'`/`'xy'`, the slice at the end of the value or before `!`, and base64 and base64url. Mutation: change the loop bound `lead < 3` to `lead < 1` in `alignedBase64`, and two of its three cases fail on windows 27–28. The 116/6/0 counts came from a one-off `node -e` script over the same grid, with the old needle construction (`toString('base64').replace(/=+$/, '')` and `toString('base64url')` of each whole window) in place of `alignedBase64`.
- A base64 needle covers 6 window bytes (two whole groups), so the base64 scan flags a shorter copy than the raw scan, which needs 8. That is stricter than the CAP-4 wording, not weaker. Windows of 10 characters would miss an exact 8-character leak at lead 1 or 2.
- Each base64 form is also added URL-encoded, because base64 carries `+` and `/`. The current canary yields neither character, but a later canary could.
- V6: the test keeps its name and now asserts it. A wrapped `sleep` records, at the session's first wait only, the `notBefore` in `PROGRESS_PATH` and the instant the wait ends. Both must equal `2026-09-26T12:01:00.000Z`, which is the probe at `NOW` plus `retry-after: 60`. Mutation: with `retry-after: '30'` the test fails.
- Files: `packages/sync/src/session-auth.canary.test.ts` and `packages/sync/src/sync.test.ts`. Production code is unchanged.
- Verified: `pnpm check` exits 0. `pnpm test` passes 1999 tests in 117 files.

## Review Triage Log

Layers: Blind Hunter, Deferred Ledger Auditor (no findings: the spec defers no work).

- The V6 check was circular: the printed line comes from the same `notBefore`, so a wrong instant passed. **medium, patched**. The instant is now pinned.
- The test never checked the sleep itself: **low, patched**. The end of the first wait is recorded and pinned.
- The `persisted === undefined` guard read at every sleep, not at the first: **low, patched**. It now records only the first wait, `undefined` included.
- No check that the second chunk clears `notBefore`: **low, rejected**. The name claims "probes again", which the cookie sequence asserts. Clearing is not in V6.
- The base64 needles are stricter than raw (6 bytes), and windows of 10 characters were suggested: **low, rejected (noted)**. A stricter leak scan is not a defect. Windows of 10 characters would miss an exact 8-character leak at leads 1–2. The note above records the rule.
- The grid covered only a trailing `!`, not the end of a value: **low, patched**. A suffix of `''` was added.
- The `CANARY.slice(0, 9)` self-check is now redundant: **low, rejected**. It is harmless and pins the old offset-0 case.
- URL-encoded base64 was never in the needles, and the current canary hides that: **low, patched**. One `encodeURIComponent(form)` was added for each base64 form.
- Frontmatter `status: in-progress`, `context: []`: **false**. The workflow sets `done` at finalize. The intent cites the retro.
- The mutation numbers could not be reproduced: **low, patched**. The method is recorded above.
