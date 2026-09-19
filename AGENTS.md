<!-- bmad:context -->
<!-- Verified 2026-09-19 against d49fd8f3c9c2e4ba2f9b9e4561aee6e2388775d3. Managed by bmad-project-context; edits inside this block are replaced on refresh. Keep anything you want preserved outside the markers. -->

## poe-crafting-base-price-checker

PoE crafting base price checker. Pre-code: planning lives in `docs/` (PRD, architecture spine, UX designs, stories); no application source exists yet. Decided stack: pnpm workspaces, React 19, Vite, Mantine v9, Zod, Vitest, MSW — TypeScript, no Python in the product itself.

## Policy

- Bash commands run through a permission allowlist that only matches literal, single-line commands — an unresolvable command stops the run for a human prompt. Avoid command substitution (`$()`/backticks), variables, loops, and `export VAR=x cmd`.
- One command per call: no `&&`, `||`, `;`, or piping into a second program, unless the full pipeline is short and literal. Use separate calls instead.
- No `cd` prefix — the working directory is already the project root. No `git -C <path>` — run `git <command>` directly.
- For real logic (a loop, a conditional, string processing), write a script and run it as one literal command, e.g. `uv run script.py`.

## Where things are

- Architecture spine (canonical stack versions): `docs/architecture/architecture-poe-crafting-base-price-checker-2026-09-12/ARCHITECTURE-SPINE.md`
- Mantine docs for agents: https://mantine.dev/llms.txt
- UX design system: `docs/ux-designs/ux-poe-crafting-base-price-checker-2026-09-13/DESIGN.md` — impeccable auto-discovers only `PROJECT_ROOT/DESIGN.md`; pass `--target <path>` explicitly to use this file.

## Running and verifying

- Run Python scripts with `uv run script.py`, never bare `python`.

## Conventions that differ from defaults

- UI is Mantine v9 (`@mantine/core`, `@mantine/hooks`), pinned to 9.6.1 per the architecture spine's Stack table — don't install a different major version.

## Known pitfalls

- Every planning fact has exactly one owning document; write it there and cite it everywhere else by stable id (`FR-n`, `AD-n`, `OQ-n`, companion `§n`) — never restate the owner's text inline, because a citation survives the source changing and a copy silently drifts. Ownership:
  - `prd.md` owns *what the player gets and why*: capabilities, player-observable behaviour, scope, risks, metrics, product-owned numbers (e.g. top 20, 0.25 Divine default), and literal strings the UI prints (reason enums). Never mechanism — no formulas (FR-1's EV formula is the one exception), predicates, field names, file paths, schema versions, filter shapes, or revision narrative.
  - `ARCHITECTURE-SPINE.md` owns decisions (ADs) and spine-owned open questions; `IMPLEMENTATION-NOTES.md` owns formulas, predicates, report field identifiers, and error payloads; `WEIGHTS-FILE-SCHEMA.md` owns the weights contract and its version; `AGENT-WORKFLOW.md` owns command-level rules; UX `EXPERIENCE.md` owns view treatments (the PRD keeps the requirement, UX owns how it looks).
  - Rationale and rejected alternatives go to the PRD's `addendum.md`; revision history goes to `.memlog.md` and git, not into document bodies.
  - A spine change needs a PRD edit only if a capability, player-visible behaviour, scope boundary, product-owned number, or an OQ's owner changed. Retired-id retargets follow the spine's *Retired AD map* and are a citation sweep, not a PRD revision.
  - A review request to *add* mechanism to the PRD is a finding against the reviewer's brief; propose the citation instead.
  Observed 2026-09-19: ten of twelve PRD revisions were propagation of spine changes into copied mechanism, and ~79% of the PRD's ~407 normative rules duplicated the spine or a companion (see `docs/prds/prd-poe-crafting-base-price-checker-2026-09-12/handoff-phase1-architecture.md`).
- `PRODUCT.md` is a distillation of `docs/prds/prd-poe-crafting-base-price-checker-2026-09-12/prd.md`, not an independent source — refresh it when the PRD's user/positioning/constraint facts change. Nothing detects drift between them automatically.

<!-- /bmad:context -->

## Verifying a PRD change

Kept outside the managed block above on purpose, so a context refresh does not drop it.

- **Run `uv run _bmad/scripts/prd_gate.py` after any edit to `prd.md`, and as the first step of any PRD validation or review pass.** Exit code 1 on any FAIL. It is the only automated check that the PRD's citations still resolve against the live spine — `FR-n`, `NFR-n`, `UJ-n`, `AD-n`, `OQ-n` and `IMPLEMENTATION-NOTES.md §n` — and that the drift markers behind ten of twelve past revisions (contract version strings, revision narrative, stray code fences, an asymmetric assumptions index) have not returned.
- A spine or companion edit can break the PRD without touching it, so run the gate after those too.
- The word-count lines are reported, not enforced; only `FAIL` lines block.
