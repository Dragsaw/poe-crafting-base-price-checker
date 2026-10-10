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
  belt,
  amulet,
  serveWorld,
  standardWorld,
  option,
  click,
  rowNamed,
} from './test-support';

afterEach(() => {
  unmount();
  localStorage.clear();
});

const banner = (): HTMLElement | null => frame().querySelector<HTMLElement>('[data-uniform-prior-banner]');
/** The names of the rows that draw ≈ before their EV (state 12). */
const estimated = (): string[] =>
  Array.from(frame().querySelectorAll('[data-ranked-row]'), (row) =>
    row.querySelector('[data-cell="ev"] [data-estimate] svg[data-mark="estimate"]') === null ? '' : (row.querySelector('[data-unit-name]')?.textContent ?? ''),
  );

const invented = (item: ModifierWeight): ModifierWeight => ({ ...item, weightSource: 'absent' });

describe('the estimated-odds cue and the banner', () => {
  /** An invented tier at floor 50: in the greater recipe's set (floor 44), under perfect (70). */
  const priorBows: Pools = [
    [tier(TARGET, 10, 75, 'bows'), invented(tier(FILLER, 10, 50, 'bows')), tier(LOW, 80, 1, 'bows')],
    [tier(SUFFIX, 10, 80)],
  ];
  const priorStaves: Pools = [
    [tier(TARGET, 50, 50, 'staves'), invented(tier(FILLER, 50, 50, 'staves')), tier(FILLER, 50, 75, 'staves')],
    [tier(SUFFIX, 10, 80)],
  ];

  it('draws ≈ before the EV of a pair with an invented tier, raises the banner, and follows a recipe switch', async () => {
    serveWorld(standardWorld({ classes: [['weapon.bow', 'Bows', priorBows], ['weapon.staff', 'Staves', priorStaves]] }));
    mount();
    await settleTo('ready');
    expect(banner()).not.toBeNull();
    expect(banner()?.textContent).not.toMatch(/uniform-prior|absent|published/);
    expect(estimated().filter((name) => name !== '').toSorted((a, b) => a.localeCompare(b))).toEqual(['Bows', 'Staves']);
    // The raw rows stay silent (state 12a), and no expansion repeats the mark.
    expect(frame().querySelectorAll('[data-ranked-row][data-raw] [data-estimate]')).toHaveLength(0);
    click(rowNamed('Bows'));
    expect(frame().querySelector('[data-expansion-panel] [data-trust-mark="prior"]')).toBeNull();
    click(option('perfect'));
    expect(banner()).toBeNull();
    expect(estimated().filter((name) => name !== '')).toEqual([]);
    click(option('greater'));
    expect(banner()).not.toBeNull();
  });

  it('keeps the banner down for the session once dismissed, across a recipe switch', async () => {
    serveWorld(standardWorld({ classes: [['weapon.bow', 'Bows', priorBows], ['weapon.staff', 'Staves', priorStaves]] }));
    mount();
    await settleTo('ready');
    click(banner()?.querySelector('[data-banner-dismiss]') as Element);
    expect(banner()).toBeNull();
    click(option('perfect'));
    click(option('greater'));
    expect(banner()).toBeNull();
    expect(estimated().filter((name) => name !== '')).toHaveLength(2);
  });

  it('lowers the banner while a measured crafted row is on the list, and prints no mark', async () => {
    serveWorld(standardWorld({ classes: [['weapon.bow', 'Bows', priorBows], ['weapon.staff', 'Staves', STAVES]] }));
    mount();
    await settleTo('ready');
    expect(banner()).toBeNull();
    expect(estimated().filter((name) => name !== '')).toHaveLength(1);
  });

  it('raises no banner with no crafted row', async () => {
    serveWorld(standardWorld({ tracked: [belt, amulet], dataset: [], classes: [] }));
    mount();
    await settleTo('ready');
    expect(banner()).toBeNull();
  });
});
