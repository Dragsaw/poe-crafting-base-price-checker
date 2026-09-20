import { z } from 'zod';

import type { FilesystemPort } from './ports/filesystem.ts';
import type { GitPort } from './ports/git.ts';
import { IsoTimestampSchema } from './primitives.ts';

/**
 * The date of the last tracked-list edit, **tagged with the clock that produced
 * it**.
 *
 * Two clocks answer the same question and they mean different things: a commit
 * author date is a *published* edit, a file mtime is an edit that may never
 * have been committed. Flattened to a bare timestamp the two are
 * indistinguishable, and the trust strip's whole job is telling the player how
 * much to trust what he is reading (FR-12). Making the tag **non-optional in
 * the type** is what stops a later consumer from quietly dropping it.
 *
 * This supersedes AD-12's "a file with no commit history yields no date at all"
 * and its "an uncommitted working-tree edit does not move the date". The spine
 * needs the matching edit.
 */
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

/**
 * The one resolution order, written once so two shells cannot spell it
 * differently: the git author date is read first, and where git yields nothing
 * the filesystem's last-modified time answers instead. Where neither answers
 * the result is `undefined` — **absent, never a placeholder** (AD-9).
 */
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
  if (modifiedAt !== undefined) {
    return { source: 'file-modified', at: modifiedAt };
  }
  return undefined;
}
