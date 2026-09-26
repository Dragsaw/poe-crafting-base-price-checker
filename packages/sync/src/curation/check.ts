/**
 * `pnpm tracked:check` — the check half of the tracked-json skill's loop
 * (lookup → edit → check).
 *
 * Read-only. It reads `data/tracked.json`, `data/config.json` and the
 * committed catalogue, runs the production validators over them, and prints
 * `{ok, checks, issues, pending}` as JSON to stdout. It writes no file and
 * issues no request. Exit 0 when every check passes, 1 otherwise.
 *
 * Three checks, each the production code a sync run uses:
 *
 * - `schema`: `TrackedFileSchema` through `parseEnvelope`, which includes the
 *   canonical-key uniqueness rule. One issue per schema issue.
 * - `pinned-cap`: `checkPinnedCap` against `config.minChunkSearches`
 *   (IMPLEMENTATION-NOTES.md §6).
 * - `catalogue`: AD-9 resolvability through `checkCatalogue` with an empty
 *   dataset. One issue per `records` entry.
 *
 * The five cross-file checks against `data/weights.json` are `core`'s and land
 * with Story 3.3. They are listed in `pending` and are not run here, so a pass
 * does not confirm band edges or floors.
 */

import { realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { canonicalKey, parseEnvelope, TrackedFileSchema } from '@poe/contracts';
import type { ConfigFile, FilesystemPort, TrackedEntry } from '@poe/contracts';

import { loadCatalogueIds } from '../catalogue/catalogue-ids.ts';
import type { CatalogueIds } from '../catalogue/catalogue-ids.ts';
import { checkCatalogue } from '../chunk/catalogue-check.ts';
import { TRACKED_PATH } from '../chunk/run-chunk.ts';
import { loadConfig } from '../load-config.ts';
import type { DataFileResult } from '../load-data-file.ts';
import { checkPinnedCap } from '../pinned-cap.ts';
import { createNodeFilesystemPort } from '../shell.ts';

export type CheckName = 'schema' | 'pinned-cap' | 'catalogue';

export interface CheckIssue {
  readonly check: CheckName;
  /** The issue's location inside `data/tracked.json`, such as `entries.3.prefix`, when it has one. */
  readonly path?: string;
  readonly message: string;
}

export interface CheckStatus {
  readonly check: CheckName;
  /** `skipped` when the schema check failed, so there are no entries to check. */
  readonly status: 'passed' | 'failed' | 'skipped';
}

export interface TrackedCheckReport {
  readonly ok: boolean;
  readonly checks: readonly CheckStatus[];
  readonly issues: readonly CheckIssue[];
  readonly pending: readonly string[];
}

/** The inputs of one check, as loaded. */
export interface TrackedCheckInputs {
  /** The text of `data/tracked.json`; `undefined` when the file is absent. */
  readonly tracked: string | undefined;
  readonly config: DataFileResult<ConfigFile>;
  readonly catalogue: DataFileResult<CatalogueIds>;
}

export const PENDING_CHECKS: readonly string[] = ['five cross-file checks (Story 3.3)'];

type SchemaResult =
  | { readonly ok: true; readonly entries: readonly TrackedEntry[] }
  | { readonly ok: false; readonly issues: CheckIssue[] };

function checkSchema(text: string | undefined): SchemaResult {
  if (text === undefined) {
    return { ok: false, issues: [{ check: 'schema', message: `${TRACKED_PATH}: the file is absent` }] };
  }
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (error) {
    return {
      ok: false,
      issues: [{ check: 'schema', message: `${TRACKED_PATH}: not valid JSON: ${String(error)}` }],
    };
  }
  const result = parseEnvelope(TrackedFileSchema, data);
  if (result.ok) {
    return { ok: true, entries: result.value.entries };
  }
  if (result.reason !== 'invalid') {
    return {
      ok: false,
      issues: [
        {
          check: 'schema',
          path: 'schemaVersion',
          message:
            `${TRACKED_PATH}: schemaVersion ${result.found} refused ` +
            `(${result.reason}; this build reads ${result.expected})`,
        },
      ],
    };
  }
  return {
    ok: false,
    issues: result.issues.map((issue) => ({
      check: 'schema',
      path: issue.path.map(String).join('.') || '(root)',
      message: issue.message,
    })),
  };
}

/** Pure: the loaded inputs in, the report out. */
export function checkTracked(loaded: TrackedCheckInputs): TrackedCheckReport {
  const checks: CheckStatus[] = [];
  const issues: CheckIssue[] = [];

  const schema = checkSchema(loaded.tracked);
  if (schema.ok) {
    checks.push({ check: 'schema', status: 'passed' });
  } else {
    checks.push({ check: 'schema', status: 'failed' });
    issues.push(...schema.issues);
  }
  const entries = schema.ok ? schema.entries : undefined;

  if (!loaded.config.ok) {
    checks.push({ check: 'pinned-cap', status: 'failed' });
    issues.push({ check: 'pinned-cap', message: loaded.config.error.message });
  } else if (entries === undefined) {
    checks.push({ check: 'pinned-cap', status: 'skipped' });
  } else {
    const cap = checkPinnedCap(entries, loaded.config.value);
    checks.push({ check: 'pinned-cap', status: cap.ok ? 'passed' : 'failed' });
    if (!cap.ok) {
      issues.push({ check: 'pinned-cap', message: cap.error.message });
    }
  }

  if (!loaded.catalogue.ok) {
    checks.push({ check: 'catalogue', status: 'failed' });
    issues.push({ check: 'catalogue', message: loaded.catalogue.error.message });
  } else if (entries === undefined) {
    checks.push({ check: 'catalogue', status: 'skipped' });
  } else {
    const indexByKey = new Map<string, number>();
    entries.forEach((entry, index) => {
      indexByKey.set(canonicalKey(entry), index);
    });
    const { records } = checkCatalogue(entries, [], loaded.catalogue.value);
    checks.push({ check: 'catalogue', status: records.length === 0 ? 'passed' : 'failed' });
    for (const record of records) {
      const index = indexByKey.get(record.entryKey);
      issues.push({
        check: 'catalogue',
        ...(index === undefined ? {} : { path: `entries.${String(index)}` }),
        message:
          `${record.identifierKind} ${record.identifier} is absent from the committed catalogue ` +
          `(entry ${record.entryKey})`,
      });
    }
  }

  return { ok: issues.length === 0, checks, issues, pending: PENDING_CHECKS };
}

/** Reads the three inputs through `fs`. Reads only; a refusal is carried as a value. */
export async function loadTrackedCheckInputs(fs: FilesystemPort): Promise<TrackedCheckInputs> {
  return {
    tracked: await fs.readTextFile(TRACKED_PATH),
    config: await loadConfig(fs),
    catalogue: await loadCatalogueIds(fs),
  };
}

/** `packages/sync/src/curation/` → the repository root. */
const REPO_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));

/**
 * The command over `fs`: prints the report to `out` and returns the exit code,
 * 0 on a pass and 1 on a failure. A usage error goes to `err` with the usage
 * line, and returns 1.
 */
export async function main(
  argv: readonly string[],
  fs: FilesystemPort,
  out: { write(text: string): unknown },
  err: { write(text: string): unknown },
): Promise<number> {
  try {
    // No arguments: any argument is a usage error.
    parseArgs({ args: [...argv], options: {}, strict: true, allowPositionals: false });
  } catch (error) {
    err.write(`pnpm tracked:check: ${String(error)}\nusage: pnpm tracked:check\n`);
    return 1;
  }
  const report = checkTracked(await loadTrackedCheckInputs(fs));
  out.write(`${JSON.stringify(report, null, 2)}\n`);
  return report.ok ? 0 : 1;
}

/**
 * Importing the module, as the co-located test does, runs nothing. Node
 * realpaths the main module's URL but not `argv[1]`, so both sides are
 * realpathed.
 */
function isInvokedDirectly(): boolean {
  const entry = process.argv[1];
  if (entry === undefined) {
    return false;
  }
  try {
    return realpathSync(resolve(entry)) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isInvokedDirectly()) {
  // `process.exitCode`, not `process.exit(1)`: an immediate exit truncates a
  // piped write.
  main(process.argv.slice(2), createNodeFilesystemPort(REPO_ROOT), process.stdout, process.stderr).then(
    (code) => {
      process.exitCode = code;
    },
    (error: unknown) => {
      process.stderr.write(`pnpm tracked:check: ${String(error)}\n`);
      process.exitCode = 1;
    },
  );
}
