/** Read-only, one operation (AD-1, AD-3): a git write is an AD-3 amendment. */

export interface GitPort {
  /** `undefined` is no failure: a new file has no commit, and `tracked-list-age.ts` falls back. */
  lastCommitAuthorDate(path: string): Promise<string | undefined>;
}
