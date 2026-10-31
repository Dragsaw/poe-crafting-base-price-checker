---
title: 'Price an entry at the mean of its first two listings'
type: 'feature'
created: '2026-10-11'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context:
  - '{project-root}/docs/sprint-change-proposal-2026-10-11.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `sync` prices a Tracked Entry at the lower median of up to ten returned listings. AD-16 (spine rev 38) and Story 1.7's "returned sample of listings" AC now price it at the mean of the first two listings in the trade site's result order. The code and the expansion context copy still state the old rule.

**Approach:** Implement §4.6 of `docs/sprint-change-proposal-2026-10-11.md`. Do not edit the planning docs committed in 581f9c9, and do not hand-edit `openwiki/`.

- `priceDivine` is the mean of the first two normalised listings in result order. There is no re-sort. With one listing, the price is that listing. An empty sample stays `no-listings`.
- The mean is taken over unrounded Divine values and rounded once to 4 dp.
- `sampleSize` stays the count of listings returned (up to 10), not 2.
- `exchangeObservation` is the rate of the first of the two listings that is not in divine. When both are in divine, it is divine's own rate.
- One unrated currency among all the fetched listings still gives `no-exchange-rate` (AD-20).
- Touch `packages/sync/src/pricing/normalise.ts` (replace `lowerMedian`), `price-entry.ts` `priceOf`, the `packages/sync/src/index.ts` export, the `priceDivine` description in `packages/contracts/src/price-observation.ts`, and `ESTIMATED_ODDS_CONTEXT` in `packages/web/src/list/format.ts` ("All prices below come from real listings.").
- Update the tests whose expected values move. Add tests for one listing, for a mixed exalted/divine pair (the exchange observation choice), and for unsorted input (no re-sort).
- Done: `pnpm check` passes, and an agent-browser check on `pnpm dev` shows the new context line in an expanded row with estimated odds.

</frozen-after-approval>

## Implementation Notes

- `normalise.ts`: `lowerMedian` → `meanOfFirstTwo` (no sort, throws on empty). `toDivine` now returns the unrounded product, so `priceOf` rounds the mean once. Its only in-repo caller is `priceOf`; it stays exported from `packages/sync/src/index.ts`. `DIVINE_CURRENCY_ID` is exported for the exchange observation choice.
- `price-entry.ts` `priceOf`: every listing is still normalised first, so one unrated currency anywhere gives `no-exchange-rate`. The price comes from the first two, and the exchange observation is the first non-divine of the pair, or the first listing.
- Fixture expectations were recomputed by hand from the six `fixtures/trade-fetch-*.json` captures: `[0.002, 0.0654, 0.0905, 1, 1, 94]`. The hybrid MSW test (1, 2, 3 div) moves from 2 to 1.5.
- The round-once test uses 1 ex and 5 ex: rounding each listing first would give 0.0061, and rounding once gives 0.006.

**Agent browser checks:**
1. Start `pnpm dev`. Open the list, then expand a crafted row whose expansion shows the estimated-odds context line. Expect the line to end with "All prices below come from real listings." Take a screenshot.
2. Collapse the row and expand it again. Expect no console errors on the page.

### Agent browser checks (after review)

- Session `poe-79ae64f4395d`, `pnpm dev` on port 5173, run 2026-10-11 19:57 local time, against HEAD `581f9c9ca1029b986d02bd0691b51d143904f787` with a dirty tree (this change was not committed yet; the last review fix came before this run).
1. Pass. Expanded Bows (class row 4, ≈ 0.03). The context line reads "Bows · ≈ Some roll odds are estimated: no published weight for one mod tier. All prices below come from real listings." Amulets, Crossbows and Rings show the same line. Screenshot: `C:/Users/ilyal/AppData/Local/Temp/claude/E--Program-Files-Jetbrains-Projects-poe-crafting-base-price-checker/992a4a4e-52f2-486b-b753-4d73da9fe903/scratchpad/bows-context-line.png`.
2. Pass. After collapsing and re-expanding Bows, the line is the same, `agent-browser errors` is empty and the console has 0 error lines.

## Review Triage Log

- Blind Hunter: the 1..10 test values give 5.5, which a true median also gives — medium, patched (order `[9, 4, 1, …]` → 6.5 in `normalise.test.ts` and `price-entry.test.ts`).
- Blind Hunter: no test has an unrated currency outside the priced pair — medium, patched (new `no-exchange-rate` case with chaos third).
- Blind Hunter: no test shows that the pair skips unreadable results — low, patched (the null-listings test now asserts `priceDivine: 2`).
- Blind Hunter: the `toDivine` JSDoc describes a caller, not the function — low, patched.
- Blind Hunter: the `priceDivine` description restates AD-16 — low, patched to cite AD-16.
- Blind Hunter: `priceOf` slices the first two and guards empty twice — low, rejected: the guard narrows the type for the exchange fallback, and the change removes nothing a reader would trip on.
- Blind Hunter: the spec has no Verification section and is `in-progress` — false: the oneshot route drops those sections by design, and the status is set at finalize.
- Blind Hunter: the fixture comment derives only two of the six values — low, rejected: comments stay at three lines at most (AGENTS.md), and the captures are listed in Implementation Notes.
- Blind Hunter: `expansion.test.tsx` compares against the constant, not the literal copy — low, rejected: the agent-browser check pins the literal string.
- Deferred Ledger Auditor: no findings.
- Impeccable Design Reviewer: no findings.
