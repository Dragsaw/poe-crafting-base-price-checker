# Sprint Change Proposal — blocking mod tags in the second draw

- **Date:** 2026-10-23
- **Trigger:** `docs/research/technical-poe2-no-tag-mod-blocking-2026-10-23/research.md`, which answers the deferred entry *"Model blocking mod tags"* (player feedback, 2026-10-18)
- **Mode:** incremental
- **Scope:** Moderate. Contract major bump, a spine revision, and a new epic whose stories `bmad-create-epics-and-stories` writes. No story is inserted by this proposal, so the *A change to the stories of an epic* steps (AGENT-WORKFLOW.md) do not apply here.

## 1. Issue summary

PoE2 has five item tags `no_<element>_spell_mods` (fire, cold, lightning, chaos, physical). A modifier can add some of them to an item. A modifier whose spawn tags list one of them at weight 0 before the class's own tag cannot roll on an item that has that tag. On Wands and Staves, an element damage prefix adds the tags of the other four elements and so blocks their `+# to Level of all <E> Spell Skills` suffixes and the other ailment suffixes, and the reverse.

Contract `6.1.0` has no field for these tags, so `core`'s second draw keeps blocked modifiers in its numerator and its denominator. Example from the research: a Wand with `increased Cold Damage` loses 18,400 of 73,000 suffix weight (25 %), which `core` counts today.

User decisions, taken 2026-10-23:

| Question | Decision |
| --- | --- |
| Contract shape | `7.0.0`, two required per-entry fields resolved per class by the producer: `addsTags`, `blockedByTags` |
| Placement | A new Epic 5. Stories are written with `bmad-create-epics-and-stories`, not by this proposal |
| A tracked combination the game cannot roll | A cross-file failure; the entries are **deleted** from `data/tracked.json`, not pruned |

## 2. Impact analysis

**Evidence on the committed data.** With the research's family table, 24 active entries in `data/tracked.json` pair one element's damage prefix with another element's `+Level of all … Spell Skills` suffix (20 Wands, 4 Staves) and rank today at a positive probability. About 80 more Wand and Staff entries have one affected side, so their probability moves. Foci are not affected (their spawn tags list `focus` first). Jewels are not affected (no jewel mod has a `no_*` spawn tag).

**Epics.** Epics 1 to 4 are done and stay closed. A new Epic 5 holds the work.

**Artifacts.**

| Artifact | Change |
| --- | --- |
| `WEIGHTS-FILE-SCHEMA.md` | `6.1.0` → `7.0.0`: two required fields, the exclusivity rule extended, one hard error |
| `ARCHITECTURE-SPINE.md` | Revision 38 → 39: AD-11 version pin and field list; AD-17 draw model and reach rule; a new cross-file check; check counts removed; Structural Seed labels |
| `AGENT-WORKFLOW.md` | Copies of the contract version, field list and check list removed |
| `.claude/skills/tracked-json/SKILL.md` | Check count removed |
| `docs/stories/deferred-work.md` | Jewel entry removed (no effect); main entry stays until the story lands |
| `prd.md` | None. `P(combo)` belongs to the spine; FR-4's third cause already covers the failure |
| `EXPERIENCE.md`, `DESIGN.md` | None. No new state or string |
| External producer | Must emit `7.0.0` |

**Technical impact.** `contracts` refuses a `6.x` file once it implements `7.0.0`, so every crafted class is unrankable until a `7.0.0` `data/weights.json` is committed. The code change lands only together with that file.

## 3. Recommended approach

**Direct adjustment by a new epic.** The exclusion is one predicate added to the existing mod-group exclusion in `orderedTerm` (`packages/core/src/probability.ts`). The impossible combinations fail as a cross-file check, as an empty containment set already does, so they are loud and never a silent `P = 0`.

- **Effort:** medium. Schema, one exclusion predicate, one cross-file check, fixtures, one data edit.
- **Risk:** low for the code; medium for sequencing (the producer must ship first).
- **Rejected:** a rollback (nothing to revert); a PRD review (no promise changes); `recipeReach` alone for the impossible entries (it is per recipe, and state 36 has no reason string).

## 4. Detailed change proposals

### 4.1 `WEIGHTS-FILE-SCHEMA.md` → `7.0.0`

Front matter: `schemaVersion: '7.0.0'`, `updated: '2026-10-23'`. In the opening blockquote, add after the `6.1.0` clause: *"and `7.0.0` (blocking tags) as of spine revision 39"*.

New section above `## 6.1.0`:

> ## 7.0.0 — blocking tags
>
> **Breaking.** Every entry gains two required fields. `core` implements `7` and refuses a `6.x` file as an unknown major (spine AD-11).
>
> | Change | Reason |
> | --- | --- |
> | New required **`addsTags`** on every entry: the `no_*` tags its modifier adds to an item, from poe2db's `adds_no`, verbatim, sorted by code unit | A modifier on an item can stop modifiers of *other* groups from rolling. `modGroup` cannot express that, because the effect crosses groups and slots. |
> | New required **`blockedByTags`** on every entry: the `no_*` tags that set its modifier's weight to `0` **on this class**, sorted by code unit | The game reads a modifier's spawn tags in order, and the first tag the item has decides the weight. The producer resolves that order against the class, as it already does for `weight`. A `no_*` tag that comes after the class's own tag never decides, so it is not emitted. |
> | Nothing else | Weights, `modGroup`, `lines`, the `className` grammar and every `6.x` hard error are unchanged. |
>
> The tag set and which families carry it are game data, not contract terms: `docs/research/technical-poe2-no-tag-mod-blocking-2026-10-23/research.md` records them for patch 0.5.5.4.2.

*The exclusivity rule*, one bullet appended:

> - **A modifier can also block by tag.** An item's tags are the union of the `addsTags` of the modifiers on it. A consumer predicting the next roll also removes every entry whose `blockedByTags` meets the item's tags, before normalising.

*Shape*: `"addsTags": []` and `"blockedByTags": []` on each example entry; one example carries a non-empty pair.

*Field rules*, two rows:

> | `addsTags` (`7.0.0`) | **Required**, possibly empty. Each element matches `^no_[a-z0-9_]+$`; no duplicates. Nothing is derived from it. |
> | `blockedByTags` (`7.0.0`) | **Required**, possibly empty. Same element rule. Resolved per class as above. A `no_*` spawn tag with a non-zero weight before the class tag cannot be represented, so the producer refuses that row. |

*Validation, hard errors*, one bullet:

> - **(`7.0.0`)** a missing `addsTags` or `blockedByTags`, an element that is not a `no_*` tag, or a duplicate tag within one array

### 4.2 `ARCHITECTURE-SPINE.md`, revision 38 → 39

Front matter: `revision: 39`, `updated: '2026-10-23'`; add the research doc to `sources`. One `.memlog.md` row for revision 39.

**AD-11 Rule**

```
OLD: conforming to `WEIGHTS-FILE-SCHEMA.md` **`6.1.0`**
NEW: conforming to `WEIGHTS-FILE-SCHEMA.md` **`7.0.0`**

OLD: An entry carries `sourceModifierId`, `modGroup`, `itemLevelMin`, `weight`, `weightSource`,
     and **`lines[]`**
NEW: An entry carries `sourceModifierId`, `modGroup`, `addsTags`, `blockedByTags`, `itemLevelMin`,
     `weight`, `weightSource`, and **`lines[]`**

OLD: **`core` reads `modGroup` for AD-17's exclusion only**
NEW: **`core` reads `modGroup`, `addsTags` and `blockedByTags` for AD-17's exclusion only**

OLD: under its own rule (`WEIGHTS-FILE-SCHEMA.md` `6.1.0`)
NEW: under its own rule (`WEIGHTS-FILE-SCHEMA.md` `7.0.0`)
```

AD-10's citation of `6.1.0` for `not-in-game` stays: it names the version that introduced the value.

**AD-17, the draw model**

```
OLD: **and the second draw is conditioned on the first by mod-group exclusion**
NEW: **and the second draw is conditioned on the first by mod-group and blocking-tag exclusion**

OLD: The augment draws from the other slot's pool with every entry sharing the first affix's
     `modGroup` removed, and renormalises the rest.
NEW: The augment draws from the other slot's pool with every entry that shares the first
     affix's `modGroup`, or whose `blockedByTags` meets its `addsTags`, removed, and
     renormalises the rest.

OLD: **Where no `modGroup` spans both slots of a class, the result is exactly `P(prefix) ×
     P(suffix)`**; the exclusion exists so a patch that shares a group across slots is valued
     correctly rather than overstated.
NEW: **Where no `modGroup` spans both slots of a class and no entry's `addsTags` meets an
     entry of the other slot's `blockedByTags`, the result is exactly `P(prefix) × P(suffix)`**;
     the exclusion exists so such a class is valued correctly rather than overstated.
```

**AD-17, the reach paragraph.** After "`core` exposes the reach verdict for each `(entry, recipe)` pair." add: *"A pair whose probability is `0` is unreachable."*

**AD-12 and AD-17, check counts removed**

```
AD-12  OLD: — **all six checks** (AD-17) —
       NEW: — **every cross-file check** (AD-17) —

AD-17  OLD: **Six cross-file checks are defined once in `core`, and every shell holding both files runs them**
       NEW: **The cross-file checks are defined once in `core`, and every shell holding both files runs them**

       OLD: **The affected class is well-defined for all six checks**: each evaluates something belonging
            to a `crafted` tracked entry — a reference for five of them, the entry's own `className` for
            class discriminability —
       NEW: **The affected class is well-defined for every check**: each evaluates something belonging
            to a `crafted` tracked entry — a reference, or for class discriminability the entry's own
            `className` —

       OLD: **All six checks are crafted-only**
       NEW: **Every cross-file check is crafted-only**

       OLD: The six:
       NEW: The checks:
```

**AD-17, new row in the check table**

> | **Co-rollable combination** | no prefix tier and suffix tier of the entry's containment sets under the scope can be on one item in either draw order: in each order the two share a `modGroup`, or the first's `addsTags` meets the second's `blockedByTags`. This is a validation error, never a `P = 0` | `packages/core/src/cross-file/co-rollable.ts` |

**Structural Seed**

```
OLD: producer -.->|schema-conformant 6.1.0<br/>tiers + lines + modGroup + itemLevelMin| weights
NEW: producer -.->|schema-conformant 7.0.0<br/>tiers + lines + modGroup + blocking tags + itemLevelMin| weights

OLD: weights.json    # consumed weights file, contract 6.1.0 — external producer (AD-11)
NEW: weights.json    # consumed weights file, contract 7.0.0 — external producer (AD-11)
```

Not changed: AD-12's prune tombstone (the deletion is a one-off curator exception named in its commit message). Out of scope and flagged: the *Deferred* item "Mod-group conditional probability" is already stale, because AD-17 conditions the second draw.

### 4.3 `AGENT-WORKFLOW.md` and the `tracked-json` skill

The copies of spine content are removed, so a contract change no longer touches this file.

```
AGENT-WORKFLOW.md, Build order, ModifierWeight bullet
OLD: **`ModifierWeight` follows weights contract `6.1.0`** (AD-11): one entry is one tier of one modifier,
     carrying `sourceModifierId`, **`modGroup`**, `itemLevelMin`, `weight`, `weightSource` and **`lines[]`**,
     each line holding its own `statId` (or `null`) and its `ranges` **verbatim**. Write it to `6.0.0`
     directly; never to a `5.x` or `4.x` shape — the schema refuses a `5.x` file as an unknown major.
     **Read `modGroup` for exclusion (AD-17), and never parse it out of `sourceModifierId`.** The inner …
NEW: **`ModifierWeight` follows the weights contract**: one entry is one tier of one modifier.
     **Never parse anything out of `sourceModifierId`.** The inner …

AGENT-WORKFLOW.md, cross-file paragraph
OLD: **Six cross-file checks live in `core`, and `web` is not their only caller.** All six read
     `tracked.json` and `weights.json` together, … They are edge alignment, the empty containment set,
     `coOccur`, kind agreement, **class discriminability** and **line-set completeness** (AD-17).
     … The fifth was added by spine revision 17 and is the odd one: its subject is …
NEW: **The cross-file checks live in `core`, and `web` is not their only caller.** Each reads
     `tracked.json` and `weights.json` together, … Class discriminability is the odd one: its subject is …

.claude/skills/tracked-json/SKILL.md, line 11
OLD: … catalogue resolvability and the six cross-file checks against `data/weights.json` …
NEW: … catalogue resolvability and the cross-file checks against `data/weights.json` …
```

### 4.4 `docs/stories/deferred-work.md`

Remove the jewel entry (*"Check whether jewel mods carry the `no_*` blocking tags…"*) in the commit that holds this proposal; the commit message names the decision: the research found no jewel mod with a `no_*` spawn tag. No GitHub issue was opened for it, so none is closed. The main entry (*"Model blocking mod tags…"*) stays until the last commit of the branch that lands the work.

### 4.5 The research doc

Commit `docs/research/technical-poe2-no-tag-mod-blocking-2026-10-23/` with this proposal, with its `digests/` regenerated (`repoe-poe2-no-tags-by-family.txt`, `summary.py`) from the versioned RePoE source `[S1]` cites, so the 25 % figure and the 24-entry count can be checked.

### 4.6 Story suggestion for `bmad-create-epics-and-stories`

**Epic 5: Weights fidelity.** The player reads Wand and Staff rows valued on the modifiers the game can really roll together, and a combination the game cannot roll is never ranked. Retouches FR-1 and FR-4; adds no FR.

One story suggested, *Blocking mod tags in the second draw*, covering: the `7.0.0` schema and the `6.x` refusal; the tag exclusion in the second draw; the co-rollable cross-file check in every shell; `P = 0` as unreachable; fixtures including the Wand cold-damage example and an unchanged Focus and jewel result; deletion of the entries `tracked:check` lists; `pnpm check` green. It merges only together with a `7.0.0` `data/weights.json`.

## 5. Implementation handoff

**Scope: Moderate.**

| Who | Does |
| --- | --- |
| Developer (this session, on approval) | Apply 4.1 to 4.5; commit the proposal, the research doc and the owner-doc edits |
| Player, as producer owner | Make `poe-mod-weights-producer` emit `7.0.0` per 4.1, and commit the new `data/weights.json` |
| `bmad-create-epics-and-stories` | Write Epic 5 and its stories from 4.6 into `epics.md`; then `sprint-status.yaml` and the epic context follow the *A change to the stories of an epic* steps |
| `bmad-build` | Build the story against fixtures; merge together with the `7.0.0` file |

**Success criteria.**

- `WEIGHTS-FILE-SCHEMA.md` is `7.0.0` and the spine is revision 39 with the edits above.
- On the `7.0.0` file, the Wand cold-damage second-draw suffix pool omits the six blocked families and keeps Freeze Buildup and `+Level of all Cold Spell Skills`.
- `pnpm tracked:check` reports no co-rollable failure after the deletion, and Foci and jewel probabilities are unchanged.
- The main deferred entry is removed in the last commit of the landing branch.
