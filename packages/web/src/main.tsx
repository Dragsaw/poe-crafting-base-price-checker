import '@mantine/core/styles.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';
import { PageProvider } from './theme/PageProvider';

const container = document.getElementById('root');
if (container === null) {
  throw new Error('index.html is missing the #root mount point');
}

createRoot(container).render(
  <StrictMode>
    <PageProvider>
      <App />
    </PageProvider>
  </StrictMode>,
);
