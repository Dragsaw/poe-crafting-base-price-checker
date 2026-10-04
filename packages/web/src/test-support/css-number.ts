/** The leading number of a CSS value such as `448px` or `20%`; NaN when there is none. */
export const cssNumber = (value: string): number => Number(/^[+-]?(?:\d+\.?\d*|\.\d+)/.exec(value)?.[0]);
