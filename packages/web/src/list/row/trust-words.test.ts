import { PriceTrustReasonSchema, type PriceTrustReason } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import { FIXED_ROW_REASONS, markTooltipParts, rowReasonWords, TRUST_JOINER, VERDICT_WORDS } from './trust-words';

const experience = Object.values(
  import.meta.glob<string>('../../../../../docs/ux-designs/ux-poe-crafting-base-price-checker-2026-09-13/EXPERIENCE.md', {
    eager: true,
    query: '?raw',
    import: 'default',
  }),
)[0] ?? '';

/** A string the Copy Deck or *Price trust* writes in backticks, with `N` for a count. */
function isWrittenInExperience(text: string, count?: number): boolean {
  const template = count === undefined ? text : text.replace(String(count), 'N');
  return experience.includes(`\`${text}\``) || experience.includes(`\`${template}\``);
}

const byName = (a: string, b: string): number => a.localeCompare(b);

/** One sample of each reason kind; a kind with a figure takes 5, 1 or 74. */
const SAMPLES: Readonly<Record<PriceTrustReason['kind'], { readonly reason: PriceTrustReason; readonly count?: number }>> = {
  old: { reason: { kind: 'old', days: 5 }, count: 5 },
  thin: { reason: { kind: 'thin', listings: 1 } },
  'no-listings': { reason: { kind: 'no-listings', days: 2 } },
  'never-synced': { reason: { kind: 'never-synced' } },
  'league-mismatch': { reason: { kind: 'league-mismatch' } },
  'no-exchange-rate': { reason: { kind: 'no-exchange-rate' } },
  unresolvable: { reason: { kind: 'unresolvable' } },
  uncostable: { reason: { kind: 'uncostable' } },
  'all-broken': { reason: { kind: 'all-broken' } },
  'no-prices': { reason: { kind: 'no-prices' } },
  'unreliable-share': { reason: { kind: 'unreliable-share', percent: 74 }, count: 74 },
};

describe('the reason words of a ranked row', () => {
  it('reads EXPERIENCE.md revision 25', () => {
    expect(experience).toMatch(/^revision: 25$/m);
  });

  it('samples every reason kind core can return', () => {
    const kinds = PriceTrustReasonSchema.options.map((option) => option.shape.kind.value);
    expect(Object.keys(SAMPLES).toSorted(byName)).toEqual(kinds.toSorted(byName));
  });

  it.each(Object.entries(SAMPLES))('words %s as EXPERIENCE.md writes it', (_kind, { reason, count }) => {
    const words = rowReasonWords(reason);
    expect(isWrittenInExperience(words, count), words).toBe(true);
  });

  it('prints no-listings with no days: the Raw Base tooltip column', () => {
    expect(rowReasonWords({ kind: 'no-listings', days: 9 })).toBe(FIXED_ROW_REASONS['no-listings']);
    expect(rowReasonWords({ kind: 'no-listings' })).toBe(FIXED_ROW_REASONS['no-listings']);
  });

  it('counts listings in the singular at one and the plural at two', () => {
    expect(isWrittenInExperience(rowReasonWords({ kind: 'thin', listings: 1 }))).toBe(true);
    expect(isWrittenInExperience(rowReasonWords({ kind: 'thin', listings: 2 }))).toBe(true);
  });

  it('writes the three state words as EXPERIENCE.md writes them', () => {
    for (const word of Object.values(VERDICT_WORDS)) {
      expect(isWrittenInExperience(word), word).toBe(true);
    }
  });
});

describe('the mark tooltip', () => {
  it('has nothing to say on a current price', () => {
    expect(markTooltipParts({ verdict: 'current', reasons: [] })).toBeUndefined();
  });

  // Matrix: rough share (state 17), and the Copy Deck's own example.
  it('prints `<word> · <reason>` for a rough share', () => {
    const parts = markTooltipParts({ verdict: 'rough', reasons: [{ kind: 'unreliable-share', percent: 74 }] });
    expect(parts?.word).toBe(VERDICT_WORDS.rough);
    expect(isWrittenInExperience(`${parts?.word ?? ''}${TRUST_JOINER}${parts?.reason ?? ''}`)).toBe(true);
  });

  it('joins the reasons in core’s order', () => {
    const old = { kind: 'old', days: 4 } as const;
    const thin = { kind: 'thin', listings: 2 } as const;
    expect(markTooltipParts({ verdict: 'rough', reasons: [old, thin] })?.reason).toBe(
      `${rowReasonWords(old)}${TRUST_JOINER}${rowReasonWords(thin)}`,
    );
    expect(markTooltipParts({ verdict: 'rough', reasons: [thin, old] })?.reason).toBe(
      `${rowReasonWords(thin)}${TRUST_JOINER}${rowReasonWords(old)}`,
    );
  });

  it.each([
    ['pending', 'no-prices'],
    ['broken', 'all-broken'],
    ['pending', 'uncostable'],
    ['broken', 'unresolvable'],
  ] as const)('words a %s row with its %s reason', (verdict, kind) => {
    expect(markTooltipParts({ verdict, reasons: [{ kind }] })).toEqual({ word: VERDICT_WORDS[verdict], reason: FIXED_ROW_REASONS[kind] });
  });
});
