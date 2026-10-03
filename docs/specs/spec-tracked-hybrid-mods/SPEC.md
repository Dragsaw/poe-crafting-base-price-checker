---
id: SPEC-tracked-hybrid-mods
companions:
  - ../../architecture/architecture-poe-crafting-base-price-checker-2026-09-12/ARCHITECTURE-SPINE.md
  - ../../architecture/architecture-poe-crafting-base-price-checker-2026-09-12/IMPLEMENTATION-NOTES.md
  - ../../architecture/architecture-poe-crafting-base-price-checker-2026-09-12/WEIGHTS-FILE-SCHEMA.md
  - ../../ux-designs/ux-poe-crafting-base-price-checker-2026-09-13/EXPERIENCE.md
  - ../../../.claude/skills/tracked-json/SKILL.md
sources: []
---

# Hybrid modifiers in tracked.json

> **Canonical contract.** This SPEC and the files in `companions:` are the complete, preservation-validated contract for what to build, test, and validate.

## Why

Hybrid modifiers and same-`statId` prefix+suffix pairs cannot be priced today, so high-value bases go unpriced and unranked. PRD FR-34 owns the requirement. The spine's deferred item *"Pricing a deliberate conjunction of co-occurring stats"* is retired by this work.

- **Hybrid modifiers.** A `ModifierRef` names one `statId`, and a crafted entry has at most one reference per slot (AD-5). A curator can track a hybrid only by one of its stat lines, and a pure modifier shares that line's `statId`. On Bows, `LocalIncreasedPhysicalDamagePercentAndAccuracyRating` carries `stat_1509134228` (shared with `LocalPhysicalDamagePercent`) and `stat_691932474`, local accuracy (shared with `IncreasedAccuracy`). The search cannot isolate the hybrid. `data/weights.json` already models a hybrid tier as one entry with several `lines` (WEIGHTS-FILE-SCHEMA.md).
- **Same-`statId` prefix and suffix.** % increased Rarity of Items can roll as a prefix and as a suffix, and a hybrid line can share a `statId` with the other slot (the Bows hybrid above and the suffix `LightRadiusAndAccuracy` share local accuracy `stat_691932474`). Trade sums the values of one `statId` across both mods (manual observation; capture pending in IMPLEMENTATION-NOTES §5.1d). Sync sends one filter per slot, so the search cannot match the summed value.

## Definitions

- **Hybrid tier.** A weights entry with more than one non-null line.
- **Line set.** The non-null line `statId`s of a weights entry. A `statId: null` line is classed by the null-line rule below.
- **Null-line rule** (WEIGHTS-FILE-SCHEMA.md 6.1.0). A tier is untrackable when its `weightSource` is `not-in-game` (weight 0). A null line on a `weight > 0` tier in a `complete` pool is an internal engine line and does not enter the line set. A null line in a `partial` pool makes the tier untrackable, and the reason says so. The rule reads the weights file alone, so `tracked:lookup`, `core` and the sync gate reach one verdict.
- **Containment set** of a hybrid reference. The same-slot pool entries that have `weight > 0`, a line set identical to the reference's `statId` set, and every line contained by the reference's band for that line. Entries whose line set differs are excluded and reported by tier id.
- **Family.** Identified by (slot, line set), not by modGroup. Its `modGroup` is the one modGroup shared by the containment set.
- **Summed `statId`.** A `statId` named by the prefix reference and by the suffix reference of one entry (pure line or hybrid line, either side).

## Capabilities

IDs are stable. Each CAP serves PRD FR-34.

- **CAP-1**
  - **intent:** A curator can write one affix reference that names every stat line of a hybrid modifier. Each line takes its own band or uses the valueless form.
  - **success:** `TrackedFileSchema` accepts a crafted entry whose prefix is the Bows phys%+accuracy hybrid with a band on each line, and one that mixes a banded and a valueless line. The schema rejects a hybrid reference with fewer than two lines, a repeated `statId`, an empty `statId`, a band with `min > max`, and a non-finite or negative value. The schema sorts lines by `statId`, so two orderings of the same lines give one canonical key. That key differs from every single-line key and does not include `acceptedTier`. Each rejection and key property has its own schema test.
- **CAP-2**
  - **intent:** Sync prices a hybrid reference with one trade search that requires every line to fall within its band.
  - **success:** For a hybrid entry, the search body has one stat filter per line under the same `and` group. A banded line carries `{min,max}` and a valueless line carries `{}`. The test runs against an MSW fixture.
- **CAP-3**
  - **intent:** The probability of a hybrid reference is computed as for a pure modifier. It uses the weights that `weights.json` publishes for the hybrid tiers and does not multiply probabilities across lines. IMPLEMENTATION-NOTES §11's `C_p`/`C_s` use the containment set, and `g(e)` is the family's modGroup. The probability ratio keeps its current denominator.
  - **success:** Fixture pools prove three cases: a hybrid family and a pure family sharing a `statId` yield the hybrid tiers' weight sum only; two hybrid families in one slot; and a hybrid and a suffix sharing a modGroup. Each tier counts once, deduplicated by tier id, even when it belongs to a hybrid and a pure family.
- **CAP-4**
  - **intent:** The load-time checks treat a hybrid reference consistently: overlap (FR-16), edge alignment (IMPLEMENTATION-NOTES §2.4), the shared floor (IMPLEMENTATION-NOTES §8) and the cross-file checks (AD-17). A reference is complete when its `statId` set equals the line set of every contained tier. A subset is rejected because it reproduces the overlap with the pure modifier. The checks also reject a single-line reference whose band intersects the interval of a hybrid tier's line on the same `statId`. In `data/weights.json`, none of the 2792 pure T1/T2 tiers does, so this rejection is a safety net.
  - **success:** The line-set completeness check runs in `core` as a cross-file check (AD-17) at web load and at the sync gate (AD-12), and in `pnpm tracked:check`. A correctly derived hybrid entry passes. Each of the following fails, and the error message names the offending line:
    - a misaligned line band, with alignment computed on the containment set (worked case: the containment set is {T1}, so a line band spanning T1–T2 is misaligned);
    - a hybrid reference whose `statId` set differs from the line set of any contained tier;
    - an empty containment set;
    - contained tiers that span more than one modGroup. The error blames the producer data and not the curator. A synthetic fixture proves it, because the committed data has no such family;
    - a single-line band that reaches into a hybrid tier of its pool.

    When `weights.json` is absent, the completeness check is skipped and the entry is marked unvalidated, per AD-17, in both `core` and `tracked:check`.
- **CAP-5**
  - **intent:** A curator can pick a hybrid as one choice in `tracked:lookup` and in the `tracked-json` skill, and draft its per-line bands. `tracked:lookup` applies the null-line rule and gives the reason for each untrackable tier. It offers a family only when every contained tier is trackable. The skill drafts entries in the new tracked schema: both affixes, hybrid references, and summed-`statId` pairs.
  - **success:** The skill's interactive flow on Bows offers the phys%+accuracy hybrid and drafts one hybrid reference, with a band for every line, that `tracked:check` passes. `tracked:lookup` on the Time-Lost Diamond hybrid with a null-`statId` line reports it untrackable with a reason. `tracked:lookup` on a tier with an internal engine line offers it, and the line is absent from the draft. Every drafted crafted entry names a prefix and a suffix. `SKILL.md` no longer tracks one line of a hybrid: the band step drafts every line of a hybrid pick, the offer step applies the null-line rule instead of dropping every row with a `null` line, and the same-`statId` collision step (4b) does not offer single-line tracking of a hybrid-shared `statId`.
- **CAP-6**
  - **intent:** Sync prices an entry that has a summed `statId` with one filter for each such `statId`. The pairs are pure + pure (% increased Rarity of Items), hybrid line + pure, and hybrid line + hybrid line. The filter's min is the sum of the mins and its max is the sum of the maxes. Overlap for a summed `statId` compares the summed intervals (IMPLEMENTATION-NOTES §2.1 owns the formula). Each slot contributes at most one line per `statId`, so a sum has at most two operands. A summed `statId` is the only cross-slot interaction on one `statId`: per-slot overlap does not apply across slots. A valueless line, or a missing bound on either operand, is invalid.
  - **success:** The search body for a rarity-prefix + rarity-suffix entry has one filter for that `statId`, with min and max equal to the sums. The search body for the Bows phys%+accuracy hybrid prefix with a `LightRadiusAndAccuracy` suffix has one filter for `explicit.stat_691932474` with the summed accuracy bands, and one filter for `stat_1509134228` with the phys% band. No `and` group repeats an id after summing. Two entries with disjoint per-slot bands but intersecting summed intervals fail overlap. The valueless and missing-bound rejections run in `core` at web load and at the sync gate, and in `tracked:check`. A fixture test pins that the summed filter admits a low-prefix + high-suffix combination from different tiers while the probability uses per-slot containment.
- **CAP-7**
  - **intent:** The player sees a hybrid affix as its tier label followed by its lines, separated by commas.
  - **success:** The label comes from the entry's `acceptedTier`, and each line's short form comes from the same source as a single-line affix's short form. A hybrid ES+Evasion T1 affix renders as `T1 % ES, % Evasion`. The `·` separator that joins affixes is unchanged. The joined label follows EXPERIENCE.md's short-form overrun rule (about 27 characters per chase cell, ellipsis, full text one click down). A test covers the longest hybrid label and a hybrid with three or more lines. Short forms are used only when every line has one. When the tier, any short form or a line's band is missing, every line renders in its catalog text, with its band where it has one, and the affix never mixes short and catalog forms. A hybrid label may read like two affixes. This is accepted.
- **CAP-8**
  - **intent:** A tracked crafted entry always has a prefix and a suffix.
  - **success:** `TrackedFileSchema` rejects a crafted entry that lacks either slot. Existing partial entries are deleted, not converted. The absent-affix branches are removed from overlap, probability and rendering code, and the stale normative text listed under Document changes is removed with them.

## Constraints

- A hybrid reference is its own discriminated `kind` arm. The schema never infers it from an optional extra field (AD-5).
- `acceptedTier` (FR-22) applies to the hybrid tier as a whole, not to each line. It stays display-only and unvalidated: no check compares it to the containment set.
- Kind agreement (AD-17) applies per line. `needs(hybrid)` for the floor (IMPLEMENTATION-NOTES §8) is evaluated over the containment set. It is the maximum `itemLevelMin` when any line is banded and the minimum `itemLevelMin` when every line is valueless. It is guarded against an undefined `itemLevelMin`.
- `coOccur(x, y)` (IMPLEMENTATION-NOTES §2.2) is true when some same-slot pool entry with `weight > 0` is contained by both references, and false when x and y share no line. Overlap (FR-16) between a hybrid and a single-line reference, and between two hybrids, compares per-line intervals on shared `statId`s, and it requires that `coOccur` holds. A hybrid overlaps a single-line reference when the reference's `statId` is one of the hybrid's lines and the bands intersect. Two hybrids overlap when every shared line's bands intersect and `coOccur` holds. IMPLEMENTATION-NOTES §2.1 owns the formula.
- The canonical key of a hybrid reference is `["hybrid", [line, …]]`. Lines are sorted by `statId`, and each line is encoded as today: `[statId, min, max]`, or `[statId, null, null]` for a valueless line. IMPLEMENTATION-NOTES §4.1 owns the encoding. The absent form `null` goes away (CAP-8).
- Tier scope is a product rule: curators track only T1 or T1–T2 tiers. `tracked:check` does not enforce it.
- The weights contract (WEIGHTS-FILE-SCHEMA.md) does not change.

## Risks and migration

- **Accepted effect, stated by the AD-16 revision.** A summed filter spans the sum of the mins to the sum of the maxes. It therefore also matches combinations outside the tracked bands, such as a low prefix with a high suffix from different tiers. The price is an upper-bound population, and the AD-16 revision says so. This change adds no mitigation, and the CAP-6 fixture pins the divergence.
- **Breaking changes are allowed.** The tracked schema gets a major version bump, and this design alone shapes it. A tracked file with an old schema version is rejected with a message that names the major bump. The same change rewrites the committed `data/tracked.json` so that it validates under the new schema, and the choice of mods in it does not matter beyond the success signal below.
- **Artifacts.** `data/dataset.json`, `data/sync-progress.json` and `data/sync-report.json` keep their schema versions and their committed contents: the hybrid form adds keys and changes no existing one (IMPLEMENTATION-NOTES §12.1). Entries whose key is not in the current tracked key set are dropped, and a test shows an old-key progress file ages out without throwing.

## Document changes

One owner per fact (AGENTS.md). The owner documents are revised on this branch: PRD FR-34 (with FR-16, FR-22, §3, §7), `PRODUCT.md`, spine AD-5, AD-16, AD-17 (Deferred item retired), IMPLEMENTATION-NOTES §1, §2.1–§2.8, §4.1, §5.1d, §5.5, §8, §11, §12.1, and EXPERIENCE.md for CAP-7. The remaining changes are code: the `tracked-json` skill and `tracked:lookup` (CAP-5), and the §5.1d capture.

## Non-goals

- Rare items.
- Conjunctions of two separate modifiers, beyond CAP-6's same-`statId` sum.
- A stat that rolls two numbers on one line (the `banded` kind already handles it).
- Enforcing the tier-scope rule in `tracked:check`.

## Success signal

- The committed `data/tracked.json` passes `pnpm tracked:check` and AD-17 against `data/weights.json`, and it holds at least one hybrid entry and at least one summed-`statId` entry.
- MSW-fixture tests prove the hybrid and summed search bodies (CAP-2, CAP-6), the probability (CAP-3) and the rendering in CAP-7's format. A live Divine price is an observation, not a pass condition.

## Open questions

- None.
