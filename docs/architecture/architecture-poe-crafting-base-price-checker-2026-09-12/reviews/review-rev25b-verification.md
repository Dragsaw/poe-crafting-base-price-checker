# Review — spine revision 25, verification lens (pass b)

- **Subject:** `git diff HEAD -- docs/architecture/architecture-poe-crafting-base-price-checker-2026-09-12/` (spine rev 25, `IMPLEMENTATION-NOTES.md`, `AGENT-WORKFLOW.md`) and the companions they cite.
- **Question:** was each committed decision checked against the repository, the data and the trade API, or only asserted?
- **Date:** 2026-10-03
- **Method:** I read the code that each claim names. I ran `pnpm tracked:check` on the committed data. I recomputed the data counts with a throwaway script over `data/weights.json`, `data/catalogue/stats.json`, `data/tracked.json` and `data/dataset.json`. The script uses the §1 `interval` and the `lineSet` rule that drops `null` lines. I made no request to the trade API.

## Verdict

Most of the rev-25 claims are true. Every claim about the existing code and every count in IN §2.7 checks out. One sentence about data is false (V-2). The open question about the trade API, OQ-27, is marked unverified correctly, but it is scoped too narrowly. The committed `data/tracked.json` already fails the cross-file gate because of the local/global stat-id split that OQ-27 calls a future risk (V-1). Rev 25 adds no technology and no library version.

## Findings

| Id | Severity | Finding | Fix |
| --- | --- | --- | --- |
| V-1 | **High** | OQ-27 underrates its own blocker. The tracked list fails today, with or without summed filters. | Widen OQ-27 to every filter on a local line, and make it block the current tracked list. |
| V-2 | Medium | IN §1 says "the eight Time-Lost **Diamond** `JewelRadiusLargerRadius` tiers". That is false. | Say "eight tiers across the four Time-Lost jewel classes". |
| V-3 | Medium | Only manual observation supports the summed premise for *explicit* ids. No OQ owns it and no blocking status covers it. AD-16 opens by stating it as fact. | Make OQ-27 (or a sibling OQ) own both halves, and mark explicit summed prices provisional too. |
| V-4 | Low | IN §2.8 and AW describe a per-entry `weights-absent` result in the present tense. `core` today returns `[]`, and the change alters a return type that has three callers. | Name the return-shape change, its three callers, and the rule that the gate must not abort on a mark. |
| V-5 | Low | IN §1 adds an `unvalidated`/`partial-pool` reason. Today's `core` never runs a pool check on a class that has a `partial` slot, and the committed file has 0 partial pools. | State whether pool checks now run on partial classes. If they do not, scope the branch to `tracked:lookup` only. |
| V-6 | Low | "The catalogue's eight `(Local)` ids" is true only for `explicit.*`. | Say "eight `explicit.*` `(Local)` ids". |
| V-7 | Low | IN §12.1 says each bumped file "needs its own version constant". Progress and report already have constants. Only their reads omit them. | Reword: tracked and dataset need constants, and all four reads must pass `expected`. |
| V-8 | Low (adjacent, pre-existing) | AW still says `ModifierWeight` "follows weights contract `6.0.0`". The rev-25 kind-agreement row and IN §2.3 still say "`5.0.0` has no `kind` field". Code and data are `6.1.0`. | Cite `6.1.0`, or "the weights contract carries no `kind` field". |

### V-1 — High: OQ-27's local/global split already breaks the committed tracked list

OQ-27 says that `weights.json` files every local line under its global twin's `statId`. It says that a filter on such a line "matches nothing or the wrong population". It then classes the question as *"Blocking for trusting a summed price on a local stat, not for building."* The repository shows that the problem is broader than that and already present:

- `data/tracked.json` at `HEAD` (`0197df7 chore: update tracked`) has **13 crafted entries** whose suffix is `explicit.stat_210067635`, *"#% increased Attack Speed (Local)"*. They are on Bows, Crossbows and Emerald.
- `data/weights.json` files that attack-speed line under the global `explicit.stat_681332047` for all three classes. The local id appears nowhere in it.
- `pnpm tracked:check` exits 1 today, with **13 `empty-containment-set` failures, all on `stat_210067635`**. The `sync` run-start gate calls the same `crossFileChecks` (`packages/sync/src/chunk/cross-file-gate.ts`), so a run on this list aborts.
- On the Emerald jewel, attack speed is not a local stat in game. The local id therefore probably matches nothing there. This is the "matches nothing" case that OQ-27 calls hypothetical.

**Why it matters:** the curator used the trade id because that id finds the weapon line. The weights file uses the global twin. AD-17 refuses the first choice, and OQ-27 says the second choice may match nothing. The decision is therefore not only "is a summed local filter trustworthy". It is also "which id does a tracked line on a local stat carry, and how does containment match it to the weights line". That is a mapping decision under AD-5/AD-11, and it blocks single-line entries now.

**Fix:** retitle OQ-27, or add a sibling OQ, to cover *any* trade filter on a local line. Mark it blocking for the current `tracked.json`, and cite the 13 failures. Either decide on a local→global mapping (a contract rule, with an owner) or tell the curator to remove those entries until the §5.1d capture lands.

### V-2 — Medium: the Time-Lost tier count names the wrong class

IN §1 says that `tracked:lookup` "reports the eight Time-Lost Diamond `JewelRadiusLargerRadius` tiers as hybrids". In `data/weights.json` the 8 tiers are spread over **four** classes, two tiers each ("Upgrades Radius to Medium" and "to Large"): `Time-Lost_Diamond`, `Time-Lost_Emerald`, `Time-Lost_Ruby` and `Time-Lost_Sapphire`. Each tier carries `[explicit.stat_3891355829|n, null]`, with `weight` 1 and `weightSource: absent`. The rest of the claim is true. `lookupMods` builds `statIds` as `[...new Set(entry.lines.map(l => l.statId))]` and keeps `null`. Its doc comment says that more than one id "means a hybrid". `lookup.ts` imports only `@poe/contracts`. The 8 tiers also agree with the "8 lines are internal" note in WFS `6.1.0`.

### V-3 — Medium: the explicit-id sum has no owner and no blocking status

AD-16 opens with an unqualified statement: *"The trade site sums one `statId` across the item's mods."* The next sentences qualify it ("rests on a manual observation until the capture … lands"). OQ-27, however, asks only about local ids. Its close condition needs both captures, but its blocking scope covers only "a summed price on a local stat". So a summed price on an explicit id, such as Amulets rarity, is in practice treated as trusted before any capture exists. The cited AD-16 consequences take the sum as given: IN §2.1 consequence 4, the within-file refusals in §2.3, and the accepted wider population in §5.5. That is acceptable only while the premise has an owner.

There is **corroborating evidence in the repository** that rev 25 does not cite. `data/tracked.json` already holds a same-`statId` entry: Amulets, prefix and suffix both `explicit.stat_3917489142`, bands `[16, 19]` and `[15, 18]`. Today's code sends two per-slot filters for it. `data/dataset.json` prices that entry at **0.002 Divine, sample 10**, and keeps its `lastSearchId`. If the trade site sums, both filters compare a sum. A two-slot item sums to ≥ 31 and fails both maxima, so only single-slot items with a roll of 16–18 match. Such items are cheap, and that agrees with the observed price. This evidence fits the premise but does not prove it. Under rev 25's own rule (§12.1), the entry is also mispriced today.

**Fix:** make one OQ own both halves of the premise (explicit and local). Say that a summed price on any id stays provisional until §5.1d item 1 lands. Cite the Amulets rarity dataset entry and its stored search id as the observed instance and as a cheap first capture target.

### V-4 — Low: the `weights-absent` per-entry mark is written as if it exists

- `crossFileChecks` (`packages/core/src/cross-file.ts`) returns `CrossFileFailure[]`, and it returns `[]` when `weights === null`.
- `pnpm tracked:check` (`packages/sync/src/curation/check.ts`) reports only `cross-file: skipped` and lists no entries. The claim that it "exits non-zero on a failure" and calls the same `core` function is **true**.
- The `sync` record stays class-level: `WeightsAbsentRecordSchema.uncheckableClassNames`. IN §2.8 says so correctly.

AW's sentence ("it lists each crafted entry marked `weights-absent`") and IN §2.8 ("`core`'s cross-file result names each crafted entry") are in the present tense, but each one describes a change. The change widens the return type that `web` (`App.tsx`), the `sync` gate and `tracked:check` all read. If the gate counts every element as a failure, an unvalidated mark aborts a run on a day-one install. **Fix:** state the new result shape (failures plus unvalidated marks), list the three callers, and add the rule that the gate aborts only on failures.

### V-5 — Low: the `partial-pool` branch has no path through today's code

`crossFileChecks` skips every pool check when either slot of a class is `partial` (`isPoolCheckable`). Only class discriminability still runs. In the committed file, **0 of 59 classes** have a partial slot. IN §1's rule, *"a §2.4, §2.5 or §2.7 verdict that turns on excluding an untrackable tier is reported as unvalidated with reason `partial-pool`"*, therefore needs one of two things. Either pool checks start to run on partial classes, which IN does not say, or the rule is dead outside `tracked:lookup`. **Fix:** state which of the two applies.

### V-6 — Low: the count of `(Local)` ids

`data/catalogue/stats.json` holds **40** `(Local)` entries. They cover 8 `explicit.*` ids (ES, Evasion, Accuracy, Evasion %, Armour, Armour %, Attack Speed, Block) plus their fractured, crafted, enchant, rune and desecrated copies, and one `implicit` (Culling Strike). "Eight" is correct for `explicit.*` only. The claim that `weights.json` contains none of them is **true**. The "global twin" claim held at each of three sample points: bow accuracy uses `803737631`, bow attack speed uses `681332047`, and body-armour evasion % uses `2106365538`. "Every local line" is an extrapolation from these samples.

### V-7 — Low: version constants in §12.1

`SYNC_PROGRESS_SCHEMA_VERSION` and `SYNC_REPORT_SCHEMA_VERSION` (`'1.1.0'`) already exist in `contracts`. The defect is narrower than IN says: `run-chunk.ts` and `sync.ts` call `parseEnvelope` on progress and report with no `expected`, so the default `SUPPORTED_SCHEMA_VERSION` is used. Tracked and dataset do use the shared constant, and so do config, currencies, recipes and the catalogue reads, which agrees with "other files also use". The behaviour IN describes is correct, but the remedy it names is partly done already.

### V-8 — Low (adjacent): stale weights-contract version citations

`packages/contracts/src/weights-file.ts` has `WEIGHTS_SCHEMA_VERSION = '6.1.0'`, and `data/weights.json` is `6.1.0`. AW §*Build `contracts` first* still says `6.0.0`. The kind-agreement row that rev 25 rewrote, and IN §2.3, still give `5.0.0` as the reason that no `kind` field exists. The statements are still true, but the version cited is stale. IN §1 is the only rev-25 text that cites `6.1.0` correctly.

## Claims verified true

| Claim | Evidence |
| --- | --- |
| `tracked:lookup` keeps a `null` `statId` in a line set and does not import `core` | `.claude/skills/tracked-json/scripts/lookup.ts` L25, L269 |
| `tracked:check` calls `core`'s `crossFileChecks`, exits 1 on a failure, and marks `cross-file` skipped when weights are absent | `packages/sync/src/curation/check.ts` L34, L177–192, L243 |
| `CrossFileCheckSchema` has the five values and no `line-set-completeness` value | `packages/contracts/src/sync-run-report.ts` L162–168 |
| The `weights-absent` record is class-level | `WeightsAbsentRecordSchema.uncheckableClassNames` |
| A §12 `cross-file-gate-failure` record carries a `check` subject field | `CrossFileGateFailureRecordSchema` |
| Weights contract `6.1.0`: a `null` line in a complete pool is internal or not-in-game | WFS §6.1.0; the data has 8 internal lines (weight 1) and 8 not-in-game tiers (weight 0) |
| No partial pool in the committed file | 0 of 59 classes |
| 2,792 pure T1/T2 tiers, none intersecting a hybrid line on the same `statId` | recomputed: 2,792 / 0 |
| 342 of 7,877 pure `weight > 0` tiers intersect a hybrid line; examples are life, accuracy and % physical | recomputed: 342 / 7,877; top ids `803737631` (84), `3299347043` (72), `1509134228` (42) |
| The committed data has no hybrid family spread over more than one `modGroup` | recomputed: 0 |
| The Bows hybrid prefix is `LocalIncreasedPhysicalDamagePercentAndAccuracyRating` and is filed under global accuracy `stat_803737631` | true; Crossbows have it too |
| `explicit.stat_691932474` is *"# to Accuracy Rating (Local)"* and is absent from weights | true |
| Rarity `stat_3917489142` rolls in both slots of Amulets and Rings; helmet accuracy rolls in both slots | true, for all 6 helmet classes |
| `dataset.json` drops keys that are no longer tracked when it publishes | `publish-dataset.ts` header |
| Progress loads foreign keys and drops them on write | `chunk-order.ts` L128–137 filters `completed` to rotation keys |
| `SUPPORTED_SCHEMA_VERSION` is shared, and the progress and report reads pass no `expected` | `schema-version.ts`, `run-chunk.ts` L524/538/571, `sync.ts` L417 |
| "Both affixes required" needs no change to content | `data/tracked.json` has 0 crafted entries with one affix (201 crafted, 4 raw); only the `schemaVersion` bump applies |
| `prd.md` FR-34 and `SPEC-tracked-hybrid-mods` CAP-1 exist; OQ-27 is a new id | true |
| No new technology or library version | the diff changes no Stack row; every version in the diff is a data-contract version |

## The trade-API premise: marked correctly?

Mostly yes. AD-16, OQ-27 and IN §5.1d all say that the sum rests on a manual observation until the capture lands. `prd.md` FR-34 defers to OQ-27. IN §5.1d says "No capture is recorded yet". The gaps are V-3: the opening sentence of AD-16 is unqualified, and nothing owns the explicit-id half. V-1 is a further gap: the local half is broader than the OQ's blocking scope.
