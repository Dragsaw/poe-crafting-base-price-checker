---
title: 'Rubric Walker — Architecture Spine revision 5'
lens: rubric-walker
target: ARCHITECTURE-SPINE.md (revision 5)
companions: [WEIGHTS-FILE-SCHEMA.md 4.0.0, AGENT-WORKFLOW.md]
created: '2026-09-13'
verdict: revise
---

# Rubric Walker — revision 5

Judged against the good-spine checklist: does it fix the real divergence points for the
level below; is every Rule enforceable by a named owner holding the data; does anything
Deferred permit divergence; is any owned dimension silent; does the banner report what moved.

Revision 5 is a strong revision on the two items it was called for. AD-9's self-contradiction
is genuinely closed and the never-synced qualification is reasoned to the rotation key rather
than asserted. AD-6 vs the contract on uncatalogued ids is settled in the only direction the
component graph permits, and the reasoning ("a hard file error is `core`'s refusal, and `core`
cannot see `catalogue/items.json`") is the right shape. AD-29 is a well-built AD: the choice
between full weight / designated line / divided mass is argued from the marginal, the
denominator fix is justified by what a draw selects, and the `coOccur` corollary was found by
the author rather than reported — which is the behaviour this gate exists to produce.

What follows is what the revision did **not** close, ordered by what it lets two builders do
differently.

---

## Critical

### C-1 — AD-17's `coOccur` makes the tracked-list partition check depend on a file that may not cover the base, and neither its evaluability nor its blast radius is stated

**Location:** AD-17, the `coOccur` paragraph (spine ~line 293); against AD-18's unrankable
clause (~line 361) and AD-3's "refuses to render an invalid artifact" (~line 89).

`coOccur(x, y)` holds when "some `sourceModifierId` **in the scoped pool** (AD-18) emits an
entry contained by `x` and an entry contained by `y`". The spine is explicit that this is a
cross-file test evaluated in `core` at load, and that overlap is "a **validation error on
`data/tracked.json`**, rejected at load, not a case `core` reconciles."

Three states of the pool are left undecided:

1. **The base is absent from `weights.json` entirely.** AD-18 says such a base is *unrankable*
   — a soft, per-base outcome. But AD-17 says an overlap is a *load-time rejection*. There is
   no scoped pool over which to evaluate `coOccur`, so a builder must choose between: treat
   `coOccur` as `false` (predicate short-circuits, list validates, base drops out as
   unrankable); treat the check as unevaluable and **refuse the tracked list**, taking the
   product dark; or skip the base's partition check but keep the rest. All three are readings
   of the text as written. The first two differ by *the whole site rendering or not*.
2. **`poolCoverage: "partial"`.** The pool is present but admittedly incomplete, so a
   co-occurring pair may be absent from it. `coOccur` then returns `false` on a pair that does
   co-occur in the game, the partition check passes, and that base's `ΣP` exceeds 1 — the exact
   failure AD-29 added the branch to prevent, silently, on precisely the bases already flagged
   as least trustworthy. Nothing says a `partial` pool makes the partition check unsound (it
   does), and AD-18's `absent` provenance does not reach the partition check.
3. **The uniform-prior bootstrap file.** AD-11 and the contract both bless it as a valid file
   and the development path from day one. Its author has no reason to model hybrids, so every
   `coOccur` returns `false` during the entire pre-weights build — the branch is dead exactly
   when the code that depends on it is being written and tested.

**The divergence permitted:** a tracked list that one builder's `core` loads and another's
refuses, with the difference visible to the user as an empty site. Separately, a new failure
mode the spine has not acknowledged: **a weights-file regeneration can newly invalidate an
unchanged tracked list**, because the producer re-keys a hybrid or newly names a row, and
under AD-17's "rejected at load" that darkens the product on a file the curator does not own
and did not touch. AD-27 already accepts that a regeneration moves coverage; it does not
anticipate a regeneration moving *validity*.

**What would close it:** state, in AD-17, (a) the owner and the scope — `core`, per base,
against that base's scoped pool; (b) that a base with no `complete` pool is excluded from
the ordering rather than rejecting the list, so the consequence of an unevaluable partition
check is the same consequence AD-18 already assigns to an unusable pool; and (c) that a
`partial` pool makes the partition check advisory and is one more reason such a base does not
rank. That keeps the refusal for what the curator can actually fix.

### C-2 — The cohort-carriage bound is written two ways and, under the contract's spelling, is vacuous for the normal case

**Location:** AD-28 "A cell may be carried by at most two cohorts" (spine ~line 545) and its
"Two producer obligations" paragraph (~line 543), against `WEIGHTS-FILE-SCHEMA.md` line 102,
line 175 and the hard-error at line 360.

Three statements of one check, at two different keys:

| Where | Key |
| --- | --- |
| AD-28, ~545 | "carried by at most two cohorts" — per family, no `sourceModifierId` |
| Contract, 102 and 175 | same — per family, no `sourceModifierId` |
| Contract, 360 (hard errors) | "within one `(base, slot, statId, **sourceModifierId**)` family" |

Two builders write two different validators from these; the one implementing line 360 accepts
files the one implementing AD-28 refuses. That alone is a divergence on a **hard file error**.

Worse, the rescoped form is close to inert. AD-28's own worked example assigns each *tier* its
own source modifier — `lightning-dmg-t7` at ilvl 60 and `lightning-dmg-t8` at ilvl 65 — which
is the expected shape, since a game tier *is* a game modifier. Under the line-360 key, the
shared cell `[56,56.5]` is carried once by `lightning-dmg-t7` and once by `lightning-dmg-t8`:
carriage of **one** per family, not two. A producer emitting one wide cell per cohort likewise
gets carriage one per source modifier and sails through. Yet AD-28 still claims this bound is
"what makes the coarse-partition case detectable" and that it "refuses the degenerate case
outright" — the sole mechanical defence AD-28 names against the BQ-1-through-a-coarse-cell
failure, and the reason the paragraph is allowed to end in "what remains is trust".

**The divergence permitted:** a file whose partition is degenerate loads clean, every curator
on the affected bases is forced into a full-span reference, and AD-16 prices that span at the
neighbouring tier's cheap tail while AD-18 carries the whole span's mass. That is BQ-1, and
the check the spine points at will not see it.

**What would close it:** pick one key and state it in both documents. If the intent is to keep
the bound meaningful, it must count carriage over **distinct `(itemLevelMin, sourceModifierId)`
pairs for one interval within `(base, slot, statId)`** — i.e. the number of *cohort
contributions* to the interval, which is what the "only adjacent tiers overlap" assumption
actually bounds — and AD-28's claim about detectability has to be re-derived against whichever
form is chosen, or withdrawn.

---

## High

### H-1 — AD-26's rotation key still says `not-yet-synced`, which AD-9 has now decoupled from "never attempted"

**Location:** AD-26 row 2 (~line 439), against AD-9's rev-5 paragraph (~line 168), AD-20
(~line 377) and AD-19 (~line 371). AD-26 was not amended in revision 5.

AD-9 now makes the load-bearing distinction *absence of `lastAttemptedAt`*, and reasons it
explicitly through the rotation: "row 2 treats a never-synced entry as **infinitely old**
precisely so a new entry is picked up before any refresh." But AD-26 row 2 is still keyed on
the **price state**: "`not-yet-synced` treated as infinitely old."

Those are no longer the same set. AD-20 writes `not-yet-synced` **after** an attempt when a
listing's currency has no current rate — a persisted state with a fresh `lastAttemptedAt`.
Under AD-26's literal text such an entry sorts infinitely old in every subsequent chunk and is
re-selected forever, monopolising the rotation; under AD-9's reasoning it sorts by its real
attempt time. This is precisely the starvation AD-26 row 2's own rationale says the
`lastAttemptedAt` key exists to prevent, re-entered through the state term. AD-19 adds a second
case in a different direction: a wrong-league observation is `not-yet-synced` **to `core`**
while the dataset row `sync` reads still says `priced`, so the two components do not even agree
on which entries the row-2 convention applies to.

**The divergence permitted:** two syncers with materially different refresh behaviour after a
currency gap or a league change, both schema-valid, differing only in how stale each row is —
which is the exact failure AD-26 was created to prevent.

**What would close it:** restate row 2's key as "ordered by `lastAttemptedAt`, **an absent
`lastAttemptedAt` sorting as infinitely old**", drop the state term, and say which view of
price state `sync`'s rotation reads.

### H-2 — `mass(g, L)` is defined as a "common" value the checked invariant does not guarantee, and `core` has no defined behaviour when none exists

**Location:** AD-18's denominator paragraph (~line 349) and AD-29's group-consistency paragraph
(~line 563); contract "The group-consistency rule" (line 204) and hard error (line 361).

AD-18: "`mass(g, L)` is the weight of that one game modifier within the scope — the common
per-`statId` sum of `g`'s scoped entries, which AD-29 requires to agree and `core` checks."

The invariant AD-29 and the contract actually state is narrower in two ways:

- It is scoped to **one `itemLevelMin` cohort**. `mass(g, L)` is over the *scope*, a union of
  every cohort at or below `L`. Agreement per cohort implies agreement over the union only if
  every statId of the group is represented in every cohort — which AD-28 explicitly does not
  guarantee, since "cells a cohort cannot reach are not emitted".
- The quantifier is ambiguous. "is equal for every `s` in `g`" — is `g` the group as it appears
  *in that cohort*, or across the file? If the latter, a statId with no emitted cell in a
  cohort sums to 0 and the file is a hard error; if the former, it is skipped. Two builders
  write two validators, one refusing files the other accepts, on a **hard file error**.

And where no common value exists, AD-18 says nothing. A builder must invent: take the maximum,
take the first statId's sum, take the group's designated line, or throw. Each choice changes
every probability on the base and therefore the ranking order — the exact class of divergence
AD-18 exists to close.

**What would close it:** define `mass(g, L)` operationally rather than by description — e.g.
`max over s of Σ{ e.weight : e ∈ g, e.statId == s, e.itemLevelMin <= L }` — state that the
checked invariant makes the choice of `s` immaterial *where every line is represented*, and
say what `core` does when it is not (most likely: extend the group-consistency error to the
scoped union, so it is a refusal rather than a silent pick).

### H-3 — The contract still declares an uncatalogued `statId` a hard file error, in the same document whose 4.0.0 note removes it

**Location:** `WEIGHTS-FILE-SCHEMA.md` line 338, the `statId` field rule: "An id absent from
the catalogue is a hard file error, not a skip." Against the same file's 4.0.0 change table
(line 29) and its Validation section (line 363), both of which say it is no longer one, and
against AD-6's rev-5 amendment.

This is the OQ-14 contradiction the revision explicitly claims to have closed, surviving in the
field-rules table. A builder reading the field rules — the natural place to look when writing
the Zod schema, which is where this check would land — implements a refusal that takes the
whole product down over a condition AD-6 assigns to `sync` and reports only. The `bases` key
row (line 332) is softer but also says "validated against the committed catalogue" without
saying by whom or with what consequence, so it inherits the same ambiguity.

**What would close it:** rewrite line 338 to point at AD-6 ("surfaced in `sync-report.json`;
never a file error"), and give the `bases` row the same treatment.

### H-4 — Nothing mechanically holds two source modifiers' cells for one `statId` to the same partition, and the failure is reported against the party who cannot fix it

**Location:** AD-29's final paragraph (~line 567), AD-28's "Non-overlap is restated" (~line 537),
contract non-overlap row (line 340) and hard-error list (lines 355–361).

AD-29 is precise about the keying interaction in prose: the partition is cut per
`(base, slot, statId)` across **every** modifier publishing that stat, while the group is per
modifier, and non-overlap is scoped by both. But rev 5 rescoped the only checks that touched
this — duplicate keys and non-overlap both gained `sourceModifierId` — and added nothing to
replace what the old `statId`-scoped non-overlap incidentally enforced. Nothing in the
hard-error list now refuses modifier A emitting `[10,20]` and modifier B emitting `[15,25]` for
one `statId` in one `(base, slot)`.

That file loads. The consequence appears later, at a different party: no curator reference can
be edge-aligned to both, and B's cell straddles any reference aligned to A's — surfacing as
AD-18's straddle error **against `data/tracked.json`**, blamed on a tracked entry the curator
cannot correct, since the fix is in a file the producer owns. AD-18 and the contract both argue
the straddle belongs to the tracked entry "because the same weights file straddles nothing
against a differently-aligned tracked list" — true of a *correctly partitioned* file, and the
thing that made it correctly partitioned was an obligation that is now stated only in prose.

This one is checkable and therefore, by the spine's own standard ("a rule `core` cannot verify
is an aspiration"), should be checked: any two cells sharing a `(base, slot, statId)` must be
**identical or disjoint**. That is a pure single-file property, a natural hard error, and it is
exactly what "cut once per `(base, slot, statId)`" means operationally.

**What would close it:** add that hard error to the contract and name it in AD-29's keying
paragraph, so the obligation the paragraph asserts has an owner who can run it.

---

## Medium

### M-1 — The revision banner under-reports again, in the revision whose stated purpose includes fixing under-reporting banners

**Location:** the Revision 5 banner (~line 25).

It correctly names the eight amended ADs, AD-29, the precision change and the two corrected
banners. It does not name:

- **Deferred gains a new entry** — "Pricing a deliberate conjunction of co-occurring stats"
  (~line 752), which is a real decision with a revisit trigger, not an editorial note.
- **Consistency Conventions moved in three further rows beyond precision** — the `Ids` row
  gains the whole `sourceModifierId` exception paragraph, the `Bands` row gains
  `sourceModifierId` scoping, and the Numeric-precision row gains the median knock-on.
- **`AGENT-WORKFLOW.md` moved** — build order step 1 now carries the two `core` rules that ride
  on `sourceModifierId`, which is the companion a builder reads first.
- The Structural Seed's core-entity note and the Brief Scope map both re-cite AD-29.

The banner's stated job is to tell a downstream reader what to re-read. A reader who trusts it
skips the Deferred item and the Conventions rows — and the Conventions `Ids` row is where the
"never on a `ModifierRef`" rule that guards AD-5's identity actually lives.

### M-2 — AD-16's median rationale is false for any listing not already denominated in divine

**Location:** AD-16's even-sample paragraph (~line 260) and the Numeric-precision convention
(~line 584).

Two of the three reasons given do not survive AD-20. "Every persisted price [is] a price
someone actually asked" and "it lands on the 2-decimal grid with no second rounding step, since
listing prices already sit on it" are true of a listing priced in divine; AD-20 normalises
every other listing by division against an exchange observation, which lands anywhere and must
be rounded. AD-16 itself notes the result set commonly spans currencies. So the persisted
figure is generally *not* a price anyone asked, and there *is* a rounding step.

The chosen rule is still right — selecting a middle value rather than averaging keeps the
estimate on real listings where it can and stays conservative — but a builder who trusts the
stated reason will skip the rounding the convention requires. Related and also unstated: whether
the median is selected **before or after** rounding. It happens not to matter for a selection
rule, which is worth saying, because the same text sits three lines from the sentence that
tells `core` never to re-round.

### M-3 — `coOccur` as written is broader than the decision it implements, and its scope parameter is only implicitly bound

**Location:** AD-17's `coOccur` paragraph (~line 293); `.memlog.md` rev-5 AD-29 corollary.

The recorded decision was "different `statId`s overlap when some source modifier in the scoped
pool publishes both **and the bands are jointly satisfiable**". The spine drops joint
satisfiability and substitutes "in the same item-level cohort". The substitution errs toward
rejection, which is the safe direction for a partition, so this is not a correctness finding —
but it is a silent narrowing of what a curator may express, and it should be recorded as chosen
rather than read as a transcription. After AD-28 decomposition a modifier's two lines each span
several cells, and containment of *some* cell in `x` and *some* cell in `y` does not establish
that one item reaches both.

Separately, `coOccur` takes a "scoped pool (AD-18)" but names no `L`. It is derivable — AD-17
rule 3 gives a base exactly one crafted floor — but AD-18 was careful to say the scope "comes
from the *entry's* floor and the weights band's `itemLevelMin`, and no third source", and AD-17
rule 3 is now explicitly exempted for raw bases. Naming `L = the base's crafted floor` in the
predicate costs one clause and removes the inference.

### M-4 — `cohortTotals` was left keyed `(statId, itemLevelMin)` while its siblings were rescoped

**Location:** contract line 335 and lines 149–159; AD-28's conservation paragraph (~line 535).

Duplicate keys, non-overlap and cohort carriage all gained `sourceModifierId` in rev 5.
`cohortTotals` did not, and nothing says whether that is deliberate. It appears to be correct —
the total is per stat line and a hybrid contributes its full weight once per `statId` — but the
document never states how a hybrid's weight enters a `cohortTotal`, nor that two distinct source
modifiers publishing one stat in one cohort both fold into a single declared total. A producer
rescoping it "for consistency" emits per-modifier rows that `core` then fails to match, and a
`core` author summing cells per `(statId, itemLevelMin, sourceModifierId)` against a file
declaring per `(statId, itemLevelMin)` refuses every hybrid-bearing file.

---

## Low

- **L-1 — AD-11's entry tuple is incomplete.** (~line 191) `(sourceModifierId, statId, valueMin,
  valueMax, itemLevelMin, weight)` omits `kind` and `provenance`, both required by the contract
  and both load-bearing (`kind` is the discriminant AD-5 exists for). The sentence says "every
  field of the chosen kind required", which reads as a complete enumeration.
- **L-2 — Dataset row lifecycle under a re-banded entry is silent.** A curator narrowing a band
  changes the `TrackedEntry` canonical key (Conventions, ~line 580), orphaning the dataset row
  under the old key. AD-14 says `dataset.json` holds "the latest observation per tracked entry",
  which implies orphans are dropped, but nothing says who drops them or when — one builder
  carries them forever (page weight, and a row `web` may render), another prunes on write. AD-23
  gives `pruned` a tombstone precisely because silent disappearance was judged wrong; the
  re-banding case has no equivalent.
- **L-3 — AD-26 row 1 inherits an unstated absent-key convention.** Pinned entries order by
  "oldest `lastAttemptedAt` first, the same key row 2 uses", but row 2's convention is expressed
  in terms of price state, not absence (see H-1), so a never-attempted pinned entry has no
  stated position. Fixing H-1 fixes this.
- **L-4 — "Pool completeness counts stat lines, not rows" lives only in the companion.**
  (contract line 224) It is a real completeness rule — dropping one line of a hybrid is as bad
  as dropping a modifier — and AD-29, AD-18 and AD-27 are all silent on it. AD-27's coverage
  fraction is computed from `poolCoverage` declarations, so the rule's absence from the spine
  leaves the gate resting on a definition only the companion carries.

---

## Checklist findings that came back clean

- **Deferred permits no divergence.** Each of the fifteen entries names what is *not* built and
  most carry a revisit trigger. The new "Pricing a deliberate conjunction" entry is the one that
  could have leaked — a curator might reach for the two-entry spelling — and it closes itself by
  stating that AD-17 rejects that spelling and why (see C-1 for the blast radius of that
  rejection, which is a separate matter). "Mod-group conditional probability" and "A measured
  split for value cells" both sit under stated assumptions already written into AD-18 and AD-28.
- **The AD-16 / AD-18 population identity survives AD-29.** A reference on one line of a hybrid
  produces a search filtering on that `statId` alone (AD-16), returning items carrying that line;
  the numerator sums every entry carrying that `statId`, which is the mass of every modifier
  publishing it. Priced population and weighted population remain the same population. This was
  the property most at risk from the explosion and it holds.
- **The numerator cannot exceed the denominator.** Each modifier contributes at most its
  per-`statId` mass to the numerator and exactly that mass to the denominator, so `P ≤ 1` per
  reference is preserved by construction under the new keying — worth recording, since the old
  reading's failure was a denominator inflation and the fix moves in the opposite direction.
- **The provenance carve-out composes with AD-29.** AD-10 draws `modelled-split` from the
  containment set only; AD-29 changes the denominator's *arithmetic* but not its measurement
  status, so the carve-out's premise (a conserving transformation leaves the denominator as
  measured as it was) still holds.
- **No owned dimension is wholly silent.** Ports, error shape, versioning, precision, ids, keys,
  ordering, budget, deployment, test isolation and build sequencing each have a decision or an
  Open Question. The nearest thing to a silence is L-2.

---

## Verdict

**revise.** Two critical findings, both of which are amendments to existing ADs rather than
structural rework: C-1 needs AD-17 to say what an unevaluable or `partial` pool does to the
partition check and how far a rejection propagates, and C-2 needs one spelling of the
cohort-carriage bound plus an honest re-derivation of what it detects. H-1 through H-4 are each
a paragraph. H-3 is a one-line correction in the companion and should not survive another
revision, since it is the very contradiction this revision was convened to close.
