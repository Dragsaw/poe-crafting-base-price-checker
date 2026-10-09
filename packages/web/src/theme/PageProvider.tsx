import { MantineProvider } from '@mantine/core';
import type { JSX, ReactNode } from 'react';

import { cssVariablesResolver, theme } from './theme';

/** The override layer, applied once. Dark only: the page has one theme and ignores the OS scheme. */
export function PageProvider({ children }: { readonly children: ReactNode }): JSX.Element {
  return (
    <MantineProvider theme={theme} cssVariablesResolver={cssVariablesResolver} forceColorScheme="dark">
      {children}
    </MantineProvider>
  );
}
