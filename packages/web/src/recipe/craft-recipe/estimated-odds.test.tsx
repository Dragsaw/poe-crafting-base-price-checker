import type { ModifierWeight } from '@poe/contracts';
import { afterEach, describe, expect, it } from 'vitest';

import { settleTo, unmount } from '../../test-support/dom';
import {
  mount,
  frame,
  tier,
  TARGET,
  FILLER,
  LOW,
  SUFFIX,
  type Pools,
  STAVES,
  serveWorld,
  standardWorld,
  option,
  click,
} from './test-support';

afterEach(() => {
  unmount();
  localStorage.clear();
});

/** The names of the rows that draw ≈ before their EV (state 12), sorted. */
const estimated = (): string[] =>
  Array.from(frame().querySelectorAll('[data-ranked-row]'), (row) =>
    row.querySelector('[data-cell="ev"] [data-estimate] svg[data-mark="estimate"]') === null ? '' : (row.querySelector('[data-unit-name]')?.textContent ?? ''),
  )
    .filter((name) => name !== '')
    .toSorted((a, b) => a.localeCompare(b));

const invented = (item: ModifierWeight): ModifierWeight => ({ ...item, weightSource: 'absent' });

describe('the estimated-odds cue from weights data (state 12)', () => {
  /** An invented tier at floor 50: in the greater recipe's set (floor 44), not under perfect (70). */
  const priorBows: Pools = [
    [tier(TARGET, 10, 75, 'bows'), invented(tier(FILLER, 10, 50, 'bows')), tier(LOW, 80, 1, 'bows')],
    [tier(SUFFIX, 10, 80)],
  ];
  const priorStaves: Pools = [
    [tier(TARGET, 50, 50, 'staves'), invented(tier(FILLER, 50, 50, 'staves')), tier(FILLER, 50, 75, 'staves')],
    [tier(SUFFIX, 10, 80)],
  ];

  it('draws ≈ on the invented-tier rows under the recipe that estimates, none under the other, and follows a switch both ways', async () => {
    serveWorld(standardWorld({ classes: [['weapon.bow', 'Bows', priorBows], ['weapon.staff', 'Staves', priorStaves]] }));
    mount();
    await settleTo('ready');
    expect(estimated()).toEqual(['Bows', 'Staves']);
    // A Raw Base never carries ≈ (state 12a).
    expect(frame().querySelectorAll('[data-ranked-row][data-raw] [data-estimate]')).toHaveLength(0);
    click(option('perfect'));
    expect(estimated()).toEqual([]);
    click(option('greater'));
    expect(estimated()).toEqual(['Bows', 'Staves']);
    expect(frame().querySelectorAll('[data-ranked-row][data-raw] [data-estimate]')).toHaveLength(0);
  });

  it('draws ≈ on the estimated row only, beside a measured one', async () => {
    serveWorld(standardWorld({ classes: [['weapon.bow', 'Bows', priorBows], ['weapon.staff', 'Staves', STAVES]] }));
    mount();
    await settleTo('ready');
    expect(estimated()).toEqual(['Bows']);
  });
});
