#!/usr/bin/env node
// Points git at `.githooks/` for this checkout, unless the checkout has no
// git repository (a tarball install, a manifest-only CI restore) or the
// developer already pointed core.hooksPath somewhere else.

import { execFileSync } from 'node:child_process';

const HOOKS_PATH = '.githooks';

function git(arguments_) {
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
