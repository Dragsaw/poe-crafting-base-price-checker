import type { ClockPort, FilesystemPort } from '@poe/contracts';

import { inputSignature, isLockFree } from './session-inputs.ts';
import type { SessionWait } from './session-state.ts';

/** How often a wait polls the local input or lock file: a local read, never a request. */
export const LOCAL_POLL_MS = 5000;

export interface WaitPorts {
  readonly fs: FilesystemPort;
  readonly clock: ClockPort;
  /** A delay that an abort ends at once, resolving (`abortableSleep`). */
  readonly sleep: (ms: number, signal: AbortSignal) => Promise<void>;
  readonly signal: AbortSignal;
}

function remainingMs(until: string, clock: ClockPort): number {
  return Date.parse(until) - Date.parse(clock.now());
}

/** Spends one wait. Returns early on an abort. `signature` is the input signature the wait compares against. */
export async function runWait(wait: SessionWait, ports: WaitPorts, signature: string): Promise<void> {
  switch (wait.kind) {
    case 'none': {
      return;
    }
    case 'until': {
      return waitUntil(wait, ports, signature);
    }
    case 'input-change': {
      return waitForInputChange(wait, ports, signature);
    }
    case 'lock': {
      return waitForLock(ports);
    }
  }
}

async function waitUntil(
  wait: Extract<SessionWait, { kind: 'until' }>,
  ports: WaitPorts,
  signature: string,
): Promise<void> {
  const { fs, clock, sleep: pause, signal } = ports;
  /* eslint-disable no-await-in-loop -- polling loop: each pause or probe decides whether the next iteration runs */
  for (;;) {
    const left = remainingMs(wait.until, clock);
    if (left <= 0 || signal.aborted) {
      return;
    }
    await pause(wait.orInputChange ? Math.min(left, LOCAL_POLL_MS) : left, signal);
    if (signal.aborted) {
      return;
    }
    if (wait.orInputChange && (await inputSignature(fs)) !== signature) {
      return;
    }
  }
  /* eslint-enable no-await-in-loop -- end of the polling loop above */
}

async function waitForInputChange(
  wait: Extract<SessionWait, { kind: 'input-change' }>,
  ports: WaitPorts,
  signature: string,
): Promise<void> {
  const { fs, clock, sleep: pause, signal } = ports;
  /* eslint-disable no-await-in-loop -- polling loop: each pause or probe decides whether the next iteration runs */
  for (;;) {
    const left = wait.until === undefined ? LOCAL_POLL_MS : remainingMs(wait.until, clock);
    if (left <= 0 || signal.aborted) {
      return;
    }
    await pause(Math.min(left, LOCAL_POLL_MS), signal);
    if (signal.aborted || (await inputSignature(fs)) !== signature) {
      return;
    }
  }
  /* eslint-enable no-await-in-loop -- end of the polling loop above */
}

async function waitForLock(ports: WaitPorts): Promise<void> {
  const { fs, clock, sleep: pause, signal } = ports;
  /* eslint-disable no-await-in-loop -- polling loop: each pause or probe decides whether the next iteration runs */
  for (;;) {
    if (signal.aborted || (await isLockFree(fs, clock))) {
      return;
    }
    await pause(LOCAL_POLL_MS, signal);
  }
  /* eslint-enable no-await-in-loop -- end of the polling loop above */
}

export function describeWait(wait: Exclude<SessionWait, { kind: 'none' }>): string {
  switch (wait.kind) {
    case 'until': {
      return `waiting until ${wait.until} (${wait.reason}${wait.orInputChange ? ', or an input file change' : ''})`;
    }
    case 'input-change': {
      return `waiting for an input file under data/ to change (${wait.reason}${
        wait.until === undefined ? '' : `, at most until ${wait.until}`
      })`;
    }
    case 'lock': {
      return `waiting for the lock to be free (${wait.reason})`;
    }
  }
}
