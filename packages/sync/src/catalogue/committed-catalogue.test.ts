import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  CatalogueFiltersFileSchema,
  CatalogueItemsFileSchema,
  CatalogueStaticFileSchema,
  CatalogueStatsFileSchema,
  parseEnvelope,
} from '@poe/contracts';
import type { EnvelopeResult } from '@poe/contracts';
import { expect, it } from 'vitest';

import { CATALOGUE_ENDPOINTS } from '../trade/endpoints.ts';
import type { CatalogueArtifact } from '../trade/endpoints.ts';

/**
 * The four **committed** catalogue files against today's `contracts` schemas
 * (retro R-11). `refreshCatalogue` validates only at write time, so a schema
 * tightened after the last refresh would otherwise go unnoticed until the next
 * one. Keyed by artifact, so a fifth endpoint does not compile until it is
 * mapped here.
 */
const PARSERS: Readonly<Record<CatalogueArtifact, (data: unknown) => EnvelopeResult<unknown>>> = {
  items: (data) => parseEnvelope(CatalogueItemsFileSchema, data),
  stats: (data) => parseEnvelope(CatalogueStatsFileSchema, data),
  filters: (data) => parseEnvelope(CatalogueFiltersFileSchema, data),
  static: (data) => parseEnvelope(CatalogueStaticFileSchema, data),
};

const ROOT = new URL('../../../../test/fixtures/frozen-data/', import.meta.url);

/** The refusal in one line, so a failure names the field rather than `false`. */
function describeFailure(result: EnvelopeResult<unknown>): string {
  if (result.ok) {
    return 'ok';
  }
  return result.reason === 'invalid' ? result.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ') : `${result.reason}: found ${result.found}, this build reads ${result.expected}`;
}

it.each(CATALOGUE_ENDPOINTS)('the committed $outputPath parses', ({ artifact, outputPath }) => {
  const data: unknown = JSON.parse(readFileSync(new URL(outputPath.slice('data/'.length), ROOT), 'utf8'));
  const result = PARSERS[artifact](data);
  expect(describeFailure(result)).toBe('ok');
});

it('the frozen catalogue/ holds exactly the endpoint artifacts', () => {
  const committed = readdirSync(fileURLToPath(new URL('catalogue/', ROOT)))
    .filter((name) => name.endsWith('.json'))
    .map((name) => `data/catalogue/${name}`)
    .sort();
  const expected = CATALOGUE_ENDPOINTS.map((endpoint) => endpoint.outputPath).sort();
  expect(committed).toEqual(expected);
});
