import { act } from 'react';

function dispatch(target: Element | null | undefined, types: readonly string[]): void {
  if (target === null || target === undefined) {
    throw new Error('no hover target');
  }
  act(() => {
    for (const type of types) {
      target.dispatchEvent(new MouseEvent(type, { bubbles: !type.endsWith('enter') && !type.endsWith('leave') }));
    }
  });
}

/** Moves the pointer onto `target`, as Mantine's Tooltip listens for it; inside `act`. */
export function hover(target: Element | null | undefined): void {
  dispatch(target, ['pointerover', 'pointerenter', 'mouseover', 'mouseenter', 'mousemove']);
}

/** Moves the pointer off `target`, which closes its tooltip. */
export function leave(target: Element | null | undefined): void {
  dispatch(target, ['pointerout', 'pointerleave', 'mouseout', 'mouseleave']);
}
