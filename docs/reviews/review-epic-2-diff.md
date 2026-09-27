# Review — Epic 2 diff (`f73fabb^..967de0f`)

Scope: `packages/web`, `packages/core/src/rank.ts`, `packages/contracts/src`, `.github`, `tools/prune-pages.mjs`, `test/prune-pages.test.ts`. Excluded: `data/*.json`, docs, openwiki, `.claude/skills`. Requested by `bmad-retrospective` for epic 2. Lenses: adversarial, edge-case-hunter, verification-gap. The weighting is on the story boundaries 2.1 → 2.8.

The retrospective (`docs/stories/epic-2-retro-2026-09-27.md`) verifies each finding against the source, gives it a disposition and records it. A finding that overlaps between lenses is marked **[overlap]**. This report records what each lens returned. It is not a triage.

## Adversarial (18)

| # | Location | Trigger | Guard | Consequence |
|---|---|---|---|---|
| A1 [overlap E1] | `list/display-rows.ts:56-57`, `frame/trust-facts.ts:105-118` | 2.3 drops `ranking.unresolvable` and hands it to 2.6. 2.6 counts from `sync-report.json` records, not from the ranking. | Render the unresolvable rows, or pass `ranking.unresolvable.length` into the strip | Unresolvable entries vanish when the report is absent or drifts |
| A2 | `load/load-artifacts.ts:11-16,75,144-151` | No cross-artifact consistency check (dataset/report league against `config.league`). The CDN `max-age=600` can mix two deploys. | Compare the leagues after classify, retry once | False honest-empty statements, or "never issued" rows after a deploy |
| A3 | `load/load-artifacts.ts:75`, `load/artifacts.ts:202-207` | About 7 MB (weights, catalogue) is fetched `no-store` on each load, and the catalogue files have no consumer | `no-cache` revalidation, and an AD question on whether the catalogue must be required | Reload cost, and a catalogue break refuses the whole page |
| A4 [overlap E8] | `frame/FailureScreen.tsx:146-147`, `load/load-artifacts.ts:102,124-126` | The refusal copy always states the versions | Carry a refusal cause `version \| content \| missing` | "declares 1.0.0; expects 1.0.0" |
| A5 [overlap V4] | `.github/workflows/deploy.yml:44-57`, `tools/prune-pages.mjs:137-144` | The deploy gates only on `pnpm check`. Prune checks that a file exists, not that it is valid. | Parse the kept artifacts with the contracts envelopes during the build | A malformed data push deploys a refusal screen |
| A6 [overlap E4, V1] | `list/UnrankableAppendix.tsx:101` | The appendix prints `className` raw. `unitLabel` has no non-test caller. | `{unitLabel(item.className)}` | Underscored class names are printed |
| A7 [overlap E11] | `list/format.ts:55` against `:196-205` | `ageMark` counts a league-mismatched observation as priced, but the panel does not | One rule for the age of a mismatched price | The row and its panel contradict each other after a reset |
| A8 | `list/list-statement.ts:148-159` | All entries are unresolvable, or only crafted entries exist, so there is no statement | An explicit branch for a non-empty Tracked List | An unexplained empty list |
| A9 | `App.tsx:122-135`, `main.tsx:14-20` | No error boundary exists, and `rank` throws `RangeError` | An error boundary that renders a failure screen | A blank white page |
| A10 | `load/load-artifacts.ts:68-89` | No fetch timeout | `AbortSignal.timeout`, mapped to not-arrived | The skeleton shows indefinitely |
| A11 [overlap E6] | `list/RankedRow.tsx:51`, `frame/TrustStrip.tsx:75` | The toggles are `div` elements with `onClick`, with no keyboard access | `button` or `role=button` | No keyboard path |
| A12 [overlap E5] | `list/RankedList.tsx:38,51-52` | `grown` survives a row count at or below 20 | Reset when `remaining <= 0` | The full list opens unasked |
| A13 | `threshold/PayoutThreshold.tsx:138-146`, `list/list-statement.ts:134-136` | The draft "3.50" shows beside a committed "3.00". The unrounded price is compared with the 2dp threshold. | Snap the draft; compare at the display precision | Two threshold figures; a base that appears to equal the threshold is dropped |
| A14 [overlap E10] | `frame/trust-facts.ts:74-81` | An aborted run falls back to `runStartedAt`; a future stamp reads "< 1 minute ago" | Mark the fallback and treat a future stamp as unknown | A false freshness claim |
| A15 | `frame/AbsenceLines.tsx:44-48` | The recipes-absent copy claims an effect that `rank` never applies | Align the copy, or feed recipes into rank | The strip and the page contradict each other |
| A16 | `.github/workflows/openwiki-update.yml:60-64` | An unattended model may stage AGENTS.md, CLAUDE.md and its own workflow | Narrow `add-paths` | Agent instruction files are rewritten casually |
| A17 | `.github/workflows/deploy.yml:34-57` | Actions are pinned by tag while the job holds `pages: write` | Pin to SHAs, as openwiki-update does | A tag move publishes arbitrary content |
| A18 [overlap E12] | `tools/prune-pages.mjs:107-113,126-136` | A `data/` path that collides with a bundle output deletes the built page | Refuse the collision | A broken deploy that exits 0 |

## Edge-case hunter (13)

| # | Location | Trigger | Guard | Consequence |
|---|---|---|---|---|
| E1 | `core/src/rank.ts:190-197`, `display-rows.ts:108-113`, `trust-facts.ts:105-118` | Unresolvable entries while the report is absent or disagrees | Count from the ranking | Unresolvable bases vanish |
| E2 | `core/src/rank.ts:190-199` | After a league reset, the old-league no-listings, unresolvable and no-exchange-rate states persist | Route a mismatched non-priced entry to league-mismatch | Old-league facts print as current. This is already ledgered at deferred-work.md:137. |
| E3 | `core/src/rank.ts:168-177`, `UnrankableAppendix.tsx:36-60` | Weights are loaded and crafted entries are tracked | Surface the pending crafted entries | Crafted entries appear nowhere, and the appendix shows 0 |
| E4 | `UnrankableAppendix.tsx:98-103` | Underscores, a long name, or a shared className | `unitLabel` and a clip | Raw names, overflow, duplicate-looking rows |
| E5 | `RankedList.tsx:51-66` | Grown, then the row count drops to 20 or fewer | Reset `grown` | A sticky grown state |
| E6 | `RankedRow.tsx:51`, `TrustStrip.tsx:75` | A keyboard or screen-reader user | `role=button`, `tabIndex`, `aria-expanded` | No keyboard path |
| E7 | `TrustStrip.tsx:140-155` against `:105-124` | The ready set has absence or health lines that the slot does not reserve | Reserve the lines, or drop the never-jumps claim | A 21px shift per line |
| E8 | `load-artifacts.ts:102,124`, `FailureScreen.tsx:53` | A content refusal or a required 404 | A reason-specific copy | Misleading version copy |
| E9 | `trust-facts.ts:190` | Coverage in [0.995, 1) or (0, 0.005) | Floor and clamp | Partial coverage prints 100%, and non-zero coverage prints 0% |
| E10 | `trust-facts.ts:80` | `runFinishedAt` is ahead of the clock | Treat as undefined | "< 1 minute ago" |
| E11 | `format.ts` `ageMark` against `combinationAges` | A league-mismatched stored price | Read `observedAt` only when the resolved state is priced | The row and the panel disagree |
| E12 | `tools/prune-pages.mjs:68-78` | A `data/` path of `index.html` or `assets/*` | Throw on the collision | A broken site |
| E13 (claim, medium) | `contracts/src/envelopes.ts:96-103` | 905419c: the weights envelope is only a version plus passthrough | Require the producer header fields | A header-less weights file breaks the whole page |

## Verification gap (6)

| # | Gap shape | Location | Trigger | Guard | Consequence |
|---|---|---|---|---|---|
| V1 | missing-adoption | `UnrankableAppendix.tsx:101`, `format.ts:74` | 2.8 does not adopt 2.3's label rule, and no fixture has an underscore | A test with `Body_Armours_dex_int` | Against spine `:429` ("`web` trims at render time") |
| V2 | regression | `list-statement.ts:41-42`, `display-rows.ts:108-114` | "In canonical order" is printed above rows that are grouped by state | A mixed no-listings and league-mismatch test | A false statement during a mid-refill reset |
| V3 | regression | `frame/Frame.tsx:30-31`, `App.tsx:153` | Nothing asserts that the frame is a flex column | Assert display and flexDirection | The tail pin breaks silently |
| V4 | broken-verification | `.github/workflows/deploy.yml:7-8,46-48` | No workflow runs `pnpm test` | A test job that excludes the committed-data suites | A render regression deploys |
| V5 | regression | `RankedRow.tsx:63,97-111`, `tokens.ts:182-189` | Widths are checked as style strings only; nowrap fit is never measured | An agent-browser fit check | Clipped or spilled cell text |
| V6 | regression | `tokens.ts:335-371,82` | The 1920 budget is arithmetic over constants | A measured block height against the budget | The page overflows 1920 with the tests green |
