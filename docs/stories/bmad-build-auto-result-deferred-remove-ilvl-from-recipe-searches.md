---
status: blocked
---

# BMad Build Auto Result

Status: blocked
Blocking condition: Dropping `ilvl` from the crafted-base search body in `packages/sync/src/pricing/search-body.ts` changes the request digest of the 3 crafted entries in `fixtures/tracked.json`, so their `fixtures/trade-search-*.json` and `trade-fetch-*.json` captures no longer match and `pnpm sync:dry` and the fixture-backed tests lose their answers; fixtures/README.md and AGENT-WORKFLOW.md allow only a human to run `pnpm fixtures:record` (live trade API), and a hand-renamed fixture is forbidden. Human must decide to re-record, and also confirm the ledger evidence's line 170 (the raw arm, which keeps `ilvl` 82 for white bases) is not meant to change.
