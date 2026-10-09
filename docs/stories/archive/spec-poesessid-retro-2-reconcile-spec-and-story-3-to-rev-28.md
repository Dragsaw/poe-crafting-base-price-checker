---
title: 'poesessid retro item 2: reconcile SPEC and story 3 to spine rev 28'
type: 'chore'
created: '2026-10-04'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context:
  - '{project-root}/docs/stories/archive/spec-poesessid-sync/RETROSPECTIVE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Spine rev 28 (0ce556e) limited the post-probe liveness test to a cookie 2xx under the baseline's `X-Rate-Limit-Policy` (IMPLEMENTATION-NOTES §13.2 `tested`, §13.4). Two passages still describe every cookie 2xx: the Assumptions bullet at `docs/stories/archive/spec-poesessid-sync/SPEC.md:99`, and rows 46–47 of the I/O matrix of story 3 (retro finding R3).

**Approach:** Edit those two passages so that they cite §13.2 `tested` and §13.4, as the rev 28 edits at `SPEC.md:68` and story 3 line 26 already do. A 401 or 403 on any cookie request downgrades; a 2xx downgrades only when it is `tested` and not live; a not-`tested` 2xx is used. The story 3 rows sit inside its frozen block; the operator sanctions this edit by invoking retro item 2 (owner: operator), and the story's Spec Change Log records it. Cite the owner sections; do not restate their predicates.

</frozen-after-approval>

## Implementation Notes

- `SPEC.md:99` (Assumptions): "Both cause a downgrade" is replaced by a citation of §13.4 (with §13.2 `tested`) for which response is a downgrade. The bullet keeps only the observed-response assumption that OQ-26 checks.
- Story 3: matrix row "Expired, 401 or 403" (line 46) already holds under rev 28 and is unchanged. The stale rows were "Expired, 2xx" (47) and "Still live" (48); both now say `tested`. A "Not tested" row records that a not-`tested` 2xx is used with no line. The Approach line 20 ("a not-live 2xx") had the same gap and now reads "a `tested` not-live 2xx". The story's Spec Change Log records the frozen-block edit.
- `stories.yaml` story 3 description had the same wording ("a not-live 2xx") and now says "tested not-live 2xx". This is outside the two passages the retro named, but it is the same stale claim.
- `SPEC.md:41` and `:45` say "fails the liveness test", which `SPEC.md:68` (rev 28) already scopes to the same policy. They are unchanged.
- Docs only; no code or test changes.

## Review Triage Log

| # | Layer | Finding | Verdict | Evidence | Route |
|---|-------|---------|---------|----------|-------|
| 1 | blind | New `SPEC.md:99` sentence says a 401/403 on *any* cookie request downgrades, which includes the probe | medium | §13.4: a probe 401/403 is `probe-rejected`, not a downgrade. | patch (cite §13.4 only) |
| 2 | blind | New sentence says a 2xx with *fewer* rules downgrades; §13.2 `live` needs *more*, so an equal count also downgrades | medium | §13.2 item 3 uses `>`. | patch (same rewrite) |
| 3 | blind | `SPEC.md:99` restated the §13.2/§13.4 predicates, against the Intent and AGENTS.md | low | Confirmed; this restatement caused findings 1 and 2. | patch (same rewrite) |
| 4 | blind | The frozen Problem says rows 46–47; the notes say 47–48 | low | The notes already state that row 46 is unchanged and give the correct rows. The frozen block may not be edited. | reject |
| 5 | blind | R4 (0ce556e frozen edit) has no Spec Change Log line in story 3 | low | Confirmed; a one-line addition. | patch |
| 6 | blind | Story 3 Review Triage Log row 2 still looks open | low | Confirmed. The triage log is append-only, so the change-log entry now says it is answered. | patch |
| 7 | blind | The SPEC and stories.yaml edits are not logged | false | The commit message names both files and R3. SPEC.md has no change log. | reject |
| 8 | blind | stories.yaml does not mention that a not-`tested` 2xx is used | low | The description is a summary; story 3's matrix carries the row. | reject |
| 9 | blind | The new "Not tested" row cites no test | low | No row in the matrix cites a test; `client.test.ts` and `sync-batch.test.ts` (retro item 1) cover it. | reject |
| 10 | blind | Spec not tracked in sprint-status.yaml; narrow `context` | low | Spec-folder retro items are not in sprint-status (retro item 1 isn't either). Status is set to `done` here. | reject |
| 11 | ledger | — | — | No carved-out item. | none |
