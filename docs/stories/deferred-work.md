# Deferred work

Each entry names work carved out of a spec. Append new entries. Do not rewrite other entries. Remove an entry in the last commit of the branch that lands its work, or in a commit that names the decision to cancel it. `pnpm deferred:issues` opens one GitHub issue for each entry, and the `deferred-work-sweep` skill keeps its run state in that issue, not here. A human can add a `retry_when:` line to an entry as a precondition: the sweep skips the entry until the condition is true.

<!--
    Entry format, read by `pnpm deferred:issues` and `deferred-work-sweep` (tools/deferred-issues/ledger.ts).
    The parser does not skip HTML comments. Every line in here is indented, so none counts as an entry.
    A real entry sits at column 0 under a heading, with a blank line after it, like this (indent removed):

    ## Deferred from: <where it came from> (YYYY-MM-DD)

    - source_spec: `docs/stories/spec-example.md`
      summary: One line, or wrapped lines, saying what work is owed. The issue title is this text cut to 70 characters.
      evidence: Where to look and why it is true: file paths, line numbers, the review finding.
      retry_when: Optional. Story 3.7 is done in sprint-status.yaml

    Rules:
    - The bullet starts with `- source_spec:` at column 0. Every other field is indented by exactly two spaces.
    - `source_spec`, `summary` and `evidence` are required. An entry missing one of them is a note and is skipped.
    - `retry_when` is optional and human-written. Forms the sweep can check: `Story <n.n> is done in
      sprint-status.yaml`, `master has moved past <sha>`, or `never — needs a human`.
    - A field may wrap onto lines indented by two or more spaces. A blank line, a heading or a new bullet ends the entry.
    - Do not write an id. The id is `dw-` plus a hash of source_spec and summary, so editing either field
      makes a new entry and a new issue.
-->


## Deferred from: spec-epic-4-retro-item-3-small-web-fixes (2026-10-10)

- source_spec: `docs/stories/spec-epic-4-retro-item-3-small-web-fixes.md`
  summary: "[NOTE FOR UX] Rule the printed form of a negative EV in (−0.005, 0). EXPERIENCE.md *Money* says a non-zero figure that rounds to `0.00` prints `< 0.01`, and states 21 and 25 say a negative EV is dimmed. `formatDivine` prints `0.00` for such a value, and the row is now undimmed because the dim follows the printed minus sign (NFR-10). Options: an unsigned `< 0.01` (undimmed), or a signed `−< 0.01` (dimmed)."
  evidence: `packages/web/src/shared/money.ts` `formatDivine` guards only `0 < v < 0.005`; `money.test.ts` asserts `formatDivine(-0.003)` is `0.00` (Epic 3 item 5). `packages/web/src/list/display-rows.ts` `figure()`. Raised by the impeccable design review and the blind hunter on this spec. Reachable only when a Craft Cost or a net EV is below 0.005 div.
  retry_when: never — needs a human

- source_spec: `docs/stories/spec-epic-4-retro-item-3-small-web-fixes.md`
  summary: "[NOTE FOR UX] Write the R7 ruling into EXPERIENCE.md *Estimated odds* and state 12: a uniform-prior row whose EV cell is `—` (pending, broken, uncostable) carries no ≈, and its expansion context line ends at the name. Today the text says every uniform-prior row prints ≈."
  evidence: Epic 4 retro R7 and action item 3 (`docs/stories/epic-4-retro-2026-10-10.md`). The code now gates both the EV cell and the context line on `hasEstimate` in `packages/web/src/list/display-rows.ts`. EXPERIENCE.md *Provenance* row (`uniform-prior` prints ≈) and state 12 have no exception for a `—` cell.
  retry_when: never — needs a human
