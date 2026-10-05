import { fileURLToPath } from 'node:url';

import { cruise } from 'dependency-cruiser';
import { expect, it } from 'vitest';

import shippedConfig from '../../.dependency-cruiser.mjs';
import { rules } from '../../depcruise.rules.mjs';

const FORBIDDEN_FIXTURE = fileURLToPath(new URL('fixture/forbidden', import.meta.url));
const ALLOWED_FIXTURE = fileURLToPath(new URL('fixture/allowed', import.meta.url));

interface Violation {
  readonly rule: { readonly name: string; readonly severity: string };
  readonly from: string;
  readonly to: string;
}

interface CruiseOutput {
  readonly modules: readonly unknown[];
  readonly summary: { readonly violations: Violation[] };
}

// A fixture tree outside `packages/`: a violation written there at test time would dirty
// the tree parallel worktrees share. It cruises the shipped config, not the rules module
// alone, which would stay green with `forbidden: []`.
async function cruiseFixture(baseDirectory: string): Promise<CruiseOutput> {
  const result = await cruise(['packages'], {
    ...shippedConfig.options,
    baseDir: baseDirectory,
    ruleSet: { forbidden: shippedConfig.forbidden },
    validate: true,
  });
  return result.output as unknown as CruiseOutput;
}

/** Matched by package directory, not version, so a dependency bump holds. */
const NPM_PACKAGE_DIRECTORY = 'node_modules/dependency-cruiser/';

/** One forbidden edge per shipped rule. Keep in step with `depcruise.rules.mjs`. */
const EXPECTED_VIOLATIONS = [
  {
    rule: 'no-contracts-to-sibling',
    from: 'packages/contracts/src/index.ts',
    to: 'packages/core/src/index.ts',
  },
  { rule: 'no-core-to-node-builtin', from: 'packages/core/src/index.ts', to: 'fs' },
  {
    rule: 'no-core-to-npm-package',
    from: 'packages/core/src/index.ts',
    to: NPM_PACKAGE_DIRECTORY,
  },
  { rule: 'no-core-to-sync', from: 'packages/core/src/index.ts', to: 'packages/sync/src/index.ts' },
  { rule: 'no-core-to-web', from: 'packages/core/src/index.ts', to: 'packages/web/src/index.ts' },
  { rule: 'no-sync-to-web', from: 'packages/sync/src/index.ts', to: 'packages/web/src/index.ts' },
  { rule: 'no-web-to-sync', from: 'packages/web/src/index.ts', to: 'packages/sync/src/index.ts' },
];

it('ships every rule the rules module exports', () => {
  // Guards the config itself: `forbidden: []`, a dropped rule or a renamed one
  // fails here rather than silently disarming `pnpm check`.
  expect(shippedConfig.forbidden.map((rule) => rule.name)).toEqual(rules.map((rule) => rule.name));
  expect(rules).not.toHaveLength(0);
});

it('reports every forbidden edge, by rule name and at error severity', async () => {
  const output = await cruiseFixture(FORBIDDEN_FIXTURE);
  const violations = output.summary.violations;

  expect(
    violations
      .map((violation) => ({
        rule: violation.rule.name,
        from: violation.from,
        to: violation.to.includes(NPM_PACKAGE_DIRECTORY) ? NPM_PACKAGE_DIRECTORY : violation.to,
      }))
      .toSorted((a, b) => a.rule.localeCompare(b.rule)),
  ).toEqual(EXPECTED_VIOLATIONS);

  // Every rule must be the one that stops `pnpm check`, not a warning.
  for (const violation of violations) {
    expect(violation.rule.severity).toBe('error');
  }

  // One fixture edge per rule, so a rule with no fixture cannot hide here.
  expect(violations).toHaveLength(rules.length);
});

it('keeps resolved npm modules in the graph of the real repo-root cruise', async () => {
  // The fixture cruise sees npm paths as `../../../../node_modules/...`, so a
  // root-anchored exclude such as `^node_modules/` would pass it while leaving
  // `no-core-to-npm-package` inert in `pnpm check`. Cruise as `pnpm check` does.
  const result = await cruise(['packages'], {
    ...shippedConfig.options,
    ruleSet: { forbidden: shippedConfig.forbidden },
    validate: true,
  });
  const output = result.output as unknown as {
    readonly modules: readonly { readonly source: string }[];
  };

  expect(output.modules.some((module) => module.source.startsWith('node_modules/'))).toBe(true);
});

it('leaves every allowed edge unreported, having analysed the mirror tree', async () => {
  const output = await cruiseFixture(ALLOWED_FIXTURE);

  // Assert work was done: an analysis of zero modules also reports zero
  // violations, and that is indistinguishable from a passing graph.
  expect(output.modules.length).toBeGreaterThan(0);
  expect(output.summary.violations).toHaveLength(0);
});
