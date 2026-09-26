import { AsyncLocalStorage } from 'node:async_hooks';

import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest';

/**
 * NFR-1: no test at any level makes a network call.
 *
 * `onUnhandledRequest` is a **callback**, not the `"error"` string. The string
 * mode reports the request and nothing else; the callback lets the escaped URL
 * be recorded, so a global `afterEach` can fail the test *naming every URL that
 * escaped* even when the test body swallowed the rejection. Throwing from the
 * callback is what stops the request before it reaches the network.
 */

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

/**
 * One guard per worker (process or thread), installed once and never uninstalled.
 *
 * A closed server restores the real `fetch`, `http`/`https` and
 * `XMLHttpRequest`. In a reused worker (`isolate: false`) a timer that one file
 * started can fire after that file's `afterAll`, while the next file imports:
 * with the server closed, that request would reach the network. The worker
 * ends when Vitest is done with it, so an interceptor that stays
 * installed costs nothing — `setupServer` opens no socket.
 *
 * The setup file is evaluated again for each file of a reused worker. A second
 * `setupServer().listen()` would stack a second interceptor, and the first one's
 * closure would still write to the first file's record. So the server, the
 * record and the identity store live in one object on `globalThis`, and the
 * first evaluation creates it.
 */
interface NoNetworkGuard {
  readonly server: ReturnType<typeof setupServer>;
  readonly escapedRequests: EscapedRequest[];
  /**
   * Carries the running test's identity from the test body into the timers and
   * promise continuations it starts. A request a test does not await is then
   * charged to that test, not to whichever test happens to be running when MSW
   * calls `onUnhandledRequest`.
   */
  readonly currentTest: AsyncLocalStorage<TestIdentity>;
  listening: boolean;
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
  };
  holder[GUARD_KEY] = created;
  return created;
}

const guard = processGuard();
const { server, escapedRequests, currentTest } = guard;

/**
 * The only exemption is by **origin**, never by file extension. A callback that
 * returns without throwing is a passthrough — MSW performs the request for
 * real — so exempting `*.json` would have exempted every upstream trade
 * endpoint this project talks to. jsdom and Vite ask for their assets over
 * `file:` or loopback; nothing else is exempt.
 */
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

function isNonRemote(url: URL): boolean {
  return url.protocol === 'file:' || LOOPBACK_HOSTS.has(url.hostname);
}

beforeAll(() => {
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
      escapedRequests.push({ described, issuedBy: currentTest.getStore() });
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
  // A request recorded after the last `afterEach`, or outside any test, fails
  // the file here instead of passing silently. So does a late request from an
  // earlier file of a reused worker. The server is never closed (see
  // `NoNetworkGuard`), so a request that fires after this hook is still blocked.
  try {
    assertNoEscapedRequests();
  } finally {
    server.resetHandlers();
  }
});

/** Removes from the record every request that `matches` accepts, and returns them in record order. */
function takeEscapedRequests(matches: (entry: EscapedRequest) => boolean): EscapedRequest[] {
  const taken: EscapedRequest[] = [];
  for (let index = 0; index < escapedRequests.length; ) {
    const entry = escapedRequests[index];
    if (entry !== undefined && matches(entry)) {
      taken.push(entry);
      escapedRequests.splice(index, 1);
    } else {
      index += 1;
    }
  }
  return taken;
}

/**
 * Returns, as `METHOD URL`, the requests that the **running** test issued since
 * the last drain, and removes them from the record. Called outside any test, it
 * takes the requests issued outside any test. A test that *asserts on* the
 * guard (see `test/no-network.test.ts`) calls it first so the guard does not
 * then fail the very test that proved it works.
 *
 * It never takes another test's request. A late request from an earlier test
 * stays recorded, so the file-level check still reports it: a draining test
 * cannot swallow it.
 */
export function drainEscapedRequests(): string[] {
  const runningId = currentTest.getStore()?.id;
  return takeEscapedRequests((entry) => entry.issuedBy?.id === runningId).map(
    (entry) => entry.described,
  );
}

function describeIssuer(issuedBy: TestIdentity | undefined): string {
  return issuedBy === undefined ? 'issued outside any test' : `issued by test "${issuedBy.name}"`;
}

/**
 * The guard itself, exported so a test can execute its failing branch. Inlined
 * in `afterEach` it was unreachable from any assertion: deleting the throw left
 * the suite green.
 *
 * With an `owner`, it drains and fails on that test's requests only, and leaves
 * every other request recorded. With no `owner`, it drains and fails on every
 * request still recorded, and names the test that issued each one.
 */
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
  if (escaped.length > 0) {
    const lines = escaped.map((entry) => `${entry.described} (${describeIssuer(entry.issuedBy)})`);
    throw new Error(
      `[no-network] ${String(escaped.length)} request(s) had no fixture and were blocked. ` +
        `No test's afterEach reported these requests:\n  ${lines.join('\n  ')}`,
    );
  }
}

export { server };
