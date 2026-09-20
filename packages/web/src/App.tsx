import { Text } from '@mantine/core';
import type { JSX } from 'react';

import { CORE_PLACEHOLDER } from '@poe/core';

/**
 * The placeholder the shell renders. Story 2.1 replaces the whole component;
 * until then this string is what the jsdom mount test asserts against. It names
 * `core` so the `web` -> `core` edge is genuinely exercised at build time.
 */
export const PLACEHOLDER_TEXT = `poe-crafting-base-price-checker: ${CORE_PLACEHOLDER}:web shell`;

export function App(): JSX.Element {
  return <Text>{PLACEHOLDER_TEXT}</Text>;
}
