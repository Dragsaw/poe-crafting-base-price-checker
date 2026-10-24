# Frozen data fixtures

A verbatim snapshot of `data/` at commit 9be103bd4f676c757230ee3b33925d57a8f42cf6, except `weights.json`, which keeps only the base classes that `tracked.json` references. Data-dependent tests in `pnpm test` read these files, not `data/`. Sync never regenerates them, and tests never write to them. Invariants of the live `data/` run in the `data` project (`pnpm test:data`).

One change to the snapshot: `weights.json` declares `schemaVersion` `7.0.0`, and every entry carries empty `addsTags` and `blockedByTags`. Empty arrays mean the `6.1.0` semantics, so each value the file gives is unchanged.
