import { expect, it } from 'vitest';

import config from './vite.config';

/**
 * The dev-server port contract, asserted rather than trusted. No acceptance
 * criterion may require a running server, so these two settings are otherwise
 * unguarded — delete `strictPort` and the suite would stay green while Vite
 * silently bumped a second worktree onto a free port, which is how an agent
 * ends up reporting on another agent's build.
 */
it('binds one explicit port and fails rather than moving', () => {
  expect(config.server?.strictPort).toBe(true);
  expect(config.server?.port).toBe(5173);
});
