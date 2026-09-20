import { describe, expect, it } from 'vitest';

import { createFakeFilesystemPort } from './ports/fakes/filesystem';
import { createFakeGitPort } from './ports/fakes/git';
import { resolveTrackedListAge, TrackedListAgeSchema } from './tracked-list-age';
import type { TrackedListAge } from './tracked-list-age';

const PATH = 'data/tracked.json';

describe('resolveTrackedListAge', () => {
  // I/O matrix: "Edit date from git".
  it('reads the git author date first, tagged git-author-date', async () => {
    const git = createFakeGitPort({ [PATH]: '2026-09-18T11:00:00Z' });
    const filesystem = createFakeFilesystemPort({
      [PATH]: { contents: '{}', modifiedAt: '2026-09-20T07:00:00Z' },
    });

    await expect(resolveTrackedListAge({ git, filesystem, path: PATH })).resolves.toEqual({
      source: 'git-author-date',
      at: '2026-09-18T11:00:00Z',
    });
  });

  // I/O matrix: "Edit date fallback".
  it('falls back to the filesystem clock, tagged file-modified', async () => {
    const git = createFakeGitPort();
    const filesystem = createFakeFilesystemPort({
      [PATH]: { contents: '{}', modifiedAt: '2026-09-20T07:00:00Z' },
    });

    await expect(resolveTrackedListAge({ git, filesystem, path: PATH })).resolves.toEqual({
      source: 'file-modified',
      at: '2026-09-20T07:00:00Z',
    });
  });

  // I/O matrix: "Edit date absent".
  it('answers absent where neither clock answers, and never a placeholder', async () => {
    const git = createFakeGitPort();
    const filesystem = createFakeFilesystemPort();

    await expect(resolveTrackedListAge({ git, filesystem, path: PATH })).resolves.toBeUndefined();
  });

  it('answers absent where the file exists but carries no readable mtime', async () => {
    const git = createFakeGitPort();
    const filesystem = createFakeFilesystemPort({ [PATH]: { contents: '{}' } });

    await expect(resolveTrackedListAge({ git, filesystem, path: PATH })).resolves.toBeUndefined();
  });
});

describe('TrackedListAgeSchema', () => {
  it('carries the timestamp and its source tag together', () => {
    expect(
      TrackedListAgeSchema.parse({ source: 'git-author-date', at: '2026-09-18T11:00:00Z' }),
    ).toEqual({ source: 'git-author-date', at: '2026-09-18T11:00:00Z' });
  });

  it('refuses an untagged timestamp and an unknown tag at runtime too', () => {
    expect(TrackedListAgeSchema.safeParse({ at: '2026-09-18T11:00:00Z' }).success).toBe(false);
    expect(
      TrackedListAgeSchema.safeParse({ source: 'guessed', at: '2026-09-18T11:00:00Z' }).success,
    ).toBe(false);
  });

  /**
   * I/O matrix: "Untagged date" — compile-time, not runtime. `tsc -b` compiles
   * this file, so removing the `@ts-expect-error` below fails `pnpm check`.
   */
  it('does not type-check a date value constructed without its source tag', () => {
    // @ts-expect-error the tag is not optional: a timestamp cannot be reached without the clock that produced it
    const untagged: TrackedListAge = { at: '2026-09-18T11:00:00Z' };
    expect(untagged.at).toBe('2026-09-18T11:00:00Z');
  });
});
