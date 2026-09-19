---
title: 'Handoff — PRD revision 11'
from: 'Winston (System Architect)'
to: 'John (Product Manager)'
date: '2026-09-19'
status: 'closed'
closed: '2026-09-19'
closed_by: 'John (Product Manager) — prd.md revision 11'
authority: docs/architecture/architecture-poe-crafting-base-price-checker-2026-09-12/ARCHITECTURE-SPINE.md
---

# Handoff — prd.md revision 10 → 11

`ARCHITECTURE-SPINE.md` is **final at revision 10** and is the authority you inherit.

**This is a citation-and-consistency pass, not a re-litigation of any requirement.** 33 FRs
remain, §7.1 *In Scope* is unchanged, and no FR is added, removed or renumbered. One FR
(FR-11) needs a judgement call; everything else is reconciliation.

## Why this exists

Spine revision 10 did two things in one pass. It absorbed the approved sprint change
proposal of 2026-09-19 (weights contract `5.0.0`, producer-driven, whole-tier containment) —
**the PRD already absorbed that at revision 10, so none of it is your problem.** It also ran
a **simplification pass**, authorised after that proposal was approved, which merged ten ADs
into their neighbours and retired their ids. That is what broke your citations.

The spine's *Retired AD map* section carries the full mapping. The exhaustive per-line list
of every stale citation, with surrounding context, is in:

`docs/architecture/architecture-poe-crafting-base-price-checker-2026-09-12/reviews/review-rev10-reconcile.md`

## 1. Stale AD citations — 106 occurrences across 84 distinct lines

| Retired | → | Count |
| --- | --- | --- |
| AD-2 | AD-1 | 2 |
| AD-6 | AD-9 | 8 |
| AD-14 | AD-19 | 6 |
| AD-18 | AD-17 | 30 |
| AD-21 | AD-3 | 6 |
| AD-22 | AD-3 | 2 |
| AD-23 | AD-12 | 10 |
| AD-26 | AD-7 | 13 |
| AD-28 | AD-11 | 10 |
| AD-29 | AD-11 | 19 |
| **Total** | | **106** |

## 2. Two traps — do not blind find-and-replace

- **Line 22 (§0)** asserts *"the spine's decisions AD-1 through AD-29"* and *"AD ids are
  stable across every revision."* **Both are now false at the document's front.** This needs
  rewriting as prose, not substitution — the stable-id rule held for nine revisions and was
  deliberately broken once, while nothing was built. Say that plainly.
- **Lines 770, 783, 785, 787** are retired-OQ log entries — historical records of what was
  decided at the time. Substituting an id there would falsify the record. **Annotate rather
  than substitute** (e.g. *"AD-18 (retired to AD-17 in spine rev 10)"*).

## 3. New AD-0 — the only id revision 10 added

*A cited companion section binds exactly as the AD that cites it.* This makes the new
companion **`IMPLEMENTATION-NOTES.md`** binding, alongside `WEIGHTS-FILE-SCHEMA.md`.

The companion now holds material the spine used to carry inline: the interval derivation,
the overlap predicate, edge-alignment worked examples, the coverage-fraction predicates, the
canonical key encoding, the even-sample median, the four search-construction traps, the
rate-limit buckets, and the `pinned` cap inequality.

Add it to the PRD's `inherits:` list, and cite it where the PRD leans on that material.

## 4. FR-11 — needs your judgement, not an edit

AD-10 now states provenance propagation is **pool-wide**: a probability's inputs are every
entry in its scoped pool, numerator **and** denominator alike.

**The consequence:** one tier carrying `weightSource: "absent"` anywhere in a scoped pool
makes *every* probability on that Base Type read `uniform-prior`.

FR-11 currently expects the badge to discriminate **from day one**, on the ground that
`weightSource` varies per tier. Under pool-wide propagation the badge discriminates
**between Base Types**, not within one. FR-11's stated expectation needs restating to match.

The spine carries this inline in AD-10, tagged `[RAISE-BACK to the PM]`.

## 5. Two new Open Questions for §10

Both were raised by the revision 10 reviewer gate.

- **OQ-20 — what `query.status` must carry, and whether it duplicates `sale_type`.** A
  captured live browser search (`curl-creater-trade-search.txt`, in the PRD folder) sends
  `{"option": "securable"}`, and AD-16 never specified `query.status` at all. *Verified
  live:* `/api/trade2/data/filters` publishes `securable` under `status_filters` labelled
  **"Instant Buyout"** — so the value is documented and its label matches the intent, but
  whether it duplicates, composes with or conflicts with the `trade_filters.sale_type` rule
  AD-16 already requires is open. **Owner: `sync`'s builder.** Not blocking for `contracts`;
  blocking for a correct first price.
- **OQ-21 — how far whole-tier containment can understate.** The approved sprint change
  proposal §3.2 claimed two things bound the damage. **That claim is false as stated.** Edge
  alignment compares a band only against its own containment set, so a *flush intrusion* —
  a scoped same-`statId` tier that intersects the band without being contained and shares an
  edge with it — is invisible to it. Worked case in AD-11. **Owner: the spine, with the
  player**, once a conforming file makes the frequency measurable. Not blocking for building;
  blocking for trusting the ordering.

  **Why this one touches the PRD:** §7.2 carries *"measuring the understatement"* as a
  deferred item written on the assumption that the error is bounded. That assumption is
  withdrawn, so the deferred item's framing needs updating alongside adding OQ-21.

## Out of scope for you

The UX spines (`DESIGN.md`, `EXPERIENCE.md`) still carry `statLineCounts` and the retired
`modelled-split` treatment. That is routed to the **UX designer** by sprint change proposal
§4.11, which also leaves the *"three semantic inks"* question to the designer's own call.
