import type { JSX } from 'react';

import { colors, typeStyle } from '../theme/tokens';

/** DESIGN.md `show-more`: accent text, `+` or `−`, no chrome. One look serves every show-more and act. */
export function ShowMore({
  name,
  isOpen,
  onToggle,
  children,
}: {
  readonly name: string;
  /** Absent on an act, such as the retry, that opens nothing. */
  readonly isOpen?: boolean;
  readonly onToggle: () => void;
  readonly children: string;
}): JSX.Element {
  return (
    <div style={{ paddingTop: '8px' }}>
      <button
        type="button"
        data-show-more={name}
        aria-expanded={isOpen}
        onClick={onToggle}
        style={{
          ...typeStyle('trust'),
          padding: 0,
          border: 0,
          background: 'none',
          color: colors.accent,
          cursor: 'pointer',
        }}
      >
        {children}
      </button>
    </div>
  );
}
