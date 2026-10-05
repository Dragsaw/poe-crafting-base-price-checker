/** The weights ids against the catalogue (AD-9, AD-12, AD-25); a miss is a report record only. */

import { compareCanonicalKeys, parseEnvelope, WEIGHTS_SCHEMA_VERSION, WeightsFileSchema } from '@poe/contracts';
import type {
  FilesystemPort,
  TrackedEntry,
  UncataloguedWeightsIdRecord,
  WeightsAbsentRecord,
  WeightsFile,
  WeightsLine,
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
      /** The parsed file, which the run-start cross-file gate reads (AD-17). */
      readonly file: WeightsFile;
    };

function parseWeightsText(text: string): WeightsFile {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (error) {
    throw new DataFileError(WEIGHTS_PATH, 'not-json', `not valid JSON: ${String(error)}`);
  }
  const result = parseEnvelope(WeightsFileSchema, data, WEIGHTS_SCHEMA_VERSION);
  if (result.ok) {
    return result.value;
  }
  switch (result.reason) {
    case 'unknown-major':
    case 'malformed-version': {
      throw new DataFileError(
        WEIGHTS_PATH,
        result.reason,
        `schemaVersion ${result.found} refused (${result.reason}; this build reads ${result.expected})`,
      );
    }
    case 'invalid': {
      const [first] = result.issues;
      const where = first === undefined ? '(root)' : first.path.join('.') || '(root)';
      throw new DataFileError(WEIGHTS_PATH, 'invalid', `invalid: ${where}: ${first?.message ?? 'refused'}`);
    }
  }
}

function* weightsLines(bases: WeightsFile['bases']): Generator<WeightsLine> {
  for (const classes of Object.values(bases)) {
    for (const pools of Object.values(classes)) {
      for (const entry of [...pools.prefix.entries, ...pools.suffix.entries]) {
        yield* entry.lines;
      }
    }
  }
}

function collectStatIds(bases: WeightsFile['bases']): Set<string> {
  const statIds = new Set<string>();
  for (const line of weightsLines(bases)) {
    if (line.statId !== null) {
      statIds.add(line.statId);
    }
  }
  return statIds;
}

/** Absent is a value; an unreadable, unknown-major or invalid file throws (NFR-8). */
export async function readWeightsIds(fs: FilesystemPort): Promise<WeightsIds> {
  const text = await fs.readTextFile(WEIGHTS_PATH);
  if (text === undefined) {
    return { kind: 'absent' };
  }
  const file = parseWeightsText(text);
  const { bases } = file;
  return { kind: 'present', statIds: collectStatIds(bases), categoryIds: new Set(Object.keys(bases)), file };
}

/** One record per id the catalogue lacks, by kind then id with `compareCanonicalKeys`. */
export function checkWeightsIds(
  weights: Pick<Extract<WeightsIds, { kind: 'present' }>, 'kind' | 'statIds' | 'categoryIds'>,
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

/** Without the file the non-pruned `crafted` classes are unchecked: reported, not clean (AD-12). */
export function weightsAbsentRecord(tracked: readonly TrackedEntry[]): WeightsAbsentRecord {
  const classNames = new Set<string>();
  for (const entry of tracked) {
    if (entry.kind === 'crafted' && entry.status !== 'pruned') {
      classNames.add(entry.className);
    }
  }
  return { kind: 'weights-absent', uncheckableClassNames: [...classNames].toSorted(compareCanonicalKeys) };
}
