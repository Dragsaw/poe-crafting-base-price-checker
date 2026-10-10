import { afterEach, describe, expect, it } from 'vitest';

import { MARK_COLORS } from '../marks/marks';
import { VALID_BODIES } from '../test-support/artifact-server';
import { mount, mountedContainer, NOW, rgb, unmount } from '../test-support/dom';
import { rawEntry, unpriced } from '../test-support/list-fixtures';
import { PageProvider } from '../theme/PageProvider';
import { colors, layout, px, stacks, typeRoles } from '../theme/tokens';
import { SyncReportPanel } from './SyncReportPanel';
import { PANEL_HEADINGS, panelColumns, problemSummary, type PanelInput } from './trust-facts';
import type { Parsed } from '../load/artifacts';

type SyncReport = Parsed<'syncReport'>;

afterEach(unmount);

const REPORT = VALID_BODIES.syncReport as SyncReport;
const CURATION = { pinnedCount: 2, minChunkSearches: 1 };
const STARVED = {
  kind: 'pinned-starvation' as const,
  discoveredAllowance: 1,
  declaredMinChunkSearches: 1,
  pinnedCount: 2,
  pinnedRefreshed: 1,
  activeRefreshed: 0,
};
const FAILURE = { check: 'kind-agreement' as const, entryKey: '["crafted","x","Bows",82,null,null]', detail: 'one line is banded' };

function mountPanel(overrides: Partial<PanelInput> = {}): HTMLElement {
  const report = 'report' in overrides ? overrides.report : { ...REPORT, records: [STARVED] };
  const input: PanelInput = {
    weights: VALID_BODIES.weights as PanelInput['weights'],
    absent: [],
    now: NOW,
    problems: problemSummary([unpriced(rawEntry('Lost'), { state: 'unresolvable' })], report, CURATION),
    crossFileFailures: [FAILURE],
    ...overrides,
    report,
  };
  mount(
    <PageProvider>
      <SyncReportPanel columns={panelColumns(input)} />
    </PageProvider>,
  );
  const found = mountedContainer()?.querySelector<HTMLElement>('[data-sync-report-panel]');
  if (found === null || found === undefined) {
    throw new Error('no panel');
  }
  return found;
}

const columns = (panel: HTMLElement): HTMLElement[] => [...panel.querySelectorAll<HTMLElement>(':scope > [data-panel-column]')];

describe('the sync report panel (state 32)', () => {
  it('lays four equal columns on the surface, capped at 400px with its own scroll', () => {
    const panel = mountPanel();
    expect(panel.style.display).toBe('grid');
    expect(panel.style.gridTemplateColumns).toBe('repeat(4, minmax(0, 1fr))');
    expect(panel.style.maxHeight).toBe(px(layout.syncReportMaxHeight));
    expect(panel.style.overflowY).toBe('auto');
    expect(panel.style.padding).toBe('14px 16px 12px');
    expect(panel.style.background).toBe(rgb(colors.surface));
    expect(panel.style.borderBottom).toBe(`1px solid ${rgb(colors['line-strong'])}`);
    expect(panel.style.fontSize).toBe(typeRoles['line-text'].fontSize);
    expect(panel.style.color).toBe(rgb(colors['text-secondary']));
  });

  it('heads each column once, in the Copy Deck order, uppercase and tertiary', () => {
    const headings = columns(mountPanel()).map((column) => [...column.querySelectorAll<HTMLElement>('[data-panel-heading]')]);
    expect(headings.map((found) => found.map((heading) => heading.textContent))).toEqual(PANEL_HEADINGS.map((heading) => [heading]));
    for (const [heading] of headings) {
      expect(heading?.style.textTransform).toBe('uppercase');
      expect(heading?.style.color).toBe(rgb(colors['text-tertiary']));
    }
  });

  it('leads a broken line with ✕ and a starved line with ◐, each in its colour, the words in the body colour', () => {
    const [problems] = columns(mountPanel());
    const marks = [...(problems?.querySelectorAll<HTMLElement>('[data-problem-mark]') ?? [])];
    expect(marks.map((mark) => mark.dataset['problemMark'])).toEqual(['broken', 'rough']);
    for (const mark of marks) {
      const verdict = mark.dataset['problemMark'] as 'broken' | 'rough';
      expect(mark.querySelector<SVGElement>(`svg[data-mark="${verdict}"]`)?.style.color).toBe(rgb(MARK_COLORS[verdict]));
    }
  });

  it('sets the diagnosis in the mono stack at the panel size, uncounted and uncoloured, after the problems', () => {
    const [problems] = columns(mountPanel());
    const verbatim = problems?.querySelector<HTMLElement>('[data-verbatim]');
    expect(verbatim?.textContent).toBe(`${FAILURE.check} · ${FAILURE.entryKey} · ${FAILURE.detail}`);
    expect(verbatim?.style.fontFamily).toBe(stacks.mono);
    expect(verbatim?.style.fontSize).toBe('');
    expect(verbatim?.style.color).toBe('');
    const groups = problems?.querySelectorAll<HTMLElement>('[data-figure-group]') ?? [];
    expect(groups).toHaveLength(2);
    expect(groups[1]?.style.marginTop).toBe(px(layout.syncReportGroupGap));
  });

  it('prints figures in the text colour with tabular numerals, and a missing figure as a plain phrase', () => {
    const panel = mountPanel({ report: undefined });
    const figure = panel.querySelector<HTMLElement>('[data-figure]');
    expect(figure?.style.color).toBe(rgb(colors.text));
    expect(figure?.style.fontVariantNumeric).toBe('tabular-nums');
    const missing = panel.querySelector<HTMLElement>('[data-missing]');
    expect(missing?.style.fontStyle).toBe('');
    expect(missing?.style.color).toBe('');
  });
});
