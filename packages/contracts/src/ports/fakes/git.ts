import type { GitPort } from '../git';

/**
 * A pure in-memory `GitPort`. It carries the one read-only operation the real
 * port carries, and no write — a fake that grew a `commit` would make an AD-3
 * violation testable, which is how such violations get written.
 */

/** Keyed by path, valued with that path's last-commit author date (ISO-8601 UTC). */
export type FakeCommitDates = Readonly<Record<string, string>>;

export interface FakeGitPort extends GitPort {
  /** Seeds or replaces a path's last-commit author date. */
  setAuthorDate(path: string, authorDate: string): void;
  /** Removes a path's history, so the port answers `undefined` for it. */
  clearHistory(path: string): void;
}

export function createFakeGitPort(initial: FakeCommitDates = {}): FakeGitPort {
  const authorDates = new Map<string, string>(Object.entries(initial));

  return {
    setAuthorDate(path, authorDate) {
      authorDates.set(path, authorDate);
    },
    clearHistory(path) {
      authorDates.delete(path);
    },
    lastCommitAuthorDate(path) {
      return Promise.resolve(authorDates.get(path));
    },
  };
}
