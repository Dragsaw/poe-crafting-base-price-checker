// The process auth holder, sole owner of the cookie value (AD-30).
// The value never leaves it: `redact` scrubs errors in place, so classifiers still work.
// The holder outlives a chunk's governor, so it keeps the state, baseline and pending hold-off.

import { Buffer } from 'node:buffer';
import { inspect } from 'node:util';

export const SESSION_COOKIE_ENV_VAR = 'POESESSID';

/** The reasons, verbatim: the console prints them as identifiers. */
export type SessionAuthReason =
  | 'absent'
  | 'malformed'
  | 'held-off'
  | 'not-elevated'
  | 'probe-rejected'
  | 'probe-failed'
  | 'not-probed'
  | 'expired';

/** What the next progress write does with `authHoldOffUntil`; none carries it forward. */
export type HoldOffAction = 'write' | 'clear';

/** The action each settle records; a reason absent here records none. */
const HOLD_OFF_ACTIONS: Partial<Record<SessionAuthReason | 'authenticated', HoldOffAction>> = {
  authenticated: 'clear',
  'not-elevated': 'write',
  'probe-rejected': 'write',
  expired: 'write',
};

export type SessionAuthState =
  | { readonly kind: 'unsettled' }
  | { readonly kind: 'authenticated' }
  | { readonly kind: 'unauthenticated'; readonly reason: SessionAuthReason };

// RFC 6265 §4.1.1 cookie-octet: printable US-ASCII except DQUOTE, comma, semicolon, backslash.
const COOKIE_OCTETS = String.raw`[\x21\x23-\x2B\x2D-\x3A\x3C-\x5B\x5D-\x7E]*`;
const COOKIE_VALUE = new RegExp(`^(?:${COOKIE_OCTETS}|"${COOKIE_OCTETS}")$`);

export function isCookieValue(value: string): boolean {
  return COOKIE_VALUE.test(value);
}

const REDACTED = '[redacted]';

/** The request header the cookie rides in, lower-case as `HttpPort` compares it. */
const COOKIE_HEADER = 'cookie';

export interface SessionAuthOptions {
  /** Receives each console line once, at the moment the holder settles. */
  readonly onSettle?: (line: string) => void;
}

/** Raw, URL-encoded and base64 at three alignments, longest first so no form is half-replaced. */
function formsOf(value: string): string[] {
  const bytes = Buffer.from(value, 'utf8');
  const forms = new Set<string>([value, encodeURIComponent(value), bytes.toString('base64')]);
  for (const encoding of ['base64', 'base64url'] as const) {
    forms.add(bytes.toString(encoding).replace(/={1,2}$/, ''));
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
  return [...forms].filter((form) => form !== '').toSorted((a, b) => b.length - a.length);
}

/** Also the forms of a DQUOTE-wrapped value's inner octets: an HTTP stack may quote either. */
function redactableForms(value: string): string[] {
  const isQuoted = value.length >= 2 && value.startsWith('"') && value.endsWith('"');
  const forms = new Set(formsOf(value));
  if (isQuoted && value.length > 2) {
    const inner = formsOf(value.slice(1, -1));
    for (const form of inner) {
      forms.add(form);
    }
  }
  return [...forms].toSorted((a, b) => b.length - a.length);
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
  /** Changed by `settle` only from `unsettled`, and by `expire` only from `authenticated`. */
  #state: SessionAuthState;
  readonly #onSettle: ((line: string) => void) | undefined;
  /** The baseline's rule-name count, kept from the probe for the whole process. */
  #baselineRuleCount: number | undefined;
  /** The baseline's `policy(X-Rate-Limit-Policy)`, kept with the count. */
  #baselinePolicy: string | undefined;
  /** The hold-off action no progress write has applied yet. */
  #pendingHoldOff: HoldOffAction | undefined;

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

  #moveTo(state: SessionAuthState, action: HoldOffAction | undefined): void {
    this.#state = state;
    if (action !== undefined) {
      this.#pendingHoldOff = action;
    }
    this.#onSettle?.(describeState(state));
  }

  get state(): SessionAuthState {
    return this.#state;
  }

  /** The holder is unsettled and keeps a value: the governor may probe. */
  get canProbe(): boolean {
    return this.#state.kind === 'unsettled' && this.#value !== undefined;
  }

  /** The probe was live: the governor attaches the cookie to pricing requests. */
  get isAuthenticated(): boolean {
    return this.#state.kind === 'authenticated' && this.#value !== undefined;
  }

  /** A new record: `headers` plus the cookie, or an unchanged copy when no value is kept. */
  withCookie(headers: Readonly<Record<string, string>>): Record<string, string> {
    return this.#value === undefined ? { ...headers } : { ...headers, [COOKIE_HEADER]: `${SESSION_COOKIE_ENV_VAR}=${this.#value}` };
  }

  /** The baseline's rule-name count; `undefined` until the governor probed. */
  get baselineRuleCount(): number | undefined {
    return this.#baselineRuleCount;
  }

  /** Only a later cookie answer under this policy is held to the rule-count test. */
  get baselinePolicy(): string | undefined {
    return this.#baselinePolicy;
  }

  /** Called once, at the probe, before settling. Counts only: no rule name is kept. */
  rememberBaseline(ruleCount: number, policy: string | undefined): void {
    this.#baselineRuleCount = ruleCount;
    this.#baselinePolicy = policy;
  }

  /** Settles by a reason row. A no-op unless `unsettled`, so no line prints twice. */
  settle(outcome: SessionAuthReason | 'authenticated'): void {
    if (this.#state.kind !== 'unsettled') {
      return;
    }
    this.#moveTo(
      outcome === 'authenticated' ? { kind: 'authenticated' } : { kind: 'unauthenticated', reason: outcome },
      HOLD_OFF_ACTIONS[outcome],
    );
  }

  /** The downgrade; a no-op unless `authenticated`. Returns whether it moved. */
  expire(): boolean {
    if (this.#state.kind !== 'authenticated') {
      return false;
    }
    this.#moveTo({ kind: 'unauthenticated', reason: 'expired' }, HOLD_OFF_ACTIONS.expired);
    return true;
  }

  /** The run-start hold-off check. Records no action: the field carries forward. */
  settleHeldOffIfDue(holdOffUntil: string | undefined, now: string): void {
    if (holdOffUntil === undefined || !this.canProbe) {
      return;
    }
    if (Date.parse(now) < Date.parse(holdOffUntil)) {
      this.settle('held-off');
    }
  }

  /** The hold-off action no progress write has applied yet, or `undefined`. */
  pendingHoldOff(): HoldOffAction | undefined {
    return this.#pendingHoldOff;
  }

  /** Clears only when still that action, so one recorded after the read survives. */
  holdOffApplied(action: HoldOffAction): void {
    if (this.#pendingHoldOff === action) {
      this.#pendingHoldOff = undefined;
    }
  }

  /** Scrubs in place, so an `Error` keeps its identity and class. */
  redact<T>(thrown: T): T {
    return this.#forms.length === 0 ? thrown : (redactWith(thrown, this.#forms, new Set()) as T);
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
    redactProperty(target, key, forms, seen);
  }
  return thrown;
}

function redactProperty(
  target: Record<string | symbol, unknown>,
  key: string | symbol,
  forms: readonly string[],
  seen: Set<object>,
): void {
  let current: unknown;
  try {
    current = target[key];
  } catch {
    return;
  }
  if (typeof current !== 'string' && (typeof current !== 'object' || current === null)) {
    return;
  }
  const next = redactWith(current, forms, seen);
  if (next === current) {
    return;
  }
  try {
    target[key] = next;
  } catch {
    // A frozen or accessor-only property: nothing more can be done here.
  }
}

/** Anything else (a socket, a response stream) is left whole: it could reach an unbounded graph. */
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

/** Settles the shell-edge states `absent` and `malformed`; a valid value is unsettled. */
export function createSessionAuth(
  environment: Readonly<Record<string, string | undefined>>,
  options: SessionAuthOptions = {},
): SessionAuth {
  const { onSettle } = options;
  const value = (environment[SESSION_COOKIE_ENV_VAR] ?? '').trim();
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
