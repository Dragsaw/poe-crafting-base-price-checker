import { readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { ConfigFileSchema, CurrenciesFileSchema, parseEnvelope } from '@poe/contracts';
import type { z } from 'zod';

import { isInvokedDirectly } from '../entry-guard/is-invoked-directly.ts';
import {
  currenciesUrl,
  leagueSlug,
  planRates,
  type Poe2ScoutItem,
  Poe2ScoutPageSchema,
  secondPrecisionIso,
  serialiseCurrencies,
} from './plan.ts';

const PROGRAM = 'currencies:refresh';
const USAGE = `usage: pnpm ${PROGRAM}\n`;
// A guard against a response whose page counter never reaches `Pages`.
const MAX_PAGES = 50;
const FETCH_TIMEOUT_MS = 30_000;

export interface Output {
  write(text: string): unknown;
}

export interface RefreshOptions {
  readonly dataDirectory: string;
  readonly now: () => Date;
  readonly out: Output;
  readonly error: Output;
}

type Result<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: string };

function describeIssues(issues: readonly z.core.$ZodIssue[]): string {
  return issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`).join('; ');
}

function readEnvelope<S extends z.ZodType>(schema: S, path: string): Result<z.infer<S>> {
  let data: unknown;
  try {
    data = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    return { ok: false, error: `cannot read ${path}: ${String(error)}` };
  }
  const parsed = parseEnvelope(schema, data);
  if (parsed.ok) {
    return { ok: true, value: parsed.value };
  }
  const detail = parsed.reason === 'invalid' ? describeIssues(parsed.issues) : `${parsed.reason} schemaVersion`;
  return { ok: false, error: `${path} is invalid: ${detail}` };
}

type Page = z.infer<typeof Poe2ScoutPageSchema>;

async function fetchPage(slug: string, page: number): Promise<Result<Page>> {
  const url = currenciesUrl(slug, page);
  let response: Response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  } catch (error) {
    return { ok: false, error: `GET ${url} failed: ${String(error)}` };
  }
  if (!response.ok) {
    return {
      ok: false,
      error: `GET ${url} returned HTTP ${String(response.status)}; the league slug "${slug}" must match a poe2scout league id`,
    };
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch (error) {
    return { ok: false, error: `GET ${url} returned a body that is not JSON: ${String(error)}` };
  }
  const parsed = Poe2ScoutPageSchema.safeParse(body);
  return parsed.success
    ? { ok: true, value: parsed.data }
    : { ok: false, error: `GET ${url} failed the response schema: ${describeIssues(parsed.error.issues)}` };
}

// Pages are fetched one after another, each only once the previous one says more remain.
async function fetchItems(slug: string, page = 1, items: readonly Poe2ScoutItem[] = []): Promise<Result<Poe2ScoutItem[]>> {
  if (page > MAX_PAGES) {
    return { ok: false, error: `the response did not end within ${String(MAX_PAGES)} pages` };
  }
  const result = await fetchPage(slug, page);
  if (!result.ok) {
    return result;
  }
  const merged = [...items, ...result.value.Items];
  return result.value.CurrentPage >= result.value.Pages ? { ok: true, value: merged } : fetchItems(slug, page + 1, merged);
}

export async function refreshCurrencies(options: RefreshOptions): Promise<number> {
  const { dataDirectory, now, out, error: error_ } = options;
  const fail = (message: string): number => {
    error_.write(`${PROGRAM}: ${message}\n`);
    return 1;
  };

  const config = readEnvelope(ConfigFileSchema, nodePath.join(dataDirectory, 'config.json'));
  if (!config.ok) {
    return fail(config.error);
  }
  const currenciesPath = nodePath.join(dataDirectory, 'currencies.json');
  const currencies = readEnvelope(CurrenciesFileSchema, currenciesPath);
  if (!currencies.ok) {
    return fail(currencies.error);
  }

  const { league } = config.value;
  const items = await fetchItems(leagueSlug(league));
  if (!items.ok) {
    return fail(items.error);
  }

  const plan = planRates(currencies.value, items.value, league, secondPrecisionIso(now()));
  if (!plan.ok) {
    return fail(plan.error);
  }
  const checked = parseEnvelope(CurrenciesFileSchema, plan.file);
  if (!checked.ok) {
    const detail = checked.reason === 'invalid' ? describeIssues(checked.issues) : checked.reason;
    return fail(`the planned file fails CurrenciesFileSchema: ${detail}`);
  }

  // A sibling temp file renamed into place: a failed write never leaves a truncated target.
  const temporaryPath = `${currenciesPath}.tmp`;
  try {
    writeFileSync(temporaryPath, serialiseCurrencies(checked.value));
    renameSync(temporaryPath, currenciesPath);
  } catch (error) {
    rmSync(temporaryPath, { force: true });
    return fail(`cannot write ${currenciesPath}: ${String(error)}`);
  }
  for (const warning of plan.warnings) {
    error_.write(`${PROGRAM}: warning: ${warning}\n`);
  }
  out.write(`${PROGRAM}: wrote ${String(plan.written)} rates to ${currenciesPath}\n`);
  return 0;
}

const DEFAULT_DATA_DIRECTORY = nodePath.resolve(nodePath.dirname(fileURLToPath(import.meta.url)), '../../data');

if (isInvokedDirectly(import.meta.url)) {
  try {
    parseArgs({ args: process.argv.slice(2), options: {}, strict: true });
    // `process.exitCode`, not `process.exit(1)`: an immediate exit truncates a piped write.
    process.exitCode = await refreshCurrencies({
      dataDirectory: DEFAULT_DATA_DIRECTORY,
      now: () => new Date(),
      out: process.stdout,
      error: process.stderr,
    });
  } catch (error) {
    process.stderr.write(`${PROGRAM}: ${String(error)}\n${USAGE}`);
    process.exitCode = 1;
  }
}
