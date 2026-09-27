---
title: 'Agent Development Workflow'
status: final
created: '2026-09-12'
updated: '2026-09-27'
governed_by: [AD-1, AD-13]
---

# Agent Development Workflow

The brief makes three statements hard requirements and not preferences. First, an agent must test and debug the whole system with no human in the loop. Second, several agents must work in parallel git worktrees and must not conflict with each other. Third, the primary data source is a live, rate-limited third party, and that data source must never appear in the test path. This document tells you how the project keeps these three requirements true.

## The offline guarantee

**No test at any level makes a network call** (AD-13). This rule is the load-bearing property of the workflow. The rule lets an agent repeat the development loop at machine speed. The service would otherwise rate-limit the agent until the agent can do no useful work. The rule also makes a failed test mean "the code is wrong" and not "GGG was slow".

The project enforces the rule and does not trust the rule. The test setup installs an MSW server with an `onUnhandledRequest` callback. The callback records the escaped URL and throws. A global `afterEach` then fails the test and names each URL that escaped. A request without a matching fixture therefore fails the test, and the request does not reach the network. The `"error"` string mode does not fail a test, because a floating or a swallowed request leaves the suite green. Do not substitute that string for the callback.

An agent can therefore run the entire test suite with no network connection. No step in the loop below needs credentials, a network, or a human.

## The agent loop

```
pnpm install
pnpm check          # typecheck + lint + dependency-cruiser, all packages
pnpm test           # vitest, all packages, zero network
pnpm dev            # web against the committed dataset + fixtures
pnpm sync:dry       # run the sync pipeline against fixtures, write nowhere
```

`pnpm check` is the point that enforces the package boundaries. `dependency-cruiser` fails the build on an import in the wrong direction (AD-1). An agent that imports from `core` into `sync` therefore learns about the fault in seconds, and no reviewer is necessary.

`pnpm sync:dry` is the most important debugging tool. The command runs the full sync pipeline deterministically against recorded fixtures. The command writes a dataset and a run report to stdout, and writes nothing to disk. An agent can therefore examine the actions of the syncer and send no request to GGG.

**The dry run skips an unrecorded entry.** The recorded searches cover the small fixed workload `fixtures/tracked.json`, not `data/tracked.json`. When an entry of the real list has no recorded search, the dry run sends no request for it, and the entry keeps its dataset state. The dry run lists its key in `unrecorded`. Any other request without a fixture, such as the fetch leg of a recorded search, fails the run and names the missing fixture.

**The dry run's clock comes from its inputs.** By default, the clock of `pnpm sync:dry` is the latest `lastAttemptedAt` in the dataset snapshot. When no entry carries a `lastAttemptedAt`, the clock is the fixed instant `2026-01-01T00:00:00.000Z`. `pnpm sync:dry --at <iso>` sets the clock explicitly. The same inputs therefore print the same bytes. The default predicts the live run that immediately follows the last live run. Use `--at` to predict a run at another time, for example now. A fixed constant does not do this: when the dataset is newer than the constant, every entry has a negative age and the predicted order is not the live order (AD-7). The dry run predicts the order, not the penalty: it ignores the `notBefore` instant in `sync-progress.json` (AD-8) and prints it. Otherwise the default clock would fall inside the penalty after every 429 and the dry run would print a no-op.

## Fixtures

Fixtures are **real captured trade-API responses**. The project commits the fixtures under `fixtures/` (AD-13). Nobody writes a fixture by hand. A hand-written mock records what the team believes the API returns, and not what the API actually returns. A hand-written mock also continues to pass on the day the belief becomes wrong.

```
pnpm fixtures:record      # EXPLICIT, human-invoked, hits the live API
pnpm catalogue:refresh    # EXPLICIT, human-invoked, hits the live API (AD-25)
```

Neither command is part of a test run. An agent does not run either command unattended. The output of each command is a diff against the committed files. **That diff is the mechanism that makes a change by GGG visible.** A patch that changes the shape of a response appears as a change that a human can review. Such a patch does not appear as a production incident.

`catalogue:refresh` reads the four trade data endpoints and writes them into `data/catalogue/` (AD-25). Run `catalogue:refresh` when GGG releases a patch. Do not run `catalogue:refresh` on a schedule. A renamed stat id appears as a line in that diff. AD-9 checks the tracked list against the catalogue. That check gives the renamed stat id an `unresolvable` state instead of a silent mismatch.

Fixture hygiene:

- Keep one fixture for each distinct shape of API interaction. Name the fixture for the interaction, and not for the test that uses the fixture.
- Remove irrelevant bulk from a fixture, but never remove structure. Keep a field even when no code uses the field, because the loss of that field is a signal.
- Remove every personal identifier from a captured response at record time. Account names and character names are personal identifiers.

## Parallel worktrees

The package split (AD-1) is what makes parallel work possible. `contracts`, `core`, `sync` and `web` each own a separate directory. Each package has its own test suite. The dependency graph has no cycles and points in one direction. Two agents that work in two different packages change no common file.

Rules for the division of work across worktrees:

- **Give a task the scope of one package where possible.** A task that spans packages is a signal that a contract is missing. Such a task is not a signal that the boundary is wrong.
- **Make `contracts` changes one at a time.** Every other package depends on `contracts`. A change to `contracts` is therefore a wide rebuild and a probable conflict. Land a `contracts` change alone and first. Then rebase the dependent work onto that change.
- **Each file in `data/` has one writer (AD-3), and that writer is never app code.** The player owns the hand-edited inputs `tracked.json`, `currencies.json`, `recipes.json` and `config.json`. "Hand-edited" means no component of the app maintains them. It does not mean an agent may not touch them. **During development an agent edits a hand-edited input directly when its task calls for the change.** The agent names each changed file, the change and the reason in its report, so the player knows. The agent does not stop and hand a known edit back to the player. For every edit to `data/tracked.json`, the agent follows the `tracked-json` skill (`.claude/skills/tracked-json/SKILL.md`). The agent gets catalogue and weights facts from `pnpm tracked:lookup`. After the edit, the agent runs `pnpm tracked:check` and fixes the file until the command exits 0. A pass does not cover the checks that `pnpm tracked:check` lists under `pending`. The external scraper project owns `weights.json` (AD-11). The syncer owns the sync outputs `catalogue/*.json`, `dataset.json`, `sync-report.json` and `sync-progress.json`. A tool produces each of these files, so an agent does not hand-edit or regenerate them: a hand edit fakes data that the tool did not observe. **A test that needs different data uses a fixture**, never an edit to a file in `data/`.
- **No worktree runs `pnpm sync` or `pnpm catalogue:refresh` against the live API.** Only the scheduled invoker on the player's machine runs a sync (AD-7, AD-8). The scheduled invoker holds an exclusive lock. A second run on any machine therefore exits immediately, and that behaviour is the intended design. An agent that must check sync behaviour runs `pnpm sync:dry`. A human refreshes the catalogue when GGG releases a patch. An agent that needs a different catalogue uses a fixture.
- **Sync-related code contains no git write.** AD-3 forbids the syncer to add, commit, push or pull. The syncer writes the files it owns by explicit path and exits. The git port is read-only, and its one operation is the author date of the last commit touching a path (AD-12). An agent that reaches for a git write in `sync` has found a spine amendment, not a task detail.

## Determinism

An agent debugs badly when tests are unreliable. The design therefore excludes nondeterminism by structure and does not tolerate nondeterminism:

- `core` is pure. The caller passes time, randomness and config into `core` as values (AD-1). A `core` test maps literal inputs to literal outputs.
- The clock is a port. A test supplies a fixed instant. No code below the shell calls `Date.now()`.
- Sync ordering is deterministic for a given tracked list, dataset and clock value. AD-7 fixes the rotation order. The order is `pinned` entries by oldest `lastAttemptedAt`, then `active` entries by oldest `lastAttemptedAt`, then a bounded number of `unresolvable` retries, and never `pruned` entries. **There is no currency step** — it led the rotation until spine revision 14, when AD-20 made rates hand-maintained committed data that costs no request. `core` computes the order as a pure function. A dry run and a real run therefore select the same entries. The order uses **`lastAttemptedAt`, and never the observation time**. An entry that stays `no-listings` never gets an observation time. A rotation ordered by observation time would therefore select that entry again forever (AD-9).
- No test depends on wall-clock timing. A test checks rate-limit backoff with supplied header values, and never by waiting.

## What an agent needs to know before touching a package

| Package | Its job | The rule most likely to be broken |
| --- | --- | --- |
| `contracts` | Zod schemas, derived types, port interfaces | Types are `z.infer`red from schemas, never declared in parallel |
| `core` | Pure valuation, probability, provenance | No I/O, no clock, no randomness, no env — ever (AD-1) |
| `sync` | Trade client, rate-limit governor, chunk runner, catalogue refresher, dataset writer | One governed HTTP client only (AD-8); bounded work then exit and rotation order comes from `core`, not from `sync` (AD-7); a stat filter's shape follows the reference's **kind** — a `banded` reference carries both `min` and `max`, a `valueless` one carries the stat id and **no edges at all**, and emitting a sentinel pair for a valueless stat silently prices the wrong population rather than erroring (AD-16, AD-5) |
| `web` | Static view, read-time ranking | No backend, no write path, no authenticated request (AD-15) |

## Build order

Two activities run in sequence and not in parallel. Both activities are easy to get wrong at a late stage.

1. **Build `contracts` first and alone.** Every other package depends on it, so land it on its own and rebase all other work onto it. Three shapes need the most care:

   - **`ModifierRef` is a discriminated union** of `banded` — `(statId, valueMin, valueMax)` with both edges always present — and `valueless` — `(statId)` with **no edges at all** (AD-5). An exhaustive `switch` over the two kinds is what stops `core` and `sync` from each inventing a different reading of the valueless case. Emitting a sentinel pair for a valueless stat silently prices the wrong population rather than erroring.
   - **`provenance` is a three-value order**: `absent`, `uniform-prior`, `measured` (AD-10). `core` derives it from the weights entry's `weightSource` and nothing else in the file — `"published"` → `measured`, `"absent"` → `uniform-prior`. **`"absent"` does not map to provenance `absent`**; that reading is the one the shared word invites and it is wrong.
   - **`ModifierWeight` follows weights contract `6.0.0`** (AD-11): one entry is one tier of one modifier, carrying `sourceModifierId`, **`modGroup`**, `itemLevelMin`, `weight`, `weightSource` and **`lines[]`**, each line holding its own `statId` (or `null`) and its `ranges` **verbatim**. Write it to `6.0.0` directly; never to a `5.x` or `4.x` shape — the schema refuses a `5.x` file as an unknown major. **Read `modGroup` for exclusion (AD-17, `IMPLEMENTATION-NOTES.md` §11), and never parse it out of `sourceModifierId`.** The inner `className` key's grammar that `5.1.0` made normative is unchanged, because AD-16 derives the crafted search's class filter from it (`IMPLEMENTATION-NOTES.md` §10). `tierLabel` stays display-only; no component reads it.

   **Five cross-file checks live in `core`, and `web` is not their only caller.** All five read `tracked.json` and `weights.json` together, so `contracts` cannot see them — `contracts` sees one file at a time. They are edge alignment, the empty containment set, `coOccur`, kind agreement, and **class discriminability** (AD-17). The fifth was added by spine revision 17 and is the odd one: its subject is the **search** rather than the valuation, it asks whether a crafted entry's class can be told apart from its siblings before budget is spent on pricing it across all of them (`IMPLEMENTATION-NOTES.md` §2.6), and it is the only one whose failure would otherwise produce a plausible-looking wrong number rather than a missing one. Build them as **exported pure functions over both loaded files**. Do not hide them inside `web`'s load path: `sync` imports the same functions and runs them as a gate at the start of a run, before any priced entry spends a search, aborting on failure (AD-12). A `sync` author who cannot call them will write them a second time, and a second copy is the divergence the rule exists to prevent.

   Three `core` traps, where the obvious implementation is the wrong one:

   **Derive a line's filter-comparable interval in exactly one exported function** (AD-11). Both the containment test and the edge-alignment test call it. Two call sites that each divide are two chances to round differently, and the edge comparison is **exact, with no tolerance** — an epsilon readmits the sentinel defect AD-5 exists to close. For a two-`#` line the interval is the average of the two ranges, which is exact in binary; **two `#` is the maximum** (OQ-19, closed 2026-09-19), and `WEIGHTS-FILE-SCHEMA.md` rejects a three-`#` line at the file, so the function needs no branch for one. See `IMPLEMENTATION-NOTES.md` §1.

   **Containment is whole-tier, and a partly-covered tier is not an error** (AD-11, AD-17). A tier whose derived interval lies wholly inside the band contributes its **whole weight, once**, however many of its lines match. A tier only partly covered contributes **nothing to the numerator** and **still counts in the denominator**. The denominator is a **plain sum over entries** — do not group by `sourceModifierId`, which is a `4.x` shape that no longer applies.

   **An empty containment set has two possible causes, and the error must name both** (AD-17). The first is a tracked reference the scoped pool never held. The second is a weights file that dropped a stat line and still declared `complete`. `core` cannot tell them apart, so it reports the reference, its floor and the missing `statId`, and blames neither document. **Nothing mechanical stands behind the second cause under `5.0.0`** — where a second tier publishes the same `statId`, the dropped line fires no error at all and the numerator quietly deflates (AD-11). Do not attempt to close that hole locally; it is recorded under Deferred.
2. **Measure pool coverage before any view work, once a weights file exists (AD-27).**

   **This step cites and does not restate.** The predicates are `IMPLEMENTATION-NOTES.md` §3's
   and the rule is AD-27's; read them there and compute the fraction they define. Two earlier
   revisions of this step carried its own copy of the formula and its thresholds, and **both
   times the copy went stale against AD-27** — once on the absent-file carve-out, once when
   the coverage bands were withdrawn. A third copy would go stale a third time.

   Three things a builder standing here needs, none of them a restatement:

   **The unit is the item class — the `(categoryId, className)` pair — and never the base
   type or the category alone** (AD-5). Only a `crafted` tracked entry names one, so both
   halves of the fraction range over classes and a raw entry appears in neither. If you are
   counting `baseTypeId`s you are reading a pre-revision-16 draft; if you are counting
   `categoryId`s you are reading revision 16 itself, which spine revision 17 superseded when
   `prd.md` revision 18 moved the player-facing unit a rung finer.

   **No threshold reads the result.** `prd.md` revision 17 withdrew FR-4's coverage bands and
   spine revision 16 withdrew AD-27's copy of them. There is nothing here to pass or fail and
   **nothing to escalate to** — the figure is published with its denominator and the layout
   call is UX's (`EXPERIENCE.md`). Do not reinstate an 80% or 50% rule found in an older
   draft.

   **Where `data/weights.json` is absent the measurement does not happen at all**, and
   coverage is undefined rather than `0%` — `sync-report.json` omits the fraction *and* its
   denominator together (§3). That is the product's **declared day-one phase**, not a defect
   (AD-12, AD-24). Build the view: every crafted item class is unrankable for a reason
   `web` states, **raw entries need no pool and still rank**, so the raw-base price list is a
   working product on day one and the unrankable group is the surface the rest of the work
   lands into (AD-11, AD-17, AD-24).

   **What AD-27 still guards, now that it binds no layout, is the commitment itself:** a view
   built around a *full ranked list* before anyone knows how much of one the file can populate.
   Day one makes the opposite commitment visibly — the list is the raw-base list and the
   unrankable group is most of the product. Build for a view that reads well at both sizes. A
   view that can only display a long ranked list has made the forbidden commitment even though
   no threshold was ever crossed.

   **Re-measure on every regeneration of the weights file.** A patch introduces modifiers the
   source publishes unnamed, the producer drops those rows, and the affected pools fall back to
   `partial` — so a figure taken before launch does not describe the file after a patch.
   `sync-report.json` carries the figure the run computed, which puts a drop across a patch
   boundary in the same place as the run's other health data.

## Commit conventions

A commit subject is `type(scope): description` or `type: description`. A `feat`/`fix`/`test` commit scoped to a package (`contracts`, `core`, `sync`, `web`) names its story (`story 1.N`) or retro item (`retro item(s) N`) in the description — a `docs`/`chore` commit, or one with no package scope, does not need to. The `.githooks/commit-msg` hook checks this and prints a fix when it fails; `pnpm install` wires it in (`prepare` sets `core.hooksPath`).

## Review brief

These two rules bind every review and every agent that triages or fixes review findings.

1. **The Accessibility Floor is a ruling, not a gap.** `EXPERIENCE.md` § *Accessibility Floor* sets the product's accessibility scope. A finding that asks for work the floor rules out is conformant, and the triage rejects it with a citation of the floor. Do not add ARIA roles or live regions, keyboard paths, focus styling, contrast targets or reduced-motion handling on your own. What the floor does bind, for example the non-colour cue for each distinction, stays in review scope.
2. **A reviewer never edits a planning document that another role owns.** The owners are listed in AGENTS.md ("Each planning fact has one owner"). UX owns `DESIGN.md`, `EXPERIENCE.md` and the mockups. The PM owns `prd.md` and `epics.md`. The architect owns this folder. When the code and an owner document disagree, fix the code to match the document, or record the conflict in `docs/stories/deferred-work.md` as a `[NOTE FOR UX]` (or a note for the owning role). Do not change the document so that it matches the code.

## Definition of done for an agent task

1. `pnpm check` and `pnpm test` pass, and neither command makes a network call.
2. Every new external interaction has a committed fixture.
3. Every new shared shape is a Zod schema in `contracts`, and the code validates the shape at its trust boundary.
4. The task adds no dependency edge outside the graph in the spine.
5. Raise every invariant that the task discovered against the spine, and do not encode such an invariant locally. An example of such an invariant is a call that two units could make in incompatible ways.
