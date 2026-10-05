import { AsyncLocalStorage } from 'node:async_hooks';
import { appendFileSync } from 'node:fs';
import nodePath from 'node:path';

import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, inject } from 'vitest';

// NFR-1, AD-13: `onUnhandledRequest` is a callback, not the "error" string, so a global
// `afterEach` can fail the test naming each escaped URL even if the body swallowed the rejection.
// The throw is what stops the request reaching the network.

/** The test a request is charged to. `id` is unique; `name` is what a message prints. */
interface TestIdentity {
  readonly id: string;
  readonly name: string;
}

interface EscapedRequest {
  /** `METHOD URL`. */
  readonly described: string;
  /** `undefined` when no test was running: a `beforeAll`, or module top level. */
  readonly issuedBy: TestIdentity | undefined;
}

// One guard per worker, never uninstalled: a closed server restores the real `fetch`, so a late
// timer in a reused worker (`isolate: false`) would reach the network. State lives on
// `globalThis` because the setup file re-evaluates per file and must not stack interceptors.
interface NoNetworkGuard {
  readonly server: ReturnType<typeof setupServer>;
  readonly escapedRequests: EscapedRequest[];
  /** Charges a request a test does not await to that test, not to whichever test is running. */
  readonly currentTest: AsyncLocalStorage<TestIdentity>;
  listening: boolean;
  // True from `beforeAll` to `afterAll`. A request arriving while false came after its file closed;
  // the last file of a worker has no later hook to report it, so `recordAfterFileClosed` writes it.
  fileOpen: boolean;
}

const GUARD_KEY = Symbol.for('poe-crafting-base-price-checker/no-network-guard');

function processGuard(): NoNetworkGuard {
  const holder = globalThis as typeof globalThis & { [GUARD_KEY]?: NoNetworkGuard };
  const existing = holder[GUARD_KEY];
  if (existing !== undefined) {
    return existing;
  }
  const created: NoNetworkGuard = {
    server: setupServer(),
    escapedRequests: [],
    currentTest: new AsyncLocalStorage<TestIdentity>(),
    listening: false,
    fileOpen: false,
  };
  holder[GUARD_KEY] = created;
  return created;
}

const guard = processGuard();
const { server, escapedRequests, currentTest } = guard;

/** From `test/global-setup.ts`; `undefined` without it, so only the in-memory record is kept. */
const recordDirectory = inject('noNetworkRecordDir');

/** Synchronous, because the worker can end at any moment after the request. */
function recordAfterFileClosed(described: string, issuedBy: TestIdentity | undefined): void {
  if (recordDirectory === undefined || guard.fileOpen) {
    return;
  }
  appendFileSync(
    nodePath.join(recordDirectory, `${String(process.pid)}.log`),
    `${described} (${describeIssuer(issuedBy)})\n`,
  );
}

// Exempt by origin, never by extension: a callback that returns is a passthrough, so `*.json`
// would exempt every upstream trade endpoint. jsdom and Vite use `file:` or loopback.
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

function isNonRemote(url: URL): boolean {
  return url.protocol === 'file:' || LOOPBACK_HOSTS.has(url.hostname);
}

beforeAll(() => {
  // Before the early return below: every file of a reused worker opens.
  guard.fileOpen = true;
  // Once per worker. A later file of a reused worker finds the interceptor
  // already installed, and its closure writes to the same shared record.
  if (guard.listening) {
    return;
  }
  server.listen({
    onUnhandledRequest(request) {
      if (isNonRemote(new URL(request.url))) {
        return;
      }
      const described = `${request.method} ${request.url}`;
      const issuedBy = currentTest.getStore();
      escapedRequests.push({ described, issuedBy });
      recordAfterFileClosed(described, issuedBy);
      throw new Error(`[no-network] unhandled request escaped the fixture set: ${described}`);
    },
  });
  // After `listen` returns: a throwing `listen` leaves the flag false, so the
  // next file of the worker tries again instead of running unguarded.
  guard.listening = true;
});

beforeEach((context) => {
  // `enterWith`, not `run`: Vitest calls this hook and the test body in one
  // async chain, so the store set here reaches the body and everything it starts.
  currentTest.enterWith({ id: context.task.id, name: context.task.name });
});

afterEach((context) => {
  server.resetHandlers();
  // Only this test's own requests. A request another test issued and did not
  // await is not this test's fault; the file-level check below reports it.
  assertNoEscapedRequests(context.task);
});

afterAll(() => {
  // A request after the last `afterEach`, outside any test, or late from an earlier file of a
  // reused worker fails the file here. After the last file no hook reports it, so
  // `recordAfterFileClosed` writes it to disk and `test/global-setup.ts` fails the run.
  try {
    assertNoEscapedRequests();
  } finally {
    server.resetHandlers();
    guard.fileOpen = false;
  }
});

/** Removes every request `isMatching` accepts from the record and returns them in record order. */
function takeEscapedRequests(isMatching: (entry: EscapedRequest) => boolean): EscapedRequest[] {
  const taken: EscapedRequest[] = [];
  for (let index = 0; index < escapedRequests.length; ) {
    const entry = escapedRequests[index];
    if (entry !== undefined && isMatching(entry)) {
      taken.push(entry);
      escapedRequests.splice(index, 1);
    } else {
      index += 1;
    }
  }
  return taken;
}

// Takes the running test's own requests only, so a test asserting on the guard (see
// `test/no-network.test.ts`) does not fail itself. Another test's late request stays recorded
// for the file-level check: a draining test cannot swallow it.
export function drainEscapedRequests(): string[] {
  const runningId = currentTest.getStore()?.id;
  return takeEscapedRequests((entry) => entry.issuedBy?.id === runningId).map(
    (entry) => entry.described,
  );
}

function describeIssuer(issuedBy: TestIdentity | undefined): string {
  return issuedBy === undefined ? 'issued outside any test' : `issued by test "${issuedBy.name}"`;
}

// Exported so a test can execute the failing branch: inlined in `afterEach` it was unreachable,
// and deleting the throw left the suite green. With an `owner` it fails on that test's requests
// only; without one, on every request still recorded.
export function assertNoEscapedRequests(owner?: Pick<TestIdentity, 'id'>): void {
  if (owner !== undefined) {
    const own = takeEscapedRequests((entry) => entry.issuedBy?.id === owner.id).map(
      (entry) => entry.described,
    );
    if (own.length > 0) {
      throw new Error(
        `[no-network] ${String(own.length)} request(s) had no fixture and were blocked:\n  ${own.join('\n  ')}`,
      );
    }
    return;
  }

  const escaped = takeEscapedRequests(() => true);
  if (escaped.length === 0) {
    return;
  }
  const lines = escaped.map((entry) => `${entry.described} (${describeIssuer(entry.issuedBy)})`);
  throw new Error(
    `[no-network] ${String(escaped.length)} request(s) had no fixture and were blocked. ` +
      `No test's afterEach reported these requests:\n  ${lines.join('\n  ')}`,
  );
}

export { server };
