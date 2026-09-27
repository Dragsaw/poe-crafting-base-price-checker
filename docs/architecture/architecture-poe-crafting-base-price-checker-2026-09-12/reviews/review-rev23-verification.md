# Review — spine revision 23, verification lens

- **Target:** `ARCHITECTURE-SPINE.md` revision 23 (working-tree diff against `a5184dc`)
- **Lens:** every committed decision is reality-checked, not asserted: each claim the
  amendment makes is true of the existing project.
- **Date:** 2026-09-27
- **Verdict:** **issues** — the two headline claims are true, but one justification is
  false of the committed data, and the amendment leaves an AD-11 sentence that the `6.1.0`
  contract it now cites contradicts.

## What the amendment claims, and what reality says

| # | Claim (spine line) | Checked against | Result |
| --- | --- | --- | --- |
| C1 | `6.1.0` is additive over `6.0.0` (754) | `WEIGHTS-FILE-SCHEMA.md:32-37` | **True.** "Additive. No field is added, removed or reshaped." |
| C2 | A `6.0.0`-only reader refuses `not-in-game` (754-755) | `WEIGHTS-FILE-SCHEMA.md:35-37`, `:298` | **True.** The `6.0.0` hard-error list rejects any `weightSource` except `published`/`absent`. |
| C3 | `core` implements `6.1.0` (755) | `packages/contracts/src/weights-file.ts:24`, `:56-68` | **True.** `WEIGHTS_SCHEMA_VERSION = '6.1.0'`. The enum accepts `not-in-game`. The non-zero-weight hard error is enforced. Tests: `weights-file.test.ts:93`, `:140`, `:232`. The version compare checks only the major, so the `6.0.0` fixtures in `rank.test.ts:39`, `artifact-server.ts:57` and other tests still load. That is correct. |
| C4 | A `not-in-game` tier's `weight` is `0` (710) | `WEIGHTS-FILE-SCHEMA.md:41`, `:43`, `:281-282`, `:299` | **True.** The producer forces `weight` to `0`, and a non-zero weight is a hard error. |
| C5 | The tier "stays in the scoped pool like any other entry" (712-713) | `packages/core/src/probability.ts:126-132`, `:143-145` | **True of the code.** `eligible()` filters on `itemLevelMin` only, and `containedIn()` does not read `weightSource`. `orderedTerm` (`:202-204`) skips a weight-0 first draw in the **numerator sum** only, and `probability.test.ts:202-209` tests exactly that with a `not-in-game` tier. That skip is arithmetic, not a provenance exclusion. |
| C6 | No code maps `weightSource` → Provenance differently | `grep` of `packages/*/src` | **True, and vacuous.** No code maps `weightSource` to Provenance yet. That work is Story 3.6, which is still `backlog` in `sprint-status.yaml:69`. `uniform-prior` appears only in `web` view strings and tokens. |
| C7 | A `0` from `not-in-game` is "the same kind of fact as a published `0`" (710-712) | `WEIGHTS-FILE-SCHEMA.md:41`, `:281`; `git diff d12e8ac 43c9f5c -- data/weights.json` | **False as stated.** See F1. |
| C8 | Context diagram and source-tree comment say `6.1.0` (1830, 1915) | `data/weights.json` | **True.** `schemaVersion: "6.1.0"`, producer `6.1.0`, generated `2026-09-27T17:38:24.207Z`. |

**The real data** (`data/weights.json`): 59 classes, 118 pools, 0 `partial`, 8,437 entries.
The `weightSource` counts are `published` 6,434, `absent` 1,995 and `not-in-game` 8.
All 8 `not-in-game` tiers are on `jewel` classes, with `itemLevelMin` 1 and one `statId: null` line each:

- `IncisionChance` prefix: Diamond, Ruby, Time-Lost_Diamond, Time-Lost_Ruby
- `DazeBuildup` suffix: Diamond, Emerald, Time-Lost_Diamond, Time-Lost_Emerald

This matches the schema's statement (`WEIGHTS-FILE-SCHEMA.md:45-46`). **Every other entry of
these 8 pools is `weightSource: "absent"`.** For example, Diamond prefix has 70 entries: 69
`absent` and 1 `not-in-game`. So each of these pools reads `uniform-prior` under any mapping,
and the new mapping changes no figure on the committed file. The decision is sound, but it is
not observable today, so no test on the real file can show that it is honoured.

## Findings

### F1 — The "same kind of fact as a published `0`" justification is false of the source (medium)

`ARCHITECTURE-SPINE.md:710-712` says that the `0` is "the same kind of fact as a published
`0`". The contract says the opposite. A published `0` is poe2db's `DropChance`, verbatim
(`WEIGHTS-FILE-SCHEMA.md:281`). A `not-in-game` `0` is "the **one** exception to publishing
`DropChance` verbatim", taken "whatever poe2db published" and set "only from the producer's
hand-kept list" (`:41`, `:281-282`). The git history confirms this for the committed file.
In the `6.0.0` file (`d12e8ac`), each of these 8 tiers was `weight: 1, weightSource:
"absent"`: poe2db had published a filler and no real weight. The `0` is therefore a curated
producer assertion. It is not a published measurement, so it is not what the AD-10 table
calls "measured by someone".

The mapping to `measured` is still the right decision. It is the top rank, so the tier can
never weaken the fold, and a tier that cannot roll adds `0` to every sum. Mapping it to
`uniform-prior` would falsely degrade an otherwise `published` pool. **Fix:** keep the
mapping and replace the equivalence claim with the true reason. Suggested text: "the
producer asserts that the tier cannot roll; the weight is not invented, and a `0` adds
nothing to any sum, so the tier cannot make a figure less trustworthy."

### F2 — AD-11 still says a `null` statId is "never a reason to declare a pool `partial`", which `6.1.0` contradicts (medium)

`ARCHITECTURE-SPINE.md:772-773`: "A `null` `statId` is data, never a file error, and never a
reason to declare a pool `partial`." The contract that revision 23 now cites says the
opposite. "**(`6.1.0`) A `statId: null` line makes its pool `partial`** unless the producer's
hand-kept list marks it `not-in-game` … or as an internal engine line"
(`WEIGHTS-FILE-SCHEMA.md:171-173`). The same rule is at `:284`: "any other `null` line makes
its pool `partial`." Reality follows the contract. The 8 jewel pools were `partial` in the
`6.0.0` file and are `complete` in the `6.1.0` file only because their `null` lines are now
marked. Revision 23 updated the version citation 18 lines above this sentence and left the
sentence unchanged.

The two readings can be reconciled. For `core` (and IMPLEMENTATION-NOTES §3: "does not affect
coverage"), a `null` line is still data: `core` never derives `partial` from a `null` line,
and reads only the declared `poolCoverage`. For the producer, an unmarked `null` line now
obliges a `partial` declaration. **Fix:** scope the AD-11 sentence to `core`, for example "…
and `core` never derives `partial` from one; the producer's own obligation is
`WEIGHTS-FILE-SCHEMA.md` *The pool-completeness rule*." Do not restate the rule.

### F3 — AD-11 still names the `6.0.0` file as the one that satisfies the contract (low)

`ARCHITECTURE-SPINE.md:763-764`: "The producer-6.0.0 file of 2026-09-26 satisfies the
contract, verified across all 59 classes." The committed file is now the producer-6.1.0 file
of 2026-09-27. A `6.0.0` file cannot carry the `not-in-game` fact, so this is no longer the
file the rule describes. The paragraph around it (`:758`) is a history of `6.0.0`, which is
correct as history. But this last sentence is a claim about the present. **Fix:** cite the
`6.1.0` file (`WEIGHTS-FILE-SCHEMA.md:45-46` already states its facts) or mark the sentence as
history. Related: `:1270` says "true of all 59 classes on the 2026-09-26 file". I checked the
`6.1.0` file, and no `modGroup` spans both slots in any of its 59 classes. The claim is
therefore still true, but it cites a file that is no longer committed.

### F4 — Stale `6.0.0` citations outside the spine (low, out of the spine's scope)

- `docs/epics.md:1704-1705` (Story 3.1 AC): "accepts a file conforming to
  `WEIGHTS-FILE-SCHEMA.md` `6.0.0`". The code now accepts `6.1.0` (C3).
- `docs/epics.md:367` describes "a 6.0.0 file is committed".
- `WEIGHTS-FILE-SCHEMA.md:13` still says "`6.0.0` is adopted, as of spine revision 19", and
  says nothing of `6.1.0` adoption at revision 23.

None of these contradicts the new mapping. They are stale version citations in documents
that other owners hold. Record them in `docs/stories/deferred-work.md` or fix them in the
epics / schema pass. Do not fix them in the spine.

### F5 — The Story 3.6 ACs and PRD FR-10/FR-11 are consistent, and the mapping is unobservable on real data (info)

- `docs/epics.md:2329-2335` (Story 3.6): "weakest Provenance … of every input". Provenance
  "comes from the Weights File's own `weightSource`, and from nothing else". The mapping
  `not-in-game → measured` satisfies both: it derives from `weightSource`, and the tier
  remains an input. Nothing contradicts it.
- `prd.md:240-249` (FR-10) and `:252-261` (FR-11) are mechanism-free, and neither needs an
  edit. None of the five PRD triggers in AGENTS.md is hit, so the amendment correctly leaves
  the PRD alone.
- IMPLEMENTATION-NOTES §9 (`eligible` on `itemLevelMin` only) and §11 ("a zero `W_X∖g(·)`
  under a **positive** weight is a reason") agree with the kept tier. A pool whose only
  eligible weight is a `not-in-game` `0` gives `W = 0` and `empty-eligible-pool`, which is
  correct.
- Suggestion for Story 3.6: all 8 real `not-in-game` pools are otherwise all `absent` (see
  above), so the real file cannot tell a correct mapping from `→ uniform-prior` or from
  "skip". Story 3.6 needs a constructed test: a pool of `published` entries plus one
  `not-in-game` entry, which must read `measured`.

### F6 — Line wrap (nit)

`ARCHITECTURE-SPINE.md:755` runs past the file's ~90-column wrap
("`refuses its … so \`core\` implements \`6.1.0\`. Any producer that satisfies the contract
is acceptable, and the`"). Reflow the lines.

## Summary

The version bump is true everywhere it lands: the contract, the code, the tests and
`data/weights.json` all agree on `6.1.0`, and the context diagram and source tree are correct.
The `not-in-game → measured` decision is correct and matches the code. Its stated reason
(F1) is untrue of the source data. The revision also left an AD-11 sentence (F2) that the
contract it now cites contradicts. Fix F1 and F2 before the spine revision is final. F3 and
F4 are citation sweeps.
