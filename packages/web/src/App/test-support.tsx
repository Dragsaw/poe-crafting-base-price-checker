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

export function unitNames(): (string | null)[] {
  return Array.from(frame().querySelectorAll(':scope [data-ranked-row] [data-unit-name]'), (node) => node.textContent);
}
