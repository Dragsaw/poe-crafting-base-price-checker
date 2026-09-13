# poe-crafting-base-price-checker

## Shell command style

A static analyzer checks the text of each Bash command. If the analyzer cannot
resolve a command to one literal command line, it sends a prompt to a human.
This stops the run until a human answers. Write each Bash call so the
analyzer can resolve it easily:

- **Do not use command substitution.** Do not use `$(...)` or backticks.
  Either one forces a prompt, even if the allowlist approves the command.
- **Do not use variables or loops.** Do not use `$f`, `for`, `while`, or
  `export VAR=x cmd`. Instead, give the command multiple arguments directly,
  for example `git check-ignore -v a b c`, `rm a b c`, or `ls a b`.
- **Run one command per call.** Do not use `&&`, `||`, `;`, or a pipe into a
  second program, unless the full pipeline is short and literal. Use separate
  tool calls instead. These can run at the same time.
- **Do not add a `cd` prefix.** The working directory is already the project
  root. Use paths relative to this root.
- **Do not use `git -C <path>`.** The working directory is already the
  project root, so `-C` is not necessary. The allowlist does not recognize
  `-C`, so it forces a prompt to a human every time. Run `git <command>`
  directly instead.
- **Use the dedicated tools, not the equivalent shell commands.** Use Read
  instead of `cat`. Use Grep instead of `grep` or `rg`. Use Glob instead of
  `find` or `ls -R`. Use Edit or Write instead of `sed -i` or `>` redirection.
- **When you need real logic** — a loop, a conditional, or string
  processing — write a script to the scratchpad directory with Write. Then
  run the script as one literal command, for example
  `uv run <scratchpad>/check.py`. This gives one command for a human to
  approve, with any logic inside the script.

## Python

Run Python scripts through `uv`. Use `uv run script.py`. Do not run the bare
`python` command.

## UI

The UI uses Mantine v9. This includes `@mantine/core` and `@mantine/hooks`,
version 9.6.1, per the architecture spine's Stack component. Framework
documentation for agents is at this address: https://mantine.dev/llms.txt
