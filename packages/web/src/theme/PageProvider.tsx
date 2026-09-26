import { MantineProvider } from '@mantine/core';
import type { JSX, ReactNode } from 'react';

import { cssVariablesResolver, theme } from './theme';

/** The override layer, applied once. Light only: the page has no dark mode. */
export function PageProvider({ children }: { readonly children: ReactNode }): JSX.Element {
  return (
    <MantineProvider theme={theme} cssVariablesResolver={cssVariablesResolver} forceColorScheme="light">
      {children}
    </MantineProvider>
  );
}
