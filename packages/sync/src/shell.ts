// The imperative shell's real effects (AD-1): `fetch`, the clock, delays and the filesystem live here and nowhere else
// in `sync`, so the request timeout is written once. `createFetchHttpPort` runs only against loopback, in
// `shell-fetch.test.ts`, which pins the rejections `isTransportFailure` depends on (AD-8).

import { mkdir, open, readFile, rm, stat, writeFile } from 'node:fs/promises';
import nodePath from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

import type { ClockPort, FilesystemPort, HttpPort } from '@poe/contracts';

/** How long a single live request may take before it is abandoned. */
export const REQUEST_TIMEOUT_MS = 30_000;

// UTF-8 without BOM, LF, two-space JSON, one trailing newline (Consistency Conventions), so a fixture and an
// artifact cannot diverge by a byte.
export function serialiseJsonArtifact(value: unknown): string {
  return `${JSON.stringify(value, undefined, 2)}\n`;
}

// `timeoutMs` exists so a timeout test does not wait 30 s; the commands pass no argument.
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

// Resolves, never rejects, on abort: `pnpm sync` reads `signal.aborted` afterwards and exits 0 on the first SIGINT or SIGTERM.
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

// The `mkdir` is what makes the first refresh work on a fresh checkout, where `data/catalogue/` does not exist.
export async function writeTextFile(path: string, contents: string): Promise<void> {
  await mkdir(nodePath.dirname(path), { recursive: true });
  await writeFile(path, contents, { encoding: 'utf8' });
}

function hasErrorCode(error: unknown, code: string): boolean {
  return error instanceof Error && 'code' in error && error.code === code;
}

// `wx` is `O_CREAT | O_EXCL`: of two concurrent takers exactly one succeeds. The contents land after the create, so a
// reader can see the file empty for an instant; the lock reader treats an unreadable lock as held, never as free.
async function didCreateExclusive(target: string, contents: string): Promise<boolean> {
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
}

// Every path is resolved against `root`, so the code below names `data/...` exactly as the fakes do.
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
    createExclusive(path, contents) {
      return didCreateExclusive(at(path), contents);
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
