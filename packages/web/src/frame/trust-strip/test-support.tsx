import { act } from 'react';

import type { ArtifactSet, Parsed, TolerableKey } from '../../load/artifacts';
import { NBSP } from '../../shared/text';
import { VALID_BODIES } from '../../test-support/artifact-server';
import { mount, mountedContainer } from '../../test-support/dom';
import type { DiagnosisFailure } from '../trust-facts';
import { TrustStrip } from '../TrustStrip';

export type SyncReport = Parsed<'syncReport'>;

/** Not the shared `NOW`: this clock mirrors the committed report's run, so Last synced reads it. */
const REPORT_CLOCK = Date.parse('2026-09-26T21:32:00.000Z');
export const BASE_SET = VALID_BODIES as unknown as ArtifactSet;
export const COMMITTED_REPORT: SyncReport = {
  schemaVersion: '1.1.0',
  runStartedAt: '2026-09-26T20:51:10.620Z',
  runFinishedAt: '2026-09-26T20:51:13.533Z',
  figures: {
    requestsBySource: { 'tracked-list': 10, 'league-validation': 1, 'session-probe': 0 },
    notReachedCount: 0,
    trackedListEditedAt: { source: 'file-modified', at: '2026-09-26T11:23:42.140Z' },
  },
  records: [],
};

export function mountStrip(
  overrides: Partial<ArtifactSet> = {},
  absent: readonly TolerableKey[] = [],
  crossFileFailures: readonly DiagnosisFailure[] = [],
): HTMLDivElement {
  const set: ArtifactSet = { ...BASE_SET, syncReport: COMMITTED_REPORT, ...overrides };
  return mount(<TrustStrip set={set} absent={absent} now={REPORT_CLOCK} crossFileFailures={crossFileFailures} />);
}

export function strip(): HTMLElement {
  const found = mountedContainer()?.querySelector<HTMLElement>('[data-trust-strip]');
  if (found === null || found === undefined) {
    throw new Error('no trust strip rendered');
  }
  return found;
}

export function line(name: string): string {
  const lines = [...strip().querySelectorAll<HTMLElement>('[data-trust-line]')];
  const found = lines.find((node) => node.dataset['trustLine'] === name);
  return (found?.textContent ?? '').replaceAll(NBSP, ' ');
}
export const panel = (): HTMLElement | undefined => mountedContainer()?.querySelector<HTMLElement>('[data-sync-report-panel]') ?? undefined;
export const affordance = (): string | null | undefined => strip().querySelector('[data-strip-affordance]')?.textContent;

export function click(target: Element | null | undefined): void {
  act(() => {
    (target as HTMLElement).click();
  });
}
