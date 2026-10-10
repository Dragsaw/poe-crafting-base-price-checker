import { describe, expect, it } from 'vitest';

import { MONEY_PHRASES } from '../list/format';
import { expectedValueCost } from './recipe-view';

describe('expectedValueCost', () => {
  it('reads no recipe, an uncostable recipe and a costed recipe as the EV tooltip’s three variants', () => {
    expect(expectedValueCost(undefined)).toEqual({ kind: 'no-recipe' });
    expect(expectedValueCost({ kind: 'phrase', text: MONEY_PHRASES.notYetSynced })).toEqual({ kind: 'uncostable' });
    expect(expectedValueCost({ kind: 'figure', text: '0.03' })).toEqual({ kind: 'costed', text: '0.03' });
  });
});
