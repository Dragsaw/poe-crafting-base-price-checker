/**
 * The git effect (AD-1) — **read-only, one operation**.
 *
 * `sync` makes no git write of any kind: no add, commit, push, pull or tag
 * (AD-3, spine revision 18). Publishing is the player's act. A component that
 * needs a git write is an amendment to AD-3, not a method added here.
 *
 * AD-12's surviving "commit, pull and push" phrasing is stale against revision
 * 18.
 */

export interface GitPort {
  /**
   * The author date of the last commit touching `path`, as an ISO-8601 UTC
   * string, or `undefined` where the path has no commit history.
   *
   * `undefined` is not a failure: a newly added `data/tracked.json` has no
   * commit yet, and `tracked-list-age.ts` falls back to the filesystem clock
   * with the answer tagged as such.
   */
  lastCommitAuthorDate(path: string): Promise<string | undefined>;
}
