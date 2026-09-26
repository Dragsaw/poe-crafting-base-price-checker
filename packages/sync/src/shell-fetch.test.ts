import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo, Socket } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createFetchHttpPort, REQUEST_TIMEOUT_MS } from './shell.ts';
import { isTransportFailure } from './trade/transport-failure.ts';

/**
 * The real `HttpPort` against a real socket (epic-1-retro-item-10, L-V1).
 *
 * The yield-on-timeout contract (AD-8) rests on two literals that only the
 * runtime produces: `AbortSignal.timeout`'s `TimeoutError` and undici's
 * `TypeError('fetch failed')`. A fake cannot pin either one, so every rejection
 * below comes from Node's own `fetch` and goes through `isTransportFailure`.
 *
 * This is the one test file that names the real port — the scan in
 * `catalogue-refresh.test.ts` exempts it by name. Every URL is `127.0.0.1` on a
 * server this file started; the MSW guard in `test/setup.ts` still fails any
 * request to a remote host.
 */

type Handler = (request: IncomingMessage, response: ServerResponse) => void;

const servers: Server[] = [];
const sockets = new Set<Socket>();

async function startServer(handler: Handler): Promise<{ server: Server; origin: string }> {
  const server = createServer(handler);
  server.on('connection', (socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });
  servers.push(server);
  await new Promise<void>((listening) => {
    server.listen(0, '127.0.0.1', listening);
  });
  const { port } = server.address() as AddressInfo;
  return { server, origin: `http://127.0.0.1:${port}` };
}

function closeServer(server: Server): Promise<void> {
  return new Promise((closed) => {
    if (!server.listening) {
      closed();
      return;
    }
    server.close(() => closed());
  });
}

function readBody(request: IncomingMessage): Promise<string> {
  return new Promise((done, fail) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('end', () => done(Buffer.concat(chunks).toString('utf8')));
    request.on('error', fail);
  });
}

async function rejectionOf(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('expected the request to reject');
}

afterEach(async () => {
  for (const socket of sockets) {
    socket.destroy();
  }
  sockets.clear();
  await Promise.all(servers.splice(0).map(closeServer));
});

describe('createFetchHttpPort against a loopback server', () => {
  // undici's `Headers.forEach` already yields lower-case names, so the header
  // assertion below pins the lower-case output the port returns; it does not
  // prove the port's own `.toLowerCase()` does the work.
  it('round-trips the method, headers and body, and returns lower-case response header names', async () => {
    let received: { method?: string; headers: IncomingMessage['headers']; body: string } | undefined;
    const { origin } = await startServer((request, response) => {
      void readBody(request).then(
        (body) => {
          received = { method: request.method, headers: request.headers, body };
          response.writeHead(201, { 'X-Mixed-Case': 'Value-Kept', 'Content-Type': 'text/plain' });
          response.end('created body');
        },
        () => {
          response.destroy();
        },
      );
    });

    const result = await createFetchHttpPort().send({
      method: 'POST',
      url: `${origin}/api/trade/search`,
      headers: { 'content-type': 'application/json', 'x-request-tag': 'loopback' },
      body: '{"query":1}',
    });

    expect(received?.method).toBe('POST');
    expect(received?.headers['content-type']).toBe('application/json');
    expect(received?.headers['x-request-tag']).toBe('loopback');
    expect(received?.body).toBe('{"query":1}');

    expect(result.status).toBe(201);
    expect(result.headers['x-mixed-case']).toBe('Value-Kept');
    expect(Object.keys(result.headers).every((name) => name === name.toLowerCase())).toBe(true);
    expect(result.body).toBe('created body');
  });

  it('rejects with a TimeoutError that yields when the server never answers', async () => {
    const { origin } = await startServer(() => {
      // Accept the request and never answer.
    });

    const error = await rejectionOf(
      createFetchHttpPort({ timeoutMs: 100 }).send({ method: 'GET', url: `${origin}/hang`, headers: {} }),
    );

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).name).toBe('TimeoutError');
    expect(isTransportFailure(error)).toBe(true);
  });

  it('rejects with a TimeoutError that yields when the server sends headers and never ends the body', async () => {
    const { origin } = await startServer((_request, response) => {
      response.writeHead(200, { 'Content-Type': 'text/plain' });
      response.write('partial');
      // Never end the body: the timeout must cover `response.text()` too.
    });

    const error = await rejectionOf(
      createFetchHttpPort({ timeoutMs: 100 }).send({ method: 'GET', url: `${origin}/stall`, headers: {} }),
    );

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).name).toBe('TimeoutError');
    expect(isTransportFailure(error)).toBe(true);
  });

  it('uses REQUEST_TIMEOUT_MS when called with no options', async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    try {
      const { origin } = await startServer((_request, response) => {
        response.end('ok');
      });

      await createFetchHttpPort().send({ method: 'GET', url: `${origin}/default`, headers: {} });

      expect(timeout).toHaveBeenCalledWith(REQUEST_TIMEOUT_MS);
    } finally {
      timeout.mockRestore();
    }
  });

  it('rejects with TypeError("fetch failed") that yields when the connection is refused', async () => {
    const { server, origin } = await startServer(() => {
      throw new Error('a closed server receives no request');
    });
    await closeServer(server);

    const error = await rejectionOf(
      createFetchHttpPort().send({ method: 'GET', url: `${origin}/refused`, headers: {} }),
    );

    expect(error).toBeInstanceOf(TypeError);
    expect((error as TypeError).message).toBe('fetch failed');
    expect(isTransportFailure(error)).toBe(true);
  });

  it('rejects with TypeError("fetch failed") that yields when the socket is reset', async () => {
    const { origin } = await startServer((request) => {
      request.socket.destroy();
    });

    const error = await rejectionOf(
      createFetchHttpPort().send({ method: 'GET', url: `${origin}/reset`, headers: {} }),
    );

    expect(error).toBeInstanceOf(TypeError);
    expect((error as TypeError).message).toBe('fetch failed');
    expect(isTransportFailure(error)).toBe(true);
  });
});
