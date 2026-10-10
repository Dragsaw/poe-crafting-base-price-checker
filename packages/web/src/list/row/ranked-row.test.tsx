import type { PriceTrust } from '@poe/contracts';
import { afterEach, describe, expect, it } from 'vitest';

import { MINUS } from '../../shared/money';
import { mount, rgb, unmount } from '../../test-support/dom';
import { hover, leave } from '../../test-support/hover';
import { colors, spacing } from '../../theme/tokens';
import { PageProvider } from '../../theme/PageProvider';
import type { ClassDisplayRow, ExpectedValueCell } from '../display-rows';
import { NAME_COLORS, RankedRow } from '../RankedRow';
import { MISSING_FIGURE } from './ExpectedValueCell';
import { FIXED_ROW_REASONS, rowReasonWords, TRUST_JOINER, VERDICT_WORDS } from './trust-words';

afterEach(unmount);

const CURRENT: PriceTrust = { verdict: 'current', reasons: [] };

function craftedRow(overrides: Partial<ClassDisplayRow> = {}): ClassDisplayRow {
  return {
    key: '["crafted","weapon.bow","Bows"]',
    numeral: 1,
    tier: 1,
    unit: 'class',
    label: 'Bows',
    itemLevel: 82,
    ev: { kind: 'figure', text: '1.25', negative: false },
    trust: CURRENT,
    provenance: 'measured',
    chase: [[{ text: 'T1 Mana', verbatim: false }]],
    combinations: [],
    pruned: [],
    ...overrides,
  };
}

function mountRow(row: ClassDisplayRow): HTMLElement {
  const view = mount(
    <PageProvider>
      <RankedRow row={row} open={false} onToggle={() => {}} />
    </PageProvider>,
  );
  const found = view.querySelector<HTMLElement>('[data-ranked-row]');
  if (found === null) {
    throw new Error('no row');
  }
  return found;
}

function tooltipText(row: HTMLElement): string | null | undefined {
  const mark = row.querySelector('[data-row-mark]');
  hover(mark);
  const text = document.body.querySelector('[data-mark-tooltip]')?.textContent;
  leave(mark);
  return text;
}

/** A mark's strokes and fills, without its box: jsdom has no `getHTML`. */
function drawing(svg: Element | null): string {
  return [...(svg?.children ?? [])].map((child) => new XMLSerializer().serializeToString(child)).join('');
}

const valueCellOf = (row: HTMLElement): HTMLElement | null => row.querySelector<HTMLElement>('[data-cell="ev"]');

describe('a ranked crafted row', () => {
  // Matrix: healthy crafted, measured (states 1, 11).
  it('prints a magic name, the figure, an empty but reserved mark slot and no ≈', () => {
    const row = mountRow(craftedRow());
    const name = row.querySelector<HTMLElement>('[data-unit-name]');
    expect(name?.style.color).toBe(rgb(NAME_COLORS.class));
    expect(name?.style.fontStyle).toBe('');
    expect(valueCellOf(row)?.textContent).toBe('1.25');
    const slot = row.querySelector<HTMLElement>('[data-mark-slot]');
    expect(slot?.childElementCount).toBe(0);
    expect(slot?.style.width).toBe(spacing['mark-slot']);
    expect(row.querySelector('[data-estimate]')).toBeNull();
    expect(row.querySelector('[data-sell-as-is]')).toBeNull();
    expect(row.querySelectorAll('[data-chase-cell]')).toHaveLength(3);
  });

  // Matrix: estimated odds (state 12). ≈ sits before the figure and has no tooltip of its own.
  it('draws ≈ before the figure of a uniform-prior row, with no tooltip', () => {
    const row = mountRow(craftedRow({ provenance: 'uniform-prior' }));
    const cell = valueCellOf(row);
    const children = [...(cell?.children ?? [])].map((child) => (child as HTMLElement).dataset);
    expect(children.map((data) => Object.keys(data)[0])).toEqual(['estimate', 'evFigure', 'markSlot']);
    expect(cell?.querySelector('[data-estimate] svg[data-mark="estimate"]')).not.toBeNull();
    hover(cell?.querySelector('[data-estimate]'));
    expect(document.body.querySelector('[role="tooltip"]')).toBeNull();
  });

  it.each([
    ['pending', 'no-prices'],
    ['broken', 'all-broken'],
    ['pending', 'uncostable'],
  ] as const)('draws no ≈ beside `—` on a uniform-prior %s row (%s)', (verdict, kind) => {
    const row = mountRow(craftedRow({ provenance: 'uniform-prior', ev: { kind: 'missing' }, trust: { verdict, reasons: [{ kind }] } }));
    expect(valueCellOf(row)?.textContent).toBe(MISSING_FIGURE);
    expect(row.querySelector('[data-estimate]')).toBeNull();
  });

  // Matrix: rough share (state 17).
  it('draws ◐ for a rough share and names the share in the mark tooltip', () => {
    const share = { kind: 'unreliable-share', percent: 74 } as const;
    const row = mountRow(craftedRow({ trust: { verdict: 'rough', reasons: [share] } }));
    expect(row.querySelector<HTMLElement>('[data-row-mark]')?.dataset['rowMark']).toBe('rough');
    expect(valueCellOf(row)?.textContent).toBe('1.25');
    expect(tooltipText(row)).toBe(`${VERDICT_WORDS.rough}${TRUST_JOINER}${rowReasonWords(share)}`);
    hover(row.querySelector('[data-row-mark]'));
    const word = document.body.querySelector<HTMLElement>('[data-mark-tooltip] span');
    expect(word?.style.fontWeight).toBe('600');
    expect(word?.style.color).toBe(rgb(colors['trust-rough']));
  });

  // Matrix: pending crafted (state 18) and all broken (state 41).
  it.each([
    ['pending', 'no-prices'],
    ['broken', 'all-broken'],
    ['pending', 'uncostable'],
  ] as const)('draws the %s mark and `—` for %s', (verdict, kind) => {
    const missing: ExpectedValueCell = { kind: 'missing' };
    const row = mountRow(craftedRow({ ev: missing, trust: { verdict, reasons: [{ kind }] } }));
    expect(valueCellOf(row)?.textContent).toBe(MISSING_FIGURE);
    expect(row.querySelector<HTMLElement>('[data-row-mark]')?.dataset['rowMark']).toBe(verdict);
    expect(row.querySelector(`svg[data-mark="${verdict}"]`)).not.toBeNull();
    expect(tooltipText(row)).toBe(`${VERDICT_WORDS[verdict]}${TRUST_JOINER}${FIXED_ROW_REASONS[kind]}`);
  });

  // Matrix: no qualifying combination (state 21).
  it('dims a negative EV, prints it with U+2212, and leaves every chase cell empty', () => {
    const row = mountRow(craftedRow({ ev: { kind: 'figure', text: `${MINUS}0.03`, negative: true }, chase: [] }));
    const figure = row.querySelector<HTMLElement>('[data-ev-figure]');
    expect(figure?.textContent).toBe(`${MINUS}0.03`);
    expect(figure?.style.color).toBe(rgb(colors['text-tertiary']));
    expect([...row.querySelectorAll('[data-chase-cell]')].map((cell) => cell.textContent)).toEqual(['', '', '']);
  });

  it('reserves the mark slot as the EV cell’s last child on every row, so every figure ends at one x', () => {
    const rows = [
      craftedRow(),
      craftedRow({ provenance: 'uniform-prior' }),
      craftedRow({ trust: { verdict: 'rough', reasons: [{ kind: 'unreliable-share', percent: 80 }] } }),
      craftedRow({ ev: { kind: 'missing' }, trust: { verdict: 'pending', reasons: [{ kind: 'no-prices' }] } }),
    ];
    for (const data of rows) {
      const cell = valueCellOf(mountRow(data));
      const slot = cell?.lastElementChild as HTMLElement | null | undefined;
      expect(cell?.style.justifyContent).toBe('flex-end');
      expect(slot?.dataset['markSlot']).toBe('');
      expect(slot?.style.flex).toBe(`0 0 ${spacing['mark-slot']}`);
      expect(slot?.previousElementSibling?.matches('[data-ev-figure], [data-ev-missing]')).toBe(true);
    }
  });

  // NFR-10: with colour removed, each state still reads from a silhouette.
  it('gives ◐ ○ ✕ and ≈ four different drawings', () => {
    const drawings = new Set(
      (['rough', 'pending', 'broken'] as const).map((verdict) => {
        const row = mountRow(craftedRow({ trust: { verdict, reasons: [{ kind: verdict === 'broken' ? 'all-broken' : 'no-prices' }] } }));
        return drawing(row.querySelector('[data-row-mark] svg'));
      }),
    );
    drawings.add(drawing(mountRow(craftedRow({ provenance: 'uniform-prior' })).querySelector('[data-estimate] svg')));
    expect(drawings.size).toBe(4);
  });

  it('gives the name no tooltip', () => {
    const row = mountRow(craftedRow({ trust: { verdict: 'rough', reasons: [{ kind: 'unreliable-share', percent: 90 }] } }));
    hover(row.querySelector('[data-unit-name]'));
    expect(document.body.querySelector('[role="tooltip"]')).toBeNull();
  });
});
