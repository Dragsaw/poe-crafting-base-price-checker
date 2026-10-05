import { expect, it } from 'vitest';

import { BYSTANDER_TEST } from './names';

// Runs after `a-issuer.fixture.ts` in the same worker; the top-level wait keeps this file importing
// while the earlier timer fires. Its test passes; only its file-level check may fail.
await new Promise<void>((resolve) => {
  setTimeout(resolve, 1000);
});

it(BYSTANDER_TEST, () => {
  expect(BYSTANDER_TEST).toBeTypeOf('string');
});
