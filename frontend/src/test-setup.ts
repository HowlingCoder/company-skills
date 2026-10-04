// jsdom has no matchMedia; the Element theme service reads the preferred color scheme from it.
window.matchMedia ??= (query: string): MediaQueryList =>
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

// jsdom has no ResizeObserver; the Element typeahead observes its input to size the option list.
globalThis.ResizeObserver ??= class {
  observe(): void {
    // nothing to observe without layout
  }
  unobserve(): void {
    // see observe
  }
  disconnect(): void {
    // see observe
  }
};

// jsdom has no layout, so it does not implement scrollIntoView; the typeahead scrolls to the
// active option.
Element.prototype.scrollIntoView ??= () => undefined;
