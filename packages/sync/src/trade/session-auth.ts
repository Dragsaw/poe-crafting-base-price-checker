/**
 * The process auth holder: the one owner of the optional `POESESSID` value
 * (AD-30, IMPLEMENTATION-NOTES.md §13).
 *
 * Only the `pnpm sync` and `pnpm sync:batch` shells build a holder, from their
 * injected `env`, at the shell edge (§13.1). `catalogue:refresh`,
 * `fixtures:record` and `sync:dry` never import this module.
 *
 * **The value never leaves the holder** (§13.6). It lives in a private field.
 * `JSON.stringify`, `String()` and `util.inspect` of the holder show the state
 * only. A `malformed` value is not kept at all, so no HTTP stack can quote it.
 * `redact` removes the value from an error, its stack and its cause chain, in
 * place, so the error keeps its class and `name` and the classifiers
 * (`isTransportFailure`, `instanceof`) still read it.
 *
 * This module settles only the shell-edge states: `absent` and `malformed`. A
 * valid value builds an unsettled holder and prints no line. The probe, the
 * attach and the later settles belong to the next stories.
 */

import { Buffer } from 'node:buffer';
import { inspect } from 'node:util';

export const SESSION_COOKIE_ENV_VAR = 'POESESSID';

/** The §13.5 reasons, verbatim: the console prints them as identifiers. */
export type SessionAuthReason =
  | 'absent'
  | 'malformed'
  | 'held-off'
  | 'not-elevated'
  | 'probe-rejected'
  | 'probe-failed'
  | 'not-probed'
  | 'expired';

export type SessionAuthState =
  | { readonly kind: 'unsettled' }
  | { readonly kind: 'authenticated' }
  | { readonly kind: 'unauthenticated'; readonly reason: SessionAuthReason };

/**
 * RFC 6265 §4.1.1:
 *
 *   cookie-value  = *cookie-octet / ( DQUOTE *cookie-octet DQUOTE )
 *   cookie-octet  = %x21 / %x23-2B / %x2D-3A / %x3C-5B / %x5D-7E
 *
 * US-ASCII without controls, whitespace, DQUOTE, comma, semicolon and
 * backslash.
 */
const COOKIE_OCTETS = '[\\x21\\x23-\\x2B\\x2D-\\x3A\\x3C-\\x5B\\x5D-\\x7E]*';
const COOKIE_VALUE = new RegExp(`^(?:${COOKIE_OCTETS}|"${COOKIE_OCTETS}")$`);

export function isCookieValue(value: string): boolean {
  return COOKIE_VALUE.test(value);
}

const REDACTED = '[redacted]';

/**
 * The forms of the value that `redact` removes: raw, URL-encoded, and base64
 * at each of the three byte alignments (the value may sit anywhere inside an
 * encoded header, e.g. `POESESSID=<value>`). Longest first, so a longer form
 * is never left half-replaced by a shorter one.
 */
function formsOf(value: string): string[] {
  const bytes = Buffer.from(value, 'utf8');
  const forms = new Set<string>([value, encodeURIComponent(value), bytes.toString('base64')]);
  for (const encoding of ['base64', 'base64url'] as const) {
    forms.add(bytes.toString(encoding).replace(/=+$/, ''));
    for (let offset = 0; offset < 3; offset += 1) {
      const shifted = Buffer.concat([Buffer.alloc(offset), bytes]);
      // Only whole 3-byte groups are stable whatever follows the value, and
      // the first group of a shifted encoding carries the padding bytes.
      const wholeGroups = Math.floor(shifted.length / 3);
      const core = shifted
        .subarray(0, wholeGroups * 3)
        .toString(encoding)
        .slice(offset === 0 ? 0 : 4);
      if (core.length >= 4) {
        forms.add(core);
      }
    }
  }
  return [...forms].filter((form) => form !== '').sort((a, b) => b.length - a.length);
}

/**
 * The forms of a value and, when it is DQUOTE-wrapped, of its bare inner
 * cookie-octets too: an HTTP stack may quote either. Longest first.
 */
function redactableForms(value: string): string[] {
  const quoted = value.length >= 2 && value.startsWith('"') && value.endsWith('"');
  const forms = new Set(formsOf(value));
  if (quoted && value.length > 2) {
    for (const form of formsOf(value.slice(1, -1))) {
      forms.add(form);
    }
  }
  return [...forms].sort((a, b) => b.length - a.length);
}

function scrub(text: string, forms: readonly string[]): string {
  let result = text;
  for (const form of forms) {
    result = result.split(form).join(REDACTED);
  }
  return result;
}

export class SessionAuth {
  /** The value and its encoded forms, longest first; empty when no value is kept. */
  readonly #forms: readonly string[];
  readonly #state: SessionAuthState;

  /** Built by `createSessionAuth`; a valid value is the only one kept. */
  constructor(value: string | undefined, state: SessionAuthState) {
    this.#forms = value === undefined ? [] : redactableForms(value);
    this.#state = state;
  }

  get state(): SessionAuthState {
    return this.#state;
  }

  /**
   * Removes every form of the value from `thrown`, in place, and returns it.
   * An `Error` keeps its identity, class and `name`: its message, stack and
   * every own string property are scrubbed, then its `cause` chain and an
   * `AggregateError`'s `errors`. A thrown string comes back scrubbed.
   */
  redact<T>(thrown: T): T {
    if (this.#forms.length === 0) {
      return thrown;
    }
    return redactWith(thrown, this.#forms, new Set()) as T;
  }

  toJSON(): { readonly state: SessionAuthState } {
    return { state: this.#state };
  }

  toString(): string {
    return `SessionAuth(${describeState(this.#state)})`;
  }

  [inspect.custom](): string {
    return this.toString();
  }
}

function redactWith(thrown: unknown, forms: readonly string[], seen: Set<object>): unknown {
  if (typeof thrown === 'string') {
    return scrub(thrown, forms);
  }
  if (typeof thrown !== 'object' || thrown === null || seen.has(thrown) || !isWalkable(thrown)) {
    return thrown;
  }
  seen.add(thrown);
  const target = thrown as Record<string | symbol, unknown>;
  // `message` and `stack` are own properties of an Error, so this covers them.
  for (const key of Reflect.ownKeys(target)) {
    let current: unknown;
    try {
      current = target[key];
    } catch {
      continue;
    }
    if (typeof current !== 'string' && (typeof current !== 'object' || current === null)) {
      continue;
    }
    const next = redactWith(current, forms, seen);
    if (next !== current) {
      try {
        target[key] = next;
      } catch {
        // A frozen or accessor-only property: nothing more can be done here.
      }
    }
  }
  return thrown;
}

/**
 * An error, an array or a plain record. Anything else (a socket, a response
 * stream) is left whole: walking it could reach an unbounded object graph.
 */
function isWalkable(value: object): boolean {
  if (value instanceof Error || Array.isArray(value)) {
    return true;
  }
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function describeState(state: SessionAuthState): string {
  return state.kind === 'unauthenticated' ? `unauthenticated (${state.reason})` : state.kind;
}

/**
 * Reads the value once from the shell's `env` and settles the shell-edge
 * states (§13.1): blank after the trim is `absent`, outside the `cookie-value`
 * grammar is `malformed`. A valid value builds an unsettled holder.
 */
export function createSessionAuth(env: Readonly<Record<string, string | undefined>>): SessionAuth {
  const value = (env[SESSION_COOKIE_ENV_VAR] ?? '').trim();
  if (value === '') {
    return new SessionAuth(undefined, { kind: 'unauthenticated', reason: 'absent' });
  }
  if (!isCookieValue(value)) {
    return new SessionAuth(undefined, { kind: 'unauthenticated', reason: 'malformed' });
  }
  return new SessionAuth(value, { kind: 'unsettled' });
}

/** The §13.5 console line for a settled state; `undefined` while unsettled. */
export function authLine(holder: SessionAuth): string | undefined {
  const { state } = holder;
  return state.kind === 'unsettled' ? undefined : describeState(state);
}
