# Epic 3 Context: The Crafted Ranking, on a Real Weights File

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Epic 3 adds the crafted branch to the page that Epic 2 shipped. The player reads Item Classes ranked by threshold-truncated expected value under a Craft Recipe the player chooses. These rows sit in one list with the Raw Base rows. Each crafted row names the Combinations worth chasing on it. The Craft Cost, which the player pays on every attempt, prints once. Every figure states whether it rests on measured weights or on an invented prior. The classes the tool cannot rank honestly go to the appendix with their reason. This is the product's central bet: the ranking is not "most expensive base". All of it rests on a Weights File that another project produces. The app consumes that file, validates it, and never writes it.

## Stories

- Story 3.1: Consuming a schema-conformant Weights File and its pool-completeness contract
- Story 3.2: The probability term: a tier's interval, containment, and the entry's floor
- Story 3.3: The five cross-file checks, defined once and run by both shells
- Story 3.4: The crafted EV, Craft Cost and the Craft Recipe control
- Story 3.5: Chase Combinations on the collapsed crafted row
- Story 3.6: Provenance, the uniform-prior banner, and the appendix's remaining reasons

## Requirements & Constraints

- Epic 3 owns acceptance of FR-1, FR-2, FR-4, FR-10, FR-11, FR-16, FR-22 and FR-26 to FR-30. It applies the top-20 bound of FR-5 per branch when the recipe is uncostable. It moves the 100 ms budget of NFR-6 onto the full `(Item Class × recipe)` cross product. A measurement must support that budget. If the budget is missed, fix it with memoisation in `core`. Do not precompute in `sync`.
- Crafted EV is the sum of `P(combo) × price(combo)` over the priced, unpruned Combinations whose **gross** price is at or above the threshold. Subtract Craft Cost **once** per class. A class with no surviving summand ranks at `−craftCost` with an empty summand list. That class is ranked, not Unrankable.
- A missing figure is never `0`. Each of these produces a reason and never a zero: an uncostable recipe, an empty containment set, an empty pool after the recipe floor, and an augment with no eligible entry.
- The three appendix reasons print verbatim: `pool partial`, `class absent from weights file`, `class disagrees with weights file`. One string covers all five cross-file checks. Do not extend the enum of FR-4. States 35 and 36 and the empty `complete` pool are findings for the PRD.
- v1 ships exactly two recipes: greater transmute plus greater augment, and perfect transmute plus perfect augment. The committed `data/recipes.json` holds no recipe today.
- Tests stay offline. Copy `test/setup.ts` with its recording `onUnhandledRequest` callback. Use the agent-browser skill, with a named `--session` on every call.

## Technical Decisions

- **Weights contract (AD-11).** Accept `WEIGHTS-FILE-SCHEMA.md` `6.1.0`. It is additive over `6.0.0`, but a reader that knows only `6.0.0` refuses `weightSource: "not-in-game"`. Refuse `5.x` as an unknown major. Refuse the whole file on any hard error. Never load part of it. One entry is one tier of one modifier. It holds `sourceModifierId`, `modGroup`, `itemLevelMin`, `weight`, `weightSource` and nested `lines[]`, and each line holds a `statId` or `null` and its `ranges` verbatim. Keep the lines nested, because co-occurrence cannot be rebuilt after they are flattened. A `not-in-game` tier must carry `weight: 0` and stays in the pool. A `null` line is data. `core` never infers `partial` from a `null` line. `partial` comes only from the declaration of the producer. `ModifierWeight` has one Zod schema in `contracts`. `core` reads `sourceModifierId` only for the duplicate check, and `modGroup` only for exclusion.
- **Probability (AD-17, IMPLEMENTATION-NOTES §1, §9, §11).** One exported function derives the interval of a line. Edge comparisons use exact equality. Containment is whole-tier. **An entry with weight `0` is never contained**, whatever its source. It still counts in the denominator, where it adds nothing, and it still enters the Provenance fold. Thus a weight-0 tier changes no kind, edge or empty-containment verdict. A band that covers only weight-0 tiers fails the empty-containment check. It does not rank at `P = 0`. `pool(cat, slot)` is a direct lookup and has no fallback to a sibling class. The order of steps is scope, then the recipe-floor truncation, then exclusion by `modGroup`, then renormalisation. The recipe floor is one axis: `recipe.modifierLevelMin ≤ tier.itemLevelMin ≤ entry.itemLevelMin`. All crafted entries on one class share one declared `itemLevelMin`. `P = 1` for an absent affix. Only §11's positive-weight guard passes over a weight-0 draw.
- **Empty pool = total weight `0`** (IN §3, AD-17). A slot that holds only weight-0 tiers, for example only `not-in-game` tiers, is empty. The same test applies in three places: `covered` in the coverage figure, the third exclusion cause of AD-17, and `W = 0` of §9 after the floor.
- **Cross-file checks (AD-17, §2.1 to §2.6).** Edge alignment, empty containment, `coOccur`, kind agreement and class discriminability are pure functions in `core`, defined once. `web` runs them at load. It excludes only the affected class and still renders. `sync` runs them as a run-start gate. There it exits non-zero before it spends budget, leaves `sync-progress.json` untouched, and records the payload in `sync-report.json`. Each payload names the entry by its canonical key.
- **Ordering (AD-17, AD-4).** `core` ranks every `(class, recipe)` pair in one ordering. Ties break first on the serialised canonical key and then on the recipe id. At an equal EV, raw sorts before crafted. `web` filters to the active recipe and then applies the top-20 bound. `core` orders summands by contribution descending, with ties broken on the canonical entry key. Test the tie-break against the ordering of `core`, not through the view.
- **Craft Cost (AD-20, AD-19).** `core` derives Craft Cost from the `CurrencyRate` set in `dataset.json`, where the rate is Divine per unit. A missing rate, or a rate from another league, makes the recipe uncostable. `sync` never computes Craft Cost.
- **Provenance (AD-10, revision 23).** The mapping is `published` → `measured`, `not-in-game` → `measured`, and `absent` → `uniform-prior`. Provenance `absent` comes only from a `partial` pool. Each figure carries the weakest Provenance and the oldest timestamp of its inputs. **The inputs of a probability are exactly the entries its formula sums**: the eligible set of the recipe over both slots, `E_P ∪ E_S`, for each tracked entry of the `(itemClass, recipe)` pair. A tier below the floor of the recipe is not an input. The label therefore belongs to the pair, and two recipes on one class can carry different labels. A `partial` pool gives `absent` under every recipe. An unrankable pair has no Provenance, except a `partial` pool. Any mark in the appendix is a UX treatment of the reason. The page has two render treatments, and colour never carries one alone.
- **Runtime artifacts (AD-24).** `web` fetches exactly seven artifacts, each a separate `no-cache` request with no query token. `catalogue/static.json` is not one of them, and the denomination `Divine` is a product literal. A 404 is *absent*, not *did not arrive*. Epic 3 adds no artifact; an eighth needs an amendment.
- **Coverage (AD-27, §3).** `sync` computes coverage over rankable classes, as a fraction in `[0,1]` with its denominator. `web` only renders it. If weights are absent, omit both fields, and never render the omission as `0%`.

## UX & Interaction Patterns

- **Craft Recipe control.** It prints `greater | perfect`. Each word is the grade prefix that the currency ids of the recipe share. A recipe with no grade prefix reads `regular`. Mixed grades in one recipe, or two recipes that derive the same word, make the recipe set invalid, and it takes the existing refusal screen. No display name is coined, and `recipes.json` gets no display field. The inactive word has a dotted sepia rule at rest and a solid rule on hover. The active word has a 2px solid rule and is not a click target. Do not use Mantine `SegmentedControl`, `Select`, `Radio` or `Switch`. A click re-ranks synchronously, with no debounce (state 34). Ranks, EVs, chase sets and Provenance marks change in the same pass, and the mark changes silently. Open panels stay open. The choice persists in browser storage beside the threshold. Craft Cost prints once below the options: `Divine / craft` at 2dp, or *no figure yet* when the recipe is uncostable.
- **Chase cells.** A collapsed crafted row shows at most three, inside the 492px budget. Each cell is the Accepted Tier plus a canonical short form per affix, joined by a middle dot. A cell never shows a value. A modifier with no short form (a product gap) or no declared Accepted Tier (a curation gap) falls back to the catalogue stat name plus its value band, in the mono verbatim register, the same cue as the cross-file diagnosis. Raw rows keep their italic note in place of chase cells.
- **State 35 (uncostable recipe).** Every row stays. The two branches keep separate orders, and no rank numerals print. The bound is 20 per branch. Crafted EV cells read *no figure yet*, and a declarative above the list names the recipe. **State 25:** crafted rows tie at `−craftCost`, and numerals print.
- **Cross-file diagnosis.** It is a sixth group in the sync report panel: the third group in the second column, in the mono verbatim register. It never appears in the trust strip or the appendix.
- **Provenance marks.** The label is one per `(Item Class, recipe)` pair. `uniform-prior` reads *prior only* and `absent` reads *unknown*. The words of `weightSource` never print. The uniform-prior banner has an ochre marker and can be dismissed for the session. It counts only the pairs of the active recipe, so a recipe switch can raise or lower it. Extend the appendix from Story 2.8. Do not rebuild it.

## Cross-Story Dependencies

- The order is 3.1 → 3.2 → 3.3 → 3.4 → 3.5 / 3.6. Stories 3.1, 3.2 and 3.3 are done. The five cross-file checks run in `web` at load, in the `sync` run-start gate and in `pnpm tracked:check`. Story 3.6 adds to the appendix structure from Story 2.8.
- Deferred work that Epic 3 must discharge:
  - An inverted band (`valueMin > valueMax`) returns `p = 0` with no reason. Add a refine, or name the check that owns it.
  - Rewrite the Epic 2 dek in EXPERIENCE.md, `Masthead.tsx` and `App.test.tsx` together.
  - Give crafted `unresolvable` rows the state-4 treatment.
  - The stories that build the third cause and coverage owe the `W = 0` emptiness test.
  - The tracked-json skill must say that `cross-file: skipped` also exits 0, and that a class that is absent or `partial` gets no pool checks.
- Rulings to raise, not to settle:
  - Architect: IMPLEMENTATION-NOTES takes ownership of the recipe-word predicate that the 3.4 Decision settled. See the story 3.4 `[NOTE FOR ARCHITECT]` in `deferred-work.md`. The 3.4 craft-recipe AC also has no branch for `regular` or for the refusal. The PM owes that wording.
  - Architect: where the short-form table lives (before 3.5), and the inputs of the crafted Age cell (before 3.5 and 3.6).
  - Architect: the `pending` sentence in *Parallel worktrees* of `AGENT-WORKFLOW.md` is stale since 3.3.
  - UX: the provisional cross-file diagnosis line format and the empty-group behaviour, and the other `[NOTE FOR UX]` items in `deferred-work.md`.
