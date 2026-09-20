import { expect, it } from 'vitest';

import {
  MissingUserAgentError,
  resolveUserAgent,
  USER_AGENT_ENV_VAR,
} from './user-agent.ts';

const CONTACT = 'poe-crafting-base-price-checker/0.0.0 (contact: someone@example.test)';

it('returns the overlay value verbatim, composing nothing', () => {
  const result = resolveUserAgent({ [USER_AGENT_ENV_VAR]: CONTACT });

  expect(result).toEqual({ ok: true, userAgent: CONTACT });
});

// I/O matrix: contact overlay unset.
it('refuses, naming the variable, when the overlay is unset', () => {
  const result = resolveUserAgent({});

  expect(result.ok).toBe(false);
  if (result.ok) {
    return;
  }
  expect(result.variable).toBe(USER_AGENT_ENV_VAR);
  expect(result.message).toContain(USER_AGENT_ENV_VAR);
});

it('refuses on a blank or whitespace-only overlay rather than sending it', () => {
  expect(resolveUserAgent({ [USER_AGENT_ENV_VAR]: '' }).ok).toBe(false);
  expect(resolveUserAgent({ [USER_AGENT_ENV_VAR]: '   ' }).ok).toBe(false);
});

it('trims the value it accepts', () => {
  const result = resolveUserAgent({ [USER_AGENT_ENV_VAR]: `  ${CONTACT}  ` });

  expect(result).toEqual({ ok: true, userAgent: CONTACT });
});

it('carries the variable name on the typed refusal the client throws', () => {
  const error = new MissingUserAgentError();

  expect(error).toBeInstanceOf(Error);
  expect(error.name).toBe('MissingUserAgentError');
  expect(error.variable).toBe(USER_AGENT_ENV_VAR);
  expect(error.message).toContain(USER_AGENT_ENV_VAR);
});

it('reads process.env by default, which is the one environment read in sync', () => {
  // Not asserted on a value — the point is that the default parameter is the
  // single lookup, so every module below the factory takes the contact as a
  // passed-in value.
  expect(() => resolveUserAgent()).not.toThrow();
});
