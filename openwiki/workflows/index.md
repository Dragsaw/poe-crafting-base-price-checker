# Files

- [Deferred work as GitHub issues](deferred-work-issues.md) - How carved-out work is recorded in docs/stories/deferred-work.md, how pnpm deferred:issues gives each ledger entry a content id and one GitHub issue labelled deferred, how the unattended deferred-work-sweep skill claims an issue with a claim ref and delivers a PR or a sweep-attempt comment, and which test keeps the ledger parseable.
- [Operator commands and curation workflow](operator-commands.md) - The human-invoked pnpm commands — sync, sync:dry, fixtures:record, catalogue:refresh, tracked:lookup, tracked:check and dev:stop — what each reads, writes and sends, their exit codes, the POE_SYNC_USER_AGENT requirement, and the lookup-edit-check loop for curating data/tracked.json.
