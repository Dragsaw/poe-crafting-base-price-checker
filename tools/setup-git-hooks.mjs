#!/usr/bin/env node
// Points git at `.githooks/` unless there is no git repository (tarball install, CI restore)
// or the developer already set core.hooksPath.

import { execFileSync } from 'node:child_process';

const HOOKS_PATH = '.githooks';

function git(arguments_) {
  // eslint-disable-next-line sonarjs/no-os-command-from-path -- boundary: git is resolved from PATH because its install location differs per platform and user, and this repo has no git resolver
  return execFileSync('git', arguments_, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
}

try {
  git(['rev-parse', '--is-inside-work-tree']);
} catch {
  process.exit(0);
}

let existing;
try {
  existing = git(['config', '--local', 'core.hooksPath']);
} catch {
  existing = '';
}

if (existing && existing !== HOOKS_PATH) {
  console.warn(`setup-git-hooks: core.hooksPath is already "${existing}"; leaving it as-is.`);
  process.exit(0);
}

git(['config', 'core.hooksPath', HOOKS_PATH]);
