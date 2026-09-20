import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll } from 'vitest';

/**
 * NFR-1: no test at any level makes a network call.
 *
 * `onUnhandledRequest` is a **callback**, not the `"error"` string. The string
 * mode reports the request and nothing else; the callback lets the escaped URL
 * be recorded, so a global `afterEach` can fail the test *naming every URL that
 * escaped* even when the test body swallowed the rejection. Throwing from the
 * callback is what stops the request before it reaches the network.
 */

const escapedRequests: string[] = [];

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

const server = setupServer();

beforeAll(() => {
  server.listen({
    onUnhandledRequest(request) {
      if (isNonRemote(new URL(request.url))) {
        return;
      }
      const described = `${request.method} ${request.url}`;
      escapedRequests.push(described);
      throw new Error(`[no-network] unhandled request escaped the fixture set: ${described}`);
    },
  });
});

afterEach(() => {
  server.resetHandlers();
  assertNoEscapedRequests();
});

afterAll(() => {
  server.close();
});

/**
 * Returns every request recorded since the last drain and clears the record.
 * The guard calls it; a test that *asserts on* the guard (see
 * `test/no-network.test.ts`) calls it first so the guard does not then fail the
 * very test that proved it works.
 */
export function drainEscapedRequests(): string[] {
  return escapedRequests.splice(0, escapedRequests.length);
}

/**
 * The guard itself, exported so a test can execute its failing branch. Inlined
 * in `afterEach` it was unreachable from any assertion: deleting the throw left
 * the suite green.
 */
export function assertNoEscapedRequests(): void {
  const escaped = drainEscapedRequests();
  if (escaped.length > 0) {
    throw new Error(
      `[no-network] ${String(escaped.length)} request(s) had no fixture and were blocked:\n  ${escaped.join('\n  ')}`,
    );
  }
}

export { server };
