# Reconcile review — ARCHITECTURE-SPINE.md revision 17

Scope: absorption-gap hunt against every source/companion listed in the spine's frontmatter,
plus the PRD's current state and handoff-folder material. Not a full re-review.

## Verdict

**Partial.** The substantive technical content (Item Class rename, FR-4 coverage-band
withdrawal, weights `5.0.0`→`5.1.0`, OQ-23/OQ-25 closures) is well absorbed and internally
consistent between the spine and current `prd.md` (revision 18). But the citation/source
integrity around this revision has real holes: two load-bearing sources were deleted from the
repo in the same commit that finalized this material while the spine's frontmatter still cites
them; one source the spine claims sixteen absorptions from does not exist anywhere in the
repo's history; and the weights contract companion — treated as a live binding artifact by
AD-11 — was never brought into conformance with the very sprint proposal that raised it to
`5.0.0`/`5.1.0`.

## Findings

### 1. Two frontmatter-cited sources no longer exist in the repo (critical)

`ARCHITECTURE-SPINE.md:19-20` cites `docs/sprint-change-proposal-2026-09-13.md` and
`docs/sprint-change-proposal-2026-09-19.md` as load-bearing sources. Neither file exists on
disk or in `HEAD`. Both were deleted in commit `55fe390` ("docs: PRD revision 14, plus the
pending planning working tree") — the same commit that carries this spine's rev-17 material —
per its own commit message: *"commits... the stories and sprint-proposal removals"* (848 and
644 lines removed respectively). The spine's frontmatter was not updated to drop the dead
citations, or to point at wherever their content now lives (`.memlog.md`, presumably).

I recovered both files from git history (`git show 55fe390~1:docs/sprint-change-proposal-2026-09-19.md`)
and cross-checked the 09-19 proposal's rulings against the current spine content: the
substance (weights `5.0.0`, whole-tier containment, withdrawn decomposition, three-value
Provenance) is correctly and currently reflected in AD-10, AD-11 and AD-17. So the *content*
is absorbed; the *citation* is dangling. This is a finding on the reviewer-gate's own terms
even where the underlying decision is fine, because a future reader following the spine's
`sources:` list to verify a claim hits a 404.

### 2. `handoff-phase1-architecture.md` does not exist anywhere in the repository (critical)

`ARCHITECTURE-SPINE.md:17` cites `docs/prds/prd-poe-crafting-base-price-checker-2026-09-12/handoff-phase1-architecture.md`
as a load-bearing source, and the revision-12 banner (`ARCHITECTURE-SPINE.md:161-173`) claims
**sixteen** specific absorptions from it (OQ-21/AD-11 escaping shapes, AD-12's schemaVersion
admission, AD-7's not-reached record, AD-3's `recipes.json` list-shape, AD-27's denominator,
AD-10's FR-11 raise-back, OQ-12's `valueless` wire shape, etc.). A full-repository search
(`git ls-tree -r HEAD`, `git log --all --diff-filter=A`) found the file was **never
committed** to this repository under this path or any similar one. Every one of the sixteen
claimed absorptions is therefore unverifiable against its stated source — the content may well
be correct (it reads as internally consistent with the rest of the spine), but the citation
trail is broken at its root, and this predates the current session's changes.

### 3. `WEIGHTS-FILE-SCHEMA.md` was never conformed to the sprint proposal that promoted it (high)

The 2026-09-19 sprint proposal's own §4.12 (recovered from git history) mandated six specific
edits to `WEIGHTS-FILE-SCHEMA.md` when the contract went live: flip `status: draft` →
`final`; replace the producer-side-draft callout; correct the false gitignore claim; rewrite
the repository-placement section to say this repo owns the document; add
`governed_by: AD-17` to frontmatter; add one hard error for a duplicate `statId` among one
entry's `lines`. None of the six landed. Current `WEIGHTS-FILE-SCHEMA.md`:

- `WEIGHTS-FILE-SCHEMA.md:3` — still `status: draft`.
- `WEIGHTS-FILE-SCHEMA.md:11-18` — still frames itself as *"a working copy under
  `poe-mod-weights-producer`, not the authoritative contract... It does not take effect until
  adopted in the consumer repo,"* directly contradicting AD-11's treatment of this same file
  as the live, binding, consumed `5.1.0` contract.
- `WEIGHTS-FILE-SCHEMA.md:89-91` — still claims the file *"is gitignored in this repo (never
  committed...)"*, which is false; it is git-tracked.
- `WEIGHTS-FILE-SCHEMA.md:292-297` (approx.) — still says it is *"currently drafted and
  iterated in `poe-mod-weights-producer`"* pending adoption.
- Frontmatter (`WEIGHTS-FILE-SCHEMA.md:1-7`) — no `governed_by` field at all.
- The hard-error list has no duplicate-`statId`-among-`lines` rule (only a duplicate
  `sourceModifierId` check, a different field).

This gap has survived every revision from 10 through 17, including revision 17's own edit to
this same file (raising the `className` grammar to normative, `5.1.0`) — the file was touched
and still not brought into line with its own governing decision.

**Bonus stray citation in the same file:** `WEIGHTS-FILE-SCHEMA.md:17` points to
`_bmad-output/planning-artifacts/sprint-change-proposal-2026-09-18.md` (note: **-18**, a third
date, in a path outside this repo) as *"the decision trail behind this revision"* — a third
dangling reference living inside a document the spine treats as binding.

### 4. FR-1's absolute guarantee has an untracked dependency on a spine choice (medium)

`ARCHITECTURE-SPINE.md:1025-1030` records that a jewel class *could* have been discriminated
by its own stat filters instead of `query.type`, and explicitly defers that choice as
*"a PRD revision to ask for, never one to absorb here."* Current `prd.md` FR-1 (line ~128)
states the class-purity guarantee — *"no base outside the class contributes to a crafted
row's price"* — as an unconditional absolute, with no citation of, or open question tracking,
its dependence on the spine having picked the `query.type` (option 1) discriminator over the
stat-filter fallback (option 2). Neither document's open-questions section (spine's own,
`ARCHITECTURE-SPINE.md:1872-2011`, or PRD §10) carries an id for this. If a future spine
revision ever adopted option 2 for a jewel-like class, FR-1's absolute would become false with
nothing anywhere flagging that it rests on this choice.

### 5. Evidence-fidelity gap in `IMPLEMENTATION-NOTES.md` §5.1 vs. the cited curl capture (low-medium)

`IMPLEMENTATION-NOTES.md` §5.1 (~line 388-392) quotes the captured request body from
`docs/prds/prd-poe-crafting-base-price-checker-2026-09-12/curl-creater-trade-search.txt` as
including `"ilvl": {"min": 79}`. The cited file's literal `--data-raw` JSON contains **no
`ilvl` key at all** — only `query.status`, `query.stats` (three banded filters), and
`filters.type_filters.filters.category` / `rarity`. (The file's `referer` header does carry a
separate gzip+base64-encoded query blob that may decode to a different filter set, but the
note presents the quoted body as the request's own JSON.) This doesn't by itself contradict
AD-16 — the spine elsewhere (§5.1b, §5.1c) has independent evidence for `ilvl` always being
emitted on a tracked-entry search — but the specific quote attributed to this specific source
file does not match that source file's contents as committed, which is worth a fix given how
much weight this revision places on "the field spelling is evidence, not assumption."

### 6. Confirmed consistent (no gap)

- **PRD revision and terminology**: `prd.md` is currently at **revision 18** (frontmatter and
  `.memlog.md`), matching what the spine's revision-17 banner describes. "Item Class" is used
  throughout current `prd.md`; grep confirms zero remaining occurrences of "Item Categor-"
  anywhere in the PRD. FR-4's coverage bands are confirmed withdrawn in current `prd.md`,
  matching `ARCHITECTURE-SPINE.md:89-92, 1555-1564`.
- **FR/OQ citations**: FR-1, FR-2, FR-4, FR-11, FR-22, FR-25 all exist in current `prd.md`
  with meaning matching the spine's citations. OQ-12, OQ-19, OQ-20, OQ-21, OQ-22, OQ-23,
  OQ-24, OQ-25 as cited in the spine are the **spine's own** Open Questions section
  (`ARCHITECTURE-SPINE.md:1872-2011`), not PRD-owned ids — an initial read that treated these
  as PRD citations and flagged OQ-22/23/24 as "missing from prd.md" was mis-scoped; the spine
  is citing itself, correctly.
- **Sprint-change-proposal-2026-09-19 substance**: fully and correctly absorbed into AD-10,
  AD-11 and AD-17 as they stand today, surviving the rev-11-through-17 rework of pool keying
  and class discrimination intact (see Finding 1 for the citation-path caveat).
- **Briefs (`brief.md`, `addendum.md`)**: no contradiction found. The spine's AD-7/AD-8/AD-12
  budget figures, AD-16's ascending-sort/instant-buyout rule, and AD-11's weights-as-input
  framing all trace cleanly to the brief and addendum's request-budget analysis, price
  estimator rationale, and "weights as a decoupled input" sections. Nothing quiet was dropped.

## Recommendation

At minimum: update the spine's frontmatter `sources:` list to stop citing the two deleted
sprint-change-proposal files by live path (point at `.memlog.md` or restore them), locate or
formally retire the `handoff-phase1-architecture.md` citation, and apply the six-item §4.12
patch to `WEIGHTS-FILE-SCHEMA.md` (its own governing decision has been outstanding since
revision 10). These are citation-integrity and companion-conformance fixes, not new
architecture decisions, so they fit a Finalize-pass autofix rather than a user escalation.
