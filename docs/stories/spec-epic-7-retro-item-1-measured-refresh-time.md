---
title: 'Set UJ-6 and SM-C1 to the measured full-refresh time'
type: 'chore'
created: '2026-11-15'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: '00c68433c52148254314566c3f7e6e270a6ef773'
context:
  - '{project-root}/docs/stories/epic-7-retro-2026-11-15.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Epic 7 retro action item 1 (finding D1). `prd.md` UJ-6 (line 71) and SM-C1 (line 712) promise a full refresh "within a day" with the optional session cookie and "about a day and a half" without it. The live sync on the Pi refreshes about 100 to 112 entries per hour with the cookie, so the 3,452-entry list takes about 31 to 34 h. The player relies on this promise at a league reset.

**Decision (human, 2026-11-15, retro D1):** Accept about 36 h with the cookie. The SM-C1 hold of about 3,500 searches stays. AD-8's spread stays (option a rejected), and no rows are pruned (option b rejected).

**Decision (human, 2026-11-15, this spec):** The no-cookie figure has no measurement. The committed sync history holds only short pre-cookie runs, and every Pi session since 2026-11-08 ran with the cookie. So the no-cookie clause loses its number: a full refresh without the cookie takes longer, and the player accepts that. The measurement goes to `deferred-work.md` with `retry_when: never — needs a human`. Rejected: an unauthenticated run now, and the inferred figure of about three days.

**Approach:** PRD revision 40. Edit the cookie clause of UJ-6 and SM-C1 to about a day and a half (about 36 h), and edit the no-cookie clause to "takes longer" with no figure. Keep "the player accepts that" for both cases, because AD-12 cites the pace SM-C1 and UJ-6 accept. Add a revision 40 entry to `.memlog.md`. Refresh `PRODUCT.md`. Set action item 1 to `done`.

## Boundaries & Constraints

**Always:** State the promise only, in the PRD's existing voice: approximate figures, with citations (FR-20, SM-C1, AD-12). Put the evidence in the commit message and the memlog: the entries-per-hour measurement, the 31 to 34 h range and the AD-8 cause.

**Never:**
- No AD-8 mechanism, entries per hour, measurement dates or revision narrative in the PRD body.
- No edit to the spine. AD-12 cites SM-C1 and UJ-6 and stays correct.
- No edit to the historical 17.5 h figures in `sprint-change-proposal-2026-11-14.md`, `epics.md` or `spec-7-3`. They are records.
- No code change. Do not start an unauthenticated sync unless the human approves it in the open question.

</frozen-after-approval>

## Code Map

- `docs/prds/prd-poe-crafting-base-price-checker-2026-09-12/prd.md` -- frontmatter `revision: 39` (bump to 40; `updated` is already 2026-11-15); UJ-6 at line 71; SM-C1 at line 712. FR-20 (line 377+) says the cookie "lets a long refresh finish in fewer hours" and has no figure, so leave it.
- `docs/prds/prd-poe-crafting-base-price-checker-2026-09-12/.memlog.md` -- append-only. One `(decision) [USER] Revision 40 (...)` bullet in the style of revisions 36 to 39.
- `PRODUCT.md` -- states no refresh figure. Its Operating Context sync bullet ("finish a refresh sooner") stays true. One constraint fact is stale: the first Operating Context bullet says "The Pick-up Filter (PRD rev 35, AD-31) is planned and not yet built", but epic 6 built it (`sprint-status.yaml`, epic-6 `done`).
- `docs/stories/sprint-status.yaml` -- `action_items[0]` (`epic-7-retro-item-1-…`) `status: open` → `done`; `last_updated`.
- `docs/architecture/.../ARCHITECTURE-SPINE.md:850-857` (AD-12) -- read only. It ties the ceiling to "the pace `prd.md` SM-C1 and UJ-6 accept" for the no-cookie case.
- `docs/ux-designs/.../EXPERIENCE.md:672-673` -- read only, owned by UX. The 72 h *old* threshold is justified by "the partial refresh cycle of about 15 hours", which is now stale.

## Tasks & Acceptance

**Execution:**
- [x] `prd.md` -- rewrite the UJ-6 refill clause and the SM-C1 refresh sentences to the decided figures; `revision: 40` -- the player-facing promise.
- [x] `.memlog.md` -- append the revision 40 entry, with the decision, the evidence and the rejected options a and b -- this is where the PRD keeps revision history.
- [x] `PRODUCT.md` -- replace the stale "planned and not yet built" clause with the Pick-up Filter as built -- the refresh the action item asks for.
- [x] `docs/stories/deferred-work.md` -- append one section `## Deferred from: spec-epic-7-retro-item-1 (2026-11-15)` with two entries: (1) measure the no-cookie full-refresh time (an unauthenticated run on the Pi, read entries per hour from the journal), then give UJ-6 and SM-C1 the figure, `retry_when: never — needs a human`; (2) `[NOTE FOR UX]`: the *Price trust* rationale cites a refresh cycle of about 15 h, and the accepted cycle is about 36 h with the cookie. A no-cookie cycle, inferred at about 70 h, would come near the 72 h *old* mark -- a reviewer does not edit the owner document.
- [x] `docs/stories/sprint-status.yaml` -- action item 1 → `done`, `last_updated`.

**Acceptance Criteria:**
- Given the edited `prd.md`, when UJ-6 and SM-C1 are read, then both give the same cookie figure (about a day and a half), both say that a refresh without the cookie takes longer and give no figure for it, both say the player accepts the pace, and SM-C1 still holds about 3,500 searches.
- Given the edited `prd.md`, when the whole file is searched for "within a day", then no result remains.
- Given the PRD body diff, when it is read, then it holds no mechanism, entries-per-hour figure or revision narrative.
- Given `pnpm check`, when it runs on the final tree, then it exits 0, including `tools/deferred-issues` ledger rules for the new entry.

## Verification

**Commands:**
- `pnpm check` -- expected: exit 0.

**Agent browser checks:** none. The change touches only `docs/` and `PRODUCT.md`, and no path under `packages/` or `data/` (`agent-browser-checks.md` rule 1).

## Implementation Notes

- **Files:** `prd.md` (UJ-6, SM-C1, `revision: 40`), its `.memlog.md` (revision 40 entry), `PRODUCT.md` (Pick-up Filter built, epic 6), `deferred-work.md` (two entries) and `sprint-status.yaml` (action item 1 `open` → `done`, `last_updated`).
- **Deviation:** the `[NOTE FOR UX]` entry also carries `retry_when: never — needs a human`, as the spec-7-1 UX note does, so the sweep does not edit a UX-owned document unattended.
- **Verified after review:** `pnpm check` exits 0 (8 passed) on the patched tree; agent browser checks are exempt (docs only).
- **Search:** no other `prd.md` sentence states a refresh duration (FR-20 and the league-change bullet give none). Repo-wide, "within a day" remains only in records (`spec-7-3`, the epic-7 retro, the memlog) and in an unrelated brief addendum line about price staleness.

## Spec Change Log

## Review Triage Log

- Edge Case Hunter + Blind Hunter: AD-12's no-cookie pace clause ("at the pace SM-C1 and UJ-6 accept for that case") now has no figure — low, patched. SM-C1's 3,500-search hold still bounds the ceiling. The memlog now says so, and the measurement entry names AD-12.
- Edge Case Hunter: AD-12 "stays correct" is a claim that misses the lost bound — low, same root cause as above; patched in the memlog.
- Edge Case Hunter: a no-cookie cycle of about 70 h comes near the 72 h *old* mark — false as a defect of this diff: the `[NOTE FOR UX]` entry ledgers it, and UX owns the threshold (Review brief rule 2).
- Edge Case Hunter: the measurement method counts `completed` growth across a new pass — low, patched (the entry skips a tick that restarts the pass).
- Edge Case Hunter + Blind Hunter: the measurement method allows two sources about 10% apart and does not say which rate it measures — low, patched (one method: `completed` growth per 4 h tick).
- Edge Case Hunter + Blind Hunter: action item 1 is `done` while its text still says "measure" — false: the human decided that the measurement moves to the ledger, and `pnpm deferred:issues` opens an issue for it, so it stays visible.
- Edge Case Hunter + Blind Hunter: the memlog frontmatter `updated:` keeps the rev-39 value — low, patched.
- Blind Hunter: the PRD leaves the default (unauthenticated) mode without a figure, and no record says this was on purpose — false: the spec's Decision and the memlog entry record the human's choice to drop the number.
- Blind Hunter: the inferred figure appears as "about three days" in one place and "about 70 h" in another — low, patched (the memlog gives both).
- Blind Hunter: the PRD `sources:` list does not name the retro — low, rejected: rev 37, from the epic-6 retro, did not add its retro either. The memlog entry names the source.
- Blind Hunter: unclear referent of "In both cases the player accepts that", and the subject of "takes longer" in UJ-6 — low, patched ("The player accepts both paces").
- Blind Hunter: 36 h is promised against a measured 31 to 34 h with no reason given — low, patched (memlog clause: the human's rounded figure, covering about 3,500 searches).
- Blind Hunter: the measurement entry leaves out its cost and the restore step — low, patched.
- Blind Hunter: the acceptance criteria check only `prd.md` — rejected: the fix edits this build's spec.
- Blind Hunter: the memlog "Rejected:" list mixes labelled and unlabelled items — low, patched (split into retro and this revision).
- Blind Hunter: the "(epic 6)" tag in `PRODUCT.md` is a planning number that goes stale — low, patched (deleted).
- Deferred Ledger Auditor, Verification Gap, OCR: no findings.
