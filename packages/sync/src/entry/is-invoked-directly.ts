import { realpathSync } from 'node:fs';
import nodePath from 'node:path';
import { fileURLToPath } from 'node:url';

// Node realpaths the main module's URL but not `argv[1]`, so both sides are realpathed: a junction or `subst` path still runs.
export function isInvokedDirectly(moduleUrl: string): boolean {
  const entry = process.argv[1];
  if (entry === undefined) {
    return false;
  }
  try {
    return realpathSync(nodePath.resolve(entry)) === realpathSync(fileURLToPath(moduleUrl));
  } catch {
    return false;
  }
}
