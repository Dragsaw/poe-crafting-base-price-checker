---
title: 'Reconciliation Review — Brief/Addendum/Memlog vs ARCHITECTURE-SPINE.md'
type: review
lens: reconciliation
status: final
created: 2026-09-12
reviewer: reconciliation reviewer
inputs:
  - docs/briefs/brief-poe-crafting-base-price-checker-2026-09-12/brief.md
  - docs/briefs/brief-poe-crafting-base-price-checker-2026-09-12/addendum.md
  - docs/briefs/brief-poe-crafting-base-price-checker-2026-09-12/.memlog.md
target: docs/architecture/architecture-poe-crafting-base-price-checker-2026-09-12/ARCHITECTURE-SPINE.md
also_consulted: WEIGHTS-FILE-SCHEMA.md
---

# Reconciliation Review

**Verdict:** The spine is structurally strong and faithful on the decoupling, purity, dataset-contract and provenance decisions — but it drops the price estimator's actual definition, has no concept of a league, and silently lets an explicitly-unsolved risk (cold start / meta blindness) vanish from the record.

Only gaps and contradictions are listed. Items that landed are not repeated.

---

## Critical

### C1 — The price estimator is never specified anywhere in the spine

**Source:** brief *How Value Is Estimated* ("Prices come from the cheapest live instant-buyout listings… magic items of that base with those modifiers, instant-buyout only, cheapest first. Sorting ascending means stale overpriced listings never reach the estimate; restricting to instant buyout means underpriced listings would already have been bought"); addendum *Price Estimator Rationale* ("Adopted: … Cheapest ~10 live listings, instant-buyout only, refreshed every few hours"); memlog line 25.

The brief says of this section: *"This section is the product; everything else is presentation."* The spine contains none of it. Grep of ARCHITECTURE-SPINE.md finds no `instant`, `buyout`, `cheapest`, or `ascending`.

Specifically unplaced:
- The **instant-buyout-only filter** — a load-bearing semantic decision, not a query detail. Without it in an invariant, an agent writing the trade adapter has no reason to include it, and the estimator silently becomes "cheapest listing of any kind", which the addendum explicitly rejected.
- The **ascending price sort**.
- **Cheapest ~10** and, critically, **the aggregation rule**: how ten listings become the single `PriceObservation` in AD-9's `priced` state. Min? Median of ten? Mean? Undefined. Two agents will choose differently and both will pass the schema.
- **Where the aggregation lives.** It is pure arithmetic over listing values, so by AD-1 it belongs in `core` — but `sync` writes `PriceObservation`, so in practice it will land in `sync` where it is untestable as a pure function. The spine never assigns it.
- The **two-call shape per priced combination** (addendum Request Budget: "One search plus one fetch per priced combination") — AD-8 governs pacing but never states the request shape, so the request-count arithmetic the whole budget rests on has no anchor in the architecture.

AD-9 addresses only the *tri-state* of price, which is the absence case. The presence case — the actual number that the entire ranking multiplies against — is specified nowhere.

**Severity: Critical.**

### C2 — The system has no concept of a league

**Source:** brief *Key Risks* ("League and patch churn. Three to four league resets a year wipe prices entirely… The tool is least useful at league start, which is when the knowledge is worth the most. **This is the central threat to the one-year horizon.**"); brief Success Criteria ("A league start no longer costs weeks of relearning — the list is useful within days"); memlog line 36 ("league churn … as a first-class problem"); memlog 29 ("currency prices move during a league").

The word "league" does not appear in the spine. Consequences:

- **No league identifier on any entity.** `PriceObservation`, the published dataset, and `SyncRunReport` carry no league. Trade API searches are per-league; a dataset written in league N and read in league N+1 will render last league's prices as current with nothing on screen to reveal it. AD-10 makes *staleness* visible via timestamps, but a fresh sync into a stale dataset file at a league rollover produces a mixture that timestamps alone will not expose.
- **No league-boundary procedure.** A reset wipes all prices. Nothing says whether dataset.json is truncated, re-baselined, or re-keyed — and AD-14 ("the dataset holds the current snapshot; git is the history") makes the answer non-obvious, because a naive per-combination "latest observation" merge would retain last league's value for any combination not yet re-priced.
- **Not deferred either.** The brief's stated central threat to the product's stated one-year horizon is neither mitigated by an AD, nor listed under Deferred, nor raised as an Open Question. It is simply absent.

**Severity: Critical.**

### C3 — Cold start and meta blindness are erased from the record

**Source:** brief *Key Risks* ("The tool cannot discover what it is not told to watch… This is the one part of the original memorization problem the tool does not solve, and it means **the list needs periodic deliberate review rather than running unattended**"); addendum *Why Market Scanning Was Rejected* ("Consequence, recorded rather than solved… cold start and meta blindness both remain live. Periodic deliberate review is the mitigation in v1"); addendum *Alternatives* #1 ("**A stale top five that the user trusts is worse than no tool.** Neither is solved in v1; both are recorded as risks"); memlog 47.

The spine's Deferred entry reads: *"Market scanning as candidate generation. Rejected in the addendum on both shallowness and cost; not revisited without a new API capability."* That records the rejected **solution** and drops the **problem it leaves open**. The residual risk — the tracked list can only contain what the player already knows, so a mid-league meta shift is invisible — appears in no AD, no Deferred item, and no Open Question.

The v1 mitigation the inputs actually name — **periodic deliberate review of the tracked list, i.e. it must not run unattended** — is a standing operating obligation and is absent. AD-12 makes the tracked list a versioned repo file edited by commit, which is the right substrate for review, but states no review obligation and gives the view nothing (e.g. per-entry last-reviewed date, or a stale-entry surface) to support it.

This one deserves flagging beyond "a missing risk note": the addendum states the failure mode as *a stale top five that the user trusts is worse than no tool*, i.e. the product can be net-negative. An architecture that acknowledges nothing about it will be built as an unattended pipeline, which is precisely the shape the brief rules out.

**Severity: Critical.**

---

## Major

### M1 — AD-12 contradicts the craft-cost and currency-normalisation requirements

**Source:** brief ("subtract the full cost of the craft, paid on every attempt including the failures"); brief ("currency prices move during a league, so the same base can win under one recipe and lose under another"); memlog 29.

AD-12 states: *"The syncer derives its **entire workload** from this file"* (the tracked list). But:

- The spine's own Brief-Scope map has a row **"Craft cost from currency prices → `sync` + `core`"**, and the Consistency Conventions require *"All prices normalised to a single unit (divine) at the adapter boundary, carrying the exchange observation used."*
- Both require the syncer to fetch **currency exchange rates**, which are not tracked combinations and are not in `data/tracked.json`.

So the syncer has a second, unenumerated workload that AD-12 forbids by its own wording, that AD-12's request-count-versus-list-size budget report will misattribute, and that no data file or entity in the source tree or ER diagram accounts for (`CurrencyCost` appears in the ER diagram attached to `CraftRecipe`, but with no stated source, no observation timestamp, and no place in `data/`).

Related: the EV formula's "full cost paid on every attempt including the failures" — the clause that makes this threshold-truncated EV rather than a conditional average — is stated in no invariant. AD-4 mentions "costs" only as a dataset payload.

**Severity: Major.**

### M2 — The declared companion `AGENT-WORKFLOW.md` does not exist, and with it the parallel-worktree constraint has no home

**Source:** brief *Development Constraints* ("**Parallel development across multiple git worktrees**, so several agents can work simultaneously without colliding" — stated as a *hard requirement, not a preference*); memlog 11.

The spine's frontmatter lists `AGENT-WORKFLOW.md` as a companion. The directory contains only `ARCHITECTURE-SPINE.md`, `WEIGHTS-FILE-SCHEMA.md` and `.memlog.md`.

Within the spine itself, worktree-parallel development appears exactly once, inside AD-2's *Prevents* clause as a justification for one-way imports. There is no rule governing it. Unaddressed consequences that a four-package pnpm workspace with committed data files makes concrete:

- `data/dataset.json`, `data/sync-report.json` and `fixtures/` are **committed artifacts written by tooling**. Parallel agents on parallel worktrees will produce merge conflicts in generated JSON. No convention says who may regenerate them, or that they are excluded from feature branches.
- `pnpm-lock.yaml` across simultaneous worktrees — no convention.
- No statement of which packages are safe to work in concurrently (the dependency graph implies `contracts` is the serialisation point and changes there block everyone, which is worth saying out loud).

The other half of the same brief constraint — *"fully testable **and debuggable** by an agent with no human in the loop"* — is half-landed: AD-13 covers the test path comprehensively; debuggability (how an agent inspects a failed sync run, reproduces a bad ranking) is only implicitly served by the `SyncRunReport`.

**Severity: Major.**

### M3 — "Listings are supply, not demand" is neither mitigated nor acknowledged

**Source:** brief *Key Risks* ("Every price in the system is what someone is asking, filtered to be plausible. **No sale is ever observed.** The manual loop has a correction the tool does not: the player actually sells things and finds out"); addendum *Price Estimator Rationale* (options 2 and 3 considered and rejected); brief Success Criteria ("Chase decisions made from the list hold up against what actually sells").

The spine has no trace of this. AD-9 handles *missing* listings; AD-10 handles *weight* provenance and dataset age. Neither says that every `priced` value in the system is an ask, not a clear.

This matters architecturally rather than only editorially, because AD-10 establishes a provenance mechanism that deliberately distinguishes trustworthy from placeholder figures — and then applies it only to probabilities. Prices get a timestamp but no epistemic label, so the view will render an asking-price-derived number with the same confidence as a measured one. The inputs treat this as a first-class caveat of the product; the spine's own machinery could carry it and doesn't.

Also dropped: the addendum's note that option (2) — polling for listing disappearance as a sale signal — was *"the only approach that improves the longer the tool runs"*, and the corresponding in-house weights byproduct (addendum *Weights as a byproduct*; memlog 45). The spine's Deferred list omits both. AD-14 actively works against them by keeping only the latest observation in-file, which is defensible — but it should be recorded as a knowing trade-off, not left as a silent foreclosure.

**Severity: Major.**

### M4 — The request budget has no numbers and no ceiling

**Source:** addendum *Request Budget Analysis* ("sustained throughput of ~12 requests/minute… ~250 endgame-relevant base types… ~2,000 tracked combinations → ~4,000 requests → ~5.5 hours… **At ~2,000 a daily refresh fits comfortably; at ~10,000 it does not. This is the number to watch as the list grows**"); brief ("Refreshed daily or every few hours"); brief risk ("Discipline about what is tracked is a **permanent operating requirement**, not a one-time tuning exercise").

AD-8 correctly forbids hardcoded rates and requires header-driven pacing — that landed. AD-12 requires the run report to carry "request count against list size" — good. But:

- **No target refresh cadence is stated anywhere** as a design constraint. The Deployment section mentions "a day-stale dataset" only inside a Deferred item. An agent sizing chunk work in AD-7 has no target to size against.
- **No budget ceiling.** "Report the number" without "and here is the number at which we have a problem" is not a governor. The addendum hands over the 2,000/10,000 boundary explicitly and the spine drops it.
- The addendum's rate figures were stated *"so they can be challenged"* — an epistemic flag worth preserving alongside them.

**Severity: Major.**

### M5 — The four behavioral success criteria are absent

**Source:** brief *Success Criteria* — "Behavioral, not numeric. The tool works when: the player stops opening the trade site mid-session; the player stops keeping a top-five list in his head; a league start no longer costs weeks of relearning — the list is useful within days; chase decisions made from the list hold up against what actually sells."

None appear in the spine, and no structure in the spine is traceable to them. Two of them have direct architectural bite that is consequently unserved:

- *"stops opening the trade site mid-session"* implies the view must be sufficient without a fallback — i.e. the expanded combination list must carry enough (price, freshness, unknown status) to end the lookup. AD-3/AD-9 supply the data but nothing states the sufficiency goal.
- *"useful within days of a league start"* is the acceptance test for C2 above, and is the one criterion the current architecture is furthest from meeting.

The spine's "Brief Scope → Architecture Map" maps scope items to packages but there is no equivalent traceability for success criteria or for the risk register.

**Severity: Major.**

---

## Moderate

### N1 — "Pin" has no semantics anywhere

**Source:** brief scope, IN for v1 ("Curation controls: prune junk combinations, **pin ones to watch**"); brief *How Value Is Estimated* ("pinning ones worth watching closely").

AD-12 says prune and pin *state* lives in the tracked-list file, and the scope map routes "Curation: prune, pin" to `data/tracked.json`. That places the **storage** and nothing else. No component does anything with a pin:

- `sync` — does a pinned combination refresh more often, or first in chunk order? (The brief's "watch closely" implies cadence, which would interact with AD-7's chunk ordering.)
- `web` — does a pinned combination sort to the top, render differently, always expand?
- `core` — does pinning affect ranking at all? (Presumably not, but it should say so.)

Prune is unambiguous (absence from the file). Pin is an IN-SCOPE v1 control whose behavior is undefined, which means it will be implemented as a field nothing reads.

**Severity: Moderate.**

### N2 — Threshold defaults, and the late-endgame target, are dropped

**Source:** brief ("roughly a quarter of a divine in early endgame, a divine or more once the player is richer and stronger"); addendum *Early Endgame vs Late Endgame* ("The user chose to target **late endgame**, on the judgment that its value transfers downward"); memlog 27, 30.

The spine treats the threshold purely as a dial (AD-4, AD-15) with no default value, no sensible range for the control, and no statement that v1 targets late endgame. The late-endgame choice also fixes the assumed workflow (*perfect transmute everything picked up, then perfect augment the promising ones* — addendum *The Two-Stage Craft*), which is exactly the assumption the Open Question on recipe mechanics needs as its anchor; the Open Question is raised without it.

Also unrecorded: the brief's *"12 bases per five-minute map (~144/hour)"* volume figure and the reasoning it supports — addendum *Ranking Metric — Derivation*: **"Variance was considered and dismissed… Attempt volume is high enough that mean-based math is sound; there is no need to rank on median or to expose a risk preference."** That is an explicit decision to *not* build something, and it is precisely the kind of decision a future contributor re-opens when it is not written down. Likewise **"sell-through speed was considered and rejected as a ranking term"** — absent from the spine's Deferred list.

**Severity: Moderate.**

### N3 — The loot-filter ceiling finding is not recorded

**Source:** brief *Vision* and addendum *PoE2 Loot Filter Ceiling* ("PoE2's filter syntax has no working equivalent of `HasExplicitMod`… a generated filter can express base type, item level and rarity but never modifier combinations… **The web view is the permanent product, not a stepping stone to the filter**"); memlog 22.

The spine's Deferred list says only: *"Loot filter export, rare items, augment advice, accounts. Out of v1 by the brief."* That files the filter as a normal not-yet item. The inputs establish a *durable technical ceiling* that changes what the web view is for — it is the permanent home of the modifier knowledge, not a temporary UI awaiting automation. A Deferred entry that reads "later" invites someone to design the view as a stepping stone. This is a one-line fix with real downstream effect on how much the view is invested in.

**Severity: Moderate.**

### N4 — RePoE is a recurring maintenance dependency with no home in the spine

**Source:** addendum *Data Source Notes* ("Usable for modifier identity, tiers and base-to-modifier mapping; useless for probability. **Still a recurring maintenance dependency, since it tracks game patches**"); memlog 7 ("Sustainability of upkeep is a first-class requirement").

`WEIGHTS-FILE-SCHEMA.md` handles this well for the uniform-prior generator's eligible pools. But in the spine proper, RePoE appears only as a parenthetical example inside AD-5. Consequences:

- The **tier→value-range mapping** that AD-5 depends on ("'tier 1–2' exists only as a numeric floor on a stat") has to come from somewhere. That somewhere is RePoE plus a stat-id mapping, and it is a versioned external artifact with a patch cadence. It has no entry in the source tree's `data/`, no adapter named in `sync`, and no place in the system diagram.
- AD-6 makes a *disappeared* stat id a loud failure — correct and valuable. Nothing covers the complementary case: the RePoE export moving under a patch and changing an eligible pool or a tier boundary, which changes every probability without any stat id vanishing.

More broadly, **upkeep as a first-class requirement** (memlog 7, brief's one-year horizon) is nowhere consolidated. The recurring obligations the inputs imply — re-record fixtures when GGG changes (AD-13 provides the mechanism but states no obligation), regenerate weights on patch boundaries, refresh the RePoE-derived catalogue, review the tracked list (C3) — are each partly present as mechanisms and nowhere present as duties.

**Severity: Moderate.**

### N5 — Tone and terminology constraints not carried into conventions

**Source:** memlog 44 ("Terminology: prefer 'currency' and 'value'; avoid 'money'"); brief *Who This Serves* ("no growth goal, no monetization, and no advertising. **This freedom is load-bearing**: it is why the tool can assume one player's thresholds, one player's playstyle, and one player's judgment about when to trust it"); brief ("published openly but unadvertised").

The spine's prose happens to comply (no "money" appears), but the Consistency Conventions table — the natural and only home for a terminology rule in a document whose stated purpose is keeping independently-built parts consistent — has no terminology row. Agents writing UI copy in `web` have no rule to follow.

The single-player premise did land structurally and well (AD-15 is exactly right, including the escalate-don't-implement clause). What did not land is the *reason* — the load-bearing freedom that licenses hardcoded assumptions — which is what lets a future contributor tell a legitimate simplification from a shortcut.

**Severity: Moderate.**

---

## Minor

### X1 — AD-4 re-decides "precomputed" without naming that it is doing so

**Source:** brief *The Solution* ("The list **is precomputed by a background sync**, so it is ready before a session begins and never blocks on a live API call"); memlog 33 ("Data must be precomputed and available BEFORE a play session").

AD-4 is titled *"Ranking is computed at read time, never precomputed"* and rules that *"`sync` must not write a rank, a score, or an ordering."*

This is almost certainly the **right** call — the threshold is a live dial, so a precomputed ordering would falsify the product's central control, and AD-4's *Prevents* clause says exactly that. And the brief's actual intent (no live API call at decision time) is fully preserved, since all *observations* are precomputed.

But the spine states it in words that directly negate the brief's, without noting that it is refining rather than reversing the brief's decision. A reader holding the brief will read AD-4 as a contradiction. One sentence — "the brief's 'precomputed' means the *data*; the ordering is derived at read time because the threshold is live" — removes the collision.

**Severity: Minor (wording, not substance).**

### X2 — Small verified facts from the inputs that did not carry over

- **`realm=poe2` query parameter** — verified in the addendum's Data Source Notes as part of the working call shape. Not mentioned in AD-8 or the conventions. Trivially small, and trivially easy for an agent to omit and then debug for an hour.
- **The four search filters confirmed by the user together with a price sort** (rarity, item level, price floor, instant buyout — addendum; memlog 40, recorded as closing a spike). AD-8 governs the client's pacing but never states what a search must carry. Combined with C1, the trade adapter's query shape is entirely unspecified in the architecture.
- **poe2scout evaluated and found non-overlapping** (addendum; memlog 50). Worth one line, if only because it covers currency exchange rates — which M1 shows the syncer needs and has no named source for.
- **Tier restriction "governs the default, not the ceiling"** (addendum *The Tier Restriction*) — off-tier combinations are added by hand when noticed. AD-5's numeric-floor framing is a good translation, but nothing states that the tracked-list file may legitimately contain entries below the tier floor, so a validator author could reasonably enforce the floor and lock out the escape hatch.

**Severity: Minor.**

---

## Summary table

| # | Finding | Severity |
| --- | --- | --- |
| C1 | Price estimator (instant-buyout, ascending, cheapest ~10, aggregation rule, owning package, per-combination request shape) unspecified | Critical |
| C2 | No league concept anywhere; the brief's "central threat" is neither mitigated nor deferred | Critical |
| C3 | Cold start / meta blindness risk and the "periodic deliberate review, not unattended" obligation erased | Critical |
| M1 | AD-12's "entire workload from the tracked list" contradicts the currency-exchange sync that craft cost and divine normalisation both require | Major |
| M2 | Companion `AGENT-WORKFLOW.md` missing; parallel-worktree hard requirement has no rule | Major |
| M3 | "Listings are supply, not demand / no sale ever observed" unacknowledged; prices carry no epistemic provenance | Major |
| M4 | Request budget has no cadence target and no ceiling (2,000 fits / 10,000 does not) | Major |
| M5 | Four behavioral success criteria absent, including "useful within days of a league start" | Major |
| N1 | "Pin" is stored but has no semantics in `sync`, `core` or `web` | Moderate |
| N2 | Threshold defaults, late-endgame target, and the explicit dismissals of variance and sell-through dropped | Moderate |
| N3 | Loot-filter ceiling filed as ordinary "deferred" rather than a permanent constraint on what the view is | Moderate |
| N4 | RePoE / tier-mapping maintenance dependency unplaced; upkeep obligations never consolidated | Moderate |
| N5 | Terminology rule and the load-bearing single-player rationale not in conventions | Moderate |
| X1 | AD-4 verbally negates the brief's "precomputed" without flagging the refinement | Minor |
| X2 | `realm=poe2`, confirmed search filters, poe2scout, tier-floor escape hatch | Minor |
