# Reviewer Lens — Web-Verification / Currency Audit

**Spine:** `ARCHITECTURE-SPINE.md`, revision 17 (2026-09-20)
**Lens:** every committed decision must be web-researched or reality-checked, not asserted
from training data — current library/framework versions, that named tech still exists and
fits, and (greenfield) live starter defaults. Flag anything that could be stale and wasn't
confirmed.

**Method:** each Stack row and both TS-7 blockers re-verified live against the npm registry
(`registry.npmjs.org/<pkg>/latest`, cross-checked against jsdelivr/unpkg for source
inspection) on 2026-09-20. Live-API claims (trade2 endpoints, rate-limit headers) checked
for internal consistency against `.memlog.md`'s own capture records rather than re-hit live
(per instructions — GGG's undocumented trade API is not independently re-verifiable over the
web, and the captures are the user's own).

## Verdict: issues (two stale pins, otherwise clean)

Two Stack pins are one release behind current npm `latest` as of 2026-09-20. Everything
else pinned in the spine is exact-current, and both standing TypeScript-7 blockers were
re-confirmed live and still hold with no clearance in sight.

## What moved

| Item | Spine's pin | Verified current (2026-09-20) | Action |
| --- | --- | --- | --- |
| `dependency-cruiser` | `18.3.1` | `18.4.0` (registry `dist-tags.latest`) | Bump pin. Changelog for 18.4.0 is baseline-staleness reporting only (`err`/`err-html`/`markdown` reporters, `baseline.staleEntriesSeverity`, new `format` baseline mode) — **no change to `supportedTranspilers`**. Confirmed straight from `src/meta.cjs` in the published 18.4.0 tarball: `typescript: ">=2.0.0 <7.0.0"`, unchanged. The TS-7 blocker conclusion is unaffected; only the version number in the Stack table is stale. |
| `pnpm` | `12.4.2` | `12.5.1` (registry `dist-tags.latest`) | Bump pin. No investigation turned up a reason it was pinned below current (not a case like TypeScript where an older version is a deliberate hold). |

## Confirmed exact-current (no action)

| Item | Pin | Registry `latest` |
| --- | --- | --- |
| Node.js | 24.21.0 (Krypton LTS) | matches — active LTS line as of 2026-09-20; Node 26 enters LTS in October 2026, so no LTS move is due yet |
| React | 19.3.0 | 19.3.0 |
| Vite | 8.3.0 | 8.3.0 |
| Mantine (`@mantine/core`/`hooks`) | 9.6.1 | 9.6.1 (also the project's policy pin — no drift either way) |
| Zod | 4.6.5 | 4.6.5 (moved from the memlog's last-recorded 4.6.4 → this is already the rev-17 update, correctly current) |
| Vitest | 5.0.1 | 5.0.1 |
| MSW | 2.15.0 | 2.15.0 |
| ESLint | 10.11.0 | 10.11.0 |
| typescript-eslint | 8.70.0 | 8.70.0 |

## TypeScript 6 vs 7 — both blockers re-verified, still standing

- **TypeScript pin `6.0.3`** exists on the registry and is the newest published `6.0.x`
  (after `6.0.2`, `6.0.1-rc`). npm's `latest` dist-tag points at `7.0.2` — TS 7 is real and
  current — but the spine deliberately does not track `latest` here, and that choice still
  holds:
  - **`typescript-eslint@8.70.0`** (npm `latest`, confirmed) still declares
    `peerDependencies.typescript: ">=4.8.4 <6.1.0"` — pulled directly from the published
    package manifest, not a cached doc page. TS 6.0.3 is inside the range; TS 7.0.2 is not.
  - **`dependency-cruiser@18.4.0`** (npm `latest`, confirmed) still declares
    `supportedTranspilers.typescript: ">=2.0.0 <7.0.0"` — pulled directly from
    `src/meta.cjs` in the published tarball. TS 7.0.2 is excluded.
  - Both caps are therefore **unchanged and still block** a move to TS 7, exactly as the
    spine states. No clearance date is visible from either project.

  One caution for future revisions: a plain web search for dependency-cruiser's TypeScript
  cap surfaces stale, contradictory numbers — several indexed pages (blog posts, an old
  `--info` output example) report `<6.0.0`, which is wrong for any current release and
  appears to be leftover indexing of an older dependency-cruiser major. The only reliable
  source is the package's own shipped `src/meta.cjs`/`dist-tags`, not a search snippet or a
  cached doc page — worth a footnote in `AGENT-WORKFLOW.md` or a re-verification habit for
  whoever re-checks this next, since the wrong number would have been simple to copy in.

## Live-API claims — internal consistency only (not independently re-hit)

Per the assignment, GGG's undocumented `trade2` endpoints were **not** re-hit live; these
were the user's own captures, credited and dated in `.memlog.md` (2026-09-12, 2026-09-13,
2026-09-19, 2026-09-20). Checked instead for internal consistency and for any assumption
dressed as a measurement:

- Rate-limit header names (`X-Rate-Limit-Rules`, `X-Rate-Limit-<Name>`,
  `X-Rate-Limit-<Name>-State`) and the "parse at runtime, never hardcode a rule name" rule
  (AD-8) match GGG's own developer-docs description of the mechanism (publicly documented
  for the OAuth API; the spine is explicit that `trade2` itself is *undocumented* surface
  riding the same header convention, which is the correct level of confidence to claim, not
  overclaimed as documented behaviour). No contradiction found.
- `.memlog.md`'s entries are each labelled by kind — `VERIFIED`, `MEASURED`, `CORRECTED`,
  `SPIKE RESOLVED` — with a date and a method (live curl, live response headers). None reads
  as an assumption written up as a measurement; the one self-correction on record
  (`X-Rate-Limit-Client` "was wrong as an absolute", .memlog.md:94) is itself evidence the
  process catches this class of error rather than one it missed.
- Endpoint shapes cited in the spine (`/api/trade2/search/{realm}/{league}`,
  `/api/trade2/data/{leagues,filters,stats,items,static}`) all trace to a dated
  `VERIFIED`/`MEASURED` memlog entry and are cross-referenced consistently between
  `ARCHITECTURE-SPINE.md` and `IMPLEMENTATION-NOTES.md` (e.g. the `/data/stats` category-group
  shape correction at rev 9 / OQ-25's five-of-six discriminator measurement at rev 17). No
  drift between the two documents' descriptions of the same endpoint was found.
- GitHub Actions: the spine does not assert a specific job-time-limit number anywhere in the
  reviewed text (the only "6 hours" figure in the companion set is `staleLockAfter`, an
  unrelated `sync`-side design constant — `IMPLEMENTATION-NOTES.md:673`). GitHub's own current
  docs put the hosted-runner job ceiling at 6 hours (360 minutes, hard cap), which happens to
  equal that constant by coincidence, not by citation — worth flagging only so a future
  reader doesn't assume one was derived from the other.

## Bottom line

No named technology has been discontinued, deprecated, or replaced. No greenfield starter
defaults are in play here (this is a from-scratch pnpm workspace, not scaffolded from a
starter template), so that sub-check of the lens does not apply. The only findings are the
two one-release-behind pins (`dependency-cruiser` 18.3.1→18.4.0, `pnpm` 12.4.2→12.5.1), both
mechanical version bumps with no cascading consequence — the TS-7 blocker reasoning holds
unchanged under the newer `dependency-cruiser`.
