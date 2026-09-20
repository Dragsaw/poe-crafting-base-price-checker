/**
 * `pnpm sync:dry` stub.
 *
 * AGENT-WORKFLOW.md reserves **stdout** as the report channel for the real dry
 * run, so this placeholder writes its notice to stderr and leaves stdout empty.
 * Story 1.5 replaces the body with the bounded chunk pipeline against fixtures.
 */
process.stderr.write('pnpm sync:dry: not implemented yet\n');

// `process.exitCode`, not `process.exit(1)`: when stderr is a pipe rather than a
// TTY the write is asynchronous, and an immediate exit truncates it. A pipe is
// exactly how an agent runtime captures this output.
process.exitCode = 1;
