/** `pnpm tracked:regenerate`: rewrites the active crafted entries of `data/tracked.json` from `core` (AD-3, AD-11). */

import { writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { isInvokedDirectly } from '../../../../tools/entry-guard/is-invoked-directly.ts';
import { createJsonReader, REPO_ROOT } from './lookup.ts';
import { loadWeights } from './lookup-weights.ts';
import { isTrackedFile, regenerateEntries } from './regenerate-entries.ts';

const TRACKED_PATH = 'data/tracked.json';

function main(): void {
  const read = createJsonReader(REPO_ROOT);
  const tracked = read(TRACKED_PATH);
  if (!isTrackedFile(tracked)) {
    throw new Error(`${TRACKED_PATH}: fails the contracts schema; run pnpm tracked:check`);
  }
  const { file, summary } = regenerateEntries(tracked, loadWeights(read));
  writeFileSync(nodePath.resolve(REPO_ROOT, TRACKED_PATH), `${JSON.stringify(file, undefined, 2)}\n`, { encoding: 'utf8' });
  process.stdout.write(`${JSON.stringify(summary, undefined, 2)}\n`);
}

if (isInvokedDirectly(import.meta.url)) {
  try {
    main();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`pnpm tracked:regenerate: ${message}\n`);
    process.exitCode = 1;
  }
}
