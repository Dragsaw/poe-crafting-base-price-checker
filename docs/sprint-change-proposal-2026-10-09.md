# Sprint Change Proposal — Rarity Dark redesign (2026-10-09)

Trigger: `docs/ux-designs/ux-poe-crafting-base-price-checker-2026-09-13/handovers/prd-handover-2026-10-04.md` and its sibling `architect-handover-2026-10-04.md`.
Spines: `DESIGN.md` revision 19, `EXPERIENCE.md` revision 24. Mode: incremental. Scope: **Moderate**.

## 1. Issue summary

UX replaced the paper direction with a dark, rarity-coloured page and changed how the page expresses trust, freshness, odds and sync health. Thirteen PRD requirements still describe the retired treatment. `epics.md` is stale: it lists 33 FRs where the PRD has 34, and it cites UX revision 4. No redesign work is in the code. Epics 1 to 3 are done and shipped on the paper direction.

PRD revision 26 (2026-10-09) already removed strings and control mechanics, and `AGENTS.md` already carries the new ownership rule. Those two handover items are closed.

## 2. Impact analysis

- **Epics.** Epics 1 to 3 are unaffected as records. A new **Epic 4** carries the redesign.
- **PRD.** FR-3, 6, 7, 8, 9, 10, 11, 12, 13, 18, 24, 25, NFR-10, UJ-2/3/4, §2.1, §3 Provenance, §7.1 and SM-C4 change.
- **Architecture.** Provenance (AD-10) is unchanged as a mechanism. Five items need an owner (section 4.3). `IMPLEMENTATION-NOTES.md` was deleted in #151, so the formula's home is the spine.
- **UX.** One open check for UX: the number of Chase Combinations on a collapsed row (rev 26 UX handover).
- **Code.** `UniformPriorBanner`, `KeyBlock`, `TrustStrip` and `RunningFoot` are retired. `unitLabel()` needs the defence-suffix fix.

## 3. Recommended approach

Direct adjustment: slim the PRD, close the architect gate, then build Epic 4. Rollback and MVP review are not needed. Risk is low for the PRD edit and medium for Epic 4, because every web component changes.

## 4. Change proposals (all approved)

### 4.1 Epic 4 (`epics.md`)

**Epic 4: Rarity Dark — the redesigned page.** The player reads the same ranked list on a dark, rarity-coloured page. Silence means a current price and measured odds. A row speaks only when its price needs attention. Sync health is visible without a click. Standalone: it builds on Epics 1 to 3 and changes no sync behaviour.

| Story | Scope |
|---|---|
| 4.1 | Dark token set, bundled Inter, sticky header bar. Replaces the fixed paper frame (UX-DR1–6). |
| 4.2 | Price-trust verdict in `core`: four verdicts, old and thin triggers, the row rule, the zero-gross fallback. FR-9, 10, 12. |
| 4.3 | Ranked row: rarity names, the uncrafted-base line, mark slot with tooltip, estimated-odds cue per row, EV tooltip, `unitLabel` defence suffix fix. FR-3, 10, 11. |
| 4.4 | Expansion: context line, one line per entry, top lines plus remainder, trust reasons, pinned, pruned and below-threshold states. FR-8, 12. |
| 4.5 | Header controls and sync button: threshold control, recipe states 35/42/43, problem count, four-column sync report. FR-6, 7, 18, 24, 25. |
| 4.6 | Footer legend, list statements, failure screens, appendix restyle. Remove banner, key block, trust strip and running foot. NFR-10. |

Order: 4.1, then 4.2 (after the gate), then 4.3 to 4.5, then 4.6. Acceptance criteria cite `EXPERIENCE.md` state numbers and copy no string or threshold.

### 4.2 PRD (rev 26 → 27). The PRD holds business rules and product behaviour only

No UX-owned string, number, mark, control or element appears in the PRD. Treatment is cited to `EXPERIENCE.md`.

| Id | New requirement text |
|---|---|
| FR-3 | Keep the two-unit rule. Each row tells the player whether to craft on it or to sell the base uncrafted. Colour alone never carries that. |
| FR-6, UJ-2 | The player sets the Payout Threshold directly, and the list follows at once with no round trip. |
| FR-7 | The threshold survives a reload. Delete the 0.25 Divine default. |
| FR-8 | Opening a row shows every combination behind its figure, each with whether its price can be trusted. |
| FR-9 | Never present a missing price as worthless, and make the cause knowable. Keep the four Price States as data and the `not-yet-synced` reason enum. |
| FR-10 | Every figure says when it rests on something weaker than a measured, current price. Keep weakest-input propagation (AD-10). Remove the attribution-beside-figure bullet. |
| FR-11 | The player can tell which figures rest on estimated roll odds. Remove the global-statement bullets. |
| FR-12 | Each row says whether its price is current enough to act on. Keep: no single dataset-wide timestamp, and observation age and attempt age are different facts. Remove the cut-off and the display rules. |
| FR-13 | The page never presents an asking price as a sale. R-1 stays. |
| FR-18 | The player can tell when the Tracked List last changed. No date reads as unknown. |
| FR-24 | A patch that breaks a tracked entry is loud: the player learns of it without going to look. |
| FR-25 | A sync problem is visible without going to look for it. The Sync Report carries the detail. |
| NFR-10 | Colour alone never carries a product-meaningful distinction: price trustworthiness, estimated odds, crafted versus uncrafted. |
| UJ-3, UJ-4, §2.1, §3, §7.1, SM-C4 | Remove the age display, the whole-ranking flag and the global caveat. Reword to the promises above. |

### 4.3 Architect gate before Story 4.2 (the architect edits the spine)

1. Write the row price-trust formula in `ARCHITECTURE-SPINE.md`. Rule whether below-threshold outcomes count in gross value, and whether it runs in `core` or `web`.
2. Confirm that every Price Observation in the Dataset carries a listing count.
3. Name a source for a stale game patch, or rule that the problem cannot fire in v1.
4. Add the bundled Inter font to the spine's stack versions (NFR-7 allows it).
5. Confirm the Sync Report exposes broken entries, starved pinned entries and the patch.
6. Close `EXPERIENCE.md`'s `[NOTE FOR ARCHITECT]` lines against these rulings and retarget `IMPLEMENTATION-NOTES.md` citations in `epics.md`.

### 4.4 `epics.md`, `sprint-status.yaml`, `PRODUCT.md`

- `epics.md`: FR inventory to 34 (FR-34 owned by Epic 3, built). Retitle the FRs above to PRD rev 27. Add a note that UX-DR1–6, 11–17, 21, 24, 30, 32 and 36 describe the retired direction and are superseded by UX rev 24 and DESIGN rev 19. Append Epic 4. Epic 1 to 3 stories stay unedited.
- `sprint-status.yaml`: add `epic-4: backlog`, six story keys as `backlog`, `epic-4-retrospective: optional`.
- `PRODUCT.md`: refresh after the PRD edit, for changed user, positioning or constraint facts only.
- `AGENTS.md`: no change.
- `git rm` the two 2026-10-04 handovers in the commit that lands their outcome, with the outcome in the commit message.

### 4.5 UX follow-ups (UX owns, listed for tracking)

- State the number of Chase Combinations on a collapsed row. The PRD no longer states it.
- Closing the architect gate removes the two `[NOTE FOR ARCHITECT]` blocks in `EXPERIENCE.md`.

## 5. Implementation handoff

| Recipient | Responsibility |
|---|---|
| PM (John) | PRD rev 27 per 4.2. `epics.md` and `PRODUCT.md` per 4.4. |
| Architect (Winston) | The gate in 4.3, before Story 4.2. |
| UX (Sally) | The follow-ups in 4.5. |
| PO / Developer | Sprint status entries. Epic 4 stories, in the order given. |

Success criteria: the PRD names no UX-owned string, number or element. Every gate item has an owner-document ruling. Epic 4 stories cite `EXPERIENCE.md` states. `pnpm check` is green after each story.
