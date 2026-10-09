---
title: 'Epic 2 retro action 8 (F6): seven artifacts, no-cache, one denomination constant'
type: 'refactor'
created: '2026-09-27'
status: 'done'
baseline_revision: '8d252adf1194db8f0a681a593979b860cca9f6bb'
route: 'dispatch'
review_loop_iteration: 0
followup_review_recommended: false
deferred:
  - summary: >-
      The epic 2 retrospective ledger entry that tells Dev to set `FETCH_FAILURE_TITLE` to `A required file did not arrive.` is still open and contradicts the user decision this spec implements.
    evidence: |-
      docs/stories/deferred-work.md (entry "Dev. `FETCH_FAILURE_TITLE` ... becomes `A required file did not arrive.`", about :300). A sweep that picks it would revert the title to the wording the user rejected on 2026-09-27. Only the new retro-item-8 `[NOTE FOR UX]` entry says the decision supersedes it. This spec's Never rule forbids removing an entry, so the cancel belongs in a commit that names the cancel decision (AGENTS.md).
    location: >-
      docs/stories/deferred-work.md:300
    severity: medium
context:
  - '{project-root}/docs/architecture/architecture-poe-crafting-base-price-checker-2026-09-12/ARCHITECTURE-SPINE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Spine revision 22 (AD-24) cut `web`'s fetch set to seven artifacts, dropped `catalogue/static.json`, and set `cache: 'no-cache'`, but `web` still fetches eight with `no-store`. The denomination word `Divine` is spread as literals instead of one `web` constant (AD-24).

**Approach:** Remove `catalogueStatic` from the artifact table and the Pages prune allowlist. Switch every fetch to `no-cache` with no query token. Add one `DENOMINATION` constant and print it wherever the denomination word prints. Update tests, comments and names to "seven". Closes the first entry of "Deferred from: epic 2 retrospective (2026-09-27)" in `docs/stories/deferred-work.md` (the entry itself stays; only `deferred-work-sweep` removes entries).

## Boundaries & Constraints

**Always:** AD-24 wins over the code. Printed text stays byte-identical. Order is `dataset, sync-report, weights, recipes, tracked, config, catalogue/stats`; required = dataset, tracked, config, catalogue/stats. The MSW `onUnhandledRequest` callback guard stays.

**Never:** Edit the spine, PRD, `docs/epics.md`, `DESIGN.md`, `EXPERIENCE.md`, or `packages/web/vite.config.ts` (its "eight" comment stays; recorded as a note). Touch `packages/contracts` schemas or `data/catalogue/static.json`. Merge the 2dp formatters (retro action 11). Invent new UX copy. Remove a `deferred-work.md` entry.

**Decision (user, 2026-09-27):** `FETCH_FAILURE_TITLE` becomes "One of the data files did not arrive." — no count, so a set-size change needs no copy sweep, and not "required", because a tolerable file's 5xx also shows this screen. DESIGN.md:797 is not edited here; append a `[NOTE FOR UX]` entry to `deferred-work.md` so UX updates `titleText` to match.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| One load | all seven served | exactly 7 requests, each `cache: 'no-cache'`, no `?`, none to `catalogue/static.json` | N/A |
| static.json served anyway | the server also has `catalogue/static.json` | never requested | N/A |
| Required missing | `catalogue/stats.json` 500 | fetch-failure screen naming that path | as today |
| Fetch failure | any of the seven returns 5xx or a network error | title reads "One of the data files did not arrive." | as today |
| Build | `pnpm build` | `dist` keeps the seven data files, no `catalogue/static.json` | missing required fails loudly, as today |

</frozen-after-approval>

## Code Map

- `packages/web/src/load/artifacts.ts` -- `ARTIFACTS`, `ARTIFACT_ORDER`, docblock "eight … ninth"; drop `catalogueStatic` and the `CatalogueStaticFileSchema` import.
- `packages/web/src/load/load-artifacts.ts` -- `init` at ~L88 uses `no-store`; docblocks L12–13, L48, L134 say eight.
- `tools/prune-pages.mjs` -- `ALLOWLIST` and header comment (add `catalogue/static.json` to the "never fetches" list).
- `packages/web/src/shared/product.ts` -- home for `DENOMINATION`.
- Denomination literals: `threshold/PayoutThreshold.tsx` L18–20, `list/format.ts` L201, `list/list-statement.ts` L26, `frame/Masthead.tsx` L13, and `list/ColumnHeader.tsx` L16 (`EV (Divine)`; not in the brief, but AD-24 says "one web constant", so it is included).
- `packages/web/src/frame/FailureScreen.tsx` L14 `FETCH_FAILURE_TITLE` (see Decision); grep tests for the old string.
- `packages/web/src/App.tsx` L33 comment; `packages/web/vite.config.test.ts` L21 comment.
- Tests: `load/load-artifacts.test.ts` (L20–55, L193–195), `load/prune-allowlist.test.ts` L24, `test-support/artifact-server.ts` (L2–4, L59), `App.test.tsx` (L155–179, L259).
- Keep: `packages/contracts` static schemas (used by `sync/src/catalogue-refresh.ts`, `sync/src/catalogue/committed-catalogue.test.ts`).

## Tasks & Acceptance

**Execution:**
- [x] `packages/web/src/load/artifacts.ts` -- remove `catalogueStatic`; docblock "seven … eighth needs an AD-24 amendment".
- [x] `packages/web/src/load/load-artifacts.ts` -- `cache: 'no-cache'`; docblock: revalidates each load, body reused only on 304; CDN `max-age=600` staleness and rare mixed set are accepted costs.
- [x] `tools/prune-pages.mjs` -- drop the static entry; comments to seven.
- [x] `packages/web/src/shared/product.ts` -- add `DENOMINATION = 'Divine'` citing PRD §3 and AD-24; use it in the five files above.
- [x] Tests and `test-support/artifact-server.ts` -- seven artifacts, `no-cache`, no query, and an explicit assertion that no request hits `catalogue/static.json` (serve it as a trap handler so a request is observable).
- [x] Comments/test names in `packages/web` (except `vite.config.ts`) and `tools` -- eight→seven, ninth→eighth.

**Acceptance Criteria:**
- Given the repo, when `grep -rn "static.json\|no-store\|catalogueStatic"` runs over `packages/web/src` and `tools`, then only negative test assertions and "never fetches" comments match.
- Given `pnpm check`, `pnpm test`, `pnpm build`, then all pass.

## Implementation Notes

- `test/prune-pages.test.ts` (root) also asserted eight paths and a required `catalogue/static.json`; updated to seven, with `static.json` moved to the unfetched list. Not in the Code Map.
- The App copy test strips `MASTHEAD_DEK` from source text; the dek is now a template, so the test strips its source spelling with the `${DENOMINATION}` placeholder.
- `THRESHOLD_UNIT` keeps its no-break space, written as ` ` in the template (ESLint `no-irregular-whitespace` rejects a literal one in a template).

## Spec Change Log

## Review Triage Log

### 2026-09-27 — Review pass
- verdicts: 25 findings — high 0, medium 3, low 11, false 11, maybe-false 0
- findings:
  - `[low]` `[reject]` (ledger) The retro F6 entry this spec closes stays in `deferred-work.md` with no resolved marker — the intent's Never rule ("Remove a `deferred-work.md` entry") and Approach ("the entry itself stays") exclude the fix; removal belongs to the landing/sweep commit.
  - `[false]` `[reject]` (edge) `MASTHEAD_DEK.replace` swaps only the first `Divine` / breaks if Prettier wraps the template — the dek holds `Divine` once, and Prettier does not wrap template literals; `pnpm check` passes with the one-line template.
  - `[low]` `[reject]` (edge) The acceptance grep also matches the trap constant `NEVER_FETCHED_PATH` — the spec itself asks for the trap handler; the fix is a spec edit.
  - `[low]` `[reject]` (verification-gap other) Same as the ledger finding: the spec keeps the closed retro entry against the AGENTS.md removal rule — excluded by the intent's Never rule.
  - `[low]` `[patch]` (verification-gap other) The retro entry "Parse the eight kept artifacts" (:213) is now stale — appended a note entry to the retro-item-8 section saying "eight" now means the seven `ALLOWLIST` artifacts and `catalogue/static.json` is no longer kept.
  - `[medium]` `[defer]` (blind) The older retro entry (:300) that sets the title to `A required file did not arrive.` is still open and a sweep could revert the user's decision — the intent forbids removing an entry; deferred to the spec's `deferred` list.
  - `[low]` `[reject]` (blind) The closed retro F6 entry is not marked resolved — duplicate of the ledger finding; excluded by the intent.
  - `[medium]` `[patch]` (blind) The `[NOTE FOR UX]` entry names only `titleText`, not DESIGN.md :2408–2410, EXPERIENCE.md :565 and :903 — the same appended entry now names all four places.
  - `[low]` `[reject]` (blind) Spec cites DESIGN.md:797 but the line is :794 — the ledger note already cites :794; the fix is a spec edit.
  - `[low]` `[reject]` (blind) An Implementation Note shows an empty code span where the no-break-space escape should be — the fix is a spec edit.
  - `[low]` `[reject]` (blind) The first acceptance criterion cannot pass as worded (trap constant, `product.ts` docblock) — the fix is a spec edit.
  - `[false]` `[reject]` (blind) `RANGE_LOW`/`RANGE_HIGH` have no literal check — `payout-threshold.test.tsx:129` already asserts the rendered range equals `['0 Divine', '3 Divine']`. Two redundant constant asserts were added before this was noticed; the revert was not permitted, so they stay (harmless).
  - `[false]` `[reject]` (blind) The new title assertion checks the constant, not the page — the line above asserts the rendered frame contains the constant, and the constant is pinned to the literal, so the rendered text is proven.
  - `[false]` `[reject]` (blind) The dek-strip fix is fragile — same refutation as the edge finding: one `Divine`, Prettier does not wrap template literals.
  - `[false]` `[reject]` (blind) The trap covers only `baseUrl: '/'` — every artifact handler is also registered at `artifactUrl('/', …)` (`artifact-server.ts:112`), so the trap matches the harness's only base.
  - `[false]` `[reject]` (blind) The loader docblock overclaims freshness — a `no-cache` revalidation is exactly as fresh as a full download from the same CDN, and the next sentence states the CDN staleness.
  - `[low]` `[patch]` (blind) The :213 entry still says "eight" — same group as the verification-gap :213 finding; fixed by the appended note.
  - `[false]` `[reject]` (blind) The spec records no verification results — Finalize writes them under Auto Run Result.
  - `[false]` `[reject]` (intent) `no-cache` is proven only at the `RequestInit` surface — the agent-browser run showed seven requests and about 300 B transferred per file on reload (for example `weights.json`, 5.35 MB), which is revalidation reuse.
  - `[false]` `[reject]` (intent) No real `pnpm build` proves the Build row — `pnpm build` ran; the prune log removes `catalogue/static.json` and `dist` holds exactly the seven JSON files.
  - `[false]` `[reject]` (intent) The title is asserted in one failure scenario only — every fetch failure renders the one shared constant, so one rendered scenario plus the literal pin covers the row.
  - `[medium]` `[defer]` (intent) The :300 entry still asks for the old title — same group as the blind :300 finding; deferred.
  - `[low]` `[patch]` (intent) The :213 entry still says "eight" — same group; fixed by the appended note.
  - `[low]` `[reject]` (intent) DESIGN.md :797 against :794 — duplicate of the blind finding; the fix is a spec edit.
  - `[false]` `[reject]` (intent) The diff edits the root `test/prune-pages.test.ts`, which the Code Map omits — the test asserted the old allowlist and had to change for `pnpm test` to pass; recorded in Implementation Notes.

## Verification

**Commands:**
- `pnpm check` / `pnpm test` / `pnpm build` -- expected: pass; `find packages/web/dist -name '*.json'` lists the seven and no `catalogue/static.json`.

**Manual checks:**
- agent-browser with a named session against `pnpm dev`: network log shows seven artifact requests, no `static.json`; a second reload shows conditional requests / 304s; page renders as before with "Divine" in the same places. `pnpm dev:stop` afterwards.

## Auto Run Result

Status: done

**Summary.** `web` now fetches the seven AD-24 artifacts with `cache: 'no-cache'` and no query token, and never requests `catalogue/static.json`. The Pages prune allowlist matches. The denomination word prints from one `DENOMINATION` constant with byte-identical output. `FETCH_FAILURE_TITLE` reads "One of the data files did not arrive." (user decision), with a `[NOTE FOR UX]` in `deferred-work.md`.

**Files changed.**
- `packages/web/src/load/artifacts.ts` -- drops `catalogueStatic` and its schema import; docblock says seven.
- `packages/web/src/load/load-artifacts.ts` -- `cache: 'no-cache'`; docblock on revalidation and accepted costs.
- `tools/prune-pages.mjs` -- allowlist of seven; `catalogue/static.json` in the "never fetches" comment.
- `packages/web/src/shared/product.ts` (+ test) -- `DENOMINATION = 'Divine'`.
- `threshold/PayoutThreshold.tsx`, `list/format.ts`, `list/list-statement.ts`, `frame/Masthead.tsx`, `list/ColumnHeader.tsx` -- print `DENOMINATION`.
- `frame/FailureScreen.tsx` -- new fetch-failure title.
- `App.tsx`, `vite.config.test.ts` -- comments say seven.
- `test-support/artifact-server.ts` -- seven bodies plus a `catalogue/static.json` trap handler.
- `load/load-artifacts.test.ts`, `App.test.tsx`, `load/prune-allowlist.test.ts`, `test/prune-pages.test.ts`, `threshold/payout-threshold.test.tsx` -- seven, `no-cache`, no query, no `static.json` request, new title literal.
- `docs/stories/deferred-work.md` -- appended "Deferred from: epic 2 retro item 8" with the UX title note, the `vite.config.ts` "eight" note and the stale :213 "eight kept artifacts" note. No entry removed.

**Review findings.** 25 findings (medium 3, low 11, false 11). Patches applied: 2 entries (1 medium: the UX note names all four UX places; 1 low: the :213 note). Deferred: 1 (medium: the open :300 entry that asks for the old title). Rejected: every other finding, with reasons in the Review Triage Log (spec-edit fixes, intent-excluded ledger removal, and refuted claims).

**Follow-up review recommendation:** false. Patched by verdict: high 0, medium 1, low 1.

**Verification.** `pnpm check`, `pnpm test` (1214 passed) and `pnpm build` pass before and after the patches. `find packages/web/dist -name '*.json'` lists exactly the seven files; the prune log removes `catalogue/static.json`. The implementation agent's agent-browser run against `pnpm dev` showed seven artifact requests with no query and no `static.json`, revalidated reloads (about 300 B transferred per file), and "Divine" in the same places. `pnpm dev:stop` freed port 5173.

**Residual risks.**
- The code title differs from DESIGN.md and EXPERIENCE.md until UX acts on the note.
- The :300 ledger entry can still be picked by a sweep and would revert the title (deferred).
- `payout-threshold.test.tsx` has two redundant `RANGE_LOW`/`RANGE_HIGH` literal asserts (harmless; revert not permitted in this run).
