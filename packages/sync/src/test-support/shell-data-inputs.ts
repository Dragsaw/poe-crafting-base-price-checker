import { createFakeFilesystemPort, SUPPORTED_SCHEMA_VERSION, TRACKED_SCHEMA_VERSION, WEIGHTS_SCHEMA_VERSION } from '@poe/contracts';
import type { TrackedEntry } from '@poe/contracts';

import { TRACKED_PATH } from '../chunk/run-chunk.ts';

const TEST_LEAGUE = 'Test League';

export interface ShellDataInputs {
  readonly tracked: readonly TrackedEntry[];
  /** The configured league; the currency rate is always `TEST_LEAGUE`'s. */
  readonly league?: string;
  readonly minChunkSearches?: number;
  readonly configModifiedAt?: string;
}

/** The data files a shell run reads, as seeds for a fake filesystem. */
export function shellDataInputs(options: ShellDataInputs): Parameters<typeof createFakeFilesystemPort>[0] {
  const config = {
    schemaVersion: SUPPORTED_SCHEMA_VERSION,
    league: options.league ?? TEST_LEAGUE,
    minChunkSearches: options.minChunkSearches ?? 1,
  };
  return {
    [TRACKED_PATH]: {
      contents: JSON.stringify({ schemaVersion: TRACKED_SCHEMA_VERSION, entries: options.tracked }),
      modifiedAt: '2026-09-20T07:00:00.000Z',
    },
    'data/config.json': {
      contents: JSON.stringify(config),
      ...(options.configModifiedAt !== undefined && { modifiedAt: options.configModifiedAt }),
    },
    'data/currencies.json': {
      contents: JSON.stringify({
        schemaVersion: SUPPORTED_SCHEMA_VERSION,
        rates: [{ currencyId: 'divine', rate: 1, source: 'measured', league: TEST_LEAGUE, asOf: '2026-01-01T00:00:00Z' }],
      }),
    },
    'data/catalogue/items.json': {
      contents: JSON.stringify({
        schemaVersion: SUPPORTED_SCHEMA_VERSION,
        result: [{ id: 'accessory', label: 'Accessories', entries: [{ type: 'Solar Amulet' }] }],
      }),
    },
    'data/catalogue/stats.json': { contents: JSON.stringify({ schemaVersion: SUPPORTED_SCHEMA_VERSION, result: [] }) },
    'data/catalogue/filters.json': { contents: JSON.stringify({ schemaVersion: SUPPORTED_SCHEMA_VERSION, result: [] }) },
    'data/weights.json': {
      contents: JSON.stringify({
        schemaVersion: WEIGHTS_SCHEMA_VERSION,
        gamePatch: '0.5.5',
        producer: { id: 'test', generatedAt: '2026-09-26T00:00:00Z' },
        bases: {},
      }),
    },
  };
}
