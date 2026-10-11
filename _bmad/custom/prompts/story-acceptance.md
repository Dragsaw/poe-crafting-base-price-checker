# Story acceptance

1. **What accepting does.** In `docs/stories/sprint-status.yaml`, set `development_status[{story_key}]` to `done` and update `last_updated`. Preserve comments and structure.
2. **The epic key.** The story key starts with its epic number N (`N-<n>-…`). When every key of `development_status` that starts with `N-` now reads `done`, set `epic-N` to `done` in the same edit. Do not change `epic-N-retrospective`. Never set an epic key back from `done`.
3. **The commit.** Commit only `docs/stories/sprint-status.yaml`, with the message `docs(stories): accept {story_key}`. When rule 2 closed the epic, add a body line `Closes epic-N.`
4. **Who accepts.** bmad-build asks the human. bmad-build-auto accepts on its own when its run ends `done` (AGENT-WORKFLOW.md, *Story acceptance*).
