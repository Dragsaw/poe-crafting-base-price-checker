import type { JSX } from 'react';

import { colors, px, layout, typeStyle } from '../theme/tokens';
import type { ActiveRanking } from './active-ranking';

/** The banner's lead (EXPERIENCE.md, *The uniform-prior banner*): something in the pool was invented. */
const BANNER_LEAD = 'Some of the weights behind this ranking were invented.';

/** The banner's body: it points at per-row freshness and never says the whole pool is invented. */
const BANNER_BODY =
  'Every crafted row rests on at least one tier whose weight is a prior, not a measurement, so the order between Item Classes is not evidence-backed. Read each row’s mark and freshness before you trust it.';

/** The dismiss control's text. */
const BANNER_DISMISS = 'dismiss for this session';

// FR-11. Reads every ranked crafted row before the top-20 bound; with none it would be false.
export function isBannerRaised(active: Pick<ActiveRanking, 'ordering'>): boolean {
  const crafted = active.ordering.filter((row) => row.kind === 'crafted');
  return crafted.length > 0 && crafted.every((row) => row.provenance === 'uniform-prior');
}

/** `{components.uniform-prior-banner}`: dismissal lasts the session, in the caller's memory. */
export function UniformPriorBanner({ onDismiss }: { readonly onDismiss: () => void }): JSX.Element {
  return (
    <div
      data-uniform-prior-banner=""
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        minHeight: px(layout.bannerMinHeight),
        boxSizing: 'border-box',
        background: colors.surface,
        borderLeft: `${px(layout.bannerMarker)} solid ${colors['trust-rough']}`,
        padding: '13px 17px',
        color: colors.text,
      }}
    >
      <div>
        <p style={{ ...typeStyle('line-text'), margin: 0 }}>{BANNER_LEAD}</p>
        <p style={{ ...typeStyle('line-text'), margin: 0, color: colors['text-secondary'] }}>{BANNER_BODY}</p>
      </div>
      <button
        type="button"
        data-banner-dismiss=""
        onClick={onDismiss}
        style={{
          ...typeStyle('line-text'),
          flex: '0 0 auto',
          marginLeft: 16,
          padding: 0,
          border: 0,
          background: 'none',
          cursor: 'pointer',
          color: colors['text-tertiary'],
        }}
      >
        {BANNER_DISMISS} ×
      </button>
    </div>
  );
}
