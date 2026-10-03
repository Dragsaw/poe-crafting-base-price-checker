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
 * `createSessionAuth` settles the shell-edge states, `absent` and `malformed`
 * (§13.1). A valid value builds an unsettled holder and prints no line. The
 * governor (`client.ts`) then probes once, on the first 2xx pricing search of
 * the process, and settles the holder by the §13.3 rows through `settle`, which
 * hands the §13.5 line to the shell's `onSettle` listener (§13.2, §13.3). After
 * an `authenticated` settle the governor asks `withCookie` to add the header,
 * so the value never leaves this module. The downgrade and the hold-off belong
 * to the next story.
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

/** The request header the cookie rides in, lower-case as `HttpPort` compares it. */
const COOKIE_HEADER = 'cookie';

export interface SessionAuthOptions {
  /** Receives each §13.5 console line once, at the moment the holder settles. */
  readonly onSettle?: (line: string) => void;
}

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
  /** The kept value; `undefined` when none is kept. Never read outside this class. */
  readonly #value: string | undefined;
  /** The value and its encoded forms, longest first; empty when no value is kept. */
  readonly #forms: readonly string[];
  /** Changed only by `settle`, and only from `unsettled`. */
  #state: SessionAuthState;
  readonly #onSettle: ((line: string) => void) | undefined;

  /** Built by `createSessionAuth`; a valid value is the only one kept. */
  constructor(
    value: string | undefined,
    state: SessionAuthState,
    onSettle?: (line: string) => void,
  ) {
    this.#value = value;
    this.#forms = value === undefined ? [] : redactableForms(value);
    this.#state = state;
    this.#onSettle = onSettle;
  }

  get state(): SessionAuthState {
    return this.#state;
  }

  /** The holder is unsettled and keeps a value: the governor may probe (§13.2). */
  get canProbe(): boolean {
    return this.#state.kind === 'unsettled' && this.#value !== undefined;
  }

  /** The probe was live: the governor attaches the cookie to pricing requests. */
  get isAuthenticated(): boolean {
    return this.#state.kind === 'authenticated' && this.#value !== undefined;
  }

  /**
   * `headers` plus `cookie: POESESSID=<value>`, as a new record. With no value
   * kept, a copy of `headers` unchanged. The governor calls this only on a
   * probe and, after an `authenticated` settle, on a cookie-eligible request.
   */
  withCookie(headers: Readonly<Record<string, string>>): Record<string, string> {
    if (this.#value === undefined) {
      return { ...headers };
    }
    return { ...headers, [COOKIE_HEADER]: `${SESSION_COOKIE_ENV_VAR}=${this.#value}` };
  }

  /**
   * Settles the holder by a §13.3 row and hands the §13.5 line to `onSettle`,
   * once. A no-op unless the holder is `unsettled`: a settled state never
   * moves here, and no line prints twice.
   */
  settle(outcome: SessionAuthReason | 'authenticated'): void {
    if (this.#state.kind !== 'unsettled') {
      return;
    }
    this.#state =
      outcome === 'authenticated' ? { kind: 'authenticated' } : { kind: 'unauthenticated', reason: outcome };
    this.#onSettle?.(describeState(this.#state));
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
 *
 * `onSettle` receives each §13.5 line once, at the moment the holder settles:
 * here for an edge state, later from `settle`.
 */
export function createSessionAuth(
  env: Readonly<Record<string, string | undefined>>,
  options: SessionAuthOptions = {},
): SessionAuth {
  const { onSettle } = options;
  const value = (env[SESSION_COOKIE_ENV_VAR] ?? '').trim();
  if (value === '' || !isCookieValue(value)) {
    const state: SessionAuthState = {
      kind: 'unauthenticated',
      reason: value === '' ? 'absent' : 'malformed',
    };
    // Settled at the edge: the line prints now, before the first request.
    onSettle?.(describeState(state));
    return new SessionAuth(undefined, state, onSettle);
  }
  return new SessionAuth(value, { kind: 'unsettled' }, onSettle);
}
