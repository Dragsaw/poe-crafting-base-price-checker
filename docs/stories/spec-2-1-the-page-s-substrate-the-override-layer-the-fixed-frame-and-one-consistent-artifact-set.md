---
title: 'Story 2.1: The page''s substrate — the override layer, the fixed frame, and one consistent artifact set'
type: 'feature'
created: '2026-09-26'
status: 'ready-for-dev'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/docs/stories/epic-2-context.md'
  - '{project-root}/docs/ux-designs/ux-poe-crafting-base-price-checker-2026-09-13/DESIGN.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `packages/web` is a placeholder. The page has no theme, no frame, and no way to load and validate the eight AD-24 artifacts. Every later Epic 2 story renders on top of this substrate.

**Approach:** Build the Mantine 9.6.1 override layer and the DESIGN.md token set. Build the fixed 1060px frame with its masthead and twenty skeleton row slots. Build one loader that fetches the eight artifacts as separate uncached requests, validates each one with `contracts` schemas, and resolves to exactly one outcome in a single transition: a whole set, the refusal screen, or the fetch-failure screen. Add the `CraftRecipe` schema and the `recipes.json` envelope to `contracts`. This story renders no ranked rows. Stories 2.2 and 2.3 add them.

## Boundaries & Constraints

**Always:**
- The epics.md Story 2.1 ACs and UX-DR1–7, DR33, DR40 and DR43 are normative. DESIGN.md frontmatter supplies every token value. Where the two disagree, DESIGN.md wins.
- `contracts` changes land first, in their own commit. `CraftRecipe` is one Zod schema with a `z.infer` type: `{ id, currencies: [{ currencyId, quantity }], modifierLevelMin }`. `id` is unique within the file. `quantity` is a positive number. `modifierLevelMin` is a required non-negative integer, where `0` means no floor. `RecipesFileSchema` is `{ schemaVersion, recipes: CraftRecipe[] }`, and it rejects a duplicate `id` the same way `TrackedFileSchema` rejects a duplicate key.
- Validate each artifact with `parseEnvelope`. When a file fails validation, the refusal names the artifact's path, the `schemaVersion` the file declares (the raw value, or `none` when it is missing or not a string) and the version the page expects.
- Each artifact is one plain `fetch` of `import.meta.env.BASE_URL + path` with `cache: 'no-store'` and **no query token** (decision 2026-09-26). The Pages CDN's `max-age=600` staleness of up to 10 minutes is accepted, and so is the small chance of a set mixed across a sync commit. AD-24's "cache-busted" wording is amended to match in this story.
- **What absent means (decision 2026-09-26):** HTTP 404 is *absent*. A required file that is absent gets the refusal screen with declared `none`, per AD-24. A tolerable file that is absent lets the page render and name the absence. A rejected fetch or any other non-OK status is *did not arrive* and gets the fetch-failure screen.
- **Weights envelope (decision 2026-09-26):** `contracts` gains a minimal `WeightsFileEnvelopeSchema`, which is `schemaVersion` plus a loose passthrough. It is validated with the expected version `6.0.0`, so only major `6` is accepted. Story 3.1 tightens it.
- **Naming an absence (decision 2026-09-26):** each absent tolerable file prints one plain sans line under the masthead, in `ink-secondary`, for example `Not published: recipes.json — no crafted rows can be ranked.` Weights reads `— every crafted class is unrankable.` and sync-report reads `— the sync report is unavailable.` Each line takes its own entry in the chrome budget table, at 21px, the same as the health line. A `[NOTE FOR UX]` is filed in `deferred-work.md` so that UX owns the final copy and placement.
- **Skeleton (decision 2026-09-26):** use DESIGN.md's documented fallback, a flat `paper-inset` bar per cell at the column widths, with no shimmer. The open `[NOTE FOR UX]` (state 22) is filed in `deferred-work.md`.
- **Serving (decision 2026-09-26):** `publicDir` points at repo `data/`, and `base` is `'./'`. The build copies the folder into `dist/`, so the deployed site stays fully static. Story 2.7 may trim the files AD-24 never fetches.
- Outcome precedence across the eight results: any artifact that did not arrive gives the fetch-failure screen. Otherwise, any invalid artifact gives the refusal screen. Otherwise the result is ready. When several artifacts fail, the screen names the first one in AD-24 order. `+ Try again` re-runs all eight.
- Font sizes are literal px strings. Every role carries an explicit `lineHeight`. The page downloads no font.
- Tests stay offline and use the shared `server` from `test/setup.ts`, with `server.use(http.get(...))`. Follow the existing manual `createRoot` and `act` mount pattern. Do not add testing-library.

**Never:**
- No ranking, no row content, no threshold, no trust strip, no appendix, no key block and no deploy workflow. Stories 2.2–2.8 own them.
- Do not bundle any artifact into the JS. Do not import `data/**` from source.
- Do not animate any height. No chevrons, no shadow, no radius, no breakpoints, no dark mode, no `overflow: hidden` on the frame.
- Do not edit `server.port` or `strictPort` in `vite.config.ts`.
- Nothing in this story reads a recipe for valuation.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| All eight valid | 8× 200, valid | the whole page shows ready in one transition; the masthead eyebrow reads `League {config.league}` | N/A |
| Pending | fetches unresolved | masthead + 20 skeleton slots in the final layout | N/A |
| Invalid shape | `tracked.json` has a valid version and a bad body | the refusal screen names `tracked.json`, the declared version and the expected version; no retry | — |
| Unknown major | `dataset.json` declares `2.0.0` | refusal, declared `2.0.0`, expected `1.0.0` | — |
| Missing version | `config.json` has no `schemaVersion` | refusal, declared `none` | — |
| Network error / 5xx | `catalogue/stats.json` fetch rejects or 503 | fetch-failure names it and shows `+ Try again`; retry re-fetches all eight | — |
| Required absent | `tracked.json` 404 | refusal names `tracked.json`, declared `none` | — |
| Mixed failure | one file not arrived, another invalid | fetch-failure wins | — |
| Tolerable absent | `recipes.json` 404, the rest valid | ready; one absence line names `recipes.json` | — |
| Non-JSON body | 200 with HTML | treated as invalid → refusal, declared `none` | — |

</frozen-after-approval>

## Code Map

- `packages/contracts/src/schema-version.ts` -- `parseEnvelope` / `EnvelopeResult`, `checkSchemaVersion`, `SUPPORTED_SCHEMA_VERSION`; reuse, do not change semantics.
- `packages/contracts/src/envelopes.ts` -- `DatasetFileSchema`, `SyncReportFileSchema`, `TrackedFileSchema` (duplicate-key superRefine pattern to copy), `ConfigFileSchema`, `CatalogueStatsFileSchema`, `CatalogueStaticFileSchema`; add `RecipesFileSchema` here.
- `packages/contracts/src/currency-rate.ts` -- `CurrencyIdSchema` for `CraftRecipe.currencies[].currencyId`.
- `packages/contracts/src/index.ts` + `index.test.ts` -- barrel: values via `export {}`, types via `export type {}`, `.ts` specifiers.
- `packages/sync/src/catalogue/weights-ids.ts` -- `WEIGHTS_SCHEMA_VERSION = '6.0.0'`, sync-local; do not import from web (no web→sync edge).
- `packages/web/src/App.tsx`, `main.tsx`, `App.test.tsx`, `test-setup.ts` -- placeholder shell to replace; keep the jsdom shims.
- `packages/web/vite.config.ts` + `vite.config.test.ts` -- no `publicDir`/`base` today; nothing serves `data/`.
- `test/setup.ts` -- exports `server`; loopback URLs pass through unhandled, so every web fetch test must register all eight handlers.
- `data/` -- has 7 of 8 files; `recipes.json` missing; also holds files AD-24 never fetches.
- `docs/ux-designs/.../DESIGN.md` -- frontmatter tokens (colours, spacing, type roles, stacks, `components.refusal-screen` / `fetch-failure-screen` / `masthead` copy); prose at ~2295–2316 for the failure screens and the skeleton fallback.

## Tasks & Acceptance

**Execution:**
- [ ] `packages/contracts/src/craft-recipe.ts` (+ test) -- `CraftRecipeSchema`/`CraftRecipe`; `envelopes.ts` `RecipesFileSchema`/`RecipesFile` + `WeightsFileEnvelopeSchema`; barrel + barrel test -- AD-3 schema lands first.
- [ ] `packages/web/src/theme/tokens.ts` (+ test) -- colours (5 paper + surround, 4 ink, 3 rule, sepia, ochre, rust), spacing, three stacks, type roles, glyph vocabulary, chrome budget table -- one source; tests assert counts, no green, 1012 = 1060 − 2×24, column sums, committed chrome + reserves ≤ 1920.
- [ ] `packages/web/src/theme/theme.ts` (+ test) -- `createTheme`: replaced `lineHeights`/`headings`, sepia-derived `primaryColor`, `defaultRadius: 0`, `shadow: 'none'` defaultProps on every shadowed component, Accordion/Collapse stripped with zero transition.
- [ ] `packages/web/src/load/artifacts.ts`, `load-artifacts.ts` (+ tests) -- the eight descriptors in AD-24 order (path, required/tolerable, schema, expected version); fetch + classify into `ready | refused | failed`, with `absent` tracked per tolerable file.
- [ ] `packages/web/src/frame/*` -- `Frame`, `Masthead`, `RowSlots` (20 × 28px, six columns), `FailureScreen` (refusal / fetch-failure variants, DESIGN copy), `AbsenceLines`, `TradeGlyph` (`↗` at weight 400).
- [ ] `packages/web/src/App.tsx`, `main.tsx`, `App.test.tsx` -- wire theme + loader; one state transition; tests for each matrix row.
- [ ] `packages/web/vite.config.ts` (+ test) -- `publicDir` → repo `data/`, `base: './'`; assert both.
- [ ] `docs/architecture/.../ARCHITECTURE-SPINE.md` AD-24 + its `.memlog.md` -- replace "cache-busted requests" with the no-store/no-token rule and the accepted 10-minute CDN staleness; separate `docs` commit.
- [ ] `docs/stories/deferred-work.md` -- append two `[NOTE FOR UX]` entries (skeleton fill, absence-line copy/placement).

**Acceptance Criteria:**
- Given a test that counts requests, when the page loads, then exactly eight requests go out, one per AD-24 path, each with `cache: 'no-store'` and no query string.
- Given the pending state, when any single artifact resolves before the others, then no rendered content changes until all eight have settled.
- Given the built bundle, when `pnpm exec vite build --config packages/web/vite.config.ts` runs, then no JS chunk contains artifact contents. The data files appear only as copied static files.
- Given `pnpm check` and `pnpm test`, when they run, then both pass.

## Implementation Notes

## Spec Change Log

## Review Triage Log

## Design Notes

- The "five paper tones" are paper, paper-inset, paper-deep, paper-raw and paper-raw-hover. `surround` is the UX-DR5 surround fill outside the frame and does not count as a paper tone.
- Masthead copy uses the DESIGN mockup strings. The eyebrow is `League {league}`. The 170px block reserves the space for the right-hand control slot and leaves it empty.

## Verification

**Commands:**
- `pnpm check` -- expected: typecheck, lint, depcruise clean.
- `pnpm test` -- expected: all green, no escaped-request failures.
- `uv run --with fonttools <scratchpad>/glyphs.py` -- expected: every glyph in the vocabulary resolves in `segoeui.ttf`, `seguisb.ttf` and `segoeuib.ttf`, except `↗`, which is checked in Regular only.

**Manual checks:**
- agent-browser (named `--session`) on `pnpm dev`: frame 1060 wide, centred on surround, outline edge; skeleton then ready; rename a data file locally to see each failure screen, then restore it.
