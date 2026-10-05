import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';
import { BaseSequencer, type TestSpecification } from 'vitest/node';

/** Runs the fixtures in path order, so the issuer always runs before the bystander. */
class ByPathSequencer extends BaseSequencer {
  override sort(files: TestSpecification[]): Promise<TestSpecification[]> {
    return Promise.resolve(files.toSorted((left, right) => left.moduleId.localeCompare(right.moduleId)));
  }
}

// Child run of `test/guard-reuse.test.ts`: one reused worker runs both fixtures in turn, so a timer
// from the first can fire between the files. Loads the real setup file.
export default defineConfig({
  test: {
    root: import.meta.dirname,
    include: ['*.fixture.ts'],
    setupFiles: [fileURLToPath(new URL('../setup.ts', import.meta.url))],
    isolate: false,
    fileParallelism: false,
    maxWorkers: 1,
    sequence: { sequencer: ByPathSequencer },
  },
});
