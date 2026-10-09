import { parseEnvelope, SyncProgressFileSchema } from '@poe/contracts';
import type { ClockPort, FilesystemPort } from '@poe/contracts';

import { CATALOGUE_FILTERS_PATH, CATALOGUE_STATS_PATH } from '../catalogue/catalogue-ids.ts';
import { WEIGHTS_PATH } from '../catalogue/weights-ids.ts';
import { isStaleState, LOCK_PATH, readLock } from '../chunk/lock.ts';
import { PROGRESS_PATH, TRACKED_PATH } from '../chunk/run-chunk.ts';
import { CONFIG_PATH } from '../load-config.ts';
import { CURRENCIES_PATH } from '../pricing/load-currencies.ts';
import { CATALOGUE_ITEMS_PATH } from '../pricing/load-item-types.ts';

/** Hand-owned inputs a chunk reads, never writes: a change ends an input wait, the gate is due. */
export const INPUT_PATHS: readonly string[] = [
  TRACKED_PATH,
  CONFIG_PATH,
  CURRENCIES_PATH,
  WEIGHTS_PATH,
  CATALOGUE_ITEMS_PATH,
  CATALOGUE_STATS_PATH,
  CATALOGUE_FILTERS_PATH,
];

/** Presence and `modifiedAt` of every input as one string; a transient fs fault marks its path. */
export async function inputSignature(fs: FilesystemPort): Promise<string> {
  const parts = await Promise.all(
    INPUT_PATHS.map(async (path) => {
      try {
        return [path, await fs.exists(path), await fs.lastModifiedAt(path)];
      } catch {
        return [path, 'error'];
      }
    }),
  );
  return JSON.stringify(parts);
}

/** `true` when the lock file is absent or stale; a read that throws is `false`: poll on. */
export async function isLockFree(fs: FilesystemPort, clock: ClockPort): Promise<boolean> {
  try {
    const found = await readLock(fs);
    return found.state === 'absent' ? true : (await isStaleState(fs, found, clock.now(), LOCK_PATH));
  } catch {
    return false;
  }
}

/** The `notBefore` in `sync-progress.json`, where it is readable and still after `now`. */
export async function pendingNotBefore(fs: FilesystemPort, now: string): Promise<string | undefined> {
  try {
    const text = await fs.readTextFile(PROGRESS_PATH);
    if (text === undefined) {
      return undefined;
    }
    const parsed = parseEnvelope(SyncProgressFileSchema, JSON.parse(text));
    const notBefore = parsed.ok ? parsed.value.notBefore : undefined;
    return notBefore !== undefined && Date.parse(notBefore) > Date.parse(now) ? notBefore : undefined;
  } catch {
    return undefined;
  }
}
