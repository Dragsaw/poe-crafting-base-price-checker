# Epic 2 Context: Day One — the Deployed Raw Base Price List

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Epic 2 ships the first page the player uses. It is a static page on GitHub Pages that the player keeps on a second monitor before a session. The page shows an ordered list of the Base Types worth picking up to sell raw, under a Payout Threshold that the player sets. Each row states how old its price is and what Price State it is in. The player can expand any row to read the evidence behind it. After a league reset, the list is honestly empty and never serves last league's prices. The epic builds no weights-fed valuation. It is the shipped day-one phase that AD-24 declares. It also builds every chrome component that Epic 3 extends: the override layer, the tokens, the fixed frame, the trust strip, the sync report panel, the expansion panel, the Unrankable appendix, the key block and the running foot.

## Stories

- Story 2.1: The page's substrate — the override layer, the fixed frame, and one consistent artifact set
- Story 2.2: The raw ranking branch, league-scoped and computed at read time
- Story 2.3: The ranked list at rest — rows, units, freshness and the key block
- Story 2.4: The Payout Threshold, and what survives a reload
- Story 2.5: Row expansion — the evidence behind a row, its tombstones and its trade link
- Story 2.6: The trust strip, its health line, and the Sync Report panel
- Story 2.7: Day one, deployed — the honest-empty league reset and the published site
- Story 2.8: The Unrankable appendix, and the day-one page it completes

## Requirements & Constraints

- Epic 2 owns acceptance of FR-3, FR-5–FR-9, FR-12, FR-13, FR-18, FR-31 and FR-33. It also covers NFR-6 (the read-time budget), NFR-7 (a static bundle that downloads no font) and NFR-10 (legible with colour removed). FR-4's acceptance belongs to Epic 3. Epic 2 builds the appendix that Epic 3 extends.
- A Raw Base's EV is its observed price, and its Craft Cost is zero. A Raw Base below the threshold leaves the ordering and never gets a row at zero. A Raw Base is never a summand in any Item Class's EV.
- A missing figure is never `0`, a blank or a dash. A real figure too small to print reads `< 0.01`. No copy implies an observed sale. An observation from another league becomes `not-yet-synced` with the reason `league-mismatch`.
- Colour alone never carries a distinction. Each distinction also needs a glyph, a word, a weight or an italic.
- Tests stay offline. Copy `test/setup.ts` with its recording `onUnhandledRequest` callback. The `"error"` string fails no test. For browser QA, use the agent-browser skill and pass a named `--session` on every call.

## Technical Decisions

- **Graph and purity (AD-1, AD-4).** `web` depends only on `contracts` and `core`. `core` computes every ranking term, and `web` only renders what `core` returns. No artifact persists a rank or an ordering. Time and configuration enter `core` as passed-in values. `core` returns typed results for expected conditions and does not throw for them. A new schema lands in `contracts` first, and its type is `z.infer`red from it (AD-3).
- **Eight fetched artifacts (AD-24).** Each artifact is one runtime fetch with `cache: 'no-store'` and no query token. Each is validated on load, and none is bundled. The CDN's 10-minute staleness is an accepted cost. `dataset.json`, `tracked.json`, `config.json`, `catalogue/stats.json` and `catalogue/static.json` are required: the page refuses a missing one in the same way as an invalid one. `weights.json`, `recipes.json` and `sync-report.json` are absent-tolerable, and the page names each absence. All eight resolve in one transition. The Pages build prunes `data/` to this allowlist.
- **Ordering (AD-17).** At an equal EV, the kind orders first (raw before crafted). Inside a kind, the serialised canonical key breaks the tie. League filtering happens once, in `core`, at ranking time.
- **Two day-one worlds (AD-24).** The committed data has `weights.json` present and `recipes.json` holding no recipe. So no `(itemClass, recipe)` pair exists, the crafted branch is empty, and no class is Unrankable in FR-4's sense. In the absent-weights world, which a fixture must reach, every crafted Item Class is Unrankable with the reason `class absent from weights file`. Never print that string while a weights envelope is loaded, because Epic 2 does not read `bases` and cannot check the claim.
- **Mantine 9.6.1 is pinned.** Do not edit `packages/web/vite.config.ts`. `pnpm dev` uses port 5173 with `strictPort`. To use a different port, pass `--port`.

## UX & Interaction Patterns

- **Frame.** The frame has a fixed width, a 1px outline, and no breakpoints or dark mode. The appendix has four cells, 292 + 118 + 250 + 310 = 970px. It is pinned to the foot with `margin-top: auto`, and it has one arrangement in every data state. If the rows need more height, the document grows and scrolls. Never shrink a row, drop a column, truncate the appendix or hide the key block. The appendix, the key block and the running foot render below the list, in that order, in every ready state. The skeleton keeps the key block and the foot without the appendix, and the two full-page failure screens show none of them.
- **Vertical budget.** `frame-slack` is 530px. Four data-driven reservations are charged against it: the banner (74px), the health line (21px), one absence line per absent tolerable artifact (21px each, at most three), and one list-statement slot (21px). The list statement is the honest-empty statement or the nothing-clears statement, and the two never show together. Only reservations that can co-occur count toward the worst case. That worst case is 116px, which leaves 414px, above the 400px Sync Report cap. A test that sums all six reservations (179px) describes a state that no data can produce.
- **Appendix rows.** Every row is an Item Class, and never a Base Type. The class unit glyph leads the first cell. The rows are not interactive: they do not expand and have no hover state. The count is readable without expanding anything. Epic 2 prints no note: a raw row already names its Base Type, and the page does not relate a raw base to its Item Class (Story 2.8 human decision; the epics AC and DESIGN.md edits are owed in `deferred-work.md`).
- **Empty appendix (ruled).** The title alone: `Appendix: Unrankable — 0 Item Classes`. The count is in `ink`, not rust. There is no lead and no row, and the bottom padding is 16px, the same as the top. The appendix keeps its place above the key block. It does not say why it is empty.
- **Absence lines (ruled).** Each absent tolerable artifact adds one plain `Not published` line inside the trust strip, after line two and before the health line. The line carries no mark and no colour. The three bodies are verbatim in EXPERIENCE.md. Nothing else on the page repeats the reason. The uniform-prior banner stays down when no crafted ranking exists.
- **Other rulings.** Skeleton rows are flat bars with no shimmer, and the column header shows its final labels. A coverage figure that the report omits reads *not measured* when a weights envelope is loaded and *unknown* when none is loaded. It never reads `0`, and it carries no mark.
- **Silence means healthy.** A healthy cell holds no mark element. The Price State glyphs are `●` priced, `○` no-listings, `∆` not-yet-synced and `×` unresolvable, and each glyph always appears with its word. Interaction is mouse-only. Nothing sorts, and the page has no tooltips, modals or auto-refresh. Only the threshold survives a reload.

## Cross-Story Dependencies

- Stories 2.1–2.7 are done. Story 2.8 renders from their loader, `core`'s raw branch and `RankedRow`. It completes the page that Story 2.7 deployed. Build its empty case to the ruled treatment, not to invented copy. The earlier deferral of the appendix design is discharged, and Story 2.8 may not re-defer it.
- Epic 3 extends the chrome and does not rewrite it. It adds the other two appendix reasons, the Provenance `absent` case, the sixth Sync Report group and crafted rows. The single list-statement slot will need a ruling when state 35 adds a third statement.
- Open items in `deferred-work.md` that touch this epic, to raise and not to settle: whether the key block lists `† pruned` and `* pinned`; where the key block and running foot copy is owned; how tiers 2 and 3 are told apart without colour; the singular form of `+ Read the remaining 1 rows`; the owner document for the two list-statement strings; and a first real run of `.github/workflows/deploy.yml`, which needs a human.
