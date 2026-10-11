# Deferred work

Each entry names work carved out of a spec. Append new entries. Do not rewrite other entries. Remove an entry in the last commit of the branch that lands its work, or in a commit that names the decision to cancel it. `pnpm deferred:issues` opens one GitHub issue for each entry, and the `deferred-work-sweep` skill keeps its run state in that issue, not here. An entry can carry a `retry_when:` line as a precondition: the sweep skips the entry until the condition is true. A `retry_when` is absent or one of the three forms that the sweep can test, never a future planning event (epic 4 retro L2). `tools/deferred-issues/ledger-rules.test.ts` checks each entry.

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
    - `retry_when` is optional. When present, it is one of the forms the sweep can check: `Story <n.n> is done in
      sprint-status.yaml` (a story that sprint-status.yaml lists), `master has moved past <sha>`, or
      `never — needs a human`. Never tie an entry to a future planning event (epic 4 retro L2).
    - A field may wrap onto lines indented by two or more spaces. A blank line, a heading or a new bullet ends the entry.
    - Do not write an id. The id is `dw-` plus a hash of source_spec and summary, so editing either field
      makes a new entry and a new issue.
-->


## Deferred from: spec-retro-4-2 review (2026-10-10)

- source_spec: `docs/stories/spec-retro-4-2-state-23-verdict-and-recipeless-order.md`
  summary: Guard against CRLF in edited files: Serena `replace_content` writes CRLF on Windows, so add a CR check to lint-on-edit or a Known pitfalls line in AGENTS.md.
  evidence: Every Serena edit on this branch left CRLF in the working copy despite `.gitattributes` `eol=lf`; `packages/web/src/list/display-rows.test.ts`'s raw-source scan of `summands` uses then failed on a trailing `\r` until the files were normalised (Blind Hunter finding).

## Deferred from: spec-epic-4-retro-item-7-no-priced-crafted-row-rank review (2026-10-10)

- source_spec: `docs/stories/spec-epic-4-retro-item-7-no-priced-crafted-row-rank.md`
  summary: Check in agent-browser that a crafted row with no priced combination (states 18 and 41) shows no numeral, tier 3 and EV `—`, and trails every ranked row in the state 18 trail order, on data that holds such a class.
  evidence: The live `data/` set on `pnpm dev` holds no unpriced crafted class (16 rows, ranks 1..16 contiguous), so the trailing row was checked only through `packages/web/src/recipe/craft-recipe/crafted-states.test.tsx` (Deferred Ledger Auditor; Blind Hunter). Needs a dev fixture world or a sync that leaves a crafted class unpriced.

- source_spec: `docs/stories/spec-epic-4-retro-item-7-no-priced-crafted-row-rank.md`
  summary: Make the sync loopback fetch test immune to undici's bad-port block: `server.listen(0)` can draw a port on the WHATWG bad-port list, and fetch then fails with "bad port".
  evidence: `pnpm check` failed once on 2026-10-10 in `packages/sync/src/shell-fetch.test.ts` "round-trips the method, headers and body…" with `TypeError: fetch failed` / `Caused by: Error: bad port`; three isolated re-runs and the next full gate passed. The branch changes nothing under `packages/sync`. The port comes from `server.listen(0, '127.0.0.1')` at `shell-fetch.test.ts:25`.
