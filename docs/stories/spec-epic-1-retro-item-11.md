---
title: 'Epic 1 retro item 11: one parse test over the four committed catalogue files'
type: 'chore'
created: '2026-09-26'
status: 'done'
route: 'oneshot'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** No test parses the committed `data/catalogue/static.json`. The other three files are parsed only indirectly, through `loadCatalogueIds` and the pricing fixtures. A `contracts` catalogue schema can therefore tighten against a committed file and the suite stays green (retro R-11). The two story 1.4 ledger entries in `deferred-work.md` (the live-refresh carve-out and the committed-catalogue parse check) are still open on paper.

**Approach:** Add one `sync` test. For each entry of `CATALOGUE_ENDPOINTS`, the test reads the committed file at `outputPath` and parses it with `parseEnvelope` against its `Catalogue*FileSchema`. The test also asserts that `data/catalogue/` holds exactly those four `.json` files. Then append a note that retires the two 1.4 entries to `deferred-work.md`.

</frozen-after-approval>

## Implementation Notes

- New file `packages/sync/src/catalogue/committed-catalogue.test.ts`. It sits next to `catalogue-ids.test.ts`, which already reads committed files with `readFileSync` from `new URL('../../../../', import.meta.url)`. The schema map is a `Record<CatalogueArtifact, …>` in the test, so a fifth artifact in `CATALOGUE_ENDPOINTS` is a compile error until the map covers it. It reuses the per-artifact pairing of `SCHEMAS` in `catalogue-refresh.ts`, which is not exported. Do not export it.
- `parseEnvelope` also refuses an unknown major or a malformed version, so one assertion covers both the version and the shape. On failure the test message prints the issues, so the failing field is named.
- Ledger: AGENTS.md says only `deferred-work-sweep` removes an entry. So "retire" follows the ledger's existing convention: an appended note under a `## Resolved` heading (see the 2026-09-26 note for the live-run entry). No existing entry is edited or removed.
- Files changed: `packages/sync/src/catalogue/committed-catalogue.test.ts` (new), `docs/stories/deferred-work.md` (appended note), `docs/stories/sprint-status.yaml` (item 11 set to `done`).
- Proof that the test can fail: a temporary copy set `static.json`'s first group label to `42` in memory. The test failed with `result.0.label: Invalid input: expected string, received number`, and the copy was then deleted. `pnpm check` and `pnpm test` passed (57 files, 649 tests).

## Review Triage Log

- Ledger note said "at the top of this ledger", but the top entry is story 1.1 — **medium**, patched: the note now names each entry by its summary text.
- The note restates the retirement of the live-refresh entry — **low**, patched with the item above: the note cites the earlier Resolved note instead of claiming a new closure. The frozen Problem text is human-owned and was not edited.
- Two near-identical `## Resolved (2026-09-26…)` headings — **low**, patched: the heading is now `## Resolved by epic 1 retro item 11 (2026-09-26)`.
- `PARSERS` duplicates the private `SCHEMAS` pairing in `catalogue-refresh.ts`, so a changed pairing would go unnoticed — **low**, rejected: the fix adds a new export for a pairing that is fixed by name (`items`↔`CatalogueItemsFileSchema`). The `Record` type still catches a missing artifact.
- Add a re-serialisation byte check — **low**, rejected: this is out of scope, and the existing 1.4 review entry ("a second refresh leaves no diff") already tracks it.
- The file-set check ignores non-`.json` files — **false**: only committed artifacts matter. A stray `.tmp` in a working tree is not a committed-catalogue defect, and failing on one would make local runs noisy.
- Missing template sections (Tasks, Verification, baseline) — **false**: the oneshot route drops those sections by design (step-02).
- No proof that the test can fail — **low**, patched: see the mutation run above.
- sprint-status item still `open` — **low**, patched: set to `done`.
- `JSON.parse` has no guard — **false**: a `SyntaxError` fails the test and the title names the file. No `describe` wrapper — **low**, rejected as cosmetic. "four" in a test title — **low**, patched: the word is removed.
