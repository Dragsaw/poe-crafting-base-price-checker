import { createFakeFilesystemPort, DatasetFileSchema, SyncProgressFileSchema } from '@poe/contracts';
import type { DatasetFile } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import { InvalidArtifactError, writeArtifact } from './write-artifact.ts';

const PATH = 'data/dataset.json';

/** Built in the reverse of the schema's declared order, deliberately. */
function reversed(): DatasetFile {
  return {
    currencyRates: [
      { asOf: '2026-09-01T00:00:00Z', league: 'L', source: 'measured', rate: 1, currencyId: 'divine' },
    ],
    entries: [{ price: { reason: 'never-synced', state: 'not-yet-synced' }, entryKey: 'k' }],
    generatedAt: '2026-09-26T12:00:00.000Z',
    league: 'L',
    schemaVersion: '1.0.0',
  };
}

describe('writeArtifact', () => {
  it('serialises the parsed value: the schema’s key order, two-space JSON, LF, one trailing newline', async () => {
    const fs = createFakeFilesystemPort();

    await writeArtifact(fs, PATH, DatasetFileSchema, reversed());

    expect(await fs.readTextFile(PATH)).toBe(
      [
        '{',
        '  "schemaVersion": "1.0.0",',
        '  "league": "L",',
        '  "generatedAt": "2026-09-26T12:00:00.000Z",',
        '  "entries": [',
        '    {',
        '      "entryKey": "k",',
        '      "price": {',
        '        "state": "not-yet-synced",',
        '        "reason": "never-synced"',
        '      }',
        '    }',
        '  ],',
        '  "currencyRates": [',
        '    {',
        '      "currencyId": "divine",',
        '      "rate": 1,',
        '      "source": "measured",',
        '      "league": "L",',
        '      "asOf": "2026-09-01T00:00:00Z"',
        '    }',
        '  ]',
        '}',
        '',
      ].join('\n'),
    );
  });

  it('writes no BOM and no carriage return, and ends in exactly one newline', async () => {
    const fs = createFakeFilesystemPort();
    await writeArtifact(fs, PATH, DatasetFileSchema, reversed());
    const text = (await fs.readTextFile(PATH)) ?? '';
    expect(text.codePointAt(0)).toBe('{'.codePointAt(0));
    expect(text).not.toContain('\u{FEFF}');
    expect(text).not.toContain('\r');
    expect(text.endsWith('}\n')).toBe(true);
    expect(text.endsWith('\n\n')).toBe(false);
  });

  it('is byte-identical across two writes of the same value', async () => {
    const fs = createFakeFilesystemPort();
    await writeArtifact(fs, PATH, DatasetFileSchema, reversed());
    const first = await fs.readTextFile(PATH);
    await writeArtifact(fs, PATH, DatasetFileSchema, reversed());
    expect(await fs.readTextFile(PATH)).toBe(first);
  });

  it('refuses an invalid artifact with InvalidArtifactError {path, issues}, and writes nothing', async () => {
    const previous = 'the previous bytes\n';
    const fs = createFakeFilesystemPort({ [PATH]: { contents: previous } });
    const invalid = { ...reversed(), generatedAt: 'yesterday' };

    const refusal = writeArtifact(fs, PATH, DatasetFileSchema, invalid);

    await expect(refusal).rejects.toBeInstanceOf(InvalidArtifactError);
    const error = (await refusal.catch((error_: unknown) => error_)) as InvalidArtifactError;
    expect(error.path).toBe(PATH);
    expect(error.issues.map((issue) => issue.path)).toContainEqual(['generatedAt']);
    expect(error.message).toContain(PATH);
    expect(await fs.readTextFile(PATH)).toBe(previous);
  });

  it('refuses a key the strict schema does not declare', async () => {
    const fs = createFakeFilesystemPort();
    const extra = { ...reversed(), history: [] } as DatasetFile;
    await expect(writeArtifact(fs, PATH, DatasetFileSchema, extra)).rejects.toBeInstanceOf(InvalidArtifactError);
    expect(await fs.exists(PATH)).toBe(false);
  });

  it('writes the progress file in its schema’s declared order', async () => {
    const fs = createFakeFilesystemPort();
    await writeArtifact(fs, 'data/sync-progress.json', SyncProgressFileSchema, {
      schemaVersion: '1.0.0',
      completed: [],
    });
    expect(await fs.readTextFile('data/sync-progress.json')).toBe(
      '{\n  "completed": [],\n  "schemaVersion": "1.0.0"\n}\n',
    );
  });
});
