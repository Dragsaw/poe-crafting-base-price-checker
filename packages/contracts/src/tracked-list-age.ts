import { z } from 'zod';

import type { FilesystemPort } from './ports/filesystem.ts';
import type { GitPort } from './ports/git.ts';
import { IsoTimestampSchema } from './primitives.ts';

/** The date plus the clock that produced it; the tag is never optional (AD-12, FR-12). */
export const TrackedListAgeSchema = z
  .discriminatedUnion('source', [
    z.strictObject({
      source: z.literal('git-author-date'),
      at: IsoTimestampSchema,
    }),
    z.strictObject({
      source: z.literal('file-modified'),
      at: IsoTimestampSchema,
    }),
  ])
  .describe(
    'The tracked-list edit date and the clock that produced it. A consumer reads the two together; there is no untagged form.',
  );

export type TrackedListAge = z.infer<typeof TrackedListAgeSchema>;

export interface TrackedListAgeSources {
  readonly git: GitPort;
  readonly filesystem: FilesystemPort;
  readonly path: string;
}

/** Git date, else mtime, else `undefined`, never a placeholder (AD-9); one order for every shell. */
export async function resolveTrackedListAge({
  git,
  filesystem,
  path,
}: TrackedListAgeSources): Promise<TrackedListAge | undefined> {
  const authorDate = await git.lastCommitAuthorDate(path);
  if (authorDate !== undefined) {
    return { source: 'git-author-date', at: authorDate };
  }
  const modifiedAt = await filesystem.lastModifiedAt(path);
  return modifiedAt === undefined ? undefined : { source: 'file-modified', at: modifiedAt };
}
