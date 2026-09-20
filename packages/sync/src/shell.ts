/**
 * The imperative shell's real effects, in one module (AD-1).
 *
 * `fetch`, the system clock, a real delay and a real write live here and
 * nowhere else in `sync`. Both human-invoked commands — `fixtures:record` and
 * `catalogue:refresh` — take their ports from this file, so the request timeout
 * that keeps a hung connection from blocking a terminal is written once. A
 * second hand-written `HttpPort` is exactly where that detail gets dropped.
 *
 * **No test executes anything here.** Every unit below the commands takes its
 * ports as values, so a test drives the fakes in `@poe/contracts` instead.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import type { ClockPort, HttpPort } from '@poe/contracts';

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
 * The real `HttpPort`. It lives at the shell edge, in a file no test executes,
 * so `fetch` never appears below a command's port wiring.
 */
export function createFetchHttpPort(): HttpPort {
  return {
    async send(request) {
      // Without a signal a stalled connection hangs the command indefinitely,
      // with no output and no exit.
      const response = await fetch(request.url, {
        method: request.method,
        headers: { ...request.headers },
        body: request.body,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      const headers: Record<string, string> = {};
      response.headers.forEach((headerValue, headerName) => {
        headers[headerName.toLowerCase()] = headerValue;
      });
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
 * Writes one UTF-8 file, creating its directory. `data/catalogue/` does not
 * exist on a fresh checkout, so the `mkdir` is what makes the first refresh
 * work rather than fail on a missing directory.
 */
export async function writeTextFile(path: string, contents: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, contents, { encoding: 'utf8' });
}
