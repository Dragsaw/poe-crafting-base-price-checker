import { expect, it } from 'vitest';

import { CORE_PLACEHOLDER } from './index';

it('runs the core suite and resolves its one allowed workspace dependency', () => {
  expect(CORE_PLACEHOLDER).toBe('contracts:core');
});
