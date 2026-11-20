import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// jsdom has no matchMedia; Mantine (color scheme, media queries) calls it.
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

// jsdom also lacks ResizeObserver and scrollIntoView; Mantine's Select dropdown uses both.
if (!window.ResizeObserver) {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
Element.prototype.scrollIntoView ??= () => undefined;

afterEach(() => cleanup());
