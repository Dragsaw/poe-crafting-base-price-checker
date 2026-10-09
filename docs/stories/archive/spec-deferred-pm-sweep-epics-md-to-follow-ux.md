---
title: 'Sweep docs/epics.md to follow the epic 2 retro UX rulings'
type: 'chore'
created: '2026-09-27'
status: 'done'
baseline_revision: 'f29d175294d7336e5536107f869c25299f39af3c'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/docs/architecture/architecture-poe-crafting-base-price-checker-2026-09-12/AGENT-WORKFLOW.md'
warnings: []
deferred:
  - summary: >-
      The open deferred-work entry that says the tombstone band is not built still describes the band as prune reason plus `removed YYYY-MM-DD` in 560 + 406, and says the removal date needs a contracts and owner-doc decision; UX memlog 234 (DESIGN.md `tombstone-band`, EXPERIENCE.md state 10) has since ruled that line two is the prune reason alone in one 966px cell with no removal date.
    evidence: |-
      docs/stories/deferred-work.md, the Story 2.5 entry that begins "The tombstone band (`+ N pruned` toggle". The implementer who takes that entry reads the retired layout. The entry predates this sweep, and this sweep may not edit deferred-work.md.
    location: >-
      docs/stories/deferred-work.md (Story 2.5 tombstone band entry)
    severity: low
  - summary: >-
      The craft-recipe AC in docs/epics.md (Story 3.4, `{components.craft-recipe}`) prints the two options as the fixed pair `greater | perfect`, but the grade-prefix rule it now cites also gives `regular` for a recipe with no grade prefix and refuses mixed grades or duplicate words; the AC has no Given/When/Then for either branch.
    evidence: |-
      docs/epics.md, the `{components.craft-recipe}` AC just above the grade-prefix citation; EXPERIENCE.md `{components.craft-recipe}` and DESIGN.md `craft-recipe.optionTextSource` carry the `regular` and refusal branches. The pair predates this sweep. The architect's grade-prefix predicate is already ledgered before the Story 3.4 spec; the PM owes the AC wording once it lands.
    location: >-
      docs/epics.md (Story 3.4 craft-recipe AC)
    severity: low
---

<intent-contract>

## Intent

**Problem:** `docs/epics.md` still carries text that the UX rulings of the epic 2 retro superseded: the tombstone's `removed YYYY-MM-DD` cell and two-cell line two (memlog 234), the single "curation" framing of the fallback (memlog 231), the recipe word "lifted from the composition" (memlog 233), and a restated AD-24 artifact count in UX-DR43. The epics then contradict their owner documents (DESIGN.md, EXPERIENCE.md) with no signal.

**Approach:** A citation sweep of `docs/epics.md` only. Edit each named line so that it no longer states the retired rule, and cite the owner (DESIGN.md / EXPERIENCE.md component or state, AD-24) and do not restate the owner's full text.

## Boundaries & Constraints

**Always:** Edit only `docs/epics.md`. Keep each requirement id (UX-DR9, UX-DR28, UX-DR40, UX-DR43) and each AC's existing FR/UX-DR/state citations. Cite AD-24 by id, not by a count (memlog 229). Keep line wording otherwise intact.

**Never:** Do not edit `prd.md`, the spine, DESIGN.md, EXPERIENCE.md, mockups, code, `deferred-work.md` or `sprint-status.yaml`. Do not touch the AD-24 lines that the retro item 14 sweep entry owns (:96, :995, :997, :1001, :1010, :1022, :1619, UX-DR33). Do not cite `.memlog.md` (it is untracked). Do not add mechanism.

</intent-contract>

## Code Map

- `docs/epics.md:146` -- UX-DR9. "The tombstone's line two is re-cut to two cells at the same sum" becomes one cell at the same sum.
- `docs/epics.md:192` -- UX-DR28. Line two is the prune reason alone; `removed YYYY-MM-DD` goes.
- `docs/epics.md:230` -- UX-DR40. Title "The curation fallback" and "missing either its short form or its declared Accepted Tier": name the short-form half a product gap and the Accepted-Tier half a curation gap.
- `docs/epics.md:242` -- UX-DR43. "All eight artifacts" becomes the artifacts AD-24 names (no count).
- `docs/epics.md:1439-1440` -- Story 2.5 tombstone AC. "prune reason plus `removed YYYY-MM-DD`, in two cells ... 560 + 406" and "A removal date is a calendar fact" become one 966px cell, no removal date.
- `docs/epics.md:1936` -- Story 3.x mono-verbatim AC says "the curation fallback"; it follows UX-DR40's rename so the term does not survive in one place.
- `docs/epics.md:2136` -- craft-recipe AC. "lifted from the composition the Glossary already words" becomes a citation of the grade-prefix rule.
- Owner text (read-only): DESIGN.md `tombstone-band.line2Columns` (:756) and `craft-recipe.optionTextSource` (:574); EXPERIENCE.md *Domain Vocabulary* (:436-446), `{components.tombstone-band}` (:562), `{components.craft-recipe}` (:551), state 10 (:885).
- Concurrent work: open PR #87 (retro item 14 sweep) edits other `epics.md` lines. It does not touch :242, so this change owns :242.

## Tasks & Acceptance

**Execution:**
- `docs/epics.md` -- apply the edits listed in the Code Map -- the owner documents already carry the rulings; the epics must cite them.

**Acceptance Criteria:**
- Given `docs/epics.md`, when searched for `removed YYYY`, `re-cut to two`, `560 + 406`, `lifted from the composition`, `curation fallback` and `All eight artifacts`, then no match remains.
- Given UX-DR40, when read, then it names a missing short form a product gap and a missing Accepted Tier a curation gap, and cites EXPERIENCE.md *Domain Vocabulary*.
- Given the tombstone requirements (UX-DR9, UX-DR28, the Story 2.5 AC), when read, then line two is one cell holding the prune reason alone, no removal date, and the row still does not borrow the two age cells.
- Given the craft-recipe AC, when read, then the option word is cited to the grade-prefix rule of EXPERIENCE.md `{components.craft-recipe}`.
- Given the diff, when listed, then only `docs/epics.md` and this spec changed.

## Verification

**Commands:**
- `pnpm check` -- expected: passes.
- `pnpm test` -- expected: passes.
- `grep -nE 'removed YYYY|re-cut to two|560 \+ 406|lifted from the composition|curation fallback|All eight artifacts' docs/epics.md` -- expected: no output.

## Review Triage Log

### 2026-09-27 — Review pass
- verdicts: 20 findings — high 0, medium 0, low 12, false 8, maybe-false 0
- findings:
  - `[false]` `[reject]` (edge-case) Story 2.5 fallback AC (:1393) lacks the product/curation gap split — the AC says "missing either its short form or its declared `acceptedTier`", which stays true under memlog 231, never says "curation", and already cites UX-DR40, which now carries the split.
  - `[false]` `[reject]` (edge-case) `docs/stories/epic-3-context.md:43` still says "curation fallback" — that file is a compiled cache; step-01 treats it as invalid once any file in `docs/` is newer, so it is regenerated from the swept epics.
  - `[low]` `[defer]` (edge-case) the open ledger entry for the tombstone band still restates `removed YYYY-MM-DD` in 560 + 406 — pre-existing; this sweep may not edit `deferred-work.md`. Deferred to the frontmatter list.
  - `[low]` `[defer]` (edge-case) the craft-recipe AC fixes `greater | perfect` while the cited rule also yields `regular` — pre-existing pair at Story 3.4; the predicate is ledgered to the architect. Deferred.
  - `[false]` `[reject]` (edge-case) the grep is case-sensitive and lowercase "all eight artifacts" survives at :1001 and :1010 — those lines are the retro item 14 sweep's (PR #87), which the Never list excludes; the AC targets UX-DR43 only.
  - `[low]` `[reject]` (edge-case, claim) the spec's Code Map says the term "does not survive in one place" — its fix edits this spec.
  - `[false]` `[reject]` (blind) Story 2.5 fallback AC not swept — same refutation as the edge-case row above.
  - `[false]` `[reject]` (blind) UX-DR43 and :1001 disagree until PR #87 lands — both said eight before, which already contradicted AD-24 (seven); :242 now states only what AD-24 names, which is true whatever the count, and #87 fixes :1001.
  - `[low]` `[reject]` (blind) memlog 233's `regular` and refusal branches have no AC — the intent is "do exactly what the entry describes" and "cite, do not restate"; new ACs are outside it. The pair itself is deferred above.
  - `[low]` `[reject]` (blind) memlog 231's two gaps have no distinguishing AC — outside the intent for the same reason; the owner document holds the rule.
  - `[low]` `[defer]` (blind) the stale sibling tombstone entry in `deferred-work.md` — grouped with the edge-case row above; deferred.
  - `[low]` `[reject]` (blind) the ledger removal has no owner in the spec — its fix edits this spec; the caller removes the entry in the branch's last commit.
  - `[false]` `[reject]` (blind) `revisionPass` in the epics frontmatter not updated — AGENTS.md puts revision history in git, and this is a citation sweep, not a revision pass.
  - `[low]` `[patch]` (blind) the UX-DR9 citation `tombstone-band.line2Columns` is not the full key path — now DESIGN.md `components.tombstone-band.line2Columns`.
  - `[low]` `[patch]` (blind) "The modifier fallback" is a coined term no owner uses — UX-DR40 is now "The fallback.", and :1936 reads "the UX-DR40 fallback".
  - `[low]` `[patch]` (blind) the Story 2.5 tombstone AC lost its reason and citation for "no removal date" — EXPERIENCE.md `{components.tombstone-band}` appended to the AC's citations.
  - `[low]` `[reject]` (blind) the spec's verification is weak — its fix edits this spec. The recheck grep ran with `modifier fallback` added and found nothing.
  - `[low]` `[reject]` (blind) the spec's Code Map is vague (:1936 "Story 3.x") and cites memlog numbers — its fix edits this spec. :1936 is in Story 3.3.
  - `[false]` `[reject]` (intent) R2 residue at :1393 and :2132 — :1393 as above; :2132 "the single word that distinguishes each composition" stays true under the grade-prefix rule, and the Story 3.4 pair is deferred.
  - `[false]` `[reject]` (intent) R3: UX-DR28 and the Story 2.5 AC restate owner wording — a Given/When/Then must state the observable text, and each changed line now cites its owner.
  - (verification-gap: no gaps. deferred-ledger-audit: zero findings.)

## Auto Run Result

Status: done

- **Change:** a citation sweep of `docs/epics.md` to the epic 2 retro UX rulings. The tombstone line two is one cell holding the prune reason alone, with no removal date (UX-DR9, UX-DR28, the Story 2.5 AC). UX-DR40 is retitled "The fallback" and names a missing short form a product gap and a missing Accepted Tier a curation gap. UX-DR43 cites AD-24 with no count. The Story 3.4 craft-recipe AC cites the grade-prefix rule of EXPERIENCE.md `{components.craft-recipe}`. The Story 3.3 AC now names "the UX-DR40 fallback".
- **Files:** `docs/epics.md` (8 lines); this spec.
- **Review:** 3 patches applied (all low); 2 items deferred (low, frontmatter `deferred`); 15 rejected with the reasons in the triage log.
- **Follow-up review:** `false` — no high or medium patch (patched: high 0, medium 0, low 3).
- **Verification:** the grep for the retired phrases (plus `modifier fallback`) in `docs/epics.md` finds nothing; `pnpm check` passes; `pnpm test` passes (1431 of 1431).
- **Residual risk:** open PR #87 edits other lines of `docs/epics.md`; a textual conflict is possible at merge, but no hunk overlaps a line of this change.
