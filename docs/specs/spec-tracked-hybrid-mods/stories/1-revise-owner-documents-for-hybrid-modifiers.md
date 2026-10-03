---
title: 'Revise owner documents for hybrid modifiers'
type: 'chore'
created: '2026-10-03'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** SPEC-tracked-hybrid-mods *Document changes* lists the owner documents that must state hybrid references, summed `statId`s and required affixes (CAP-1..CAP-8). Commit 726f809 already revised PRD rev 25 (FR-34, FR-16, FR-22, §3, §7), `PRODUCT.md`, spine AD-5/AD-16/AD-17 (deferred conjunction item deleted), IMPLEMENTATION-NOTES §1–§12.1 (incl. §5.1d pending capture, §5.5) and EXPERIENCE.md's hybrid affix rules. A few spine and IMPLEMENTATION-NOTES passages still describe the pre-hybrid model.

**Approach:** Fix only the residual stale text, each in its owner document, and record the spine revision. Add no new mechanism, and do not restate owner text elsewhere.

</frozen-after-approval>

## Implementation Notes

Residuals to fix (found by investigation on 2026-10-03, branch has no commits ahead of master):

- `ARCHITECTURE-SPINE.md` Core entities ERD (~L2058–2059): `TrackedEntry }o--o| ModifierRef : "prefix band"/"suffix band"` allows an absent affix, which contradicts AD-5/CAP-8. Make both exactly-one (`}o--||`) and relabel to "prefix reference"/"suffix reference".
- `ARCHITECTURE-SPINE.md` Core entities prose (~L2081–2082): "A `ModifierRef` is a bounded band or a valueless stat reference" omits the hybrid arm. Add it and cite AD-5.
- `ARCHITECTURE-SPINE.md` frontmatter: `revision: 26` → `27`. History stays in git (the spine says `.memlog.md`; none exists, so do not create one).
- `IMPLEMENTATION-NOTES.md` §2.5 (~L335): "absence of any entry carrying that `statId`" is single-line wording. Use the reference's `statId`s so that the sentence also covers a hybrid.

Checked and left unchanged:
- PRD/PRODUCT.md agree with SPEC. A PRD clause for summed-operand rejection would add mechanism (AGENTS.md owner rule), and FR-34 already says a malformed entry is refused.
- AD-17's "Line-set completeness" row says "fewer lines". That is correct. A superset or disjoint hybrid contains no tier under §1 (`lineSet == statIds`), so §2.5 empty containment catches it.
- The summed valueless/missing-bound rejections are owned by IMPLEMENTATION-NOTES §2.3 as `contracts` within-file rules, and AD-16 cites §5.5. SPEC CAP-6 says they run "in core". `core`, `web`, `sync` and `tracked:check` all validate through `contracts`, so the observable sites match. Leave the owner placement as it is.
- AD-16 L1160 "a summed filter prices a wider population than AD-17 weighs … accepted with no mitigation" already states the upper-bound acceptance.
- §2.2 "Under `5.0.0`" names the weights version that introduced `lines`. That is historically accurate, so leave it.
- Retired AD map: no AD id is retired, so it needs no row.
- Commit the untracked `docs/specs/spec-tracked-hybrid-mods/stories.yaml` with this story.

Done:
- Spine `revision: 27`. The ERD affix edges keep `}o--o|`, because a `raw` entry carries no affix and the prose states the crafted both-affixes rule (correction from review: the planned `}o--||` was wrong). They are relabelled "prefix/suffix reference, crafted kind", and the catalogue edge now reads "validates each line's statId". The Core entities prose names the hybrid arm and puts `acceptedTier` on the whole reference.
- IMPLEMENTATION-NOTES §2.5 payload now reports the absence of any scoped-pool entry the reference contains (§1).
- Revision history: `.memlog.md` is gitignored (`.gitignore` L57–59), so the commit message is the tracked record of rev 27.
- No test or script reads the spine revision or the ERD, so no code changes.

## Review Triage Log

Layers run: blind-hunter, deferred-ledger-audit. The ledger audit found nothing.

- medium, patched. The ERD `}o--||` claimed that raw entries carry affixes, which contradicts the Core entities prose. Reverted to `}o--o|`.
- low, patched. The §2.5 payload wording "carrying the reference's `statId`s" was ambiguous and conflicted with the hybrid exclusion list. It is now phrased by containment (§1).
- low, patched. The ERD "validates statId" label was singular. It now reads "validates each line's statId".
- false. The ERD `ModifierWeight }o--|| ModifierRef`: this edge predates this change and is an ERD simplification of "weighs". It is unchanged and out of this story's residual scope.
- low, patched. The memlog claim in the spec was inaccurate: `.memlog.md` is gitignored. The note now says the commit message carries rev 27.
- low, patched. The new lines broke the paragraph wrapping. Reflowed.
- low, patched. The `acceptedTier` could be read as per-line on a hybrid. The prose now says "on the whole reference".
- false. "The story frontmatter is stale": finalization sets the status, and `context` is optional.
- false. "Story 1 yaml description still lists done scope": `stories.yaml` is the planning input, and this spec records the narrowing.
- maybe-false (medium if true), deferred. `stories.yaml` states no build order between stories. Ledger entry added. Showing that the builders pick stories out of order would settle it.
- false. "The spine asserts CAP-8 before the code": owner documents lead the code by design, and story 2 implements CAP-8.

Follow-up (2026-10-03): the deferred story-ordering entry is cancelled, and the finding is false. The `bmad-spec` stories schema (`assets/stories-schema.md`) defines `stories.yaml` as "one entry per story, in execution order — stories run top to bottom". The current order meets every dependency the finding named: 2 and 3 come before 4–8, and 9 comes last.
