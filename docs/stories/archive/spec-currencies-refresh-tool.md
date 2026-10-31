---
title: 'pnpm currencies:refresh — rewrite data/currencies.json from poe2scout current prices'
type: 'feature'
created: '2026-10-11'
status: 'done'
baseline_commit: 'ff8ddad92774241e0bd478c4d5f1b74abe600332'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/docs/architecture/architecture-poe-crafting-base-price-checker-2026-09-12/AGENT-WORKFLOW.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `data/currencies.json` rates (AD-20) are typed by hand from the in-game exchange, so they go stale and refreshing them is tedious.

**Approach:** A human-invoked `pnpm currencies:refresh` command fetches poe2scout's currency category for the active league, converts each item's `CurrentPrice` (denominated in exalted) to divine per unit, and rewrites `data/currencies.json`. The player reviews the result as a git diff. Only the current price is used; price history is ignored.

**Decision (scope):** A run refreshes only the ids already in `data/currencies.json`. Currencies in the response that the file does not hold are ignored. A new currency enters the file by hand once; later runs refresh it.

## Boundaries & Constraints

**Always:**
- Endpoint: `https://api.poe2scout.com/poe2/Leagues/{slug}/Currencies/ByCategory?Category=currency&Page={n}&PerPage=100`. `{slug}` is `config.json`'s `league` lowercased with every non-alphanumeric removed (`Forbidden Rites` → `forbiddenrites`). Fetch pages until `CurrentPage >= Pages`.
- `rate = item.CurrentPrice / divine.CurrentPrice`, rounded to 3 significant figures. Divine is written as exactly `1`.
- Each written rate gets `source: "measured"`, `league` = `config.json` league verbatim, `asOf` = the run instant in second precision UTC (`YYYY-MM-DDTHH:MM:SSZ`).
- Map poe2scout `ApiId` to `currencyId` verbatim (both use the trade static ids, e.g. `exalted`, `perfect-orb-of-augmentation`).
- Validate the response with a Zod schema at the boundary, and validate the output with `CurrenciesFileSchema` before writing. On any failure, write nothing and exit 1 with a message.
- Write two-space JSON, LF, trailing newline, one rate object per line as the file has today; keep the existing entry order.
- A file entry whose id the API does not return is kept unchanged, and the command prints its id as a warning.
- Tests run offline against a committed captured fixture through MSW (`test/setup.ts`).

**Never:**
- No change to `packages/sync`: sync still makes no request for rates (AD-20).
- No use of `PriceLogs`, `CurrentQuantity`, or any history or volume figure.
- No scheduled or automatic run; no other category than `currency`.
- Do not edit the spine or other owner documents.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Happy path | Fixture response, file holds divine, exalted, chaos and the four recipe orbs | Every file id gets the fixture-derived rate (exalted `0.00133`), new `league`/`asOf`; exit 0; prints count of rates written | N/A |
| Id missing from API | File holds an id the response lacks | Entry kept byte-identical; warning names the id; exit 0 | N/A |
| No divine in response | Response lacks `ApiId: "divine"` | Nothing written | exit 1, message names divine |
| HTTP error / bad shape | Non-2xx, or JSON fails the response schema | Nothing written | exit 1, message names the status or the schema issue |
| Non-positive price | An item has `CurrentPrice <= 0` or null | That item skipped with a warning; an existing entry for it kept unchanged | N/A |
| Extra currency in response | Response holds `mirror`, the file does not | `mirror` not written | N/A |
| Multi-page | `Pages: 2` | Both pages fetched and merged | N/A |

</frozen-after-approval>

## Code Map

- `data/currencies.json` -- target file; schema `CurrenciesFileSchema` (`packages/contracts/src/envelopes.ts:80`), rate `CurrencyRateSchema` (`packages/contracts/src/currency-rate.ts`).
- `data/config.json` -- `league` source; parse with `ConfigFileSchema` + `parseEnvelope` (exported from `@poe/contracts`).
- `packages/sync/src/pricing/load-currencies.ts` -- the only reader; leave unchanged.
- `tools/deferred-issues/deferred-issues.ts` -- pattern for a root tool: `node:util` `parseArgs`, `isInvokedDirectly` guard from `tools/entry-guard/is-invoked-directly.ts`, pure planning separated from I/O.
- `.claude/skills/tracked-json/scripts/lookup.ts` -- precedent for a root script importing `@poe/contracts` (resolves to `src/index.ts`).
- `tools/currencies-refresh/` -- empty directory already present; the tool lives here.
- `vitest.config.ts` (root project `include`), `tsconfig.tools.json` (`include`) -- each tool directory is listed explicitly; add the new one to both. `knip.json` already covers `tools/**`.
- `fixtures/poe2scout-currencies.json` -- the real response captured on 2026-10-11 (38 items, `Pages: 1`).
- `fixtures/README.md` -- fixture rules: real capture, trim bulk not structure, two-space JSON, LF.
- `test/setup.ts` -- MSW guard; it exports `server` (line 189). A root-project test imports it and calls `server.use(http.get(...))` from `msw`, as `packages/sync/src/pricing/price-entry.summed.test.ts` does.

## Tasks & Acceptance

**Execution:**
- [x] `fixtures/poe2scout-currencies.json` -- commit a real capture of the forbiddenrites endpoint (already fetched during planning), with each `PriceLogs` trimmed to one entry -- offline test source.
- [x] `fixtures/README.md` -- add one line under *What is recorded today* naming the poe2scout capture and that it is re-captured by hand -- keep the index honest.
- [x] `tools/currencies-refresh/plan.ts` -- pure: response schema, slug derivation, `planRates(existing, items, league, asOf)` returning the new file plus warnings, 3-sig-fig rounding, file serialisation -- testable without I/O.
- [x] `tools/currencies-refresh/currencies-refresh.ts` -- entry: read config and currencies, fetch pages with global `fetch`, call `planRates`, validate, write, print summary -- the command.
- [x] `tools/currencies-refresh/plan.test.ts`, `tools/currencies-refresh/currencies-refresh.test.ts` -- cover every I/O matrix row; the entry test uses MSW with the fixture and a temp directory -- offline proof.
- [x] `package.json` -- add `"currencies:refresh": "node tools/currencies-refresh/currencies-refresh.ts"`.
- [x] `vitest.config.ts`, `tsconfig.tools.json` -- include `tools/currencies-refresh/*`.
- [x] `docs/architecture/architecture-poe-crafting-base-price-checker-2026-09-12/AGENT-WORKFLOW.md` -- add `pnpm currencies:refresh` to the *Fixtures* block of explicit human-invoked commands, one line -- AGENT-WORKFLOW owns command-level rules.

**Acceptance Criteria:**
- Given the fixture, when the entry runs against a temp data directory, then the written file parses with `CurrenciesFileSchema` and divine's rate is `1`.
- Given any failure path, when the command exits 1, then the target file's bytes are unchanged.
- Given `pnpm check`, when it runs, then it passes and makes no network call.

## Implementation Notes

- `zod` 4.6.5 added as a root devDependency: a root tool cannot import `zod` through `contracts`, and the response schema lives in `plan.ts`.
- `test/hand-listed-coverage.test.ts` lists the new tool directory; the test fails without it.
- `AGENT-WORKFLOW.md`: the sentence after the command block now covers three commands.

## Spec Change Log

## Review Triage Log

| # | Source | Finding | Verdict | Route / evidence |
|---|--------|---------|---------|------------------|
| 1 | verification-gap | Only the exalted rate is asserted (price 1, unchanged), so conversion regressions pass | medium | patch: pin the full rate list, and check chaos in the entry test |
| 2 | edge-case, blind, verification-gap (other) | A kept entry is byte-identical only when it is already in serialiser form | low | reject: the live file is canonical; keeping raw lines adds a second write path |
| 3 | edge-case, blind | `writeFileSync` is not atomic; a thrown write escapes to the top-level catch with usage text | medium | patch: temp file + rename inside try/catch; add a network-error test |
| 4 | edge-case | `fetch` has no timeout | low | patch: `AbortSignal.timeout` |
| 5 | edge-case | A duplicate `ApiId` across pages: the first wins silently | low | reject: the response is one page today; the fix needs a new branch for a case nobody has seen |
| 6 | edge-case, blind | A wrong slug gives a bare 404 or a misleading error | low | patch: hint in the HTTP error |
| 7 | blind | Spine AD-20 and the writer table still say hand-maintained; `measured` label | medium | defer: owner document (Review brief rule 2); ledger entry added |
| 8 | blind | The spec Code Map holds a session scratch path | low | reject (the fix edits this spec); path replaced as housekeeping |
| 9 | blind | No implausible-rate check | low | reject: a new feature; human diff review is the safety mechanism |
| 10 | blind | The summary prints only a count | low | reject: the spec says count; git diff shows the changes |
| 11 | blind | Untested failure paths (network, non-JSON, config) | low | network: patched via #3; others reject: same `fail` path as the tested cases |
| 12 | blind | README has no re-capture procedure; its league sentence goes false at the next league | low | patch |
| 13 | blind | AGENT-WORKFLOW says "change by GGG" and gives no when-to-run line | low | patch |
| 14 | blind | `existingFile()` JSDoc claims to mirror the live file; asOf has drifted | low | patch |
| 15 | blind | No dry-run mode | low | reject: git diff is the review and rollback path |
| 16 | deferred-ledger-audit | Zero findings | — | — |

## Design Notes

AD-20 makes rates committed data that `sync` never fetches. This command does not change that: it lives in `tools/`, outside every package, a human runs it, and its output is a reviewed diff, the same pattern as `catalogue:refresh`. `source` stays `measured` because AD-20 forbids inventing a provenance value. Rounding uses significant figures, not the 4-decimal convention of `sync`, because cheap currencies (e.g. `lesser-jewellers-orb` ≈ 0.000036 div) would round to `0`, which `DivineAmountSchema` refuses.

The data directory and clock are parameters of the entry function so tests pass a temp dir and a fixed instant.

## Verification

**Commands:**
- `pnpm vitest run --project root tools/currencies-refresh` -- expected: all pass, no escaped URL.
- `pnpm check` -- expected: exit 0.

**Manual checks (if no CLI):**
- No agent browser checks: the change touches only `tools/`, `fixtures/`, root config and `docs/`; no page input changes (agent-browser-checks rule 1).
