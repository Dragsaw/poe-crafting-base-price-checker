<!-- bmad:context -->
<!-- Verified 2026-09-18 against a78aa9e. Managed by bmad-project-context; edits inside this block are replaced on refresh. Keep anything you want preserved outside the markers. -->

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

## Running and verifying

- Run Python scripts with `uv run script.py`, never bare `python`.

## Conventions that differ from defaults

- UI is Mantine v9 (`@mantine/core`, `@mantine/hooks`), pinned to 9.6.1 per the architecture spine's Stack table — don't install a different major version.

## Known pitfalls

- Cite `FR-n`/`AD-n` between `prd.md` and `ARCHITECTURE-SPINE.md` by stable id only — never restate the other document's mechanism, formula, or requirement text inline. A citation survives the source changing; a duplicated copy silently drifts (observed 2026-09-19: FR-14/17/19/20/23/27/32 had copied AD-7/8/12/19/20 mechanism verbatim, trimmed to one-line capability statements + citations).

<!-- /bmad:context -->
