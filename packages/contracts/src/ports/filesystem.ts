/**
 * The filesystem effect (AD-1). `sync` writes the files it owns by explicit
 * path and exits (AD-3).
 */

export interface FilesystemPort {
  /** The file's contents, or `undefined` where the path does not exist. */
  readTextFile(path: string): Promise<string | undefined>;

  /**
   * Writes UTF-8 without BOM, LF line endings, with a trailing newline
   * (Consistency Conventions, *Encoding*) — so a data commit's diff shows
   * changed data rather than reserialisation noise.
   */
  writeTextFile(path: string, contents: string): Promise<void>;

  /** Removes the path. Removing a path that does not exist is not an error. */
  deleteFile(path: string): Promise<void>;

  exists(path: string): Promise<boolean>;

  /**
   * The path's last-modified time as an ISO-8601 UTC string, or `undefined`
   * where the path is not readable.
   *
   * This is the **second** clock that can answer "when was the tracked list
   * last edited?" (`tracked-list-age.ts`). It is a working-tree time and not a
   * published edit, which is why the answer is tagged and never a bare
   * timestamp.
   */
  lastModifiedAt(path: string): Promise<string | undefined>;
}
