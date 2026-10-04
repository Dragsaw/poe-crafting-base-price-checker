import { inspect } from 'node:util';

import { describe, expect, it } from 'vitest';

import { createSessionAuth, isCookieValue, SESSION_COOKIE_ENV_VAR } from './session-auth.ts';
import { isTransportFailure } from './transport-failure.ts';

/** IMPLEMENTATION-NOTES.md §13.1, §13.5, §13.6. */

const CANARY = 'Q7vXk2pLm9RtYw4Nz8HbJc3FgD6sAe1U';
const withCookie = (value: string | undefined) => createSessionAuth({ [SESSION_COOKIE_ENV_VAR]: value });

/** A holder built with an `onSettle` listener, and the §13.5 lines it received. */
const withLines = (value: string | undefined) => {
  const lines: string[] = [];
  const holder = createSessionAuth({ [SESSION_COOKIE_ENV_VAR]: value }, { onSettle: (line) => lines.push(line) });
  return { holder, lines };
};

describe('the cookie-value grammar (RFC 6265)', () => {
  it.each([CANARY, `"${CANARY}"`, '!#$%&\'()*+-./:<=>?@[]^_`{|}~', ''])('accepts %j', (value) => {
    expect(isCookieValue(value)).toBe(true);
  });

  it.each(['a b', 'a;b', 'a,b', '"x', 'x"', String.raw`a\b`, 'café', 'a\tb', 'a\0b', 'a\u{7F}b', '"a"b"'])(
    'refuses %j',
    (value) => {
      expect(isCookieValue(value)).toBe(false);
    },
  );
});

describe('createSessionAuth: the shell-edge settle', () => {
  it.each([[undefined], [''], [' '.repeat(3)], ['\t\n']])('%j is absent', (value) => {
    const { holder, lines } = withLines(value);
    expect(holder.state).toEqual({ kind: 'unauthenticated', reason: 'absent' });
    expect(lines).toEqual(['unauthenticated (absent)']);
  });

  it.each(['a b', 'a;b', 'a,b', '"x', 'café'])('%j is malformed, and the line does not quote it', (value) => {
    const { holder, lines } = withLines(value);
    expect(holder.state).toEqual({ kind: 'unauthenticated', reason: 'malformed' });
    expect(lines).toEqual(['unauthenticated (malformed)']);
  });

  it('trims before the grammar check', () => {
    expect(withCookie(`  ${CANARY}\n`).state).toEqual({ kind: 'unsettled' });
  });

  it.each([CANARY, `"${CANARY}"`])('a valid %j is unsettled and prints no line', (value) => {
    const { holder, lines } = withLines(value);
    expect(holder.state).toEqual({ kind: 'unsettled' });
    expect(lines).toEqual([]);
  });
});

describe('the holder is opaque', () => {
  it('JSON, String and inspect show the state, never the value', () => {
    const holder = withCookie(CANARY);
    for (const shown of [JSON.stringify(holder), String(holder), `${holder}`, inspect(holder), inspect(holder, { showHidden: true, depth: 10 })]) {
      expect(shown).not.toContain(CANARY.slice(0, 8));
      expect(shown).toContain('unsettled');
    }
    expect(Object.keys(holder)).toEqual([]);
  });
});

describe('redact', () => {
  const encoded = encodeURIComponent(CANARY);
  const base64 = Buffer.from(CANARY).toString('base64');
  const headerBase64 = Buffer.from(`POESESSID=${CANARY}`).toString('base64');

  function leaks(text: string): boolean {
    return [CANARY, base64, headerBase64].some((form) => text.includes(form)) || text.includes(CANARY.slice(4, 20));
  }

  it('removes raw, URL-encoded and base64 forms from message, stack and a nested cause chain, in place', () => {
    const inner = new Error(`inner ${base64} and ${headerBase64}`);
    const middle = new TypeError(`middle ${encoded}`, { cause: inner });
    const outer = new RangeError(`outer Cookie: POESESSID=${CANARY}`, { cause: middle });
    Object.assign(outer, { headers: { cookie: `POESESSID=${CANARY}` }, note: `?s=${encoded}` });

    const result = withCookie(CANARY).redact(outer);

    expect(result).toBe(outer);
    expect(outer).toBeInstanceOf(RangeError);
    expect(outer.name).toBe('RangeError');
    expect(middle).toBeInstanceOf(TypeError);
    expect(outer.cause).toBe(middle);
    expect(middle.cause).toBe(inner);
    for (const error of [outer, middle, inner]) {
      expect(leaks(error.message)).toBe(false);
      expect(leaks(error.stack ?? '')).toBe(false);
    }
    expect(leaks(JSON.stringify(outer))).toBe(false);
    expect(outer.message).toBe('outer Cookie: POESESSID=[redacted]');
  });

  it('keeps a transport failure classified', () => {
    const fetchFailed = new TypeError('fetch failed', { cause: new Error(`connect to ?id=${CANARY}`) });
    const timeout = Object.assign(new Error(`timed out ${CANARY}`), { name: 'TimeoutError' });
    const holder = withCookie(CANARY);

    expect(isTransportFailure(holder.redact(fetchFailed))).toBe(true);
    expect(isTransportFailure(holder.redact(timeout))).toBe(true);
    expect(leaks(String((fetchFailed.cause as Error).message))).toBe(false);
  });

  it('a string cause, an AggregateError and a cycle', () => {
    const cyclic = new Error(`a ${CANARY}`);
    Object.assign(cyclic, { cause: cyclic });
    const aggregate = new AggregateError([cyclic, new Error(base64)], `agg ${CANARY}`, { cause: `str ${CANARY}` });

    withCookie(CANARY).redact(aggregate);

    expect(leaks(aggregate.message)).toBe(false);
    expect(leaks(String(aggregate.cause))).toBe(false);
    expect(aggregate.errors.every((error: Error) => !leaks(error.message))).toBe(true);
  });

  it('a DQUOTE-wrapped value: the bare inner value is redacted in every form', () => {
    const error = new Error(`bare ${CANARY} enc ${encoded} b64 ${base64}`, { cause: new Error(`quoted "${CANARY}"`) });

    withCookie(`"${CANARY}"`).redact(error);

    expect(leaks(error.message)).toBe(false);
    expect(leaks(error.stack ?? '')).toBe(false);
    expect(leaks((error.cause as Error).message)).toBe(false);
  });

  it('a thrown string comes back scrubbed', () => {
    expect(withCookie(CANARY).redact(`raw ${CANARY}`)).toBe('raw [redacted]');
  });

  it('a holder with no value leaves the error untouched', () => {
    const error = new Error('nothing to hide');
    expect(withCookie(undefined).redact(error)).toBe(error);
    expect(error.message).toBe('nothing to hide');
  });
});

describe('the probe API (IMPLEMENTATION-NOTES.md §13.2, §13.3, §13.5)', () => {
  it('an unsettled valid value can probe and is not authenticated', () => {
    const { holder, lines } = withLines(CANARY);
    expect(holder.canProbe).toBe(true);
    expect(holder.isAuthenticated).toBe(false);
    expect(lines).toEqual([]);
  });

  it.each([[undefined, 'absent'], ['a b', 'malformed']])(
    'an edge state %j prints its line through onSettle at once, and can never probe',
    (value, reason) => {
      const { holder, lines } = withLines(value);
      expect(lines).toEqual([`unauthenticated (${reason})`]);
      expect(holder.canProbe).toBe(false);
      holder.settle('authenticated');
      expect(holder.state).toEqual({ kind: 'unauthenticated', reason });
      expect(holder.isAuthenticated).toBe(false);
      expect(lines).toHaveLength(1);
      expect(holder.withCookie({ a: 'b' })).toEqual({ a: 'b' });
    },
  );

  it('settle authenticated: one line, the state moves once, and withCookie adds the header', () => {
    const { holder, lines } = withLines(CANARY);
    holder.settle('authenticated');
    holder.settle('not-elevated');
    holder.settle('not-probed');
    expect(holder.state).toEqual({ kind: 'authenticated' });
    expect(lines).toEqual(['authenticated']);
    expect(holder.canProbe).toBe(false);
    expect(holder.isAuthenticated).toBe(true);
    const headers = { 'user-agent': 'x' };
    expect(holder.withCookie(headers)).toEqual({ 'user-agent': 'x', cookie: `POESESSID=${CANARY}` });
    // A new record: the caller's headers are not mutated.
    expect(headers).toEqual({ 'user-agent': 'x' });
  });

  it.each(['not-elevated', 'probe-rejected', 'probe-failed', 'not-probed'] as const)(
    'settle %s: one unauthenticated line, never the value',
    (reason) => {
      const { holder, lines } = withLines(CANARY);
      holder.settle(reason);
      holder.settle('authenticated');
      expect(holder.state).toEqual({ kind: 'unauthenticated', reason });
      expect(lines).toEqual([`unauthenticated (${reason})`]);
      expect(holder.canProbe).toBe(false);
      expect(holder.isAuthenticated).toBe(false);
      expect(JSON.stringify(holder)).not.toContain(CANARY.slice(0, 8));
    },
  );

  it('the probe header keeps the DQUOTE form of a quoted value', () => {
    const { holder } = withLines(`"${CANARY}"`);
    expect(holder.withCookie({})).toEqual({ cookie: `POESESSID="${CANARY}"` });
  });
});

describe('the downgrade and the hold-off (IMPLEMENTATION-NOTES.md §13.1, §13.3, §13.4)', () => {
  const NOW = '2026-10-03T12:00:00.000Z';
  const LATER = '2026-10-04T12:00:00.000Z';

  it.each([
    ['authenticated', 'clear'],
    ['not-elevated', 'write'],
    ['probe-rejected', 'write'],
    ['probe-failed', undefined],
    ['not-probed', undefined],
    ['held-off', undefined],
  ] as const)('a %s settle records %s', (outcome, action) => {
    const { holder } = withLines(CANARY);
    holder.settle(outcome);
    expect(holder.pendingHoldOff()).toBe(action);
  });

  it.each([['absent', ''], ['malformed', 'a b']])('an %s edge settle records no action', (_label, value) => {
    expect(withLines(value).holder.pendingHoldOff()).toBeUndefined();
  });

  it('expire: authenticated becomes expired once, prints one line, records write and drops the cookie', () => {
    const { holder, lines } = withLines(CANARY);
    holder.settle('authenticated');

    expect(holder.expire()).toBe(true);
    expect(holder.expire()).toBe(false);

    expect(holder.state).toEqual({ kind: 'unauthenticated', reason: 'expired' });
    expect(lines).toEqual(['authenticated', 'unauthenticated (expired)']);
    expect(holder.pendingHoldOff()).toBe('write');
    expect(holder.isAuthenticated).toBe(false);
    expect(holder.canProbe).toBe(false);
    // No other transition: a settle after the downgrade is a no-op.
    holder.settle('authenticated');
    expect(holder.state).toEqual({ kind: 'unauthenticated', reason: 'expired' });
    expect(lines).toHaveLength(2);
  });

  it.each([
    ['unsettled', (): void => undefined],
    ['not-elevated', (holder: ReturnType<typeof withCookie>): void => holder.settle('not-elevated')],
  ])('expire from %s is a no-op that prints nothing', (_label, before) => {
    const { holder, lines } = withLines(CANARY);
    before(holder);
    const printed = lines.length;
    expect(holder.expire()).toBe(false);
    expect(lines).toHaveLength(printed);
    expect(holder.state.kind).not.toBe('authenticated');
  });

  it('holdOffApplied clears only the action it names', () => {
    const { holder } = withLines(CANARY);
    holder.settle('authenticated');
    holder.holdOffApplied('write');
    expect(holder.pendingHoldOff()).toBe('clear');
    holder.holdOffApplied('clear');
    expect(holder.pendingHoldOff()).toBeUndefined();
  });

  it('the latest settle wins: a clear then an expiry leaves write pending', () => {
    const { holder } = withLines(CANARY);
    holder.settle('authenticated');
    holder.expire();
    expect(holder.pendingHoldOff()).toBe('write');
  });

  it('keeps the baseline rule count and policy for the process', () => {
    const holder = withCookie(CANARY);
    expect(holder.baselineRuleCount).toBeUndefined();
    expect(holder.baselinePolicy).toBeUndefined();
    holder.rememberBaseline(2, 'search-policy');
    expect(holder.baselineRuleCount).toBe(2);
    expect(holder.baselinePolicy).toBe('search-policy');
  });

  it('settleHeldOffIfDue: a due hold-off settles held-off with one line and no action', () => {
    const { holder, lines } = withLines(CANARY);
    holder.settleHeldOffIfDue(LATER, NOW);
    expect(holder.state).toEqual({ kind: 'unauthenticated', reason: 'held-off' });
    expect(lines).toEqual(['unauthenticated (held-off)']);
    expect(holder.pendingHoldOff()).toBeUndefined();
    expect(holder.canProbe).toBe(false);
  });

  it.each([
    ['past', NOW, LATER],
    ['exactly now', NOW, NOW],
    ['absent', undefined, NOW],
  ])('settleHeldOffIfDue: a %s hold-off leaves the holder able to probe', (_label, until, now) => {
    const { holder, lines } = withLines(CANARY);
    holder.settleHeldOffIfDue(until, now);
    expect(holder.canProbe).toBe(true);
    expect(lines).toEqual([]);
  });

  it('settleHeldOffIfDue never moves a settled holder', () => {
    const { holder, lines } = withLines('');
    holder.settleHeldOffIfDue(LATER, NOW);
    expect(holder.state).toEqual({ kind: 'unauthenticated', reason: 'absent' });
    expect(lines).toEqual(['unauthenticated (absent)']);
  });

  it('the holder JSON still shows the state only', () => {
    const holder = withCookie(CANARY);
    holder.rememberBaseline(1, 'search-policy');
    holder.settle('authenticated');
    expect(JSON.stringify(holder)).toBe('{"state":{"kind":"authenticated"}}');
  });
});
