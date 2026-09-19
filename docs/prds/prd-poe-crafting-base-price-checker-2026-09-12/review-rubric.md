# PRD Quality Review — PoE2 Crafting Base Price Checker (revision 10)

## Overall verdict

This is an unusually rigorous PRD, and revision 10's absorption of the Weights File 5.0.0 breaking change holds together: the withdrawn cell/cohort machinery is purged cleanly from every FR it touched, the new whole-tier-containment rule is stated with its costs named rather than hidden, and both remaining open questions (OQ-12, OQ-19) are genuinely open with stated failure consequences. The risk in this document is not incoherence but archaeology: a 40-line changelog embedded in §0 that a reader must fully parse to know what is current, an Addendum that is five revisions stale and whose own "what landed" convention was not extended to the biggest change yet, and a handful of small citation defects (one Assumptions Index entry pointing at the wrong section, one index entry with no inline tag behind it). None of these block a build; all of them will cost a downstream reader time.

## Decision-readiness — strong

The revision-10 narrative in §0 and in FR-29 does the thing this rubric asks for and most PRDs dodge: it states what was given up, in numbers. "**What whole-tier containment costs, stated rather than implied**" (§0) names three concrete regressions — the trust surface widening from two independent arithmetic audits to none, a known hole (`statLineCounts`) widening with nothing behind it, and every affected probability becoming an understatement that reorders the ranking — rather than describing `5.0.0` as a simplification. FR-29 repeats this discipline and goes further, naming and rejecting the two alternatives a builder would reach for (pro-rating, whole-tier inclusion) with the specific reason each fails.

The two live Open Questions (OQ-12, OQ-19, §10) are actually open: both state "consequence of getting it wrong" in concrete terms (silent corruption across 53 of 63 item classes; permanent untrackability with no curation workaround) rather than being rhetorical questions answered in the next sentence.

### Findings
- **low** Decision record duplicated across three locations (§0, §7.3, §10 OQ-12/OQ-19) — The same revision-10 facts (contract version, what was withdrawn, what whole-tier containment costs) are stated in full three times with slightly different framing each time. *Fix:* none needed for correctness, but consider that §7.3 and §10 could cite §0 rather than restate it, if document length becomes a maintenance concern.

## Substance over theater — strong

No persona theater — there is exactly one user, stated once, not padded into a persona template. NFRs carry real product-specific thresholds rather than boilerplate: NFR-6 is "under 100 ms," NFR-1 requires MSW's `onUnhandledRequest: "error"`, FR-23's rounding is pinned at "4 decimal places" with the arithmetic reason given (a cheap orb would round to `0.00` at 2 decimals and silently zero out Craft Cost). The Vision statement (§1) is specific to PoE2 crafting-base memorization and could not be swapped into another PRD unchanged. Non-Goals (§6) and the Out-of-Scope list (§7.2) read as genuine scoping decisions with reasons, not template filler.

## Strategic coherence — strong

The thesis is explicit and load-bearing: "the ranking is not 'most expensive base'... the threshold is a dial the player turns" (§1), and every feature in §4 traces back to protecting that one number (EV) being honest about what it rests on. Success Metrics (§8) are behavioral and thesis-validating (SM-1/SM-2 test whether the memorization tax actually disappears) rather than activity metrics, and four counter-metrics are named with what each one would otherwise let drift (SM-C1–C4).

## Done-ness clarity — strong

FR consequences are exceptionally concrete and are stated as predicates, formulas, and tables rather than adjectives — e.g. FR-4's coverage formula is given as literal pseudocode with named predicates (`rankable`, `covered`), FR-29's containment table gives exact per-kind conditions, FR-21 states the median tie-break rule explicitly ("the lower of the two middle values, not the mean") because "an unstated rule here is enough on its own to make two implementations return different prices from identical data." No instances of "handles gracefully," "reasonable performance," or "user-friendly" were found standing alone without a bound.

### Findings
- **low** FR-22's `acceptedTier` display-rule content is asserted as flat fact ("The field is display-only and `web` is its only reader") but §11's Assumptions Index carries an entry for it ("§4.6 / FR-22 — `acceptedTier` is a display-only string with no defined grammar...") with no corresponding inline `[ASSUMPTION]` tag in FR-22's body. *Fix:* either tag the claim inline at FR-22 or drop the index entry — see Mechanical notes.

## Scope honesty — strong

Non-Goals (§6) and §7.2 both do real work, each with a stated reason rather than a bare list ("Rejected on both shallowness and cost," "Considered and rejected: the player was explicit that sell speed is not a factor"). `[ASSUMPTION]` density (15 inline instances) is proportionate to the stakes of a breaking external contract, and is concentrated where inference genuinely occurred (default thresholds, filter payload shapes not yet verified live) rather than sprinkled everywhere. The two `[NOTE FOR PM]` callouts sit at genuinely unresolved tensions (Risk R-2's discovery gap; whether `no-listings` volume will force the coarser-fallback option) rather than at safe checkpoints.

## Downstream usability — adequate

FR/UJ/SM IDs are contiguous and stable (FR-1…FR-33, no gaps; OQ-4…OQ-19 accounted for, including retired ones). The Glossary is genuinely used verbatim across FRs, and the revision-10 edit purged retired terms (`cohortTotals`, `statLineCounts`, cell/cohort machinery, the producer-side `kind` field) cleanly everywhere they previously appeared — no leftover reference describes the withdrawn 4.x machinery as if it still existed.

Two things pull this down from strong. First, the term **`absent`** now carries three distinct meanings in the document: the Provenance rank-0 value (§3 *Provenance*), the per-tier field value `weightSource: "absent"` (meaning "producer invented this weight," §3 *`weightSource`*), and the retired 4.x schema check "the `provenance: 'absent'` prohibition" (FR-27's retirement list) — a check about a differently-named, differently-scoped field from an earlier contract version. The PRD explicitly guards against one of these collisions (`weightSource`'s label vs. Provenance `absent`, §3/FR-10/FR-11) but not against a reader conflating the retired check's subject with the current rule that "`absent` is a `core`-side value that must never appear in a file" (§3 *Provenance*). Second, the Addendum (`addendum.md`, still at revision 5, dated 2026-09-13) is five PRD revisions stale. Its own stated convention is "each analysis... ends with the bold **What landed** note that closes it for the current state," but the BQ-1/BQ-2 analyses' most recent "What landed" notes describe the value-cell/cohort world revision 10 just withdrew, with no closing note pointing a reader from "why the pool is scoped this way" to whole-tier containment. A downstream reader who follows the Addendum's own signposting for the *biggest* change to date gets machinery the PRD proper says no longer exists.

### Findings
- **medium** Addendum has no "what landed" note for revision 10 (`addendum.md`, BQ-1 and BQ-2 sections) — The Addendum is the PRD's designated home for "why" reasoning for architecture/curation readers, and its own convention promises a closing note per revision that moved the analysis. Revision 10 is the third breaking contract change and the addendum's silence on it means a reader trusting the addendum's structure will read stale cell/cohort reasoning as current. *Fix:* add a "**Moved again by spine revision 10**" closing note to BQ-1 and BQ-2 pointing to whole-tier containment (§3 *Eligible Pool*, FR-29), matching the pattern already used for revisions 4 and 5.
- **medium** §0 Document Purpose conflates a ten-revision changelog with current-state assertions in one continuous block (lines ~22–43) — A reader cannot easily tell, without reading the whole history, which clause is "true now" versus "was true until revision N." *Fix:* none required for build-readiness, but a short "current state" summary paragraph before the chronological log would reduce the risk of a downstream skim citing a superseded intermediate claim.

## Shape fit — strong

This is correctly shaped as a capability spec for a single-operator tool: UJs are explicitly written "in the template's lighter form" (§2.3) rather than forced into multi-stakeholder journey maps, and Success Metrics are appropriately behavioral/self-reported rather than instrumented, with the PRD stating why ("instrumenting the tool would be more work than the signal is worth," §8). The heavy formalism (predicates, formulas, exact tie-break rules) is justified by §11 of the Addendum ("Why the PRD Cites Architecture Decisions") rather than being over-formalization for its own sake — the stated reason (independently-built components must not diverge) matches the actual risk in a repo with parallel agent worktrees (NFR-4).

## Mechanical notes

- **Broken cross-reference:** §11 Assumptions Index entry "**§4.9 / FR-11**" is wrong — FR-11 ("State the uniform-prior caveat globally...") is defined under §4.4 *Provenance and Freshness Surfacing*, not §4.9 (*League Lifecycle*, which holds FR-31/FR-32). The index's own next line, "§4.9 / FR-31," is correct, suggesting the FR-11 line's section number was copied from a neighboring entry.
- **Assumptions Index roundtrip gap:** the index entry "§4.6 / FR-22" (acceptedTier is a display-only string with no defined grammar) has no matching inline `[ASSUMPTION]` tag in FR-22's body (§4.6) — the claim is stated there as settled fact, not flagged as an inference.
- **Glossary/terminology overload:** `absent` is used for three distinct things (Provenance value; `weightSource: "absent"`; a retired 4.x schema-check name) — see Downstream usability finding above.
- **ID continuity:** FR-1 through FR-33 are contiguous with no gaps or duplicates; OQ-4 through OQ-19 are fully accounted for (open, resolved, or non-blocking) and the document explains its own numbering gap (OQ-1–3 predate the retained-record convention). No issues found.
- **UJ protagonist naming:** all six UJs name "the player" and carry enough inline context (what he's doing, what he sees, what he does next) to stand alone — appropriate for the single-operator shape declared in §2.3.
