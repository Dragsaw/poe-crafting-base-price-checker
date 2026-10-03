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

  it.each(['a b', 'a;b', 'a,b', '"x', 'x"', 'a\\b', 'café', 'a\tb', 'a\u0000b', 'a\u007fb', '"a"b"'])(
    'refuses %j',
    (value) => {
      expect(isCookieValue(value)).toBe(false);
    },
  );
});

describe('createSessionAuth: the shell-edge settle', () => {
  it.each([[undefined], [''], ['   '], ['\t\n']])('%j is absent', (value) => {
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
  const settled = (value: string | undefined) => {
    const lines: string[] = [];
    const holder = createSessionAuth({ [SESSION_COOKIE_ENV_VAR]: value }, { onSettle: (line) => lines.push(line) });
    return { holder, lines };
  };

  it('an unsettled valid value can probe and is not authenticated', () => {
    const { holder, lines } = settled(CANARY);
    expect(holder.canProbe).toBe(true);
    expect(holder.isAuthenticated).toBe(false);
    expect(lines).toEqual([]);
  });

  it.each([[undefined, 'absent'], ['a b', 'malformed']])(
    'an edge state %j prints its line through onSettle at once, and can never probe',
    (value, reason) => {
      const { holder, lines } = settled(value);
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
    const { holder, lines } = settled(CANARY);
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
      const { holder, lines } = settled(CANARY);
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
    const { holder } = settled(`"${CANARY}"`);
    expect(holder.withCookie({})).toEqual({ cookie: `POESESSID="${CANARY}"` });
  });
});
