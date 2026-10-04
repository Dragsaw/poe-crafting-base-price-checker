import type { EnvelopeResult, FilesystemPort } from '@poe/contracts';

import { DataFileError, describeVersionRefusal } from '../../load-data-file.ts';
import type { VersionRefusalExplainer } from '../../load-data-file.ts';

function describeRefusal(
  path: string,
  result: Exclude<EnvelopeResult<unknown>, { ok: true }>,
  explainVersion?: VersionRefusalExplainer,
): DataFileError {
  switch (result.reason) {
    case 'unknown-major':
    case 'malformed-version': {
      return new DataFileError(path, result.reason, describeVersionRefusal(result, explainVersion));
    }
    case 'invalid': {
      return new DataFileError(
        path,
        'invalid',
        `invalid: ${result.issues
          .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
          .join('; ')}`,
      );
    }
  }
}

export async function loadEnvelope<T>(
  fs: FilesystemPort,
  path: string,
  parse: (data: unknown) => EnvelopeResult<T>,
  explainVersion?: VersionRefusalExplainer,
): Promise<T | undefined> {
  const text = await fs.readTextFile(path);
  if (text === undefined) {
    return undefined;
  }
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (error) {
    throw new DataFileError(path, 'not-json', `not valid JSON: ${String(error)}`, { cause: error });
  }
  const result = parse(data);
  if (!result.ok) {
    throw describeRefusal(path, result, explainVersion);
  }
  return result.value;
}
