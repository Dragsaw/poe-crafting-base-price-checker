# Epic 3 Context: The Crafted Ranking, on a Real Weights File

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Epic 3 adds the crafted branch to the page Epic 2 shipped. The player reads Item Classes ranked by threshold-truncated expected value under a Craft Recipe the player chooses, interleaved with the Raw Base rows in one list. Each crafted row names the Combinations worth chasing on it, and the Craft Cost, which the player pays on every attempt, prints once. Every figure states whether it rests on measured weights or on an invented prior. The classes the tool cannot rank honestly sit in the appendix with their reason. This is the product's central bet: the ranking is not "most expensive base". All of it rests on a Weights File that another project produces. The app consumes that file, validates it, and never writes it.

## Stories

- Story 3.1: Consuming a schema-conformant Weights File and its pool-completeness contract
- Story 3.2: The probability term: a tier's interval, containment, and the entry's floor
- Story 3.3: The five cross-file checks, defined once and run by both shells
- Story 3.4: The crafted EV, Craft Cost and the Craft Recipe control
- Story 3.5: Chase Combinations on the collapsed crafted row
- Story 3.6: Provenance, the uniform-prior banner, and the appendix's remaining reasons

## Requirements & Constraints

- Epic 3 owns acceptance of FR-1, FR-2, FR-4, FR-10, FR-11, FR-16, FR-22 and FR-26–FR-30. It applies FR-5's top-20 bound per branch under an uncostable recipe, and it re-sites NFR-6's 100 ms budget onto the full `(Item Class × recipe)` cross product. A measurement must stand behind that budget. A miss is fixed by memoising in `core`, and never by precomputing in `sync`.
- Crafted EV is the sum of `P(combo) × price(combo)` over the priced, unpruned Combinations whose **gross** price is at or above the threshold, minus Craft Cost **once** per class. A class with no surviving summand ranks at `−craftCost` with an empty summand list. It is ranked, and not Unrankable.
- A missing figure is never `0`. An uncostable recipe, an empty containment set, an empty pool after the recipe floor and an augment with no eligible entry each produce a reason, and never a zero.
- The three appendix reasons print verbatim: `pool partial`, `class absent from weights file`, `class disagrees with weights file`. One string covers all five cross-file checks. Do not extend FR-4's enum: states 35 and 36 and the empty-`complete` pool are findings for the PRD.
- Tests stay offline. Copy `test/setup.ts` with its recording `onUnhandledRequest` callback. Use the agent-browser skill with a named `--session` on every call.

## Technical Decisions

- **Weights contract (AD-11).** Accept `WEIGHTS-FILE-SCHEMA.md` `6.0.0`, and refuse `5.x` as an unknown major. Refuse the whole file on any hard error, and never load part of it. One entry is one tier of one modifier: `sourceModifierId`, `modGroup`, `itemLevelMin`, `weight`, `weightSource` and nested `lines[]` (each line has a `statId` or `null`, and its `ranges` verbatim). `ModifierWeight` gets one Zod schema in `contracts`, and its type is `z.infer`red. Keep the lines nested, because co-occurrence cannot be rebuilt once they are flattened. `core` reads `sourceModifierId` only for the duplicate check at load, and reads `modGroup` only for exclusion. `gamePatch` is opaque. Nothing audits a dropped tier or line: a `complete` pool is trusted as declared. Today `WeightsFileEnvelopeSchema` checks only the header, and the `web` loader must switch to the full schema.
- **Probability (AD-17, IMPLEMENTATION-NOTES §1, §11).** One exported function derives a line's interval: empty `ranges` is valueless, one `#` gives `[a,b]`, two `#` give midpoints, three or more are a file error. Edge comparisons use exact equality, with no epsilon. Containment is whole-tier: a contained entry adds its weight once to the numerator, and a partly covered entry adds nothing but still counts in the denominator. `pool(cat, slot)` is the direct lookup `bases[categoryId][className][slot]`, with no fallback to a sibling class. Scope is `tier.itemLevelMin ≤ entry.itemLevelMin`. A Combination draws the transmute from prefix and suffix combined by weight, then the augment from the other slot minus the first affix's `modGroup`. The order is scope, recipe-floor truncate, exclude, renormalise. `P = 1` for an absent affix.
- **Floors (AD-17, §8, §9).** All crafted entries on one class share one declared `itemLevelMin`, and nothing derives it. A recipe tier is eligible when `recipe.modifierLevelMin ≤ tier.itemLevelMin ≤ entry.itemLevelMin`, which is one axis. `modifierLevelMin: 0` runs the same predicate. The truncation runs after containment, and coverage is measured on the unrestricted pool.
- **Cross-file checks (AD-17, §2.1–§2.6).** Edge alignment, empty containment set, `coOccur`, kind agreement and class discriminability are pure functions in `core`, defined once. `web` runs them at load, excludes only the affected class, and still renders. `sync` runs them as a run-start gate: it aborts non-zero before spending budget, leaves `sync-progress.json` untouched, and records the payload in `sync-report.json`. The within-file overlap branches belong to `contracts`. `coOccur` is `false` for an absent or `partial` class. Each payload names the entry by its canonical key.
- **Ordering (AD-17, AD-4).** `core` ranks every `(class, recipe)` pair in one ordering. Ties break on the serialised canonical key, then the recipe id, and raw sorts before crafted at an equal EV. `web` filters to the active recipe and applies the top-20 bound after that filter. `core` returns summands ordered by contribution descending, with ties on the canonical entry key. `web` renders only a prefix of that list. Test the tie-break against `core`'s ordering, not through the view.
- **Craft Cost (AD-20, AD-19).** `core` derives Craft Cost from `dataset.json`'s `CurrencyRate` set, where `rate` is Divine per unit. A missing rate or a rate from another league makes the recipe uncostable. `sync` never computes Craft Cost. Recipes are hand-declared data in `data/recipes.json`, which today holds none, and v1 ships exactly two.
- **Provenance (AD-10).** Each figure carries the weakest Provenance and the oldest timestamp of all its inputs. A probability's inputs are every entry in the scoped pool. `weightSource: "absent"` maps to `uniform-prior`. Provenance `absent` comes only from a `partial` pool, so it appears only in the appendix. The page has two render treatments, and colour never carries one alone.
- **Coverage (AD-27, §3).** `sync` computes coverage over rankable classes, as a fraction in `[0,1]` with its denominator, and `web` only renders it. If weights are absent, omit both fields, and never render the omission as `0%`.

## UX & Interaction Patterns

- **Craft Recipe control.** It prints `greater | perfect` with a pipe separator. The inactive word has a dotted sepia rule at rest, solid on hover. The active word has a 2px solid rule and is not a target. Do not use Mantine `SegmentedControl`, `Select`, `Radio` or `Switch`. A click re-ranks synchronously with no debounce. Ranks, EVs and chase sets change together, and open panels stay open. The choice persists in browser storage beside the threshold. Craft Cost prints once, below the options, with `Divine / craft` at 2dp, or *no figure yet* if uncostable. The expansion context line repeats the active recipe.
- **Chase cells.** At most three per collapsed crafted row, in the 492px budget. Each cell is the Accepted Tier plus a canonical short form per affix, joined by the middle dot, and never a value. Raw rows keep their italic note in place of chase cells.
- **State 35 (uncostable recipe).** Every row stays. The two branches keep separate orders, and no rank numerals print. Tier treatments apply per branch. The bound is 20 per branch, each with its own expand affordance. Crafted EV cells read *no figure yet*, and a declarative above the list names the recipe.
- **State 25.** Crafted rows tie at `−craftCost`, and the numerals print.
- **Cross-file diagnosis.** It is a sixth group, the third in the second column of the sync report panel, separated by space alone. It is a list in the mono verbatim register, the same cue as the curation fallback. It never goes to the trust strip or the appendix.
- **Provenance marks.** `uniform-prior` reads *prior only* and `absent` reads *unknown*, and neither prints `weightSource` words. The uniform-prior banner (ochre marker, dismissible for the session) rises when no `measured` probability is loaded. The appendix structure from Story 2.8 is extended, not rebuilt.

## Cross-Story Dependencies

- 3.1 → 3.2 → 3.3 → 3.4 → 3.5 / 3.6. Story 3.3 extends `SyncRunReport` if it cannot carry the per-check lines. Story 3.6 adds the appendix reasons and notes on top of Story 2.8's structure.
- Deferred work that Epic 3 must discharge:
  - Switch the `web` loader to the full weights schema (3.1).
  - Wire the checks into `sync`'s `checkTracked` (3.3).
  - The Emerald band will fail empty containment (3.3).
  - Rewrite the Epic 2 dek in EXPERIENCE.md, `Masthead.tsx` and `App.test.tsx` together.
  - Give crafted `unresolvable` rows the state-4 treatment.
  - `listStatement` and the list-statement slot must handle state 25 with crafted rows, and state 35 as a third statement.
- Open architect and UX rulings to raise, not to settle:
  - The home of the short-form table (before 3.5).
  - The crafted Age cell inputs (before 3.5 and 3.6).
  - The recipe option-word derivation (before 3.4).
  - The `[NOTE FOR UX]` items in `deferred-work.md`.
