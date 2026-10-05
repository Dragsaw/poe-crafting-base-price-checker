/** The filesystem effect (AD-1); `sync` writes its own files by explicit path (AD-3). */

export interface FilesystemPort {
  /** The file's contents, or `undefined` where the path does not exist. */
  readTextFile(path: string): Promise<string | undefined>;

  /** UTF-8 no BOM, LF, trailing newline (Consistency Conventions, *Encoding*): diffs show data. */
  writeTextFile(path: string, contents: string): Promise<void>;

  /** Creates the path only if absent, atomically: one concurrent caller gets `true` (AD-7 lock). */
  createExclusive(path: string, contents: string): Promise<boolean>;

  /** Removes the path. Removing a path that does not exist is not an error. */
  deleteFile(path: string): Promise<void>;

  exists(path: string): Promise<boolean>;

  /** The path's mtime as ISO-8601 UTC, or `undefined`; a working-tree time, not a publish time. */
  lastModifiedAt(path: string): Promise<string | undefined>;
}
