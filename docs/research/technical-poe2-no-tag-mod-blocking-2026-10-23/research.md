---
title: 'PoE2 no_* mod-blocking tags'
type: technical
shape: explore
date: '2026-10-23'
game_data: '0.5.5.4.2'
serves: 'docs/stories/deferred-work.md — the two no_* entries (WEIGHTS-FILE-SCHEMA.md source_spec)'
---

# PoE2 no_* mod-blocking tags

## Answer

1. **Full list.** On items, the game has exactly five blocking tags:
   `no_fire_spell_mods`, `no_cold_spell_mods`, `no_lightning_spell_mods`,
   `no_chaos_spell_mods`, `no_physical_spell_mods`. The other `no_*` tags in the data
   (`no_boss`, `no_strongboxes`, `no_monster_packs`, `no_fractured`, …) are on area, atlas
   and monster mods only. [S1]
2. **Affected tracked classes: Wands and Staves only.** Traps are also affected but are
   not tracked. Foci and jewels are **not** affected (see below). [S1][S2]
3. **The producer does not emit the tags.** `data/weights.json` (producer `6.1.0`,
   `gamePatch` `0.5.5`) has no tag field and contains no `no_` string. Contract `6.1.0`
   has no field for them. The producer's source, poe2db, does publish them: each mod in
   the page JSON has `adds_no` (tags the mod adds) and `spawn_no` (the ordered
   spawn-weight tags). The producer can read them from pages it already scrapes. [S2][L1]

## The rule

A mod's `spawn_weights` list is read in order. The first tag that the item has decides the
weight. A blocked mod lists `no_<element>_spell_mods` with weight 0 *before* the class tag,
so after another mod adds that tag, the blocked mod's weight on that item is 0. [S3][S1]

## Which mods add and which mods are blocked

Element E ∈ {Fire, Cold, Lightning, Chaos, Physical}. Each family below **adds** the
`no_*` tag of every *other* element and is **blocked by** its own element's tag. [S1]

| Side | modGroup | Family (one per element) | Blocked by |
| --- | --- | --- | --- |
| prefix | `WeaponDamageTypePrefix` | `#% increased E Damage` (Physical: `increased Spell Physical Damage`) | `no_E_spell_mods` |
| suffix | `IncreaseSocketedGemLevel` | `+# to Level of all E Spell Skills` | `no_E_spell_mods` |
| suffix | `IgniteChanceIncrease` | `#% increased Flammability Magnitude` (Fire) | `no_fire_spell_mods` |
| suffix | `FreezeDamageIncrease` | `#% increased Freeze Buildup` (Cold) | `no_cold_spell_mods` |
| suffix | `ShockChanceIncrease` | `#% increased chance to Shock` (Lightning) | `no_lightning_spell_mods` |

Asymmetry: the three ailment suffixes add the tags of the other ailment elements and of
Chaos, but **not** `no_physical_spell_mods`. [S1] `+# to Level of all Spell Skills` (no
element) neither adds nor is blocked. [S1]

The prefixes already share one group, and the element level suffixes share one group. So
the new effect is **across sides**: one element prefix removes the other elements' level
suffixes and ailment suffixes, and the reverse.

**Example.** A Wand with `increased Cold Damage`: the suffix pool loses four
`+Level of all <other> Spell Skills` families (4 × 2,600), Flammability (4,000) and
Shock (4,000). That is 18,400 of 73,000 suffix weight (25 %), computed from the Wands
suffix totals in `data/weights.json`. Freeze Buildup and `+Level of all Cold Spell
Skills` stay. This agrees with the player report in the deferred entry. [S1][L1]

## Not affected

- **Foci.** The Focus damage prefixes add the tags, but their `spawn_weights` list
  `focus` (weight 1) *before* `no_E_spell_mods`, so the first match is always `focus`.
  Foci have no blocked suffix. [S1][S2][S3]
- **Jewels (Emerald, Ruby, Sapphire, Diamond).** Some jewel suffixes (Flammability,
  Freeze, Shock) add `no_*` tags, but no jewel mod has a `no_*` tag in its spawn weights.
  Jewel pools are therefore unchanged. This closes the jewel deferred entry with "no
  effect". [S1][S2]
- Corrupted and unique mods also add these tags. They are not in the crafted pools.

## Open points

- **Producer source not inspected.** It is not on this machine and not in the
  `dragsaw` GitHub repos. Item 3 comes from its output file, not its code.
- **Freshness.** The data is game patch 0.5.5.4.2 (export dated 2026-10-19). Re-check after
  each game patch; the set of families can change.
- **Contract shape is undecided.** Options: add per-tier `addsTags` and ordered
  `spawnTags`, or only the subset that touches `no_*`. This is an architect decision
  under AD-17 / `WEIGHTS-FILE-SCHEMA.md`, not a research finding.

## Sources

- [S1] RePoE-fork, PoE2 `mods.json`, version `0.5.5.4.2`, Last-Modified 2026-10-19,
  accessed 2026-10-23. https://repoe-fork.github.io/poe2/mods.json — extraction:
  `digests/repoe-poe2-no-tags-by-family.txt` (script `digests/summary.py`).
- [S2] poe2db, `/us/Wands`, `/us/Staves`, `/us/Foci`, `/us/Traps`, `/us/Emerald`,
  `/us/Ruby`, `/us/Sapphire`, `/us/Diamond`, accessed 2026-10-23. Per-mod `adds_no` and
  `spawn_no` arrays. Counts of mods with a `no_*` spawn tag: Wands 80, Staves 80,
  Foci 30 (all `focus`-first), Traps 55, each jewel 0.
- [S3] RePoE `docs/mods.md` (brather1ng/RePoE, master), accessed 2026-10-23: spawn
  weights "are evaluated in order, the first element with a tag … the item in question
  has is taken". Written for PoE1. The PoE2 fork uses the same format.
- [L1] Local: `data/weights.json` and
  `docs/architecture/architecture-poe-crafting-base-price-checker-2026-09-12/WEIGHTS-FILE-SCHEMA.md`
  at commit `1a4a4c9`.
