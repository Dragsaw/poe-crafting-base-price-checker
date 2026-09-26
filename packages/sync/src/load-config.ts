/**
 * The player config, read from `data/config.json` (`ConfigFileSchema`,
 * read-only, AD-19). Absent or invalid is a typed refusal naming the file.
 *
 * Deliberately outside `chunk/`: the chunk runner and the pricing step receive
 * the league as a value, and nothing in `chunk/` names the config file.
 */

import { ConfigFileSchema, parseEnvelope } from '@poe/contracts';
import type { ConfigFile, FilesystemPort, LeagueId } from '@poe/contracts';

import { loadDataFile } from './load-data-file.ts';
import type { DataFileResult } from './load-data-file.ts';

export const CONFIG_PATH = 'data/config.json';

export function loadConfig(fs: FilesystemPort): Promise<DataFileResult<ConfigFile>> {
  return loadDataFile(fs, CONFIG_PATH, (data) => parseEnvelope(ConfigFileSchema, data));
}

export async function loadActiveLeague(fs: FilesystemPort): Promise<DataFileResult<LeagueId>> {
  const loaded = await loadConfig(fs);
  return loaded.ok ? { ok: true, value: loaded.value.league } : loaded;
}
