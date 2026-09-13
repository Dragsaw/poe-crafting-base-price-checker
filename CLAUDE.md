# poe-crafting-base-price-checker

## Shell command style

Bash commands are approved by static analysis of the command text. Anything the
parser can't resolve to a literal command line requires a human prompt, which
stalls the run. Keep every Bash call trivially analyzable:

- **No command substitution.** Never `$(...)` or backticks — this alone forces a
  prompt regardless of the allowlist.
- **No variables or loops.** No `$f`, no `for`/`while`, no `export VAR=x cmd`.
  Use the tool's own multi-argument form instead (`git check-ignore -v a b c`,
  `rm a b c`, `ls a b`).
- **One command per call.** No `&&`, `||`, `;`, or pipes into a second program
  unless the whole pipeline is literal and short. Prefer separate tool calls —
  they can run in parallel anyway.
- **No `cd` prefix.** The working directory is already the project root. Use
  paths relative to it.
- **Use the dedicated tools, not shell equivalents:** Read instead of `cat`,
  Grep instead of `grep`/`rg`, Glob instead of `find`/`ls -R`, Edit/Write
  instead of `sed -i`/`>` redirection.
- **If logic is genuinely needed** (a loop, conditionals, string munging), write
  a script into the scratchpad directory with Write, then run it as one literal
  command: `uv run <scratchpad>/check.py`. One approvable command, arbitrary
  logic inside.

## Python

Run Python through `uv`: `uv run script.py`. Never invoke bare `python`.

## UI

The UI is built with Mantine v9 (`@mantine/core` / `@mantine/hooks` 9.6.1, per
the architecture spine's Stack). Framework documentation for agents:
https://mantine.dev/llms.txt
