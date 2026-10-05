import type { FilesystemPort } from '../filesystem.ts';

/** An in-memory `FilesystemPort`: `contracts` has no `node:` types, so the fake runs everywhere. */

export interface FakeFile {
  readonly contents: string;
  /** ISO-8601 UTC. Omitted means the file has no readable modification time. */
  readonly modifiedAt?: string;
}

export type FakeFiles = Readonly<Record<string, FakeFile>>;

export interface FakeFilesystemPort extends FilesystemPort {
  /** Seeds or replaces a file without going through `writeTextFile`. */
  setFile(path: string, file: FakeFile): void;
  /** Every path currently held, sorted for a stable assertion. */
  paths(): string[];
}

export function createFakeFilesystemPort(initial: FakeFiles = {}): FakeFilesystemPort {
  const files = new Map<string, FakeFile>(Object.entries(initial));

  return {
    setFile(path, file) {
      files.set(path, file);
    },
    paths() {
      return [...files.keys()].toSorted((a, b) => Number(a > b) - Number(a < b));
    },
    readTextFile(path) {
      return Promise.resolve(files.get(path)?.contents);
    },
    writeTextFile(path, contents) {
      const existing = files.get(path);
      files.set(path, { contents, modifiedAt: existing?.modifiedAt });
      return Promise.resolve();
    },
    createExclusive(path, contents) {
      // The check and the set run in one synchronous turn, so no caller can interleave: the fake is
      // atomic, which lets a `Promise.all` race test prove that exactly one taker wins.
      if (files.has(path)) {
        return Promise.resolve(false);
      }
      files.set(path, { contents });
      return Promise.resolve(true);
    },
    deleteFile(path) {
      files.delete(path);
      return Promise.resolve();
    },
    exists(path) {
      return Promise.resolve(files.has(path));
    },
    lastModifiedAt(path) {
      return Promise.resolve(files.get(path)?.modifiedAt);
    },
  };
}
