import { afterEach, describe, expect, it } from 'vitest';

import { DIV_UNIT } from '../../shared/product';
import { mount, unmount } from '../../test-support/dom';
import { hover } from '../../test-support/hover';
import { PageProvider } from '../../theme/PageProvider';
import { ColumnHeader, type ExpectedValueNote } from '../ColumnHeader';
import { EXPECTED_VALUE_TOOLTIP_COPY as COPY } from './ExpectedValueTooltip';
import { TRUST_JOINER } from './trust-words';

afterEach(unmount);

function tooltipFor(note: ExpectedValueNote): HTMLElement | null {
  const view = mount(
    <PageProvider>
      <ColumnHeader note={note} />
    </PageProvider>,
  );
  hover(view.querySelector('[data-ev-label]'));
  return document.body.querySelector<HTMLElement>('[data-ev-tooltip]');
}

const plain = (node: HTMLElement | null | undefined): string => node?.textContent.replaceAll(/\s+/g, ' ') ?? '';

describe('the EV tooltip', () => {
  it('states the live threshold and the Craft Cost, each at weight 600', () => {
    const tooltip = tooltipFor({ threshold: 0.25, cost: { kind: 'costed', text: '0.03' } });
    const [first, second, third] = [...(tooltip?.querySelectorAll('p') ?? [])];
    expect(plain(first)).toBe(
      `${COPY.head} ${COPY.what} 0.25 ${DIV_UNIT} ${COPY.subtracts} 0.03 ${DIV_UNIT} ${COPY.craftCost}`,
    );
    const figures = [...(first?.querySelectorAll<HTMLElement>('span') ?? [])].filter((span) => span.style.fontWeight === '600');
    expect(figures.map((span) => span.textContent)).toEqual(['0.25', '0.03']);
    expect(plain(second)).toBe(COPY.raw);
    expect(plain(third).trim()).toBe(`${[COPY.estimate, COPY.rough, COPY.pending, COPY.broken].join(TRUST_JOINER)}. ${COPY.hover}`);
    expect([...(third?.querySelectorAll('svg') ?? [])].map((svg) => svg.dataset['mark'])).toEqual(['estimate', 'rough', 'pending', 'broken']);
  });

  it('ends ¶1 at the threshold and adds the uncostable sentence', () => {
    const first = tooltipFor({ threshold: 1, cost: { kind: 'uncostable' } })?.querySelector('p');
    expect(plain(first)).toBe(`${COPY.head} ${COPY.what} 1.00 ${DIV_UNIT}. ${COPY.uncostable}`);
  });

  it('ends ¶1 at the threshold and adds the no-recipe sentence', () => {
    const first = tooltipFor({ threshold: 0.5, cost: { kind: 'no-recipe' } })?.querySelector('p');
    expect(plain(first)).toBe(`${COPY.head} ${COPY.what} 0.50 ${DIV_UNIT}. ${COPY.noRecipe}`);
  });

  it('holds no control', () => {
    const tooltip = tooltipFor({ threshold: 0.25, cost: { kind: 'costed', text: '0.03' } });
    expect(tooltip).not.toBeNull();
    expect(tooltip?.querySelectorAll('button, a, input, select, textarea, [role="button"]')).toHaveLength(0);
  });
});
