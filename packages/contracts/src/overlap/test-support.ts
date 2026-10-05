import { parseEnvelope, TrackedFileSchema } from '../envelopes';
import type { SingleLineModifierReference } from '../modifier-reference';
import type { CoOccur } from '../overlap';
import { TRACKED_SCHEMA_VERSION } from '../schema-version';

export const band = (statId: string, valueMin: number, valueMax: number): SingleLineModifierReference => ({
  kind: 'banded',
  statId,
  valueMin,
  valueMax,
});
export const valueless = (statId: string): SingleLineModifierReference => ({ kind: 'valueless', statId });

export const ALWAYS: CoOccur = () => true;

export const parse = (entries: readonly unknown[]) =>
  parseEnvelope(TrackedFileSchema, { schemaVersion: TRACKED_SCHEMA_VERSION, entries }, TRACKED_SCHEMA_VERSION);
