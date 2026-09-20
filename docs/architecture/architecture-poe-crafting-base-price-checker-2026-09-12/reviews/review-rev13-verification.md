---
title: 'Reviewer Gate — verification lens, spine revision 13'
type: review
lens: verification
status: draft
created: '2026-09-19'
target: ARCHITECTURE-SPINE.md revision 13 + companions
---

# Reviewer Gate — verification lens, revision 13

**Brief.** Verify that every committed decision was reality-checked rather than asserted;
flag anything that could be out of date and was not confirmed against the web, the existing
project, or the current starter.

**Scope weighting.** Revision 13 binds no new technology and adds no AD. The whole of the
new material is three additions:

| # | Addition | Diff size |
| --- | --- | --- |
| 1 | `IMPLEMENTATION-NOTES.md` §8 — *Curation: deriving a tracked entry's item level floor* | +50 lines, new section |
| 2 | Spine AD-5, closing paragraph — *Who derives `itemLevelMin`, and from what* | +8 lines |
| 3 | `AGENT-WORKFLOW.md` build-order step 2 — the absent-`weights.json` carve-out and day-one path | +14/-2 lines |
| (4) | Consistency Conventions *Item level* row — one clause added, citing §8 | +1 clause |

Effort therefore went to Part A. Part B is a re-confirmation sweep, not a re-decision.

---

## Part A — internal reality-check of the new material

Method: every factual claim in the three additions was matched against the document that
owns it, quoting the owner. Claims verified as supported are listed first so the findings
can be read against a known-good baseline.

### A.0 — Claims checked and confirmed

| Claim in the new material | Owner | Verdict |
| --- | --- | --- |
| `itemLevelMin` is a per-entry field of the weights file | `WEIGHTS-FILE-SCHEMA.md` *Field rules*: "`itemLevelMin` \| **Required.** The lowest item level at which this tier's mass can roll, taken verbatim from poe2db." Shape block shows it on each object inside `entries[]`. | **Supported.** §8's "A tier's `itemLevelMin` is the lowest level at which that tier *can* roll" is the owner's sentence in the owner's sense. |
| An absent `weights.json` yields coverage **undefined**, not `0%`, and no threshold row fires | AD-27: "Where `data/weights.json` is **absent**, coverage is not `0%` — it is undefined, and none of the rows below fires." | **Supported, near-verbatim.** `AGENT-WORKFLOW.md`'s "coverage is **undefined — not `0%`** — and **none of the threshold rows below fires**" is a faithful restatement. |
| Both report fields are omitted together while the file is absent | `IMPLEMENTATION-NOTES.md` §3: "when `weights.json` is absent **both fields are omitted together**, which is how 'undefined' is spelled, and `web` must not read the omission as `0`." | **Supported.** The workflow's sentence cites §3 by number, which is the correct citation discipline. |
| Raw bases still rank with no weights file | AD-24: "An absent `weights.json` makes **every crafted base unrankable with that reason** (AD-17) rather than blanking the site, **and raw bases still rank** — they need no pool — so the Raw Base price list is the day-one content." AD-11: "**raw bases need no pool and still rank** on AD-17's separate branch." AD-17: "**Its raw-base entry, if it has one, still ranks** — the raw branch above never consults a pool." | **Supported by three owners in agreement.** |
| Absent file is the declared day-one phase, not a defect to escalate | AD-24: "That state is the product's entire day-one phase, before a conforming file exists, so it is the launch experience and not an edge case." AD-12: "AD-24 makes an absent weights file the product's day-one state; a gate that aborted on it would leave the dataset unpopulatable during exactly the phase the product ships in." | **Supported.** The workflow's "Do not read an absent file as a coverage failure and do not escalate" removes a genuine prior contradiction — before rev 13, step 2 instructed escalation below 50% with no absent-file branch, and an absent file scored 0% under a naive read of the same formula. This addition is a real fix. |
| AD-17 permits a band spanning a run of adjacent tiers and rejects a band that clips one | AD-17: "A curator may therefore write a single tier's own interval, or **a run of whole adjacent tiers**; what a curator may not write is a band that contains one tier and clips another, which edge alignment rejects." Worked in §2.4: `43.0 – 80.0` over T7+T8 **accepted**; `43.0 – 60.0` **rejected** — "the ceiling reaches into T8, which the band does not contain." | **Supported exactly.** §8's "A band naming a run of adjacent tiers takes the run's highest `itemLevelMin` — AD-17 permits such a run" is correct on the permission. (The *justification* attached to it is not — see F-4.) |
| `acceptedTier` is display-only, with AD-5's prohibitions | AD-5: "The label is **display-only**, and four prohibitions ride with it: `core` and `sync` never read it; no component validates it against a band; **no component validates its spelling**; and it is **never part of a tracked entry's canonical key**." §4.1: "`acceptedTier` is a display-only sibling of the band, not a fourth element." Conventions *Entity keys*: "**`acceptedTier` … never part of the key**." | **Supported.** §8's "it is a display-only free string that nothing validates or joins to the weights file (AD-5)" and "A derivation parsing `\"T1–T2\"` for an item level would re-open exactly that join" are consistent with all four prohibitions and add the curator-side limb the prohibitions implied but never stated. This is the correction the revision note claims, and it lands. |
| Raising the floor admits more tiers into the pool | AD-17: `scoped(base, slot, L) = { entry ∈ pool(base, slot) : entry.itemLevelMin <= L }`. | **Supported and arithmetically correct** — a larger `L` admits a superset. §8's closing "a higher floor admits more tiers into the pool and moves the ranking" is right, and so is its "the floor scopes the eligible pool before any probability is computed." |
| The shared floor is per-base, raw exempt | AD-17: "**The crafted entries on one `baseTypeId` must share one `itemLevelMin`.** … A raw base is exempt, because it is never a summand." | **Supported.** §8's `floor(base)` over "the base's crafted tracked entries", declared by every crafted entry, makes the invariant true by construction rather than by luck — as §8 claims. |
| No component performs the derivation | AD-5: "**`itemLevelMin` and `acceptedTier` are declared, never inferred.**" Conventions *Item level*: "No component infers or adjusts it." | **Supported.** |

That is eight of the brief's named checks confirmed against the owner in the owner's own
words. The findings below are the residue.

---

### F-1 — HIGH — §8's `candidate(entry)` formula reads the wrong `itemLevelMin` (variable capture)

§8 states:

```
candidate(entry) = max over the entry's PRESENT affixes of
                   max over tier(affix) of  entry.itemLevelMin
```

The inner quantity is written `entry.itemLevelMin`, but `entry` is already bound by the
function's own parameter — the **tracked** entry whose floor is being derived. Read
literally, `candidate(entry)` is the maximum, over two nested index sets, of a constant
that is the very number the formula exists to produce. It is circular and it computes
nothing.

The intended quantity is unambiguous from every other owner:

- `WEIGHTS-FILE-SCHEMA.md` puts `itemLevelMin` on each **weights** entry: "The lowest item
  level at which this tier's mass can roll."
- `prd.md` FR-22 states the same computation in prose: "A crafted entry's candidate floor
  is the highest item level among its affixes' Accepted Tiers." — the *tier's* item level.
- §8's own next paragraph explains the maximum in exactly those terms: "A tier's
  `itemLevelMin` is the lowest level at which that tier *can* roll."

So the inner term must be the **weights entry returned by `tier(affix)`**, not the tracked
entry. The defect is aggravated by a name collision the spine itself records: the
Consistency Conventions *Item level* row says `itemLevelMin` is "a declared floor, uniform
across a base's crafted tracked entries (AD-17) **and** present on every weights **entry**
(AD-11)" — one field name for two different things, in a formula that ranges over both.

This is the one place in rev 13 where a builder or curator following the text literally gets
a wrong answer. §8 exists precisely because "a floor that two curators compute differently
… is a different eligible pool, and so a different price on the same row" — and as written
the formula is not computable at all.

**Suggested fix.** Bind the inner variable distinctly, e.g.

```
tier(ref)        = the weights entries the reference's band contains (§1)

candidate(entry) = max over the entry's PRESENT affixes a of
                   max { w.itemLevelMin : w ∈ tier(a) }
```

---

### F-2 — HIGH — "AD-17's enforcement … never against the file" is contradicted by AD-17

§8's absent-file paragraph closes:

> "The declared number is not re-derived when a file later arrives — a floor that moved
> under a base's entries would move the pool and the price with it, and **AD-17's
> enforcement would not notice, because it compares the entries against each other and
> never against the file.**"

The bolded claim is false against its own owner. AD-17 defines **four cross-file checks**,
every one of which compares a tracked entry against `weights.json` **at that entry's
declared floor**:

> "Four cross-file checks are defined once in `core`, and every shell holding both files
> runs them — `web` at load, and `sync` as a run-start gate before any priced entry consumes
> budget (AD-12) … Edge alignment is evaluated **under the scope, at the entry's own
> floor**, and is floor-dependent by design."

And §2.4 states the floor sensitivity explicitly, as a feature:

> "**Evaluate under the scope, at the entry's own floor.** The containment set shrinks as
> the floor drops, so a reference can align at one floor and fail at a lower one — that
> failure is the rule working."

So a floor declared from game data on day one, kept unchanged when a conforming
`weights.json` later arrives, is checked against that file the moment it arrives — by edge
alignment and by the empty-containment-set check — and a mismatch is not silent: under
AD-12 it **aborts the sync run non-zero** and is recorded in `sync-report.json`.

Only the *shared-floor* invariant (AD-17's "crafted entries on one `baseTypeId` must share
one `itemLevelMin`") is an entries-against-each-other check. §8 generalises that one check
to "AD-17's enforcement" as a whole.

The consequence is not cosmetic. §8 currently instructs the curator **not** to re-derive on
the file's arrival, and justifies it by an absence of enforcement that does not exist. A
curator following it can ship a floor that AD-12's gate then rejects, taking the sync run
down at exactly the transition rev 13's other half was written to smooth.

**Suggested fix.** Either narrow the claim to the shared-floor invariant, or — better —
replace the reassurance with the truth: the arriving file *does* check the declared floor
through AD-17's edge-alignment and empty-containment-set checks, and a floor that fails
them must be corrected, while a floor that passes them is left alone for the
price-stability reason §8 already gives.

---

### F-3 — MEDIUM — `tier(ref)` is defined through §2.4, which already presupposes the floor

§8 opens:

```
tier(ref) = the weights entries whose derived interval (§1) the
            reference's band edges align to under §2.4
```

§2.4 is **edge alignment**, and it is not a lookup — it is a *constraint*, quantified over
`contained(ref)`, which §2.4 evaluates "under the scope, at the entry's own floor." Defining
the floor's inputs by a predicate whose own evaluation is scoped by that floor is circular in
a second, independent way from F-1.

The set §8 actually wants is §1's **containment** set — "the weights entries whose derived
interval lies wholly inside the tracked band" — taken unscoped, before a floor exists. §2.4
is then the *check* that the band's edges are the extremes of that set, which is a separate
obligation on the curator and not the definition of `tier`.

The two are easy to conflate because §2.4's worked table is the clearest statement of which
bands are legal, but the table's subject is the band's legality, not the tier lookup.

**Suggested fix.** Define `tier(ref)` against §1 *Containment* and cite §2.4 separately as
the constraint the resulting band must satisfy.

---

### F-4 — MEDIUM — "the run is chased only where its rarest tier can roll" is an unowned claim, and the rarity premise is wrong in the document's own example

§8 justifies taking a run's **highest** `itemLevelMin` with:

> "the run is chased only where its rarest tier can roll."

Two problems.

1. **No owner states that a run's highest-`itemLevelMin` tier is its rarest.**
   `itemLevelMin` is an availability floor; rarity is `weight`. `WEIGHTS-FILE-SCHEMA.md`
   keeps them as separate required fields with no stated relationship, and nothing forbids a
   higher-floor tier from carrying the larger weight.
2. **The spine's own worked example runs the other way in spirit.** AD-11's flush-intrusion
   example pairs "T7 `[43, 56.5]` at weight 900 and T8 `[50, 56.5]` at weight 100" — the
   weight ordering there is incidental to the point being made, but it is the only weight
   pairing the spine writes down, and a reader checking §8's premise against it gets no
   support for treating "highest floor" and "rarest" as the same tier.

The *conclusion* (take the highest) is correct and is supported — see F-4's neighbour in
A.0, and §2.4's "a reference can align at one floor and fail at a lower one". The correct
justification is availability, not rarity: **below the highest floor in the run, the
highest tier is not in the scoped pool at all**, so the band's edges are no longer the
extremes of its containment set and edge alignment rejects the reference. That argument is
owned, mechanical, and already written in §2.4.

**Suggested fix.** Replace "rarest" with the availability argument.

---

### F-5 — MEDIUM — "A raw base is pinned at item level 82" cites AD-5 and AD-17; the number is the PRD's, and it carries a recorded assumption §8 drops

§8 states: "A **raw base** is pinned at item level 82 and takes no part in either maximum
(AD-5, AD-17)."

The second limb is supported — AD-17: "A raw base is exempt, because it is never a summand."
The **82** is not owned by either cited AD:

- AD-5 mentions the number only descriptively, inside a clause about what the data
  represents: "An entry with both affixes absent is a **raw base**, which is how the data
  represents white ilvl-82 bases." That is an observation about the domain, not a rule that
  a curator must declare 82.
- AD-17 does not mention 82 at all.
- `prd.md` **does** own it, normatively and in three places — the glossary ("an uncrafted
  white base at item level 82"), FR-3 and FR-22 ("a Raw Base, pinned at item level 82, is
  exempt"). This matches `AGENTS.md`'s ownership rule: the PRD owns product-owned numbers.

Worse, the PRD attaches an explicit caveat that §8 silently drops:

> "A Raw Base is priced as a white base at item level 82 (AD-5, AD-16). `[ASSUMPTION: 82 is
> the effective item level cap for these bases, so a floor of 82 and "exactly 82" are the
> same filter. **If bases above 82 exist, this needs a ceiling, not a floor.**]`"

§8 restates the number as settled fact under an architecture citation, which is exactly the
drift `AGENTS.md` warns about ("a citation survives the source changing and a copy silently
drifts"). If the assumption is ever falsified, the PRD's `[ASSUMPTION]` block is the place
that moves, and §8 will not.

**Suggested fix.** Cite the PRD (FR-22 / FR-3) for the 82 and AD-17 for the exemption, and
do not restate the figure.

---

### F-6 — MEDIUM — §8 and `prd.md` FR-22 now state the same derivation and disagree on its input; the spine's revision note describes a state that does not yet exist

Spine rev 13's revision note says:

> "With §8 in place, `prd.md` FR-22 can drop the last `*(PRD-owned)*` marker it wears over a
> computation."

Verified against `prd.md` (revision 14, committed at `55fe390`): FR-22 still carries the
marker **and** still states the derivation from the **label**:

> "- A crafted entry's candidate floor is the highest item level among its affixes'
>   **Accepted Tiers**. A Base Type's floor is the highest candidate across its crafted
>   entries, and every crafted entry on that Base Type declares that floor *(PRD-owned)*."

And FR-22's preceding bullet, also `*(PRD-owned)*`, defines Accepted Tier as the chased tier
("tier 1, except where tier 1 first appears at item level 81 or 82 and is too rare to
chase").

So two documents now own one computation and give it two different inputs: §8 says the
derivation "reads the band, never the label", while FR-22 says it reads the Accepted Tier.
The PRD's own glossary calls Accepted Tier "the tier or run of adjacent tiers worth
chasing, **expressed as the Modifier Reference's band** and labelled beside it" — which
makes the two reconcilable in intent, but FR-22's operative sentence names the label-shaped
concept, and `acceptedTier` is the field name AD-5 prohibits joining on.

This is a live duplication, not a stale citation. It is out of scope for an architecture
edit to fix inside the PRD, but the spine should not assert the cleanup as done or
available until the PRD edit lands.

**Suggested fix.** Reword the revision note to state the follow-up as *outstanding* ("`prd.md`
FR-22 should now cite §8 and drop its `*(PRD-owned)*` marker"), and raise the PRD edit as the
paired action. Recording it here so the sweep is not lost.

---

### F-7 — LOW — AD-5's new paragraph says "the tier an affix band names", singular; §8 permits a run

Spine AD-5: "The derivation takes the **tier an affix band names**, never the `acceptedTier`
label."

§8 and AD-17 both permit a band naming a **run** of adjacent tiers. The spine's singular
phrasing is narrower than the rule it points at. Harmless on its own — the spine delegates
the derivation to §8 and §8 handles the run — but it is the kind of narrowing a builder
quotes back later. One word ("the tier or tiers", or "the tiers an affix band names") closes
it.

---

### F-8 — LOW — `AGENT-WORKFLOW.md` step 2 restates §3's binding formula verbatim rather than citing it

Pre-existing, not introduced by rev 13, but the new material lands directly beside it and the
revision touched the block, so it is in scope for the sweep.

Step 2 reproduces the `rankable` / `covered` / `coverage` definitions and the "all three
conditions are load-bearing" argument in full. Those are `IMPLEMENTATION-NOTES.md` §3's,
which AD-0 makes binding; `AGENT-WORKFLOW.md` is expressly **not** binding ("This rule does
**not** extend to `AGENT-WORKFLOW.md`, which is process guidance carrying no invariant of its
own"). A non-binding copy of a binding formula is a drift surface with no precedence rule to
resolve it.

The rev 13 addition in the same block does this correctly — it cites
"`IMPLEMENTATION-NOTES.md` §3" for the omission rule rather than restating it — which makes
the surrounding duplication more conspicuous, not less.

**Suggested fix.** Replace the duplicated block with the citation, keeping at most the
one-line statement of what the gate is for.

---

### F-9 — INFORMATIONAL — the day-one path pre-commits a layout decision AD-27 reserves to the measured fraction

`AGENT-WORKFLOW.md`'s new day-one paragraph instructs: "Build the view … the unrankable
group is the surface the rest of the work lands into."

AD-27's table makes "the unrankable group is a **first-class surface** in `web`, not a
footer" the consequence of the **50–80%** band specifically. Adopting it unconditionally on
day one is a decision no AD makes. It errs in the safe direction — AD-24 already makes the
raw-base list the day-one content and the crafted rows unrankable, so a first-class
unrankable group is the honest day-one layout either way — and `AGENT-WORKFLOW.md` binds
nothing. Recorded, not raised as a defect.

---

## Part B — Stack table re-confirmation

Re-checked against upstream release feeds on 2026-09-19. The spine's Structural Seed is
explicitly "true at cold-start and owned by the code once it exists", and no code exists
yet, so a moved pin is a maintenance item rather than a defect. Per project instruction,
Mantine's 9.6.1 pin is deliberate and movement is reported without a major-version
recommendation.

| Name | Pinned | Current latest (2026-09-19) | Moved? |
| --- | --- | --- | --- |
| Node.js | 24.21.0 (Krypton LTS) | 24.21.0 — still the Active LTS | no |
| TypeScript | 6.0.3 | 7.0.2 is npm `latest` | **yes — deliberate hold, see below** |
| pnpm | 12.4.2 | 12.4.2 | no |
| React | 19.3.0 | 19.3.0 | no |
| Vite | 8.3.0 | 8.3.0 | no |
| `@mantine/core` | 9.6.1 | 9.6.1 | no |
| Zod | 4.6.5 | 4.6.5 | no |
| Vitest | 5.0.1 | 5.0.1 | no |
| MSW | 2.15.0 | 2.15.0 | no |
| ESLint | 10.11.0 | 10.11.0 | no |
| typescript-eslint | 8.70.0 | 8.70.0 | no |
| dependency-cruiser | 18.3.1 | 18.3.1 | no |

Sources: npm registry `dist-tags`/`latest` metadata per package; `nodejs.org/download/release/index.json`;
`nodejs/Release` `schedule.json`; `dependency-cruiser` `src/meta.cjs` on `main`;
typescript-eslint issue #12518.

**Eleven of twelve pins are still the current release.** The table is in better shape than a
pre-code stack table usually is, and the cold-start seed needs no edit for drift.

Three claims in the surrounding prose were checked rather than taken:

- **"24.21.0 (Krypton LTS)" is accurate.** `nodejs/Release` `schedule.json` gives v24 the
  codename Krypton, LTS 2025-10-28 → 2028-04-30, so it is the Active LTS today. v26.9.0 is
  the current *Current* line and becomes LTS on 2026-10-28 — worth a diary note, not an
  edit.
- **"TS 7.0.2 is current" is accurate.** The 6.0.3 pin is behind `latest` by a major, which
  is the spine's stated intent, not drift. TS 7.1 has not shipped (only
  `7.1.0-dev.20260919.1` on `next`), so the "TS 7 ships no programmatic API yet" premise
  still holds.
- **Both blockers are confirmed at the source, in the spine's own words.**
  `typescript-eslint` 8.70.0 peers `typescript` at `>=4.8.4 <6.1.0`; `dependency-cruiser`
  18.3.1 declares `supportedTranspilers.typescript: ">=2.0.0 <7.0.0"`. Both ranges match the
  spine character for character. Forcing TS 7 under typescript-eslint 8.70.0 crashes
  typescript-estree outright, so the TS 6 pin is load-bearing for lint rather than a
  preference — which is stronger than the spine claims for it.

Minor caveat: whether **6.0.3 is the newest 6.x patch** could not be confirmed (the
`typescript` packument exceeds the fetch limit and `latest` now points at 7.x). Treat the
patch level, not the major, as the unverified part.

### F-10 — LOW — the TypeScript 7 upgrade trigger points at a watch target that has closed

The spine's *Upgrade trigger — TypeScript 7* paragraph ends:

> "**Both blockers have one upstream cause** — TS 7 ships no programmatic API yet
> (typescript-eslint#12518) — so neither will clear on its own schedule, and **watching that
> issue is more informative than watching either release feed.**"

The diagnosis is correct and both blockers verify. The *instruction* is now stale:
**typescript-eslint#12518 is closed as not planned / duplicate**, so the issue will produce
no further signal and a watcher following this sentence will see nothing and conclude
nothing has changed — which is the failure mode the sentence was written to avoid.

The paragraph's own "(re-verified 2026-09-19)" marker covers the two peer ranges, which do
hold; it does not cover the issue's status. Retarget the watch to a live thread, or state
the condition directly (a `typescript-eslint` release whose `typescript` peer admits `<8.0.0`,
**and** a `dependency-cruiser` release whose `supportedTranspilers.typescript` admits `7.x`).

**Standing note on the TypeScript 7 upgrade trigger.** The spine's blocker paragraph claims
two things that are checkable and were re-verified as part of this sweep: that
`typescript-eslint` 8.70.0 peers `typescript` at `>=4.8.4 <6.1.0`, and that
`dependency-cruiser` 18.3.1 declares `supportedTranspilers.typescript: ">=2.0.0 <7.0.0"`.
The paragraph carries its own "(re-verified 2026-09-19)" marker, which is the right
discipline — it is the only pin in the table that dates its own evidence. The reasoning that
both blockers share one upstream cause (typescript-eslint#12518, TS 7 shipping no
programmatic API) and that watching the issue beats watching two release feeds is sound and
is the kind of reality-check this lens exists to reward.

---

## Verdict

**Pass with findings.** Revision 13's judgement is right on every point the brief named:
the absent-file carve-out is a genuine correction to a build order that previously
instructed an escalation for a non-failure, and §8's correction from the `acceptedTier`
label to the affix band closes a real hole in AD-5's own prohibitions. Eight of the brief's
named claims verify against their owner in the owner's words.

The defects are concentrated in §8's three-line formula block and in one over-broad
reassurance:

- **F-1** makes the central formula uncomputable as written (variable capture on
  `entry.itemLevelMin`).
- **F-2** tells the curator that AD-17 will not check a stale floor, when AD-17's four
  cross-file checks do exactly that and AD-12 aborts the run on failure.
- **F-3** defines `tier(ref)` through a predicate that presupposes the floor.

None of the three requires an AD. All three are edits inside §8.

Part B found **no stale pin** — eleven of twelve versions are still current and the twelfth
is a documented deliberate hold whose two blockers verify at the source. The one Part B
finding (**F-10**) is that the upgrade trigger's watch target has closed, so the paragraph's
monitoring instruction no longer produces a signal.

Full finding list: F-1 (high), F-2 (high), F-3 (medium), F-4 (medium), F-5 (medium),
F-6 (medium), F-7 (low), F-8 (low), F-9 (informational), F-10 (low).
