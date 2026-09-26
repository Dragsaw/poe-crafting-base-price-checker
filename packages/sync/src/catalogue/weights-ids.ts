/**
 * The weights ids against the catalogue (AD-9, AD-12, AD-25).
 *
 * `sync` does not validate `data/weights.json`: its schema and the cross-file
 * gate are Story 3.3's. This reader is deliberately narrow. It reads the
 * `schemaVersion` major, the outer `bases` keys (each a `categoryId`) and every
 * `bases[categoryId][className].{prefix,suffix}.entries[].lines[].statId`.
 * Anything else in the file is not read, so a shape fault this reader does not
 * need is left to 3.3's schema.
 *
 * - An absent file is `absent`. The run records it and goes on (AD-12).
 * - A file that does not parse, or declares a major this build does not know,
 *   is refused with a typed `DataFileError` naming the file (NFR-8).
 * - A `null` `statId` is the producer's own unresolved marker: it is skipped,
 *   never reported.
 *
 * A miss against the catalogue is a report record only: the file is never
 * rewritten, and a miss never refuses it.
 */

import { checkSchemaVersion } from '@poe/contracts';
import type {
  FilesystemPort,
  TrackedEntry,
  UncataloguedWeightsIdRecord,
  WeightsAbsentRecord,
} from '@poe/contracts';

import { DataFileError } from '../load-data-file.ts';
import type { CatalogueIds } from './catalogue-ids.ts';

export const WEIGHTS_PATH = 'data/weights.json';

/** The weights contract this build reads (WEIGHTS-FILE-SCHEMA.md). Only the major is compared. */
export const WEIGHTS_SCHEMA_VERSION = '6.0.0';

export type WeightsIds =
  | { readonly kind: 'absent' }
  | {
      readonly kind: 'present';
      /** Every distinct non-null `statId` on any line. */
      readonly statIds: ReadonlySet<string>;
      /** Every outer `bases` key. */
      readonly categoryIds: ReadonlySet<string>;
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function arrayAt(value: unknown, key: string): readonly unknown[] {
  if (!isRecord(value)) {
    return [];
  }
  const found = value[key];
  return Array.isArray(found) ? found : [];
}

/** The `statId` of every line under one class's two slots. Nothing else is read. */
function collectStatIds(pools: unknown, into: Set<string>): void {
  if (!isRecord(pools)) {
    return;
  }
  for (const slot of ['prefix', 'suffix']) {
    for (const entry of arrayAt(pools[slot], 'entries')) {
      for (const line of arrayAt(entry, 'lines')) {
        if (isRecord(line) && typeof line['statId'] === 'string') {
          into.add(line['statId']);
        }
      }
    }
  }
}

/**
 * Reads the weights ids. Absent is a value; an unreadable file or an unknown
 * major throws a `DataFileError`.
 */
export async function readWeightsIds(fs: FilesystemPort): Promise<WeightsIds> {
  const text = await fs.readTextFile(WEIGHTS_PATH);
  if (text === undefined) {
    return { kind: 'absent' };
  }
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (error) {
    throw new DataFileError(WEIGHTS_PATH, 'not-json', `not valid JSON: ${String(error)}`);
  }
  if (!isRecord(data) || typeof data['schemaVersion'] !== 'string') {
    throw new DataFileError(WEIGHTS_PATH, 'invalid', 'invalid: schemaVersion: expected a string');
  }
  const version = checkSchemaVersion(data['schemaVersion'], WEIGHTS_SCHEMA_VERSION);
  if (!version.ok) {
    const reason = version.reason === 'unknown-major' ? 'unknown-major' : 'malformed-version';
    throw new DataFileError(
      WEIGHTS_PATH,
      reason,
      `schemaVersion ${version.found} refused (${reason}; this build reads ${version.expected})`,
    );
  }
  const bases = data['bases'];
  if (!isRecord(bases)) {
    throw new DataFileError(WEIGHTS_PATH, 'invalid', 'invalid: bases: expected an object');
  }
  const statIds = new Set<string>();
  for (const classes of Object.values(bases)) {
    if (isRecord(classes)) {
      for (const pools of Object.values(classes)) {
        collectStatIds(pools, statIds);
      }
    }
  }
  return { kind: 'present', statIds, categoryIds: new Set(Object.keys(bases)) };
}

function compareCodeUnits(left: string, right: string): number {
  if (left === right) {
    return 0;
  }
  return left < right ? -1 : 1;
}

/**
 * One `uncatalogued-weights-id` record per distinct id the catalogue does not
 * expose, sorted by `identifierKind`, then by `identifier`, by code unit.
 */
export function checkWeightsIds(
  weights: Extract<WeightsIds, { kind: 'present' }>,
  catalogue: CatalogueIds,
): UncataloguedWeightsIdRecord[] {
  const records: UncataloguedWeightsIdRecord[] = [
    ...[...weights.categoryIds]
      .filter((id) => !catalogue.categoryIds.has(id))
      .map((identifier) => ({ identifier, identifierKind: 'categoryId' as const })),
    ...[...weights.statIds]
      .filter((id) => !catalogue.statIds.has(id))
      .map((identifier) => ({ identifier, identifierKind: 'statId' as const })),
  ].map((miss) => ({ kind: 'uncatalogued-weights-id', ...miss }));
  return records.toSorted(
    (left, right) =>
      compareCodeUnits(left.identifierKind, right.identifierKind) ||
      compareCodeUnits(left.identifier, right.identifier),
  );
}

/**
 * The record an absent `weights.json` leaves (AD-12, AD-25): the distinct
 * `className` values of the non-pruned `crafted` entries, sorted by code unit.
 * Without the file those classes are uncheckable, and they are reported so
 * rather than passed as clean.
 */
export function weightsAbsentRecord(tracked: readonly TrackedEntry[]): WeightsAbsentRecord {
  const classNames = new Set<string>();
  for (const entry of tracked) {
    if (entry.kind === 'crafted' && entry.status !== 'pruned') {
      classNames.add(entry.className);
    }
  }
  return { kind: 'weights-absent', uncheckableClassNames: [...classNames].toSorted(compareCodeUnits) };
}
