import { readFileSync, readdirSync } from 'node:fs';
import nodePath from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

/**
 * AD-8: the trade client learns its rule names, its policy names and every
 * rate from live `X-Rate-Limit-*` headers. **No rule name, policy string or
 * rate constant may appear in non-test source.** An adapter that recognised
 * only the rule it was written against would silently stop pacing the day GGG
 * changed the rule set, and the failure would look exactly like success until
 * the account lost access.
 *
 * The measured 2026-09-12 buckets are an expected shape to assert a fixture
 * against, so a `*.test.ts` file may name them freely. This scan is what keeps
 * that distinction from eroding.
 */

const PACKAGES_DIR = fileURLToPath(new URL('../packages', import.meta.url));

interface Forbidden {
  readonly what: string;
  readonly pattern: RegExp;
}

const FORBIDDEN: readonly Forbidden[] = [
  {
    what: 'a trade-API policy name (it arrives in X-Rate-Limit-Policy)',
    pattern: /\btrade-[a-z]+-request-limit\b/gi,
  },
  {
    what: 'a per-rule rate-limit header (the rule name arrives in X-Rate-Limit-Rules)',
    pattern: /x-rate-limit-(?!rules\b|policy\b)[a-z]+/gi,
  },
  {
    what: 'a hits:seconds:penalty bucket literal (every bucket is read from a header)',
    pattern: /['"`]\s*\d+:\d+:\d+/g,
  },
  {
    what: 'a trade-API rule name spelled as a literal',
    pattern: /(['"`])(Ip|Client)\1/g,
  },
];

function sourceFilesUnder(directory: string): string[] {
  const found: string[] = [];
  const entries = readdirSync(directory, { withFileTypes: true });
  for (const entry of entries) {
    const path = nodePath.join(directory, entry.name);
    if (entry.isDirectory()) {
      found.push(...sourceFilesUnder(path));
      continue;
    }
    // A fixture and a test may both name what the live API returned.
    if (entry.name.endsWith('.test.ts') || entry.name.endsWith('.test.tsx')) {
      continue;
    }
    if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
      found.push(path);
    }
  }
  return found;
}

function packageSources(): string[] {
  const sources: string[] = [];
  const entries = readdirSync(PACKAGES_DIR, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    try {
      sources.push(...sourceFilesUnder(nodePath.join(PACKAGES_DIR, entry.name, 'src')));
    } catch {
      // A package with no `src` yet is not a failure.
      continue;
    }
  }
  return sources;
}

it('names no trade-API rule, policy or rate anywhere in non-test source', () => {
  const sources = packageSources();
  expect(sources.length).toBeGreaterThan(0);

  const offences: string[] = [];
  for (const path of sources) {
    const lines = readFileSync(path, 'utf8').split('\n');
    for (const [index, line] of lines.entries()) {
      for (const { what, pattern } of FORBIDDEN) {
        pattern.lastIndex = 0;
        if (pattern.test(line)) {
          offences.push(`${path}:${String(index + 1)} — ${what}\n    ${line.trim()}`);
        }
      }
    }
  }

  expect(offences, `learned at runtime, never compiled in:\n${offences.join('\n')}`).toEqual([]);
});

it('would catch a rule name, a policy string, a bucket and a per-rule header', () => {
  // The scan is only worth having if it fires. Each line below is what the
  // corresponding pattern exists to reject.
  const samples = [
    `const policy = 'trade-search-request-limit';`,
    `headers['x-rate-limit-ip'];`,
    `const buckets = '5:10:60,15:60:300';`,
    `if (rule.name === 'Ip') {`,
  ];

  expect(samples).toHaveLength(FORBIDDEN.length);
  for (const [index, sample] of samples.entries()) {
    const forbidden = FORBIDDEN[index];
    expect(forbidden).toBeDefined();
    if (forbidden === undefined) {
      continue;
    }
    forbidden.pattern.lastIndex = 0;
    expect(forbidden.pattern.test(sample), `${forbidden.what} did not match its own sample`).toBe(
      true,
    );
  }
});
