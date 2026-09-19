# poe-crafting-base-price-checker

@AGENTS.md

## Claude Code shell tool mapping

Use the dedicated tools below instead of their shell equivalents — the analyzer treats a tool call as one resolvable unit, so this avoids most permission prompts:

- Use Read instead of `cat`, `head`, `tail`.
- Use Grep instead of `grep` or `rg`.
- Use Glob instead of `find` or `ls -R`.
- Use Edit or Write instead of `sed -i` or `>` redirection.
- Never prefix a command with `cd` into the project root — Bash already starts there. `cd "E:\Program Files\Jetbrains\Projects\poe-crafting-base-price-checker" && ...` adds nothing and makes the command unresolvable, which stops the run for a human prompt. Use relative paths.
