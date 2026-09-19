# Fidelity Review — PRD revision 9 → 10 against Sprint Change Proposal 2026-09-19 §4.6–4.10

**Overall verdict:** The revision-10 edit is faithful and substantively complete. Every named item in proposal §4.6–4.10 was located and applied correctly: the three-term glossary retirement (Value Cell, Cohort, `cohortTotals`), the five glossary rewrites, FR-27/28/29's rewrite, FR-22's reversed curation instruction, FR-16/FR-21/FR-4's amendments, FR-10/FR-11's Provenance narrowing, and the frontmatter/§0/§7.2/§7.3/§10/§11 updates. All five of §5.4's mechanical success criteria hold: exactly 33 FRs (FR-1…FR-33, no gaps), §7.1 is byte-identical to revision 9, every `(AD-n)` citation resolves inside AD-1…AD-29, no stray "five checks" survives, and OQ-19 is present in §10. The three reviewer-flagged judgment calls (FR-29's rejected-alternatives framing, three of the four new `[ASSUMPTION]` tags) are accurate restatements of the proposal. The defects found are narrow: one judgment call (the Accepted Tier `tierLabel`-prohibition rewrite) omits the proposal's actual stated reason for why the reason needed rewriting at all, and the newly added §11 index entry for FR-11 cites the wrong section number, with a related ordering nit in the same list. Nothing rises to critical; nothing found contradicts the 5.0.0 contract or breaks an untouched section.

**Findings by severity:** critical: 0, high: 0, medium: 1, low: 2.

---

## Medium

### M1 — Accepted Tier's rewritten `tierLabel`-prohibition reason omits the proposal's actual stated reason for the rewrite

**Location:** §3 Glossary, *Accepted Tier* entry.

**Quoted text (current PRD):**
> "Second, the label is **never joined to the Weights File's own tier data**, for the identical reason: a run of tiers has no single tier identity to join against, and a rule that worked only for the single-tier case would be a silent trap for the multi-tier one."

**Why it's a problem:** Proposal §4.6 flags this specific passage as needing "a rewritten reason, **because `5.0.0` makes the join *possible* in the single-tier case** and it stays forbidden." That is the substantive fact that makes a rewrite necessary at all: under `4.x`'s cell decomposition, no single-tier file identity existed to join to in *any* case, so the prohibition needed no justification beyond "there's nothing to join to." Under `5.0.0`, an entry now *is* one tier, so in the single-tier band case a join to the Weights File's own tier data becomes technically available for the first time — and the PRD's job was to explain why the rule stays "never join" even though the join is now sometimes possible. The current text argues only the symmetry point (a run of tiers has no single identity), which was already true and available as an argument before this proposal. It never states that a join is newly possible in the single-tier case, so a reader cannot tell from the text why this passage needed rewriting under `5.0.0` at all, or infer the actual scope of what stays forbidden now that it's technically buildable.

**Suggested fix:** Add a clause acknowledging that `5.0.0`'s tier-as-entry shape makes the join technically available where a band happens to equal exactly one tier's own interval, before pivoting to the run-of-tiers argument for why the rule stays uniform. E.g.: "…never joined to the Weights File's own tier data — a join that `5.0.0`'s tier-as-entry shape makes technically possible in the single-tier case, and that possibility is exactly what the rule declines to exploit, for the identical reason: a run of tiers has no single tier identity to join against…".

## Low

### L1 — §11 Assumptions Index: the new FR-11 entry is filed under the wrong section

**Location:** §11 Assumptions Index.

**Quoted text:**
> "**§4.9 / FR-11** — The per-row Provenance badge plus one smaller pool-level warning are enough for the player to avoid over-generalising from a single tier's Provenance to its pool's. No stronger UI affordance is required for v1."

**Why it's a problem:** FR-11 ("State the uniform-prior caveat globally when the per-row badge discriminates nothing") is defined under **§4.4 Provenance and Freshness Surfacing**, not §4.9 (League Lifecycle, home of FR-31/FR-32). Every other entry in this index correctly cites the FR's actual home section (e.g. "§4.4 / FR-10" two lines above it, for FR-10, which sits in the same feature section as FR-11). The mislabel likely came from copying the adjacent pre-existing "§4.9 / FR-31" line's section tag when drafting this new entry. A reader using the index to jump to an FR's containing feature section will be misdirected.

**Suggested fix:** Change "§4.9 / FR-11" to "§4.4 / FR-11".

### L2 — §11 Assumptions Index: the four new entries break the list's document-order convention

**Location:** §11 Assumptions Index.

**Quoted text:** the run of four new/edited bullets — "§4.6 / FR-21" (homogeneity), "§4.4 / FR-10", "§4.8 / FR-29", "§4.9 / FR-11" — inserted between the pre-existing "§4.6 / FR-22" and "§4.7 / FR-26" lines.

**Why it's a problem:** Every entry pre-dating this revision appears in document order (§4.1 entries first, then §4.2, §4.5, §4.6, §4.7, §4.9, §5), which lets a reader treat the index as a second table of contents. The four new entries are all spliced into one place — between the §4.6 and §4.7 entries — rather than into their own sections' natural positions: the §4.4/FR-10 entry now appears *after* the §4.6 entries instead of before them, the §4.8/FR-29 entry appears before the §4.7 entry, and (independent of L1) the mislabeled §4.9/FR-11 entry appears before §4.7 rather than beside the other §4.9 entry at the bottom. This is cosmetic — no content is wrong — but it silently drops a structural property the document had maintained through nine prior revisions.

**Suggested fix:** Re-sort the index by section number: move "§4.4 / FR-10" up beside the (also-new) implicit FR-11 entry ahead of the §4.5/§4.6 block, move "§4.8 / FR-29" to just before "§4.9 / FR-31", and move the corrected "§4.4 / FR-11" entry next to "§4.4 / FR-10".

---

## Verified clean (no finding)

- Glossary: Value Cell, Cohort, `cohortTotals` retired with no live (non-retirement-record) survivors anywhere in the file; the five rewritten terms (Modifier Weight, Source Modifier, Eligible Pool, Provenance, Weights File) match proposal §4.6 point for point; the new `weightSource` entry is present and correctly scoped to "exactly one purpose."
- FR-27/FR-28/FR-29: the ~two-thirds cut of FR-27, the two-halves completeness statement in FR-28, and FR-29's full rewrite (containment table, collapsed denominator, whole-tier-containment ruling with both rejected alternatives, edge alignment retargeted, straddle-rule withdrawal, "two not three" cross-file check count) all match proposal §4.7 in substance and in the specific phrases the proposal called out ("Ten checks retire … because its subject is gone rather than because the bar dropped").
- FR-22's reversal is stated as a reversal, with the correct worked Bows T7/T8 example and the correct "curate to a whole tier, or a run of adjacent tiers" replacement rule.
- FR-16, FR-21, FR-4: all "unchanged" clauses proposal §4.8 named are in fact untouched (overlap predicate, branch order, both-valueless branch, search shape, four verified traps, coverage predicates); the two FR-21 argument changes (two-party filter unit, conceded homogeneity argument tagged as assumption) are both present and correctly worded.
- FR-10/FR-11: Provenance now two render treatments, propagation exception retired, banner condition narrowed to "no probability carries `measured`," replacement warning added — all match §4.9.
- §0 banner, §7.2, §7.3, §10, §11 all carry the required content (cost paragraph, OQ-19 finding, three §7.2 items with correct sequencing note, OQ-12 amendment, OQ-19 addition, four assumptions added/one amended).
- FR-14's incidental edit ("four checks together") and the §7.3/FR-30-citing/FR-11-citing sentences touched for internal consistency are all necessary and correctly executed; no FR-30 or FR-33 body text was altered, only citations to them elsewhere.
- Success criteria: 33 FRs (FR-1…FR-33, no gaps, confirmed by heading scan); §7.1 is byte-identical to the revision-9 committed text (diffed against `git show HEAD:<path>`); every `(AD-n)` citation found in the file resolves within AD-1…AD-29; no surviving "five checks" language; OQ-19 present in §10.
- FR-29's "rejected alternatives" framing (pro-rating and whole-tier inclusion, with their stated rejection reasons) is a faithful, complete restatement of proposal §3.2's table.
- Three of the four new `[ASSUMPTION]` tags (FR-10, FR-21, FR-29) are accurate and, for FR-21, explicitly called for by the proposal's own "tagged as an assumption rather than asserted" language. The fourth (FR-11) is a reasonable, non-contradictory judgment call not mandated by the proposal text.
- No untouched FR or glossary entry was found still assuming the retired cell/cohort/4-value-Provenance model outside of explicitly-marked retirement records (checked FR-9, FR-13, FR-15, FR-17–FR-20, FR-23–FR-26, FR-30–FR-33, and all §10 BQ/OQ historical records; the one exception, BQ-2's "Weights File schema 2.0.0 — 4.1.0" version citation, was in fact correctly updated to "2.0.0 — 5.0.0" and "every band" correctly updated to "every entry").
- `ARCHITECTURE-SPINE.md` itself is still at revision 9 (not yet updated by the parallel architecture effort), and none of the PRD's technical claims that assume revision-10 spine content (containment table, denominator formula, three-value Provenance table) contradict either the current spine text or the proposal's stated spine changes — per the review brief, this is an acceptable state and not counted as a finding.
