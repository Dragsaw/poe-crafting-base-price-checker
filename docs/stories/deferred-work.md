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

## Deferred from: review of spec-remove-ilvl-from-recipe-searches (2026-10-09)

- source_spec: `docs/stories/spec-remove-ilvl-from-recipe-searches.md`
  summary: [NOTE FOR PM] Update the PRD rule that a crafted price and its probability share one population scoped to the Item Level Floor. The crafted search no longer sends an item-level filter.
  evidence: `prd.md:135` says "both are scoped to the Tracked Entry's Item Level Floor (AD-17, FR-16)". After this spec, the crafted search body has no `ilvl` filter (`packages/sync/src/pricing/search-body.ts`, AD-16 row `type_filters.ilvl`), so listings below the floor enter the crafted price. Adjacent tiers overlap on 53 of 63 classes (spine OQ-21), so the bands do not exclude them. The user kept the change as built and handed the PRD update to the PM (review triage log, rows 1-6, of the source spec).
  retry_when: never — needs a human
