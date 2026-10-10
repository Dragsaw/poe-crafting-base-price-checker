import { act } from 'react';

import { App } from '../App';
import { sharedServer } from '../test-support/artifact-server';
import { mount as mountNode, mountedContainer } from '../test-support/dom';
import { PageProvider } from '../theme/PageProvider';

export const server = await sharedServer();

export function mount(): HTMLDivElement {
  return mountNode(
    <PageProvider>
      <App />
    </PageProvider>,
  );
}

export function frame(): HTMLElement {
  const found = mountedContainer()?.querySelector<HTMLElement>(':scope [data-frame]');
  if (found === null || found === undefined) {
    throw new Error('no frame rendered');
  }
  return found;
}

/** The threshold field, for the statement and interaction-surface tests. */
export function payoutField(): HTMLInputElement {
  const found = frame().querySelector<HTMLInputElement>(':scope [data-payout-threshold] input');
  if (found === null) {
    throw new Error('no threshold input rendered');
  }
  return found;
}

/** The sync button in the header bar's sync slot. */
export function syncButton(): HTMLButtonElement {
  const found = frame().querySelector<HTMLButtonElement>(':scope [data-header-bar] [data-slot="sync"] [data-sync-button]');
  if (found === null) {
    throw new Error('no sync button rendered');
  }
  return found;
}

/** Clicks the sync button, as Interaction 5 does. */
export function toggleReport(): void {
  act(() => {
    syncButton().click();
  });
}

/** The sync report panel, or `null` while it is closed. */
export function reportPanel(): HTMLElement | null {
  return frame().querySelector<HTMLElement>(':scope > [data-sync-report-panel]');
}

/** The text of each line in one panel column, by its index in `PANEL_HEADINGS`. */
export function panelLines(column: number): string[] {
  const columns = reportPanel()?.querySelectorAll(':scope > [data-panel-column]') ?? [];
  return Array.from(columns[column]?.querySelectorAll('[data-panel-line]') ?? [], (line) => line.textContent.trim());
}

export function unitNames(): (string | null)[] {
  return Array.from(frame().querySelectorAll(':scope [data-ranked-row] [data-unit-name]'), (node) => node.textContent);
}
