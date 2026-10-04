import type { ModifierWeight } from '@poe/contracts';
import { afterEach, describe, expect, it } from 'vitest';

import { HAIR_SPACE } from '../../list/TrustMark';
import { settleTo, unmount } from '../../test-support/dom';
import { glyphs } from '../../theme/tokens';
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
const priorMarks = (): string[] =>
  Array.from(frame().querySelectorAll('[data-ranked-row] [data-cell="provenance"]'), (node) => node.textContent ?? '');

const invented = (item: ModifierWeight): ModifierWeight => ({ ...item, weightSource: 'absent' });

describe('Provenance marks and the banner', () => {
  /** An invented tier at floor 50 sits in the greater recipe's eligible set (floor 44) and under the perfect floor (70). */
  const priorBows: Pools = [[tier(TARGET, 10, 75), invented(tier(FILLER, 10, 50)), tier(LOW, 80, 1)], [tier(SUFFIX, 10, 80)]];
  const priorStaves: Pools = [[tier(TARGET, 50, 50), invented(tier(FILLER, 50, 50))], [tier(SUFFIX, 10, 80)]];

  it('prints prior only on a pair with an invented tier, raises the banner, and follows a recipe switch', async () => {
    serveWorld(standardWorld({ classes: [['weapon.bow', 'Bows', priorBows], ['weapon.staff', 'Staves', priorStaves]] }));
    mount();
    await settleTo('ready');
    expect(banner()).not.toBeNull();
    expect(banner()?.textContent).not.toMatch(/uniform-prior|absent|published/);
    const marks = priorMarks().filter((text) => text !== '');
    expect(marks).toHaveLength(2);
    expect(marks.every((text) => text === `${glyphs.prior}${HAIR_SPACE}prior only`)).toBe(true);
    // The raw rows stay silent, and no expansion repeats the mark.
    click(rowNamed('Bows'));
    expect(frame().querySelector('[data-expansion-panel] [data-trust-mark="prior"]')).toBeNull();
    click(option('perfect'));
    expect(banner()).toBeNull();
    expect(priorMarks().filter((text) => text !== '')).toEqual([]);
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
    expect(priorMarks().filter((text) => text !== '')).toHaveLength(2);
  });

  it('lowers the banner while a measured crafted row is on the list, and prints no mark', async () => {
    serveWorld(standardWorld({ classes: [['weapon.bow', 'Bows', priorBows], ['weapon.staff', 'Staves', STAVES]] }));
    mount();
    await settleTo('ready');
    expect(banner()).toBeNull();
    expect(priorMarks().filter((text) => text !== '')).toHaveLength(1);
  });

  it('raises no banner with no crafted row', async () => {
    serveWorld(standardWorld({ tracked: [belt, amulet], dataset: [], classes: [] }));
    mount();
    await settleTo('ready');
    expect(banner()).toBeNull();
  });
});
