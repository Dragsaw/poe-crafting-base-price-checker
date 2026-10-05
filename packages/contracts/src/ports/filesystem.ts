/** The filesystem effect (AD-1); `sync` writes the files it owns by explicit path and exits (AD-3). */

export interface FilesystemPort {
  /** The file's contents, or `undefined` where the path does not exist. */
  readTextFile(path: string): Promise<string | undefined>;

  /** Writes UTF-8 without BOM, LF endings and a trailing newline (Consistency Conventions, *Encoding*), so a data diff shows data, not reserialisation. */
  writeTextFile(path: string, contents: string): Promise<void>;

  /** Creates the path only if absent, atomically: of concurrent callers exactly one resolves `true`, which makes taking the sync lock safe (AD-7). */
  createExclusive(path: string, contents: string): Promise<boolean>;

  /** Removes the path. Removing a path that does not exist is not an error. */
  deleteFile(path: string): Promise<void>;

  exists(path: string): Promise<boolean>;

  /** The path's last-modified time as ISO-8601 UTC, or `undefined` where unreadable. A working-tree time, not a published edit (`tracked-list-age.ts`). */
  lastModifiedAt(path: string): Promise<string | undefined>;
}
