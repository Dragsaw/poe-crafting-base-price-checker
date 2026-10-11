import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

// The real eslint.config.mjs must carry `local/max-comment-run` to CSS (epic 4 retro A6).
const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));
const CSS_FILE = 'packages/web/src/probe.css';

process.env.LINT_FAST = '1';
const eslint = new ESLint({ cwd: REPO_ROOT });

async function commentRunErrors(code: string): Promise<number> {
  const [result] = await eslint.lintText(code, { filePath: CSS_FILE });
  expect(result, `${CSS_FILE} produced no lint result`).toBeDefined();
  const messages = result?.messages ?? [];
  expect(messages.filter((message) => message.fatal === true)).toEqual([]);
  return messages.filter((message) => message.severity === 2 && message.ruleId === 'local/max-comment-run').length;
}

describe('eslint.config.mjs on CSS', () => {
  it('reports a 4-line CSS comment', async () => {
    expect(await commentRunErrors('/*\n * a\n * b\n * c\n * d\n */\n.x { color: red; }\n')).toBe(1);
  });

  it('accepts a 3-line CSS comment', async () => {
    expect(await commentRunErrors('/*\n * a\n * b\n * c\n */\n.x { color: red; }\n')).toBe(0);
  });
});
