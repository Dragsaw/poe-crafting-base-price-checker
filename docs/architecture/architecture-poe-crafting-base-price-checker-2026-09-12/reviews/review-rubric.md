---
title: "Rubric Review — ARCHITECTURE-SPINE.md"
target: ARCHITECTURE-SPINE.md
reviewer: rubric
date: 2026-09-12
verdict: revise
---

# Rubric Review — Architecture Spine, PoE2 Crafting Base Price Checker

**Verdict: revise.** The spine is unusually disciplined for its length — the paradigm is real, most ADs are genuinely enforceable, and the two hardest divergence points in a producer/consumer split (the dataset contract, the modifier identity) are nailed shut. But it is silent on the data lifecycle across league resets and game patches — the one risk the brief names as *the central threat to the one-year horizon* — it leaves a load-bearing companion document dangling, it contains an unresolved collision between AD-7, AD-14 and the deployment model, and it buries a correctness-bearing invariant (currency normalisation) in a conventions table.

---

## 1. Does it fix the real divergence points for epics/stories?

### What it gets right

The spine identifies its structural divergence risks correctly and closes them with mechanism rather than exhortation:

- **AD-3** (published dataset as sole channel) is the correct choice of the single most important boundary in a two-component system built by parallel agents. Making the Zod schema in `contracts` the source of truth and deriving types via `z.infer` rather than hand-declaring removes the classic drift mode entirely.
- **AD-5** (canonical modifier identity) pre-empts the highest-probability semantic divergence: three components each carrying a different notion of "a modifier". Anchoring identity to the trade API's own `statId` plus a numeric floor, and explicitly stating that the API has no tier concept, converts the addendum's "tiers 1–2" language into something a builder cannot misread.
- **AD-4** (read-time ranking) is the right invariant and correctly binds three packages, because the threshold dial is the product.
- **AD-13** (zero-network test path) is correctly framed as a precondition for unattended agent development, with a real mechanism (MSW + committed fixtures) and a named escape hatch (explicit re-record command).
- **AD-2** is exemplary: it names the enforcement tool, and explicitly says "a violation fails CI, not review."

### Divergence points that are MISSED

**M1 (critical) — League identity and league-reset data lifecycle.**
The word "league" appears nowhere in the spine. The brief calls league and patch churn "the central threat to the one-year horizon"; the addendum records that resets "wipe prices entirely." Yet:

- No entity in the ER diagram or the contracts naming table carries a league. `PriceObservation` has a timestamp (AD-10) but no league. Trade API searches are league-scoped at the URL; a builder of the trade adapter must decide where that value comes from, and nothing tells them.
- There is no rule for what happens to `data/dataset.json` at a league reset. Every price in it becomes meaningless simultaneously, but AD-10's freshness signal is a *timestamp*, which reads as "a day stale" rather than "from a dead economy." The `sync` builder and the `web` builder will each invent an answer, and they will differ.
- `data/tracked.json` is described as league-agnostic curation, which is probably right, but it is never *said*, so it is not a decision.

This is the single largest gap. Epics will split into a sync epic and a web epic, and both will need this answer before their first story.

**M2 (critical) — Dataset and weights schema evolution / migration.**
AD-3 makes `web` "refuse to render an invalid dataset rather than degrading" — a good failure posture, but it makes the schema a hard compatibility surface with no versioning policy attached. Nothing says whether the dataset carries a schema version, what `web` does when it encounters an unknown one, or who may change the schema and under what procedure. The same hole exists for the weights file across game patches (AD-11 says the file carries raw weights; it does not say the file is versioned, nor what `core` does when a `(base, slot)` pool changes shape after a patch and the weights file still describes the old pool). AD-6 handles the *sync*-side symptom of a patch (an unresolvable stat id); nothing handles the *core*-side symptom (a weights file describing a pool that no longer exists).

Deployment coupling mitigates but does not remove this: the Pages build ships app and dataset from the same commit, so a builder *could* argue skew is impossible — but that argument is itself an undecided assumption (see M5) and does not cover the weights file, which arrives from an external producer on a different cadence.

**M3 (high) — Chunk commit granularity collides with the deployment model.**
AD-7 says "progress is durable, committed state; a run that is killed loses at most the chunk in flight." The Deployment section says "each run … commits dataset + run report … That commit triggers the GitHub Pages build, which is the deploy." Taken together:

- If a "run" is one chunk, a full refresh of ~2,000 combinations produces many commits and therefore many Pages deploys, each publishing a *partially refreshed* dataset in which some prices are from this pass and some from the last.
- If a "run" is a full pass, AD-7's resumability claim is unfounded and its "bounded unit of work" is unbounded in the only dimension that matters (wall clock — the addendum budgets ~5.5 hours).

Neither reading is stated. A `sync` builder and a `web` builder will make incompatible assumptions about whether a published dataset is ever internally inconsistent. This needs an explicit decision: either the dataset is published atomically at pass boundaries with chunk progress living in a separate non-published cursor file, or torn datasets are legal and `web` must handle mixed-age rows (which AD-10's per-value timestamps could actually support — but only if said).

**M4 (high) — Who produces the v1 uniform-prior weights file.**
The brief puts "a defined weights-file schema, and a uniform-prior file satisfying it" **in scope for v1**. AD-11 says the app "consumes a weights file … and never produces one," and Deferred says weights production is "separate projects." The v1 deliverable therefore has no home in the architecture: it is not in `contracts`, not in `core`, not in `sync`, not in `web`, and not deferred. The uniform-prior generator also needs the eligible-pool data (RePoE's `mods_by_base.json`, per the addendum), which is a real external dependency that AD-5 mentions only in passing ("Any external catalogue … enters through an explicit mapping … at the adapter boundary") without saying which unit owns that mapping or whether the RePoE import is a build step, a committed artifact, or a sync-time fetch. Two builders can each assume the other owns it.

**M5 (medium) — How `web` obtains the dataset.**
Undecided: bundled into the Vite build at compile time, or fetched at runtime from the deployed site? AD-14's stated prevention ("page weight growing without bound") implies bundling; the system diagram's `dataset --> web` edge is silent. This determines whether a sync commit requires a full app rebuild to take effect, whether the dataset is cacheable separately, and whether AD-3's "validates on load" happens at build time or in the browser. Both builders need it; neither is told.

**M6 (medium) — Staleness target / refresh cadence contract.**
The brief says "refreshed daily or every few hours"; the addendum budgets the pass. The spine says only that sync is "invoked repeatedly." There is no stated target for how old a published dataset may be, which means AD-10's "must surface dataset age" has no threshold behind it — `web` cannot say "stale" without one, and the `sync` builder has no target to size chunks against.

---

## 2. Are the Rules enforceable, and do they prevent their stated divergence?

| AD | Enforceable? | Assessment |
|---|---|---|
| AD-1 | Partly | The prohibition is precise and *could* be mechanised (ESLint `no-restricted-imports` on `node:*`, `no-restricted-globals` on `Date`/`Math.random`/`process.env` inside `core`), but unlike AD-2 it names no mechanism. Given AD-2 establishes the precedent that mechanism matters, AD-1's silence reads as "reviewed by hand" — which for the one package that must be provably right is the wrong default. **Add the enforcement mechanism.** |
| AD-2 | Yes | Model AD. Names the tool, names the CI consequence, states the resolution rule for shared code ("goes *down*, never sideways"). |
| AD-3 | Yes | Enforceable and self-checking. Gap is versioning (M2), not enforceability. |
| AD-4 | Yes | "`sync` must not write a rank, a score, or an ordering" is enforceable structurally — the dataset schema simply has no such field, so the Zod validation before write enforces it. Good. |
| AD-5 | Mostly | The identity tuple is concrete and type-enforceable. "No component may introduce a second modifier identity" is an aspiration, but it is backed by a single type in `contracts`, which is the real enforcement. The adapter-boundary clause for external catalogues is under-specified (see M4). |
| AD-6 | Yes | Concrete, testable, and correctly frames the failure as a first-class state rather than an exception. Strong AD. |
| AD-7 | **No — flag** | Three problems. (a) "one bounded unit of work" never says what bounds it — chunk size, request count, or wall clock; unfalsifiable as written. (b) "Progress is durable, committed state" collides with the deployment model (M3). (c) "makes no assumption about what invokes it, how often, or where it runs" is aspirational: it cannot be tested, and it has no observable violation condition. Rewrite (a) as a number or a named config key, resolve (b), and either drop (c) or convert it to something checkable ("the syncer reads no environment variable other than X and writes only under `data/`"). |
| AD-8 | Yes | "Exactly one adapter issues requests" is enforceable by a dependency-cruiser rule restricting `fetch`/HTTP-client imports to a single module — worth saying so, since AD-2 sets that expectation. The header-adaptive pacing rule is admirably concrete ("no rate is hardcoded") and directly discharges the addendum's design consequence. |
| AD-9 | Yes | Tri-state is enforced by the type. Excellent — this is the kind of invariant that pays for itself. |
| AD-10 | Partly — flag | The `core` half (propagate weakest provenance, oldest timestamp) is precise and unit-testable. The `web` half — "must render a figure resting on `uniform-prior` visibly differently" — is the addendum's hardest requirement ("a placeholder will quietly be trusted months later") and is stated in terms no test can check. It needs a checkable form: e.g. "every rendered figure carries a `data-provenance` attribute, asserted by component test; the visual treatment is a UX decision below this altitude." As written it will be satisfied by a tooltip nobody sees. |
| AD-11 | **No — flag** | It delegates the entire weights contract to `WEIGHTS-FILE-SCHEMA.md`, which **does not exist** in the architecture folder (only `.memlog.md` and the spine are present) though it is listed under `companions:` in the frontmatter. The one AD whose whole job is to pin an external contract currently points at nothing. Everything else in AD-11 (normalisation lives in `core`, recipe effects never baked into the file) is good and enforceable. |
| AD-12 | Yes | Strong. "Nothing writes it at runtime" is structurally enforceable (no write path exists from `web`, per AD-15), and "Sync must report the run's request count against the list size" turns the addendum's budget analysis into a standing observable. Best operational rule in the document. |
| AD-13 | Yes | Enforceable in CI. The clause making the fixture diff the mechanism by which GGG's changes become visible is genuinely clever and load-bearing. |
| AD-14 | Yes | Concrete and structurally enforced (no history field in the schema). |
| AD-15 | Mostly | The prohibitions are enforceable. "Any requirement that appears to need a backend is escalated, not implemented" is a process instruction, not an architectural rule — harmless, but it is the kind of sentence that trains readers to skim Rules. |

**Summary of rule-level flags:** AD-7 (unbounded "bounded", aspirational invoker clause, commit collision), AD-11 (dangling companion), AD-10's `web` clause (unfalsifiable), AD-1 and AD-8 (correct but mechanism unnamed while AD-2 sets the precedent).

---

## 3. Could anything under Deferred let two units diverge?

Mostly no — the Deferred list is well constructed, and several entries correctly name the AD that holds the line in the meantime (AD-11 for weights production, AD-9 for fallback pricing, AD-15 for accounts, AD-7 for hosted sync, AD-14 for history). That pattern — *deferred, with the invariant that keeps the deferral from leaking* — is exactly right and should be preserved.

Two exceptions:

- **"Weights production"** is deferred, but a v1 deliverable (the uniform-prior file) sits inside the deferred territory with no owner (M4). This is a deferral that a builder will have to breach in v1.
- **"Observability beyond the run report"** — "A committed structured report is the whole story; no metrics stack" is a defensible call for a single-user tool, but it leaves the *unattended failure* path open. The syncer runs under Task Scheduler on the player's machine; if it fails for a week, the only symptom is a dataset that stops moving. Nothing binds `web` to surface run-report error states (AD-6 puts them in the report; AD-10 requires surfacing dataset *age* only; the system diagram draws `report --> web` but no AD governs it). Two builders can reasonably read "the view can read it" (Logging convention) as optional. **Make the `web` obligation explicit or accept it as a named risk.**

---

## 4. Dimension coverage — decided, deferred, open, or SILENT?

| Dimension | Status | Notes |
|---|---|---|
| Deployment & environments | **Decided** | Explicit section. "One environment … no staging … no secret material … deploy is the sync commit." Good, but collides with AD-7 (M3). |
| Infra / provider strategy | **Decided** | GitHub Pages + Task Scheduler in Stack, host-agnosticism per AD-7, hosted-syncer migration deferred. Adequate. |
| Operations / observability | **Partly decided** | `SyncRunReport` + AD-12's budget reporting + the Deferred entry. Gap: no unattended-failure surfacing obligation (see §3). |
| Error / failure handling | **Decided** | Error-shape convention (typed results in `core`, throws only for unrecoverable run failure in `sync`, everything else to the report) plus AD-6 and AD-9. Solid. Missing only the `web` side of a failed/stale run. |
| Security & abuse | **SILENT** | Finding. Partially discharged by accident — unauthenticated API, no accounts (AD-15), no secret material, contact `User-Agent` kept in an env overlay rather than committed (Config convention). But nothing *decides* it: whether the repo and the published dataset are public (they are, by GitHub Pages), that the committed contact email is a deliberate public disclosure, or any supply-chain posture for a dependency set the tool will carry for a year of unattended scheduled runs. Needs at minimum a three-line "no authentication, no secrets, public data, public contact string — accepted" paragraph so a builder does not invent a secrets mechanism. |
| Data migration across patches & league resets | **SILENT** | Finding, and the most serious one — see M1 and M2. Only AD-6 touches patch churn, and only as detection of one symptom. |
| Performance budgets | **SILENT** | Finding. AD-4 requires the full ranked list to be recomputed in the browser on *every* change to threshold, weights or recipe, over a dataset spanning ~250 base types and ~2,000 tracked combinations. No budget is stated for dataset size, initial load, or recompute latency. The threshold dial is the product's central control; whether it is a debounced re-render, a memoised selector, or a worker is a decision two builders will make differently. AD-14's prevention clause gestures at "page weight" without a number. |
| Accessibility | **SILENT** | Finding, though a minor one. The brief deprioritises appearance and mandates an off-the-shelf framework, so "Mantine defaults, no additional a11y target for v1" is almost certainly the right decision — but it should be *written*, because AD-10 requires provenance to be "visibly different," and colour-only differentiation is exactly the trap an unstated a11y posture produces. |

---

## 5. Seed vs. invariant classification

**Invariant buried where it will be ignored (high):**
The Consistency Conventions table contains, as a single row:

> **Currency** — All prices normalised to a single unit (divine) at the adapter boundary, carrying the exchange observation used. Raw listing currency is never propagated into `core`.

This is not a convention. It is an invariant with the same weight as AD-9 and AD-10, and it is arguably the one most likely to produce silently wrong numbers:

- The divine itself moves in value across a league. Every price in the system is a ratio to a moving denominator; an observation normalised at one exchange rate and compared to one normalised at another is a category error the ranking will not notice.
- The threshold dial is denominated in divine ("~0.25 divine … ≥1 divine"), so the user-facing control inherits this.
- Craft cost comes from currency prices (Brief Scope map: `sync` + `core`), meaning the exchange observation feeds the subtraction term as well as the payout term.
- AD-10 requires provenance and freshness on "every derived value" but enumerates only probability source and price timestamp. The exchange observation is a third provenance axis and is not named there.

Promote this to an AD (or fold it into AD-10 explicitly), and state whether the exchange rate is captured per observation or per run.

**Borderline, acceptable:**
- The Validation and Error-shape rows are genuinely conventions and belong in the table.
- The naming/ports/ids rows are correct as conventions — `Ids` points back to AD-5 for the part that is an invariant, which is the right pattern and should have been applied to Currency too.

**SEED masquerading as invariant:** none found. The Structural Seed section is correctly scoped — package layout, file paths, the ER sketch, the system diagram. `RankedBase` being annotated "derived in the browser and never persisted (AD-4)" is a good cross-link from seed back to invariant.

**Stack:** exact pins are appropriate for a single-maintainer, agent-built project. No finding.

---

## 6. Length and rationale leakage

The spine is ~280 lines for a whole-system feature-altitude document with 15 ADs. That is on the right side of the line; it is not bloated.

Minor leakage worth a trim, none of it blocking:

- Several **Prevents** clauses argue rather than state: "which would make the product's central control a lie" (AD-4), "the brief's hardest requirement" (AD-13), "the single largest divergence risk in a two-component system built by independent agents" (AD-3), "exactly the plausible jackpots the addendum identifies as unresolved" (AD-9). `Prevents` is a legitimate field and a one-line justification earns its place; the editorialising tail does not, and it is the kind of prose that belongs in `.memlog.md`.
- Deferred entries carry mini-arguments ("`POESESSID` would raise the rate limit but adds a rotting credential"). Defensible — a deferral without its condition is a deferral nobody can revisit — and the "revisit if X" triggers are genuinely useful. Keep.
- The **Brief Scope → Architecture Map** is traceability, not decision. It is cheap and useful for epic decomposition; keep it, but note that it is the only place "White ilvl-82 bases → open question" is cross-referenced, which is fragile.

---

## 7. Open Questions section

Both listed questions are real, correctly scoped, and correctly *not* answered:

- **Recipe distribution mechanics** — honestly flagged, with a named v1 fallback (single recipe under a documented assumption) and a named consequence (per-`(base, recipe)` ranking as the brief describes needs it). Good.
- **White ilvl-82 bases** — correctly identified as needing an answer before `core` is built.

Missing from Open Questions, given §1: league identity, dataset publication atomicity, and the recipe-cost currency source could each have been an open question rather than an absence. An open question is a legitimate answer for this altitude; silence is not.

---

## Findings, by severity

**Critical**

1. **League and patch data lifecycle is entirely silent** (M1, M2). No league identity on any entity, no rule for invalidating a dataset at league reset, no schema versioning or migration policy for either the dataset or the weights file. The brief names this the central threat to the tool's stated one-year horizon. Both the `sync` and `web` epics need this before their first story.

**High**

2. **AD-7's "bounded, resumable chunk runner" collides with AD-14 and the deployment model** (M3). If chunk progress is committed, every chunk deploys a partially refreshed dataset; if it is not, resumability is unfounded. "Bounded" is never given a bound. Decide dataset publication atomicity explicitly.
3. **AD-11 delegates the weights contract to `WEIGHTS-FILE-SCHEMA.md`, which does not exist** — it is declared under `companions:` but absent from the folder. The AD whose entire purpose is to pin an external contract currently pins nothing.
4. **The v1 uniform-prior weights file has no home** (M4). The brief puts it in scope for v1; AD-11 says the app never produces a weights file; Deferred says production is a separate project. Also unowned: the RePoE eligible-pool import that generating it requires.
5. **Currency normalisation is an invariant buried in the conventions table.** The divine is a moving denominator feeding both the payout term and the craft-cost term and the user-facing threshold; AD-10's provenance rule does not name the exchange observation. Promote it.

**Medium**

6. **Three dimensions silent**: performance budget (AD-4 mandates full read-time recompute with no size or latency budget), security/abuse posture (discharged only by accident), accessibility (almost certainly a one-line "Mantine defaults, no target" — but unstated, and AD-10's "visibly different" makes it matter).
7. **How `web` obtains the dataset is undecided** (M5) — bundled at build time or fetched at runtime. Determines cache behaviour, AD-3's validation timing, and whether a sync commit needs an app rebuild.
8. **AD-10's `web` clause is unfalsifiable** as written ("render visibly differently"). Give it a checkable form.
9. **No staleness target** (M6), leaving AD-10's "surface dataset age" without a threshold and `sync` without a pass-completion goal.
10. **No obligation on `web` to surface run-report error states**, so AD-6's loud failures can land in a file nobody renders — the practical failure mode for an unattended scheduler on a home machine.

**Low**

11. **AD-1 and AD-8 name no enforcement mechanism** while AD-2 establishes that naming one is the house standard. Both are mechanisable (lint restrictions; a dependency-cruiser rule confining the HTTP client to one module).
12. **Rationale leakage in `Prevents` clauses and AD-15's escalation sentence** — trim toward statement rather than argument; the argument belongs in `.memlog.md`.

---

## What to keep

AD-2, AD-6, AD-9, AD-12 and AD-13 are model invariants: each names a mechanism, each has an observable violation condition, and each traces to a specific risk in the brief or addendum. AD-3 and AD-5 close the two divergence points that would otherwise have sunk parallel agent development. The pattern of pairing every Deferred entry with the AD that holds its line is worth preserving verbatim in future spines.
