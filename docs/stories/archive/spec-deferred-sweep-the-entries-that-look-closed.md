---
title: 'Sweep epics.md to AD-24 (seven artifacts, no-cache) and record two accepted deviations'
type: 'chore'
created: '2026-09-27'
status: 'done'
baseline_revision: 'dad50fd7894b354666f3ace88f3d5e6c221959c5'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** `docs/epics.md` still describes the pre-revision-22 AD-24: eight cache-busted artifacts, five required, a ninth needing an amendment, and denomination text read from `catalogue/static.json`. It also does not record two deviations the epic 2 retro accepted (F8: a required 404 gets the refusal screen; F19: no keyboard access to the row and trust-strip toggles), so reviews keep re-flagging them.

**Approach:** A citation sweep of the named `epics.md` lines to AD-24 as amended in spine revision 22, plus one clause at each of two ACs that records the accepted deviation and cites its owner. Retro action 14 assigns this sweep to `deferred-work-sweep` (owner column "dev (deferred-work-sweep)").

## Boundaries & Constraints

**Always:** Cite the owner (AD-24, EXPERIENCE.md *Accessibility Floor*, spec 2.1 Decisions); restate no mechanism beyond the counts and cache mode the lines already carry. Keep each AC in its Given/When/Then shape and keep its existing citation list, adding only what the change needs. The seven artifacts are the ones AD-24 lists; four are required for a render and three are absent-tolerable.

**Never:** Edit `prd.md`, the spine, `EXPERIENCE.md`, `DESIGN.md`, `docs/stories/deferred-work.md` or `sprint-status.yaml`. Do not touch UX-DR43 at `epics.md:242` ("All eight artifacts") or the other UX-memlog lines: the separate ledger entry "PM. Sweep `docs/epics.md` to follow the UX rulings" owns them. Do not edit any code. The ledger half of the entry ("Sweep the entries that look closed") needs no change: the ledger no longer holds the "Resolved by story 2.7 / 2.8 / UX rulings" sections.

</intent-contract>

## Code Map

- `docs/architecture/architecture-poe-crafting-base-price-checker-2026-09-12/ARCHITECTURE-SPINE.md:1573-1620` -- AD-24, the owner: seven artifacts, `cache: 'no-cache'`, no query token; "An eighth artifact requires an amendment"; required = `dataset.json`, `tracked.json`, `config.json`, `catalogue/stats.json`; `Divine` is the PRD's literal, never read from `static.json`. Read only.
- `docs/epics.md:96` -- Additional Requirements bullet: "eight", "cache-busted", "Five are required … three", "A ninth".
- `docs/epics.md:995-997` -- Story 2.1 AC: "eight separate cache-busted requests", "a ninth artifact".
- `docs/epics.md:1001` -- Story 2.1 AC: "all eight artifacts resolve in a single transition".
- `docs/epics.md:1010-1013` -- Story 2.1 AC: "one of the eight artifacts that does not arrive" → fetch-failure screen. Accepted deviation F8 goes here: a required artifact that answers 404 is absent, and AD-24's table refuses to render for it (spec 2.1 Decisions "What absent means"; `packages/web/src/load/load-artifacts.ts:95-96`).
- `docs/epics.md:1020-1023` -- Story 2.1 AC: stat or denomination text "from `catalogue/stats.json` or from `catalogue/static.json`".
- `docs/epics.md:1606-1609` -- accessibility-floor AC. Accepted deviation F19 goes here.
- `docs/epics.md:1619` -- Story 2.7 AC: "fetches the eight artifacts at runtime".
- `docs/stories/epic-2-retro-2026-09-27.md:58-64,93,208` -- F8, F9, F19 and action 14 (the source).
- `docs/stories/spec-2-1-the-page-s-substrate-the-override-layer-the-fixed-frame-and-one-consistent-artifact-set.md:29,114` -- the 404 decision and triage #9.
- `docs/ux-designs/ux-poe-crafting-base-price-checker-2026-09-13/EXPERIENCE.md:1138` -- *Accessibility Floor* heading; `:1119` puts keyboard paths out of scope. Read only.

## Tasks & Acceptance

**Execution:**
- `docs/epics.md` -- rewrite `:96`, `:995`, `:997`, `:1001`, `:1010`, `:1021` and `:1619` to AD-24 rev 22; add one `**And**` clause at the `:1010` AC for the required-404 deviation and one at the `:1609` AC for the keyboard deviation -- makes the entry's summary false.

**Acceptance Criteria:**
- Given `docs/epics.md`, when `grep -n "cache-busted\|ninth\|eight artifacts\|exactly eight\|Five are required"` runs, then the only hit is UX-DR43 at `:242`.
- Given the `:96` bullet, when read, then it says seven artifacts, each a separate `no-cache` request with no query token, four required and three absent-tolerable, and an eighth artifact needs an amendment (AD-24).
- Given the Story 2.1 stat-text AC, when read, then stat text comes from `catalogue/stats.json`, the denomination `Divine` is a product literal (AD-24), and `catalogue/static.json` is not named as a text source.
- Given the Story 2.1 did-not-arrive AC, when read, then it records that a required artifact that answers 404 is absent and gets the refusal screen, citing AD-24 and spec 2.1 triage #9.
- Given the accessibility-floor AC, when read, then it records that keyboard access to the row and trust-strip toggles is out of scope under EXPERIENCE.md *Accessibility Floor*, citing retro F19, so a review does not re-flag it.
- Given the change, when `git diff --name-only` runs, then only `docs/epics.md` and this spec changed.

## Spec Change Log

## Review Triage Log

### 2026-09-27 — Review pass
- verdicts: 17 findings — high 0, medium 0, low 12, false 5, maybe-false 0
- findings:
  - `low` `patch` (edge-case) UX-DR33 at `epics.md:202` still says "eight files", and the grep misses it — changed to "seven files"; the grep in Verification now also checks "eight files".
  - `low` `patch` (edge-case) The new 404 clause covered only a required 404, so a tolerable 404 still read as fetch-failure — the clause now says any 404 is *absent*: a required one gets the refusal screen, and a tolerable one renders as the absent-tolerable AC says.
  - `low` `reject` (edge-case) The F19 clause cites EXPERIENCE.md *Accessibility Floor*, not the retro's `:1057-1082` and DESIGN.md:2034 — those line numbers have drifted (`:1057` is now about stale search ids). AGENTS.md says to cite by stable id, and the section heading is the owner of the ruling.
  - `false` `reject` (edge-case) The spec's Always rule contradicts the added "no query token" — AD-24 and the entry both carry "no query token". The fix would edit this spec.
  - `low` `patch` (blind) UX-DR33 at `:202` is stale, and the grep misses it — same root cause as the first row, same fix.
  - `false` `reject` (blind) Who owns UX-DR43 at `:242` is unclear — the "PM. Sweep `docs/epics.md` to follow the UX rulings" ledger entry names UX-DR43 at `:242` in its own summary, so that entry owns it.
  - `low` `reject` (blind) The F8 clause calls AD-24 behaviour a "deviation" — the tolerable-404 half is patched (row 2). The "accepted deviation" wording follows retro F8 ("Accepted deviations") and the entry's own words: the clause deviates from this AC's earlier did-not-arrive wording, not from AD-24.
  - `low` `reject` (blind) The F19 clause repeats the floor, and it is an instruction to reviewers — the entry explicitly asks to record it, so that reviews stop re-flagging it (retro F19, "Accept").
  - `low` `reject` (blind) The refusal-screen AC does not say what a 404 shows as the declared version — this is pre-existing. The screen copy has an owner (spec 2.1, retro item 22's `declared: null`), and restating it in epics.md would duplicate the mechanism.
  - `low` `patch` (blind) The `Divine`-literal AC omits AD-20 — AD-20 is added to the citation list.
  - `false` `reject` (blind) The spec does not say how the ledger entry is removed — the caller (`deferred-work-sweep`) removes it in the last commit of the branch. The intent forbids this build to edit the ledger.
  - `false` `reject` (blind) Nothing shows that the "entries that look closed" half is done — commit `c53468d` ("sweep 14 entries closed on master") removed them. `grep "Resolved by"` over the ledger finds only this entry's own summary.
  - `low` `reject` (blind) epics.md `revisionPass` is not updated — AGENTS.md puts revision history in git and `.memlog.md`. A citation sweep needs no revision-pass record, and the git commit records it.
  - `low` `reject` (blind) `pnpm check` and `pnpm test` do not exercise prose, and the Code Map line numbers differ from the retro — the line numbers were re-derived against the current file. The grep and a read against AD-24 are the prose checks. The fix would edit this spec.
  - `low` `patch` (intent) `:202` and `:242` still say eight after the sweep — `:202` is patched (row 1). `:242` stays with the PM entry (row 6).
  - `false` `reject` (intent) The deviations are recorded in epics.md and not in the owner documents — the intent forbids AD and UX owner edits. The epics ACs are where story and code reviews check conformance.
  - `low` `reject` (intent) Only a grep exercises the changed prose — this is a docs-only change, and the intent-alignment layer read each rewrite against AD-24 and found that each one matches.

## Auto Run Result

Status: done

- **Summary:** Swept `docs/epics.md` to AD-24 as amended in spine revision 22: seven artifacts, `no-cache` with no query token, four required and three tolerable, an eighth needs an amendment, and `Divine` is a product literal (AD-20) that is not read from `static.json`. Recorded the two accepted deviations: a 404 is *absent* (required gets refusal, tolerable renders), and keyboard or screen-reader access to the toggles is out of scope under the Accessibility Floor. The ledger half was already done on master (`c53468d`).
- **Files changed:** `docs/epics.md` (the `:96`, `:202`, `:995`, `:997`, `:1001`, `:1010`, `:1022` and `:1619` rewrites, plus two AC clauses); this spec.
- **Review:** 4 low patches applied (`:202`, the tolerable-404 wording, the AD-20 citation, and the intent row grouped with `:202`). 0 deferred. 13 rejected, each for the reason given in the triage log.
- **Follow-up review recommended:** false. Patched: high 0, medium 0, low 4.
- **Verification:** `pnpm check` exit 0 and `pnpm test` exit 0, both after the patches. The grep for stale AD-24 phrasing hits only UX-DR43 at `:242`, which the PM UX-rulings entry owns.
- **Residual risk:** until the PM entry sweeps it, UX-DR43 at `:242` ("All eight artifacts") disagrees with `:1001`.

## Verification

**Commands:**
- `pnpm check` -- expected: exit 0.
- `pnpm test` -- expected: exit 0.
- `grep -n "cache-busted\|ninth\|eight artifacts\|exactly eight\|eight files\|Five are required" docs/epics.md` -- expected: only `:242`.
