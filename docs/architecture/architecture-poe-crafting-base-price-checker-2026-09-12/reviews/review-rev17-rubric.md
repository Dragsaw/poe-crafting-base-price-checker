---
title: 'Rubric Walker Review — Spine Revision 17'
type: architecture-review
reviewer: rubric-walker
reviewed_revision: 17
date: '2026-09-20'
---

# Rubric Walker Review — ARCHITECTURE-SPINE.md revision 17

**Scope reviewed:** `ARCHITECTURE-SPINE.md` (rev 17, full text, lines 1–2011),
`IMPLEMENTATION-NOTES.md`, `WEIGHTS-FILE-SCHEMA.md`, `AGENT-WORKFLOW.md` (binding-under-AD-0
companions and process guidance), cross-checked against the only source-of-truth artifact
that exists pre-code, `data/weights.json`.

**Verdict: revise.** One finding is critical and load-bearing against revision 17's central
change (the class discriminator / OQ-25 closure); the rest are internal-consistency defects
of the kind AD-0's own precedence rule exists to catch. Nothing found here calls the
architecture's shape into question — the paradigm, the AD set, and the five cross-file
checks are sound and (where checkable) verified against the real data file.

---

## Data-grounded checks performed (not a finding, method note)

`data/weights.json` was parsed directly to check the spine's own numeric claims rather than
trusting the prose:

- 29 categories, 59 classes, 6 fan-out categories covering 36 classes — **matches** AD-16 /
  IMPLEMENTATION-NOTES.md §10.3 exactly.
- The fan-out class names for `armour.boots/chest/gloves/helmet/shield` and `jewel` — **match**
  §10.3's family table (subset-lattice claim for the five armour families holds; `jewel`'s 8
  classes are indeed suffix-free).
- `schemaVersion: "5.0.0"`, `gamePatch: "0.5.5"` on the committed file — **consistent** with
  AD-11's claim that `5.1.0` is additive-only and a `5.0.0` file is still conforming.

This groundedness is a strength of the revision and is called out so it isn't lost among the
findings below.

---

## Findings

### 1. CRITICAL — `WEIGHTS-FILE-SCHEMA.md` declares itself a non-adopted draft, contradicting AD-0's and AD-11's treatment of it as the binding contract

**File:** `WEIGHTS-FILE-SCHEMA.md`, lines 1–18 and 292–297.

The companion's own frontmatter reads `status: draft`, and its opening blockquote states:

> **Producer-side draft.** This file is a working copy under `poe-mod-weights-producer`, not
> the authoritative contract. The authoritative copy lives in
> `poe-crafting-base-price-checker/docs/architecture/.../WEIGHTS-FILE-SCHEMA.md` and is owned
> by that repo. `5.1.0` below is this producer's proposal for what the contract should
> become... **It does not take effect until adopted in the consumer repo.**

The file making this statement *is* the file at that exact path — it names itself, in the
third person, as not-yet-authoritative. The "Repository placement" section at the bottom
repeats the same claim: *"The authoritative copy, once `5.1.0` is agreed, lives in
`poe-crafting-base-price-checker`."*

This directly contradicts:

- **AD-0's Rule**, which names `WEIGHTS-FILE-SCHEMA.md` explicitly as binding: *"The same
  holds for `WEIGHTS-FILE-SCHEMA.md`, which is the weights contract itself."*
- **AD-11's Rule**: *"The app consumes a file conforming to `WEIGHTS-FILE-SCHEMA.md` `5.1.0`"*
  — stated as settled fact, not a pending proposal.
- The spine's own frontmatter (`status: final`, revision 17) and its extensive revision-17
  narrative, which treats the `5.1.0` grammar as adopted and load-bearing: AD-16's class
  discriminator (`IMPLEMENTATION-NOTES.md` §10), AD-17's fifth cross-file check
  (`class discriminability`, §2.6), and the entire OQ-25 closure (*"the classes of one broad
  kind differ in which defences their bases carry... `equipment_filters` admits one class and
  excludes its siblings without naming a class"*) all depend on the `className` grammar being
  a **normative, enforced** rule and not a proposal awaiting adoption.
- Revision 11's own note that the artifact "a builder opens first" is the one most at risk of
  staleness — here it's the weights contract itself, the *most* load-bearing of the three
  companions, that carries the live self-contradiction.

**Why this is enforceability-breaking, not cosmetic:** AD-0's precedence clause says *"where a
companion contradicts this spine, the spine wins and the companion is the defect."* That rule
correctly resolves *which side is right*, but it does not fix the actual defect: a builder (or
the external scraper project) opening `WEIGHTS-FILE-SCHEMA.md` — the file `producer` and
`sync` both build against — is told the grammar rule they are about to implement against
"does not take effect until adopted," with no visible signal in the file itself that adoption
already happened. The hard-error validation section (lines 256–265) *does* correctly treat the
`5.1.0` grammar as an enforced Zod rule ("This is a whole-file refusal"), so the file
contradicts itself internally, not just against the spine.

**Disposition:** autofix. Replace the "Producer-side draft" callout and the "Repository
placement" section with a statement that this *is* the authoritative, adopted copy (revision
`5.1.0`, adopted per spine revision 17), and change frontmatter `status: draft` → `status:
final`. If a separate producer-side working copy still needs to exist for the scraper
project's own iteration, that fact belongs in the *scraper* repo's copy, not in the one this
spine cites as binding.

### 2. HIGH — AD-12's search-budget headroom sentence still charges "the currency set" and "a second recipe" against the daily search ceiling, both of which cost zero searches under the current design

**File:** `ARCHITECTURE-SPINE.md`, AD-12, "The ceiling is denominated in searches, not in
entries" paragraph (~line 862 in the reviewed text).

> Against the measured 2,400 searches per day, a full refresh is held to **~1,500 searches**;
> the remainder serves retries, **the currency set**, the catalogue refresh, the per-run
> leagues check and **a second recipe**.

This contradicts two other parts of the same document:

- **AD-12's own "Three sources" table**, three lines above, which lists exactly
  `tracked.json`, the league-validation check, and the catalogue refresh as the only three
  things that generate a request — explicitly *"and nothing else does."* Currency rates are
  called out immediately below the table: *"`data/currencies.json` is not a source... the file
  is now read, never fetched against."* There is no fourth or fifth request-generating
  activity in the current design, yet the headroom sentence budgets for two of them.
- **AD-20** (revision 14): *"`sync` makes **no request of any kind** to obtain [a currency
  rate]."* Currency rates are hand-maintained committed data — there is no "currency set" of
  requests left over from a full refresh to reserve headroom for.
- **AD-16 / AD-17**: a search is issued **once per tracked entry**, independent of how many
  recipes rank against that entry's class — `CraftRecipe` only affects `core`'s read-time
  ranking (AD-4) and costs nothing at sync time. There is no such thing as "a second recipe's"
  search cost to budget for.

This reads as leftover prose from a pre-revision-14 budget model (when currency rates were
still fetched) that was never updated when AD-20 removed the currency step from the rotation,
and from an earlier scope conception where per-recipe cost may have been on the table. It sits
three lines below a table that already correctly excludes both items, which is exactly the
kind of restated-then-drifted duplication `AGENTS.md`'s known pitfalls warn about, now found
inside a single AD rather than across documents.

**Disposition:** autofix. Drop "the currency set" and "a second recipe" from the headroom
sentence; the accurate list is retries, the catalogue refresh, and the per-run leagues check.

### 3. LOW — revision 11's staleness note (still live in the document body) points at a story-spec file that no longer exists and UX docs that no longer carry the citations it warns about

**File:** `ARCHITECTURE-SPINE.md`, revision 11 blockquote (~lines 199–207).

The note reads: *"Two documents have **not** had that [retired-id] pass and are stale against
this revision — the story spec `docs/stories/spec-contracts-accepted-tier-and-search-id.md`
(weights contract `4.1.0`, spine rev 9, retired **AD-2** and **AD-22** cited eight times) and
the UX set (`DESIGN.md` 2 occurrences, `EXPERIENCE.md` 4, and `mockups/key-hero-resting.html`
1). The story spec is the artifact a builder opens first."*

Checked against the current tree:

- `docs/stories/spec-contracts-accepted-tier-and-search-id.md` **does not exist** —
  `docs/stories/` now contains only `deferred-work.md`.
- `DESIGN.md` and `EXPERIENCE.md` (`docs/ux-designs/ux-poe-crafting-base-price-checker-2026-09-13/`)
  contain **zero** occurrences of `AD-2` or `AD-22` today.

The warning is six revisions stale: the artifact it tells a builder to treat with suspicion is
gone, and the documents it names as carrying bad citations have apparently already been
cleaned up (by whatever process retired/rewrote the story spec and touched the UX docs — both
are outside this spine's history to narrate). Leaving it in place either sends a builder
hunting for a file that isn't there, or has them discount `DESIGN.md`/`EXPERIENCE.md` as
unreliable when they no longer are. This is inert prose, not a divergence risk (there's
nothing left to build wrongly from), so it's tail-severity, but it's a live instruction in a
`status: final` document that is simply false now.

**Disposition:** autofix or defer to `.memlog.md`. Either strike the two sentences pointing at
the two now-clean/now-absent artifacts, or, if the intent is to preserve the historical record
of what revision 11 found, move the specific file-existence claim to `.memlog.md` and leave
only the AD-retirement fact (already correctly recorded in the *Retired AD map*) in the body.

---

## Checked and found sound (no finding)

- **Enforceability of the five cross-file checks (AD-17 / IMPLEMENTATION-NOTES.md §2.1–2.6):**
  each has a payload, an owner, and a mechanical predicate; class discriminability (§2.6) is
  correctly scoped as the one check whose subject is the search rather than the valuation.
- **Deferred section:** every item names a concrete revisit condition; none reads as an area
  two builders could still diverge on silently (e.g., pro-rating explicitly requires
  `modelled-split` provenance to return "in the same change" if ever adopted).
- **Operational/environmental envelope:** "Deployment & environments" is present and decided
  (one environment, Task Scheduler + GitHub Actions, no staging, no secrets); infra/provider
  strategy (GitHub Pages, unauthenticated trade API) and operations (sync-report.json's
  figures-vs-records split, lock staleness, pinned-starvation) are all decided or explicitly
  deferred, not silent.
- **Brownfield check:** no application source exists yet (no `packages/` tree); the one real
  artifact, `data/weights.json`, was checked against the spine's numeric claims and matches
  exactly (see method note above) — the spine ratifies, rather than contradicts, the one piece
  of committed data.
- **Named tech (light pass only, per instructions):** the Stack table's TypeScript-7 upgrade
  trigger is self-aware and gives a falsifiable unblock condition rather than a stale "watch
  this issue" pointer to a now-closed ticket — it correctly redirects the watch to the two peer
  ranges themselves. Nothing else on the table reads as stale on its face.
- **Open Questions:** OQ-12 and OQ-21 (the only two not struck through) both carry an owner and
  an explicit blocking scope ("blocking for correctness/trusting the ordering, not for
  building"); none of the closed ones look like they should have reopened.
