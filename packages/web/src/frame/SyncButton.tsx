import type { JSX } from 'react';

import { MARK_COLORS, OpenSignMark, VerdictMark } from '../marks/marks';
import { headerControls, px, rounded, typeStyle } from '../theme/tokens';
import type { SyncButtonFace } from './sync-button-face';

/** `{components.sync-button}`: the age when healthy, the problem count in its place when not (states 30, 31). */
export function SyncButton({
  face,
  open,
  onToggle,
}: {
  readonly face: SyncButtonFace;
  readonly open: boolean;
  readonly onToggle: () => void;
}): JSX.Element {
  return (
    <button
      type="button"
      data-sync-button={face.kind}
      data-open={open ? '' : undefined}
      aria-expanded={open}
      className="fg-sync-button"
      onClick={onToggle}
      style={{
        ...typeStyle('label'),
        padding: `${px(headerControls.syncPadY)} ${px(headerControls.syncPadX)}`,
        borderRadius: rounded.control,
        display: 'inline-flex',
        alignItems: 'center',
        gap: px(headerControls.openSignGap),
        whiteSpace: 'nowrap',
      }}
    >
      {face.kind === 'problem' ? (
        <span
          data-problem-count={face.mark}
          style={{ color: MARK_COLORS[face.mark], fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.3em' }}
        >
          <VerdictMark verdict={face.mark} />
          {face.text}
        </span>
      ) : (
        <span data-sync-age="">{face.text}</span>
      )}
      <OpenSignMark />
    </button>
  );
}
