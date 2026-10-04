/**
 * jsdom shims the Mantine + React 19 mount test needs. Runs after the shared
 * MSW setup, which the root Vitest project and every package project share.
 */

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

Object.defineProperty(globalThis, 'matchMedia', {
  writable: true,
  configurable: true,
  value: (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      // eslint-disable-next-line unicorn/no-null -- boundary: `MediaQueryList.onchange` is typed `... | null`; `undefined` and an `as` cast both fail the compiler/lint.
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
});

globalThis.ResizeObserver = class {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
};

export {};
