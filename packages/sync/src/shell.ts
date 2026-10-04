/**
 * The imperative shell's real effects, in one module (AD-1).
 *
 * `fetch`, the system clock, a real delay, a real write and the real
 * `FilesystemPort` live here and nowhere else in `sync`. Both human-invoked
 * commands — `fixtures:record` and `catalogue:refresh` — take their ports from
 * this file, so the request timeout that keeps a hung connection from blocking
 * a terminal is written once. A second hand-written `HttpPort` is exactly
 * where that detail gets dropped.
 *
 * **`createFetchHttpPort` runs only against loopback, and only in
 * `shell-fetch.test.ts`**: that file starts a `node:http` server on
 * `127.0.0.1` and pins the rejections `isTransportFailure` depends on (AD-8).
 * `catalogue-refresh.test.ts` asserts that no other test file so much as names
 * it. Every unit below the commands takes its ports as values, so a test
 * drives the fakes in `@poe/contracts` instead. The rest of this module is
 * ordinary code and `shell.test.ts` covers it against a temporary directory — the `mkdir` below is what makes the first
 * refresh on a fresh checkout work, and a claim that load-bearing needs a test
 * rather than a comment.
 */

import { mkdir, open, readFile, rm, stat, writeFile } from 'node:fs/promises';
import nodePath from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

import type { ClockPort, FilesystemPort, HttpPort } from '@poe/contracts';

/** How long a single live request may take before it is abandoned. */
export const REQUEST_TIMEOUT_MS = 30_000;

/**
 * The one serialisation for every artifact this package writes (Consistency
 * Conventions): UTF-8 without BOM, LF, two-space JSON, one trailing newline.
 *
 * Both commands call it, so a fixture and a catalogue artifact cannot diverge
 * by a byte — which is what makes "a second run against unchanged data leaves
 * no diff" a property of the code rather than of two copies agreeing today.
 */
export function serialiseJsonArtifact(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

/**
 * The real `HttpPort`. It lives at the shell edge, so `fetch` never appears
 * below a command's port wiring. Only `shell-fetch.test.ts` executes it, and
 * only against a loopback server that test starts.
 *
 * `timeoutMs` exists for that test, so a timeout case does not wait 30 s. The
 * commands call this with no argument and get `REQUEST_TIMEOUT_MS`.
 */
export function createFetchHttpPort(options: { timeoutMs?: number } = {}): HttpPort {
  const timeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_MS;
  return {
    async send(request) {
      // Without a signal a stalled connection hangs the command indefinitely,
      // with no output and no exit.
      const response = await fetch(request.url, {
        method: request.method,
        headers: { ...request.headers },
        body: request.body,
        signal: AbortSignal.timeout(timeoutMs),
      });
      const headers: Record<string, string> = {};
      for (const [headerName, headerValue] of response.headers.entries()) {
        headers[headerName.toLowerCase()] = headerValue;
      }
      return { status: response.status, headers, body: await response.text() };
    },
  };
}

export const systemClock: ClockPort = {
  now: () => new Date().toISOString(),
};

export const sleep = (ms: number): Promise<void> =>
  new Promise((done) => {
    setTimeout(done, ms);
  });

/**
 * A real delay that an abort ends at once. It resolves — never rejects — on
 * the abort, so the `pnpm sync` session reads `signal.aborted` afterwards and
 * exits 0 on the first SIGINT or SIGTERM rather than handling an error.
 */
export async function abortableSleep(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) {
    return;
  }
  try {
    await delay(Math.max(0, ms), undefined, { signal });
  } catch (error) {
    if (signal.aborted) {
      return;
    }
    throw error;
  }
}

/**
 * Writes one UTF-8 file, creating its directory. `data/catalogue/` does not
 * exist on a fresh checkout, so the `mkdir` is what makes the first refresh
 * work rather than fail on a missing directory.
 */
export async function writeTextFile(path: string, contents: string): Promise<void> {
  await mkdir(nodePath.dirname(path), { recursive: true });
  await writeFile(path, contents, { encoding: 'utf8' });
}

function hasErrorCode(error: unknown, code: string): boolean {
  return error instanceof Error && 'code' in error && error.code === code;
}

/**
 * The real `FilesystemPort`. Every path is resolved against `root`, so the
 * shell names the repository once and the code below it names `data/...`
 * exactly as the fakes do.
 */
export function createNodeFilesystemPort(root: string): FilesystemPort {
  const at = (path: string): string => nodePath.resolve(root, path);

  return {
    async readTextFile(path) {
      try {
        return await readFile(at(path), { encoding: 'utf8' });
      } catch (error) {
        if (hasErrorCode(error, 'ENOENT')) {
          return;
        }
        throw error;
      }
    },
    writeTextFile(path, contents) {
      return writeTextFile(at(path), contents);
    },
    /**
     * `wx` is `O_CREAT | O_EXCL`: the operating system creates the file only
     * if it is absent, in one step, so of two concurrent takers exactly one
     * succeeds. The contents are written after the create, so a reader can see
     * the file empty for an instant; the lock reader treats an unreadable lock
     * as held, never as free.
     */
    async createExclusive(path, contents) {
      const target = at(path);
      await mkdir(nodePath.dirname(target), { recursive: true });
      let handle;
      try {
        handle = await open(target, 'wx');
      } catch (error) {
        if (hasErrorCode(error, 'EEXIST')) {
          return false;
        }
        throw error;
      }
      try {
        await handle.writeFile(contents, { encoding: 'utf8' });
      } finally {
        await handle.close();
      }
      return true;
    },
    async deleteFile(path) {
      await rm(at(path), { force: true });
    },
    async exists(path) {
      try {
        await stat(at(path));
        return true;
      } catch (error) {
        if (hasErrorCode(error, 'ENOENT')) {
          return false;
        }
        throw error;
      }
    },
    async lastModifiedAt(path) {
      try {
        const stats = await stat(at(path));
        return stats.mtime.toISOString();
      } catch (error) {
        if (hasErrorCode(error, 'ENOENT')) {
          return;
        }
        throw error;
      }
    },
  };
}
