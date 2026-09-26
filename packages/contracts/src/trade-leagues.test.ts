import { describe, expect, it } from 'vitest';

import { LeaguesPayloadSchema } from './trade-leagues';

describe('LeaguesPayloadSchema', () => {
  it('parses the endpoint shape and keeps the endpoint order', () => {
    // The shape of the recorded fixtures/trade-data-leagues.json.
    const parsed = LeaguesPayloadSchema.parse({
      result: [
        { id: 'Forbidden Rites', realm: 'poe2', text: 'Forbidden Rites' },
        { id: 'HC Forbidden Rites', realm: 'poe2', text: 'HC Forbidden Rites' },
        { id: 'Standard', realm: 'poe2', text: 'Standard' },
      ],
    });
    expect(parsed.result.map((league) => league.id)).toEqual([
      'Forbidden Rites',
      'HC Forbidden Rites',
      'Standard',
    ]);
  });

  it('preserves fields this product does not consume, rather than stripping them', () => {
    const parsed = LeaguesPayloadSchema.parse({
      result: [{ id: 'Standard', realm: 'poe2', text: 'Standard' }],
      extra: true,
    });
    expect(parsed).toEqual({
      result: [{ id: 'Standard', realm: 'poe2', text: 'Standard' }],
      extra: true,
    });
  });

  it('admits an empty league list', () => {
    expect(LeaguesPayloadSchema.parse({ result: [] })).toEqual({ result: [] });
  });

  it('refuses a body that is not the payload shape', () => {
    expect(LeaguesPayloadSchema.safeParse({ leagues: [] }).success).toBe(false);
    expect(LeaguesPayloadSchema.safeParse({ result: [{ text: 'Standard' }] }).success).toBe(false);
    expect(LeaguesPayloadSchema.safeParse({ result: [{ id: '' }] }).success).toBe(false);
    expect(LeaguesPayloadSchema.safeParse(['Standard']).success).toBe(false);
  });
});
