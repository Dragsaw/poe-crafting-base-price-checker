import { existsSync } from 'node:fs';
import path from 'node:path';

import { isInvokedDirectly } from '../entry-guard/is-invoked-directly.ts';
import { readStandardInput, run } from './lint-on-edit.ts';

// A Stop hook: typechecks once per agent turn instead of on every edit. Run by bare `node`.

/** Returns the `tsc -b` diagnostics as text, or an empty string when the build is clean. */
export type Typecheck = () => Promise<string>;

export interface StopResult {
  /** 2 blocks the stop and hands the report to the agent; 1 shows it to the user only. */
  readonly code: 0 | 1 | 2;
  readonly report: string;
}

/** True when the agent already continues because of a Stop hook. */
export function isRepeatStop(stdin: string): boolean {
  try {
    const parsed: unknown = JSON.parse(stdin);
    return typeof parsed === 'object' && parsed !== null && (parsed as { stop_hook_active?: unknown }).stop_hook_active === true;
  } catch {
    return false;
  }
}

/** A repeat stop with errors left does not block again, or an unfixable error would loop the agent. */
export async function runStopHook(stdin: string, typecheck: Typecheck): Promise<StopResult> {
  const output = await typecheck();
  const findings = output.trim();
  if (findings === '') {return { code: 0, report: '' };}
  const heading = 'typecheck-on-stop: `tsc -b` found errors. Fix them. `pnpm check` runs the full gate.';
  return { code: isRepeatStop(stdin) ? 1 : 2, report: `${heading}\n\n${findings}` };
}

/** `tsc -b` on the whole solution, then the `.d.ts` rewrite that `pnpm typecheck` runs. */
export function realTypecheck(root: string): Typecheck {
  const node = process.execPath;
  const rewrite = path.join(root, 'tools', 'dts-specifiers', 'rewrite-dts-specifiers.ts');
  return async () => {
    const result = await run(node, [path.join(root, 'node_modules', 'typescript', 'bin', 'tsc'), '-b', '--pretty', 'false'], root);
    if (existsSync(rewrite)) {await run(node, [rewrite], root);}
    return result.code === 0 ? '' : result.stdout + result.stderr;
  };
}

if (isInvokedDirectly(import.meta.url)) {
  try {
    const root = path.resolve(import.meta.dirname, '../..');
    const result = await runStopHook(await readStandardInput(), realTypecheck(root));
    if (result.report !== '') {process.stderr.write(`${result.report}\n`);}
    process.exitCode = result.code;
  } catch (error) {
    process.stderr.write(`typecheck-on-stop: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
