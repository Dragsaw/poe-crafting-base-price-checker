# Sprint Change Proposal — the price estimate is the mean of the first two listings

- **Date:** 2026-10-11
- **Trigger:** user direction, "the price should be calculated based on the average of two cheapest options"
- **Mode:** batch
- **Scope:** Minor. Direct adjustment. No story is inserted, removed or reordered.

## 1. Issue summary

The price of a Tracked Entry is the lower median of the ten cheapest live instant-buyout listings (FR-21, AD-16). The player wants the price to be the average of the two cheapest listings instead. A median of ten sits in the middle of the cheap end of the book. The two cheapest are the price a player pays to buy now, and that price is what a crafter compares against.

User decisions, taken 2026-10-11:

| Question | Decision |
| --- | --- |
| Which two listings | The **first two results in the trade site's ascending order**, after unreadable results are dropped. Not a re-sort of the ten in Divine. |
| One listing returned | The price is that listing. One listing stays a valid sample. |
| Fetch size and `sampleSize` | Fetch 10, as now. `sampleSize` stays the count of listings returned, so the *thin* trust signal (under 3 listings) keeps measuring market depth. |

## 2. Impact analysis

**Epics and stories.** All four epics are `done`. Story 1.7 owns the pricing step, and one of its ACs restates the lower-median rule. That AC changes in place. No story is added, so the *A change to the stories of an epic* steps (AGENT-WORKFLOW.md) do not apply, and the `on_complete` story-order step is skipped.

**Artifact conflicts.**

| Artifact | Location | Conflict |
| --- | --- | --- |
| `prd.md` | FR-21 statement line | States "the median of the cheapest". This is a business rule that changes the ranking, so the PRD states it. |
| `ARCHITECTURE-SPINE.md` | AD-16 rule paragraph on the `PriceObservation`; AD-16 accepted effects; one cross-reference in the currency-refresh AD | Lower median, and the claim "every persisted price is a price someone actually asked". The exchange observation rule assumes one listing behind the price. |
| `epics.md` | Story 1.7, the "returned sample" AC | Restates the lower median. |
| `EXPERIENCE.md` | Copy Deck, *Expansion context line*; Interaction walkthrough step 3 | "All prices below are real listings." A mean of two listings is not itself a listing. |
| `epic-1-context.md` | Pricing bullet | "The estimate is the lower median." |
| Code | `normalise.ts` `lowerMedian`; `price-entry.ts` `priceOf`; `sync/src/index.ts` export; `contracts/src/price-observation.ts` `priceDivine` description; `web/src/list/format.ts` `ESTIMATED_ODDS_CONTEXT`; their tests | Implementation of the rule. |
| `openwiki/` | `sync/pricing-step-and-league-gate.md` | Generated. Do not hand-edit. The scheduled workflow refreshes it. |

**Not affected.** FR-13 and AD-12 (every price is an asking price) still hold: a mean of two asking prices is an asking price, not a sale. The *thin* rule in EXPERIENCE.md *Price trust* is unchanged because `sampleSize` keeps its meaning. The search body, the fetch of 10, request cost, `no-listings`, `no-exchange-rate` and the weights file are unchanged.

**Technical impact.** Every published price moves at the next sync. In a deep market the mean of the two cheapest is lower than the lower median of ten, so EVs fall and the order can change. There is no schema or version change. `priceDivine` keeps its type, and only its description changes.

**Risks.**

1. **Noise.** Two listings are noisier than ten. One undercut listing now moves the price about half its gap. Instant-buyout listings priced below market get bought quickly (brief addendum), which limits this but does not remove it.
2. **Per-currency sort.** AD-16 already accepts that the site sorts ascending within each currency. With a median of ten this mostly washed out. With the first two results, a mixed exalted/divine result set can pair listings that are not the two cheapest in Divine. The user chose this deliberately. It is recorded as an accepted effect, not mitigated.
3. **Lost property.** Persisted prices are no longer always a price someone actually listed.

## 3. Recommended approach

**Direct adjustment.** Edit the four owner documents, then implement the change with `bmad-build` as one change against Story 1.7's AC.

- **Effort:** small. About one pure function, one call site, one schema description, one UI string and their tests.
- **Risk:** low for the code, medium for the product (see the risks above). Reversible by reverting one commit.
- **Timeline:** no epic reopens.

## 4. Detailed change proposals

### 4.1 PRD — `prd.md` FR-21 (revision 29 → 30)

OLD:

> *Architecture-owned.* For each Tracked Entry, one search and one fetch produce one Price Observation: the median of the cheapest live instant-buyout listings matching that entry, in Divine (AD-16).

NEW:

> *Architecture-owned.* For each Tracked Entry, one search and one fetch produce one Price Observation: the mean of the two cheapest live instant-buyout listings matching that entry, in Divine, or the one listing's price when only one is found (AD-16).

The FR-21 title ("Estimate a price from the cheapest live instant-buyout listings") and its consequences stay. The PRD names "the two cheapest". Which two the site counts as cheapest is AD-16 mechanism.

### 4.2 Spine — `ARCHITECTURE-SPINE.md` (revision 37 → 38)

**AD-16, the `PriceObservation` paragraph.**

OLD:

> The `PriceObservation` is the **median of those listings' prices after normalisation to divine** (AD-20), recorded with the sample size actually returned. **On an even sample the median is the lower of the two middle values, never their mean** — ten results is the normal path, so this is not an edge case, and the lower value keeps every persisted price a price someone actually asked.

NEW:

> The `PriceObservation` is the **mean of the first two listings in the result order, each normalised to divine** (AD-20), and the one listing's price when only one is returned. It is recorded with the sample size actually returned, not two: the other listings are fetched and counted, never priced, so `sampleSize` measures depth for the trust rule. The mean is taken over unrounded divine values and rounded once. Its exchange observation is the rate of the first of the two listings not in divine, or divine's own rate when both are in divine.

**AD-16, the accepted effects paragraph.** Append after the per-currency sort sentence ("…rather than removing it."):

> Because the price is the first two results, this effect reaches the price directly: in a result set that spans both currencies, the pair priced may not be the two cheapest in divine. This is accepted, and `sync` does not re-sort.

**Currency-refresh AD, cross-reference.**

OLD: `and AD-16's median is taken over prices **already normalised to divine**,`

NEW: `and AD-16's estimate is taken over prices **already normalised to divine**,`

### 4.3 Epics — `epics.md` Story 1.7

OLD:

> **Given** a returned sample of listings
> **When** `sync` takes the median
> **Then** on an even sample the median is the lower of the two middle values, and never their mean. Every persisted price is therefore a price someone actually asked (AD-16; `lowerMedian` in `packages/sync/src/pricing/normalise.ts`).

NEW:

> **Given** a returned sample of listings
> **When** `sync` takes the estimate
> **Then** the price is the mean of the first two listings in the result order, after normalisation to Divine
> **And** with one listing the price is that listing's
> **And** `sampleSize` is the count returned, not the two that were priced (AD-16; `normalise.ts` in `packages/sync/src/pricing/`).

### 4.4 UX — `EXPERIENCE.md`

**Copy Deck, *Expansion context line*.**

OLD: `… All prices below are real listings.`

NEW: `… All prices below come from real listings.`

**Interaction walkthrough, step 3.**

OLD: `every price below is a real listing.`

NEW: `every price below comes from real listings.`

The sentence exists to contrast measured prices with estimated odds. "Come from" keeps that contrast without claiming that each price is one listing.

### 4.5 Epic context — `docs/stories/epic-1-context.md`

OLD: `The estimate is the lower median (§4.3).`

NEW: `The estimate is the mean of the first two listings (AD-16).`

This is a content edit, not a story-order change, so a hand patch is allowed.

### 4.6 Code (handoff to `bmad-build`)

- `packages/sync/src/pricing/normalise.ts`: replace `lowerMedian` with a pure function that returns the mean of the first two values, or the one value, and throws on an empty input.
- `packages/sync/src/pricing/price-entry.ts` `priceOf`: keep the result order (no sort), price from the first two normalised listings, take the exchange observation per AD-16, and keep `sampleSize: normalised.length`. One unrated currency among the ten still gives `no-exchange-rate`, as AD-20 says.
- `packages/sync/src/index.ts`: update the export.
- `packages/contracts/src/price-observation.ts`: change the `priceDivine` description to cite the new AD-16 rule.
- `packages/web/src/list/format.ts` `ESTIMATED_ODDS_CONTEXT`: apply the 4.4 copy.
- Tests: `normalise.test.ts` and the `price-entry*.test.ts` files whose expected `priceDivine` values move. Add cases for a mixed exalted/divine pair (the exchange observation choice), one listing, and unsorted input (no re-sort). Check the fixture-driven tests against the recorded captures.

## 5. Implementation handoff

- **Classification:** Minor. The Developer agent implements it directly.
- **Commit 1 (docs):** this proposal plus edits 4.1 to 4.5, with PRD revision 30 and spine revision 38. The commit message gives the rationale and names the rejected alternative: re-sort the ten in divine and take the two lowest.
- **Commit 2 (code):** `bmad-build` on 4.6. Done gate: `pnpm check`. Run an agent-browser check of the expansion context line on `pnpm dev`.
- **Success criteria:**
  - Every `priced` entry's `priceDivine` equals the mean of its first two returned listings in divine, rounded once to 4 dp.
  - `sampleSize` is unchanged for the same captures.
  - The thin marker fires exactly as before.
  - No document outside the generated `openwiki/` still states the lower median as the rule.
