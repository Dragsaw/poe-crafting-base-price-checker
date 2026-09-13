---
title: 'Agent Development Workflow'
status: draft
created: '2026-09-12'
updated: '2026-09-12'
governed_by: [AD-1, AD-2, AD-13]
---

# Agent Development Workflow

The brief makes three statements hard requirements and not preferences. First, an agent must test and debug the whole system with no human in the loop. Second, several agents must work in parallel git worktrees and must not conflict with each other. Third, the primary data source is a live, rate-limited third party, and that data source must never appear in the test path. This document tells you how the project keeps these three requirements true.

## The offline guarantee

**No test at any level makes a network call** (AD-13). This rule is the load-bearing property of the workflow. The rule lets an agent repeat the development loop at machine speed. The service would otherwise rate-limit the agent until the agent can do no useful work. The rule also makes a failed test mean "the code is wrong" and not "GGG was slow".

The project enforces the rule and does not trust the rule. The test setup installs an MSW server in `onUnhandledRequest: "error"` mode. A request without a matching fixture therefore fails the test with a loud error, and the request does not escape to the network.

An agent can therefore run the entire test suite with no network connection. No step in the loop below needs credentials, a network, or a human.

## The agent loop

```
pnpm install
pnpm check          # typecheck + lint + dependency-cruiser, all packages
pnpm test           # vitest, all packages, zero network
pnpm dev            # web against the committed dataset + fixtures
pnpm sync:dry       # run the sync pipeline against fixtures, write nowhere
```

`pnpm check` is the point that enforces the package boundaries. `dependency-cruiser` fails the build on an import in the wrong direction (AD-2). An agent that imports from `core` into `sync` therefore learns about the fault in seconds, and no reviewer is necessary.

`pnpm sync:dry` is the most important debugging tool. The command runs the full sync pipeline deterministically against recorded fixtures. The command writes a dataset and a run report to stdout, and writes nothing to disk. An agent can therefore examine the actions of the syncer and send no request to GGG.

## Fixtures

Fixtures are **real captured trade-API responses**. The project commits the fixtures under `fixtures/` (AD-13). Nobody writes a fixture by hand. A hand-written mock records what the team believes the API returns, and not what the API actually returns. A hand-written mock also continues to pass on the day the belief becomes wrong.

```
pnpm fixtures:record      # EXPLICIT, human-invoked, hits the live API
pnpm catalogue:refresh    # EXPLICIT, human-invoked, hits the live API (AD-25)
```

Neither command is part of a test run. An agent does not run either command unattended. The output of each command is a diff against the committed files. **That diff is the mechanism that makes a change by GGG visible.** A patch that changes the shape of a response appears as a change that a human can review. Such a patch does not appear as a production incident.

`catalogue:refresh` reads the four trade data endpoints and writes them into `data/catalogue/` (AD-25). Run `catalogue:refresh` when GGG releases a patch. Do not run `catalogue:refresh` on a schedule. A renamed stat id appears as a line in that diff. AD-6 checks the tracked list against the catalogue. That check gives the renamed stat id an `unresolvable` state instead of a silent mismatch.

Fixture hygiene:

- Keep one fixture for each distinct shape of API interaction. Name the fixture for the interaction, and not for the test that uses the fixture.
- Remove irrelevant bulk from a fixture, but never remove structure. Keep a field even when no code uses the field, because the loss of that field is a signal.
- Remove every personal identifier from a captured response at record time. Account names and character names are personal identifiers.

## Parallel worktrees

The package split (AD-2) is what makes parallel work possible. `contracts`, `core`, `sync` and `web` each own a separate directory. Each package has its own test suite. The dependency graph has no cycles and points in one direction. Two agents that work in two different packages change no common file.

Rules for the division of work across worktrees:

- **Give a task the scope of one package where possible.** A task that spans packages is a signal that a contract is missing. Such a task is not a signal that the boundary is wrong.
- **Make `contracts` changes one at a time.** Every other package depends on `contracts`. A change to `contracts` is therefore a wide rebuild and a probable conflict. Land a `contracts` change alone and first. Then rebase the dependent work onto that change.
- **Each file in `data/` has one writer (AD-21). That writer is never an agent's feature branch.** The player owns the hand-edited inputs `tracked.json`, `currencies.json`, `recipes.json` and `config.json`. The external scraper project owns `weights.json` (AD-11). The syncer owns the sync outputs `catalogue/*.json`, `dataset.json`, `sync-report.json` and `sync-progress.json`. An agent that needs different data uses a fixture. The agent does not edit a file in `data/`.
- **No worktree runs `pnpm sync` or `pnpm catalogue:refresh` against the live API.** Only the scheduled invoker on the player's machine runs a sync (AD-7, AD-8). The scheduled invoker holds an exclusive lock. A second run on any machine therefore exits immediately, and that behaviour is the intended design. An agent that must check sync behaviour runs `pnpm sync:dry`. A human refreshes the catalogue when GGG releases a patch. An agent that needs a different catalogue uses a fixture.
- **Never run `git add -A` in sync-related code.** AD-21 requires the syncer to commit only the files that the syncer owns. AD-21 also requires the syncer to name each of those files by an explicit path. An automated commit therefore never includes an unfinished curation edit.

## Determinism

An agent debugs badly when tests are unreliable. The design therefore excludes nondeterminism by structure and does not tolerate nondeterminism:

- `core` is pure. The caller passes time, randomness and config into `core` as values (AD-1). A `core` test maps literal inputs to literal outputs.
- The clock is a port. A test supplies a fixed instant. No code below the shell calls `Date.now()`.
- Sync ordering is deterministic for a given tracked list, dataset and clock value. AD-26 fixes the rotation order. The order is currency rates first, then `pinned` entries by oldest `lastAttemptedAt`, then `active` entries by oldest `lastAttemptedAt`, then a bounded number of `unresolvable` retries, and never `pruned` entries. `core` computes the order as a pure function. A dry run and a real run therefore select the same entries. The order uses **`lastAttemptedAt`, and never the observation time**. An entry that stays `no-listings` never gets an observation time. A rotation ordered by observation time would therefore select that entry again forever (AD-9).
- No test depends on wall-clock timing. A test checks rate-limit backoff with supplied header values, and never by waiting.

## What an agent needs to know before touching a package

| Package | Its job | The rule most likely to be broken |
| --- | --- | --- |
| `contracts` | Zod schemas, derived types, port interfaces | Types are `z.infer`red from schemas, never declared in parallel |
| `core` | Pure valuation, probability, provenance | No I/O, no clock, no randomness, no env — ever (AD-1) |
| `sync` | Trade client, rate-limit governor, chunk runner, catalogue refresher, dataset writer | One governed HTTP client only (AD-8); bounded work then exit (AD-7); rotation order comes from `core`, not from `sync` (AD-26); a stat filter's shape follows the reference's **kind** — a `banded` reference carries both `min` and `max`, a `valueless` one carries the stat id and **no edges at all**, and emitting a sentinel pair for a valueless stat silently prices the wrong population rather than erroring (AD-16, AD-5) |
| `web` | Static view, read-time ranking | No backend, no write path, no authenticated request (AD-15) |

## Build order

Two activities run in sequence and not in parallel. Both activities are easy to get wrong at a late stage.

1. **Build `contracts` first and alone.** Revision 2 changed `ModifierRef` to a band and added `itemLevelMin` to `TrackedEntry` (AD-5). Revision 4 makes `ModifierRef` a **discriminated union** of `banded` and `valueless`. Revision 4 also widens `provenance` to four values, and one of the four values is `modelled-split` (AD-10). Revision 4 also raises the weights file to `3.0.0`, and scopes the non-overlap rule of the weights file per `itemLevelMin` (AD-28). Revision 5 raises the weights file again to `4.0.0`. Revision 5 adds a required `sourceModifierId` on every weights entry, and scopes non-overlap by `sourceModifierId` as well (AD-29). Revision 6 raises the weights file to `4.1.0`. Revision 6 is a **non-breaking** minor change. Revision 6 adds the optional `statLineCounts` list and one new hard error: a `sourceModifierId` group that spans more than one `itemLevelMin` (AD-29). All of these changes are contract changes. Land the contract changes on their own, and then rebase all other work onto the contract changes. Land the union with the most care. An exhaustive `switch` over the two kinds is what stops `core` and `sync` from each inventing a different reading of the valueless case.

   Two `core` rules depend on `sourceModifierId`. Both rules are easy to build wrong, because the simple form of each rule looks right. First, **the pool denominator sums over distinct source modifiers, and not over entries** (AD-18). Second, **AD-17's `slotOverlap` treats two different `statId`s as overlapping when one source modifier publishes both `statId`s** (AD-29). Both rules are cross-file checks over `tracked.json` and `weights.json` together. Both rules therefore live in `core`, beside the straddle rule and the edge-alignment rule. Both rules do not live in `contracts`, because `contracts` sees one file at a time. **Revision 7: `core` defines these checks, but `web` is not the only caller of the checks.** `sync` imports the same functions. `sync` runs the functions as a gate at the start of a run, before any priced entry spends a search. `sync` stops the run when a check fails (AD-18, AD-12). Build the checks as exported pure functions over both loaded files. Do not hide the checks inside the load path of `web`. A `sync` author who cannot call the checks will write the checks a second time. A second copy of a check is the divergence that AD-18 exists to prevent.

   Revision 6 adds three more traps on the `core` side. In each of the three cases, the obvious implementation is the wrong implementation.

   **Do not add a tolerance to the two sum checks**, and **sum the values in the entry order of the file.** Two checks compare values for **exact** equality over **parsed doubles**. The two checks are `cohortTotals` conservation (AD-28) and the per-`statId` agreement of a group (AD-29). Use no epsilon, and do no rounding before the comparison. The faults that these checks find are as large as a whole cell. An epsilon would only admit an unconserved file. The summation order is not a free choice. Float addition is not associative. A left fold in array order, a fold in lattice order, and a sum of per-group subtotals therefore reach different totals and refuse different files. Fold left, in array order. Also do not compare the serialised decimals at a common scale. That comparison is a different test, and that test accepts files that this test refuses. Band edges are exact for a *separate* reason. A half-integer lattice is exact in binary. An edge that misses by a small amount is a straddle and not a rounding artefact. Neither rule is therefore a candidate for a tolerance.

   **An empty containment set has two possible causes, and the error must name both causes** (AD-18). The first cause is a tracked reference that the scoped pool never held. The second cause is a weights file that dropped a stat line and still declared `complete`. `core` cannot tell the two causes apart. `core` therefore reports the reference, the floor of the reference and the missing `statId`, and `core` blames neither document.

   **Check `statLineCounts` for each group that declares `statLineCounts`** (AD-29), and understand why the check matters. The empty-containment error above fires only when the dropped stat had a *single* publisher. When two source modifiers publish one `statId`, a dropped line is silent. The numerator then loses a share, and the base gets the wrong rank. This optional declaration is the only protection that stands behind that case.
2. **Measure pool coverage before any view work (AD-27).** Take the weights file that the scraper project produces, and compute:

   ```
   rankable(base) = base carries at least one tracked entry that is
                    crafted (AD-5: at least one affix present)
                    and not pruned (AD-23)

   covered(base)  = base is PRESENT in weights.json
                    ∧ both slots declare poolCoverage "complete"
                    ∧ neither slot's pool is empty

   coverage = |{ baseTypeId ∈ tracked.json : rankable ∧ covered }|
              ──────────────────────────────────────────────────
              |{ baseTypeId ∈ tracked.json : rankable }|
   ```

   *Rankable* excludes two kinds of base. The first kind is a base that the tracked list holds only as a raw base. The second kind is a base whose crafted entries are all tombstones. Neither kind of base needs a pool, and a count that included either kind would lower a number that binds the layout. `rankable` is decidable from `data/tracked.json` alone, and that property is the design intent. The gate runs before any sync exists, so the formula deliberately does not use price state as a term.

   **All three conditions of `covered` are load-bearing.** The condition "both slots `complete`" is **vacuously true** for a base that `weights.json` does not hold at all. Such a base has no slots to fail the condition. A base that declares `complete` over an *empty* pool passes a naive reading of the condition, and AD-18 excludes that base from the ordering anyway. Either gap lets the same tracked list and the same file score 100% or 40%. The consequences of the gate turn at 80% and at 50%.

   Apply the thresholds of AD-27, which are disjoint. At **≥ 80%**, proceed as specified. At **≥ 50% and < 80%**, the unrankable group stops being a footer and becomes a primary surface. **Below 50%**, the premise of the ranking fails. Escalate that failure, and do not work around the failure. A commitment to a layout before this number exists is a commitment to an assumption about how much of the product there is.

   **This gate is not spent after one use.** **Measure coverage again on every regeneration of the weights file.** The bands bind on every measurement, and not only on the first measurement. A patch introduces modifiers that the source publishes unnamed. The producer must then drop those rows, and the affected pools correctly fall back to `partial`. A product that measured 85% before launch can therefore sit at 60% in the week after a patch. `sync-report.json` carries the figure that the run computed. A drop across a patch boundary is therefore visible in the same place as the other health data of the run.

## Definition of done for an agent task

1. `pnpm check` and `pnpm test` pass, and neither command makes a network call.
2. Every new external interaction has a committed fixture.
3. Every new shared shape is a Zod schema in `contracts`, and the code validates the shape at its trust boundary.
4. The task adds no dependency edge outside the graph in the spine.
5. Raise every invariant that the task discovered against the spine, and do not encode such an invariant locally. An example of such an invariant is a call that two units could make in incompatible ways.
