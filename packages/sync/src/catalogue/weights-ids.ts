/**
 * The weights ids against the catalogue (AD-9, AD-12, AD-25).
 *
 * `data/weights.json` loads through `parseEnvelope` with the `contracts`
 * `WeightsFileSchema`, the one definition of the weights contract
 * (WEIGHTS-FILE-SCHEMA.md). The ids are then collected from the typed value:
 * the outer `bases` keys (each a `categoryId`) and every line's `statId`.
 *
 * - An absent file is `absent`. The run records it and goes on (AD-12).
 * - A file that does not parse, declares a major this build does not know, or
 *   breaks any hard error of the contract is refused as a whole with a typed
 *   `DataFileError` naming the file, before any request (NFR-8). An `invalid`
 *   refusal names the first issue's path and message.
 * - A `null` `statId` is the producer's own unresolved marker: it is skipped,
 *   never reported.
 *
 * A miss against the catalogue is a report record only: the file is never
 * rewritten, and a miss never refuses it.
 */

import { compareCanonicalKeys, parseEnvelope, WEIGHTS_SCHEMA_VERSION, WeightsFileSchema } from '@poe/contracts';
import type {
  FilesystemPort,
  TrackedEntry,
  UncataloguedWeightsIdRecord,
  WeightsAbsentRecord,
} from '@poe/contracts';

import { DataFileError } from '../load-data-file.ts';
import type { CatalogueIds } from './catalogue-ids.ts';

export const WEIGHTS_PATH = 'data/weights.json';

export type WeightsIds =
  | { readonly kind: 'absent' }
  | {
      readonly kind: 'present';
      /** Every distinct non-null `statId` on any line. */
      readonly statIds: ReadonlySet<string>;
      /** Every outer `bases` key. */
      readonly categoryIds: ReadonlySet<string>;
    };

/**
 * Reads the weights ids. Absent is a value; an unreadable, unknown-major or
 * non-conforming file throws a `DataFileError`.
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
  const result = parseEnvelope(WeightsFileSchema, data, WEIGHTS_SCHEMA_VERSION);
  if (!result.ok) {
    switch (result.reason) {
      case 'unknown-major':
      case 'malformed-version':
        throw new DataFileError(
          WEIGHTS_PATH,
          result.reason,
          `schemaVersion ${result.found} refused (${result.reason}; this build reads ${result.expected})`,
        );
      case 'invalid': {
        const [first] = result.issues;
        const where = first === undefined ? '(root)' : first.path.join('.') || '(root)';
        throw new DataFileError(WEIGHTS_PATH, 'invalid', `invalid: ${where}: ${first?.message ?? 'refused'}`);
      }
    }
  }
  const { bases } = result.value;
  const statIds = new Set<string>();
  for (const classes of Object.values(bases)) {
    for (const pools of Object.values(classes)) {
      for (const entry of [...pools.prefix.entries, ...pools.suffix.entries]) {
        for (const line of entry.lines) {
          if (line.statId !== null) {
            statIds.add(line.statId);
          }
        }
      }
    }
  }
  return { kind: 'present', statIds, categoryIds: new Set(Object.keys(bases)) };
}

/**
 * One `uncatalogued-weights-id` record per distinct id the catalogue does not
 * expose, sorted by `identifierKind`, then by `identifier`, with
 * `compareCanonicalKeys` (Consistency Conventions, *Entity keys*).
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
      compareCanonicalKeys(left.identifierKind, right.identifierKind) ||
      compareCanonicalKeys(left.identifier, right.identifier),
  );
}

/**
 * The record an absent `weights.json` leaves (AD-12, AD-25): the distinct
 * `className` values of the non-pruned `crafted` entries, sorted with
 * `compareCanonicalKeys` (Consistency Conventions, *Entity keys*).
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
  return { kind: 'weights-absent', uncheckableClassNames: [...classNames].toSorted(compareCanonicalKeys) };
}
