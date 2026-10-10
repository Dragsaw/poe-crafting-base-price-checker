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


## Deferred from: spec-retro-4-2 review (2026-10-10)

- source_spec: `docs/stories/spec-retro-4-2-state-23-verdict-and-recipeless-order.md`
  summary: Guard against CRLF in edited files: Serena `replace_content` writes CRLF on Windows, so add a CR check to lint-on-edit or a Known pitfalls line in AGENTS.md.
  evidence: Every Serena edit on this branch left CRLF in the working copy despite `.gitattributes` `eol=lf`; `packages/web/src/list/display-rows.test.ts`'s raw-source scan of `summands` uses then failed on a trailing `\r` until the files were normalised (Blind Hunter finding).

## Deferred from: epic 4 retro item 5 (2026-10-10)

- source_spec: `docs/stories/spec-epic-4-retro-item-5-owner-doc-hygiene.md`
  summary: UX rules on the failure paths of UJ-3, UJ-4 and UJ-5 and writes the ruling into EXPERIENCE.md.
  evidence: EXPERIENCE.md Foundation *Known gaps* and Coverage Self-Check list them as unruled, owner UX (UX memlog 279, 288); epic-4-retro-2026-10-10.md finding S-Gaps. Nobody raised them during Epic 4.
  retry_when: never — needs a human

- source_spec: `docs/stories/spec-epic-4-retro-item-5-owner-doc-hygiene.md`
  summary: UX rules on the list show-more affordance when the ranked list has 20 rows or fewer, and writes the ruling into EXPERIENCE.md.
  evidence: EXPERIENCE.md Foundation *Known gaps* lists it as unruled, owner UX (UX memlog 279, 288); Interaction 4 and state 33 cover only a list past 20 rows; epic-4-retro-2026-10-10.md finding S-Gaps.
  retry_when: never — needs a human

- source_spec: `docs/stories/spec-epic-4-retro-item-5-owner-doc-hygiene.md`
  summary: UX reconciles the EXPERIENCE.md Coverage Self-Check failure-path sentence with *Known gaps*, ruling whether UJ-6 has a failure path.
  evidence: EXPERIENCE.md Coverage Self-Check says failure paths other than UJ-1 and UJ-2 are known gaps, which covers UJ-6, but *Known gaps* lists only UJ-3 to UJ-5 (memlog 279). Pre-existing; review finding 10 of this spec.
  retry_when: never — needs a human

## Deferred from: UX ruling on spec-epic-4-retro-item-3-small-web-fixes R8 (2026-10-10)

- source_spec: `docs/stories/spec-epic-4-retro-item-3-small-web-fixes.md`
  summary: Print a negative EV or price in (−0.005, 0) as `< 0.00`, dimmed, per EXPERIENCE.md *Money* and state 21 (UX memlog 289). Today it prints `0.00`, undimmed.
  evidence: `packages/web/src/shared/money.ts` `formatDivine` guards only `0 < v < 0.005`, and `money.test.ts` asserts `formatDivine(-0.003)` is `0.00`. `packages/web/src/list/display-rows.ts` `figure()` derives `negative` from the U+2212 sign, so it must also dim `< 0.00`. EXPERIENCE.md revision 28.
