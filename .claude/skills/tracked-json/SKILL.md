---
name: tracked-json
description: Seed, add, change or remove entries in data/tracked.json, the curated list of crafted and raw bases that sync prices. Finds stat ids, base types, item classes, mods and tier bands with pnpm tracked:lookup, and checks the result with pnpm tracked:check. Use when asked to track a base or a mod combination, to edit or seed tracked.json, or when a player asks which mods are possible on an item class and wants to pick entries from them.
---

# tracked.json curation

You edit `data/tracked.json` in a loop: look up, edit, check. The two scripts print JSON to stdout. They only read.

- `pnpm tracked:lookup stat|base|class|mods|tiers ...` finds the ids and the tiers. Run it with no arguments to see the usage.
- `pnpm tracked:check` validates the file: the contracts schema, the pinned cap, catalogue resolvability and the five cross-file checks against `data/weights.json` (AD-17). It exits 0 when the file passes.

## Rules for all steps

- Never open `data/catalogue/*.json` or `data/weights.json` directly. Get every fact from `pnpm tracked:lookup`. You can read `data/tracked.json` directly.
- `data/tracked.json` is a hand-edited input. Edit it directly and report the edit as the AGENT-WORKFLOW rule for hand-edited inputs requires (`AGENT-WORKFLOW.md`, *Parallel worktrees*, the `data/` writer rule). Do not edit any other file in `data/`.
- The entry shapes, the two kinds and the canonical key are AD-5 and IMPLEMENTATION-NOTES §4.1. The contracts schema `TrackedFileSchema` is the reference for field names.
- The Accepted Tier rule, the band rule and the shared floor are FR-22 and AD-17. The floor derivation is IMPLEMENTATION-NOTES §8. How a tier's interval comes from its `ranges` is IMPLEMENTATION-NOTES §1. Apply those rules as they are written there. Do not restate them in the file or in your report.
- A crafted entry has at most one prefix and at most one suffix (AD-5).
- `tracked:lookup` derives nothing. `tiers` and `mods` print the weights data verbatim. You compute each band edge and the floor yourself, from the printed `ranges` and `itemLevelMin`, per §1 and §8.

## The loop

1. **Find the class.** `pnpm tracked:lookup class <query>` gives `{categoryId, categoryText, className}`. A crafted entry uses that `categoryId` and `className`. For a raw entry, find the base type with `pnpm tracked:lookup base <query>` and use its `type` as `baseTypeId`. Set `status` per AD-12 (FR-15): a new entry is `active` unless the player asks for `pinned`, which counts against the pinned cap that `tracked:check` enforces.
2. **Find the stat.** `pnpm tracked:lookup stat <query>` gives `{id, text, type}`. Use an `explicit.*` id for an affix. Output is capped at 50 matches. When `truncated` is not 0, use a narrower query.
3. **List the tiers.** `pnpm tracked:lookup tiers <statId> --class <className>` lists, per slot, each tier that carries the stat: `tierLabel`, `itemLevelMin`, `weight`, `modGroup` and the verbatim `lines`. If the class name is in more than one category, add `--category <categoryId>`. If `tiers` is empty, first confirm the id with `pnpm tracked:lookup stat <statId>`: an unknown or mistyped id also prints `tiers: []`. `stat` matches substrings, so the id resolves only when one match has an `id` exactly equal to `<statId>`. When the id does not resolve, fix it and go back to step 2. Only when the id resolves and the stat has no tier in the slot you want, the pair is not possible on this class. Tell the player. Do not write the entry.
4. **Write the reference.** When the stat's lines print `ranges: []`, the reference is `valueless` (AD-5, §1): write `kind: "valueless"` with no edges, and skip step 6. Otherwise choose the Accepted Tier per FR-22 and write a `banded` reference: `valueMin` and `valueMax` per FR-22 and §1. FR-22's default is tier 1; accept tier 2 instead only where tier 1 first appears at item level 81 or 82. On a hybrid tier, read the `ranges` of the line whose `statId` is the stat you track.
4b. **Check for a same-`statId` collision.** `ModifierRef` carries no `modGroup` (AD-5): a reference names a stat line, not a game modifier. Re-run `pnpm tracked:lookup tiers <statId> --class <className>` and scan every tier of every `modGroup` listed for that same `statId`. If any such tier's derived interval (§1) is not wholly outside your chosen band (i.e. it overlaps), tell the player before writing the entry: the trade search cannot tell the two modGroups apart, so listings from the other modGroup's tier will surface too. Let the player decide whether to proceed, narrow to a different pick, or drop it.
5. **Write the floor.** Derive `itemLevelMin` per §8 and AD-17. Read every other crafted entry on the same class in `data/tracked.json` first, including any you are adding in this same batch. The floor is one number: the max over **every** crafted entry on the class, old and new, not a per-entry figure. When the derived floor changes, write it on all of them and say so in the report. A raw entry takes no part in §8: its `itemLevelMin` is the Raw Base item level of the PRD glossary (FR-3).
6. **Write the label.** Set `acceptedTier` to the tier label of the band per AD-5, for example `T1` or `T1-T2`.
7. **Check.** Run `pnpm tracked:check`. On `ok: false`, fix each item in `issues` (`check`, `path`, `message`) and run it again until it exits 0.
8. **Report.** Name the file, each change (which entries you added, changed or removed, with the band, the tier label and the floor), and the reason for each change. A pass does not confirm that a floor is the one §8 derives: a floor declared too high passes every check (AD-5), so state how you derived each floor.

## Changing or removing an entry

- To remove an entry, set its `status` to the `pruned` tombstone that the spine defines (AD-12), with its reason. Do not delete the entry.
- After you add, change or remove a crafted entry, re-derive the floor for every other crafted entry on that class (loop step 5). A change or a removal can move the class's shared floor (§8, AD-17).
- Then do steps 7 to 8 of the loop.

## Interactive mode

Use this mode when the player asks which mods are possible ("show me which mods are possible", "what can I craft on ...") and wants to choose. Offer each choice as a short numbered list of plain text, never the question-asking tool: mod counts routinely exceed that tool's 4-option limit. Wait for the player's answer after each step. Do not choose for the player.

1. **Offer the classes.** Run `pnpm tracked:lookup class <query>`. Use the player's words as the query, or `""` to list every class. Read `data/tracked.json` and mark each class that already has a crafted entry. The player picks a class.
2. **Offer the prefixes.** Run `pnpm tracked:lookup mods --class <className> --slot prefix`. Show each row's `text`, `tierCount` and `tierLabels`. A hybrid is one row with more than one `statIds` entry. Show it as one choice. Rows that share a `modGroup` are separate mod families; show each one. Leave out a row whose `statIds` holds `null`: it cannot be written as a reference (`StatIdSchema`). The player picks zero or more prefixes.
3. **Offer the suffixes.** Run `pnpm tracked:lookup mods --class <className> --slot suffix` and show it the same way. The player picks zero or more suffixes.
4. **Ask the pairing question** when the player picked more than one prefix or more than one suffix. A crafted entry holds at most one prefix and one suffix (AD-5). Ask whether to write one entry for each prefix × suffix pair, or one single-affix entry for each pick. State the entry count of each answer, for example "2 prefixes × 3 suffixes: 6 pair entries, or 5 single-affix entries". Do not choose a default. When the player picked one prefix and one suffix, the draft is one pair entry. When the player picked one mod in total, the draft is one single-affix entry. When the player picked none, write nothing and say so.
5. **Suggest the bands.** For each pick, run `pnpm tracked:lookup tiers <statId> --class <className>`. For a hybrid pick, use the statId that the player wants to chase, and ask when that is not clear. Suggest the reference and the floor per steps 4 to 5 (including 4b's collision check) of the loop, with the FR-22 Accepted Tier as the default suggestion for a band.
6. **Show the draft.** Show each entry exactly as it will be written in `data/tracked.json`. Show the shared floor as one number derived across every drafted entry plus every existing entry on the class (loop step 5), and any existing entry whose floor changes. Wait for the player to confirm. If the player changes something, show the new draft and wait again. **Do not edit `data/tracked.json` before the player confirms.**
7. **Edit, check and report.** Write the confirmed entries. Then do steps 7 to 8 of the loop.
