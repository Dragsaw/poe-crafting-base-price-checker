---
title: 'Epic 4 retro item 7 deferrals: browser-check the unpriced crafted trail; fix the bad-port flake'
type: 'chore'
created: '2026-10-11'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `spec-epic-4-retro-item-7-no-priced-crafted-row-rank` left two entries in `docs/stories/deferred-work.md`. (A) Nobody saw a crafted row with no priced combination (states 18 and 41) in a browser, because the live `data/` has no such class. (B) `packages/sync/src/shell-fetch.test.ts` fails at times with `bad port`. `server.listen(0)` can draw a port on the WHATWG bad-port list, and fetch refuses that port. This machine's ephemeral range is 1024–15000 (`netsh int ipv4 show dynamicport tcp`), and the highest bad port is 10080.

**Approach:** (A) Follow the spec-2-7 precedent. Run `pnpm build`, edit the gitignored `packages/web/dist/dataset.json` so that one crafted class is pending and one is broken, with one pending Raw Base and one broken Raw Base. Serve it with `vite preview` and run the agent-browser checks. Committed `data/` does not change. (B) In `startServer`, if the drawn port is 10080 or lower, close the server and listen again. Scope decision (user, 2026-10-11): A and B ship together on one branch.

</frozen-after-approval>

## Implementation Notes

- B: the retry loop lives only in `startServer` (`shell-fetch.test.ts:17-30`). It has no other callers. Write a one-line why comment: every WHATWG bad port is 10080 or lower.
- A fixture: in `dist/dataset.json`, delete every Belts crafted entry (pending, never-synced) and set every entry of a second costable crafted class to `{"state":"unresolvable"}` (broken). Set one raw entry to `no-listings` and one to `unresolvable`. If a chosen class is not costable (its row shows the uncostable state 35), pick another class. Serve with `pnpm exec vite preview --config packages/web/vite.config.ts --port 4173`.
- **Agent browser checks:** (named session, `--session <id>` on each call; preview server stopped at the end)
  1. The pending crafted row has no numeral, tier 3, EV `—` and the ○ cue. The broken crafted row is the same, with ✕.
  2. Both rows sit below every numbered row. Ranks 1..n are contiguous.
  3. The trail order is pending crafted, pending raw, broken crafted, broken raw.
  4. The unfiltered page shows no console error.
- Last commit: remove both entries under `## Deferred from: spec-epic-4-retro-item-7-no-priced-crafted-row-rank review (2026-10-10)` and the empty heading.
- B as built: `no-await-in-loop` and `unicorn/no-useless-recursion` forbid the two plain retries, so the loop carries a described `eslint-disable` block, as `packages/sync/src/sync/session-wait.ts` does. The bound is `HIGHEST_BAD_PORT = 10_080`. Serena left the file CRLF in the working copy (the existing spec-retro-4-2 ledger entry); it was normalised to LF before commit.
- A as built: after `pnpm build`, a scratch node script rewrites `packages/web/dist/dataset.json`. Both classes are costable under `greater`. `pnpm check` rebuilds `dist/`, which removes the fixture. The edit, to re-run it:
  ```js
  const cls = (e) => JSON.parse(e.entryKey)[2];
  const raws = d.entries.filter((e) => e.entryKey.startsWith('["raw"'));
  d.entries = d.entries.filter((e) => cls(e) !== 'Belts');           // pending crafted
  for (const e of d.entries) if (cls(e) === 'Sceptres') e.price = { state: 'unresolvable' };
  raws[0].price = { state: 'no-listings' };                          // Gold Amulet
  raws[1].price = { state: 'unresolvable' };                         // Solar Amulet
  ```
- Neither removed ledger entry had a GitHub issue (`gh issue list --state all` is empty), so no issue needs closing.

### Agent browser checks (before review, superseded)

Session `poe-79ae64f4395d`, `vite preview` on 4173, 2026-10-11 17:36. All four checks pass: ranks 1..12 contiguous; Belts `— ○`, Gold Amulet `— ○`, Sceptres `— ✕`, Solar Amulet `— ✕`, each unnumbered with `data-tier="3"`, in that order; no console error.

### Agent browser checks (after review)

Session `poe-79ae64f4395d`, `vite preview` on port 4173 over the fixture above, run 2026-10-11 17:40 local, against `git rev-parse HEAD` = `969f57e308e5f2de9ba07a0c59a69a49d31054d5`, tree dirty (this branch's uncommitted change, after the last review fix). Screenshot: `C:/Users/ilyal/AppData/Local/Temp/claude/E--Program-Files-Jetbrains-Projects-poe-crafting-base-price-checker/af7e203c-7ee3-409a-a440-597e2a034b76/scratchpad/unpriced-trail-after-review.png`.
1. Pass: in the EV column, Belts reads `—` with ○ and Sceptres reads `—` with ✕. Both rows have no numeral and `data-tier="3"`.
2. Pass: both rows sit below rank 12 (Emerald). Ranks 1..12 are contiguous.
3. Pass: the order is Belts, Gold Amulet (`— ○`), Sceptres, Solar Amulet (`— ✕`).
4. Pass: on the unfiltered page (recipe `greater`, default threshold), `console` and `errors` are both empty.
Gate: `pnpm check` 8/8 passed after the last fix; `vitest run src/shell-fetch.test.ts` 6/6. `pnpm dev:stop --port 4173` freed the port.

## Review Triage Log

- Blind Hunter 1 (unbounded retry loop) — low, rejected: a host whose whole ephemeral range sits at or below 10080 is rare, and Vitest's timeout still fails the test loudly; a cap adds a guard and an error path.
- Blind Hunter 2 (CRLF in the working copy) — low, patched: `git ls-files --eol` showed `w/crlf`; normalised to LF. The existing spec-retro-4-2 entry covers the root cause.
- Blind Hunter 3 (non-ASCII `≤` in the comment) — low, patched to `<=`.
- Blind Hunter 4 (ephemeral-range clause in the comment) — false: the clause is the non-obvious half of the why, since without it `listen(0)` never draws a bad port.
- Blind Hunter 5 (precedent path `sync/session-wait.ts`) — low, patched to the full path; the disable-block placement is a style difference with no named harm.
- Blind Hunter 6 (no deterministic test of the guard) — low, rejected: the guard is a three-line test helper; a stub of `server.listen` would test the test.
- Blind Hunter 7 (GitHub issues of the removed entries) — low, patched: the notes record that no issue existed.
- Blind Hunter 8 (fixture not reproducible) — low, patched: the notes quote the fixture edit.
- Blind Hunter 9 (browser record does not name each check) — low, patched in the after-review record.
- Blind Hunter 10 (Verification has no results) — low, patched: the record states the gate results.
- Blind Hunter 11 (ledger removal not in the last commit) — false: the branch lands as one commit that also lands the work, which the AGENTS.md rule allows.
- Deferred Ledger Auditor — zero findings: the spec carves out no work.

## Verification

**Commands:**
- `pnpm check` -- expected: passes, with no network call.
- `pnpm --filter sync exec vitest run src/shell-fetch.test.ts` -- expected: passes.
