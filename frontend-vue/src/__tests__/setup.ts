// jsdom has no matchMedia; PrimeVue overlays (Select, Popover) and the theme mode use it.
// Tests that need a specific answer stub it with matchMediaStub(true/false).
const noop = () => undefined

export function matchMediaStub(matches: boolean) {
  return (query: string) => ({
    matches,
    media: query,
    onchange: null,
    addEventListener: noop,
    removeEventListener: noop,
    addListener: noop,
    removeListener: noop,
    dispatchEvent: () => false,
  })
}

if (!window.matchMedia) {
  window.matchMedia = matchMediaStub(false) as unknown as typeof window.matchMedia
}
