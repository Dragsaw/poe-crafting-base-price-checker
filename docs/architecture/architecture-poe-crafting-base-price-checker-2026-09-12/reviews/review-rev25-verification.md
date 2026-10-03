# Review — spine revision 25, verification lens

- **Target:** `ARCHITECTURE-SPINE.md` revision 25, `IMPLEMENTATION-NOTES.md` and
  `AGENT-WORKFLOW.md` (working-tree diff against `0197df7`, `git diff -- docs/architecture`)
- **Lens:** every factual claim the amendment makes about the existing project is checked
  against code and committed data, not against other documents.
- **Date:** 2026-10-03
- **Verdict:** **issues.** The data claims hold: CAP-4's count is 2792, no hybrid family spans
  two `modGroup`s, and the null-line rule matches the committed file. Four claims about
  existing behaviour are not true of the code. One rule (§12.1, which deletes the committed
  artifacts) rests on a premise that the committed data contradicts. One example in §5.1d is
  probably the local case that OQ-27 asks about, but the example labels it explicit.

Evidence came from reading `packages/{contracts,core,sync}/src`,
`.claude/skills/tracked-json/scripts/lookup.ts` and `WEIGHTS-FILE-SCHEMA.md`. A node script
also scanned `data/weights.json` (118 pools), `data/catalogue/stats.json`,
`data/tracked.json`, `data/dataset.json` and `data/sync-progress.json`.

## Claim table

| # | Claim (location) | Checked against | Result |
| --- | --- | --- | --- |
| C1 | `pnpm tracked:check` calls the same `core` cross-file functions and exits non-zero on a failure (spine 1382) | `packages/sync/src/curation/check.ts:189-202`, `:265` | **True.** It calls `crossFileChecks(entries, weights)` from `@poe/core` (the same function the sync gate calls). It returns 1 when `ok` is false. |
| C2 | Where weights are absent, "`core` returns the entry as unvalidated with the reason `weights-absent`, `pnpm tracked:check` prints it under that reason", "like the other five checks" (spine 1428-1433) | `packages/core/src/cross-file.ts:219-230`; `check.ts:189-193` | **False as a description of the present.** See F1. `crossFileChecks` returns `[]` when `weights === null`. `check.ts` does not call `core` at all in that case. It pushes one check-level `{check:'cross-file', status:'skipped'}` with no per-entry mark and no reason. No `unvalidated` concept exists anywhere in `packages/`. "Does not fail on it" is true, because `skipped` adds no issue. |
| C3 | `sync` carries the mark "in the existing `weights-absent` record" (spine 1431) | `packages/contracts/src/sync-run-report.ts:141-149`; `packages/sync/src/catalogue/weights-ids.ts:126-134`; `run-chunk.ts:748-755` | **True, at class granularity only.** The record exists and is emitted when the file is absent. Its only field is `uncheckableClassNames`, which holds the distinct `className`s of the non-pruned crafted entries. It names no entry and no check. That is enough if "carries it" means *its class is listed*. It is not enough if it means *the entry is marked*. |
| C4 | Dataset publishing already drops an entry whose key is no longer tracked (IMPL §12.1, 1407) | `packages/sync/src/chunk/publish-dataset.ts:9`, `:34-46`; test `run-chunk.test.ts:425` | **True.** `buildDatasetFile` iterates the tracked keys only. A previous entry with any other key is not carried. A test covers it. |
| C5 | `sync-progress.json` "does the same when it loads … ages out on the next write" (IMPL 1407-1409) | `contracts/src/sync-progress.ts:28-34`; `run-chunk.ts:521-528`, `:679-686`; `core/src/chunk-order.ts:101-138` | **True in effect, but the mechanism is wrong.** The load does not drop anything. `SyncProgressSchema.completed` is `z.string().min(1)[]`, so any key loads. The drop happens in `chunkOrder`, which keeps `completed ∩ rotationKeys`, and that filtered list is what `publish` writes. A key of a now-pinned entry is dropped too. No test was found that loads a progress file with an untracked key. The note states that test as a requirement, which is acceptable. |
| C6 | A file of an earlier major is refused (IMPL 1409-1410) | `contracts/src/schema-version.ts` `checkSchemaVersion`; `run-chunk.ts:521-528`, `:717-718` | **True.** Any major mismatch, older or newer, is `unknown-major`. For progress, the refusal is caught as `progressFault`. It is re-thrown after the lock, so **the run fails with a report** and is not skipped quietly. Deleting the file avoids this. |
| C7 | Current `schemaVersion`s | constants + `data/*.json` | tracked **1.0.0** (shared `SUPPORTED_SCHEMA_VERSION`), dataset **1.0.0** (shared constant, `publish-dataset.ts:50`), sync-progress **1.1.0** (`SYNC_PROGRESS_SCHEMA_VERSION`), sync-report **1.1.0** (`SYNC_REPORT_SCHEMA_VERSION`), weights **6.1.0**. The committed files agree. See F4 for what this means for the planned major bumps. |
| C8 | Null-line rule: a null line in a `complete` pool is not-in-game or internal; in a `partial` pool it may be a real stat (spine 1418-1426, IMPL §1 64-82) | `WEIGHTS-FILE-SCHEMA.md:32-45`, `:171`, `:284`; `data/weights.json` | **True.** The schema text matches. Data: 118 pools, **0 `partial`**. There are 16 null lines. 8 are `not-in-game`, `weight 0`, each the tier's only line. 8 are internal (`JewelRadiusLargerRadius` on the four Time-Lost jewels): `weightSource:"absent"`, `weight 1`, beside a valueless `explicit.stat_3891355829\|n` line. Every null line on a `weight>0` tier is internal, so on today's data the `partial` branch of `untrackable` never fires. |
| C9 | `stat_1509134228`, `stat_803737631`, `LightRadiusAndAccuracy`, `LocalIncreasedPhysicalDamagePercentAndAccuracyRating` on Bows (IMPL §5.1d 749-750) | `data/weights.json` `weapon.bow/Bows` | **They exist as described.** Bows prefix `LocalIncreasedPhysicalDamagePercentAndAccuracyRating` T1-T8 has lines `explicit.stat_1509134228` + `explicit.stat_803737631`. The T1 accuracy line is `[175,200]`. Bows suffix `LightRadiusAndAccuracy` T1-T3 has `explicit.stat_803737631` + `explicit.stat_1263695895`. Bows prefix `IncreasedAccuracy` T1-T10 has `explicit.stat_803737631` alone. **The "explicit" label is doubtful.** See F3. |
| C10 | `stat_803737631` local or explicit? | `data/catalogue/stats.json` | The catalogue lists `explicit.stat_803737631` = "# to Accuracy Rating" (global). It lists a **separate** `explicit.stat_691932474` = "# to Accuracy Rating (Local)". `weights.json` never uses `691932474`. It uses **none** of the 8 `(Local)` ids in the catalogue (Armour, Evasion, ES, Accuracy, Attack Speed, Block, …). Every `Local*`/`BaseLocal*` modGroup resolves to the global twin. |
| C11 | No hybrid family has contained tiers that span more than one `modGroup` (IMPL §2.7 "the committed data has no such family") | script over `weights.json` | **True.** There are 99 hybrid families keyed by (class, slot, sorted non-null line set), and 0 of them carry more than one `modGroup`. The reverse case does occur once: `Body_Armours_str_dex_int` prefix `BaseLocalDefences` holds pure and hybrid line sets under one `modGroup`. This is harmless to `mixedGroup`. |
| C12 | CAP-4: "none of the 2792 pure T1 and T2 tiers … intersects a hybrid tier's line on the same `statId`" (IMPL 390-392) | script, same slot pool, `weight>0` hybrid tiers, §1 interval rule | **True as counted.** There are 2792 tiers with label T1/T2 and exactly one non-null line (2784 if the 8 jewel tiers with internal null lines are excluded), and 0 intersect. **The conclusion drawn from it is too broad.** See F2. |
| C13 | `lineSet` reads only the weights file, "which is what lets `tracked:lookup`, `core` and the `sync` gate reach one verdict" (IMPL 79-81, spine 1418-1420) | `.claude/skills/tracked-json/scripts/lookup.ts:249-277` | **Not true of `lookup` today.** See F5. |
| C14 | Crafted entries with an absent affix are deleted, not converted (spine 75-81) | `data/tracked.json` | **No entry is affected today.** 205 entries, 201 crafted, **0** missing an affix. |
| C15 | AD-24's day-one state already makes every crafted class unrankable when the weights file is absent (spine 1432-1433) | `packages/core/src/rank.ts:84-89`, `:277-284` | **True.** `weights === null` gives the reason `class absent from weights file`. |

## Findings

### F1 — medium — spine 1428-1433: the `weights-absent` behaviour is described as current, but it is new work

The paragraph says the entry is marked unvalidated "like the other five checks". It says
`core` *returns* the entry as unvalidated with a reason, and `tracked:check` *prints* it
under that reason. None of the five checks marks anything today. `crossFileChecks` returns
`[]` for `null` weights. `tracked:check` reports one check-level `skipped`, and its header
comment (`check.ts:18-21`) still says "`core`'s five cross-file checks". The fix that the
paragraph implies needs three things: a new `core` return shape (failures **plus** unvalidated
entries with a reason), a new `CheckStatus`/output field in `check.ts`, and a decision on
whether the other five checks get the same per-entry mark.

**Fix:** remove "like the other five checks". State that the per-entry `unvalidated` mark
with reason `weights-absent` is new for all six checks, or limit it to "the check is
skipped, exactly as the other five are (`crossFileChecks` returns no failures,
`tracked:check` reports `cross-file: skipped`)". Then name `check.ts` and `cross-file.ts` as
the change sites.

### F2 — medium — IMPL §2.7 390-392: "a safety net on today's data" generalises from T1/T2 to every band

The CAP-4 count is right: 0 of 2792 pure T1/T2 tiers intersect a hybrid line. The same scan
over **all** 7877 pure `weight>0` tiers finds **342** that intersect a hybrid tier's line on
the same `statId` in the same slot pool. Examples: `IncreasedLife` 72,
`IncreasedAccuracy`/`stat_803737631` 84 (Bows `IncreasedAccuracy` T10 `[11,32]` against the
hybrid accuracy line `[21,46]`), `LocalPhysicalDamagePercent` 42 and `IncreasedMana` 37.
`incomplete` therefore fires in normal use for any band that reaches below T2, and for a
multi-tier band such as T1-T3 on these families. It is a live check and not only a safety net.

**Fix:** restrict the sentence: "none of the 2792 pure T1/T2 tiers … so for bands within
T1-T2 it is a safety net; 342 lower pure tiers do intersect, so the check rejects real bands
that reach them." Consider having `tracked:lookup` show the intersecting tiers.

### F3 — medium — IMPL §5.1d 749-750, spine OQ-27 2257-2264: the "explicit" capture example is probably the local case, and OQ-27 asks the wrong question

The modGroup is named `Local…AndAccuracyRating`. In game, the accuracy on a weapon prefix is
local. The catalogue has a distinct `explicit.stat_691932474` "# to Accuracy Rating (Local)".
`weights.json` files the Bows prefix accuracy (pure and hybrid) under the **global**
`stat_803737631`, the same id as the `LightRadiusAndAccuracy` suffix. More broadly,
`weights.json` contains **zero** `(Local)` ids, so every local line has been resolved to its
global twin. The three `statId`s that a class names in both slots are `stat_803737631`
(accuracy: helmets and 14 weapon classes), `stat_3917489142` (Rarity: Amulets, Rings,
helmets) and `stat_915769802` (Stun Threshold: boots and shields, a hybrid prefix plus a pure
suffix). If Trade indexes bow prefix accuracy under the `(Local)` id, the risk is not
"does Trade sum a local id". The risk is that the stored `statId` matches nothing on the
prefix side, and the sum only appears to work. That is AD-11's producer-resolution question
(owned outside this spine) as well as OQ-27.

**Fix:** use Rarity (Amulets/Rings) or helmet accuracy (`IncreasedAccuracy` prefix plus
`LightRadiusAndAccuracy` suffix) as case 1. Move the Bows example to case 2. Rewrite OQ-27
to ask whether a weapon/armour local line that `weights.json` files under a global id
matches that id on Trade at all, and note that the committed weights file contains no
`(Local)` id.

### F4 — high — IMPL §12.1 1398-1410: deleting the committed artifacts discards 186 priced observations, because a premise the committed data contradicts

§12.1 says the encoding change forces a major bump of `dataset`, `sync-progress` and
`sync-report`, and that the change deletes the three files. However:

1. **No committed key changes.** The banded and valueless forms are unchanged. Only the
   absent form `null` is withdrawn, and the hybrid form is added. `tracked.json` has 0 crafted
   entries with an absent affix, and `dataset.json`/`sync-progress.json` contain no key with a
   `null` affix. Every one of the 205 dataset keys and 37 progress keys is byte-identical
   under the new encoding.
2. `dataset.json` holds **186 `priced`** and 12 `no-listings` entries. Deleting it throws
   them away, and re-pricing costs budget. Between the commit and the player's next sync and
   push, `web` also has no `dataset.json`, which it classes `required`
   (`web/src/load/artifacts.ts:49`).
3. Keys are opaque `z.string()` in every artifact (`dataset.ts:63`, `sync-progress.ts:29`),
   and no code decodes them. A 1.x reader would accept hybrid key strings without error, so
   "a reader refuses an earlier major" protects nothing that the tracked-schema bump does not
   already protect.
4. The planned bumps cannot be made by editing a constant. tracked and dataset use the
   shared `SUPPORTED_SCHEMA_VERSION` (`'1.0.0'`), which config, recipes, catalogue and
   currencies also use. Every sync-side read of progress and report calls
   `parseEnvelope(schema, data)` with no `expected` (`run-chunk.ts:524`, `:538`, `:571`;
   `sync.ts:417`). Those reads default to `1.0.0`, so a `2.0.0` progress or report file
   written by the same build would be refused by that build.

**Fix:** drop the deletion and keep the files. Either do not bump the three artifact majors
(keys are opaque, the drop rule already removes stale keys, and the tracked major bump is
what refuses an old list), or bump with an in-place version rewrite. In either case, add to
§12.1 (or AGENT-WORKFLOW) that tracked and dataset need their own version constants, and
that every `parseEnvelope` call site for these files must pass `expected`.

### F5 — medium — IMPL §1 79-81: `tracked:lookup` does not reach the same verdict as `core`

`lookupMods` keys a family on `(modGroup, statIds)`. Its `statIds` are taken **in line
order** and **`null` is kept verbatim** (`lookup.ts:249-270`), and its comment says "More
than one means a hybrid". For the 8 Time-Lost jewel `JewelRadiusLargerRadius` tiers it
therefore reports `["explicit.stat_3891355829|n", null]` and presents them as hybrids.
Under §1's `lineSet` they are single-line tiers. `lookup` also does not import `core`, so
"one verdict" depends on a second implementation, which is the divergence AD-17 forbids.

**Fix:** list `lookup.ts` as a change site. It should call `core`'s `lineSet`/`untrackable`
(exported) rather than repeat them, key families on the sorted `lineSet`, and report
untrackable tiers with their reason.

### F6 — low — IMPL §12.1 1407-1409: the progress drop happens on the write path, not at load

`completed` loads any string. `chunkOrder` intersects it with the current rotation keys, and
`publish` writes the result. A run that aborts at a gate leaves the stale keys in place. That
is harmless, but it does not match "when it loads".

**Fix:** "`sync-progress.json` loads any key, and the next chunk's order (`chunkOrder`) keeps
only keys of current rotation entries, so a stale row is gone after the next write."

### Other observations (not in the diff)

- `AGENT-WORKFLOW.md:66` says `pnpm tracked:check` "lists under `pending`" some checks. The
  command has no `pending` output (`check.ts` statuses are `passed|failed|skipped`). This
  text predates rev 25, but rev 25 adds a sixth check whose skip behaviour this sentence
  would describe.
- `AGENT-WORKFLOW.md:94` still says "`ModifierWeight` follows weights contract `6.0.0`". The
  code is at `6.1.0`. This also predates rev 25.
- `IMPLEMENTATION-NOTES.md:219` (an edited line) keeps "because `5.0.0` carries no `kind`
  field". The fact is still true at `6.1.0`, but the version cited is stale.
- `CrossFileCheckSchema` (`sync-run-report.ts:162-168`) has 5 members. The sixth check
  needs a new enum value, so a `cross-file-gate-failure` record for line-set completeness
  is a schema change to `sync-report`. If F4's fix removes the major bump, this must be
  counted as at least a minor bump.
