import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

/**
 * AD-1: no `core` module performs I/O, reads the clock, generates randomness,
 * or reads environment or config. dependency-cruiser sees imports only, so the
 * shipped ESLint config carries a `core`-scoped block that bans the impure
 * globals. These probes lint snippets through that config and prove each ban
 * fires, and that the pure uses `core` depends on stay legal.
 */
const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));

const GLOBALS = 'no-restricted-globals';
const PROPERTIES = 'no-restricted-properties';
const SYNTAX = 'no-restricted-syntax';
type PurityRule = typeof GLOBALS | typeof PROPERTIES | typeof SYNTAX;
const PURITY_RULES: ReadonlySet<string> = new Set([GLOBALS, PROPERTIES, SYNTAX]);

const CORE_FILE = 'packages/core/src/purity-probe.ts';
const CORE_TEST_FILE = 'packages/core/src/purity-probe.test.ts';
const SYNC_FILE = 'packages/sync/src/purity-probe.ts';

const eslint = new ESLint({ cwd: REPO_ROOT });

interface PurityError {
  readonly ruleId: string;
  readonly message: string;
}

async function purityErrors(code: string, filePath: string): Promise<PurityError[]> {
  const [result] = await eslint.lintText(code, { filePath });
  expect(result, `${filePath} produced no lint result`).toBeDefined();
  const messages = result?.messages ?? [];
  // A parse failure or an ignored path would make every "no error" assertion vacuous.
  expect(messages.filter((message) => message.fatal === true)).toEqual([]);
  return messages
    .filter((message) => message.severity === 2 && message.ruleId !== null && PURITY_RULES.has(message.ruleId))
    .map((message) => ({ ruleId: message.ruleId as string, message: message.message }));
}

const IMPURE: readonly (readonly [string, PurityRule, string])[] = [
  // Clock
  ['Date.now()', PROPERTIES, 'export const t = Date.now();'],
  ['destructured Date.now', PROPERTIES, 'const { now } = Date;\nexport const t = now();'],
  ['Temporal.Now', PROPERTIES, 'export const t = Temporal.Now.instant();'],
  ['new Date() with no argument', SYNTAX, 'export const t = new Date();'],
  ['Date() with no argument', SYNTAX, 'export const t = Date();'],
  ['Date(s)', SYNTAX, "export const t = Date('2026-09-26T00:00:00Z');"],
  ['performance.now()', GLOBALS, 'export const t = performance.now();'],
  // Randomness
  ['Math.random()', PROPERTIES, 'export const r = Math.random();'],
  ['crypto.randomUUID()', GLOBALS, 'export const id = crypto.randomUUID();'],
  // Env
  ['process.env.X', GLOBALS, 'export const v = process.env.X;'],
  ['process.argv', GLOBALS, 'export const a = process.argv;'],
  ['import.meta.env', SYNTAX, 'export const v = import.meta.env.X;'],
  // I/O
  ['fetch(url)', GLOBALS, "export const p = fetch('https://example.invalid');"],
  ['new XMLHttpRequest()', GLOBALS, 'export const x = new XMLHttpRequest();'],
  ['new WebSocket(u)', GLOBALS, "export const w = new WebSocket('wss://example.invalid');"],
  ['new EventSource(u)', GLOBALS, "export const e = new EventSource('https://example.invalid');"],
  ['navigator', GLOBALS, 'export const n = navigator.userAgent;'],
  ['localStorage', GLOBALS, "export const s = localStorage.getItem('k');"],
  ['sessionStorage', GLOBALS, "export const s = sessionStorage.getItem('k');"],
  ['indexedDB', GLOBALS, "export const d = indexedDB.open('db');"],
  ['document', GLOBALS, 'export const d = document.title;'],
  ['location', GLOBALS, 'export const l = location.href;'],
  ['caches', GLOBALS, "export const c = caches.open('c');"],
  // Global object
  ['globalThis.fetch(url)', GLOBALS, "export const p = globalThis.fetch('https://example.invalid');"],
  ['window', GLOBALS, 'export const w = window.name;'],
  ['self', GLOBALS, 'export const s = self.name;'],
  ['global.fetch(url)', GLOBALS, "export const p = global.fetch('https://example.invalid');"],
];

const PURE: readonly (readonly [string, string])[] = [
  ['Date.parse(s)', "export const t = Date.parse('2026-09-26T00:00:00Z');"],
  ['new Date(s)', "export const d = new Date('2026-09-26T00:00:00Z');"],
];

describe('core purity lint (AD-1)', () => {
  it('the core block applies to core source only', async () => {
    const rulesFor = async (path: string): Promise<Record<string, unknown>> =>
      ((await eslint.calculateConfigForFile(path)) as { rules?: Record<string, unknown> } | undefined)?.rules ?? {};
    expect((await rulesFor(CORE_FILE))[GLOBALS]).toBeDefined();
    expect((await rulesFor(CORE_TEST_FILE))[GLOBALS]).toBeUndefined();
    expect((await rulesFor(SYNC_FILE))[GLOBALS]).toBeUndefined();
  });

  it.each(IMPURE)('%s in core source is a %s error', async (_label, rule, code) => {
    const errors = await purityErrors(code, CORE_FILE);
    expect(errors.map((error) => error.ruleId)).toContain(rule);
    for (const error of errors) {
      expect(error.message).toContain('AD-1');
    }
  });

  it.each(PURE)('%s in core source is allowed', async (_label, code) => {
    expect(await purityErrors(code, CORE_FILE)).toEqual([]);
  });

  it('a core test file may read the clock', async () => {
    expect(await purityErrors('export const t = Date.now();', CORE_TEST_FILE)).toEqual([]);
  });

  it('another package is not covered by the core block', async () => {
    expect(await purityErrors('export const t = Date.now();', SYNC_FILE)).toEqual([]);
  });
});
