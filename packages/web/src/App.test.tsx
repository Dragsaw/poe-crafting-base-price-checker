import { MantineProvider } from '@mantine/core';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, expect, it } from 'vitest';

import { App, PLACEHOLDER_TEXT } from './App';

let container: HTMLDivElement | undefined;
let root: Root | undefined;

afterEach(() => {
  if (root !== undefined) {
    const mounted = root;
    act(() => {
      mounted.unmount();
    });
    root = undefined;
  }
  container?.remove();
  container = undefined;
});

it('mounts the shell under MantineProvider and renders the placeholder', () => {
  container = document.createElement('div');
  document.body.append(container);

  const mounted = createRoot(container);
  root = mounted;

  act(() => {
    mounted.render(
      <MantineProvider>
        <App />
      </MantineProvider>,
    );
  });

  expect(document.body.textContent).toContain(PLACEHOLDER_TEXT);
});
